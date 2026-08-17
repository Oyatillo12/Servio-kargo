import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import type { ShotKey } from '../images';
import { Screenshot } from './screenshot';
import { SectionHeading } from './section-heading';

interface Step {
  key: 'how1' | 'how2' | 'how3';
  shot: ShotKey;
  caption: string;
}

/** The owner's day in three numbered fields: import → one action → debt. */
const STEPS: Step[] = [
  { key: 'how1', shot: 'importer', caption: '/import' },
  { key: 'how2', shot: 'tracks', caption: '/tracks' },
  { key: 'how3', shot: 'debtors', caption: '/debtors' },
];

/**
 * What the owner does, told with three panel captures. The spine of the page:
 * each claim in the copy is made by the screenshot next to it, not asserted
 * by an icon grid.
 */
export async function HowItWorks({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-rule bg-paper py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          index="01"
          kicker={t('howKicker')}
          title={t('howTitle')}
        />

        <div className="mt-12 space-y-14 sm:mt-16 sm:space-y-20">
          {STEPS.map((step, i) => (
            <div
              key={step.key}
              className="grid items-center gap-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14"
            >
              <div className={i % 2 === 1 ? 'lg:order-2' : undefined}>
                {/* Stencilled step number on a hairline — the waybill field
                    marker this section's heading promises. */}
                <p
                  aria-hidden
                  className="flex items-baseline gap-3 border-b border-rule pb-3 font-display text-[15px] font-medium text-ink-3"
                >
                  <span className="text-signal">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
                    {t(`${step.key}Kicker`)}
                  </span>
                </p>
                <h3 className="mt-4 font-display text-[24px] font-semibold uppercase leading-[1.1] tracking-[0.01em] text-ink sm:text-[30px]">
                  {t(`${step.key}Title`)}
                </h3>
                <p className="mt-3.5 max-w-md text-[15.5px] leading-relaxed text-ink-2">
                  {t(`${step.key}Desc`)}
                </p>
              </div>

              <Screenshot
                shot={step.shot}
                locale={locale}
                alt={t(`${step.key}Alt`)}
                caption={step.caption}
                className={i % 2 === 1 ? 'lg:order-1' : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
