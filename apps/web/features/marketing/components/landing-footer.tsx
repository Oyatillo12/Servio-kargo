import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { BrandMark } from '@/components/layout/brand';

import { CONTACT_PHONE, TELEGRAM_URL } from '../config';

export async function LandingFooter({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const otherHref = locale === 'uz' ? '/ru' : '/';
  // Baked at build time — the standard "copyright year" trade-off.
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#E4E6EA] bg-[#FFFFFF]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <div>
            <p className="text-[14px] font-bold tracking-tight text-[#1A1D21]">
              SERVIO <span className="font-normal text-[#5C6270]">Kargo</span>
            </p>
            <p className="font-mono text-[11px] text-[#8A909C]">
              {t('footerRights', { year })}
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px]">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#3B45B8] hover:underline"
          >
            Telegram
          </a>
          {CONTACT_PHONE ? (
            <a
              href={`tel:${CONTACT_PHONE.replace(/[^+\d]/g, '')}`}
              className="text-[13.5px] text-[#5C6270] hover:text-[#1A1D21]"
            >
              {CONTACT_PHONE}
            </a>
          ) : null}
          <a href="/login" className="text-[#5C6270] hover:text-[#1A1D21]">
            {t('login')}
          </a>
          <Link
            href={otherHref}
            rel="alternate"
            className="text-[#8A909C] hover:text-[#1A1D21]"
          >
            {t('otherLang')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
