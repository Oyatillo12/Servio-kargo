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
      <div className="flex flex-col items-start gap-4 rounded-xl border border-[#E4E6EA] bg-[#F7F8F9] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-[15px] font-medium text-[#1A1D21]">
          {labels.placeholder}
        </p>
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-[#3B45B8] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2C3494]"
        >
          <Send className="h-4 w-4" aria-hidden />
          {labels.placeholderCta}
        </a>
      </div>
    );
  }

  return (
    <figure>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#E4E6EA] bg-[#1A1D21] shadow-[0_10px_36px_-12px_rgba(26,29,33,0.22)]">
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
            <span className="absolute inset-0 bg-[#1A1D21]/20 transition-colors group-hover:bg-[#1A1D21]/5" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex items-center gap-2.5 rounded-full bg-white py-3 pl-4 pr-5 shadow-lg transition-transform group-hover:scale-105">
                <Play
                  className="h-5 w-5 fill-[#3B45B8] text-[#3B45B8]"
                  aria-hidden
                />
                <span className="text-[13px] font-semibold tabular-nums text-[#1A1D21]">
                  {DEMO_VIDEO.duration}
                </span>
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3 text-[13px] text-[#8A909C]">
        {labels.caption}
      </figcaption>
    </figure>
  );
}
