import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { DASHBOARD_PERIODS, formatKg, formatSom } from '@kargotrack/shared';
import type { DashboardPeriod } from '@kargotrack/shared';

import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { requireAdmin } from '@/lib/auth';
import {
  getDailyTushum,
  getDashboardStats,
  getWorklistCounts,
} from '@/lib/queries';
import { MoneyCard } from '@/features/dashboard/components/money-card';
import { TushumChart } from '@/features/dashboard/components/tushum-chart';
import { WorkQueue } from '@/features/dashboard/components/work-queue';

export async function generateMetadata() {
  const t = await getTranslations('dashboard');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

/** Message key per period (SPEC §5.10 toggle). */
const PERIOD_KEY: Record<DashboardPeriod, string> = {
  today: 'periodToday',
  '7d': 'period7d',
  '30d': 'period30d',
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
  const t = await getTranslations('dashboard');
  const tCommon = await getTranslations('common');

  const period: DashboardPeriod = isPeriod(searchParams.p)
    ? searchParams.p
    : 'today';

  const [stats, worklists, tushum] = await Promise.all([
    getDashboardStats(tenant.id, period),
    getWorklistCounts(tenant.id),
    getDailyTushum(tenant.id),
  ]);

  const periodLabel = t(PERIOD_KEY[period]);

  return (
    <div className="space-y-2.5">
      <PageHeader
        title={t('pageTitle')}
        right={
          /* Period toggle (§5.10). */
          <div
            role="tablist"
            aria-label={t('pageTitle')}
            className="flex gap-1 rounded-full border border-input bg-white p-0.5"
          >
            {DASHBOARD_PERIODS.map((p) => (
              <Link
                key={p}
                role="tab"
                aria-selected={p === period}
                href={p === 'today' ? '/dashboard' : `/dashboard?p=${p}`}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  p === period
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-secondary',
                )}
              >
                {t(PERIOD_KEY[p])}
              </Link>
            ))}
          </div>
        }
      />

      {/* Pending work first (AUDIT.md T19): the dashboard's top slot answers
          "what do I do now", not "how was the month". The period toggle above
          does not apply to it — a package unweighed since last week is still
          today's job — which is why it sits in its own block. */}
      <WorkQueue counts={worklists} />

      {/* Money hero — the two figures owners glance at most. Single column on
          phones: side by side, a 9-digit som figure had ~130px to live in and
          either wrapped mid-number or shrank out of legibility. */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <MoneyCard
          index={0}
          icon="💰"
          label={t('revenue', { period: periodLabel })}
          value={formatSom(stats.tushumTiyin)}
          unit={tCommon('som')}
        />
        <MoneyCard
          index={1}
          href="/debtors"
          icon="🔴"
          label={t('debt')}
          value={formatSom(stats.debtTiyin)}
          unit={tCommon('som')}
          sub={t('debtorCount', { count: stats.debtorCount })}
          negative
        />
      </div>

      {/* Cargo pipeline — the journey China → Tashkent → delivered. */}
      <div className="animate-fade-in-up" style={{ animationDelay: '90ms' }}>
        <SectionCard title={t('cargoFlow')}>
          <div className="flex items-start">
            <PipelineStage
              emoji="📦"
              label={t('inChina')}
              value={stats.chinaReceived}
            />
            <PipelineConnector />
            <PipelineStage
              emoji="🇺🇿"
              label={t('inTashkent')}
              value={stats.tashkentArrived}
            />
            <PipelineConnector />
            <PipelineStage
              emoji="🎉"
              label={t('delivered')}
              value={stats.delivered.count}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5 border-t border-[#eef0f4] pt-2.5 text-[11.5px] text-muted-foreground">
            <span>{t('deliveredTotals')}</span>
            <span className="font-mono font-medium text-foreground">
              {formatKg(stats.delivered.weightGrams)} {tCommon('kg')}
            </span>
            <span>·</span>
            <span className="font-mono font-medium text-foreground">
              {formatSom(stats.delivered.priceTiyin)} {tCommon('som')}
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
                  {t('newCustomers')}
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
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg leading-none"
        aria-hidden
      >
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
    <div className="flex flex-none items-start pt-5" aria-hidden>
      <span className="w-5 border-t-2 border-dotted border-[#c3c9d6] sm:w-8" />
    </div>
  );
}
