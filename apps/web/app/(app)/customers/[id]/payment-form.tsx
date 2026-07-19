'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { recordPaymentAction, type PaymentState } from './actions';

const initial: PaymentState = {};

const METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Naqd' },
  { value: 'click', label: 'Click' },
  { value: 'payme', label: 'Payme' },
  { value: 'other', label: 'Boshqa' },
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Saqlanmoqda…' : "To'lovni saqlash"}
    </Button>
  );
}

/** Record-a-payment form (SPEC §5.5): amount in so'm, method chips, optional note. */
export function PaymentForm({ customerId }: { customerId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [method, setMethod] = useState('cash');
  const [state, formAction] = useFormState(recordPaymentAction, initial);

  useEffect(() => {
    if (state.ok) {
      toast.success("To'lov saqlandi");
      formRef.current?.reset();
      setMethod('cash');
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="method" value={method} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Summa (so&apos;m)</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="numeric"
          placeholder="0"
          className="font-mono text-[16px] font-semibold"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Usul</Label>
        <div className="flex gap-1.5">
          {METHODS.map((m) => {
            const active = method === m.value;
            return (
              <button
                type="button"
                key={m.value}
                onClick={() => setMethod(m.value)}
                className={cn(
                  'flex-1 rounded-lg border py-2.5 text-[13px] font-semibold transition-colors',
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-input bg-white text-slate-600 hover:bg-secondary',
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Izoh (ixtiyoriy)</Label>
        <Input id="note" name="note" maxLength={255} placeholder="Izoh" />
      </div>

      <SaveButton />
    </form>
  );
}
