'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PanelSection } from '@/components/ui/panel-section';
import { Spinner } from '@/components/ui/spinner';

import { updateCurrencyAction } from '../actions';
import { ChoiceGroup, ChoiceOption } from './choice-group';

type Currency = 'UZS' | 'USD';

/** Currency block (SPEC §5.9, design 2a/2b): UZS/USD choice + conditional rate. */
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
    <PanelSection title={t('currencyTitle')} className="md:col-span-2">
      <ChoiceGroup label={t('currencyTitle')}>
        {(['UZS', 'USD'] as const).map((c) => (
          <ChoiceOption
            key={c}
            selected={currency === c}
            onSelect={() => setCurrency(c)}
            label={c === 'UZS' ? t('currencyUzs') : t('currencyUsd')}
          />
        ))}
      </ChoiceGroup>

      {currency === 'USD' ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="usdRate">{t('usdRate')}</Label>
          <div className="flex items-center overflow-hidden rounded-sm border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <span className="border-e border-border bg-secondary px-3 py-2.5 text-[13px] text-muted-foreground">
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
            <span className="border-s border-border bg-secondary px-3 py-2.5 text-[13px] text-muted-foreground">
              {tCommon('som')}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">{t('usdRateHint')}</p>
        </div>
      ) : null}

      {/* Full width on phones, right-aligned on desktop (design 2a/2b). */}
      <div className="mt-3.5 flex md:justify-end">
        <Button
          type="button"
          className="w-full md:h-8 md:w-auto md:px-3 md:text-[13px]"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Spinner /> : null}
          {t('saveCurrency')}
        </Button>
      </div>
    </PanelSection>
  );
}
