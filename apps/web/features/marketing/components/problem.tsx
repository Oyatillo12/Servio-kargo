import { Check, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { SectionHeading } from './section-heading';

/** Before / after comparison — the daily pain vs the same day with the bot. */
export async function Problem({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  const pains = ['pain1', 'pain2', 'pain3'] as const;

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          index="01"
          kicker={t('problemKicker')}
          title={t('problemTitle')}
        />

        <div className="mt-8 grid overflow-hidden rounded-2xl border border-[#d5d5dc] bg-white md:grid-cols-2">
          <div className="p-6 sm:p-7">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC3D33]">
              {t('compareBefore')}
            </p>
            <ul className="mt-4 space-y-4">
              {pains.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <X
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#CC3D33]"
                    aria-hidden
                  />
                  <span className="text-[13.5px] leading-relaxed text-[#55555F]">
                    {t(`${p}Before`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-dashed border-[#d5d5dc] bg-[#EEEDFA]/60 p-6 sm:p-7 md:border-l md:border-t-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1F8A4C]">
              {t('compareAfter')}
            </p>
            <ul className="mt-4 space-y-4">
              {pains.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#1F8A4C]"
                    aria-hidden
                  />
                  <span className="text-[13.5px] font-medium leading-relaxed text-[#16143B]">
                    {t(`${p}After`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
