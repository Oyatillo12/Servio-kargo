'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button, type ButtonProps } from '@/components/ui/button';
import type { ReminderState } from '@/lib/reminder-actions';

/**
 * Fires a bound reminder server action (SPEC §4.4 queue). Used for the
 * per-customer button; the caller binds the right action. Feedback via toast.
 */
export function ReminderButton({
  action,
  label = 'Eslatma',
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
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const n = res.count ?? 0;
      toast.success(
        n > 1 ? `${n} ta eslatma yuborildi` : 'Eslatma yuborildi',
      );
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
      {pending ? 'Yuborilmoqda…' : label}
    </Button>
  );
}
