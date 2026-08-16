'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { resetWebhookAction, type WebhookState } from './actions';

const initialState: WebhookState = {};

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-surface-alt disabled:opacity-60"
    >
      {pending ? '…' : 'Webhook'}
    </button>
  );
}

/** Per-row "re-set webhook" control (SPEC §6). Shows an inline ✓/✗ result. */
export function WebhookButton({ tenantId }: { tenantId: string }) {
  const [state, formAction] = useFormState(resetWebhookAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <Button />
      {state.ok ? <span className="text-xs text-green-600">✓</span> : null}
      {state.error ? (
        <span className="text-xs text-red-600" title={state.error}>
          ✗
        </span>
      ) : null}
    </form>
  );
}
