'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function CopyButton({ text }: { text: string }) {
  const t = useTranslations('twa');
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard can be unavailable in older webviews — the text is
          // selectable right above, so failing quietly is fine.
        }
      }}
      className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
    >
      {copied ? t('addressCopied') : t('addressCopy')}
    </button>
  );
}
