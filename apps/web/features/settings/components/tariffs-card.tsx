'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PanelSection } from '@/components/ui/panel-section';
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
  /** Formatted amount only, e.g. "55 000" or "3.5$". */
  priceValue: string;
  /** Unit suffix rendered muted after the amount, e.g. "so'm/kg" or "/kg". */
  priceUnit: string;
  /** Editable raw price (so'm for UZS, dollars for USD). */
  editValue: string;
}

/**
 * Tariffs block (SPEC §5.9, design 2a/2b): one row per tariff — the radio picks
 * the default applied to new tracks, the switch takes a tariff out of use
 * without deleting the history priced with it.
 *
 * The name/price area is the edit target, not a pencil icon: on a phone the
 * design gives the whole row to the tap (a 16px icon at the end of a 380px row
 * is a miss waiting to happen), and the pencil only appears from `md` where
 * there is a pointer. Deleting lives inside the edit dialog for the same
 * reason — and because it is the one destructive control here.
 */
export function TariffsCard({
  tariffs,
  unitLabel,
}: {
  tariffs: TariffView[];
  /** "so'm/kg" or "$/kg" — shown on the price field's label. */
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
    <PanelSection
      flush
      title={t('tariffsTitle')}
      className="md:col-span-4"
      action={
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setAddOpen(true)}
          disabled={busy}
        >
          <Plus strokeWidth={2} aria-hidden />
          {t('tariffNew')}
        </Button>
      }
    >
      {tariffs.length === 0 ? (
        <p className="border-t border-n-divider px-4 py-4 text-[13px] text-muted-foreground">
          {t('tariffsEmpty')}
        </p>
      ) : (
        tariffs.map((tf) => (
          <div
            key={tf.id}
            className={cn(
              'flex min-h-[56px] items-center gap-3 border-t border-n-divider px-4 py-2 md:min-h-[52px]',
              !tf.active && 'opacity-60',
            )}
          >
            {/* Default selector */}
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
                'flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                tf.isDefault ? 'border-primary' : 'border-input hover:border-faint',
              )}
            >
              {tf.isDefault ? (
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setEditing(tf)}
              disabled={busy}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-sm text-start',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <span className="min-w-0 flex-1 md:flex md:items-center md:gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-medium text-foreground">
                    {tf.name}
                  </span>
                  {tf.isDefault ? (
                    <span className="flex-none rounded-sm border border-primary/30 px-1.5 py-px text-[11px] font-semibold uppercase tracking-[0.05em] text-primary">
                      {t('tariffDefault')}
                    </span>
                  ) : null}
                </span>
                {/* Under the name on phones, pushed to the right on desktop. */}
                <span className="mt-0.5 block text-[13px] text-muted-foreground md:ms-auto md:mt-0 md:text-[15px] md:font-semibold md:text-foreground">
                  {tf.priceValue}{' '}
                  <span className="text-faint md:text-[12px] md:font-medium">
                    {tf.priceUnit}
                  </span>
                </span>
              </span>
            </button>

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
              className="hidden h-8 w-8 flex-none items-center justify-center rounded-md text-faint transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </button>
            <ChevronRight
              className="h-4 w-4 flex-none text-faint md:hidden"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
        ))
      )}

      <p className="border-t border-n-divider px-4 py-3 text-[13px] text-faint">
        {t('tariffsHint')}
      </p>

      <TariffDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t('tariffNewTitle')}
        unitLabel={unitLabel}
        busy={busy}
        showDefault
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
        canDelete={editing != null && !editing.isDefault}
        onDelete={() => {
          const id = editing?.id;
          if (!id) return;
          setEditing(null);
          run(() => deleteTariffAction(id), t('tariffDeleted'));
        }}
        onSubmit={(name, price) => {
          const id = editing?.id;
          if (!id) return;
          run(
            () => updateTariffAction({ tariffId: id, name, price }),
            t('tariffSaved'),
          );
        }}
      />
    </PanelSection>
  );
}

function TariffDialog({
  open,
  onOpenChange,
  title,
  unitLabel,
  busy,
  showDefault = false,
  canDelete = false,
  initialName = '',
  initialPrice = '',
  onDelete,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  unitLabel: string;
  busy: boolean;
  showDefault?: boolean;
  canDelete?: boolean;
  initialName?: string;
  initialPrice?: string;
  onDelete?: () => void;
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
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 accent-[color:hsl(var(--primary))]"
              />
              {t('tariffMakeDefaultCheckbox')}
            </label>
          ) : null}

          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={onDelete}
              disabled={busy}
            >
              <Trash2 aria-hidden />
              {tCommon('delete')}
            </Button>
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
