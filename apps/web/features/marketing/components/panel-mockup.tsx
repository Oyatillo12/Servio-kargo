import { ChevronRight, Scale, TimerOff, UserX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { RouteDots } from '@/components/layout/brand';

/**
 * Miniature of the real admin dashboard (worklists + stat cards) in a phone
 * width — the "runs from your phone" proof, all CSS.
 */
export async function PanelMockup({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });

  const stats = [
    { value: '156', label: t('panelStatToday') },
    { value: '42', label: t('panelStatReady') },
    { value: '3.4 mln', label: t('panelStatDebt') },
  ];
  const work = [
    { icon: Scale, label: t('panelWork1'), count: 24 },
    { icon: UserX, label: t('panelWork2'), count: 7 },
    { icon: TimerOff, label: t('panelWork3'), count: 3 },
  ];

  return (
    <div className="mt-10 grid items-center gap-8 rounded-2xl border border-[#d5d5dc] bg-white p-6 sm:p-8 lg:grid-cols-2">
      <div>
        <h3 className="text-[22px] font-extrabold tracking-tight text-[#16143B] sm:text-[26px]">
          {t('panelTitle')}
        </h3>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#55555F]">
          {t('panelCaption')}
        </p>
        <RouteDots className="mt-5" />
      </div>

      <div className="mx-auto w-full max-w-[340px] rounded-xl border border-[#e3e3ea] bg-[#F2F2F6] p-3.5 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-white p-2.5">
              <p className="font-mono text-[15px] font-semibold text-[#16143B]">
                {s.value}
              </p>
              <p className="mt-0.5 text-[10.5px] leading-tight text-[#8A8A96]">
                {s.label}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg bg-white px-3">
          {work.map(({ icon: Icon, label, count }, i) => (
            <div
              key={label}
              className={`flex items-center justify-between py-2.5 ${
                i > 0 ? 'border-t border-[#eeeef2]' : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-[#16143B]">
                <Icon className="h-3.5 w-3.5 shrink-0 text-[#2B2687]" aria-hidden />
                <span className="truncate">{label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="rounded-full bg-[#EEEDFA] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#2B2687]">
                  {count}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[#8A8A96]" aria-hidden />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
