import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { formatDate, formatSom, t as strings } from '@kargotrack/shared';

import { getTwaContext } from '@/lib/twa/auth';
import { getTwaFinance } from '@/lib/twa/queries';

export default async function TwaFinancePage({
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
  // Payment-method names come from the canonical bot catalogue — the same
  // words the customer sees in bot receipts (CLAUDE.md rule 5).
  const methodLabel = strings(customer.lang).paymentMethod;

  const { debtTiyin, payments } = await getTwaFinance(tenant.id, customer.id);

  const balance =
    debtTiyin > 0
      ? {
          label: t('financeDebt'),
          value: `${formatSom(debtTiyin)} ${tCommon('som')}`,
          className: 'text-[#b91c1c]',
        }
      : debtTiyin < 0
        ? {
            label: t('financeAdvance'),
            value: `${formatSom(-debtTiyin)} ${tCommon('som')}`,
            className: 'text-[#177338]',
          }
        : {
            label: t('financeSettled'),
            value: `0 ${tCommon('som')}`,
            className: 'text-foreground',
          };

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">{t('navFinance')}</h1>
        <Link
          href={`/m/${tenant.id}`}
          className="text-sm text-muted-foreground"
        >
          {t('backHome')}
        </Link>
      </header>

      <div className="rounded-xl border border-[#eef0f4] bg-white px-4 py-4 text-center">
        <p className="text-[12.5px] text-muted-foreground">{balance.label}</p>
        <p
          className={`mt-1 font-mono text-2xl font-bold tabular-nums ${balance.className}`}
        >
          {balance.value}
        </p>
        {/* C2 (Click) puts the pay button right here. */}
      </div>

      <div className="rounded-xl border border-[#eef0f4] bg-white px-4 py-3.5">
        <p className="text-[13px] font-semibold text-foreground">
          {t('paymentsHistory')}
        </p>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('noPayments')}
          </p>
        ) : (
          <ul className="mt-1">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 border-t border-[#eef0f4] py-2.5 first:border-0"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {methodLabel[p.method]}
                  </p>
                  <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                    {formatDate(p.createdAt)}
                    {p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <span className="flex-none font-mono text-[13.5px] font-semibold text-[#177338]">
                  {formatSom(p.amountTiyin)} {tCommon('som')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
