import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  Calculator,
  ChevronRight,
  Info,
  MapPin,
  Package,
  PlusCircle,
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

  if (gate.state === 'not_premium') {
    const t = await getTranslations({ locale: 'uz', namespace: 'twa' });
    return (
      <div className="twa-rise flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-[17px] font-extrabold">{t('notEnabledTitle')}</p>
        <p className="twa-hint text-sm leading-relaxed">{t('notEnabledBody')}</p>
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

  const nav = [
    { key: 'navTracks' as const, href: 'tracks', Icon: Package, i: 3 },
    { key: 'navFinance' as const, href: 'finance', Icon: Wallet, i: 4 },
    { key: 'navCalc' as const, href: 'calc', Icon: Calculator, i: 5 },
    { key: 'navAddress' as const, href: 'address', Icon: MapPin, i: 6 },
    { key: 'navLookup' as const, href: 'lookup', Icon: Search, i: 7 },
    { key: 'navInfo' as const, href: 'info', Icon: Info, i: 8 },
  ];

  return (
    <div className="space-y-3">
      {/* Identity */}
      <header className="twa-rise">
        <p className="twa-hint text-[12.5px]">{tenant.name}</p>
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-[20px] font-extrabold leading-tight">
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

      {/* The three numbers that answer "how are my parcels?" at a glance */}
      <div
        className="twa-card twa-rise twa-divider grid grid-cols-3 divide-x [&>*+*]:border-t-0"
        style={{ '--twa-i': 1 } as React.CSSProperties}
      >
        <div className="px-2 py-3 text-center" style={{ borderColor: 'var(--twa-border)' }}>
          <p className="font-mono text-lg font-bold tabular-nums">
            {summary.activeCount}
          </p>
          <p className="twa-hint text-[11px]">{t('statActive')}</p>
        </div>
        <div
          className="px-2 py-3 text-center"
          style={{ borderColor: 'var(--twa-border)' }}
        >
          <p
            className="font-mono text-lg font-bold tabular-nums"
            style={
              summary.readyCount > 0 ? { color: 'var(--twa-success)' } : undefined
            }
          >
            {summary.readyCount}
          </p>
          <p className="twa-hint text-[11px]">{t('statReady')}</p>
        </div>
        <div
          className="px-2 py-3 text-center"
          style={{ borderColor: 'var(--twa-border)' }}
        >
          <p
            className="truncate px-1 font-mono text-lg font-bold tabular-nums"
            style={
              summary.debtTiyin > 0 ? { color: 'var(--twa-error)' } : undefined
            }
          >
            {formatSom(Math.max(summary.debtTiyin, 0))}
          </p>
          <p className="twa-hint text-[11px]">
            {t('statDebt')} · {tCommon('som')}
          </p>
        </div>
      </div>

      {/* Primary action */}
      <Link
        href={`/m/${tenant.id}/add`}
        className="twa-btn twa-press twa-rise"
        style={{ '--twa-i': 2 } as React.CSSProperties}
      >
        <PlusCircle className="h-[18px] w-[18px]" aria-hidden />
        {t('navAdd')}
      </Link>

      {/* Sections */}
      <nav>
        <ul className="space-y-2">
          {nav.map(({ key, href, Icon, i }) => (
            <li key={key} className="twa-rise" style={{ '--twa-i': i } as React.CSSProperties}>
              <Link
                href={`/m/${tenant.id}/${href}`}
                className="twa-card twa-press flex items-center gap-3 px-4 py-3.5"
              >
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--twa-brand-soft)',
                    color: 'var(--twa-brand-ink)',
                  }}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                  {t(key)}
                </span>
                <ChevronRight
                  className="twa-hint h-4 w-4 flex-none"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="twa-rise pt-1" style={{ '--twa-i': 9 } as React.CSSProperties}>
        <LangSwitch tenantId={tenant.id} current={customer.lang} />
      </div>
    </div>
  );
}
