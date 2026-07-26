'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  createCustomerAction,
  searchCustomersAction,
} from '@/lib/customer-actions';
import type { CustomerOption } from '@/lib/customer-types';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 250;

function customerLabel(c: CustomerOption): string {
  return c.fullName ?? 'Ismi yo‘q';
}

/**
 * Bottom-sheet customer picker used by every assignment flow (SPEC §5.3, §5.5):
 * search by client_code / name / phone, or create the customer inline when they
 * are not in the system yet. Creating from here matters on day 0 — the admin is
 * looking at an unassigned track and the owner has not opened the bot.
 *
 * Searching runs through a server action (tenant-scoped, capped) and is
 * debounced; the request that returns last is ignored unless it is the newest
 * one, so a slow early keystroke can't overwrite fresher results.
 */
export function CustomerPickerSheet({
  open,
  onOpenChange,
  title,
  hint,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Optional line above the results, e.g. "12 ta trek tanlandi". */
  hint?: React.ReactNode;
  onPick: (customer: CustomerOption) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const requestId = useRef(0);

  const runSearch = useCallback(async (term: string) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const rows = await searchCustomersAction(term);
      if (id !== requestId.current) return; // a newer keystroke already won
      setResults(rows);
    } catch {
      if (id === requestId.current) setResults([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Reset to a clean sheet on every open, then load the most recent customers.
  useEffect(() => {
    if (!open) return;
    setQ('');
    setCreating(false);
    void runSearch('');
  }, [open, runSearch]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void runSearch(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, open, runSearch]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85vh] flex-col gap-3"
        // Keep focus on the trigger: autofocusing the input pops the mobile
        // keyboard over the results the admin is trying to read.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        {hint ? (
          <div className="rounded-lg border border-[#dfe4f2] bg-[#f3f5fb] px-3 py-2.5 text-[13px] text-slate-700">
            {hint}
          </div>
        ) : null}

        {creating ? (
          <CreateCustomerForm
            initialPhone={/\d/.test(q) ? q : ''}
            initialName={/\d/.test(q) ? '' : q}
            onCancel={() => setCreating(false)}
            onCreated={(c) => {
              toast.success(`${c.clientCode} yaratildi`);
              onPick(c);
            }}
          />
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Kod, ism yoki telefon"
                className="bg-[#f7f8fa] pl-9"
                aria-label="Mijoz qidirish"
              />
            </div>

            <div className="-mx-1 min-h-[120px] flex-1 overflow-y-auto px-1">
              {loading && results.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Qidirilmoqda…
                </p>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Mijoz topilmadi.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-xl border border-border">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => onPick(c)}
                        className="flex w-full items-center gap-3 border-b border-[#eef0f4] bg-white px-3 py-2.5 text-left last:border-0 hover:bg-secondary/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold text-foreground">
                            {customerLabel(c)}{' '}
                            <span className="font-mono text-[12px] font-medium text-muted-foreground">
                              {c.clientCode}
                            </span>
                          </p>
                          <p className="truncate font-mono text-[12px] text-muted-foreground">
                            {c.phone ?? '—'}
                          </p>
                        </div>
                        {!c.hasTelegram ? (
                          <span
                            className="flex-none rounded-md bg-[#fdf1e3] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#9a5b12]"
                            title="Mijoz hali botga kirmagan — xabar yuborib bo'lmaydi"
                          >
                            botsiz
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCreating(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Yangi mijoz qo&apos;shish
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Create-a-customer form (SPEC §5.5). Phone is required: it is the only thing
 * the bot can link the person's Telegram account to later (§7.12). A phone that
 * already exists is refused and the existing customer is offered instead.
 */
export function CreateCustomerForm({
  initialPhone = '',
  initialName = '',
  onCancel,
  onCreated,
}: {
  initialPhone?: string;
  initialName?: string;
  onCancel?: () => void;
  onCreated: (customer: CustomerOption) => void;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [fullName, setFullName] = useState(initialName);
  const [duplicate, setDuplicate] = useState<CustomerOption | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setDuplicate(null);
    startTransition(async () => {
      const res = await createCustomerAction({ phone, fullName });
      if (res.duplicate) setDuplicate(res.duplicate);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.customer) onCreated(res.customer);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-customer-phone">Telefon</Label>
        <Input
          id="new-customer-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="+998 90 123 45 67"
          className="font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-customer-name">Ism (ixtiyoriy)</Label>
        <Input
          id="new-customer-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={120}
          placeholder="Ism familiya"
        />
      </div>

      <p className="text-[12px] text-muted-foreground">
        Mijoz kodi avtomatik beriladi. Mijoz botga kirganda shu telefon bo&apos;yicha
        ulanadi — yangi profil ochilmaydi.
      </p>

      {duplicate ? (
        <button
          type="button"
          onClick={() => onCreated(duplicate)}
          className={cn(
            'rounded-lg border border-[#f0d3aa] bg-[#fdf6ec] px-3 py-2.5 text-left text-[13px] text-[#7a4a0d]',
            'hover:bg-[#fbeed9]',
          )}
        >
          <b>{duplicate.clientCode}</b> — {customerLabel(duplicate)} allaqachon
          bor. Shu mijozni tanlash uchun bosing.
        </button>
      ) : null}

      <div className="flex gap-2.5">
        {onCancel ? (
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={isPending}
          >
            Ortga
          </Button>
        ) : null}
        <Button className="flex-1" onClick={submit} disabled={isPending}>
          {isPending ? 'Saqlanmoqda…' : 'Saqlash'}
        </Button>
      </div>
    </div>
  );
}
