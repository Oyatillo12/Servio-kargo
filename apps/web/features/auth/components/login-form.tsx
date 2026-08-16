'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

import { INVITE_CODE_LENGTH, MIN_PASSWORD_LENGTH } from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

import { acceptInviteAction, loginAction, type LoginState } from '../actions';

const initialState: LoginState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-1 w-full">
      {pending ? <Spinner /> : null}
      {label}
    </Button>
  );
}

/** Shared error banner — the message lands above the button just pressed. */
function ErrorBanner({ message }: { message: string }) {
  return (
    // `role="alert"` so a failed sign-in is announced: the message appears
    // above the button the user just pressed, out of their line of sight.
    <p
      role="alert"
      className="rounded-lg bg-[var(--st-lost-bg)] px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

/**
 * Sign in, or redeem an invitation (SPEC §5.1 / §5.12).
 *
 * The two live on one screen behind a text toggle rather than on separate URLs:
 * a new employee is told "open the panel and enter this code", and sending them
 * hunting for a second address is one step more than that instruction survives.
 * Sign-in stays the default — it is what happens every day after.
 */
export function LoginForm() {
  const [mode, setMode] = useState<'signIn' | 'invite'>('signIn');

  return mode === 'signIn' ? (
    <SignInForm onSwitch={() => setMode('invite')} />
  ) : (
    <InviteForm onSwitch={() => setMode('signIn')} />
  );
}

function SignInForm({ onSwitch }: { onSwitch: () => void }) {
  const t = useTranslations('auth');
  const tTeam = useTranslations('team');
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          placeholder={t('phonePlaceholder')}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      {state.error ? <ErrorBanner message={state.error} /> : null}

      <SubmitButton label={t('signIn')} />

      <SwitchLink onClick={onSwitch} label={tTeam('haveInvite')} />
    </form>
  );
}

function InviteForm({ onSwitch }: { onSwitch: () => void }) {
  const t = useTranslations('auth');
  const tTeam = useTranslations('team');
  const [state, formAction] = useFormState(acceptInviteAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <p className="text-small text-muted-foreground">{tTeam('inviteIntro')}</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-phone">{t('phone')}</Label>
        <Input
          id="invite-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          placeholder={t('phonePlaceholder')}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-code">{tTeam('inviteCode')}</Label>
        <Input
          id="invite-code"
          name="code"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABC-234"
          // Room for the dash the code is shown with; the server strips it.
          maxLength={INVITE_CODE_LENGTH + 2}
          className="font-mono uppercase tracking-[0.12em]"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-password">{tTeam('newPassword')}</Label>
        <Input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-describedby="invite-password-hint"
        />
        <p id="invite-password-hint" className="text-micro text-muted-foreground">
          {tTeam('passwordHint', { min: MIN_PASSWORD_LENGTH })}
        </p>
      </div>

      {state.error ? <ErrorBanner message={state.error} /> : null}

      <SubmitButton label={tTeam('acceptInvite')} />

      <SwitchLink onClick={onSwitch} label={tTeam('backToSignIn')} />
    </form>
  );
}

function SwitchLink({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 self-center rounded-sm text-small font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
    </button>
  );
}
