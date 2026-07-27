import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { SectionHeading } from './section-heading';

/** Three onboarding steps on a dashed timeline, closed by a "5 min" stamp. */
export async function HowItWorks({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  const steps = ['how1', 'how2', 'how3'] as const;

  return (
    <section className="border-y border-[#e3e3ea] bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            index="02"
            kicker={t('howKicker')}
            title={t('howTitle')}
          />
          <span className="inline-block -rotate-2 rounded border-2 border-dashed border-[#C2691E] px-3 py-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-[#C2691E]">
            {t('howBadge')}
          </span>
        </div>

        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {steps.map((s, i) => (
            <li
              key={s}
              className="relative border-t-2 border-dashed border-[#d5d5dc] pt-6"
            >
              <span
                aria-hidden
                className="absolute -top-[5px] left-0 h-2 w-2 rounded-full bg-[#2B2687]"
              />
              <p className="font-mono text-[28px] font-semibold leading-none text-[#A7A3EA]">
                0{i + 1}
              </p>
              <h3 className="mt-3 text-[16px] font-bold text-[#16143B]">
                {t(`${s}Title`)}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#55555F]">
                {t(`${s}Desc`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
