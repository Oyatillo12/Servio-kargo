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
    <footer className="border-t border-[#e3e3ea] bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-7 w-7" />
              <span className="text-[15px] font-bold tracking-tight text-[#16143B]">
                SERVIO <span className="font-normal text-[#55555F]">Kargo</span>
              </span>
            </div>
            <p className="mt-3 text-[13px] text-[#55555F]">
              {t('footerTagline')}
            </p>
            <p className="mt-1 text-[12px] text-[#8A8A96]">
              {t('footerMadeFor')}
            </p>
          </div>

          <nav className="flex flex-col items-start gap-2.5 text-[13.5px] sm:items-end">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#2B2687] hover:underline"
            >
              Telegram
            </a>
            {CONTACT_PHONE ? (
              <a
                href={`tel:${CONTACT_PHONE.replace(/[^+\d]/g, '')}`}
                className="font-mono text-[13px] text-[#55555F] hover:text-[#16143B]"
              >
                {CONTACT_PHONE}
              </a>
            ) : null}
            <a href="/login" className="text-[#55555F] hover:text-[#16143B]">
              {t('login')}
            </a>
            <Link
              href={otherHref}
              rel="alternate"
              className="font-mono text-[12px] text-[#8A8A96] hover:text-[#16143B]"
            >
              {t('otherLang')}
            </Link>
          </nav>
        </div>

        <p className="mt-8 border-t border-dashed border-[#d5d5dc] pt-5 font-mono text-[11px] text-[#8A8A96]">
          {t('footerRights', { year })}
        </p>
      </div>
    </footer>
  );
}
