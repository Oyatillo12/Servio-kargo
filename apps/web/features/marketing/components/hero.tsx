import { ArrowUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { TELEGRAM_URL } from '../config';
import { Screenshot } from './screenshot';

/**
 * Opening screen, composed like the head of a waybill: a mono route line,
 * a stencilled claim, one signal action, and the panel itself.
 *
 * The visual is the real dashboard rather than a drawn mockup — a prospect
 * who runs a cargo company reads that screen faster than any paragraph, and
 * it is the one thing on the page that cannot be written by someone who has
 * not built the product.
 */
export async function Hero({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  const facts = ['heroFact1', 'heroFact2', 'heroFact3'] as const;

  return (
    <section className="overflow-hidden bg-paper">
      <div className="mx-auto w-full max-w-6xl px-5 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="max-w-4xl">
          {/* Route line — the corridor this system is built for, drawn in the
              same shape language as the panel's route rail. */}
          <p className="flex items-center gap-2.5 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-2">
            <span aria-hidden className="h-[7px] w-[7px] rounded-[1px] bg-signal" />
            <span>{t('heroRoute')}</span>
          </p>

          <h1 className="animate-fade-in-up mt-6 font-display text-[42px] font-semibold uppercase leading-[0.98] tracking-[0.005em] text-ink sm:text-[76px]">
            {t.rich('heroTitle', {
              mark: (chunks) => <span className="headline-mark">{chunks}</span>,
            })}
          </h1>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            {t('heroSubtitle')}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <a
              href="#demo"
              className="inline-flex h-[52px] items-center rounded-[3px] bg-signal px-8 font-display text-[15px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-signal-strong"
            >
              {t('heroCtaPrimary')}
            </a>
            {/* A text link, not a second outlined button — a matched pair of
                buttons is the shape every generated hero lands on. */}
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 border-b border-foreground/25 pb-0.5 text-[15px] font-semibold text-ink transition-colors hover:border-foreground"
            >
              {t('heroCtaSecondary')}
              <ArrowUpRight
                className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </a>
          </div>

          {/* Three verifiable facts on a ruled line — a waybill's meta row,
              not a marketing stat block: nothing here is a number we invented. */}
          <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-rule pt-5">
            {facts.map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                  {t(`${key}Label`)}
                </dt>
                <dd className="font-display text-[15px] font-medium uppercase tracking-[0.04em] text-ink">
                  {t(`${key}Value`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <Screenshot
          shot="dashboard"
          locale={locale}
          alt={t('shotDashboardAlt')}
          caption="/dashboard"
          priority
          className="mt-12 sm:mt-16"
        />
      </div>
    </section>
  );
}
