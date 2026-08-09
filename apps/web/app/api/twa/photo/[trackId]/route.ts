/**
 * Warehouse photo for the Mini App (tasks.md B3). Same serving rules as the
 * panel's photo route, but gated by the TWA customer session — and by
 * OWNERSHIP: a customer only ever sees photos of their own parcels.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { cookies } from 'next/headers';

import { getTwaTrackPhotoPath } from '@/lib/twa/queries';
import { TWA_COOKIE_NAME, verifyTwaSessionToken } from '@/lib/twa/session';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/data/uploads';

export async function GET(
  _req: Request,
  { params }: { params: { trackId: string } },
) {
  const claims = verifyTwaSessionToken(cookies().get(TWA_COOKIE_NAME)?.value);
  if (!claims) return new Response('Unauthorized', { status: 401 });

  const photoPath = await getTwaTrackPhotoPath(
    claims.tenantId,
    claims.customerId,
    params.trackId,
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
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
