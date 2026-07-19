/**
 * Free-text status lookup (SPEC §3.6). Any plain message whose normalized form
 * is a valid 8–20 char code is treated as a status query — even without pressing
 * a button. Non-codes fall back to the help text.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { InputFile } from 'grammy';

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
import { findTrackByCode, getBatchById, getLastEventAt } from '../queries';
import { logger } from '../logger';

/** Reformat a stored `YYYY-MM-DD` date to display `DD.MM.YYYY` (§4 formatting). */
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

/**
 * Render + send a track's status card (SPEC §3.6), attaching the warehouse
 * photo when one exists. Shared by the free-text lookup and the "Mening
 * yuklarim" per-track buttons so both stay identical.
 */
export async function sendTrackCard(
  ctx: KargoContext,
  track: Track,
): Promise<void> {
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

  const card = s.lookupCard({
    code: track.codeOriginal,
    statusEmoji: meta.emoji,
    statusLabel: meta[ctx.lang],
    date: formatDate(lastAt),
    batchName,
    batchEta,
    kg: track.weightGrams != null ? formatKg(track.weightGrams) : undefined,
    som: track.priceTiyin != null ? formatSom(track.priceTiyin) : undefined,
  });

  // Attach the warehouse photo when the file exists (SPEC §3.6).
  if (track.photoPath) {
    const abs = join(getConfig().uploadsDir, track.photoPath);
    if (existsSync(abs)) {
      try {
        await ctx.replyWithPhoto(new InputFile(abs), { caption: card });
        return;
      } catch (err) {
        logger.warn({ err, trackId: track.id }, 'failed to send lookup photo');
      }
    }
  }

  await ctx.reply(card);
}

export async function handleLookup(
  ctx: KargoContext,
  text: string,
): Promise<void> {
  const s = ctx.s;
  const normalized = normalizeCode(text);

  // Not a plausible code → short help pointing to the menu.
  if (!isValidTrackCode(normalized)) {
    await ctx.reply(s.helpFallback);
    return;
  }

  const track = await findTrackByCode(ctx.tenant.id, normalized);
  if (!track) {
    await ctx.reply(s.lookupNotFound(normalized));
    return;
  }

  await sendTrackCard(ctx, track);
}
