'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { PanelSection } from '@/components/ui/panel-section';

import { setPanelLocaleAction } from '../locale-actions';
import { ChoiceGroup, ChoiceOption } from './choice-group';

/** Labels stay in their own language — see `LocaleSwitcher` for why. */
const LOCALE_OPTIONS = [
  { value: 'uz', label: "O'zbekcha", tag: 'UZ' },
  { value: 'ru', label: 'Русский', tag: 'RU' },
] as const;

/**
 * Panel-language picker on the settings screen (AUDIT.md T17).
 *
 * The account menu already carries a switcher, but a setting nobody can find is
 * a setting nobody uses: an owner handing the panel to a Russian-speaking
 * clerk looks in Settings, not under their own avatar. The description spells
 * out that this is the admin's own UI, not the language their customers get
 * from the bot — those are separate columns and confusing them is expensive.
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
    <PanelSection title={t('languageTitle')} className="md:col-span-4">
      <p className="mb-3 text-[13px] text-muted-foreground">
        {t('languageDescription')}
      </p>
      <ChoiceGroup label={t('languageTitle')}>
        {LOCALE_OPTIONS.map((option) => (
          <ChoiceOption
            key={option.value}
            selected={option.value === current}
            disabled={pending}
            onSelect={() => pick(option.value)}
            label={option.label}
            tag={option.tag}
          />
        ))}
      </ChoiceGroup>
    </PanelSection>
  );
}
