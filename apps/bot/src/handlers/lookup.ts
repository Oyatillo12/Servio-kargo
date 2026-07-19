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

import { getConfig } from '../config';
import type { KargoContext } from '../context';
import { findTrackByCode, getLastEventAt } from '../queries';
import { logger } from '../logger';

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

  const meta = STATUS_META[track.currentStatus];
  const lastAt = (await getLastEventAt(track.id)) ?? track.createdAt;
  const card = s.lookupCard({
    code: track.codeOriginal,
    statusEmoji: meta.emoji,
    statusLabel: meta[ctx.lang],
    date: formatDate(lastAt),
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
