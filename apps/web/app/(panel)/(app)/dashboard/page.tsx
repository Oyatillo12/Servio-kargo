import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { DASHBOARD_PERIODS, can } from '@kargotrack/shared';
import type { DashboardPeriod } from '@kargotrack/shared';

import { cn } from '@/lib/utils';
import { PanelSection, SectionStack } from '@/components/ui/panel-section';
import { requireAdmin } from '@/lib/auth';
import {
  countBlockedCustomers,
  countOpenTickets,
  getCashByStaff,
  getDailyTushum,
  getDashboardStats,
  getWorklistCounts,
  type CashByStaffRow,
} from '@/lib/queries';
import { CargoFlow } from '@/features/dashboard/components/cargo-flow';
import { CashByStaff } from '@/features/dashboard/components/cash-by-staff';
import { DashboardActions } from '@/features/dashboard/components/dashboard-actions';
import { MoneyBlock } from '@/features/dashboard/components/money-block';
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
  const { tenant, role } = await requireAdmin();
  const t = await getTranslations('dashboard');

  const period: DashboardPeriod = isPeriod(searchParams.p)
    ? searchParams.p
    : 'today';

  // The dashboard is the one screen every role lands on, so the money half is
  // gated rather than the page. A warehouse hand still gets the work queue and
  // the cargo flow — the two blocks that describe their actual job — and the
  // 14-day payment scan behind the chart is not even run for them.
  const showMoney = can(role, 'money.reports');

  // Cash-by-employee is the owner's closing-the-day read, not a manager's:
  // seeing colleagues' takings is a different decision from seeing the total.
  const showCashByStaff = can(role, 'team.manage');

  // The ticket queue is office work (SPEC §5.16) — no count for roles that
  // cannot open /tickets anyway.
  const showTickets = can(role, 'tickets.handle');

  const [stats, worklists, tushum, cashByStaff, openTickets, blockedCustomers] =
    await Promise.all([
      getDashboardStats(tenant.id, period),
      getWorklistCounts(tenant.id),
      showMoney ? getDailyTushum(tenant.id) : Promise.resolve([]),
      showCashByStaff
        ? getCashByStaff(tenant.id, period)
        : Promise.resolve<CashByStaffRow[]>([]),
      showTickets ? countOpenTickets(tenant.id) : Promise.resolve(0),
      countBlockedCustomers(tenant.id),
    ]);

  const periodLabel = t(PERIOD_KEY[period]);

  return (
    <>
      {/* Title row: period on the left with the heading it qualifies, actions
          right. On phones the actions live in the top bar instead — see
          `DashboardActions` — so this row stays a title and a toggle. */}
      <div className="mb-3 flex items-center gap-3 md:mb-4">
        <h1 className="min-w-0 flex-none text-title font-semibold text-foreground">
          {t('pageTitle')}
        </h1>
        <PeriodToggle current={period} />
        <div className="ms-auto">
          <DashboardActions role={role} />
        </div>
      </div>

      {/* Six columns so both desktop rows (4+2 and 4+2) land on the same grid;
          a plain stack of full-bleed sections on phones. */}
      <SectionStack className="md:grid md:grid-cols-6 md:items-start">
        <WorkQueue counts={worklists} />

        {showMoney ? (
          <MoneyBlock
            revenueTiyin={stats.tushumTiyin}
            periodLabel={periodLabel}
            debtTiyin={stats.debtTiyin}
            debtorCount={stats.debtorCount}
          />
        ) : null}

        <CargoFlow
          inChina={stats.chinaReceived}
          inTashkent={stats.tashkentArrived}
          delivered={stats.delivered.count}
          deliveredWeightGrams={stats.delivered.weightGrams}
          deliveredPriceTiyin={stats.delivered.priceTiyin}
        />

        {/* Undelivered messages (tasks.md A3): the number that used to be
            invisible — a blocked bot silently dropped the notify and the panel
            still looked like the customer was told. Ops, not money, so every
            role sees it. Amber only when non-zero: zero is the normal state. */}
        <StatTile
          label={t('undeliveredMessages')}
          sublabel={periodLabel}
          value={stats.undeliveredMessages}
          alert={stats.undeliveredMessages > 0}
          className="md:col-span-2"
        />

        {/* Blocked the bot (tasks.md K3, §7.17): current, not period-scoped —
            a block from last month still costs you today's notification. Links
            into the /customers filter so the next question ("who?") is one tap
            away, which is the whole reason to show a count. */}
        <Link href="/customers?blocked=1" className="md:col-span-2">
          <StatTile
            label={t('blockedCustomers')}
            sublabel={t('blockedCustomersHint')}
            value={blockedCustomers}
            alert={blockedCustomers > 0}
            className="h-full transition-shadow hover:shadow-sm"
          />
        </Link>

        {/* Open tickets (tasks.md H4): the dispute queue, NOT period-scoped —
            an unanswered complaint from last week is still today's problem.
            The whole tile links into §5.16's default (active) view. */}
        {showTickets ? (
          <Link href="/tickets" className="md:col-span-2">
            <StatTile
              label={t('openTickets')}
              sublabel={t('openTicketsHint')}
              value={openTickets}
              alert={openTickets > 0}
              className="h-full transition-shadow hover:shadow-sm"
            />
          </Link>
        ) : null}

        {/* Ahead of the chart on phones — one number is cheaper to read than a
            14-day bar chart, and the chart is the natural end of the screen.
            `md:order-last` puts it back on the chart's right on desktop. */}
        <StatTile
          label={t('newCustomers')}
          sublabel={periodLabel}
          value={stats.newCustomers}
          className="md:order-last md:col-span-2 md:self-stretch"
        />

        {showCashByStaff ? (
          <CashByStaff rows={cashByStaff} periodLabel={periodLabel} />
        ) : null}

        {showMoney ? <TushumChart points={tushum} /> : null}
      </SectionStack>
    </>
  );
}

/** One-number stat card (new customers, undelivered messages). */
function StatTile({
  label,
  sublabel,
  value,
  alert,
  className,
}: {
  label: string;
  sublabel: string;
  value: number;
  alert?: boolean;
  className?: string;
}) {
  return (
    <PanelSection flush className={className}>
      <div className="flex h-full items-center gap-3 px-4 py-3 md:py-4">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-foreground">
            {label}
          </span>
          <span className="block truncate text-small text-faint">
            {sublabel}
          </span>
        </span>
        <span
          className={cn(
            'flex-none text-lead font-semibold md:text-display',
            value > 0 ? (alert ? 'text-warning' : 'text-foreground') : 'text-faint',
          )}
        >
          {value}
        </span>
      </div>
    </PanelSection>
  );
}

/** Period segmented control (SPEC §5.10): one bordered box, no gaps. */
async function PeriodToggle({ current }: { current: DashboardPeriod }) {
  const t = await getTranslations('dashboard');

  return (
    <div
      role="tablist"
      className="flex flex-none overflow-hidden rounded-md border border-input bg-surface"
    >
      {DASHBOARD_PERIODS.map((p, i) => {
        const active = p === current;
        return (
          <Link
            key={p}
            role="tab"
            aria-selected={active}
            href={p === 'today' ? '/dashboard' : `/dashboard?p=${p}`}
            className={cn(
              'px-2.5 py-1.5 text-small transition-colors md:px-3',
              i > 0 && 'border-s border-n-200',
              active
                ? 'bg-primary font-semibold text-white'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {t(PERIOD_KEY[p])}
          </Link>
        );
      })}
    </div>
  );
}
