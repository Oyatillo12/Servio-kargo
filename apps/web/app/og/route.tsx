import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

/**
 * Shared OG card for `/` and `/ru`, referenced explicitly from
 * `features/marketing/metadata.ts` (a plain route beats the
 * `opengraph-image.tsx` file convention here: inside route groups the
 * convention emits an unstable hashed URL and did not inject the meta tags).
 * Rendered by satori at build time; the text is Latin-only and locale-neutral
 * on purpose, so one image serves both languages.
 *
 * Known quirk: prerendering this route FAILS on a Windows dev machine —
 * Next's vendored @vercel/og resolves its bundled fallback font with
 * `join(import.meta.url, ...)`, which mangles `file://` URLs on win32. The
 * production image is built inside Docker (Linux), where it works.
 */

export const dynamic = 'force-static';

const size = { width: 1200, height: 630 };

const INDIGO_NIGHT = '#16143B';
const COPPER = '#E0873A';
const INDIGO_LIGHT = '#A7A3EA';

function Dot({ filled }: { filled: boolean }) {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        background: filled ? COPPER : 'transparent',
        border: filled ? 'none' : '3px solid rgba(255,255,255,0.35)',
      }}
    />
  );
}

function Dash() {
  return (
    <div
      style={{
        width: 90,
        borderTop: '4px dotted rgba(255,255,255,0.3)',
      }}
    />
  );
}

export async function GET() {
  // process.cwd() is apps/web both at build time and under the standalone
  // server (server.js chdirs to its own directory).
  const plexMono = await readFile(
    join(process.cwd(), 'assets', 'fonts', 'ibm-plex-mono-semibold.ttf'),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: INDIGO_NIGHT,
          fontFamily: 'IBM Plex Mono',
          padding: 28,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '2px dashed rgba(255,255,255,0.18)',
            borderRadius: 24,
            padding: '56px 72px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Dot filled />
            <Dash />
            <Dot filled={false} />
            <Dash />
            <Dot filled={false} />
            <div
              style={{
                marginLeft: 28,
                color: 'rgba(255,255,255,0.55)',
                fontSize: 26,
                letterSpacing: 6,
              }}
            >
              CN → UZ
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                color: 'white',
                fontSize: 96,
                letterSpacing: -2,
                display: 'flex',
              }}
            >
              SERVIO KARGO
            </div>
            <div
              style={{
                marginTop: 18,
                color: INDIGO_LIGHT,
                fontSize: 32,
                display: 'flex',
              }}
            >
              Kargo biznesingiz uchun Telegram bot va panel
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ color: COPPER, fontSize: 26, letterSpacing: 3 }}>
              kargotrack.uz
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 24,
                letterSpacing: 3,
              }}
            >
              UZ / RU
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'IBM Plex Mono',
          data: plexMono,
          weight: 600,
          style: 'normal',
        },
      ],
    },
  );
}
