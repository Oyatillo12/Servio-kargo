import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { formatSom, type Lang } from '@kargotrack/shared';

import { PRICE_BASIC_SOM, PRICE_PREMIUM_SOM } from '../config';
import { SectionHeading } from './section-heading';

const BASIC_INCLUDED = [
  'priceBasic1',
  'priceBasic2',
  'priceBasic3',
  'priceBasic4',
  'priceBasic5',
] as const;

/** Premium roadmap rows — stamped REJADA, never presented as shipped. */
const PREMIUM_PLANNED = ['pricePlanned1', 'pricePlanned2'] as const;

/**
 * Two plans, mirroring `tenants.plan` (packages/shared/services/plans.ts):
 * basic is the full product, premium adds the Mini App cabinet today and is
 * where the roadmap lands. Planned rows carry an explicit REJADA stamp in the
 * hatch texture — the page must stay honest about what exists (D-013).
 *
 * Prices come from `../config`; while null the card says the figure is agreed
 * per company, which is at least a concrete next step rather than a number
 * the page cannot back.
 */
export async function Pricing({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-rule bg-paper py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          index="05"
          kicker={t('priceKicker')}
          title={t('priceTitle')}
          lead={t('priceLead')}
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-2 lg:gap-6">
          {/* ---- BASIC ---- */}
          <div className="flex flex-col rounded-lg border border-rule bg-surface p-6 sm:p-8">
            <p className="font-display text-[26px] font-semibold uppercase tracking-[0.02em] text-ink">
              {t('priceBasicName')}
            </p>
            <PlanPrice som={PRICE_BASIC_SOM} unit={t('priceUnit')} tbd={t('priceTbd')} />
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
              {t('priceBasicDesc')}
            </p>
            <ul className="mt-6 flex-1 space-y-0 border-t border-rule-soft">
              {BASIC_INCLUDED.map((key) => (
                <li
                  key={key}
                  className="flex items-start gap-2.5 border-b border-rule-soft py-3"
                >
                  <Check className="mt-[3px] h-4 w-4 shrink-0 text-success" aria-hidden />
                  <span className="text-[14px] leading-relaxed text-ink">
                    {t(key)}
                  </span>
                </li>
              ))}
            </ul>
            <a
              href="#demo"
              className="mt-7 inline-flex h-12 items-center justify-center rounded-[3px] border border-ink font-display text-[14px] font-medium uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-white"
            >
              {t('priceCta')}
            </a>
          </div>

          {/* ---- PREMIUM ---- */}
          <div className="flex flex-col rounded-lg border border-ink bg-surface p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-[26px] font-semibold uppercase tracking-[0.02em] text-ink">
                {t('pricePremiumName')}
              </p>
              <span className="inline-flex items-center rounded-[3px] bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white">
                {t('pricePremiumBadge')}
              </span>
            </div>
            <PlanPrice som={PRICE_PREMIUM_SOM} unit={t('priceUnit')} tbd={t('priceTbd')} />
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
              {t('pricePremiumDesc')}
            </p>
            <ul className="mt-6 flex-1 space-y-0 border-t border-rule-soft">
              <li className="flex items-start gap-2.5 border-b border-rule-soft py-3">
                <Check className="mt-[3px] h-4 w-4 shrink-0 text-success" aria-hidden />
                <span className="text-[14px] leading-relaxed text-ink">
                  {t('pricePremiumAll')}
                </span>
              </li>
              <li className="flex items-start gap-2.5 border-b border-rule-soft py-3">
                <Check className="mt-[3px] h-4 w-4 shrink-0 text-success" aria-hidden />
                <span className="text-[14px] leading-relaxed text-ink">
                  <span className="font-semibold">{t('pricePremiumMiniapp')}</span>{' '}
                  {t('pricePremiumMiniappDesc')}
                </span>
              </li>
              {/* The roadmap, where it honestly belongs: gated on premium,
                  stamped as planned. The hatch is the panel's own "nothing
                  here yet" texture — the stamp cannot be misread as a check. */}
              {PREMIUM_PLANNED.map((key) => (
                <li
                  key={key}
                  className="flex items-start gap-2.5 border-b border-rule-soft py-3"
                >
                  <span className="hatch mt-[3px] inline-flex shrink-0 items-center rounded-[2px] border border-rule px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-2">
                    {t('pricePlannedBadge')}
                  </span>
                  <span className="text-[14px] leading-relaxed text-ink-2">
                    {t(key)}
                  </span>
                </li>
              ))}
            </ul>
            <a
              href="#demo"
              className="mt-7 inline-flex h-12 items-center justify-center rounded-[3px] bg-signal font-display text-[14px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-signal-strong"
            >
              {t('priceCta')}
            </a>
          </div>
        </div>

        <p className="mt-6 text-[13.5px] text-ink-2">{t('priceNote')}</p>
      </div>
    </section>
  );
}

/** The figure line of a plan card — a mono number, or the agreed-per-company line. */
function PlanPrice({
  som,
  unit,
  tbd,
}: {
  som: number | null;
  unit: string;
  tbd: string;
}) {
  if (som === null) {
    return (
      <p className="mt-2 font-mono text-[13px] uppercase tracking-[0.06em] text-ink-2">
        {tbd}
      </p>
    );
  }
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
      <span className="font-mono text-[32px] font-semibold tracking-tight text-ink sm:text-[36px]">
        {/* formatSom takes tiyin — CLAUDE.md rule 6. */}
        {formatSom(som * 100)}
      </span>
      <span className="text-[14px] font-medium text-ink-2">{unit}</span>
    </p>
  );
}
