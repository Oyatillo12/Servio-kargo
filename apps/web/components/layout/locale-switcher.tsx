'use client';

import { useTransition } from 'react';
import { Check, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { setPanelLocaleAction } from '@/features/settings/locale-actions';
import { cn } from '@/lib/utils';

const LOCALE_OPTIONS = [
  { value: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
] as const;

/**
 * Panel-language rows inside the account menu (AUDIT.md T17).
 *
 * Labels are written in their OWN language, never translated: someone who has
 * accidentally landed in a language they can't read has to be able to find
 * their way out, and "Ruscha"/"Узбекский" only helps if you already understand
 * the current one.
 */
export function LocaleSwitcher() {
  const t = useTranslations('nav');
  const tSettings = useTranslations('settings');
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  function pick(next: string) {
    if (next === current || pending) return;
    startTransition(async () => {
      const res = await setPanelLocaleAction(next as 'uz' | 'ru');
      if (res.error) toast.error(tSettings('invalidFields'));
    });
  }

  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Languages className="h-3.5 w-3.5" aria-hidden />
        {t('language')}
      </DropdownMenuLabel>
      {LOCALE_OPTIONS.map((option) => {
        const active = option.value === current;
        return (
          <DropdownMenuItem
            key={option.value}
            // Radix closes the menu on select; keep it open only while the
            // server action is in flight so the check mark can move first.
            onSelect={(e) => {
              e.preventDefault();
              pick(option.value);
            }}
            className={cn(active && 'font-semibold text-primary')}
          >
            <span aria-hidden>{option.flag}</span>
            <span className="flex-1">{option.label}</span>
            {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
