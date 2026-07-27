import { getTranslations } from 'next-intl/server';

import { formatDateTime } from '@kargotrack/shared';

import { requireCapability } from '@/lib/auth';
import { listBroadcasts, listCustomerIdsWithTelegram } from '@/lib/queries';
import { PageHeader } from '@/components/layout/page-header';
import { BroadcastForm } from '@/features/broadcast/components/broadcast-form';

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
  const { tenant } = await requireCapability('broadcast.send');
  const t = await getTranslations('broadcast');

  const [recipientIds, history] = await Promise.all([
    listCustomerIdsWithTelegram(tenant.id),
    listBroadcasts(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title={t('pageTitle')} className="mb-0" />

      <BroadcastForm recipientCount={recipientIds.length} />

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
                  <span className="shrink-0 text-[11.5px] font-semibold text-primary">
                    {t('sentCount', { count: b.sentCount })}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-foreground">
                  {preview(b.text)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
