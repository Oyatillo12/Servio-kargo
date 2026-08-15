import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { can } from '@kargotrack/shared';

import { getSessionAdmin } from '@/lib/auth';
import { captureError } from '@/lib/observability';
import { clearTrackPhoto, getTrackPhotoPath, setTrackPhoto } from '@/lib/queries';

// Warehouse photo storage root (SPEC §3.9 / §7.9 local disk in MVP).
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/data/uploads';

/** SPEC §8: warehouse photos are JPEG, max 10 MB — the same rule as the bot. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg'];

/**
 * Serve a track's warehouse photo, session-guarded and tenant-scoped: the photo
 * path is resolved from the DB by the logged-in admin's tenant (never trusted
 * from the URL), and the resolved file must stay inside UPLOADS_DIR.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getSessionAdmin();
  if (!ctx) return new Response('Unauthorized', { status: 401 });

  const photoPath = await getTrackPhotoPath(ctx.tenant.id, params.id);
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
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

/**
 * Attach a warehouse photo taken on the /weigh console (tasks.md W4).
 *
 * A route handler rather than a Server Action on purpose: Server Actions cap
 * their request body at 1 MB by default, and a phone camera clears that on the
 * first shot. Same storage rule as the bot's staff-photo flow (§3.8) —
 * `{uploadsDir}/{tenantId}/{trackId}.jpg`, JPEG, 10 MB — so a parcel has one
 * photo whichever surface took it, and re-shooting simply overwrites.
 *
 * Guarded by `tracks.weigh`: photographing a parcel is the warehouse job, and
 * this is a POST endpoint any signed-in user could otherwise call.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getSessionAdmin();
  if (!ctx) return new Response('Unauthorized', { status: 401 });
  if (!can(ctx.role, 'tracks.weigh')) {
    return new Response('Forbidden', { status: 403 });
  }

  let file: unknown;
  try {
    file = (await req.formData()).get('photo');
  } catch {
    return jsonError('BAD_REQUEST', 400);
  }
  if (!(file instanceof File)) return jsonError('BAD_REQUEST', 400);

  // Cheap pre-check on the reported size before pulling the bytes into memory.
  if (file.size > MAX_PHOTO_BYTES) return jsonError('TOO_LARGE', 413);
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return jsonError('BAD_TYPE', 415);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_PHOTO_BYTES) return jsonError('TOO_LARGE', 413);

  // The path is built from ids we control — the session's tenant and a track id
  // the write below re-checks against it — never from anything in the upload.
  const photoPath = `${ctx.tenant.id}/${params.id}.jpg`;
  const root = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(root, photoPath);
  if (!resolved.startsWith(root + path.sep)) return jsonError('BAD_REQUEST', 400);

  // The DB write doubles as the authorization check — it only matches a
  // non-deleted track of THIS tenant — so it runs before anything touches disk.
  const linked = await setTrackPhoto({
    tenantId: ctx.tenant.id,
    trackId: params.id,
    photoPath,
  });
  if (!linked) return jsonError('NOT_FOUND', 404);

  try {
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, bytes);
  } catch (err) {
    // The row now points at a file that isn't there, which reads as a broken
    // frame until the next shot. Left that way deliberately: the path is
    // derived from the track id, so re-taking the photo overwrites both sides,
    // and clearing the column here would drop a PREVIOUS photo that is still
    // on disk and still correct.
    captureError(err, { route: 'tracks.photo.POST', trackId: params.id });
    return jsonError('WRITE_FAILED', 500);
  }

  return Response.json({ ok: true });
}

/**
 * Remove a track's warehouse photo (tasks.md A5 — the office-side fix-up).
 *
 * Same `tracks.weigh` gate as the upload: whoever may put a photo on a parcel
 * may take a wrong one off. The DB link is cleared FIRST, then the file is
 * unlinked best-effort — an orphaned file is harmless (the path is derived from
 * the track id, so the next shot overwrites it), while a dangling DB pointer
 * would render as a broken frame. Idempotent: no linked photo is still `ok`.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getSessionAdmin();
  if (!ctx) return new Response('Unauthorized', { status: 401 });
  if (!can(ctx.role, 'tracks.weigh')) {
    return new Response('Forbidden', { status: 403 });
  }

  const photoPath = await clearTrackPhoto({
    tenantId: ctx.tenant.id,
    trackId: params.id,
  });
  if (!photoPath) return Response.json({ ok: true });

  const root = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(root, photoPath);
  // Path-traversal guard, same as GET: only ever delete under the uploads root.
  if (resolved !== root && resolved.startsWith(root + path.sep)) {
    try {
      await unlink(resolved);
    } catch (err) {
      // The link is already gone, which is what the admin asked for; a
      // leftover file just waits for the next shot at the same path. A file
      // that was never written (ENOENT) isn't worth an alert.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        captureError(err, { route: 'tracks.photo.DELETE', trackId: params.id });
      }
    }
  }

  return Response.json({ ok: true });
}

/** Error codes, not sentences: the client owns the translation (rule 5). */
function jsonError(code: string, status: number) {
  return Response.json({ error: code }, { status });
}
