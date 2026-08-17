import { billingState, formatDate, type BillingStatus } from '@kargotrack/shared';

import { listLeadsForSa } from '@/lib/leads';
import { listTenantsForSa } from '@/lib/sa-queries';
import { requireSuperadmin } from '@/lib/superadmin';

import { saLogoutAction } from './login/actions';
import { OnboardForm } from './onboard-form';
import { OwnerResetButton } from './owner-reset-button';
import { PlanToggle } from './plan-toggle';
import { ActiveToggle, PaidUntilField } from './tenant-state-controls';
import { WebhookButton } from './webhook-button';

/** The state chip shown per row: the door first, then the billing clock. */
function StateChip({ active, billing }: { active: boolean; billing: BillingStatus }) {
  if (!active) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-micro font-semibold text-red-700">
        O‘chirilgan
      </span>
    );
  }
  // Grace ended at Tashkent midnight but the hourly sweep has not run yet —
  // the one window where a doomed tenant would otherwise read as healthy.
  if (billing.state === 'expired') {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-micro font-semibold text-red-700">
        Sweep’da o‘chadi
      </span>
    );
  }
  if (billing.state === 'grace') {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-micro font-semibold text-red-700">
        Muddati o‘tgan · {billing.graceDaysLeft} kun
      </span>
    );
  }
  if (billing.state === 'due-soon') {
    return (
      <span className="rounded-sm border border-warning/30 bg-[var(--st-china-bg)] px-2 py-0.5 text-micro font-semibold text-warning">
        {billing.daysLeft} kun qoldi
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-micro font-medium text-green-700">
      Faol
    </span>
  );
}

export const metadata = { title: 'Super-admin — SERVIO Kargo' };
// Always reflect the latest tenants (no static caching for this console).
export const dynamic = 'force-dynamic';

