'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatKg, formatSom, type TrackStatus } from '@kargotrack/shared';

import { DebtCell } from '@/components/shared/debt-cell';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';

import { handoverAction } from '../actions';

export interface HandoverTrackRow {
  id: string;
  codeOriginal: string;
  currentStatus: TrackStatus;
  weightGrams: number | null;
  priceTiyin: number | null;
  /**
   * READY_FOR_PICKUP is already inside the current balance; a
   * TASHKENT_WAREHOUSE parcel joins the owed side only once DELIVERED — the
   * after-balance preview needs to know which is which (§7.5).
   */
  countsTowardDebt: boolean;
}

const METHODS = ['cash', 'click', 'payme', 'other'] as const;

/**
 * Steps 2–4 of the counter flow (SPEC §5.15): select parcels, take the money,
 * one button. The amount follows the selection total until the admin edits it
 * by hand (partial payment / advance); the after-balance previews live so
 * "chiqib ketsa qancha qarzi qoladi?" is answered before the button is pressed.
 */
export function HandoverForm({
  customerId,
  tracks,
  debtTiyin,
  canTakePayment,
  methodLabels,
}: {
  customerId: string;
  tracks: HandoverTrackRow[];
  debtTiyin: number;
  canTakePayment: boolean;
  /** Shared bot-catalogue method names (CLAUDE.md rule 5), resolved server-side. */
  methodLabels: Record<(typeof METHODS)[number], string>;
}) {
  const t = useTranslations('handover');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(tracks.map((tr) => tr.id)),
  );
  const [amount, setAmount] = useState<string>(() =>
    defaultAmountSom(tracks, new Set(tracks.map((tr) => tr.id))),
  );
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [isPending, startTransition] = useTransition();

  const selectedTracks = useMemo(
    () => tracks.filter((tr) => selected.has(tr.id)),
    [tracks, selected],
  );
  const totalTiyin = selectedTracks.reduce(
    (sum, tr) => sum + (tr.priceTiyin ?? 0),
    0,
  );
  const unpriced = selectedTracks.filter((tr) => tr.priceTiyin == null).length;

  // After-balance preview: parcels not yet counted in the balance join the
  // owed side on delivery; the typed payment offsets it.
  const amountSom = /^\d+$/.test(amount.replace(/[\s'_]/g, ''))
    ? Number(amount.replace(/[\s'_]/g, ''))
    : 0;
  const joinsDebtTiyin = selectedTracks.reduce(
    (sum, tr) => sum + (tr.countsTowardDebt ? 0 : (tr.priceTiyin ?? 0)),
    0,
  );
  const afterTiyin =
    debtTiyin + joinsDebtTiyin - (canTakePayment ? amountSom * 100 : 0);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    // The amount tracks the selection until the admin takes it over by hand.
    if (!amountTouched) {
      setAmount(defaultAmountSom(tracks, next));
    }
  }

  function submit() {
    startTransition(async () => {
      const res = await handoverAction({
        customerId,
        trackIds: [...selected],
        amount: canTakePayment ? amount : '',
        method,
      });
      if (res.error) {
        toast.error(res.error);
        // A stale selection means the list on screen no longer matches the
        // database — re-render it so the retry starts from reality (§5.15).
        router.refresh();
        return;
      }
      toast.success(t('done', { count: res.delivered ?? selected.size }));
      router.refresh();
    });
  }

  const hasPayment = canTakePayment && amountSom > 0;

  return (
    <div className="space-y-3">
      <SectionCard title={t('tracksTitle')}>
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noTracks')}</p>
        ) : (
          <ul>
            {tracks.map((tr) => (
              <li
                key={tr.id}
                className="border-t border-[#eef0f4] first:border-0"
              >
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
                  <Checkbox
                    checked={selected.has(tr.id)}
                    onCheckedChange={() => toggle(tr.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[13px] font-semibold text-foreground">
                      {tr.codeOriginal}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11.5px] text-muted-foreground">
                      {tr.weightGrams != null
                        ? `${formatKg(tr.weightGrams)} ${tCommon('kg')}`
                        : tCommon('dash')}
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    {tr.priceTiyin != null ? (
                      <span className="whitespace-nowrap font-mono text-[12.5px] text-slate-600">
                        {formatSom(tr.priceTiyin)} {tCommon('som')}
                      </span>
                    ) : (
                      <AlertTriangle
                        className="h-4 w-4 text-[#92400e]"
                        aria-label={t('noPrice')}
                      />
                    )}
                    <StatusBadge status={tr.currentStatus} />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {tracks.length > 0 ? (
        <SectionCard>
          <div className="flex items-center justify-between text-[13.5px]">
            <span className="text-muted-foreground">
              {t('selectedTotal', { count: selected.size })}
            </span>
            <span className="font-mono font-semibold">
              {formatSom(totalTiyin)} {tCommon('som')}
            </span>
          </div>
          {unpriced > 0 ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#92400e]">
              <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden />
              {t('unpricedWarning', { count: unpriced })}
            </p>
          ) : null}

          {canTakePayment ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="handover-amount">{t('amount')}</Label>
                <Input
                  id="handover-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setAmountTouched(true);
                  }}
                  className="font-mono"
                />
                <p className="text-[12px] text-muted-foreground">
                  {t('amountHint')}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t('method')}</Label>
                <Select
                  value={method}
                  onValueChange={(v) => setMethod(v as typeof method)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {methodLabels[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between border-t border-[#eef0f4] pt-3 text-[13.5px]">
            <span className="text-muted-foreground">{t('balanceAfter')}</span>
            <DebtCell tiyin={afterTiyin} />
          </div>

          <Button
            size="lg"
            className="mt-3 w-full"
            disabled={isPending || selected.size === 0}
            onClick={submit}
          >
            {isPending ? <Spinner /> : null}
            {hasPayment
              ? t('submitWithPayment', { count: selected.size })
              : t('submitDeliverOnly', { count: selected.size })}
          </Button>
        </SectionCard>
      ) : null}
    </div>
  );
}

/** Selection total in whole so'm, as the amount field's auto value. */
function defaultAmountSom(
  tracks: HandoverTrackRow[],
  selected: Set<string>,
): string {
  const tiyin = tracks
    .filter((tr) => selected.has(tr.id))
    .reduce((sum, tr) => sum + (tr.priceTiyin ?? 0), 0);
  return tiyin > 0 ? String(Math.round(tiyin / 100)) : '';
}
