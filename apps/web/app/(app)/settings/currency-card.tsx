'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { updateCurrencyAction } from './actions';

type Currency = 'UZS' | 'USD';

/** Valyuta block (SPEC §5.9): UZS/USD toggle + conditional kurs input. */
export function CurrencyCard({
  initialCurrency,
  initialRateSom,
}: {
  initialCurrency: Currency;
  initialRateSom: string;
}) {
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [rate, setRate] = useState(initialRateSom);
  const [saving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      const res = await updateCurrencyAction({ currency, rate });
      if (res.error) toast.error(res.error);
      else toast.success('Valyuta saqlandi');
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-white p-3.5">
      <h2 className="text-[13.5px] font-semibold">Valyuta</h2>

      <div className="grid grid-cols-2 gap-2">
        {(['UZS', 'USD'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCurrency(c)}
            className={cn(
              'rounded-lg border py-2.5 text-sm font-semibold transition-colors',
              currency === c
                ? 'border-primary bg-accent text-primary'
                : 'border-input bg-white text-slate-600 hover:bg-secondary',
            )}
          >
            {c === 'UZS' ? "So'm (UZS)" : 'Dollar (USD)'}
          </button>
        ))}
      </div>

      {currency === 'USD' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="usdRate">Kurs (1$ = ? so&apos;m)</Label>
          <div className="flex items-center overflow-hidden rounded-lg border border-input">
            <span className="border-r border-border bg-[#f7f8fa] px-3.5 py-2.5 text-[13px] text-muted-foreground">
              1$ =
            </span>
            <input
              id="usdRate"
              inputMode="numeric"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="12 800"
              className="min-w-0 flex-1 bg-white px-3 py-2.5 font-mono text-[16px] font-semibold outline-none"
            />
            <span className="border-l border-border bg-[#f7f8fa] px-3.5 py-2.5 text-[13px] text-muted-foreground">
              so&apos;m
            </span>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            USD rejimida narx yuk tortilganda shu kurs bo&apos;yicha so&apos;mga
            aylantirilib qotiriladi.
          </p>
        </div>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={save}
        disabled={saving}
      >
        {saving ? 'Saqlanmoqda…' : 'Valyutani saqlash'}
      </Button>
    </div>
  );
}
