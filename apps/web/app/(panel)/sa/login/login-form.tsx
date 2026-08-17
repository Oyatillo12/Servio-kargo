'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { saLoginAction, type SaLoginState } from './actions';

const initialState: SaLoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-ink px-4 py-2.5 text-small font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
    >
      {pending ? 'Tekshirilmoqda…' : 'Kirish'}
    </button>
  );
}

export function SaLoginForm() {
  const [state, formAction] = useFormState(saLoginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="token"
          className="mb-1 block text-small font-medium text-ink-2"
        >
          Super-admin token
        </label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          required
          className="w-full rounded-md border border-input px-3 py-2.5 text-small outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-small text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
