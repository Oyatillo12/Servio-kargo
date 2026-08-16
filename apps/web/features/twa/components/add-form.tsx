'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { CheckCircle2, CircleAlert, PlusCircle } from 'lucide-react';

import { addTracksAction, type AddTracksState } from '../actions';

const initialState: AddTracksState = { result: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('twa');
  return (
    <button type="submit" disabled={pending} className="twa-btn twa-press">
      <PlusCircle className="h-4 w-4" aria-hidden />
      {pending ? t('addSubmitting') : t('addSubmit')}
    </button>
  );
}

function ResultGroup({
  tone,
  title,
  codes,
}: {
  tone: 'success' | 'info' | 'error';
  title: string;
  codes: string[];
}) {
  if (codes.length === 0) return null;
  const color =
    tone === 'success'
      ? 'var(--twa-success)'
      : tone === 'info'
        ? 'var(--twa-info)'
        : 'var(--twa-error)';
  const Icon = tone === 'error' ? CircleAlert : CheckCircle2;
  return (
    <div className="twa-card twa-rise px-4 py-3">
      <p
        className="flex items-center gap-1.5 text-small font-bold"
        style={{ color }}
      >
        <Icon className="h-4 w-4 flex-none" aria-hidden />
        {title}
      </p>
      <p className="mt-1 break-all font-mono text-micro leading-relaxed">
        {codes.join('\n')}
      </p>
    </div>
  );
}

export function AddTracksForm({ tenantId }: { tenantId: string }) {
  const t = useTranslations('twa');
  const [state, formAction] = useFormState(
    addTracksAction.bind(null, tenantId),
    initialState,
  );

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <textarea
          name="codes"
          rows={4}
          required
          maxLength={4000}
          placeholder={t('addPlaceholder')}
          className="twa-input resize-none font-mono text-small leading-relaxed"
          autoComplete="off"
          autoCapitalize="characters"
        />
        <SubmitButton />
      </form>

      {state.error ? (
        <p
          className="twa-rise rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'var(--twa-error-soft)',
            color: 'var(--twa-error)',
          }}
        >
          {t('addFailed')}
        </p>
      ) : null}

      {state.result ? (
        <div className="space-y-2">
          {state.result.added.length +
            state.result.claimed.length +
            state.result.otherOwner.length +
            state.result.badFormat.length ===
          0 ? (
            <p className="twa-hint twa-rise text-center text-sm">
              {t('addNothingNew')}
            </p>
          ) : null}
          <ResultGroup
            tone="success"
            title={t('addResAdded', { n: state.result.added.length })}
            codes={state.result.added}
          />
          <ResultGroup
            tone="info"
            title={t('addResClaimed', { n: state.result.claimed.length })}
            codes={state.result.claimed}
          />
          <ResultGroup
            tone="error"
            title={t('addResOtherOwner', { n: state.result.otherOwner.length })}
            codes={state.result.otherOwner}
          />
          <ResultGroup
            tone="error"
            title={t('addResBadFormat', { n: state.result.badFormat.length })}
            codes={state.result.badFormat}
          />
        </div>
      ) : null}
    </div>
  );
}
