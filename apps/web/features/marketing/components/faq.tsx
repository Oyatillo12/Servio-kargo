import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { SectionHeading } from './section-heading';

export const FAQ_KEYS = [
  'faq1',
  'faq2',
  'faq3',
  'faq4',
  'faq5',
  'faq6',
] as const;

/** Native <details> accordion — zero JS, crawlable answers. */
export async function Faq({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading index="06" kicker={t('faqKicker')} title={t('faqTitle')} />

        <div className="landing-faq mt-8 max-w-3xl divide-y divide-[#e3e3ea] rounded-2xl border border-[#d5d5dc] bg-white">
          {FAQ_KEYS.map((key, i) => (
            <details key={key} className="group px-5 sm:px-6">
              <summary className="flex cursor-pointer items-center justify-between gap-4 py-4">
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[11.5px] font-semibold text-[#8A8A96]">
                    Q{i + 1}
                  </span>
                  <span className="text-[14.5px] font-semibold text-[#16143B]">
                    {t(`${key}Q`)}
                  </span>
                </span>
                <Plus
                  className="faq-icon h-4 w-4 shrink-0 text-[#C2691E]"
                  aria-hidden
                />
              </summary>
              <p className="pb-5 pl-9 pr-2 text-[13.5px] leading-relaxed text-[#55555F]">
                {t(`${key}A`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
