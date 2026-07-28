import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { BrandMark } from '@/components/layout/brand';

import { HeaderShell } from './header-shell';

/**
 * Landing nav. Server-rendered and handed to {@link HeaderShell}, which owns
 * the only piece of behaviour here (detaching on scroll).
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
        <span className="text-[15px] font-bold tracking-tight text-[#1A1D21]">
          SERVIO <span className="font-normal text-[#8A909C]">Kargo</span>
        </span>
      </div>

      <nav className="flex items-center gap-3 sm:gap-4">
        {/* A two-state switch, not a lone "Русский" link — which language you
            are reading is visible without clicking anything. */}
        <div className="flex items-center text-[12px] font-semibold">
          {langs.map((lang, i) => (
            <span key={lang.code} className="flex items-center">
              {i > 0 && <span className="px-1 text-[#C7CBD1]">/</span>}
              {lang.code === locale ? (
                <span className="text-[#1A1D21]">{lang.label}</span>
              ) : (
                <Link
                  href={lang.href}
                  rel="alternate"
                  className="text-[#8A909C] transition-colors hover:text-[#1A1D21]"
                >
                  {lang.label}
                </Link>
              )}
            </span>
          ))}
        </div>

        <a
          href="/login"
          className="hidden text-[13.5px] font-medium text-[#5C6270] transition-colors hover:text-[#1A1D21] sm:block"
        >
          {t('login')}
        </a>
        <a
          href="#demo"
          className="inline-flex h-10 items-center rounded-full bg-[#3B45B8] px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#2C3494]"
        >
          {t('headerCta')}
        </a>
      </nav>
    </HeaderShell>
  );
}
