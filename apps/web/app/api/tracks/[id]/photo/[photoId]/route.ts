import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

import { can } from '@kargotrack/shared';

import { getSessionAdmin } from '@/lib/auth';
import { captureError } from '@/lib/observability';
import { deleteTrackPhoto, getTrackPhotoPath } from '@/lib/queries';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/data/uploads';

/**
 * Serve ONE of a track's photos (SPEC §7.14), session-guarded and
 * tenant-scoped: the file path is resolved from the DB by the logged-in
 * admin's tenant (never trusted from the URL), and the resolved file must
 * stay inside UPLOADS_DIR.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string; photoId: string } },
) {
  const ctx = await getSessionAdmin();
  if (!ctx) return new Response('Unauthorized', { status: 401 });

  const photoPath = await getTrackPhotoPath(
    ctx.tenant.id,
    params.id,
    params.photoId,
  );
  if (!photoPath) return new Response('Not found', { status: 404 });

  const root = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(root, photoPath);
  // Path-traversal guard: resolved file must live under the uploads root.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const data = await readFile(resolved);
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        // A photo row is immutable (uploads add rows, never replace files),
        // so the browser may keep it a while.
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

/**
 * Remove ONE of a track's photos (SPEC §7.14; tasks.md A5's per-photo
 * successor). Same `tracks.weigh` gate as the upload: whoever may put a photo
 * on a parcel may take a wrong one off. The DB row goes FIRST, then the file
 * is unlinked best-effort — an orphaned file is harmless, while a dangling DB
 * pointer would render as a broken frame. Idempotent: an unknown photo id is
 * still `ok`.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; photoId: string } },
) {
  const ctx = await getSessionAdmin();
  if (!ctx) return new Response('Unauthorized', { status: 401 });
  if (!can(ctx.role, 'tracks.weigh')) {
    return new Response('Forbidden', { status: 403 });
  }

  const photoPath = await deleteTrackPhoto({
    tenantId: ctx.tenant.id,
    trackId: params.id,
    photoId: params.photoId,
  });
  if (!photoPath) return Response.json({ ok: true });

  const root = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(root, photoPath);
  // Path-traversal guard, same as GET: only ever delete under the uploads root.
  if (resolved !== root && resolved.startsWith(root + path.sep)) {
    try {
      await unlink(resolved);
    } catch (err) {
      // The row is already gone, which is what the admin asked for. A file
      // that was never written (ENOENT) isn't worth an alert.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        captureError(err, {
          route: 'tracks.photo.DELETE',
          trackId: params.id,
        });
      }
    }
  }

  return Response.json({ ok: true });
}
