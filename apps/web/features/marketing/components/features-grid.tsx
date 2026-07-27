import {
  Bot,
  Calculator,
  Download,
  FileSpreadsheet,
  HandCoins,
  Megaphone,
  Plane,
  Scale,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { PanelMockup } from './panel-mockup';
import { SectionHeading } from './section-heading';

type Feature = { key: string; icon: LucideIcon; highlight?: boolean };

/**
 * Eight capabilities; the first two (own branded bot, debt accounting) are
 * the differentiators and get the dark treatment.
 */
const FEATURES: Feature[] = [
  { key: 'featBot', icon: Bot, highlight: true },
  { key: 'featDebt', icon: HandCoins, highlight: true },
  { key: 'featImport', icon: FileSpreadsheet },
  { key: 'featBatch', icon: Plane },
  { key: 'featPrice', icon: Calculator },
  { key: 'featStaff', icon: Scale },
  { key: 'featBroadcast', icon: Megaphone },
  { key: 'featExport', icon: Download },
];

export async function FeaturesGrid({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          index="03"
          kicker={t('featuresKicker')}
          title={t('featuresTitle')}
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, icon: Icon, highlight }) => (
            <article
              key={key}
              className={
                highlight
                  ? 'landing-grid-dark rounded-xl bg-[#16143B] p-5 sm:col-span-2 lg:col-span-2'
                  : 'rounded-xl border border-[#d5d5dc] bg-white p-5'
              }
            >
              <div
                className={
                  highlight
                    ? 'grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-[#E0873A]'
                    : 'grid h-9 w-9 place-items-center rounded-lg bg-[#EEEDFA] text-[#2B2687]'
                }
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </div>
              <h3
                className={
                  highlight
                    ? 'mt-3.5 text-[15.5px] font-bold text-white'
                    : 'mt-3.5 text-[15px] font-bold text-[#16143B]'
                }
              >
                {t(`${key}Title`)}
              </h3>
              <p
                className={
                  highlight
                    ? 'mt-1.5 text-[13.5px] leading-relaxed text-[#c9c6ee]'
                    : 'mt-1.5 text-[13.5px] leading-relaxed text-[#55555F]'
                }
              >
                {t(`${key}Desc`)}
              </p>
            </article>
          ))}
        </div>

        <PanelMockup locale={locale} />
      </div>
    </section>
  );
}
