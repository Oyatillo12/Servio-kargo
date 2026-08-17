'use client';

import { Play, Send } from 'lucide-react';
import { useState } from 'react';

import { DEMO_VIDEO, TELEGRAM_URL } from '../config';

export interface DemoVideoLabels {
  /** Caption under the frame — what the viewer just watched. */
  caption: string;
  /** Accessible name of the play button. */
  play: string;
  /** Shown instead of the player while no recording is configured. */
  placeholder: string;
  /** Telegram CTA inside the placeholder. */
  placeholderCta: string;
}

/**
 * The demo recording.
 *
 * Click-to-play rather than an embed: the poster is the only thing that loads
 * with the page, and no third party gets a request from a visitor who never
 * presses play. `preload="none"` is implied by only mounting the <video> after
 * the click, which matters on the mobile connections most visitors are on.
 *
 * Until `DEMO_VIDEO` is filled in (see `../config`) this renders as a short
 * live-demo invitation instead — never an empty widescreen rectangle.
 */
export function DemoVideo({ labels }: { labels: DemoVideoLabels }) {
  const [playing, setPlaying] = useState(false);

  if (!DEMO_VIDEO) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-rule bg-paper px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-[15px] font-medium text-ink">{labels.placeholder}</p>
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[3px] bg-signal px-5 font-display text-[13px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-signal-strong"
        >
          <Send className="h-4 w-4" aria-hidden />
          {labels.placeholderCta}
        </a>
      </div>
    );
  }

  return (
    <figure>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-rule bg-ink shadow-[0_16px_44px_-18px_rgba(20,23,26,0.28)]">
        {playing ? (
          <video
            src={DEMO_VIDEO.src}
            poster={DEMO_VIDEO.poster}
            controls
            autoPlay
            playsInline
            className="h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={labels.play}
            className="group absolute inset-0 h-full w-full"
          >
            {/* Plain <img>: the poster is a decorative fill and next/image
                would add a layout wrapper inside an already-sized frame. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEMO_VIDEO.poster}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-foreground/25 transition-colors group-hover:bg-foreground/10" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex items-center gap-2.5 rounded-[3px] bg-surface py-3 pl-4 pr-5 shadow-lg transition-transform group-hover:scale-105">
                <Play className="h-5 w-5 fill-signal text-signal" aria-hidden />
                <span className="font-mono text-[13px] font-semibold text-ink">
                  {DEMO_VIDEO.duration}
                </span>
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3 font-mono text-[12px] text-ink-3">
        {labels.caption}
      </figcaption>
    </figure>
  );
}
