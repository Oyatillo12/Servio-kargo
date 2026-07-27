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
      className="h-12 w-full rounded-lg bg-[#2B2687] text-[15px] font-semibold text-white transition-colors hover:bg-[#221e6e] disabled:opacity-60"
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
        <CheckCircle2 className="h-10 w-10 text-[#1F8A4C]" aria-hidden />
        <p className="max-w-[26ch] text-[15px] font-semibold text-[#16143B]">
          {state.message ?? labels.success}
        </p>
      </div>
    );
  }

  const inputCls =
    'h-12 w-full rounded-lg border border-[#d5d5dc] bg-white px-3.5 text-[15px] text-[#101014] outline-none transition-colors placeholder:text-[#8A8A96] focus:border-[#2B2687] focus:ring-2 focus:ring-[#2B2687]/20';

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
        <label
          htmlFor="lead-name"
          className="mb-1.5 block text-[12.5px] font-semibold text-[#55555F]"
        >
          {labels.name}
        </label>
        <input
          id="lead-name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          placeholder={labels.namePlaceholder}
          className={inputCls}
        />
      </div>

      <div>
        <label
          htmlFor="lead-phone"
          className="mb-1.5 block text-[12.5px] font-semibold text-[#55555F]"
        >
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
        <label
          htmlFor="lead-company"
          className="mb-1.5 block text-[12.5px] font-semibold text-[#55555F]"
        >
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
        <p role="alert" className="text-[13px] font-medium text-[#CC3D33]">
          {state.message}
        </p>
      ) : null}

      <SubmitButton labels={labels} />
    </form>
  );
}
