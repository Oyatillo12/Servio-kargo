'use client';

import { useTransition } from 'react';

import type { Lang } from '@kargotrack/shared';

import { haptic } from '@/lib/twa/client';
import { setTwaLangAction } from '../actions';

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'uz', label: "O'zbekcha" },
  { value: 'ru', label: 'Русский' },
];

/** Segmented uz/ru control — writes `customers.lang`, bot follows along. */
export function LangSwitch({
  tenantId,
  current,
}: {
  tenantId: string;
  current: Lang;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      className="flex rounded-full p-1"
      style={{ background: 'var(--twa-border)' }}
      role="group"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={pending || o.value === current}
          onClick={() => {
            haptic();
            startTransition(() => setTwaLangAction(tenantId, o.value));
          }}
          className="twa-press flex-1 rounded-full px-3 py-1.5 text-micro font-semibold disabled:opacity-100"
          style={
            o.value === current
              ? { background: 'var(--twa-card)', color: 'var(--twa-text)' }
              : { color: 'var(--twa-hint)' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
