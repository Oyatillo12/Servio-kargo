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
              className="flex items-center justify-between gap-3 border-t border-rule-soft py-2.5 first:border-0"
            >
              <div className="min-w-0">
                <p className="text-small font-semibold text-foreground">
                  {t(
                    m.kind === 'notify'
                      ? 'kindNotify'
                      : m.kind === 'reminder'
                        ? 'kindReminder'
                        : m.kind === 'ticket'
                          ? 'kindTicket'
                          : 'kindBroadcast',
                  )}
                </p>
                <p className="mt-0.5 font-mono text-micro text-muted-foreground">
                  {formatDateTime(m.createdAt)}
                </p>
              </div>
              <span
                className={`flex-none rounded-full px-2 py-0.5 text-micro font-semibold ${
                  m.status === 'sent'
                    ? 'bg-[var(--st-ready-bg)] text-success'
                    : m.status === 'dropped'
                      ? 'bg-[var(--st-china-bg)] text-warning'
                      : 'bg-[var(--st-lost-bg)] text-destructive'
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
