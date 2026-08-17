'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { haptic } from '@/lib/twa/client';

/** Tap-to-copy with haptic + inline confirmation. `block` = full-width button. */
export function CopyChip({
  text,
  label,
  copiedLabel,
  block = false,
}: {
  text: string;
  label: string;
  copiedLabel: string;
  block?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      haptic('medium');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable in older webviews — the value is
      // visible/selectable next to the button, so fail quietly.
    }
  };

  if (block) {
    return (
      <button type="button" onClick={onCopy} className="twa-btn twa-press">
        {copied ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copied ? copiedLabel : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="twa-press inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold"
      style={{
        background: 'var(--twa-brand-soft)',
        color: 'var(--twa-brand-ink)',
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
      {copied ? copiedLabel : label}
    </button>
  );
}
