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
    <section className="border-t border-rule bg-surface py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading index="06" kicker="FAQ" title={t('faqTitle')} />

        <div className="landing-faq mt-8 max-w-3xl border-t border-rule">
          {FAQ_KEYS.map((key) => (
            <details key={key} className="group border-b border-rule">
              <summary className="flex cursor-pointer items-center justify-between gap-5 py-5">
                <span className="text-[15.5px] font-semibold text-ink">
                  {t(`${key}Q`)}
                </span>
                <Plus className="faq-icon h-4 w-4 shrink-0 text-signal" aria-hidden />
              </summary>
              <p className="max-w-2xl pb-5 pr-8 text-[14.5px] leading-relaxed text-ink-2">
                {t(`${key}A`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
