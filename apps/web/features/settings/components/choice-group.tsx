'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The side-by-side pick-one control the settings screens use for currency and
 * panel language (design 2a/2b).
 *
 * Not a `<Select>`: with exactly two options a dropdown hides half the answer
 * behind a tap and tells you nothing until you open it. Both options stay on
 * screen, the chosen one carries an indigo border and a check — border alone
 * is not enough when the difference is 1px against 1.5px.
 *
 * Radio semantics, because a row of plain `<button>`s says nothing about the
 * fact that only one can apply.
 */
export function ChoiceGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex gap-2', className)}
    >
      {children}
    </div>
  );
}

export function ChoiceOption({
  selected,
  onSelect,
  label,
  /** Small monospace tag before the label, e.g. the "UZ" / "RU" locale code. */
  tag,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  tag?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex h-11 flex-1 items-center gap-2 rounded-md px-3 text-body transition-colors md:h-10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'border-[1.5px] border-primary font-semibold text-primary'
          : 'border border-input font-medium text-foreground hover:border-faint',
      )}
    >
      {tag ? (
        <span
          className={cn(
            'flex-none font-mono text-micro font-medium',
            selected ? 'text-primary' : 'text-faint',
          )}
        >
          {tag}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
      {selected ? (
        <Check className="ms-auto h-4 w-4 flex-none" strokeWidth={2} aria-hidden />
      ) : null}
    </button>
  );
}
