'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { recordPaymentAction, type PaymentState } from '../actions';

const initial: PaymentState = {};

/** Payment methods in SPEC §5.5 order; label keys live in `customerDetail`. */
const METHODS = [
  { value: 'cash', labelKey: 'methodCash' },
  { value: 'click', labelKey: 'methodClick' },
  { value: 'payme', labelKey: 'methodPayme' },
  { value: 'other', labelKey: 'methodOther' },
] as const;

function SaveButton() {
  const t = useTranslations('customerDetail');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Spinner /> : null}
      {t('savePayment')}
    </Button>
  );
}

/** Record-a-payment form (SPEC §5.5): amount in so'm, method chips, optional note. */
export function PaymentForm({ customerId }: { customerId: string }) {
  const t = useTranslations('customerDetail');
  const formRef = useRef<HTMLFormElement>(null);
  const [method, setMethod] = useState<string>('cash');
  const [state, formAction] = useFormState(recordPaymentAction, initial);

  useEffect(() => {
    if (state.ok) {
      toast.success(t('paymentSaved'));
      formRef.current?.reset();
      setMethod('cash');
    }
    if (state.error) toast.error(state.error);
  }, [state, t]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="method" value={method} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">{t('amount')}</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="numeric"
          placeholder="0"
          className="font-mono text-[16px] font-semibold"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium leading-none text-foreground">
          {t('method')}
        </span>
        {/* Radio semantics, chip appearance: only one method can apply, and a
            row of plain <button>s tells a screen reader nothing about that. */}
        <div className="flex gap-1.5" role="radiogroup" aria-label={t('method')}>
          {METHODS.map((m) => {
            const active = method === m.value;
            return (
              <button
                type="button"
                key={m.value}
                role="radio"
                aria-checked={active}
                onClick={() => setMethod(m.value)}
                className={cn(
                  'flex-1 rounded-lg border py-2.5 text-[13px] font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-input bg-white text-slate-600 hover:bg-secondary',
                )}
              >
                {t(m.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">{t('note')}</Label>
        <Input
          id="note"
          name="note"
          maxLength={255}
          placeholder={t('notePlaceholder')}
        />
      </div>

      <SaveButton />
    </form>
  );
}
