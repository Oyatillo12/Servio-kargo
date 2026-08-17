import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { SectionHeading } from './section-heading';

/**
 * Everything the picture sections did not already show. Import, notifications
 * and debt are deliberately absent — they are the steps of "Qanday ishlaydi";
 * the weigh console has its own section. What remains is the long tail a
 * cargo owner asks about on a demo call, including what shipped since the
 * first version of this page: tickets, the QR client card, import undo.
 */
const ITEMS = [
  'getBot',
  'getBatch',
  'getPrice',
  'getExcel',
  'getStaff',
  'getTickets',
  'getQr',
  'getUndo',
] as const;

/**
 * A definition list on ruled lines — a waybill's field table, not an icon
 * grid. A term and its explanation read faster than eight rounded tiles, and
 * do not pretend that "Excel export" needs an illustration.
 */
export async function WhatYouGet({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-rule bg-surface py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          index="04"
          kicker={t('getKicker')}
          title={t('getTitle')}
        />

        <dl className="mt-10 border-t border-rule">
          {ITEMS.map((item, i) => (
            <div
              key={item}
              className="grid gap-1.5 border-b border-rule py-5 sm:grid-cols-[3.5rem_16rem_1fr] sm:gap-8"
            >
              <dt className="hidden font-mono text-[12px] leading-6 text-ink-3 sm:block">
                {String(i + 1).padStart(2, '0')}
              </dt>
              <dt className="font-display text-[16px] font-semibold uppercase tracking-[0.03em] text-ink">
                {t(`${item}Title`)}
              </dt>
              <dd className="text-[14.5px] leading-relaxed text-ink-2">
                {t(`${item}Desc`)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
