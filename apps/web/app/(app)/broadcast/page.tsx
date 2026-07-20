import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/datetime';
import { listBroadcasts, listCustomerIdsWithTelegram } from '@/lib/queries';

import { BroadcastForm } from './broadcast-form';

export const metadata = { title: 'Xabarnoma — SERVIO Kargo' };

/** First 80 chars of the broadcast text, on a single line (SPEC §5.8 history). */
function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

export default async function BroadcastPage() {
  const { tenant } = await requireAdmin();

  const [recipientIds, history] = await Promise.all([
    listCustomerIdsWithTelegram(tenant.id),
    listBroadcasts(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold text-foreground">Xabarnoma</h1>

      <BroadcastForm recipientCount={recipientIds.length} />

      <div>
        <h2 className="mb-2 text-[13.5px] font-semibold text-foreground">
          Yuborilganlar tarixi
        </h2>
        {history.length === 0 ? (
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <p className="text-[13px] text-muted-foreground">
              Hali xabarnoma yuborilmagan.
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
                    {b.sentCount} ta yuborildi
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
