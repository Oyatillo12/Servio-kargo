import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { formatSom, type Lang } from '@kargotrack/shared';

import { PRICE_MONTHLY_SOM } from '../config';
import { SectionHeading } from './section-heading';

const INCLUDED = ['priceIncl1', 'priceIncl2', 'priceIncl3', 'priceIncl4'] as const;

/**
 * One plan, one number.
 *
 * The figure comes from `PRICE_MONTHLY_SOM` in `../config`; while that is null
 * the section says the price is set per company and points at the demo, which
 * is at least a concrete next step rather than a number the page cannot back.
 */
export async function Pricing({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-[#E4E6EA] bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-6">
        <SectionHeading title={t('priceTitle')} />

        <div className="mt-8 grid gap-8 rounded-lg border border-[#E4E6EA] bg-white p-6 sm:p-8 md:grid-cols-2 md:gap-12">
          <div>
            {PRICE_MONTHLY_SOM === null ? (
              <p className="text-[19px] font-bold leading-snug text-[#1A1D21] sm:text-[22px]">
                {t('priceTbd')}
              </p>
            ) : (
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[34px] font-semibold tracking-tight text-[#1A1D21] sm:text-[40px]">
                  {/* formatSom takes tiyin — CLAUDE.md rule 6. */}
                  {formatSom(PRICE_MONTHLY_SOM * 100)}
                </span>
                <span className="text-[15px] font-medium text-[#5C6270]">
                  {t('priceUnit')}
                </span>
              </p>
            )}
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[#5C6270]">
              {t('priceNote')}
            </p>
            <a
              href="#demo"
              className="mt-6 inline-flex h-12 items-center rounded-lg bg-[#1A1D21] px-6 text-[15px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#3B45B8]"
            >
              {t('priceCta')}
            </a>
          </div>

          <ul className="space-y-3 md:border-l md:border-[#E4E6EA] md:pl-12">
            {INCLUDED.map((key) => (
              <li key={key} className="flex items-start gap-2.5">
                <Check
                  className="mt-[3px] h-4 w-4 shrink-0 text-[#1F8A4C]"
                  aria-hidden
                />
                <span className="text-[14px] leading-relaxed text-[#1A1D21]">
                  {t(key)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
