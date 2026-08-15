/**
 * Staff photo + weighing entry point for photos (SPEC §3.8). An employee whose
 * `admin_users` row carries this Telegram id (see `isStaff`) sends a photo whose
 * caption is either:
 *  - a weighing command `CODE 3.2` → weigh the track (set weight/price, advance
 *    CREATED→CHINA_WAREHOUSE) AND link the photo (delegated to `handleStaffWeighing`);
 *  - a bare track code → download the photo to `{uploadsDir}/{tenantId}/{trackId}.jpg`,
 *    link it, and confirm.
 * The customer's next status notification for that track then carries the photo
 * (see `worker.ts`). Non-staff photos aren't part of any customer flow → ignored.
 *
 * The `@grammyjs/files` plugin isn't installed, so we download via the Bot File
 * API URL directly. Every fallible step is wrapped so one bad photo can't crash
 * the bot (CLAUDE.md rule 8, SPEC §8).
 */

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Track } from '@kargotrack/db/schema';
import { isValidTrackCode, normalizeCode, parseStaffWeighing } from '@kargotrack/shared';

import { getConfig } from '../config';
import type { KargoContext } from '../context';
import { logger } from '../logger';
import { addTrackPhoto, findTrackByCode } from '../queries';
import { handleStaffWeighing, isStaff } from './staffWeigh';

/** SPEC §8: photos are JPEG, max 10 MB. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_MB = 10;

export async function staffPhotoHandler(ctx: KargoContext): Promise<void> {
  // Only staff get the photo flow; a customer photo has no customer-flow meaning.
  if (!isStaff(ctx)) return;

  const s = ctx.s;
  const tenantId = ctx.tenant.id;

  const caption = ctx.message?.caption?.trim() ?? '';
  if (!caption) {
    await ctx.reply(s.staffPhotoNoCaption);
    return;
  }

  // Caption `CODE 3.2` → weigh the track and link this photo to it (§3.8).
  const weighing = parseStaffWeighing(caption);
  if (weighing) {
    await handleStaffWeighing(ctx, weighing, {
      linkPhoto: async (track) => {
        await downloadStaffPhoto(ctx, tenantId, track);
      },
    });
    return;
  }

  // Caption = bare track code → pure photo link.
  const normalized = normalizeCode(caption);
  const track = isValidTrackCode(normalized)
    ? await findTrackByCode(tenantId, normalized)
    : undefined;
  if (!track) {
    await ctx.reply(s.staffNotFound(normalized));
    return;
  }

  const linked = await downloadStaffPhoto(ctx, tenantId, track);
  if (linked) await ctx.reply(s.staffPhotoOk(track.codeOriginal));
}

/**
 * Download the message's photo and link it to `track`. Replies the appropriate
 * error string on failure and returns whether the link succeeded (the caller
 * sends the success message, since it differs between the photo and weighing
 * flows). Never throws — one bad photo must not crash the bot (§8).
 */
export async function downloadStaffPhoto(
  ctx: KargoContext,
  tenantId: string,
  track: Track,
): Promise<boolean> {
  const s = ctx.s;

  // Cheap pre-check against the compressed-photo size Telegram already reported.
  const photos = ctx.message?.photo ?? [];
  const largest = photos[photos.length - 1];
  if (largest?.file_size != null && largest.file_size > MAX_PHOTO_BYTES) {
    await ctx.reply(s.staffPhotoTooLarge(MAX_PHOTO_MB));
    return false;
  }

  try {
    // `ctx.getFile()` resolves the largest photo size and its `file_path`.
    const file = await ctx.getFile();
    if (file.file_size != null && file.file_size > MAX_PHOTO_BYTES) {
      await ctx.reply(s.staffPhotoTooLarge(MAX_PHOTO_MB));
      return false;
    }
    if (!file.file_path) {
      logger.warn({ trackId: track.id }, 'staff photo: no file_path from getFile');
      await ctx.reply(s.staffPhotoError);
      return false;
    }

    const url = `https://api.telegram.org/file/bot${ctx.tenant.botToken}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(
        { trackId: track.id, status: res.status },
        'staff photo: file download failed',
      );
      await ctx.reply(s.staffPhotoError);
      return false;
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > MAX_PHOTO_BYTES) {
      await ctx.reply(s.staffPhotoTooLarge(MAX_PHOTO_MB));
      return false;
    }

    // §7.14: every shot is a NEW photo — nothing overwritten.
    const photoId = randomUUID();
    const photoPath = `${tenantId}/${track.id}/${photoId}.jpg`;
    const abs = join(getConfig().uploadsDir, photoPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, bytes);

    await addTrackPhoto({
      tenantId,
      trackId: track.id,
      photoId,
      path: photoPath,
      createdBy: ctx.staff?.id ?? null,
    });
    return true;
  } catch (err) {
    logger.error({ err, trackId: track.id }, 'staff photo: failed to save');
    await ctx.reply(s.staffPhotoError);
    return false;
  }
}
