import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { Screenshot } from './screenshot';
import { SectionHeading } from './section-heading';

/**
 * The China-warehouse story, on its own because it is the differentiator no
 * checklist item can carry: Telegram is blocked in China, so a bot-only staff
 * flow dies exactly where parcels are received — this product's weigh console
 * is a plain web page that opens in Guangzhou without a VPN.
 */
export async function WeighFeature({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  const points = ['weighPoint1', 'weighPoint2', 'weighPoint3'] as const;

  return (
    <section className="border-t border-rule bg-paper py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div>
            <SectionHeading
              index="03"
              kicker={t('weighKicker')}
              title={t('weighTitle')}
              lead={t('weighLead')}
            />
            <ul className="mt-7 space-y-0 border-t border-rule">
              {points.map((key) => (
                <li
                  key={key}
                  className="flex items-baseline gap-3 border-b border-rule py-3.5"
                >
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] shrink-0 translate-y-px rounded-[1px] bg-signal"
                  />
                  <p className="text-[14.5px] leading-relaxed text-ink-2">
                    <span className="font-semibold text-ink">
                      {t(`${key}Title`)}
                    </span>{' '}
                    {t(`${key}Desc`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <Screenshot
            shot="weigh"
            locale={locale}
            alt={t('weighAlt')}
            caption="/weigh"
          />
        </div>
      </div>
    </section>
  );
}
