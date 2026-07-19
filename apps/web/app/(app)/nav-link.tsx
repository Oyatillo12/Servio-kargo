'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  Wallet,
  Import,
  Truck,
  Megaphone,
  Settings,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

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

function useActive(href: string) {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(`${href}/`);
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

/** Mobile bottom tab bar (design screen 02). */
export function BottomNav() {
  return (
    <nav className="flex border-t border-border bg-white px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5">
      {NAV_ITEMS.map((item) => (
        <BottomLink key={item.href} item={item} />
      ))}
    </nav>
  );
}

function BottomLink({ item }: { item: NavItem }) {
  const active = useActive(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex flex-1 flex-col items-center gap-1 py-0.5"
    >
      <Icon
        className={cn('h-5 w-5', active ? 'text-primary' : 'text-slate-400')}
        strokeWidth={1.8}
      />
      <span
        className={cn(
          'text-[10px]',
          active ? 'font-bold text-primary' : 'font-medium text-slate-500',
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}
