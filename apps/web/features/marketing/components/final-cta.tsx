import { Send } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { TELEGRAM_URL } from '../config';
import { LeadForm } from './lead-form';

/** Closing dark panel: pitch + Telegram link on the left, lead form right. */
export async function FinalCta({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section id="demo" className="scroll-mt-20 pb-16 sm:pb-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <div className="landing-grid-dark grid gap-10 rounded-3xl bg-[#16143B] p-6 sm:p-10 lg:grid-cols-2 lg:gap-14 lg:p-14">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E0873A]">
              07 — {t('ctaKicker')}
            </p>
            <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-tight text-white sm:text-[34px]">
              {t('ctaTitle')}
            </h2>
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-[#c9c6ee]">
              {t('ctaDesc')}
            </p>
            <div className="mt-8 flex items-center gap-3">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/25 px-5 text-[15px] font-medium text-white transition-colors hover:border-white/50 hover:bg-white/5"
              >
                <Send className="h-4 w-4" aria-hidden />
                {t('telegramButton')}
              </a>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-xl sm:p-7">
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
      </div>
    </section>
  );
}
