import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { DemoVideo } from './demo-video';
import { SectionHeading } from './section-heading';

/**
 * The demo recording, placed after the picture sections rather than in the
 * hero: by this point a visitor has seen the panel and the bot as stills and
 * knows what they are looking at, so the video is "watch it move", not "here
 * is a black rectangle, guess what it contains". While `DEMO_VIDEO` is still
 * null the whole section collapses to a short strip (see demo-video.tsx).
 */
export async function DemoSection({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  return (
    <section className="border-t border-rule bg-surface py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading title={t('videoTitle')} />
        <div className="mt-8">
          <DemoVideo
            labels={{
              caption: t('videoCaption'),
              play: t('videoPlay'),
              placeholder: t('videoPlaceholder'),
              placeholderCta: t('videoPlaceholderCta'),
            }}
          />
        </div>
      </div>
    </section>
  );
}
