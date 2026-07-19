import Link from 'next/link';

import { DASHBOARD_PERIODS, formatKg, formatSom } from '@kargotrack/shared';
import type { DashboardPeriod } from '@kargotrack/shared';

import { cn } from '@/lib/utils';
import { requireAdmin } from '@/lib/auth';
import { getDailyTushum, getDashboardStats } from '@/lib/queries';

import { TushumChart } from './tushum-chart';

export const metadata = { title: 'Bosh sahifa — KargoTrack' };

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Bugun',
  '7d': '7 kun',
  '30d': '30 kun',
};

function isPeriod(v: string | undefined): v is DashboardPeriod {
  return v !== undefined && (DASHBOARD_PERIODS as readonly string[]).includes(v);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { p?: string };
}) {
  const { tenant } = await requireAdmin();
  const period: DashboardPeriod = isPeriod(searchParams.p) ? searchParams.p : 'today';

  const [stats, tushum] = await Promise.all([
    getDashboardStats(tenant.id, period),
    getDailyTushum(tenant.id),
  ]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Bosh sahifa</h1>
        {/* Period toggle (§5.10). */}
        <div className="flex gap-1 rounded-full border border-input bg-white p-0.5">
          {DASHBOARD_PERIODS.map((p) => (
            <Link
              key={p}
              href={p === 'today' ? '/dashboard' : `/dashboard?p=${p}`}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                p === period
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-secondary',
              )}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <StatCard emoji="📦" label="Xitoyda qabul qilingan" value={String(stats.chinaReceived)} />
        <StatCard emoji="🇺🇿" label="Toshkentga kelgan" value={String(stats.tashkentArrived)} />
        <StatCard
          emoji="🎉"
          label="Topshirilgan"
          value={String(stats.delivered.count)}
          sub={`${formatKg(stats.delivered.weightGrams)} kg · ${formatSom(stats.delivered.priceTiyin)} so'm`}
        />
        <StatCard emoji="💰" label="Tushum" value={`${formatSom(stats.tushumTiyin)} so'm`} />
        <StatCard emoji="👥" label="Yangi mijozlar" value={String(stats.newCustomers)} />
        <StatCard
          emoji="🔴"
          label="Jami qarzdorlik"
          value={`${formatSom(stats.debtTiyin)} so'm`}
          sub={`${stats.debtorCount} ta qarzdor`}
          accent
        />
      </div>

      <TushumChart points={tushum} />
    </div>
  );
}

function StatCard({
  emoji,
  label,
  value,
  sub,
  accent,
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3.5">
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="text-base leading-none">{emoji}</span>
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          'mt-1.5 font-mono text-lg font-bold tabular-nums',
          accent ? 'text-[#b3261e]' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}
