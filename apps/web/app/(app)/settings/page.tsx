import { formatSom, formatUsd } from '@kargotrack/shared';

import { PageHeader } from '@/components/page-header';
import { requireAdmin } from '@/lib/auth';
import { listTariffs } from '@/lib/queries';
import { getWebhookInfo } from '@/lib/telegram';

import { CurrencyCard } from './currency-card';
import { SettingsForm } from './settings-form';
import { TariffsCard, type TariffView } from './tariffs-card';

export const metadata = { title: 'Sozlamalar — SERVIO Kargo' };

export default async function SettingsPage() {
  const { tenant } = await requireAdmin();

  // Live webhook state for the Ulangan/Uzilgan indicator (SPEC §5.7). Never
  // throws — a bad/placeholder token just reads as "Uzilgan".
  const info = await getWebhookInfo(tenant.botToken);
  const webhookConnected = info.ok && !!info.data.url;

  const settings = tenant.settings;
  const isUsd = tenant.currency === 'USD';
  const unitLabel = isUsd ? '$/kg' : "so'm/kg";

  const tariffRows = await listTariffs(tenant.id);
  const tariffs: TariffView[] = tariffRows.map((tf) => ({
    id: tf.id,
    name: tf.name,
    isDefault: tf.isDefault,
    active: tf.active,
    priceText: isUsd
      ? `${formatUsd(tf.pricePerKgMinor)}/kg`
      : `${formatSom(tf.pricePerKgMinor)} so'm/kg`,
    editValue: isUsd
      ? String(tf.pricePerKgMinor / 100)
      : String(Math.round(tf.pricePerKgMinor / 100)),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <PageHeader title="Sozlamalar" className="mb-0" />

      <div className="space-y-3 md:grid md:grid-cols-2 md:items-start md:gap-3 md:space-y-0">
        <TariffsCard tariffs={tariffs} unitLabel={unitLabel} />
        <CurrencyCard
          initialCurrency={tenant.currency}
          initialRateSom={
            tenant.usdRateTiyin != null ? formatSom(tenant.usdRateTiyin) : ''
          }
        />
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
