import type { Lang } from '@kargotrack/shared';

import { Faq } from './faq';
import { FeaturesGrid } from './features-grid';
import { FinalCta } from './final-cta';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { LandingFooter } from './landing-footer';
import { LandingHeader } from './landing-header';
import { LandingJsonLd } from './json-ld';
import { Pipeline } from './pipeline';
import { Problem } from './problem';
import { Trust } from './trust';

/**
 * The whole landing page, shared by `/` (uz) and `/ru`. Locale arrives as a
 * prop — never from the cookie — so both pages stay statically rendered.
 */
export function LandingPage({ locale }: { locale: Lang }) {
  return (
    <>
      <LandingHeader locale={locale} />
      <main>
        <Hero locale={locale} />
        <Problem locale={locale} />
        <HowItWorks locale={locale} />
        <FeaturesGrid locale={locale} />
        <Pipeline locale={locale} />
        <Trust locale={locale} />
        <Faq locale={locale} />
        <FinalCta locale={locale} />
      </main>
      <LandingFooter locale={locale} />
      <LandingJsonLd locale={locale} />
    </>
  );
}
