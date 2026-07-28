import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { SectionHeading } from './section-heading';

/**
 * Everything the three steps did not already show. Debt and import are
 * deliberately absent — they are steps 01 and 03 of "Qanday ishlaydi", and
 * repeating them here is what turned this into an eight-card grid before.
 */
const ITEMS = [
  'getBot',
  'getBatch',
  'getPrice',
  'getWarehouse',
  'getExcel',
  'getStaff',
] as const;

/**
 * What the product actually does, as a definition list.
 *
 * Replaces an eight-card icon grid. Every capability had a rounded tile and a
 * lucide glyph, which made eight different things look like one repeating
 * texture; a term and its explanation on a ruled line reads faster and does
 * not pretend that "Excel export" needs an illustration.
 */
export async function WhatYouGet({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-[#E4E6EA] bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-6">
        <SectionHeading title={t('getTitle')} />

        <dl className="mt-8 divide-y divide-[#E4E6EA] border-y border-[#E4E6EA]">
          {ITEMS.map((item) => (
            <div
              key={item}
              className="grid gap-1 py-5 sm:grid-cols-[15rem_1fr] sm:gap-8"
            >
              <dt className="text-[15px] font-bold text-[#1A1D21]">
                {t(`${item}Title`)}
              </dt>
              <dd className="text-[14px] leading-relaxed text-[#5C6270]">
                {t(`${item}Desc`)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
