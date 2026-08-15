/**
 * Ticket desk data access (SPEC §5.16, §7.15 — tasks.md H3/H4).
 *
 * Staff reply from the panel ONLY (D-006): every write here is the staff
 * side; the customer side lives in the bot. Every query is tenant-scoped
 * (CLAUDE.md rule 1).
 */

import 'server-only';

import { and, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  adminUsers,
  customers,
  messageLog,
  ticketMessages,
  tickets,
  tracks,
  type Ticket,
  type TicketMessage,
} from '@kargotrack/db/schema';
import type { TicketStatus } from '@kargotrack/shared';

export const TICKETS_PAGE_SIZE = 20;

/** §5.16 chips. `active` = open + in_progress — the queue, not the archive. */
export type TicketListFilter = 'active' | 'open' | 'in_progress' | 'closed' | 'all';

export interface TicketListRow {
  id: string;
  category: Ticket['category'];
  status: TicketStatus;
  lastMessageAt: Date;
  customerId: string;
  customerName: string | null;
  clientCode: string | null;
  trackCode: string | null;
  assignedToName: string | null;
  /** First line of the thread's last message. */
  lastMessageText: string;
}

export interface TicketListResult {
  rows: TicketListRow[];
  total: number;
  page: number;
  pages: number;
}

function filterCondition(filter: TicketListFilter) {
  switch (filter) {
    case 'active':
      return ne(tickets.status, 'closed');
    case 'all':
      return undefined;
    default:
      return eq(tickets.status, filter);
  }
}

/** The §5.16 list: filter chips + newest activity first, paged. */
export async function listTickets(
  tenantId: string,
  filter: TicketListFilter,
  pageArg: number,
): Promise<TicketListResult> {
  const db = getDb();
  const where = and(eq(tickets.tenantId, tenantId), filterCondition(filter));

  const [totalRow] = await db
    .select({ value: count() })
    .from(tickets)
    .where(where);
  const total = totalRow?.value ?? 0;

  const pages = Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(pageArg)), pages);

  const lastMessage = sql<string>`coalesce((
    select tm.text from ${ticketMessages} tm
    where tm.ticket_id = ${tickets.id}
    order by tm.created_at desc limit 1
  ), '')`;

  const rows = await db
    .select({
      id: tickets.id,
      category: tickets.category,
      status: tickets.status,
      lastMessageAt: tickets.lastMessageAt,
      customerId: customers.id,
      customerName: customers.fullName,
      clientCode: customers.clientCode,
      trackCode: tracks.codeOriginal,
      assignedToName: adminUsers.fullName,
      lastMessageText: lastMessage,
    })
    .from(tickets)
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .leftJoin(tracks, eq(tickets.trackId, tracks.id))
    .leftJoin(adminUsers, eq(tickets.assignedTo, adminUsers.id))
    .where(where)
    .orderBy(desc(tickets.lastMessageAt))
    .limit(TICKETS_PAGE_SIZE)
    .offset((page - 1) * TICKETS_PAGE_SIZE);

  return {
    rows: rows.map((r) => ({
      ...r,
      customerId: r.customerId!,
      lastMessageText: r.lastMessageText.split('\n')[0] ?? '',
    })),
    total,
    page,
    pages,
  };
}

/** Open + in-progress count for the dashboard card (H4). */
export async function countOpenTickets(tenantId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(tickets)
    .where(and(eq(tickets.tenantId, tenantId), ne(tickets.status, 'closed')));
  return row?.value ?? 0;
}

export interface TicketThreadMessage {
  id: string;
  author: TicketMessage['author'];
  /** Display name: the staff member's name, or null for the customer/unknown. */
  authorName: string | null;
  text: string;
  createdAt: Date;
  /**
   * H4: how the bot delivery of this STAFF message ended — `null` while still
   * queued (or for customer messages, which were never sent anywhere).
   */
  delivery: 'sent' | 'dropped' | 'failed' | null;
}

export interface TicketDetail {
  ticket: Ticket;
  customer: {
    id: string;
    clientCode: string;
    fullName: string | null;
    phone: string | null;
  };
  track: { id: string; codeOriginal: string } | null;
  messages: TicketThreadMessage[];
  /** Active employees, for the assign select (§5.16). */
  assignees: { id: string; fullName: string | null }[];
}

