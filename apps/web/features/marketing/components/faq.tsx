import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { SectionHeading } from './section-heading';

export const FAQ_KEYS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5'] as const;

/** Native <details> accordion — zero JS, crawlable answers. */
export async function Faq({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-[#E4E6EA] bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-6">
        <SectionHeading title={t('faqTitle')} />

        <div className="landing-faq mt-6 max-w-3xl divide-y divide-[#E4E6EA] border-y border-[#E4E6EA]">
          {FAQ_KEYS.map((key) => (
            <details key={key} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-5 py-4">
                <span className="text-[15px] font-semibold text-[#1A1D21]">
                  {t(`${key}Q`)}
                </span>
                <Plus
                  className="faq-icon h-4 w-4 shrink-0 text-[#3B45B8]"
                  aria-hidden
                />
              </summary>
              <p className="max-w-2xl pb-5 pr-8 text-[14px] leading-relaxed text-[#5C6270]">
                {t(`${key}A`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
