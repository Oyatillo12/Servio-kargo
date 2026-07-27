import { Mic, Paperclip } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

/**
 * CSS-only Telegram phone mockup for the hero. The bubbles are the bot's
 * REAL notification strings (packages/shared/src/i18n) with example data —
 * a prospect who has used any cargo bot recognises them instantly.
 */
export async function PhoneMockup({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  const bubbles = [
    { text: t('phoneMsgChina'), time: '09:14' },
    { text: t('phoneMsgTransit'), time: '18:40' },
    { text: t('phoneMsgReady'), time: '11:05' },
    { text: t('phoneMsgDelivered'), time: '16:22' },
  ];

  return (
    <div className="relative mx-auto w-[290px] sm:w-[312px]">
      {/* soft glow behind the device */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[3.5rem] bg-[#4640BF]/25 blur-3xl"
      />
      <div className="relative rounded-[2.6rem] border border-white/15 bg-[#0d0b24] p-2 shadow-2xl">
        <div className="overflow-hidden rounded-[2.1rem] bg-[#dfe4ec]">
          {/* Telegram-style chat header */}
          <div className="flex items-center gap-2.5 bg-[#2B2687] px-4 pb-3 pt-5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E0873A] text-[13px] font-bold text-white">
              K
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-semibold text-white">
                {t('phoneBotName')}
              </p>
              <p className="truncate font-mono text-[10.5px] text-white/60">
                {t('phoneBotHandle')}
              </p>
            </div>
          </div>

          {/* chat feed */}
          <div className="space-y-2 px-2.5 pb-3 pt-3">
            <div className="mx-auto w-max rounded-full bg-[#101014]/10 px-2.5 py-0.5 text-[10.5px] font-medium text-[#55555F]">
              12.08
            </div>
            {bubbles.map((b, i) => (
              <div
                key={b.time}
                className="landing-bubble max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-sm"
                style={{ animationDelay: `${0.25 + i * 0.18}s` }}
              >
                <p className="whitespace-pre-line text-[12.5px] leading-[1.45] text-[#101014]">
                  {b.text}
                </p>
                <p className="mt-0.5 text-right text-[10px] text-[#8A8A96]">
                  {b.time}
                </p>
              </div>
            ))}
          </div>

          {/* input bar (decorative) */}
          <div className="flex items-center gap-2 border-t border-[#d5d5dc] bg-white px-3 py-2.5">
            <Paperclip className="h-4 w-4 text-[#8A8A96]" aria-hidden />
            <div className="h-7 flex-1 rounded-full bg-[#F2F2F6]" />
            <Mic className="h-4 w-4 text-[#8A8A96]" aria-hidden />
          </div>
        </div>
      </div>
      <p className="mt-4 text-center font-mono text-[11px] tracking-wide text-white/50">
        {t('phoneCaption')}
      </p>
    </div>
  );
}
