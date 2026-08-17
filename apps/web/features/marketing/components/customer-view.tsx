import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import type { ShotKey } from '../images';
import { Screenshot } from './screenshot';
import { SectionHeading } from './section-heading';

interface Card {
  key: 'cust1' | 'cust2' | 'cust3';
  shot: ShotKey;
}

/** What the customer sees: notifications, the calculator, the China address. */
const CARDS: Card[] = [
  { key: 'cust1', shot: 'botChat' },
  { key: 'cust2', shot: 'botCalculator' },
  { key: 'cust3', shot: 'botAddress' },
];

/**
 * The other half of the product: three real Telegram captures of the
 * customer's side, under the tenant's own brand. Closed by the Mini App line —
 * the premium cabinet is real and in production, so it may be named.
 */
export async function CustomerView({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-rule bg-surface py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          index="02"
          kicker={t('custKicker')}
          title={t('custTitle')}
          lead={t('custLead')}
        />

        <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-6 lg:gap-10">
          {CARDS.map((card) => (
            <figure key={card.key}>
              <Screenshot
                shot={card.shot}
                locale={locale}
                alt={t(`${card.key}Alt`)}
                variant="phone"
              />
              <figcaption className="mt-5 border-t border-rule pt-3.5">
                <p className="font-display text-[16px] font-semibold uppercase tracking-[0.03em] text-ink">
                  {t(`${card.key}Title`)}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
                  {t(`${card.key}Desc`)}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* The premium cabinet, stated as fact — it runs in production. */}
        <div className="mt-12 flex flex-col gap-3 rounded-lg border border-rule bg-paper px-5 py-5 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
          <span className="inline-flex w-max shrink-0 items-center rounded-[3px] bg-ink px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white">
            {t('pricePremiumName')}
          </span>
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">{t('miniappTitle')}</span>{' '}
            {t('miniappDesc')}
          </p>
        </div>
      </div>
    </section>
  );
}
