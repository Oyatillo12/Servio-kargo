import { formatDate } from '@kargotrack/shared';

import { listLeadsForSa } from '@/lib/leads';
import { listTenantsForSa } from '@/lib/sa-queries';
import { requireSuperadmin } from '@/lib/superadmin';

import { saLogoutAction } from './login/actions';
import { OnboardForm } from './onboard-form';
import { PlanToggle } from './plan-toggle';
import { WebhookButton } from './webhook-button';

export const metadata = { title: 'Super-admin — SERVIO Kargo' };
// Always reflect the latest tenants (no static caching for this console).
export const dynamic = 'force-dynamic';

export default async function SaPage() {
  requireSuperadmin();
  const [tenants, saLeads] = await Promise.all([
    listTenantsForSa(),
    listLeadsForSa(),
  ]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              SERVIO Kargo — Super-admin
            </p>
            <p className="truncate text-xs text-slate-500">
              Platforma boshqaruvi
            </p>
          </div>
          <form action={saLogoutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Chiqish
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6 lg:grid-cols-[1fr_380px]">
        {/* Tenants list */}
        <section className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Kompaniyalar ({tenants.length})
          </h2>
          {tenants.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Hali kompaniya yo‘q. O‘ngdagi forma orqali birinchisini qo‘shing.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Nomi</th>
                    <th className="px-3 py-2 font-medium">Bot</th>
                    <th className="px-3 py-2 font-medium">Reja</th>
                    <th className="px-3 py-2 text-right font-medium">Treklar</th>
                    <th className="px-3 py-2 text-right font-medium">Mijozlar</th>
                    <th className="px-3 py-2 font-medium">Sana</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">
                          {t.name}
                        </span>
                        <span className="ml-1 text-xs text-slate-400">
                          {t.codePrefix}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {t.botUsername ? (
                          <a
                            href={`https://t.me/${t.botUsername}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            @{t.botUsername}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            t.plan === 'premium'
                              ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800'
                              : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                          }
                        >
                          {t.plan === 'premium' ? 'Premium' : 'Basic'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.trackCount}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.customerCount}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <WebhookButton tenantId={t.id} />
                          <PlanToggle tenantId={t.id} plan={t.plan} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Landing-page demo requests */}
          <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900">
            Demo so‘rovlari ({saLeads.length})
          </h2>
          {saLeads.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              Hali so‘rov yo‘q.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Ism</th>
                    <th className="px-3 py-2 font-medium">Telefon</th>
                    <th className="px-3 py-2 font-medium">Kompaniya</th>
                    <th className="px-3 py-2 font-medium">Til</th>
                    <th className="px-3 py-2 font-medium">Sana</th>
                  </tr>
                </thead>
                <tbody>
                  {saLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {lead.name}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}
                          className="tabular-nums text-slate-700 underline"
                        >
                          {lead.phone}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {lead.company ?? '—'}
                      </td>
                      <td className="px-3 py-2 uppercase text-slate-500">
                        {lead.locale}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {formatDate(lead.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Onboard form */}
        <section className="min-w-0">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">
              Yangi kompaniya qo‘shish
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Token tekshiriladi, webhook avtomatik o‘rnatiladi.
            </p>
            <OnboardForm />
          </div>
        </section>
      </main>
    </div>
  );
}
