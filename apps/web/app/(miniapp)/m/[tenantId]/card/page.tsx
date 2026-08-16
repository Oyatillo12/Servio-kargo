import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import QRCode from 'qrcode';

import { CopyChip } from '@/features/twa/components/copy-chip';
import { Screen } from '@/features/twa/components/screen';
import { getTwaContext } from '@/lib/twa/auth';

/**
 * Client card (SPEC §3.14, §10.2 — tasks.md L1).
 *
 * The same QR the bot sends, rendered on the server into a data URL: nothing to
 * fetch, nothing to hydrate. This screen is opened at a counter, where the
 * phone's signal is exactly as reliable as the building's walls.
 *
 * The QR carries the plain client code (D-009) — it selects a customer, it does
 * not authorise anything, and the employee reads their name and balance before
 * acting on it.
 */
export default async function TwaCardPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const gate = await getTwaContext(params.tenantId);
  if (gate.state === 'not_found') notFound();
  if (gate.state !== 'ok') redirect(`/m/${params.tenantId}`);
  const { tenant, customer } = gate;

  const t = await getTranslations({ locale: customer.lang, namespace: 'twa' });

  const qrDataUrl = await QRCode.toDataURL(customer.clientCode, {
    width: 640,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  return (
    <Screen
      title={t('cardTitle')}
      backHref={`/m/${tenant.id}`}
      backLabel={t('backHome')}
    >
      <div className="twa-card twa-rise flex flex-col items-center px-4 py-6">
        {/* White plate under the QR: a dark theme would otherwise invert the
            contrast the scanner depends on. */}
        <div className="rounded-2xl bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline data
              URL generated on this request; next/image has nothing to optimise */}
          <img
            src={qrDataUrl}
            alt={t('cardQrAlt')}
            className="h-auto w-full max-w-[260px]"
          />
        </div>

        <p className="mt-4 font-mono text-title font-bold tracking-wide">
          {customer.clientCode}
        </p>
        <div className="mt-2">
          <CopyChip
            text={customer.clientCode}
            label={t('cardCopy')}
            copiedLabel={t('addressCopied')}
          />
        </div>

        <p className="twa-hint mt-4 text-center text-micro leading-relaxed">
          {t('cardHint')}
        </p>
      </div>
    </Screen>
  );
}
