import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getTwaContext } from '@/lib/twa/auth';

import { TwaAuth } from './twa-auth';

/** Locale comes from the CUSTOMER row (or 'uz' pre-auth), never the panel cookie. */
function twaT(locale: 'uz' | 'ru') {
  return getTranslations({ locale, namespace: 'twa' });
}

export default async function TwaHomePage({
  params,
}: {
  params: { tenantId: string };
}) {
  const gate = await getTwaContext(params.tenantId);

  if (gate.state === 'not_found') notFound();

  if (gate.state === 'not_premium') {
    const t = await twaT('uz');
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-base font-bold text-foreground">
          {t('notEnabledTitle')}
        </p>
        <p className="text-sm text-muted-foreground">{t('notEnabledBody')}</p>
      </div>
    );
  }

  if (gate.state === 'unauthenticated') {
    return <TwaAuth tenantId={gate.tenant.id} />;
  }

  const { tenant, customer } = gate;
  const t = await twaT(customer.lang);

  const sections = [
    { key: 'navTracks' as const, href: `/m/${tenant.id}/tracks` },
    { key: 'navFinance' as const, href: `/m/${tenant.id}/finance` },
    { key: 'navCalc' as const, href: null },
    { key: 'navLookup' as const, href: null },
  ];

  return (
    <div className="space-y-3">
      <header>
        <p className="text-sm text-muted-foreground">{tenant.name}</p>
        <h1 className="text-lg font-bold text-foreground">
          {t('homeGreeting', {
            name: customer.fullName ?? customer.clientCode,
          })}
        </h1>
        <p className="mt-1 inline-block rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
          {customer.clientCode}
        </p>
      </header>

      {/* B3–B6 fill these in; until then the home is an honest map of what
          is coming, gated behind premium and shown to pilot tenants only. */}
      <ul className="space-y-2">
        {sections.map((s) =>
          s.href ? (
            <li key={s.key}>
              <Link
                href={s.href}
                className="flex items-center justify-between rounded-xl border border-[#eef0f4] bg-white px-4 py-3.5"
              >
                <span className="text-[14px] font-semibold text-foreground">
                  {t(s.key)}
                </span>
                <span aria-hidden className="text-muted-foreground">
                  ›
                </span>
              </Link>
            </li>
          ) : (
            <li
              key={s.key}
              className="flex items-center justify-between rounded-xl border border-[#eef0f4] bg-white px-4 py-3.5 opacity-70"
            >
              <span className="text-[14px] font-semibold text-foreground">
                {t(s.key)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {t('comingSoon')}
              </span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
