import type { Lang } from '@kargotrack/shared';

import { CustomerView } from './customer-view';
import { DemoSection } from './demo-section';
import { Faq } from './faq';
import { FinalCta } from './final-cta';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { LandingFooter } from './landing-footer';
import { LandingHeader } from './landing-header';
import { LandingJsonLd } from './json-ld';
import { PipelineBoard } from './pipeline-board';
import { Pricing } from './pricing';
import { WeighFeature } from './weigh-feature';
import { WhatYouGet } from './what-you-get';

/**
 * The whole landing page, shared by `/` (uz) and `/ru`. Locale arrives as a
 * prop — never from the cookie — so both pages stay statically rendered.
 *
 * TERMINAL at marketing scale (D-013): the page reads as one numbered
 * document. The spine is picture sections of the real product — panel
 * captures for the owner (`HowItWorks`), Telegram captures for their customer
 * (`CustomerView`), the weigh console for the China warehouse
 * (`WeighFeature`) — with the pipeline board separating claim from evidence.
 * Everything else is short text between them.
 */
export function LandingPage({ locale }: { locale: Lang }) {
  return (
    <>
      <LandingHeader locale={locale} />
      <main>
        <Hero locale={locale} />
        <PipelineBoard locale={locale} />
        <HowItWorks locale={locale} />
        <CustomerView locale={locale} />
        <WeighFeature locale={locale} />
        <DemoSection locale={locale} />
        <WhatYouGet locale={locale} />
        <Pricing locale={locale} />
        <Faq locale={locale} />
        <FinalCta locale={locale} />
      </main>
      <LandingFooter locale={locale} />
      <LandingJsonLd locale={locale} />
    </>
  );
}
