import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';

import {
  TICKET_CATEGORY_META,
  TICKET_STATUS_META,
  TICKET_STATUSES,
  formatDateTime,
  type Lang,
  type TicketStatus,
} from '@kargotrack/shared';

import { SectionCard } from '@/components/ui/section-card';
import { requireCapability } from '@/lib/auth';
import { getTicketDetail } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { TicketControls } from '@/features/tickets/components/ticket-controls';
import { TicketReplyForm } from '@/features/tickets/components/ticket-reply-form';

export async function generateMetadata() {
  const t = await getTranslations('tickets');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

/** One dispute's thread + controls (SPEC §5.16, tasks.md H3). */
export default async function TicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tenant } = await requireCapability('tickets.handle');
  const t = await getTranslations('tickets');
  const locale = (await getLocale()) as Lang;

  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const detail = await getTicketDetail(tenant.id, params.id);
  if (!detail) notFound();
  const { ticket, customer, track, messages, assignees } = detail;

  const cat = TICKET_CATEGORY_META[ticket.category];
  const st = TICKET_STATUS_META[ticket.status];
  const statusLabels = Object.fromEntries(
    TICKET_STATUSES.map((s) => [
      s,
      `${TICKET_STATUS_META[s].emoji} ${TICKET_STATUS_META[s][locale]}`,
    ]),
  ) as Record<TicketStatus, string>;

  const deliveryLabels: Record<string, string> = {
    sent: t('deliverySent'),
    dropped: t('deliveryDropped'),
    failed: t('deliveryFailed'),
  };

  return (
    <div className="mx-auto max-w-md space-y-3">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('pageTitle')}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[18px] font-semibold text-foreground">
          {cat.emoji} {cat[locale]}
        </h1>
        <span className="text-[13px] font-semibold">
          {st.emoji} {st[locale]}
        </span>
      </div>

      {/* Who + which parcel */}
      <SectionCard>
        <div className="flex items-center justify-between gap-3 text-[13.5px]">
          <Link
            href={`/customers/${customer.id}`}
            className="min-w-0 truncate font-semibold text-primary underline-offset-2 hover:underline"
          >
            {customer.clientCode}
            {customer.fullName ? ` · ${customer.fullName}` : ''}
          </Link>
          {track ? (
            <Link
              href={`/tracks/${track.id}`}
              className="flex-none font-mono text-[12.5px] text-primary underline-offset-2 hover:underline"
            >
              {track.codeOriginal}
            </Link>
          ) : null}
        </div>
        {customer.phone ? (
          <p className="mt-1 font-mono text-[12px] text-muted-foreground">
            {customer.phone}
          </p>
        ) : null}
        <div className="mt-3 border-t border-[#eef0f4] pt-3">
          <TicketControls
            ticketId={ticket.id}
            status={ticket.status}
            statusLabels={statusLabels}
            assignedTo={ticket.assignedTo}
            assignees={assignees.map((a) => ({
              id: a.id,
              fullName: a.fullName ?? t('staffFallback'),
            }))}
          />
        </div>
      </SectionCard>

      {/* The thread (§5.16): customer left, staff right. */}
      <SectionCard title={t('thread')}>
        <ol className="space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                'max-w-[85%]',
                m.author === 'staff' ? 'ml-auto text-right' : '',
              )}
            >
              <div
                className={cn(
                  'inline-block whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-left text-[13.5px]',
                  m.author === 'staff'
                    ? 'rounded-br-sm bg-primary text-white'
                    : 'rounded-bl-sm bg-secondary text-foreground',
                )}
              >
                {m.text}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {m.author === 'staff'
                  ? (m.authorName ?? t('staffFallback'))
                  : (customer.fullName ?? customer.clientCode)}
                {' · '}
                <span className="font-mono">{formatDateTime(m.createdAt)}</span>
                {m.author === 'staff' ? (
                  <>
                    {' · '}
                    <span
                      className={cn(
                        m.delivery === 'sent' && 'text-emerald-700',
                        (m.delivery === 'dropped' ||
                          m.delivery === 'failed') &&
                          'text-[#b3261e]',
                      )}
                    >
                      {m.delivery
                        ? deliveryLabels[m.delivery]
                        : t('deliveryPending')}
                    </span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          {t('openedAt')}{' '}
          <span className="font-mono">{formatDateTime(ticket.createdAt)}</span>
        </p>
      </SectionCard>

      {/* Reply (§5.16) — saved first, then queued for bot delivery. */}
      <SectionCard title={t('replyTitle')}>
        <TicketReplyForm ticketId={ticket.id} />
      </SectionCard>
    </div>
  );
}
