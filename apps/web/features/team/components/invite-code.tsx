'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatInviteCode } from '@kargotrack/shared';

import { cn } from '@/lib/utils';

/**
 * The invitation code, shown so it can be read out loud or copied.
 *
 * Grouped (`ABC-234`) because it is dictated over the phone to a warehouse more
 * often than it is pasted, and set in mono at a size that survives a cracked
 * screen — this string is the whole handover, and re-reading it wrong costs the
 * owner a second phone call. Copy falls back silently: `navigator.clipboard` is
 * unavailable over plain HTTP, which a self-hosted panel on a LAN may well be,
 * and the code is on screen regardless.
 */
export function InviteCode({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const t = useTranslations('team');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatInviteCode(code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard permission or no secure context — nothing to recover.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={t('copyCode')}
      className={cn(
        'inline-flex items-center gap-2 rounded-sm border border-dashed border-primary/40 bg-accent px-2.5 py-1.5 transition-colors',
        'hover:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <span className="font-mono text-[15px] font-bold tracking-[0.12em] text-primary">
        {formatInviteCode(code)}
      </span>
      {copied ? (
        <Check className="h-3.5 w-3.5 flex-none text-success" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
      )}
    </button>
  );
}
