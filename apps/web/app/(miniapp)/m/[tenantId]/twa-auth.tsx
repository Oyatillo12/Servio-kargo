'use client';

/**
 * Client half of the Mini App sign-in (tasks.md B1/B2): grab initData from
 * the Telegram bridge, exchange it for the TWA cookie, refresh. Registration
 * is NOT done here — an unknown Telegram user is sent to the bot, which owns
 * the one registration flow (SPEC §3.1).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { telegramWebApp } from '@/lib/twa/client';

type Phase =
  | { name: 'authenticating' }
  | { name: 'outside_telegram' }
  | { name: 'unregistered'; botUsername: string | null }
  | { name: 'failed' };

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
    webApp?.ready();
    webApp?.expand();

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
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">
        {t('loading')}
      </p>
    );
  }

  if (phase.name === 'outside_telegram') {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">
        {t('outsideTelegram')}
      </p>
    );
  }

  if (phase.name === 'unregistered') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-base font-bold text-foreground">
          {t('notRegisteredTitle')}
        </p>
        <p className="text-sm text-muted-foreground">{t('notRegisteredBody')}</p>
        {phase.botUsername ? (
          <button
            type="button"
            onClick={() =>
              telegramWebApp()?.openTelegramLink(
                `https://t.me/${phase.botUsername}`,
              )
            }
            className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            {t('openBot')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <p className="py-24 text-center text-sm text-muted-foreground">
      {t('authFailed')}
    </p>
  );
}
