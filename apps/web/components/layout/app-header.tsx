'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { KeyRound, LogOut, Megaphone, Search, Settings, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { can } from '@kargotrack/shared';

import { BrandMark } from '@/components/layout/brand';
import { ChangePasswordDialog } from '@/features/team/components/change-password-dialog';
import { HeaderActionsOutlet } from '@/components/layout/header-actions';
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
  /** Translated role name — shown next to the identity in the account menu. */
  roleLabel: string;
  /** Full name, else phone. Bot-linked warehouse staff may have neither yet. */
  identity: string;
  /** Drives which shortcuts the account menu offers. */
  role: string;
}

/**
 * Global top bar (design screens 1a / 1b): 52px, white, one hairline rule,
 * spanning the full width above both the sidebar and the content.
 *
 * Product identity on the left, tenant name after a divider — an admin who runs
 * two cargo companies from one browser needs to see which one they are in
 * before they touch anything. Search in the middle because it is the single
 * most-used control in the panel. Account on the right.
 */
export function AppHeader({
  tenantName,
  roleLabel,
  identity,
  role,
}: AppHeaderProps) {
  const initial = tenantName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <header className="sticky top-0 z-30 flex h-[52px] flex-none items-center gap-3 border-b border-n-200 bg-surface px-4 md:px-5">
      <HomeLink tenantName={tenantName} />

      <HeaderSearch />

      <div className="flex flex-none items-center gap-1">
        <HeaderActionsOutlet />
        <AccountMenu
          initial={initial}
          tenantName={tenantName}
          roleLabel={roleLabel}
          identity={identity}
          role={role}
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
      className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t('home')}
    >
      <BrandMark className="h-[22px] w-[22px] flex-none rounded-[5px]" />
      <span className="hidden font-display text-body font-semibold uppercase tracking-[0.06em] text-ink md:inline">
        SERVIO Kargo
      </span>
      <span
        aria-hidden
        className="hidden h-4 w-px flex-none bg-n-200 md:inline-block"
      />
      <span className="truncate text-body font-semibold text-ink md:font-normal md:text-muted-foreground">
        {tenantName}
      </span>
    </Link>
  );
}

/**
 * Track-code / customer search, the action admins reach for most often.
 * Submits straight to the tracks list, which owns the query (`?q=`), so no
 * client-side fetching is involved. A centred 440px field on desktop; on
 * phones an icon that opens a dialog, because the bar also carries the page's
 * primary actions there and an always-visible input would crowd them out.
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
      <form
        action="/tracks"
        className="relative hidden w-full max-w-[440px] md:mx-auto md:block"
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <Input
          ref={desktopInput}
          name="q"
          type="search"
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          className="h-[34px] rounded-md bg-surface-alt pl-9 pr-9 text-small"
        />
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-sm border border-rule bg-surface px-1.5 font-mono text-micro font-medium text-faint lg:block"
        >
          /
        </kbd>
      </form>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('searchLabel')}
        className="ml-auto flex h-9 w-9 flex-none items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Search className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
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
  identity,
  role,
}: {
  initial: string;
  tenantName: string;
  roleLabel: string;
  identity: string;
  role: string;
}) {
  const t = useTranslations('nav');
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Same rule as the nav rail: a shortcut to a screen this role cannot open is
  // a dead end, so it is dropped rather than disabled.
  const shortcuts = [
    { href: '/import', key: 'import', icon: Upload, capability: 'import.run' },
    {
      href: '/broadcast',
      key: 'broadcast',
      icon: Megaphone,
      capability: 'broadcast.send',
    },
    {
      href: '/settings',
      key: 'settings',
      icon: Settings,
      capability: 'settings.manage',
    },
  ] as const;
  const visible = shortcuts.filter((s) => can(role, s.capability));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('account')}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-input bg-surface-alt text-micro font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {initial}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate text-small font-semibold text-foreground">
              {tenantName}
            </p>
            <p className="truncate text-micro font-normal text-muted-foreground">
              {roleLabel}
              {identity ? ` · ${identity}` : null}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {visible.map((s) => {
            const Icon = s.icon;
            return (
              <DropdownMenuItem key={s.href} asChild>
                <Link href={s.href}>
                  <Icon aria-hidden />
                  {t(s.key)}
                </Link>
              </DropdownMenuItem>
            );
          })}
          {visible.length > 0 ? <DropdownMenuSeparator /> : null}
          {/* Every role can change their own password — it is the one account
              control that must never depend on asking someone else. */}
          <DropdownMenuItem
            onSelect={(e) => {
              // Let the menu close first; the dialog owns focus afterwards.
              e.preventDefault();
              setPasswordOpen(true);
            }}
          >
            <KeyRound aria-hidden />
            {t('changePassword')}
          </DropdownMenuItem>
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

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}
