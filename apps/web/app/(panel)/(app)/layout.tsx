import type { CSSProperties, ReactNode } from 'react';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import { can } from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { countDebtors } from '@/lib/queries';
import { AppHeader } from '@/components/layout/app-header';
import { BillingBanner } from '@/components/layout/billing-banner';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

/** Written by shadcn's `SidebarProvider` so the rail's state survives reloads. */
const SIDEBAR_COOKIE = 'sidebar_state';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { admin, tenant, role } = await requireAdmin();
  const t = await getTranslations('roles');

  // Pending-debtor count for the "more" badge (Debtors lives in the sheet).
  // This runs on EVERY page load, so it must stay a single aggregate — it used
  // to call `listDebtors`, which drags the tenant's whole track + payment table
  // into Node just to take `.length` (AUDIT.md T6). Skipped entirely for roles
  // that cannot open /debtors — a badge pointing at a hidden screen is noise,
  // and this is the layout, so it is a query on every single page load.
  const debtorCount = can(role, 'money.reports')
    ? await countDebtors(tenant.id)
    : 0;

  // Collapsed is the deliberate choice, so it is the one worth remembering;
  // a first-time admin gets the labelled rail.
  const sidebarOpen = cookies().get(SIDEBAR_COOKIE)?.value !== 'false';

  return (
    <div className="flex min-h-svh flex-col">
      {/* Full-width top bar, above both the rail and the content (design 1a) */}
      <AppHeader
        tenantName={tenant.name}
        roleLabel={t(role)}
        // Identity line in the account menu: the name if we have one, else the
        // phone. A bot-linked warehouse hand may have neither yet.
        identity={admin.fullName ?? admin.phone ?? ''}
        role={role}
      />

      {/* §5.17: the subscription warning, above everything and undismissable */}
      <BillingBanner paidUntil={tenant.paidUntil} />

      <SidebarProvider
        defaultOpen={sidebarOpen}
        className="min-h-0 flex-1"
        style={
          {
            '--sidebar-width': '184px',
            '--sidebar-width-icon': '52px',
          } as CSSProperties
        }
      >
        <AppSidebar role={role} />

        {/* White on phones so the full-bleed sections read as one sheet and
            only the 8px `SectionStack` gaps show grey; the canvas returns at
            `md`, where content is cards floating on it. */}
        <SidebarInset className="min-w-0 bg-white md:bg-background">
          <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-6 md:py-5">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Mobile tab bar — in flow, so it never covers the last row of a list */}
      <div className="sticky bottom-0 z-20 md:hidden">
        <BottomNav moreBadge={debtorCount} role={role} />
      </div>
    </div>
  );
}
