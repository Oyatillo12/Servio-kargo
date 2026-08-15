import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { can } from '@kargotrack/shared';

import { getSessionAdmin } from '@/lib/auth';
import { captureError } from '@/lib/observability';
import { addTrackPhoto } from '@/lib/queries';

// Warehouse photo storage root (SPEC §7.9 local disk in MVP).
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/data/uploads';

/** SPEC §8: warehouse photos are JPEG, max 10 MB — the same rule as the bot. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg'];

/** SPEC §7.14 photo kinds; anything else in the form falls back to intake. */
const KINDS = ['intake', 'damage', 'handover'] as const;
type PhotoKind = (typeof KINDS)[number];

/**
 * Add a warehouse photo to a parcel (SPEC §7.14) — from the /weigh console
 * (W4) or the track page. Each upload is a NEW photo at
 * `{tenantId}/{trackId}/{photoId}.jpg`; nothing is overwritten.
 *
 * A route handler rather than a Server Action on purpose: Server Actions cap
 * their request body at 1 MB by default, and a phone camera clears that on the
 * first shot.
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
  let kindRaw: unknown;
  try {
    const form = await req.formData();
    file = form.get('photo');
    kindRaw = form.get('kind');
  } catch {
    return jsonError('BAD_REQUEST', 400);
  }
  if (!(file instanceof File)) return jsonError('BAD_REQUEST', 400);

  const kind: PhotoKind = KINDS.includes(kindRaw as PhotoKind)
    ? (kindRaw as PhotoKind)
    : 'intake';

  // Cheap pre-check on the reported size before pulling the bytes into memory.
  if (file.size > MAX_PHOTO_BYTES) return jsonError('TOO_LARGE', 413);
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return jsonError('BAD_TYPE', 415);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_PHOTO_BYTES) return jsonError('TOO_LARGE', 413);

  // The path is built from ids we control — the session's tenant, a track id
  // the write below re-checks against it, and a fresh uuid — never from
  // anything in the upload.
  const photoId = randomUUID();
  const photoPath = `${ctx.tenant.id}/${params.id}/${photoId}.jpg`;
  const root = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(root, photoPath);
  if (!resolved.startsWith(root + path.sep)) return jsonError('BAD_REQUEST', 400);

  // The DB write doubles as the authorization check — it only matches a
  // non-deleted track of THIS tenant — so it runs before anything touches disk.
  const linked = await addTrackPhoto({
    tenantId: ctx.tenant.id,
    trackId: params.id,
    photoId,
    kind,
    path: photoPath,
    createdBy: ctx.admin.id,
  });
  if (!linked) return jsonError('NOT_FOUND', 404);

  try {
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, bytes);
  } catch (err) {
    // The row now points at a file that isn't there, which reads as one broken
    // frame in the gallery until it is deleted — the delete button is the
    // repair path, and a re-shot photo is a fresh row either way.
    captureError(err, { route: 'tracks.photo.POST', trackId: params.id });
    return jsonError('WRITE_FAILED', 500);
  }

  return Response.json({ ok: true, photoId });
}

/** Error codes, not sentences: the client owns the translation (rule 5). */
function jsonError(code: string, status: number) {
  return Response.json({ error: code }, { status });
}
