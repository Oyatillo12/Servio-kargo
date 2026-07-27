import { getTranslations } from 'next-intl/server';

import { PIPELINE_ORDER, STATUS_META, type Lang } from '@kargotrack/shared';

import { SectionHeading } from './section-heading';

/**
 * The fixed status pipeline as a night route map. Labels come straight from
 * STATUS_META in packages/shared — the same vocabulary the bot and panel use
 * (CLAUDE.md i18n rule: domain vocabulary is never copied into messages).
 */
export async function Pipeline({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="landing-grid-dark bg-[#16143B] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          index="04"
          kicker={t('pipelineKicker')}
          title={t('pipelineTitle')}
          dark
        />
        <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-[#c9c6ee]">
          {t('pipelineDesc')}
        </p>

        <ol className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:flex lg:items-start lg:gap-0">
          {PIPELINE_ORDER.map((status, i) => {
            const meta = STATUS_META[status];
            return (
              <li key={status} className="contents">
                {i > 0 && (
                  <span
                    aria-hidden
                    className="mt-6 hidden flex-1 border-t-2 border-dotted border-white/25 lg:block"
                  />
                )}
                <div className="flex flex-col items-center gap-2.5 text-center lg:w-[104px] lg:shrink-0">
                  <span className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-white/5 text-[20px]">
                    {meta.emoji}
                  </span>
                  <span className="text-[12px] font-medium leading-tight text-white/85">
                    {meta[locale]}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