export async function getTicketDetail(
  tenantId: string,
  ticketId: string,
): Promise<TicketDetail | null> {
  const db = getDb();

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.tenantId, tenantId), eq(tickets.id, ticketId)))
    .limit(1);
  if (!ticket) return null;

  const [customer] = await db
    .select({
      id: customers.id,
      clientCode: customers.clientCode,
      fullName: customers.fullName,
      phone: customers.phone,
    })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        eq(customers.id, ticket.customerId),
      ),
    )
    .limit(1);
  if (!customer) return null;

  let track: TicketDetail['track'] = null;
  if (ticket.trackId) {
    const [row] = await db
      .select({ id: tracks.id, codeOriginal: tracks.codeOriginal })
      .from(tracks)
      .where(and(eq(tracks.tenantId, tenantId), eq(tracks.id, ticket.trackId)))
      .limit(1);
    track = row ?? null;
  }

  const rawMessages = await db
    .select()
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticket.id))
    .orderBy(ticketMessages.createdAt);

  // Resolve staff author names in one query (customer bubbles are named by
  // the customer card above the thread).
  const staffIds = [
    ...new Set(
      rawMessages
        .filter((m) => m.author === 'staff' && m.authorId)
        .map((m) => m.authorId!),
    ),
  ];
  const staffRows = staffIds.length
    ? await db
        .select({ id: adminUsers.id, fullName: adminUsers.fullName })
        .from(adminUsers)
        .where(
          and(
            eq(adminUsers.tenantId, tenantId),
            inArray(adminUsers.id, staffIds),
          ),
        )
    : [];
  const staffNames = new Map(staffRows.map((r) => [r.id, r.fullName]));

  // H4: each staff message's delivery outcome, when the worker has spoken.
  const staffMessageIds = rawMessages
    .filter((m) => m.author === 'staff')
    .map((m) => m.id);
  const outcomeRows = staffMessageIds.length
    ? await db
        .select({
          ticketMessageId: messageLog.ticketMessageId,
          status: messageLog.status,
        })
        .from(messageLog)
        .where(
          and(
            eq(messageLog.tenantId, tenantId),
            inArray(messageLog.ticketMessageId, staffMessageIds),
          ),
        )
    : [];
  const outcomes = new Map(
    outcomeRows
      .filter((r) => r.ticketMessageId != null)
      .map((r) => [r.ticketMessageId!, r.status]),
  );

  const assignees = await db
    .select({ id: adminUsers.id, fullName: adminUsers.fullName })
    .from(adminUsers)
    .where(and(eq(adminUsers.tenantId, tenantId), eq(adminUsers.active, true)))
    .orderBy(adminUsers.fullName);

  return {
    ticket,
    customer,
    track,
    messages: rawMessages.map((m) => ({
      id: m.id,
      author: m.author,
      authorName:
        m.author === 'staff' && m.authorId
          ? (staffNames.get(m.authorId) ?? null)
          : null,
      text: m.text,
      createdAt: m.createdAt,
      delivery: m.author === 'staff' ? (outcomes.get(m.id) ?? null) : null,
    })),
    assignees,
  };
}

/**
 * Append a staff reply (§5.16). One transaction: the message + the
 * `last_message_at` bump. Status is untouched — replying does not close.
 * Returns the new message id (for the delivery job), or null when the ticket
 * isn't this tenant's.
 */
export async function addStaffReply(args: {
  tenantId: string;
  ticketId: string;
  adminId: string;
  text: string;
}): Promise<string | null> {
  return getDb().transaction(async (tx) => {
    const [ticket] = await tx
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        and(eq(tickets.tenantId, args.tenantId), eq(tickets.id, args.ticketId)),
      )
      .limit(1);
    if (!ticket) return null;

    const [message] = await tx
      .insert(ticketMessages)
      .values({
        tenantId: args.tenantId,
        ticketId: ticket.id,
        author: 'staff',
        authorId: args.adminId,
        text: args.text,
      })
      .returning({ id: ticketMessages.id });
    await tx
      .update(tickets)
      .set({ lastMessageAt: sql`now()` })
      .where(eq(tickets.id, ticket.id));
    return message?.id ?? null;
  });
}

/**
 * Move a ticket's status (§5.16). Returns the previous status when a write
 * happened (so the caller knows a real closure just occurred), else null.
 */
export async function setTicketStatus(args: {
  tenantId: string;
  ticketId: string;
  status: TicketStatus;
}): Promise<TicketStatus | null> {
  const db = getDb();
  const [ticket] = await db
    .select({ id: tickets.id, status: tickets.status })
    .from(tickets)
    .where(
      and(eq(tickets.tenantId, args.tenantId), eq(tickets.id, args.ticketId)),
    )
    .limit(1);
  if (!ticket || ticket.status === args.status) return null;

  await db
    .update(tickets)
    .set({ status: args.status })
    .where(eq(tickets.id, ticket.id));
  return ticket.status;
}

/** Assign (or unassign) a ticket. The id must be this tenant's employee. */
export async function assignTicket(args: {
  tenantId: string;
  ticketId: string;
  adminUserId: string | null;
}): Promise<boolean> {
  const db = getDb();

  if (args.adminUserId != null) {
    // Rule 9: the dropdown offering only active employees is a courtesy —
    // this check is the control.
    const [admin] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(
        and(
          eq(adminUsers.tenantId, args.tenantId),
          eq(adminUsers.id, args.adminUserId),
          eq(adminUsers.active, true),
        ),
      )
      .limit(1);
    if (!admin) return false;
  }

  const rows = await db
    .update(tickets)
    .set({ assignedTo: args.adminUserId })
    .where(
      and(eq(tickets.tenantId, args.tenantId), eq(tickets.id, args.ticketId)),
    )
    .returning({ id: tickets.id });
  return rows.length > 0;
}
