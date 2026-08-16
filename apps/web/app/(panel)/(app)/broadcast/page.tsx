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
    <div>
      <PageHeader title={t('pageTitle')} />

      {/* Composing and the history side by side on a desk browser: what was
          sent last week is the thing an admin checks before writing this
          week's, and it used to sit a full screen below the textarea. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:items-start lg:gap-5">
        <div className="lg:col-span-3">
          <BroadcastForm
            recipientCount={recipientIds.length}
            canTest={admin.tgUserId != null}
          />
        </div>

        <div className="lg:col-span-2">
          <h2 className="eyebrow mb-2">{t('historyTitle')}</h2>
          {history.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-8 text-center">
              <p className="text-small text-muted-foreground">
                {t('historyEmpty')}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              {history.map((b) => (
                <div
                  key={b.id}
                  className="border-b border-rule-soft px-4 py-3 last:border-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-micro text-muted-foreground">
                      {formatDateTime(b.createdAt)}
                    </span>
                    {/* §5.8: progress, not just a delivered count — "2 980 of
                      3 000" is what tells an admin it is still going. */}
                    <span className="shrink-0 text-micro font-semibold text-primary">
                      {t('sentProgress', {
                        sent: b.sentCount,
                        total: b.recipientCount,
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-small text-foreground">
                    {preview(b.text)}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    {b.status === 'cancelled' ? (
                      <span className="rounded border border-destructive/30 px-1.5 py-px text-micro font-semibold text-destructive">
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
    </div>
  );
}
