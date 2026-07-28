import Image from 'next/image';

import type { Lang } from '@kargotrack/shared';

import { cn } from '@/lib/utils';

import { shotFor, type ShotKey } from '../images';

/**
 * A product screenshot in a frame.
 *
 * Two shapes, because the two surfaces are shaped differently: `panel` is a
 * wide browser screen that needs the full column to stay legible (a 1920px
 * capture in a half column is just texture), `phone` is a portrait Telegram
 * capture that reads fine at ~300px. Both share a border and shadow so a panel
 * shot and a bot shot on the same page belong to one set.
 *
 * `priority` only on the hero image — everything below the fold stays lazy so
 * a 220 KB PNG does not sit on the critical path of a phone connection.
 */
export function Screenshot({
  shot,
  locale,
  alt,
  variant = 'panel',
  priority = false,
  className,
}: {
  shot: ShotKey;
  locale: Lang;
  alt: string;
  variant?: 'panel' | 'phone';
  priority?: boolean;
  className?: string;
}) {
  const src = shotFor(shot, locale);
  const phone = variant === 'phone';

  return (
    <div
      className={cn(
        'overflow-hidden border border-[#E4E6EA] bg-white shadow-[0_10px_36px_-12px_rgba(26,29,33,0.22)]',
        phone ? 'mx-auto w-full max-w-[300px] rounded-2xl' : 'rounded-xl',
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        placeholder="blur"
        sizes={phone ? '300px' : '(max-width: 1024px) 100vw, 960px'}
        priority={priority}
        className="h-auto w-full"
      />
    </div>
  );
}
