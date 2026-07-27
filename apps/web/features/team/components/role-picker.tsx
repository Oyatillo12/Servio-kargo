'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ADMIN_ROLES, type AdminRole } from '@kargotrack/shared';

import { cn } from '@/lib/utils';

/**
 * Pick a role, stacked, each with the sentence that explains it.
 *
 * A dropdown of three words would be smaller and wrong: the owner choosing here
 * is deciding whether a new hire can see the company's revenue or reprice its
 * tariffs, and "Menejer" on its own does not say. Every option states what it
 * grants, so the decision is made from the screen instead of from memory.
 */
export function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: AdminRole;
  onChange: (role: AdminRole) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('roles');

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className="flex flex-col gap-2"
    >
      {ADMIN_ROLES.map((role) => {
        const selected = role === value;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(role)}
            className={cn(
              'flex items-start gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
              selected
                ? 'border-[1.5px] border-primary'
                : 'border border-input hover:border-faint',
            )}
          >
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-[14px]',
                  selected
                    ? 'font-semibold text-primary'
                    : 'font-medium text-foreground',
                )}
              >
                {t(role)}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
                {t(`${role}Hint`)}
              </span>
            </span>
            {selected ? (
              <Check
                className="mt-0.5 h-4 w-4 flex-none text-primary"
                strokeWidth={2}
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
