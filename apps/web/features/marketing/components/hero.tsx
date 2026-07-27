import { Send } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { TELEGRAM_URL } from '../config';
import { PhoneMockup } from './phone-mockup';

/** Origin → destination route line, the brand's dotted-route motif on dark. */
function RouteLine() {
  return (
    <div aria-hidden className="flex items-center gap-1.5">
      <span className="h-[7px] w-[7px] rounded-full bg-[#E0873A]" />
      <span className="w-10 border-t-2 border-dotted border-white/30" />
      <span className="h-[7px] w-[7px] rounded-full border-2 border-white/30" />
      <span className="w-10 border-t-2 border-dotted border-white/30" />
      <span className="h-[7px] w-[7px] rounded-full border-2 border-white/30 bg-white" />
    </div>
  );
}

export async function Hero({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  const stats = [
    { value: t('statOnboarding'), label: t('statOnboardingLabel') },
    { value: t('statLangs'), label: t('statLangsLabel') },
    { value: t('statAlways'), label: t('statAlwaysLabel') },
  ];

  return (
    <section className="landing-grid-dark bg-[#16143B]">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <div className="grid items-center gap-12 pb-14 pt-14 lg:grid-cols-[1fr_auto] lg:gap-16 lg:pb-20 lg:pt-20">
          <div className="animate-fade-in-up max-w-xl">
            <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.22em] text-[#E0873A]">
              {t('heroKicker')}
            </p>
            <h1 className="mt-4 text-[34px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[46px]">
              {t('heroTitle')}
            </h1>
            <div className="mt-5">
              <RouteLine />
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-[#c9c6ee]">
              {t('heroSubtitle')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#demo"
                className="inline-flex h-12 items-center rounded-lg bg-[#E0873A] px-6 text-[15px] font-semibold text-[#16143B] transition-colors hover:bg-[#eda45f]"
              >
                {t('heroCtaPrimary')}
              </a>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/25 px-5 text-[15px] font-medium text-white transition-colors hover:border-white/50 hover:bg-white/5"
              >
                <Send className="h-4 w-4" aria-hidden />
                {t('heroCtaSecondary')}
              </a>
            </div>
            <p className="mt-4 font-mono text-[11px] tracking-wide text-white/50">
              {t('heroNote')}
            </p>
          </div>

          <PhoneMockup locale={locale} />
        </div>

        <div className="grid grid-cols-3 border-t border-white/10 py-6">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={
                i > 0 ? 'border-l border-dashed border-white/10 pl-6' : ''
              }
            >
              <p className="font-mono text-[17px] font-semibold text-white sm:text-[20px]">
                {s.value}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
