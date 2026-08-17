'use client';

/**
 * Client half of the Mini App sign-in (SPEC §10.1): grab initData from the
 * Telegram bridge, exchange it for the TWA cookie, refresh. Registration is
 * NOT done here — an unknown Telegram user is sent to the bot, which owns
 * the one registration flow (SPEC §3.1).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';

import { telegramWebApp } from '@/lib/twa/client';

type Phase =
  | { name: 'authenticating' }
  | { name: 'outside_telegram' }
  | { name: 'unregistered'; botUsername: string | null }
  | { name: 'failed' };

function CenterNote({
  title,
  body,
  children,
}: {
  title?: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="twa-rise flex min-h-[70vh] flex-col items-center justify-center gap-3 px-2 text-center">
      {title ? <p className="text-lead font-extrabold">{title}</p> : null}
      <p className="twa-hint text-sm leading-relaxed">{body}</p>
      {children}
    </div>
  );
}

export function TwaAuth({ tenantId }: { tenantId: string }) {
  const t = useTranslations('twa');
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: 'authenticating' });

  useEffect(() => {
    const webApp = telegramWebApp();
    const initData = webApp?.initData;
    if (!initData) {
      setPhase({ name: 'outside_telegram' });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/twa/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, initData }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          registered?: boolean;
          botUsername?: string | null;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setPhase({ name: 'failed' });
        } else if (!data.registered) {
          setPhase({
            name: 'unregistered',
            botUsername: data.botUsername ?? null,
          });
        } else {
          router.refresh();
        }
      } catch {
        if (!cancelled) setPhase({ name: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, router]);

  if (phase.name === 'authenticating') {
    // Skeleton of the home screen — sign-in usually resolves in <1s, so the
    // shape the user lands on is already on screen.
    return (
      <div className="space-y-3" aria-busy="true">
        <div
          className="h-20 animate-pulse rounded-2xl"
          style={{ background: 'var(--twa-border)' }}
        />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-2xl"
            style={{ background: 'var(--twa-border)' }}
          />
        ))}
      </div>
    );
  }

  if (phase.name === 'outside_telegram') {
    return <CenterNote body={t('outsideTelegram')} />;
  }

  if (phase.name === 'unregistered') {
    return (
      <CenterNote title={t('notRegisteredTitle')} body={t('notRegisteredBody')}>
        {phase.botUsername ? (
          <button
            type="button"
            onClick={() =>
              telegramWebApp()?.openTelegramLink(
                `https://t.me/${phase.botUsername}`,
              )
            }
            className="twa-btn twa-press mt-2 w-auto px-6"
          >
            <Send className="h-4 w-4" aria-hidden />
            {t('openBot')}
          </button>
        ) : null}
      </CenterNote>
    );
  }

  return <CenterNote body={t('authFailed')} />;
}
