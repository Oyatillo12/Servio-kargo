'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { resetOwnerInviteAction, type OwnerResetState } from './actions';

const initialState: OwnerResetState = {};

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? '…' : 'Parol tiklash'}
    </button>
  );
}

/**
 * Per-row owner password reset (tasks.md F5): issues a fresh invite code and
 * shows it inline — the super-admin reads it to the owner over the phone; the
 * owner redeems it on /login with their own phone and picks a new password.
 */
export function OwnerResetButton({ tenantId }: { tenantId: string }) {
  const [state, formAction] = useFormState(resetOwnerInviteAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <Button />
      {state.ok ? (
        <span className="font-mono text-xs text-green-700">
          {state.ok.code} · {state.ok.phone} · 24 soat
        </span>
      ) : null}
      {state.error ? (
        <span className="text-xs text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}
