/**
 * Free-text status lookup (SPEC §3.6). Any plain message whose normalized form
 * is a valid 8–20 char code is treated as a status query — even without pressing
 * a button. Non-codes fall back to the help text (§3.11).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { InlineKeyboard, InputFile } from 'grammy';

import {
  formatDate,
  formatKg,
  formatSom,
  isValidTrackCode,
  normalizeCode,
  STATUS_META,
} from '@kargotrack/shared';

import type { Track } from '@kargotrack/db/schema';

import { getConfig } from '../config';
import type { KargoContext } from '../context';
import { helpFallbackKeyboard, trackCardKeyboard } from '../keyboards';
import {
  findTrackByCode,
  getBatchById,
  getLastEventAt,
  listTrackPhotoPaths,
} from '../queries';
import { logger } from '../logger';

/** Reformat a stored `YYYY-MM-DD` date to display `DD.MM.YYYY` (§4 formatting). */
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

/**
 * Absolute paths of a track's stored photos (newest first, §7.14), keeping
 * only files that actually exist on disk. Capped at one Telegram album.
 */
async function photoAbsPathsOf(
  ctx: KargoContext,
  track: Track,
): Promise<string[]> {
  const paths = await listTrackPhotoPaths(ctx.tenant.id, track.id);
  const dir = getConfig().uploadsDir;
  return paths.map((p) => join(dir, p)).filter((abs) => existsSync(abs));
}

/**
 * Compose a track's status card + the actions that belong under it (§3.6,
 * §3.11). Pure rendering: the caller decides whether to send it as a new
 * message or edit one in place.
 *
 * `fromPage` marks the card as having replaced a My-tracks listing, which adds
 * the back button. The photo is offered as a button rather than attached here:
 * a text message cannot be edited into a photo message, and making every card
 * a fresh photo upload would undo the in-place navigation.
 */
export async function renderTrackCard(
  ctx: KargoContext,
  track: Track,
  opts: { fromPage?: number; limited?: boolean } = {},
): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const s = ctx.s;
  const meta = STATUS_META[track.currentStatus];
  const lastAt = (await getLastEventAt(track.id)) ?? track.createdAt;

  // §3.6: show the batch line only while the batch hasn't reached Tashkent yet.
  let batchName: string | undefined;
  let batchEta: string | undefined;
  if (track.batchId) {
    const batch = await getBatchById(ctx.tenant.id, track.batchId);
    if (
      batch &&
      (batch.status === 'CHINA_WAREHOUSE' || batch.status === 'IN_TRANSIT')
    ) {
      batchName = batch.name;
      batchEta = batch.etaDate ? formatIsoDate(batch.etaDate) : undefined;
    }
  }

  // §3.6 (F1): a limited card — for anyone who is not the track's owner and
  // not staff — carries status-class data only. Weight, price and the photo
  // are commercial data between the company and THAT customer; a track code
  // is not a secret capability.
  const text = s.lookupCard({
    code: track.codeOriginal,
    statusEmoji: meta.emoji,
    statusLabel: meta[ctx.lang],
    date: formatDate(lastAt),
    batchName,
    batchEta,
    kg:
      !opts.limited && track.weightGrams != null
        ? formatKg(track.weightGrams)
        : undefined,
    som:
      !opts.limited && track.priceTiyin != null
        ? formatSom(track.priceTiyin)
        : undefined,
    // §7.13: contents belong on the owner's own card only. Marka and note are
    // panel-only and deliberately never rendered here.
    description:
      !opts.limited && track.description != null
        ? track.description
        : undefined,
  });

  const keyboard = opts.limited
    ? new InlineKeyboard()
    : trackCardKeyboard(s, track.id, opts.fromPage);
  if (!opts.limited && (await photoAbsPathsOf(ctx, track)).length > 0) {
    keyboard.row().text(s.nav.photo, `photo:${track.id}`);
  }
  // §3.13: a dispute starts from the parcel it is about — but only for the
  // parcel's OWNER (staff looking at someone else's parcel has the panel).
  if (!opts.limited && ctx.customer && track.customerId === ctx.customer.id) {
    keyboard.row().text(s.ticketIssueButton, `issue:${track.id}`);
  }

  return { text, keyboard };
}

/**
 * Send a track's status card as a NEW message, attaching the warehouse photos
 * when any exist (SPEC §3.6, §7.14). Used by the free-text lookup — where
 * there is no list message to replace — and by the explicit 📷 button.
 *
 * One photo rides as the card's own image; several go out as an album AFTER
 * the card (an album cannot carry an inline keyboard, and the card's buttons
 * matter more than a combined message).
 */
export async function sendTrackCard(
  ctx: KargoContext,
  track: Track,
): Promise<void> {
  const { text, keyboard } = await renderTrackCard(ctx, track);
  const abs = await photoAbsPathsOf(ctx, track);

  if (abs.length === 1) {
    try {
      await ctx.replyWithPhoto(new InputFile(abs[0]!), {
        caption: text,
        // No 📷 button on a message that already IS the photo.
        reply_markup: trackCardKeyboard(ctx.s, track.id),
      });
      return;
    } catch (err) {
      logger.warn({ err, trackId: track.id }, 'failed to send lookup photo');
    }
  }

  await ctx.reply(text, {
    reply_markup:
      abs.length > 1 ? trackCardKeyboard(ctx.s, track.id) : keyboard,
  });

  if (abs.length > 1) {
    try {
      await ctx.replyWithMediaGroup(
        abs.map((p) => ({ type: 'photo' as const, media: new InputFile(p) })),
      );
    } catch (err) {
      logger.warn({ err, trackId: track.id }, 'failed to send photo album');
    }
  }
}

export async function handleLookup(
  ctx: KargoContext,
  text: string,
): Promise<void> {
  const s = ctx.s;
  const normalized = normalizeCode(text);

  // Not a plausible code → short help plus the shortcuts a confused customer
  // most likely wanted (§3.11).
  if (!isValidTrackCode(normalized)) {
    await ctx.reply(s.helpFallback, { reply_markup: helpFallbackKeyboard(s) });
    return;
  }

  const track = await findTrackByCode(ctx.tenant.id, normalized);
  if (!track) {
    await ctx.reply(s.lookupNotFound(normalized));
    return;
  }

  // §3.6 (F1): the full card — weight, price, photo — only for the track's
  // owner or active staff. Everyone else (another customer, an unregistered
  // user, an unclaimed track) gets the status-only card; a registered
  // customer also learns how to claim a track that is actually theirs.
  const isOwner =
    ctx.customer != null && track.customerId === ctx.customer.id;
  const isStaff = ctx.staff?.active === true;
  if (isOwner || isStaff) {
    await sendTrackCard(ctx, track);
    return;
  }

  const { text: cardText } = await renderTrackCard(ctx, track, {
    limited: true,
  });
  const withHint =
    ctx.customer != null && track.customerId == null
      ? `${cardText}\n\n${s.lookupClaimHint}`
      : cardText;
  await ctx.reply(withHint);
}
