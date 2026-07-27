'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
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
} from '../actions';

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

/** Tariffs block (SPEC §5.9): CRUD list with default radio + active toggle. */
export function TariffsCard({
  tariffs,
  unitLabel,
}: {
  tariffs: TariffView[];
  /** "so'm/kg" or "$/kg" depending on currency. */
  unitLabel: string;
}) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [busy, startBusy] = useTransition();

  const [editing, setEditing] = useState<TariffView | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>, ok: string) {
    startBusy(async () => {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <SectionCard
      title={t('tariffsTitle')}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAddOpen(true)}
          disabled={busy}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('tariffNew')}
        </Button>
      }
      className="space-y-2.5"
    >
      {tariffs.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t('tariffsEmpty')}</p>
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
              role="radio"
              aria-checked={tf.isDefault}
              aria-label={`${t('tariffMakeDefault')} — ${tf.name}`}
              onClick={() =>
                run(
                  () => setDefaultTariffAction(tf.id),
                  t('tariffDefaultChanged'),
                )
              }
              disabled={busy || tf.isDefault}
              className={cn(
                'flex h-5 w-5 flex-none items-center justify-center rounded-full border-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                tf.isDefault
                  ? 'border-primary bg-primary text-white'
                  : 'border-input',
              )}
            >
              {tf.isDefault ? (
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              ) : null}
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-foreground">
                {tf.name}
                {tf.isDefault ? (
                  <span className="ml-1.5 text-[11px] font-medium text-primary">
                    · {t('tariffDefault')}
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
              aria-label={tf.name}
              onCheckedChange={(v) =>
                run(
                  () => setTariffActiveAction(tf.id, v),
                  v ? t('tariffEnabled') : t('tariffDisabled'),
                )
              }
            />
            <button
              type="button"
              aria-label={`${tCommon('edit')} — ${tf.name}`}
              onClick={() => setEditing(tf)}
              disabled={busy}
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`${tCommon('delete')} — ${tf.name}`}
              onClick={() =>
                run(() => deleteTariffAction(tf.id), t('tariffDeleted'))
              }
              disabled={busy || tf.isDefault}
              className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))
      )}

      <TariffDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t('tariffNewTitle')}
        unitLabel={unitLabel}
        showDefault
        busy={busy}
        onSubmit={(name, price, isDefault) =>
          run(
            () => createTariffAction({ name, price, isDefault }),
            t('tariffAdded'),
          )
        }
      />

      <TariffDialog
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={t('tariffEditTitle')}
        unitLabel={unitLabel}
        busy={busy}
        initialName={editing?.name ?? ''}
        initialPrice={editing?.editValue ?? ''}
        onSubmit={(name, price) => {
          const id = editing?.id;
          if (!id) return;
          run(
            () => updateTariffAction({ tariffId: id, name, price }),
            t('tariffSaved'),
          );
        }}
      />
    </SectionCard>
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
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

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
            <Label htmlFor="tf-name">{t('tariffName')}</Label>
            <Input
              id="tf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('tariffNamePlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tf-price">
              {t('tariffPrice', { unit: unitLabel })}
            </Label>
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
                className="h-4 w-4 accent-[color:hsl(var(--primary))]"
              />
              {t('tariffMakeDefaultCheckbox')}
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
            {tCommon('cancel')}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onSubmit(name, price, isDefault);
              onOpenChange(false);
            }}
            disabled={busy || !name.trim()}
          >
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
