'use client';

import { useFormState, useFormStatus } from 'react-dom';

import type { TenantPlan } from '@kargotrack/shared';

import { setPlanAction, type PlanState } from './actions';

const initialState: PlanState = {};

function Button({ next }: { next: TenantPlan }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        next === 'premium'
          ? 'rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60'
          : 'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-surface-alt disabled:opacity-60'
      }
    >
      {pending ? '…' : next === 'premium' ? '→ Premium' : '→ Basic'}
    </button>
  );
}

/** Per-row plan switch: one click flips basic ⇄ premium. */
export function PlanToggle({
  tenantId,
  plan,
}: {
  tenantId: string;
  plan: TenantPlan;
}) {
  const [state, formAction] = useFormState(setPlanAction, initialState);
  const next: TenantPlan = plan === 'premium' ? 'basic' : 'premium';

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="plan" value={next} />
      <Button next={next} />
      {state.error ? (
        <span className="text-xs text-red-600" title={state.error}>
          ✗
        </span>
      ) : null}
    </form>
  );
}
