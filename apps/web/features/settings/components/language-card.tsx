'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { SectionCard } from '@/components/ui/section-card';
import { cn } from '@/lib/utils';

import { setPanelLocaleAction } from '../locale-actions';

/** Labels stay in their own language — see `LocaleSwitcher` for why. */
const LOCALE_OPTIONS = [
  { value: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
] as const;

/**
 * Panel-language picker on the settings screen (AUDIT.md T17).
 *
 * The account menu already carries a switcher, but a setting nobody can find is
 * a setting nobody uses: an owner handing the panel to a Russian-speaking
 * clerk looks in Settings, not under their own avatar.
 */
export function LanguageCard() {
  const t = useTranslations('settings');
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  function pick(next: string) {
    if (next === current || pending) return;
    startTransition(async () => {
      const res = await setPanelLocaleAction(next as 'uz' | 'ru');
      if (res.error) toast.error(t('invalidFields'));
      else toast.success(t('languageSaved'));
    });
  }

  return (
    <SectionCard
      title={t('languageTitle')}
      description={t('languageDescription')}
    >
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label={t('languageTitle')}
      >
        {LOCALE_OPTIONS.map((option) => {
          const active = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => pick(option.value)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                active
                  ? 'border-primary bg-accent text-primary'
                  : 'border-input bg-white text-slate-600 hover:bg-secondary',
              )}
            >
              <span aria-hidden>{option.flag}</span>
              {option.label}
              {active ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
