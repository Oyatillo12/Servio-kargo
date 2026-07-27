'use client';

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

import { navFor, type NavItem } from './nav-items';
import { useIsActive } from './nav-active';

/**
 * Desktop navigation rail (design screen 1a/2a): 184px wide, white, one 34px
 * row per section, the current one filled `accent` with indigo text.
 *
 * Built on shadcn's `Sidebar` so it can collapse to icons (⌘/Ctrl+B, the rail,
 * or the footer button) — a warehouse laptop at 1280px gains back ~130px of
 * table width, and the choice sticks via the `sidebar_state` cookie. Phones
 * never see it: navigation there is the bottom tab bar, so this is `md:` only
 * and no trigger opens the mobile sheet variant.
 *
 * It sits *below* the top bar rather than beside it, hence the 52px offset —
 * the tenant identity and search stay stated once, across the full width.
 *
 * `role` filters the rows: a warehouse hand's rail is four entries, not nine
 * with five dead ends. The pages behind them guard themselves regardless.
 */
export function AppSidebar({ role }: { role: string }) {
  return (
    <Sidebar
      collapsible="icon"
      className="top-[52px] !h-[calc(100svh-52px)] border-n-200"
    >
      <SidebarContent className="px-2 py-3">
        <SidebarMenu className="gap-0.5">
          {navFor(role).map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <CollapseButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const t = useTranslations('nav');
  const active = useIsActive(item.href);
  const Icon = item.icon;
  const label = t(item.key);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
        className={cn(
          'h-[34px] rounded-md px-2.5 text-[13px] font-medium text-muted-foreground',
          'hover:bg-secondary hover:text-foreground',
          'data-[active=true]:bg-accent data-[active=true]:font-semibold data-[active=true]:text-primary',
        )}
      >
        <Link href={item.href} aria-current={active ? 'page' : undefined}>
          <Icon strokeWidth={1.5} aria-hidden />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Explicit collapse control — the rail alone is not a discoverable affordance. */
function CollapseButton() {
  const t = useTranslations('nav');
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title={collapsed ? t('sidebarExpand') : t('sidebarCollapse')}
      aria-label={collapsed ? t('sidebarExpand') : t('sidebarCollapse')}
      className={cn(
        'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-faint transition-colors',
        'hover:bg-secondary hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <Icon className="h-4 w-4 flex-none" strokeWidth={1.5} aria-hidden />
      <span className="truncate group-data-[collapsible=icon]:hidden">
        {t('sidebarCollapse')}
      </span>
    </button>
  );
}
