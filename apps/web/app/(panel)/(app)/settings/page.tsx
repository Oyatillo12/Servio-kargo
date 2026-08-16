import Link from 'next/link';
import { ChevronRight, UserCog } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { formatSom, formatUsd } from '@kargotrack/shared';

import { PanelSection, SectionStack } from '@/components/ui/panel-section';
import { requireCapability } from '@/lib/auth';
import { listTariffs } from '@/lib/queries';
import { getWebhookInfo } from '@/lib/telegram';
import { CurrencyCard } from '@/features/settings/components/currency-card';
import { LanguageCard } from '@/features/settings/components/language-card';
import { SettingsForm } from '@/features/settings/components/settings-form';
import {
  TariffsCard,
  type TariffView,
} from '@/features/settings/components/tariffs-card';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

export default async function SettingsPage() {
  const { tenant } = await requireCapability('settings.manage');
  const t = await getTranslations('settings');
  const tCommon = await getTranslations('common');

  // Live webhook state for the connected/disconnected indicator (SPEC §5.7).
  // Never throws — a bad/placeholder token just reads as "disconnected".
  const info = await getWebhookInfo(tenant.botToken);
  const webhookConnected = info.ok && !!info.data.url;

  const settings = tenant.settings;
  const isUsd = tenant.currency === 'USD';
  const unitLabel = isUsd
    ? `$/${tCommon('kg')}`
    : `${tCommon('som')}/${tCommon('kg')}`;

  const tariffRows = await listTariffs(tenant.id);
  const tariffs: TariffView[] = tariffRows.map((tf) => ({
    id: tf.id,
    name: tf.name,
    isDefault: tf.isDefault,
    active: tf.active,
    // Amount and unit are separate so the row can render the unit muted —
    // `formatUsd` already carries the "$", hence the bare "/kg" for USD.
    priceValue: isUsd
      ? formatUsd(tf.pricePerKgMinor)
      : formatSom(tf.pricePerKgMinor),
    priceUnit: isUsd
      ? `/${tCommon('kg')}`
      : `${tCommon('som')}/${tCommon('kg')}`,
    editValue: isUsd
      ? String(tf.pricePerKgMinor / 100)
      : String(Math.round(tf.pricePerKgMinor / 100)),
    volumetricCoef: String(tf.volumetricCoef),
  }));

  return (
    <>
      <h1 className="mb-3 text-[20px] font-semibold text-foreground md:mb-4">
        {t('pageTitle')}
      </h1>

      {/* Six columns: the 4/2 spans below reproduce the design's 1.5fr / 1fr
          split, and every block is a direct grid item so the two columns fill
          independently instead of as two tall stacks. `SettingsForm` is
          `display: contents` for the same reason. */}
      <SectionStack className="md:grid md:grid-cols-6 md:items-start">
        {/* Employees used to be edited right here, as a list of raw Telegram
            ids in a jsonb field — no names, no roles, no way to revoke panel
            access. They now have a screen of their own; this is the signpost to
            it, kept on Settings because that is where an owner looks. */}
        <Link
          href="/settings/team"
          className="group md:col-span-6"
          aria-label={t('teamCardTitle')}
        >
          <PanelSection className="transition-colors group-hover:border-primary/40">
            <div className="flex items-center gap-3">
              <UserCog
                className="h-5 w-5 flex-none text-primary"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-foreground">
                  {t('teamCardTitle')}
                </span>
                <span className="block text-[13px] text-muted-foreground">
                  {t('teamCardHint')}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 flex-none text-faint"
                aria-hidden
              />
            </div>
          </PanelSection>
        </Link>

        <TariffsCard tariffs={tariffs} unitLabel={unitLabel} />

        <CurrencyCard
          initialCurrency={tenant.currency}
          initialRateSom={
            tenant.usdRateTiyin != null ? formatSom(tenant.usdRateTiyin) : ''
          }
        />

        <LanguageCard />

        <SettingsForm
          initial={{
            pickupAddress: tenant.pickupAddress ?? '',
            workingHours: tenant.workingHours ?? '',
            contactPhone: tenant.contactPhone ?? '',
            chinaAddressTemplate: settings.china_address_template ?? '',
            infoText: settings.info_text ?? '',
            weeklyEnabled: settings.reminders?.weekly_enabled ?? false,
            weekday: String(settings.reminders?.weekday ?? 1),
            hour: String(settings.reminders?.hour ?? 10),
            botUsername: tenant.botUsername,
            webhookConnected,
          }}
        />
      </SectionStack>
    </>
  );
}
