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
import { Pricing } from './pricing';
import { WhatYouGet } from './what-you-get';

/**
 * The whole landing page, shared by `/` (uz) and `/ru`. Locale arrives as a
 * prop — never from the cookie — so both pages stay statically rendered.
 *
 * The spine is two symmetric picture sections: three panel captures for what
 * the owner does (`HowItWorks`), three bot captures for what their customer
 * gets (`CustomerView`). Everything else is short text between them. It used
 * to be eight prose sections of icon grids, which is what made it read as
 * filler — the screenshots now make the claims the copy used to assert.
 */
export function LandingPage({ locale }: { locale: Lang }) {
  return (
    <>
      <LandingHeader locale={locale} />
      <main>
        <Hero locale={locale} />
        <HowItWorks locale={locale} />
        <CustomerView locale={locale} />
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
