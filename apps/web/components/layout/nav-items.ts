import {
  Import,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * The panel's navigation map — one place, consumed by the desktop sidebar, the
 * mobile tab bar and the "more" sheet. `key` indexes the `nav` message
 * namespace; nothing here holds a literal label (CLAUDE.md rule 5).
 */
export interface NavItem {
  href: string;
  /** Key inside the `nav` translation namespace. */
  key: string;
  icon: LucideIcon;
}

/** Full navigation, in display order — drives the desktop sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/tracks', key: 'tracks', icon: Package },
  { href: '/customers', key: 'customers', icon: Users },
  { href: '/debtors', key: 'debtors', icon: Wallet },
  { href: '/batches', key: 'batches', icon: Truck },
  { href: '/import', key: 'import', icon: Import },
  { href: '/broadcast', key: 'broadcast', icon: Megaphone },
  { href: '/settings', key: 'settings', icon: Settings },
];

/**
 * Mobile split (design decision): four daily-primary tabs live in the bar, the
 * rest move into the "more" bottom-sheet so labels stay readable and tappable.
 */
export const PRIMARY_NAV: NavItem[] = NAV_ITEMS.filter((i) =>
  ['/dashboard', '/tracks', '/customers', '/import'].includes(i.href),
);

export const SECONDARY_NAV: NavItem[] = NAV_ITEMS.filter(
  (i) => !PRIMARY_NAV.includes(i),
);
