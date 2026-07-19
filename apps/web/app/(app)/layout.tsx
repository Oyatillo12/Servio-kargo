import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';

import { requireAdmin } from '@/lib/auth';
import { listDebtors } from '@/lib/queries';
import { logoutAction } from '@/app/login/actions';
import { RouteDots, Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';

import { SidebarNav, BottomNav, MobileTitle } from './nav-link';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { admin, tenant } = await requireAdmin();

  const initial = tenant.name.trim().charAt(0).toUpperCase() || 'K';
  const roleLabel = admin.role === 'owner' ? 'Egasi' : 'Xodim';

  // Pending-debtor count for the "Ko'proq" badge (Qarzdorlar lives in the sheet).
  const debtorCount = (await listDebtors(tenant.id)).length;

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
        <div className="mt-auto border-t border-border pt-3">
          <div className="flex items-center gap-2.5 px-1.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {tenant.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {roleLabel} · {admin.phone}
              </p>
            </div>
          </div>
          <form action={logoutAction} className="mt-2">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start px-1.5 text-slate-500"
            >
              <LogOut className="h-4 w-4" />
              Chiqish
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-4 py-2.5 md:hidden">
          <MobileTitle fallback={tenant.name} />
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Chiqish"
              className="rounded-lg p-2 text-slate-500 hover:bg-secondary"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </header>

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
