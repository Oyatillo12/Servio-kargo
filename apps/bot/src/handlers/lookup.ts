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
import { findTrackByCode, getBatchById, getLastEventAt } from '../queries';
import { logger } from '../logger';

/** Reformat a stored `YYYY-MM-DD` date to display `DD.MM.YYYY` (§4 formatting). */
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

/** Absolute path of a track's stored photo, or `undefined` if there isn't one. */
function photoPathOf(ctx: KargoContext, track: Track): string | undefined {
  if (!track.photoPath) return undefined;
  const abs = join(getConfig().uploadsDir, track.photoPath);
  return existsSync(abs) ? abs : undefined;
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
  opts: { fromPage?: number } = {},
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

  const text = s.lookupCard({
    code: track.codeOriginal,
    statusEmoji: meta.emoji,
    statusLabel: meta[ctx.lang],
    date: formatDate(lastAt),
    batchName,
    batchEta,
    kg: track.weightGrams != null ? formatKg(track.weightGrams) : undefined,
    som: track.priceTiyin != null ? formatSom(track.priceTiyin) : undefined,
  });

  const keyboard = trackCardKeyboard(s, track.id, opts.fromPage);
  if (photoPathOf(ctx, track)) {
    keyboard.row().text(s.nav.photo, `photo:${track.id}`);
  }

  return { text, keyboard };
}

/**
 * Send a track's status card as a NEW message, attaching the warehouse photo
 * when one exists (SPEC §3.6). Used by the free-text lookup — where there is no
 * list message to replace — and by the explicit 📷 button.
 */
export async function sendTrackCard(
  ctx: KargoContext,
  track: Track,
): Promise<void> {
  const { text, keyboard } = await renderTrackCard(ctx, track);
  const abs = photoPathOf(ctx, track);

  if (abs) {
    try {
      await ctx.replyWithPhoto(new InputFile(abs), {
        caption: text,
        // No 📷 button on a message that already IS the photo.
        reply_markup: trackCardKeyboard(ctx.s, track.id),
      });
      return;
    } catch (err) {
      logger.warn({ err, trackId: track.id }, 'failed to send lookup photo');
    }
  }

  await ctx.reply(text, { reply_markup: keyboard });
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

  await sendTrackCard(ctx, track);
}
