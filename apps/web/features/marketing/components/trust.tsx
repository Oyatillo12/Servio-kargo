import {
  DatabaseBackup,
  History,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { SectionHeading } from './section-heading';

const ITEMS: { key: string; icon: LucideIcon }[] = [
  { key: 'trust1', icon: ShieldCheck },
  { key: 'trust2', icon: History },
  { key: 'trust3', icon: DatabaseBackup },
  { key: 'trust4', icon: UserCheck },
];

/** Reliability proof points in dashed "waybill" cards. */
export async function Trust({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-y border-[#e3e3ea] bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          index="05"
          kicker={t('trustKicker')}
          title={t('trustTitle')}
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {ITEMS.map(({ key, icon: Icon }) => (
            <article
              key={key}
              className="flex items-start gap-4 rounded-xl border border-dashed border-[#c6c6cf] p-5"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#EEEDFA] text-[#2B2687]">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-[#16143B]">
                  {t(`${key}Title`)}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#55555F]">
                  {t(`${key}Desc`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
