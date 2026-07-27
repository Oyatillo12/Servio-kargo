import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { requireAdmin } from '@/lib/auth';
import { countDebtors } from '@/lib/queries';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RouteDots, Wordmark } from '@/components/layout/brand';
import { SidebarNav } from '@/components/layout/sidebar-nav';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { admin, tenant } = await requireAdmin();
  const t = await getTranslations('auth');

  const roleLabel = admin.role === 'owner' ? t('roleOwner') : t('roleStaff');

  // Pending-debtor count for the "more" badge (Debtors lives in the sheet).
  // This runs on EVERY page load, so it must stay a single aggregate — it used
  // to call `listDebtors`, which drags the tenant's whole track + payment table
  // into Node just to take `.length` (AUDIT.md T6).
  const debtorCount = await countDebtors(tenant.id);

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar (design screen 14) */}
      <aside className="sticky top-0 hidden h-screen w-[216px] shrink-0 flex-col border-r border-border bg-white px-3 py-4 md:flex">
        <div className="px-2.5">
          <Wordmark />
          <RouteDots className="mt-2 scale-[0.8] origin-left" />
        </div>
        <div className="mt-5 flex-1">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Top bar — both breakpoints (brand, search, account menu) */}
        <AppHeader
          tenantName={tenant.name}
          roleLabel={roleLabel}
          phone={admin.phone}
        />

        <main className="flex-1 px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>

        {/* Mobile bottom tab bar */}
        <div className="sticky bottom-0 z-10 md:hidden">
          <BottomNav moreBadge={debtorCount} />
        </div>
      </div>
    </div>
  );
}
