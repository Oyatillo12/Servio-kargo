import { ArrowUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { TELEGRAM_URL } from '../config';
import { Screenshot } from './screenshot';

/**
 * Opening screen: a claim, a sentence, two actions, and the panel itself.
 *
 * The visual is the real dashboard rather than a drawn mockup — a prospect who
 * runs a cargo company reads that screen faster than any paragraph, and it is
 * the one thing on the page that cannot be written by someone who has not
 * built the product.
 */
export async function Hero({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
        <div className="max-w-3xl">
          <h1 className="animate-fade-in-up text-[38px] font-extrabold leading-[1.03] tracking-[-0.035em] text-[#1A1D21] sm:text-[58px]">
            {t.rich('heroTitle', {
              mark: (chunks) => <span className="headline-mark">{chunks}</span>,
            })}
          </h1>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-[#5C6270]">
            {t('heroSubtitle')}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
            <a
              href="#demo"
              className="inline-flex h-12 items-center rounded-lg bg-[#3B45B8] px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[#2C3494]"
            >
              {t('heroCtaPrimary')}
            </a>
            {/* A text link, not a second outlined button — a matched pair of
                buttons is the shape every generated hero lands on. */}
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 border-b border-[#1A1D21]/20 pb-0.5 text-[15px] font-semibold text-[#1A1D21] transition-colors hover:border-[#1A1D21]"
            >
              {t('heroCtaSecondary')}
              <ArrowUpRight
                className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </a>
          </div>
        </div>

        <Screenshot
          shot="dashboard"
          locale={locale}
          alt={t('shotDashboardAlt')}
          priority
          className="mt-12 sm:mt-16"
        />
      </div>
    </section>
  );
}
