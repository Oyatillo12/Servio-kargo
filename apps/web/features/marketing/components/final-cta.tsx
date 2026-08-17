import { Send } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { CONTACT_PHONE, TELEGRAM_URL } from '../config';
import { LeadForm } from './lead-form';

/**
 * Closing block on ink — the board again, this time with the ask. The form
 * card stays white so it reads as the one actionable surface on the band.
 */
export async function FinalCta({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section id="demo" className="scroll-mt-16 bg-ink">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-white/45">
            {t('ctaKicker')}
          </p>
          <h2 className="mt-4 font-display text-[32px] font-semibold uppercase leading-[1.05] tracking-[0.01em] text-white sm:text-[44px]">
            {t('ctaTitle')}
          </h2>
          <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-white/65">
            {t('ctaDesc')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-[3px] px-5 text-[15px] font-medium text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/5 hover:ring-white/60"
            >
              <Send className="h-4 w-4" aria-hidden />
              {t('telegramButton')}
            </a>
            {CONTACT_PHONE ? (
              <a
                href={`tel:${CONTACT_PHONE.replace(/[^+\d]/g, '')}`}
                className="font-mono text-[15px] font-medium text-white/70 transition-colors hover:text-white"
              >
                {CONTACT_PHONE}
              </a>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-surface p-5 sm:p-7">
          <LeadForm
            locale={locale}
            labels={{
              name: t('formName'),
              namePlaceholder: t('formNamePlaceholder'),
              phone: t('formPhone'),
              phonePlaceholder: t('formPhonePlaceholder'),
              company: t('formCompany'),
              companyPlaceholder: t('formCompanyPlaceholder'),
              submit: t('formSubmit'),
              submitting: t('formSubmitting'),
              success: t('formSuccess'),
            }}
          />
        </div>
      </div>
    </section>
  );
}
