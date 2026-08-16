import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Clock, MapPin, Phone } from 'lucide-react';

import { formatSom, formatUsd } from '@kargotrack/shared';

import { Screen } from '@/features/twa/components/screen';
import { getTwaContext } from '@/lib/twa/auth';
import { listTwaTariffs } from '@/lib/twa/queries';

/** The bot's /info card (SPEC §3.5), as a cabinet screen. */
export default async function TwaInfoPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const gate = await getTwaContext(params.tenantId);
  if (gate.state === 'not_found') notFound();
  if (gate.state !== 'ok') redirect(`/m/${params.tenantId}`);
  const { tenant, customer } = gate;

  const t = await getTranslations({ locale: customer.lang, namespace: 'twa' });
  const tCommon = await getTranslations({
    locale: customer.lang,
    namespace: 'common',
  });
  const tariffs = await listTwaTariffs(tenant.id);
  const isUsd = tenant.currency === 'USD';

  const contacts = [
    tenant.pickupAddress
      ? { Icon: MapPin, label: t('infoPickup'), value: tenant.pickupAddress }
      : null,
    tenant.workingHours
      ? { Icon: Clock, label: t('infoHours'), value: tenant.workingHours }
      : null,
  ].filter(Boolean) as { Icon: typeof MapPin; label: string; value: string }[];

  return (
    <Screen
      title={t('navInfo')}
      backHref={`/m/${tenant.id}`}
      backLabel={t('backHome')}
    >
      {/* Tariffs */}
      {tariffs.length > 0 ? (
        <div className="twa-card twa-rise px-4 py-3.5">
          <p className="text-small font-bold">{t('infoTariffs')}</p>
          <ul className="twa-divider mt-1">
            {tariffs.map((tf) => (
              <li
                key={tf.id}
                className="flex items-baseline justify-between gap-3 py-2"
                style={{ borderColor: 'var(--twa-border)' }}
              >
                <span className="min-w-0 truncate text-small">
                  {tf.name}
                </span>
                <span className="flex-none font-mono text-small font-semibold tabular-nums">
                  {isUsd
                    ? `${formatUsd(tf.pricePerKgMinor)}/kg`
                    : `${formatSom(tf.pricePerKgMinor)} ${tCommon('som')}/kg`}
                </span>
              </li>
            ))}
          </ul>
          {isUsd && tenant.usdRateTiyin != null ? (
            <p className="twa-hint mt-1 text-micro">
              {t('infoRate', { rate: formatSom(tenant.usdRateTiyin) })}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Contact & pickup */}
      {contacts.length > 0 || tenant.contactPhone ? (
        <div
          className="twa-card twa-rise px-4 py-1"
          style={{ '--twa-i': 1 } as React.CSSProperties}
        >
          <ul className="twa-divider">
            {contacts.map(({ Icon, label, value }) => (
              <li
                key={label}
                className="flex items-start gap-3 py-3"
                style={{ borderColor: 'var(--twa-border)' }}
              >
                <Icon
                  className="twa-hint mt-0.5 h-4 w-4 flex-none"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="twa-hint text-micro">{label}</p>
                  <p className="text-small leading-snug">{value}</p>
                </div>
              </li>
            ))}
            {tenant.contactPhone ? (
              <li
                className="py-3"
                style={{ borderColor: 'var(--twa-border)' }}
              >
                <a
                  href={`tel:${tenant.contactPhone.replace(/[^+\d]/g, '')}`}
                  className="twa-press flex items-center gap-3"
                >
                  <Phone
                    className="twa-hint mt-0.5 h-4 w-4 flex-none"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="twa-hint text-micro">{t('infoPhone')}</p>
                    <p
                      className="font-mono text-small font-semibold"
                      style={{ color: 'var(--twa-brand-ink)' }}
                    >
                      {tenant.contactPhone}
                    </p>
                  </div>
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* Free-text info */}
      {tenant.infoText ? (
        <div
          className="twa-card twa-rise px-4 py-3.5"
          style={{ '--twa-i': 2 } as React.CSSProperties}
        >
          <p className="whitespace-pre-wrap text-small leading-relaxed">
            {tenant.infoText}
          </p>
        </div>
      ) : null}

      {tariffs.length === 0 && contacts.length === 0 && !tenant.contactPhone && !tenant.infoText ? (
        <p
          className="twa-hint twa-rise rounded-2xl border border-dashed px-4 py-10 text-center text-sm"
          style={{ borderColor: 'var(--twa-border)' }}
        >
          {t('infoEmpty')}
        </p>
      ) : null}
    </Screen>
  );
}
