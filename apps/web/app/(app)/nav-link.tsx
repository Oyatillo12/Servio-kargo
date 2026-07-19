'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Users,
  Import,
  Wallet,
  Truck,
  Megaphone,
  Settings,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Full navigation, in display order — drives the desktop sidebar. */
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
  { href: '/tracks', label: 'Treklar', icon: Package },
  { href: '/customers', label: 'Mijozlar', icon: Users },
  { href: '/debtors', label: 'Qarzdorlar', icon: Wallet },
  { href: '/batches', label: 'Reyslar', icon: Truck },
  { href: '/import', label: 'Import', icon: Import },
  { href: '/broadcast', label: 'Xabarnoma', icon: Megaphone },
  { href: '/settings', label: 'Sozlamalar', icon: Settings },
];

/**
 * Mobile split (design decision): four daily-primary tabs live in the bar, the
 * rest move into the "Ko'proq" bottom-sheet so labels stay readable and tappable.
 */
const PRIMARY: NavItem[] = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
  { href: '/tracks', label: 'Treklar', icon: Package },
  { href: '/customers', label: 'Mijozlar', icon: Users },
  { href: '/import', label: 'Import', icon: Import },
];
const SECONDARY: NavItem[] = [
  { href: '/debtors', label: 'Qarzdorlar', icon: Wallet },
  { href: '/batches', label: 'Reyslar', icon: Truck },
  { href: '/broadcast', label: 'Xabarnoma', icon: Megaphone },
  { href: '/settings', label: 'Sozlamalar', icon: Settings },
];

function useActive(href: string) {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Mobile top-bar title: shows the current section's label (falls back to the
 * tenant name) so users have context beyond the small bottom-tab label.
 */
export function MobileTitle({ fallback }: { fallback: string }) {
  const pathname = usePathname();
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return (
    <span className="truncate text-base font-bold tracking-tight text-foreground">
      {match ? match.label : fallback}
    </span>
  );
}

/** Desktop sidebar navigation (design screen 14). */
export function SidebarNav() {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <SidebarLink key={item.href} item={item} />
      ))}
    </nav>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  const active = useActive(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-accent font-semibold text-primary'
          : 'text-slate-500 hover:bg-secondary hover:text-foreground',
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      {item.label}
    </Link>
  );
}

/**
 * Mobile bottom tab bar (design screen 02): four primary tabs + a "Ko'proq"
 * button that opens the secondary items in a bottom-sheet. `moreBadge` shows a
 * count dot on Ko'proq (e.g. pending debtors, which live in the sheet).
 */
export function BottomNav({ moreBadge = 0 }: { moreBadge?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const moreActive = SECONDARY.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <>
      <nav className="flex border-t border-border bg-white px-1 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1">
        {PRIMARY.map((item) => (
          <BottomLink key={item.href} item={item} />
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ko'proq"
          className="relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors"
        >
          <span
            className={cn(
              'absolute top-0 h-[3px] w-8 rounded-full bg-primary transition-opacity',
              moreActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span className="relative">
            <MoreHorizontal
              className={cn(
                'h-[22px] w-[22px]',
                moreActive ? 'text-primary' : 'text-slate-400',
              )}
              strokeWidth={1.8}
            />
            {moreBadge > 0 ? (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
                {moreBadge > 99 ? '99+' : moreBadge}
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              'text-[11px]',
              moreActive
                ? 'font-bold text-primary'
                : 'font-medium text-slate-500',
            )}
          >
            Ko&apos;proq
          </span>
        </button>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <SheetHeader>
            <SheetTitle>Ko&apos;proq</SheetTitle>
          </SheetHeader>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {SECONDARY.map((item) => (
              <MoreLink
                key={item.href}
                item={item}
                badge={item.href === '/debtors' ? moreBadge : 0}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function BottomLink({ item }: { item: NavItem }) {
  const active = useActive(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors"
    >
      <span
        className={cn(
          'absolute top-0 h-[3px] w-8 rounded-full bg-primary transition-opacity',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Icon
        className={cn('h-[22px] w-[22px]', active ? 'text-primary' : 'text-slate-400')}
        strokeWidth={1.8}
      />
      <span
        className={cn(
          'text-[11px]',
          active ? 'font-bold text-primary' : 'font-medium text-slate-500',
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

function MoreLink({
  item,
  badge,
  onNavigate,
}: {
  item: NavItem;
  badge: number;
  onNavigate: () => void;
}) {
  const active = useActive(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
        active
          ? 'border-transparent bg-accent text-primary'
          : 'border-border bg-white text-foreground hover:bg-secondary',
      )}
    >
      <Icon
        className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-slate-500')}
        strokeWidth={1.8}
      />
      <span className="flex-1 text-sm font-semibold">{item.label}</span>
      {badge > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-none text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  );
}
