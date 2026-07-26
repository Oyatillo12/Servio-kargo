'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LogOut, Megaphone, Search, Settings, Upload } from 'lucide-react';

import { BrandMark } from '@/components/brand';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { logoutAction } from '@/app/login/actions';

export interface AppHeaderProps {
  tenantName: string;
  /** "Egasi" / "Xodim" — shown next to the phone in the account menu. */
  roleLabel: string;
  phone: string;
}

/**
 * Global top bar, rendered on every panel screen (both breakpoints).
 *
 * Desktop previously had no header at all — the sidebar carried the brand and
 * the account block, and there was nowhere to put global actions. It now holds
 * the tenant identity on the left and the primary actions on the right; the
 * account block moved out of the sidebar footer into the avatar menu so it is
 * stated once.
 *
 * Mobile keeps the same bar with the square brand mark in front of the tenant
 * name. The section title used to live here, which duplicated the `PageHeader`
 * <h1> a few pixels below it — the brand takes that slot instead.
 */
export function AppHeader({ tenantName, roleLabel, phone }: AppHeaderProps) {
  const initial = tenantName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <header className="sticky top-0 z-20 flex h-14 flex-none items-center gap-2 border-b border-border bg-white px-4 md:px-6">
      <Link
        href="/dashboard"
        className="flex min-w-0 items-center gap-2.5"
        aria-label="Bosh sahifa"
      >
        <BrandMark className="h-7 w-7 flex-none md:hidden" />
        <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
          {tenantName}
        </span>
      </Link>

      <div className="ml-auto flex flex-none items-center gap-1.5">
        <HeaderSearch />
        <AccountMenu
          initial={initial}
          tenantName={tenantName}
          roleLabel={roleLabel}
          phone={phone}
        />
      </div>
    </header>
  );
}

/**
 * Track-code / customer search, the action admins reach for most often.
 * Submits straight to the tracks list, which owns the query (`?q=`), so no
 * client-side fetching is involved. Inline on desktop, dialog on mobile where
 * an always-visible input would eat the whole bar.
 */
function HeaderSearch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <form action="/tracks" className="relative hidden md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          name="q"
          type="search"
          placeholder="Trek kodi yoki mijoz"
          aria-label="Trek kodi yoki mijoz qidirish"
          className="h-9 w-64 bg-[#f7f8fa] pl-9 text-sm"
        />
      </form>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Qidirish"
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-secondary md:hidden"
      >
        <Search className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 translate-y-0">
          <DialogHeader>
            <DialogTitle>Qidirish</DialogTitle>
          </DialogHeader>
          <form action="/tracks" onSubmit={() => setOpen(false)}>
            <Input
              name="q"
              type="search"
              autoFocus
              placeholder="Trek kodi yoki mijoz"
              aria-label="Trek kodi yoki mijoz qidirish"
              className="bg-[#f7f8fa]"
            />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Avatar → account menu: who you are, the two setup screens, and logout. */
function AccountMenu({
  initial,
  tenantName,
  roleLabel,
  phone,
}: {
  initial: string;
  tenantName: string;
  roleLabel: string;
  phone: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Hisob"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-primary outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <p className="truncate text-[13px] font-semibold text-foreground">
            {tenantName}
          </p>
          <p className="truncate text-[11px] font-normal text-muted-foreground">
            {roleLabel} · {phone}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/import">
            <Upload />
            Import
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/broadcast">
            <Megaphone />
            Xabarnoma
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Sozlamalar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="text-destructive">
              <LogOut />
              Chiqish
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
