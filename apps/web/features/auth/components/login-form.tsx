'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

import { loginAction, type LoginState } from '../actions';

const initialState: LoginState = {};

function SubmitButton() {
  const t = useTranslations('auth');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-1 w-full">
      {pending ? <Spinner /> : null}
      {t('signIn')}
    </Button>
  );
}

export function LoginForm() {
  const t = useTranslations('auth');
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

      {state.error ? (
        // `role="alert"` so a failed sign-in is announced: the message appears
        // above the button the user just pressed, out of their line of sight.
        <p
          role="alert"
          className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-[#b3261e]"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
