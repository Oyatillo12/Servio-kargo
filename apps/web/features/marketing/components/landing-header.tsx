import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { BrandMark } from '@/components/layout/brand';

import { HeaderShell } from './header-shell';

/**
 * Landing nav. Server-rendered and handed to {@link HeaderShell}, which owns
 * the only piece of behaviour here (the scroll rule).
 *
 * "Kirish" is a plain <a> because it crosses into the panel root layout, and
 * it is always shown: an admin with a session never reaches this page,
 * `middleware.ts` sends them to /dashboard.
 */
export async function LandingHeader({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  const langs = [
    { code: 'uz' as const, href: '/', label: 'UZ' },
    { code: 'ru' as const, href: '/ru', label: 'RU' },
  ];

  return (
    <HeaderShell>
      <div className="flex items-center gap-2.5">
        <BrandMark className="h-7 w-7" />
        <span className="font-display text-[16px] font-semibold uppercase tracking-[0.06em] text-ink">
          Servio <span className="font-normal text-ink-3">Kargo</span>
        </span>
      </div>

      <nav className="flex items-center gap-3 sm:gap-5">
        {/* A two-state switch, not a lone "Русский" link — which language you
            are reading is visible without clicking anything. */}
        <div className="flex items-center font-mono text-[12px] font-semibold">
          {langs.map((lang, i) => (
            <span key={lang.code} className="flex items-center">
              {i > 0 && <span className="px-1 text-rule">/</span>}
              {lang.code === locale ? (
                <span className="text-ink">{lang.label}</span>
              ) : (
                <Link
                  href={lang.href}
                  rel="alternate"
                  className="text-ink-3 transition-colors hover:text-ink"
                >
                  {lang.label}
                </Link>
              )}
            </span>
          ))}
        </div>

        <a
          href="/login"
          className="hidden text-[13.5px] font-medium text-ink-2 transition-colors hover:text-ink sm:block"
        >
          {t('login')}
        </a>
        <a
          href="#demo"
          className="inline-flex h-9 items-center rounded-[3px] bg-signal px-4 font-display text-[13px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-signal-strong"
        >
          {t('headerCta')}
        </a>
      </nav>
    </HeaderShell>
  );
}
