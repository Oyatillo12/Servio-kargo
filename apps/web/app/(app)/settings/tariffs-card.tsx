'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import {
  createTariffAction,
  deleteTariffAction,
  setDefaultTariffAction,
  setTariffActiveAction,
  updateTariffAction,
} from './actions';

export interface TariffView {
  id: string;
  name: string;
  isDefault: boolean;
  active: boolean;
  /** Formatted price with unit, e.g. "55 000 so'm/kg" or "3.5 $/kg". */
  priceText: string;
  /** Editable raw price (so'm for UZS, dollars for USD). */
  editValue: string;
}

/** Tariflar block (SPEC §5.9): CRUD list with default radio + active toggle. */
export function TariffsCard({
  tariffs,
  unitLabel,
}: {
  tariffs: TariffView[];
  /** "so'm/kg" or "$/kg" depending on currency. */
  unitLabel: string;
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();

  const [editing, setEditing] = useState<TariffView | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>, ok: string) {
    startBusy(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success(ok);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-white p-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-semibold">Tariflar</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAddOpen(true)}
          disabled={busy}
        >
          <Plus className="h-4 w-4" />
          Yangi
        </Button>
      </div>

      {tariffs.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Hali tarif yo&apos;q.</p>
      ) : (
        tariffs.map((tf) => (
          <div
            key={tf.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2.5',
              tf.isDefault ? 'border-primary bg-accent/40' : 'border-border',
              !tf.active && 'opacity-60',
            )}
          >
            {/* Default radio */}
            <button
              type="button"
              aria-label="Asosiy qilish"
              onClick={() =>
                run(() => setDefaultTariffAction(tf.id), 'Asosiy tarif o‘zgardi')
              }
              disabled={busy || tf.isDefault}
              className={cn(
                'flex h-5 w-5 flex-none items-center justify-center rounded-full border-2',
                tf.isDefault
                  ? 'border-primary bg-primary text-white'
                  : 'border-input',
              )}
            >
              {tf.isDefault ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-foreground">
                {tf.name}
                {tf.isDefault ? (
                  <span className="ml-1.5 text-[11px] font-medium text-primary">
                    · asosiy
                  </span>
                ) : null}
              </p>
              <p className="font-mono text-[12px] text-muted-foreground">
                {tf.priceText}
              </p>
            </div>

            <Switch
              checked={tf.active}
              disabled={busy}
              onCheckedChange={(v) =>
                run(
                  () => setTariffActiveAction(tf.id, v),
                  v ? 'Tarif yoqildi' : 'Tarif o‘chirildi',
                )
              }
            />
            <button
              type="button"
              aria-label="Tahrirlash"
              onClick={() => setEditing(tf)}
              disabled={busy}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="O'chirish"
              onClick={() =>
                run(() => deleteTariffAction(tf.id), 'Tarif o‘chirildi')
              }
              disabled={busy || tf.isDefault}
              className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))
      )}

      <TariffDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Yangi tarif"
        unitLabel={unitLabel}
        showDefault
        busy={busy}
        onSubmit={(name, price, isDefault) =>
          run(
            () => createTariffAction({ name, price, isDefault }),
            'Tarif qo‘shildi',
          )
        }
      />

      <TariffDialog
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Tarifni tahrirlash"
        unitLabel={unitLabel}
        busy={busy}
        initialName={editing?.name ?? ''}
        initialPrice={editing?.editValue ?? ''}
        onSubmit={(name, price) => {
          const id = editing?.id;
          if (!id) return;
          run(
            () => updateTariffAction({ tariffId: id, name, price }),
            'Tarif saqlandi',
          );
        }}
      />
    </div>
  );
}

function TariffDialog({
  open,
  onOpenChange,
  title,
  unitLabel,
  busy,
  showDefault = false,
  initialName = '',
  initialPrice = '',
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  unitLabel: string;
  busy: boolean;
  showDefault?: boolean;
  initialName?: string;
  initialPrice?: string;
  onSubmit: (name: string, price: string, isDefault: boolean) => void;
}) {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(initialPrice);
  const [isDefault, setIsDefault] = useState(false);

  // Re-seed fields whenever the dialog (re)opens for a different tariff.
  const [seed, setSeed] = useState<string>('');
  const key = `${initialName}|${initialPrice}|${open}`;
  if (open && key !== seed) {
    setSeed(key);
    setName(initialName);
    setPrice(initialPrice);
    setIsDefault(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tf-name">Nomi</Label>
            <Input
              id="tf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Avia"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tf-price">Narx ({unitLabel})</Label>
            <Input
              id="tf-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="55 000"
              className="font-mono"
            />
          </div>
          {showDefault ? (
            <label className="flex items-center gap-2 text-[13px] text-slate-700">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4"
              />
              Asosiy tarif qilish
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Bekor qilish
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onSubmit(name, price, isDefault);
              onOpenChange(false);
            }}
            disabled={busy}
          >
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
