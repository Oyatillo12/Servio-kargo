import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import type { ShotKey } from '../images';
import { Screenshot } from './screenshot';
import { SectionHeading } from './section-heading';

/**
 * The three steps that carry the pitch, each one shown rather than claimed.
 *
 * All three are wide panel captures under their text — a 1920px screen in a
 * half column turns the table into texture, and these screens are only
 * persuasive if the reader can actually read the track codes and the sums.
 */
const STEPS: { key: string; shot: ShotKey }[] = [
  { key: 'how1', shot: 'importer' },
  { key: 'how2', shot: 'tracks' },
  { key: 'how3', shot: 'debtors' },
];

export async function HowItWorks({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-[#E4E6EA] bg-[#F7F8F9] py-16 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-6">
        <SectionHeading title={t('howTitle')} />

        <ol className="mt-12 space-y-14 sm:space-y-20">
          {STEPS.map(({ key, shot }, i) => (
            <li key={key} className="border-t border-[#E4E6EA] pt-8">
              <div className="max-w-2xl">
                <p className="text-[13px] font-semibold tabular-nums text-[#3B45B8]">
                  0{i + 1}
                </p>
                <h3 className="mt-2 text-[21px] font-bold tracking-tight text-[#1A1D21] sm:text-[25px]">
                  {t(`${key}Title`)}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#5C6270]">
                  {t(`${key}Desc`)}
                </p>
              </div>
              <Screenshot
                shot={shot}
                locale={locale}
                alt={t(`${key}Alt`)}
                className="mt-7"
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
