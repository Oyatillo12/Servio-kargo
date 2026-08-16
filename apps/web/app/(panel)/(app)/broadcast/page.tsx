import { getTranslations } from 'next-intl/server';

import { canStopBroadcast, formatDateTime } from '@kargotrack/shared';

import { requireCapability } from '@/lib/auth';
import { listBroadcasts, listCustomerIdsWithTelegram } from '@/lib/queries';
import { PageHeader } from '@/components/layout/page-header';
import { BroadcastForm } from '@/features/broadcast/components/broadcast-form';
import { StopBroadcastButton } from '@/features/broadcast/components/stop-broadcast-button';

export async function generateMetadata() {
  const t = await getTranslations('broadcast');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

/** First 80 chars of the broadcast text, on a single line (SPEC §5.8 history). */
function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

export default async function BroadcastPage() {
  const { tenant, admin } = await requireCapability('broadcast.send');
  const t = await getTranslations('broadcast');

  const [recipientIds, history] = await Promise.all([
    listCustomerIdsWithTelegram(tenant.id),
    listBroadcasts(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title={t('pageTitle')} className="mb-0" />

      <BroadcastForm
        recipientCount={recipientIds.length}
        canTest={admin.tgUserId != null}
      />

      <div>
        <h2 className="mb-2 text-[13.5px] font-semibold text-foreground">
          {t('historyTitle')}
        </h2>
        {history.length === 0 ? (
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <p className="text-[13px] text-muted-foreground">
              {t('historyEmpty')}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            {history.map((b) => (
              <div
                key={b.id}
                className="border-b border-[#eef0f4] px-4 py-3 last:border-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11.5px] text-muted-foreground">
                    {formatDateTime(b.createdAt)}
                  </span>
                  {/* §5.8: progress, not just a delivered count — "2 980 of
                      3 000" is what tells an admin it is still going. */}
                  <span className="shrink-0 text-[11.5px] font-semibold text-primary">
                    {t('sentProgress', {
                      sent: b.sentCount,
                      total: b.recipientCount,
                    })}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-foreground">
                  {preview(b.text)}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  {b.status === 'cancelled' ? (
                    <span className="rounded border border-[#b3261e]/30 px-1.5 py-px text-[11px] font-semibold text-[#b3261e]">
                      {t('cancelledBadge')}
                    </span>
                  ) : (
                    <span />
                  )}
                  {canStopBroadcast(b) ? (
                    <StopBroadcastButton broadcastId={b.id} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
