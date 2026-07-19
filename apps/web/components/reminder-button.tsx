'use client';

import { useState, useTransition } from 'react';

import type { ReminderState } from '@/lib/reminder-actions';

/**
 * Fires a bound reminder server action (SPEC §4.4 queue). Used for both the
 * per-customer button and the debtors "send to all" button; the caller binds
 * the right action. Optional `confirm` guards bulk sends.
 */
export function ReminderButton({
  action,
  label = 'Eslatma',
  confirm,
  className = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60',
}: {
  action: () => Promise<ReminderState>;
  label?: string;
  confirm?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onClick() {
    if (confirm && !window.confirm(confirm)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        setMsg({ ok: false, text: res.error });
      } else {
        const n = res.count ?? 0;
        setMsg({ ok: true, text: n > 1 ? `${n} ta eslatma yuborildi ✓` : 'Yuborildi ✓' });
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={className}
      >
        {pending ? 'Yuborilmoqda…' : label}
      </button>
      {msg ? (
        <span
          className={`text-xs ${msg.ok ? 'text-green-600' : 'text-red-600'}`}
        >
          {msg.text}
        </span>
      ) : null}
    </span>
  );
}
