'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { ReminderState } from '@/features/debtors/actions';

/**
 * Fires a bound reminder server action (SPEC §4.4 queue). Used for the
 * per-customer button; the caller binds the right action. Feedback via toast.
 */
export function ReminderButton({
  action,
  label,
  variant = 'outline',
  size = 'sm',
  className,
}: {
  action: () => Promise<ReminderState>;
  label?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}) {
  const t = useTranslations('debtors');
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await action();
      // Server actions translate their own errors (they can reach the same
      // request config via `getTranslations`), so this is already localised.
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const n = res.count ?? 0;
      toast.success(n > 1 ? t('remindersSent', { count: n }) : t('reminderSent'));
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={pending}
    >
      {pending ? <Spinner /> : null}
      {label ?? t('reminder')}
    </Button>
  );
}
