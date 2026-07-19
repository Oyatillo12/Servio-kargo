'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

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
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? 'Saqlanmoqda…' : "To'lov qo'shish"}
    </button>
  );
}

/** Record-a-payment form (SPEC §5.5): amount in so'm, method, optional note. */
export function PaymentForm({ customerId }: { customerId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(recordPaymentAction, initial);

  // Clear the inputs after a successful save.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="amount"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Summa (so'm)
          </label>
          <input
            id="amount"
            name="amount"
            inputMode="numeric"
            placeholder="0"
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <div>
          <label
            htmlFor="method"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Usul
          </label>
          <select
            id="method"
            name="method"
            defaultValue="cash"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label
          htmlFor="note"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Izoh (ixtiyoriy)
        </label>
        <input
          id="note"
          name="note"
          maxLength={255}
          placeholder="Izoh"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state.error ? (
          <p className="text-sm text-red-600">{state.error}</p>
        ) : null}
        {state.ok ? <p className="text-sm text-green-600">Saqlandi ✓</p> : null}
      </div>
    </form>
  );
}
