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

import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from './nav-items';
import { useIsActive } from './sidebar-nav';

/** Red count bubble reused by the tab bar and the sheet rows. */
function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-destructive px-1 font-bold leading-none text-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Mobile bottom tab bar (design screen 02): four primary tabs + a "more"
 * button that opens the secondary items in a bottom-sheet. `moreBadge` shows a
 * count dot on the more button (e.g. pending debtors, which live in the sheet).
 */
export function BottomNav({ moreBadge = 0 }: { moreBadge?: number }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const moreActive = SECONDARY_NAV.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <>
      <nav className="flex border-t border-border bg-white px-1 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1">
        {PRIMARY_NAV.map((item) => (
          <BottomLink key={item.href} item={item} />
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('more')}
          aria-expanded={open}
          className="relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              aria-hidden
            />
            <CountBadge
              count={moreBadge}
              className="absolute -right-2 -top-1.5 h-4 min-w-4 text-[10px]"
            />
          </span>
          <span
            className={cn(
              'text-[11px]',
              moreActive
                ? 'font-bold text-primary'
                : 'font-medium text-slate-500',
            )}
          >
            {t('more')}
          </span>
        </button>
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
            {SECONDARY_NAV.map((item) => (
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
  const t = useTranslations('nav');
  const active = useIsActive(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className="relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          'absolute top-0 h-[3px] w-8 rounded-full bg-primary transition-opacity',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Icon
        className={cn(
          'h-[22px] w-[22px]',
          active ? 'text-primary' : 'text-slate-400',
        )}
        strokeWidth={1.8}
        aria-hidden
      />
      <span
        className={cn(
          'text-[11px]',
          active ? 'font-bold text-primary' : 'font-medium text-slate-500',
        )}
      >
        {t(item.key)}
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
  const t = useTranslations('nav');
  const active = useIsActive(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
        active
          ? 'border-transparent bg-accent text-primary'
          : 'border-border bg-white text-foreground hover:bg-secondary',
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 shrink-0',
          active ? 'text-primary' : 'text-slate-500',
        )}
        strokeWidth={1.8}
        aria-hidden
      />
      <span className="flex-1 text-sm font-semibold">{t(item.key)}</span>
      <CountBadge count={badge} className="h-5 min-w-5 px-1.5 text-[11px]" />
    </Link>
  );
}
