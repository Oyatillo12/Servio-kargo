import { getTranslations } from 'next-intl/server';

import { formatDateTime } from '@kargotrack/shared';

import { SectionCard } from '@/components/ui/section-card';
import type { CustomerMessageRow } from '@/lib/queries';

/**
 * Outbound message outcomes from `message_log` (AUDIT.md T13). A blocked bot
 * used to be invisible: the worker dropped the send and the panel still looked
 * like the customer was notified. Shared between the customer page and the
 * track detail (tasks.md A3) so the kind/status vocabulary stays in one place.
 */
export async function MessageOutcomesCard({
  messages,
}: {
  messages: CustomerMessageRow[];
}) {
  const t = await getTranslations('messageLog');

  return (
    <SectionCard title={t('title')}>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul>
          {messages.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 border-t border-[#eef0f4] py-2.5 first:border-0"
            >
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-foreground">
                  {t(
                    m.kind === 'notify'
                      ? 'kindNotify'
                      : m.kind === 'reminder'
                        ? 'kindReminder'
                        : 'kindBroadcast',
                  )}
                </p>
                <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                  {formatDateTime(m.createdAt)}
                </p>
              </div>
              <span
                className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  m.status === 'sent'
                    ? 'bg-[#e7f5ec] text-[#177338]'
                    : m.status === 'dropped'
                      ? 'bg-[#fef3c7] text-[#92400e]'
                      : 'bg-[#fee2e2] text-[#b91c1c]'
                }`}
              >
                {t(
                  m.status === 'sent'
                    ? 'statusSent'
                    : m.status === 'dropped'
                      ? 'statusDropped'
                      : 'statusFailed',
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
