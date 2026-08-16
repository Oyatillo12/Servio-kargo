import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { formatDate, formatSom, t as strings } from '@kargotrack/shared';

import { Screen } from '@/features/twa/components/screen';
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
          value: formatSom(debtTiyin),
          color: 'var(--twa-error)',
        }
      : debtTiyin < 0
        ? {
            label: t('financeAdvance'),
            value: formatSom(-debtTiyin),
            color: 'var(--twa-success)',
          }
        : {
            label: t('financeSettled'),
            value: '0',
            color: 'var(--twa-text)',
          };

  return (
    <Screen
      title={t('navFinance')}
      backHref={`/m/${tenant.id}`}
      backLabel={t('backHome')}
    >
      <div className="twa-card twa-rise px-4 py-5 text-center">
        <p className="twa-hint text-micro">{balance.label}</p>
        <p
          className="mt-1 font-mono text-[30px] font-bold tabular-nums leading-none"
          style={{ color: balance.color }}
        >
          {balance.value}
          <span className="twa-hint ml-1.5 text-base font-semibold">
            {tCommon('som')}
          </span>
        </p>
        {/* C2 (onlayn to'lov) puts the pay button right here. */}
      </div>

      <div
        className="twa-card twa-rise px-4 py-3.5"
        style={{ '--twa-i': 1 } as React.CSSProperties}
      >
        <p className="text-small font-bold">{t('paymentsHistory')}</p>
        {payments.length === 0 ? (
          <p className="twa-hint mt-2 text-sm">{t('noPayments')}</p>
        ) : (
          <ul className="twa-divider mt-1">
            {payments.map((p) => {
              // A storno row (tasks.md A7): negative, labelled as a
              // cancellation, note hidden — the reason is the admin's audit
              // trail, not a message to the customer.
              const isStorno = p.reversalOf != null;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                  style={{ borderColor: 'var(--twa-border)' }}
                >
                  <div className="min-w-0">
                    <p className="text-small font-semibold">
                      {isStorno ? t('paymentReversed') : methodLabel[p.method]}
                    </p>
                    <p className="twa-hint mt-0.5 font-mono text-micro">
                      {formatDate(p.createdAt)}
                      {!isStorno && p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <span
                    className="flex-none font-mono text-small font-semibold tabular-nums"
                    style={{
                      color: isStorno
                        ? 'var(--twa-error)'
                        : 'var(--twa-success)',
                    }}
                  >
                    {isStorno ? '' : '+'}
                    {formatSom(p.amountTiyin)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Screen>
  );
}
