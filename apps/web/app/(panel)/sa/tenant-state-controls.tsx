'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import {
  setPaidUntilAction,
  setTenantActiveAction,
  type TenantStateState,
} from './actions';

const initialState: TenantStateState = {};

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? '…' : label}
    </button>
  );
}

/**
 * Per-row disable/enable (SPEC §6, §7.19 — tasks.md J1).
 *
 * Disabling asks twice and names what stops, because it is the one row action
 * whose blast radius reaches the tenant's own customers. Enabling does not:
 * re-opening a company nobody meant to close should never need two clicks.
 */
export function ActiveToggle({
  tenantId,
  active,
}: {
  tenantId: string;
  active: boolean;
}) {
  const [state, formAction] = useFormState(setTenantActiveAction, initialState);
  const [confirming, setConfirming] = useState(false);

  if (active && !confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        O‘chirish
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      {active ? (
        <>
          <span
            className="text-micro text-faint"
            title="Bot javob beradi (jim bo‘lmaydi), panel qulflanadi, navbatdagi xabarlar tashlanadi."
          >
            Ishonchingiz komilmi?
          </span>
          <Submit
            label="Ha, o‘chirish"
            className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md px-2 py-1 text-xs text-faint hover:bg-surface-alt"
          >
            Bekor
          </button>
        </>
      ) : (
        <Submit
          label="Yoqish"
          className="rounded-md border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
        />
      )}
      {state.error ? (
        <span className="text-xs text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}

/** Per-row paid-through date (tasks.md J2). Empty = billing not set. */
export function PaidUntilField({
  tenantId,
  paidUntil,
}: {
  tenantId: string;
  paidUntil: string | null;
}) {
  const [state, formAction] = useFormState(setPaidUntilAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input
        type="date"
        name="paidUntil"
        defaultValue={paidUntil ?? ''}
        aria-label="To‘lov muddati"
        className="rounded-md border border-input px-1.5 py-1 text-xs tabular-nums"
      />
      <Submit
        label="Saqlash"
        className="rounded-md border border-input px-2 py-1 text-xs font-medium text-ink-2 hover:bg-surface-alt disabled:opacity-60"
      />
      {state.error ? (
        <span className="text-xs text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}
