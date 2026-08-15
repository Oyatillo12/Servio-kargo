/**
 * ONE warehouse photo for the Mini App (tasks.md B3, SPEC §7.14). Same serving
 * rules as the panel's photo route, but gated by the TWA customer session —
 * and by OWNERSHIP: a customer only ever sees photos of their own parcels.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { cookies } from 'next/headers';

import { getTwaTrackPhotoPath } from '@/lib/twa/queries';
import { TWA_COOKIE_NAME, verifyTwaSessionToken } from '@/lib/twa/session';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/data/uploads';

export async function GET(
  _req: Request,
  { params }: { params: { trackId: string; photoId: string } },
) {
  const claims = verifyTwaSessionToken(cookies().get(TWA_COOKIE_NAME)?.value);
  if (!claims) return new Response('Unauthorized', { status: 401 });

  const photoPath = await getTwaTrackPhotoPath(
    claims.tenantId,
    claims.customerId,
    params.trackId,
    params.photoId,
  );
  if (!photoPath) return new Response('Not found', { status: 404 });

  const root = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(root, photoPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const data = await readFile(resolved);
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        // A photo row is immutable (§7.14), so the browser may keep it.
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
