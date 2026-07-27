'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { updateCurrencyAction } from '../actions';

type Currency = 'UZS' | 'USD';

/** Currency block (SPEC §5.9): UZS/USD toggle + conditional rate input. */
export function CurrencyCard({
  initialCurrency,
  initialRateSom,
}: {
  initialCurrency: Currency;
  initialRateSom: string;
}) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [rate, setRate] = useState(initialRateSom);
  const [saving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      const res = await updateCurrencyAction({ currency, rate });
      if (res.error) toast.error(res.error);
      else toast.success(t('currencySaved'));
    });
  }

  return (
    <SectionCard title={t('currencyTitle')} className="space-y-3">
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label={t('currencyTitle')}
      >
        {(['UZS', 'USD'] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={currency === c}
            onClick={() => setCurrency(c)}
            className={cn(
              'rounded-lg border py-2.5 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              currency === c
                ? 'border-primary bg-accent text-primary'
                : 'border-input bg-white text-slate-600 hover:bg-secondary',
            )}
          >
            {c === 'UZS' ? t('currencyUzs') : t('currencyUsd')}
          </button>
        ))}
      </div>

      {currency === 'USD' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="usdRate">{t('usdRate')}</Label>
          <div className="flex items-center overflow-hidden rounded-lg border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
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
              {tCommon('som')}
            </span>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            {t('usdRateHint')}
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
        {saving ? <Spinner /> : null}
        {t('saveCurrency')}
      </Button>
    </SectionCard>
  );
}
