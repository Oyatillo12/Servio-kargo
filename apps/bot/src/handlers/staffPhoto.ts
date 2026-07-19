/**
 * Staff photo mode (SPEC §3.8). A Telegram user in `tenant.settings.staff_tg_ids`
 * sends a photo whose caption is a track code → we download it, save it under
 * `{uploadsDir}/{tenantId}/{trackId}.jpg`, link it to the track, and confirm.
 * The customer's next status notification for that track then carries the photo
 * (see `worker.ts`). Non-staff photos aren't part of any customer flow → ignored.
 *
 * The `@grammyjs/files` plugin isn't installed, so we download via the Bot File
 * API URL directly. Every fallible step is wrapped so one bad photo can't crash
 * the bot (CLAUDE.md rule 8, SPEC §8).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { isValidTrackCode, normalizeCode } from '@kargotrack/shared';

import { getConfig } from '../config';
import type { KargoContext } from '../context';
import { logger } from '../logger';
import { findTrackByCode, setTrackPhoto } from '../queries';

/** SPEC §8: photos are JPEG, max 10 MB. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_MB = 10;

export async function staffPhotoHandler(ctx: KargoContext): Promise<void> {
  const fromId = ctx.from?.id;
  const staffIds = ctx.tenant.settings?.staff_tg_ids ?? [];
  // Only staff get the photo flow; a customer photo has no customer-flow meaning.
  if (fromId == null || !staffIds.includes(fromId)) return;

  const s = ctx.s;
  const tenantId = ctx.tenant.id;

  const caption = ctx.message?.caption?.trim() ?? '';
  if (!caption) {
    await ctx.reply(s.staffPhotoNoCaption);
    return;
  }

  const normalized = normalizeCode(caption);
  const track = isValidTrackCode(normalized)
    ? await findTrackByCode(tenantId, normalized)
    : undefined;
  if (!track) {
    // Error listing the normalized code we tried (SPEC §3.8).
    await ctx.reply(s.staffPhotoNotFound(normalized));
    return;
  }

  // Cheap pre-check against the compressed-photo size Telegram already reported.
  const photos = ctx.message?.photo ?? [];
  const largest = photos[photos.length - 1];
  if (largest?.file_size != null && largest.file_size > MAX_PHOTO_BYTES) {
    await ctx.reply(s.staffPhotoTooLarge(MAX_PHOTO_MB));
    return;
  }

  try {
    // `ctx.getFile()` resolves the largest photo size and its `file_path`.
    const file = await ctx.getFile();
    if (file.file_size != null && file.file_size > MAX_PHOTO_BYTES) {
      await ctx.reply(s.staffPhotoTooLarge(MAX_PHOTO_MB));
      return;
    }
    if (!file.file_path) {
      logger.warn({ trackId: track.id }, 'staff photo: no file_path from getFile');
      await ctx.reply(s.staffPhotoError);
      return;
    }

    const url = `https://api.telegram.org/file/bot${ctx.tenant.botToken}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(
        { trackId: track.id, status: res.status },
        'staff photo: file download failed',
      );
      await ctx.reply(s.staffPhotoError);
      return;
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > MAX_PHOTO_BYTES) {
      await ctx.reply(s.staffPhotoTooLarge(MAX_PHOTO_MB));
      return;
    }

    const photoPath = `${tenantId}/${track.id}.jpg`;
    const abs = join(getConfig().uploadsDir, photoPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, bytes);

    await setTrackPhoto(tenantId, track.id, photoPath);
    await ctx.reply(s.staffPhotoLinked(track.codeOriginal));
  } catch (err) {
    logger.error({ err, trackId: track.id }, 'staff photo: failed to save');
    await ctx.reply(s.staffPhotoError);
  }
}
