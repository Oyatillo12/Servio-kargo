'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MoreHorizontal, Plus, UserPlus, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { can } from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderActions } from '@/components/layout/header-actions';
import { NewCustomerSheet } from '@/features/customers/components/new-customer-button';
import { QuickPaymentSheet } from '@/features/customers/components/quick-payment';

/**
 * The dashboard's primary actions (design 1a/1b).
 *
 * Desktop lays all three out in the title row, weighted: "Add track" is the
 * one filled button, the other two are bordered. On a phone the same three are
 * hoisted into the sticky top bar via `HeaderActions` — the filled action as a
 * single 36px "+" and the rest behind "⋯" — so they stay under the thumb after
 * the admin has scrolled past the work queue, instead of sitting in a title
 * row that is the first thing off screen.
 *
 * "Add track" points at `/import`: tracks enter the system as an Excel or text
 * paste, never one at a time, so a create-one dialog would be a dead end.
 */
export function DashboardActions({ role }: { role: string }) {
  const t = useTranslations('dashboard');
  const [paying, setPaying] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);

  // A warehouse hand takes no cash, creates no customers and runs no imports,
  // so for them this row is empty and the whole control disappears rather than
  // leaving three buttons that answer "you are not allowed to do that".
  const mayPay = can(role, 'payments.record');
  const mayAddCustomer = can(role, 'customers.manage');
  const mayImport = can(role, 'import.run');
  if (!mayPay && !mayAddCustomer && !mayImport) return null;

  return (
    <>
      {/* Desktop: the permitted actions in the page title row */}
      <div className="hidden items-center gap-2 md:flex">
        {mayAddCustomer ? (
          <Button variant="outline" size="xs" onClick={() => setAddingCustomer(true)}>
            {t('actionNewCustomer')}
          </Button>
        ) : null}
        {mayPay ? (
          <Button variant="outline" size="xs" onClick={() => setPaying(true)}>
            {t('actionRecordPayment')}
          </Button>
        ) : null}
        {mayImport ? (
          <Button size="xs" asChild>
            <Link href="/import">
              <Plus strokeWidth={2} aria-hidden />
              {t('actionAddTrack')}
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Mobile: primary + overflow, portalled into the global top bar */}
      <HeaderActions>
        {mayImport ? (
          <Link
            href="/import"
            aria-label={t('actionAddTrack')}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white transition-colors active:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </Link>
        ) : null}

        {mayPay || mayAddCustomer ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('actionsMore')}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {mayPay ? (
                <DropdownMenuItem onSelect={() => setPaying(true)}>
                  <Wallet aria-hidden />
                  {t('actionRecordPayment')}
                </DropdownMenuItem>
              ) : null}
              {mayAddCustomer ? (
                <DropdownMenuItem onSelect={() => setAddingCustomer(true)}>
                  <UserPlus aria-hidden />
                  {t('actionNewCustomer')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </HeaderActions>

      {mayPay ? (
        <QuickPaymentSheet open={paying} onOpenChange={setPaying} />
      ) : null}
      {mayAddCustomer ? (
        <NewCustomerSheet open={addingCustomer} onOpenChange={setAddingCustomer} />
      ) : null}
    </>
  );
}
