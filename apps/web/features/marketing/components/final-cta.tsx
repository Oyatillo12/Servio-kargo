import { Send } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { CONTACT_PHONE, TELEGRAM_URL } from '../config';
import { LeadForm } from './lead-form';

/** Closing block: the ask on the left, the form on the right. */
export async function FinalCta({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section id="demo" className="scroll-mt-16 bg-[#1A1D21]">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-white sm:text-[34px]">
            {t('ctaTitle')}
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#9CA3AF]">
            {t('ctaDesc')}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-5 text-[15px] font-medium text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/5 hover:ring-white/50"
            >
              <Send className="h-4 w-4" aria-hidden />
              {t('telegramButton')}
            </a>
            {CONTACT_PHONE ? (
              <a
                href={`tel:${CONTACT_PHONE.replace(/[^+\d]/g, '')}`}
                className="text-[15px] font-medium text-white/75 transition-colors hover:text-white"
              >
                {CONTACT_PHONE}
              </a>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 sm:p-7">
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
