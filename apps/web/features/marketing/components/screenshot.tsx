import Image from 'next/image';

import type { Lang } from '@kargotrack/shared';

import { cn } from '@/lib/utils';

import { shotFor, type ShotKey } from '../images';

/**
 * A product screenshot in a frame.
 *
 * `panel` shots wear a slim chrome bar — three dots and a mono caption — so a
 * capture reads as "this is the actual screen", not as an illustration. The
 * frame is TERMINAL: white surface, hairline rule, sharp corners, a shadow
 * only strong enough to lift it off the paper.
 *
 * `phone` is a portrait Telegram capture that reads fine at ~300px and keeps
 * a rounder shell, because a phone is round-cornered hardware, not paperwork.
 *
 * `priority` only on the hero image — everything below the fold stays lazy.
 */
export function Screenshot({
  shot,
  locale,
  alt,
  caption,
  variant = 'panel',
  priority = false,
  className,
}: {
  shot: ShotKey;
  locale: Lang;
  alt: string;
  /** Mono label in the chrome bar, e.g. "/dashboard". Panel variant only. */
  caption?: string;
  variant?: 'panel' | 'phone';
  priority?: boolean;
  className?: string;
}) {
  const src = shotFor(shot, locale);

  if (variant === 'phone') {
    return (
      <div
        className={cn(
          'mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-rule bg-surface shadow-[0_10px_32px_-12px_rgba(20,23,26,0.25)]',
          className,
        )}
      >
        <Image
          src={src}
          alt={alt}
          placeholder="blur"
          sizes="300px"
          priority={priority}
          className="h-auto w-full"
        />
      </div>
    );
  }

  return (
    <figure
      className={cn(
        'overflow-hidden rounded-lg border border-rule bg-surface shadow-[0_16px_44px_-18px_rgba(20,23,26,0.28)]',
        className,
      )}
    >
      <div className="flex h-8 items-center gap-2 border-b border-rule-soft bg-surface-alt px-3.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2 w-2 rounded-full border border-rule bg-surface" />
          <span className="h-2 w-2 rounded-full border border-rule bg-surface" />
          <span className="h-2 w-2 rounded-full border border-rule bg-surface" />
        </span>
        {caption ? (
          <span className="ml-1 font-mono text-[11px] tracking-wide text-ink-3">
            {caption}
          </span>
        ) : null}
      </div>
      <Image
        src={src}
        alt={alt}
        placeholder="blur"
        sizes="(max-width: 1024px) 100vw, 1024px"
        priority={priority}
        className="h-auto w-full"
      />
    </figure>
  );
}
