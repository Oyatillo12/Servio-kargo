import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { getSessionAdmin } from '@/lib/auth';
import { getTrackPhotoPath } from '@/lib/queries';

// Warehouse photo storage root (SPEC §3.9 / §7.9 local disk in MVP).
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/data/uploads';

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
