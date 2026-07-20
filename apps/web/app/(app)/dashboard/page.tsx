import Link from 'next/link';

import { DASHBOARD_PERIODS, formatKg, formatSom } from '@kargotrack/shared';
import type { DashboardPeriod } from '@kargotrack/shared';

import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { requireAdmin } from '@/lib/auth';
import { getDailyTushum, getDashboardStats } from '@/lib/queries';

import { TushumChart } from './tushum-chart';

export const metadata = { title: 'Bosh sahifa — SERVIO Kargo' };

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

  const periodLabel = PERIOD_LABELS[period];

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="Bosh sahifa"
        right={
          /* Period toggle (§5.10). */
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
        }
      />

      {/* Money hero — the two figures owners glance at most. */}
      <div className="grid grid-cols-2 gap-2.5">
        <MoneyCard
          index={0}
          icon="💰"
          label={`Tushum · ${periodLabel}`}
          value={formatSom(stats.tushumTiyin)}
        />
        <MoneyCard
          index={1}
          href="/debtors"
          icon="🔴"
          label="Qarzdorlik"
          value={formatSom(stats.debtTiyin)}
          sub={`${stats.debtorCount} ta qarzdor`}
          negative
        />
      </div>

      {/* Cargo pipeline — the journey China → Tashkent → delivered. */}
      <div className="animate-fade-in-up" style={{ animationDelay: '90ms' }}>
        <SectionCard title="Yuklar harakati">
          <div className="flex items-start">
            <PipelineStage emoji="📦" label="Xitoyda" value={stats.chinaReceived} />
            <PipelineConnector />
            <PipelineStage
              emoji="🇺🇿"
              label="Toshkentda"
              value={stats.tashkentArrived}
            />
            <PipelineConnector />
            <PipelineStage
              emoji="🎉"
              label="Topshirilgan"
              value={stats.delivered.count}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5 border-t border-[#eef0f4] pt-2.5 text-[11.5px] text-muted-foreground">
            <span>Topshirilgan yuklar:</span>
            <span className="font-mono font-medium text-foreground">
              {formatKg(stats.delivered.weightGrams)} kg
            </span>
            <span>·</span>
            <span className="font-mono font-medium text-foreground">
              {formatSom(stats.delivered.priceTiyin)} so&apos;m
            </span>
          </div>
        </SectionCard>
      </div>

      {/* New customers — compact single stat. */}
      <div className="animate-fade-in-up" style={{ animationDelay: '135ms' }}>
        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-base leading-none">
                👥
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  Yangi mijozlar
                </p>
                <p className="text-[11px] text-muted-foreground">{periodLabel}</p>
              </div>
            </div>
            <p className="flex-none font-mono text-xl font-bold tabular-nums text-foreground">
              {stats.newCustomers}
            </p>
          </div>
        </SectionCard>
      </div>

      <TushumChart points={tushum} />
    </div>
  );
}

function MoneyCard({
  icon,
  label,
  value,
  sub,
  negative,
  href,
  index = 0,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  negative?: boolean;
  href?: string;
  index?: number;
}) {
  const body = (
    <div
      className={cn(
        'animate-fade-in-up min-w-0 rounded-xl border bg-white p-3.5 transition-colors',
        negative ? 'border-[#f3d6d4] hover:bg-[#fdf6f6]' : 'border-border',
      )}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="text-sm leading-none">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          'mt-1.5 font-mono text-[21px] font-bold leading-tight tabular-nums',
          negative ? 'text-[#b3261e]' : 'text-foreground',
        )}
      >
        {value}
        <span className="ml-1 text-[11px] font-medium text-muted-foreground">
          so&apos;m
        </span>
      </p>
      {sub ? (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="min-w-0">
      {body}
    </Link>
  ) : (
    body
  );
}

function PipelineStage({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg leading-none">
        {emoji}
      </span>
      <span className="font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
      </span>
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

/** Dotted route connector between pipeline stages (brand motif). */
function PipelineConnector() {
  return (
    <div className="flex flex-none items-start pt-5">
      <span className="w-5 border-t-2 border-dotted border-[#c3c9d6] sm:w-8" />
    </div>
  );
}
