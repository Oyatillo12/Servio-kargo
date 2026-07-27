'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Megaphone, Search, Settings, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BrandMark } from '@/components/layout/brand';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
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
import { logoutAction } from '@/features/auth/actions';

export interface AppHeaderProps {
  tenantName: string;
  /** Translated "owner" / "staff" — shown next to the phone in the account menu. */
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
    <header className="sticky top-0 z-20 flex h-14 flex-none items-center gap-2 border-b border-border bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:px-6">
      <HomeLink tenantName={tenantName} />

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

function HomeLink({ tenantName }: { tenantName: string }) {
  const t = useTranslations('nav');
  return (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t('home')}
    >
      <BrandMark className="h-7 w-7 flex-none md:hidden" />
      <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
        {tenantName}
      </span>
    </Link>
  );
}

/**
 * Track-code / customer search, the action admins reach for most often.
 * Submits straight to the tracks list, which owns the query (`?q=`), so no
 * client-side fetching is involved. Inline on desktop, dialog on mobile where
 * an always-visible input would eat the whole bar.
 *
 * `/` focuses it from anywhere. Warehouse staff work a barcode scanner in one
 * hand: the scanner types the code and presses Enter, and without a focus
 * shortcut every scan needed a mouse trip to the input first.
 */
function HeaderSearch() {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const desktopInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      // Never steal the key from something the admin is already typing into.
      if (
        el?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName ?? '')
      ) {
        return;
      }
      e.preventDefault();
      // `offsetParent === null` means the desktop field is display:none — i.e.
      // we are at a mobile breakpoint, where the dialog is the only search UI.
      if (desktopInput.current && desktopInput.current.offsetParent !== null) {
        desktopInput.current.focus();
      } else {
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <form action="/tracks" className="relative hidden md:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          ref={desktopInput}
          name="q"
          type="search"
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          className="h-9 w-64 bg-[#f7f8fa] pl-9 pr-8 text-sm"
        />
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-white px-1.5 font-mono text-[10px] font-medium text-muted-foreground lg:block"
        >
          /
        </kbd>
      </form>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('searchLabel')}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Search className="h-5 w-5" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 translate-y-0">
          <DialogHeader>
            <DialogTitle>{t('searchLabel')}</DialogTitle>
          </DialogHeader>
          <form action="/tracks" onSubmit={() => setOpen(false)}>
            <Input
              name="q"
              type="search"
              autoFocus
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchLabel')}
              className="bg-[#f7f8fa]"
            />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Avatar → account menu: who you are, language, the setup screens, logout. */
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
  const t = useTranslations('nav');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('account')}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-primary outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
            <Upload aria-hidden />
            {t('import')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/broadcast">
            <Megaphone aria-hidden />
            {t('broadcast')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden />
            {t('settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <LocaleSwitcher />
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-destructive">
              <LogOut aria-hidden />
              {t('logout')}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
