'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { setWeightAction, type WeightState } from './actions';

const initial: WeightState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? 'Saqlanmoqda…' : 'Saqlash'}
    </button>
  );
}

/**
 * Weight (kg) editor. On save the server recomputes and stores the price from
 * the tenant's price-per-kg (SPEC §7.4), so the displayed price refreshes after
 * revalidation.
 */
export function WeightForm({
  trackId,
  defaultWeight,
  priceText,
}: {
  trackId: string;
  defaultWeight: string;
  priceText: string;
}) {
  const [state, formAction] = useFormState(setWeightAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="trackId" value={trackId} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="weight"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Og'irlik (kg)
          </label>
          <input
            id="weight"
            name="weight"
            inputMode="decimal"
            defaultValue={defaultWeight}
            placeholder="0"
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Narx
          </span>
          <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm tabular-nums text-slate-700">
            {priceText}
          </div>
        </div>
        <SaveButton />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      {state.ok ? <p className="text-sm text-green-600">Saqlandi ✓</p> : null}
    </form>
  );
}
