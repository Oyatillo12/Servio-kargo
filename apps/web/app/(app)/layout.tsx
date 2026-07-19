import type { ReactNode } from 'react';

import { requireAdmin } from '@/lib/auth';
import { logoutAction } from '@/app/login/actions';

import { NavLink } from './nav-link';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { admin, tenant } = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              {tenant.name}
            </p>
            <p className="truncate text-xs text-slate-500">{admin.phone}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Chiqish
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-2 pb-1">
          <NavLink href="/tracks">Treklar</NavLink>
          <NavLink href="/customers">Mijozlar</NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
    </div>
  );
}
