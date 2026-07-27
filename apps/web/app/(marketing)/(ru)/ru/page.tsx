import type { Metadata } from 'next';

import { LandingPage } from '@/features/marketing/components/landing-page';
import { landingMetadata } from '@/features/marketing/metadata';

export function generateMetadata(): Promise<Metadata> {
  return landingMetadata('ru');
}

export default function RuLandingPage() {
  return <LandingPage locale="ru" />;
}
