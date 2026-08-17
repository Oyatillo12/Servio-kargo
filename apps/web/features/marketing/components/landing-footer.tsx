import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { BrandMark, RouteDots } from '@/components/layout/brand';

import { CONTACT_PHONE, TELEGRAM_URL } from '../config';

export async function LandingFooter({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const otherHref = locale === 'uz' ? '/ru' : '/';
  // Baked at build time — the standard "copyright year" trade-off.
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-rule bg-paper">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark className="h-7 w-7" />
          <div>
            <p className="font-display text-[14px] font-semibold uppercase tracking-[0.06em] text-ink">
              Servio <span className="font-normal text-ink-3">Kargo</span>
            </p>
            <p className="font-mono text-[11px] text-ink-3">
              {t('footerRights', { year })}
            </p>
          </div>
          <RouteDots className="ml-3 hidden sm:flex" />
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px]">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-signal hover:text-signal-strong"
          >
            Telegram
          </a>
          {CONTACT_PHONE ? (
            <a
              href={`tel:${CONTACT_PHONE.replace(/[^+\d]/g, '')}`}
              className="font-mono text-[13px] text-ink-2 hover:text-ink"
            >
              {CONTACT_PHONE}
            </a>
          ) : null}
          <a href="/login" className="text-ink-2 hover:text-ink">
            {t('login')}
          </a>
          <Link href={otherHref} rel="alternate" className="text-ink-3 hover:text-ink">
            {t('otherLang')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