export default async function SaPage() {
  requireSuperadmin();
  const [tenantRows, saLeads] = await Promise.all([
    listTenantsForSa(),
    listLeadsForSa(),
  ]);

  const now = new Date();
  const tenants = tenantRows.map((t) => ({
    ...t,
    billing: billingState(t.paidUntil, now),
  }));

  // SPEC §6 / D-011: the tenants are never messaged about billing — the owner
  // chose a panel banner, which an owner who never opens the panel never sees.
  // This list is the other half of that decision: the platform's own warning,
  // so a call gets made before the hourly sweep closes the door.
  // `expired` is included on purpose: between Tashkent midnight and the next
  // hourly sweep a tenant is past grace but still open, and that hour is
  // exactly when a call still changes the outcome. Sorted by days left, so it
  // leads the list.
  const expiring = tenants
    .filter(
      (t) =>
        t.active &&
        (t.billing.state === 'due-soon' ||
          t.billing.state === 'grace' ||
          t.billing.state === 'expired'),
    )
    .sort((a, b) => (a.billing.daysLeft ?? 0) - (b.billing.daysLeft ?? 0));

  return (
    <div className="min-h-svh bg-paper">
      <header className="sticky top-0 z-10 border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-small font-bold text-ink">
              SERVIO Kargo — Super-admin
            </p>
            <p className="truncate text-micro text-faint">
              Platforma boshqaruvi
            </p>
          </div>
          <form action={saLogoutAction}>
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-small font-medium text-ink-2 hover:bg-surface-alt"
            >
              Chiqish
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6 lg:grid-cols-[1fr_380px]">
        {/* Tenants list */}
        <section className="min-w-0">
          {expiring.length > 0 ? (
            <div className="mb-5 rounded-md border border-warning/30 bg-[var(--st-china-bg)] px-4 py-3">
              <h2 className="text-small font-semibold text-warning">
                Muddati tugayapti ({expiring.length})
              </h2>
              <ul className="mt-2 space-y-1 text-small text-warning">
                {expiring.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    <span className="tabular-nums">{t.paidUntil}</span>
                    <span className="text-micro">
                      {t.billing.state === 'expired'
                        ? 'muddati tugadi — keyingi soatlik sweep’da o‘chadi'
                        : t.billing.state === 'grace'
                          ? `muddati o‘tgan — ${t.billing.graceDaysLeft} kundan keyin avtomatik o‘chadi`
                          : `${t.billing.daysLeft} kun qoldi`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-micro text-warning">
                Kompaniyalarga to‘lov haqida hech qanday xabar yuborilmaydi
                (D-011) — bu ro‘yxat yagona ogohlantirish.
              </p>
            </div>
          ) : null}

          <h2 className="mb-3 text-small font-semibold text-ink">
            Kompaniyalar ({tenants.length})
          </h2>
          {tenants.length === 0 ? (
            <p className="rounded-md border border-dashed border-input px-4 py-8 text-center text-small text-faint">
              Hali kompaniya yo‘q. O‘ngdagi forma orqali birinchisini qo‘shing.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-rule">
              <table className="w-full min-w-[900px] text-small">
                <thead>
                  <tr className="border-b border-rule bg-surface-alt text-left text-micro uppercase tracking-wide text-faint">
                    <th className="px-3 py-2 font-medium">Nomi</th>
                    <th className="px-3 py-2 font-medium">Bot</th>
                    <th className="px-3 py-2 font-medium">Reja</th>
                    <th className="px-3 py-2 font-medium">Holat</th>
                    <th className="px-3 py-2 font-medium">To‘lov muddati</th>
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
                      className="border-b border-rule-soft last:border-0"
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-ink">
                          {t.name}
                        </span>
                        <span className="ml-1 text-micro text-faint">
                          {t.codePrefix}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink-2">
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
                              ? 'rounded-sm border border-warning/30 bg-[var(--st-china-bg)] px-2 py-0.5 text-micro font-semibold text-warning'
                              : 'rounded-sm bg-surface-alt px-2 py-0.5 text-micro font-medium text-ink-2'
                          }
                        >
                          {t.plan === 'premium' ? 'Premium' : 'Basic'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <StateChip active={t.active} billing={t.billing} />
                      </td>
                      <td className="px-3 py-2">
                        <PaidUntilField
                          tenantId={t.id}
                          paidUntil={t.paidUntil}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.trackCount}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.customerCount}
                      </td>
                      <td className="px-3 py-2 text-faint">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <WebhookButton tenantId={t.id} />
                          <PlanToggle tenantId={t.id} plan={t.plan} />
                          <ActiveToggle tenantId={t.id} active={t.active} />
                          <OwnerResetButton tenantId={t.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Landing-page demo requests */}
          <h2 className="mb-3 mt-8 text-small font-semibold text-ink">
            Demo so‘rovlari ({saLeads.length})
          </h2>
          {saLeads.length === 0 ? (
            <p className="rounded-md border border-dashed border-input px-4 py-6 text-center text-small text-faint">
              Hali so‘rov yo‘q.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-rule">
              <table className="w-full min-w-[520px] text-small">
                <thead>
                  <tr className="border-b border-rule bg-surface-alt text-left text-micro uppercase tracking-wide text-faint">
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
                      className="border-b border-rule-soft last:border-0"
                    >
                      <td className="px-3 py-2 font-medium text-ink">
                        {lead.name}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}
                          className="tabular-nums text-ink-2 underline"
                        >
                          {lead.phone}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-ink-2">
                        {lead.company ?? '—'}
                      </td>
                      <td className="px-3 py-2 uppercase text-faint">
                        {lead.locale}
                      </td>
                      <td className="px-3 py-2 text-faint">
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
          <div className="rounded-md bg-surface p-5 border border-rule">
            <h2 className="mb-1 text-small font-semibold text-ink">
              Yangi kompaniya qo‘shish
            </h2>
            <p className="mb-4 text-micro text-faint">
              Token tekshiriladi, webhook avtomatik o‘rnatiladi.
            </p>
            <OnboardForm />
          </div>
        </section>
      </main>
    </div>
  );
}
