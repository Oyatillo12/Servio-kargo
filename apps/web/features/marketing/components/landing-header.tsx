import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { BrandMark } from '@/components/layout/brand';

/**
 * Sticky landing header. Deliberately zero client JS: two links and an anchor
 * button need no hamburger. `/login` is a plain <a> — it crosses into the
 * panel root layout, so it is a full navigation anyway.
 */
export async function LandingHeader({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const otherHref = locale === 'uz' ? '/ru' : '/';

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#16143B]/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="text-[15px] font-bold tracking-tight text-white">
            SERVIO <span className="font-normal text-white/70">Kargo</span>
          </span>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href={otherHref}
            rel="alternate"
            className="rounded-lg px-2.5 py-2 font-mono text-[12px] text-white/70 transition-colors hover:text-white"
          >
            {t('otherLang')}
          </Link>
          <a
            href="/login"
            className="rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/85 transition-colors hover:text-white"
          >
            {t('login')}
          </a>
          <a
            href="#demo"
            className="ml-1 rounded-lg bg-[#E0873A] px-3.5 py-2 text-[13px] font-semibold text-[#16143B] transition-colors hover:bg-[#eda45f]"
          >
            {t('headerCta')}
          </a>
        </nav>
      </div>
    </header>
  );
}
