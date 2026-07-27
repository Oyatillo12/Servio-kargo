'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { NAV_ITEMS, type NavItem } from './nav-items';

/** True when `href` is the current section (the route itself or a child of it). */
export function useIsActive(href: string): boolean {
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
  const t = useTranslations('nav');
  const active = useIsActive(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        active
          ? 'bg-accent font-semibold text-primary'
          : 'text-slate-500 hover:bg-secondary hover:text-foreground',
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
      {t(item.key)}
    </Link>
  );
}
