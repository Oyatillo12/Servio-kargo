import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  Calculator,
  Info,
  MapPin,
  Package,
  PlusCircle,
  QrCode,
  Search,
  Wallet,
} from 'lucide-react';

import { formatSom } from '@kargotrack/shared';

import { CopyChip } from '@/features/twa/components/copy-chip';
import { LangSwitch } from '@/features/twa/components/lang-switch';
import { TwaAuth } from '@/features/twa/components/twa-auth';
import { getTwaContext } from '@/lib/twa/auth';
import { getTwaHomeSummary } from '@/lib/twa/queries';

export default async function TwaHomePage({
  params,
}: {
  params: { tenantId: string };
}) {
  const gate = await getTwaContext(params.tenantId);

  if (gate.state === 'not_found') notFound();

  if (gate.state === 'not_premium' || gate.state === 'disabled') {
    const t = await getTranslations({ locale: 'uz', namespace: 'twa' });
    const disabled = gate.state === 'disabled';
    return (
      <div className="twa-rise flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-lead font-extrabold">
          {t(disabled ? 'disabledTitle' : 'notEnabledTitle')}
        </p>
        <p className="twa-hint text-sm leading-relaxed">
          {t(disabled ? 'disabledBody' : 'notEnabledBody')}
        </p>
      </div>
    );
  }

  if (gate.state === 'unauthenticated') {
    return <TwaAuth tenantId={gate.tenant.id} />;
  }

  const { tenant, customer } = gate;
  const t = await getTranslations({ locale: customer.lang, namespace: 'twa' });
  const tCommon = await getTranslations({
    locale: customer.lang,
    namespace: 'common',
  });
  const summary = await getTwaHomeSummary(tenant.id, customer.id);

  const debtShown = summary.debtTiyin > 0;

  return (
    <div className="space-y-3">
      {/* Identity */}
      <header className="twa-rise">
        <p className="twa-hint text-micro">{tenant.name}</p>
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-title font-extrabold leading-tight">
            {t('homeGreeting', {
              name: customer.fullName ?? customer.clientCode,
            })}
          </h1>
          <CopyChip
            text={customer.clientCode}
            label={customer.clientCode}
            copiedLabel={t('addressCopied')}
          />
        </div>
      </header>

      {/* Bento launcher — size and color follow the JOB, live numbers live
          inside their tiles (a status strip would just repeat them). */}
      <nav>
        <ul className="grid grid-cols-2 gap-2">
          {/* Hero: where the parcels are — the reason the app exists */}
          <li className="twa-rise row-span-2" style={{ '--twa-i': 1 } as React.CSSProperties}>
            <Link
              href={`/m/${tenant.id}/tracks`}
              className="twa-press flex h-full min-h-[152px] flex-col justify-between rounded-2xl p-4"
              style={{ background: 'var(--twa-brand)', color: 'var(--twa-on-brand)' }}
            >
              <Package className="h-6 w-6" aria-hidden />
              <div>
                <p className="font-mono text-[30px] font-bold leading-none tabular-nums">
                  {summary.activeCount}
                </p>
                <p className="mt-1 text-micro opacity-80">{t('statActive')}</p>
                {summary.readyCount > 0 ? (
                  <p
                    className="mt-2 inline-block rounded-full px-2 py-0.5 text-micro font-bold"
                    style={{ background: 'rgba(255,255,255,.18)' }}
                  >
                    {summary.readyCount} · {t('statReady')}
                  </p>
                ) : null}
                <p className="mt-2.5 text-body font-semibold">
                  {t('navTracks')} ›
                </p>
              </div>
            </Link>
          </li>

          {/* Money: the number that decides the pickup visit */}
          <li className="twa-rise" style={{ '--twa-i': 2 } as React.CSSProperties}>
            <Link
              href={`/m/${tenant.id}/finance`}
              className="twa-press flex h-full flex-col justify-between rounded-2xl p-3.5"
              style={{ background: 'var(--twa-copper-soft)' }}
            >
              <Wallet
                className="h-5 w-5"
                style={{ color: 'var(--twa-copper)' }}
                aria-hidden
              />
              <div>
                <p
                  className="truncate font-mono text-lead font-bold tabular-nums leading-tight"
                  style={debtShown ? { color: 'var(--twa-error)' } : undefined}
                >
                  {debtShown
                    ? `${formatSom(summary.debtTiyin)} ${tCommon('som')}`
                    : t('financeSettled')}
                </p>
                <p className="twa-hint mt-0.5 text-micro font-medium">
                  {t('navFinance')}
                </p>
              </div>
            </Link>
          </li>

          {/* Add: the daily habit — paste the code the seller just sent */}
          <li className="twa-rise" style={{ '--twa-i': 3 } as React.CSSProperties}>
            <Link
              href={`/m/${tenant.id}/add`}
              className="twa-press flex h-full flex-col justify-between rounded-2xl p-3.5"
              style={{ background: 'var(--twa-success-soft)' }}
            >
              <PlusCircle
                className="h-5 w-5"
                style={{ color: 'var(--twa-success)' }}
                aria-hidden
              />
              <p className="text-small font-bold leading-tight">
                {t('navAdd')}
              </p>
            </Link>
          </li>

          {/* Second row: prepare-a-shipment tools */}
          <li className="twa-rise" style={{ '--twa-i': 4 } as React.CSSProperties}>
            <Link
              href={`/m/${tenant.id}/address`}
              className="twa-press flex h-full flex-col justify-between gap-3 rounded-2xl p-3.5"
              style={{ background: 'var(--twa-info-soft)' }}
            >
              <MapPin
                className="h-5 w-5"
                style={{ color: 'var(--twa-info)' }}
                aria-hidden
              />
              <p className="text-small font-bold leading-tight">
                {t('navAddress')}
              </p>
            </Link>
          </li>
          <li className="twa-rise" style={{ '--twa-i': 5 } as React.CSSProperties}>
            <Link
              href={`/m/${tenant.id}/calc`}
              className="twa-card twa-press flex h-full flex-col justify-between gap-3 rounded-2xl p-3.5"
            >
              <Calculator
                className="h-5 w-5"
                style={{ color: 'var(--twa-brand-ink)' }}
                aria-hidden
              />
              <p className="text-small font-bold leading-tight">
                {t('navCalc')}
              </p>
            </Link>
          </li>

          {/* Utility strip: rare jobs, one slim row */}
          <li className="twa-rise col-span-2" style={{ '--twa-i': 6 } as React.CSSProperties}>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/m/${tenant.id}/lookup`}
                className="twa-card twa-press flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
              >
                <Search className="twa-hint h-[18px] w-[18px] flex-none" aria-hidden />
                <span className="truncate text-small font-semibold">
                  {t('navLookup')}
                </span>
              </Link>
              <Link
                href={`/m/${tenant.id}/info`}
                className="twa-card twa-press flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
              >
                <Info className="twa-hint h-[18px] w-[18px] flex-none" aria-hidden />
                <span className="truncate text-small font-semibold">
                  {t('navInfo')}
                </span>
              </Link>
              {/* §3.14: the card is opened AT the counter, so it sits in the
                  utility strip rather than competing with the daily jobs. */}
              <Link
                href={`/m/${tenant.id}/card`}
                className="twa-card twa-press col-span-2 flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
              >
                <QrCode className="twa-hint h-[18px] w-[18px] flex-none" aria-hidden />
                <span className="truncate text-small font-semibold">
                  {t('navCard')}
                </span>
              </Link>
            </div>
          </li>
        </ul>
      </nav>

      <div className="twa-rise pt-1" style={{ '--twa-i': 7 } as React.CSSProperties}>
        <LangSwitch tenantId={tenant.id} current={customer.lang} />
      </div>
    </div>
  );
}
