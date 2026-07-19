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
      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
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
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Super-admin token
        </label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
