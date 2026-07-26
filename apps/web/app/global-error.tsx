'use client';

import { useEffect } from 'react';

import { reportClientErrorAction } from '@/lib/report-error';

/**
 * Root error boundary — catches failures in the root layout itself, where
 * `app/error.tsx` cannot help (AUDIT.md T5). It must render its own
 * `<html>`/`<body>`, so it deliberately uses inline styles rather than the app's
 * Tailwind layer: the stylesheet may be exactly what failed to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientErrorAction({
      message: error.message,
      digest: error.digest,
      pathname: 'global',
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f7f8fa',
          color: '#0f172a',
        }}
      >
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 4px' }}>
            Xatolik yuz berdi
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Sahifani qayta yuklang. Takrorlansa, biz bilan bog&apos;laning.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#1f3a8a',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Qayta urinish
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: 12,
                fontSize: 11,
                color: '#94a3b8',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              Kod: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
