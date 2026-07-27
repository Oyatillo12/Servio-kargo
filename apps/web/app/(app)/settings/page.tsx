import { getTranslations } from 'next-intl/server';

import { formatSom, formatUsd } from '@kargotrack/shared';

import { PageHeader } from '@/components/layout/page-header';
import { requireAdmin } from '@/lib/auth';
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
  const { tenant } = await requireAdmin();
  const t = await getTranslations('settings');
  const tCommon = await getTranslations('common');

  // Live webhook state for the connected/disconnected indicator (SPEC §5.7).
  // Never throws — a bad/placeholder token just reads as "disconnected".
  const info = await getWebhookInfo(tenant.botToken);
  const webhookConnected = info.ok && !!info.data.url;

  const settings = tenant.settings;
  const isUsd = tenant.currency === 'USD';
  const unitLabel = isUsd ? `$/${tCommon('kg')}` : `${tCommon('som')}/${tCommon('kg')}`;

  const tariffRows = await listTariffs(tenant.id);
  const tariffs: TariffView[] = tariffRows.map((tf) => ({
    id: tf.id,
    name: tf.name,
    isDefault: tf.isDefault,
    active: tf.active,
    priceText: isUsd
      ? `${formatUsd(tf.pricePerKgMinor)}/${tCommon('kg')}`
      : `${formatSom(tf.pricePerKgMinor)} ${unitLabel}`,
    editValue: isUsd
      ? String(tf.pricePerKgMinor / 100)
      : String(Math.round(tf.pricePerKgMinor / 100)),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <PageHeader title={t('pageTitle')} className="mb-0" />

      <div className="space-y-3 md:grid md:grid-cols-2 md:items-start md:gap-3 md:space-y-0">
        <TariffsCard tariffs={tariffs} unitLabel={unitLabel} />
        <CurrencyCard
          initialCurrency={tenant.currency}
          initialRateSom={
            tenant.usdRateTiyin != null ? formatSom(tenant.usdRateTiyin) : ''
          }
        />
        <LanguageCard />
      </div>

      <SettingsForm
        initial={{
          pickupAddress: tenant.pickupAddress ?? '',
          workingHours: tenant.workingHours ?? '',
          contactPhone: tenant.contactPhone ?? '',
          staffIds: settings.staff_tg_ids ?? [],
          chinaAddressTemplate: settings.china_address_template ?? '',
          infoText: settings.info_text ?? '',
          weeklyEnabled: settings.reminders?.weekly_enabled ?? false,
          weekday: String(settings.reminders?.weekday ?? 1),
          hour: String(settings.reminders?.hour ?? 10),
          botUsername: tenant.botUsername,
          webhookConnected,
        }}
      />
    </div>
  );
}
