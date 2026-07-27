import {
  Import,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  Truck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { can, type Capability } from '@kargotrack/shared';

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
  /**
   * What the destination is for. A role without it never sees the entry —
   * unlike in-page actions, which stay visible but disabled: a nav item leads
   * to a screen that would be entirely empty, and an empty screen explains
   * nothing. `requireCapability` on the page itself is what actually guards it.
   */
  capability: Capability;
}

/** Full navigation, in display order — drives the desktop sidebar. */
export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    key: 'dashboard',
    icon: LayoutDashboard,
    capability: 'tracks.view',
  },
  { href: '/tracks', key: 'tracks', icon: Package, capability: 'tracks.view' },
  {
    href: '/customers',
    key: 'customers',
    icon: Users,
    capability: 'customers.view',
  },
  {
    href: '/debtors',
    key: 'debtors',
    icon: Wallet,
    capability: 'money.reports',
  },
  {
    href: '/batches',
    key: 'batches',
    icon: Truck,
    capability: 'batches.manage',
  },
  { href: '/import', key: 'import', icon: Import, capability: 'import.run' },
  {
    href: '/broadcast',
    key: 'broadcast',
    icon: Megaphone,
    capability: 'broadcast.send',
  },
  {
    href: '/settings/team',
    key: 'team',
    icon: UserCog,
    capability: 'team.manage',
  },
  {
    href: '/settings',
    key: 'settings',
    icon: Settings,
    capability: 'settings.manage',
  },
];

/**
 * Mobile split (design decision): four daily-primary tabs live in the bar, the
 * rest move into the "more" bottom-sheet so labels stay readable and tappable.
 *
 * The four are the same for every role. A warehouse hand loses Import from the
 * bar, leaving three — the bar re-flows rather than back-filling, because a tab
 * that moves position between two accounts on the same phone is worse than a
 * gap.
 */
const PRIMARY_HREFS = ['/dashboard', '/tracks', '/customers', '/import'];

/** The entries `role` may actually reach, in display order. */
export function navFor(role: string | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((i) => can(role, i.capability));
}

export function primaryNavFor(role: string | null | undefined): NavItem[] {
  return navFor(role).filter((i) => PRIMARY_HREFS.includes(i.href));
}

export function secondaryNavFor(role: string | null | undefined): NavItem[] {
  return navFor(role).filter((i) => !PRIMARY_HREFS.includes(i.href));
}
