import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import type { ShotKey } from '../images';
import { Screenshot } from './screenshot';
import { SectionHeading } from './section-heading';

/**
 * The other half of the product: what the cargo company's own customer sees.
 *
 * Three real captures of the bot rather than a paragraph promising a good
 * experience — status messages, the price calculator, and the China warehouse
 * address carrying the customer's client code. "Mijozlarimiz nimani ko'radi?"
 * is the question every owner asks, and this answers it without being read.
 */
const VIEWS: { key: string; shot: ShotKey }[] = [
  { key: 'cust1', shot: 'botChat' },
  { key: 'cust2', shot: 'botCalculator' },
  { key: 'cust3', shot: 'botAddress' },
];

export async function CustomerView({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-[#E4E6EA] bg-white py-16 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-6">
        <SectionHeading title={t('custTitle')} lead={t('custLead')} />

        {/* Captions above the captures, not below. The three chats are
            genuinely different lengths, and labelling them underneath would
            leave the headings on three different baselines — cropping them to
            a common height instead would cut the calculator's result line,
            which is the whole point of that shot. */}
        <ul className="mt-10 grid items-start gap-10 sm:grid-cols-3 sm:gap-8">
          {VIEWS.map(({ key, shot }) => (
            <li key={key}>
              <h3 className="text-[15px] font-bold text-[#1A1D21]">
                {t(`${key}Title`)}
              </h3>
              <p className="mt-1.5 min-h-[3.75rem] text-[13.5px] leading-relaxed text-[#5C6270]">
                {t(`${key}Desc`)}
              </p>
              <Screenshot
                shot={shot}
                locale={locale}
                alt={t(`${key}Alt`)}
                variant="phone"
                className="mt-4"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
