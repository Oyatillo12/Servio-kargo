'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { primaryNavFor, secondaryNavFor, type NavItem } from './nav-items';
import { useIsActive } from './nav-active';

/** Red count bubble reused by the tab bar and the sheet rows. */
function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-sm bg-destructive px-1 font-bold leading-none text-destructive-foreground',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Mobile bottom tab bar (design screen 1b): five 60px tabs on white above one
 * hairline rule. The current tab is stated by indigo icon + label alone —
 * the design has no pill, underline or fill down here, because the bar sits
 * over scrolling content and any filled shape competes with the page.
 *
 * Four primary sections plus "more", which opens the rest in a bottom sheet;
 * `moreBadge` carries the pending-debtor count, since Debtors lives in there.
 *
 * Both halves are filtered by `role`. When a role reaches nothing outside the
 * bar — a warehouse hand does not — "more" is dropped rather than opening an
 * empty sheet.
 */
export function BottomNav({
  moreBadge = 0,
  role,
}: {
  moreBadge?: number;
  role: string;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const primary = primaryNavFor(role);
  const secondary = secondaryNavFor(role);

  const moreActive = secondary.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <>
      <nav className="flex h-[60px] border-t border-n-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {primary.map((item) => (
          <BottomLink key={item.href} item={item} />
        ))}
        {secondary.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('more')}
            aria-expanded={open}
            className={cn(tabClass, moreActive ? activeClass : idleClass)}
          >
            <span className="relative">
              <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
              <CountBadge
                count={moreBadge}
                className="absolute -right-2 -top-1.5 h-4 min-w-4 text-micro"
              />
            </span>
            {t('more')}
          </button>
        ) : null}
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="pb-[max(env(safe-area-inset-bottom),1.25rem)]"
        >
          <SheetHeader>
            <SheetTitle>{t('more')}</SheetTitle>
          </SheetHeader>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {secondary.map((item) => (
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

const tabClass =
  'flex flex-1 flex-col items-center justify-center gap-[3px] text-micro transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
const activeClass = 'font-semibold text-signal';
const idleClass = 'font-medium text-muted-foreground active:text-foreground';

function BottomLink({ item }: { item: NavItem }) {
  const t = useTranslations('nav');
  const active = useIsActive(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(tabClass, active ? activeClass : idleClass)}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
      {t(item.key)}
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
  const t = useTranslations('nav');
  const active = useIsActive(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[52px] items-center gap-3 rounded-sm border px-3.5 py-3 transition-colors',
        active
          ? 'border-signal/40 bg-signal-soft text-signal-strong'
          : 'border-input bg-surface text-foreground active:bg-surface-alt',
      )}
    >
      <Icon
        className={cn('h-[18px] w-[18px] shrink-0', !active && 'text-faint')}
        strokeWidth={1.5}
        aria-hidden
      />
      <span className="flex-1 text-body font-medium">{t(item.key)}</span>
      <CountBadge count={badge} className="h-5 min-w-5 px-1.5 text-micro" />
    </Link>
  );
}
