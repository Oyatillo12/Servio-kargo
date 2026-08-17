'use client';

import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import type { Lang } from '@kargotrack/shared';

import { submitLeadAction, type LeadState } from '../actions';

/** All visitor-facing strings arrive as props — the landing tree ships no
 * next-intl provider to the client. */
export interface LeadFormLabels {
  name: string;
  namePlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  company: string;
  companyPlaceholder: string;
  submit: string;
  submitting: string;
  success: string;
}

const INITIAL: LeadState = { status: 'idle' };

function SubmitButton({ labels }: { labels: LeadFormLabels }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-[3px] bg-signal font-display text-[14px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-signal-strong disabled:opacity-60"
    >
      {pending ? labels.submitting : labels.submit}
    </button>
  );
}

export function LeadForm({
  locale,
  labels,
}: {
  locale: Lang;
  labels: LeadFormLabels;
}) {
  const [state, formAction] = useFormState(submitLeadAction, INITIAL);
  // Stamped on the client after hydration, so the fill-time gate measures the
  // real visitor, not the (static) render time of the page.
  const [startedAt] = useState(() => Date.now());

  if (state.status === 'success') {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <p className="max-w-[26ch] text-[15px] font-semibold text-ink">
          {state.message ?? labels.success}
        </p>
      </div>
    );
  }

  const labelCls =
    'mb-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2';
  const inputCls =
    'h-12 w-full rounded-[2px] border border-rule bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-signal focus:ring-2 focus:ring-primary/20';

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Honeypot — visually removed, still in the POST for bots to fill. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto">
        <label>
          website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label htmlFor="lead-name" className={labelCls}>
          {labels.name}
        </label>
        <input
          id="lead-name"
          name="name"
          type="text"
          required
          maxLength={120}
          placeholder={labels.namePlaceholder}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="lead-phone" className={labelCls}>
          {labels.phone}
        </label>
        <input
          id="lead-phone"
          name="phone"
          type="tel"
          required
          maxLength={32}
          placeholder={labels.phonePlaceholder}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="lead-company" className={labelCls}>
          {labels.company}
        </label>
        <input
          id="lead-company"
          name="company"
          type="text"
          maxLength={120}
          placeholder={labels.companyPlaceholder}
          className={inputCls}
        />
      </div>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          {state.message}
        </p>
      ) : null}

      <SubmitButton labels={labels} />
    </form>
  );
}
