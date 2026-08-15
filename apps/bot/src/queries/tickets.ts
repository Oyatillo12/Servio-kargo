/**
 * Ticket reads/writes driven by the bot (SPEC §3.13, §7.15 — D-004/D-006).
 *
 * Everything here is tenant-scoped AND customer-scoped: the bot only ever
 * touches the interacting customer's own tickets.
 */

import { and, desc, eq, ne, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  customers,
  tenants,
  ticketMessages,
  tickets,
  type Customer,
  type Tenant,
  type Ticket,
  type TicketMessage,
} from '@kargotrack/db/schema';
import {
  ticketStatusAfterMessage,
  type TicketCategory,
} from '@kargotrack/shared';

/** The customer's newest NON-CLOSED ticket, if any (§3.13 entry question). */
export async function findOpenTicket(
  tenantId: string,
  customerId: string,
): Promise<Ticket | undefined> {
  const [row] = await getDb()
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.tenantId, tenantId),
        eq(tickets.customerId, customerId),
        ne(tickets.status, 'closed'),
      ),
    )
    .orderBy(desc(tickets.lastMessageAt))
    .limit(1);
  return row;
}

/** The customer's newest ticket of ANY status (for the closed-choice step). */
export async function findLatestTicket(
  tenantId: string,
  customerId: string,
): Promise<Ticket | undefined> {
  const [row] = await getDb()
    .select()
    .from(tickets)
    .where(
      and(eq(tickets.tenantId, tenantId), eq(tickets.customerId, customerId)),
    )
    .orderBy(desc(tickets.lastMessageAt))
    .limit(1);
  return row;
}

/** Create a ticket with its first customer message, in one transaction. */
export async function createTicket(args: {
  tenantId: string;
  customerId: string;
  trackId: string | null;
  category: TicketCategory;
  text: string;
}): Promise<Ticket | undefined> {
  return getDb().transaction(async (tx) => {
    const [ticket] = await tx
      .insert(tickets)
      .values({
        tenantId: args.tenantId,
        customerId: args.customerId,
        trackId: args.trackId,
        category: args.category,
        status: 'open',
      })
      .returning();
    if (!ticket) return undefined;

    await tx.insert(ticketMessages).values({
      tenantId: args.tenantId,
      ticketId: ticket.id,
      author: 'customer',
      authorId: args.customerId,
      text: args.text,
    });
    return ticket;
  });
}

/** Everything the H4 delivery worker needs, re-read fresh per job. */
export interface TicketDeliveryContext {
  tenant: Tenant;
  ticket: Ticket;
  customer: Customer;
  /** The staff message a `reply` job carries; undefined for `closed`. */
  message?: TicketMessage;
}

export async function getTicketDeliveryContext(
  tenantId: string,
  ticketId: string,
  messageId?: string,
): Promise<TicketDeliveryContext | undefined> {
  const db = getDb();
  const [row] = await db
    .select({ tenant: tenants, ticket: tickets, customer: customers })
    .from(tickets)
    .innerJoin(tenants, eq(tickets.tenantId, tenants.id))
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .where(and(eq(tickets.tenantId, tenantId), eq(tickets.id, ticketId)))
    .limit(1);
  if (!row) return undefined;

  let message: TicketMessage | undefined;
  if (messageId) {
    [message] = await db
      .select()
      .from(ticketMessages)
      .where(
        and(
          eq(ticketMessages.id, messageId),
          eq(ticketMessages.ticketId, ticketId),
        ),
      )
      .limit(1);
  }
  return { ...row, message };
}

/**
 * Append a customer message to THEIR ticket. One transaction: the message
 * row, the `last_message_at` bump, and — when the ticket was closed at write
 * time — the D-006 reopen, all land together. Returns false when the ticket
 * doesn't exist or isn't this customer's (nothing written).
 */
export async function appendCustomerMessage(args: {
  tenantId: string;
  customerId: string;
  ticketId: string;
  text: string;
}): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [ticket] = await tx
      .select({ id: tickets.id, status: tickets.status })
      .from(tickets)
      .where(
        and(
          eq(tickets.id, args.ticketId),
          eq(tickets.tenantId, args.tenantId),
          eq(tickets.customerId, args.customerId),
        ),
      )
      .limit(1);
    if (!ticket) return false;

    await tx.insert(ticketMessages).values({
      tenantId: args.tenantId,
      ticketId: ticket.id,
      author: 'customer',
      authorId: args.customerId,
      text: args.text,
    });
    await tx
      .update(tickets)
      .set({
        status: ticketStatusAfterMessage(ticket.status, 'customer'),
        lastMessageAt: sql`now()`,
      })
      .where(eq(tickets.id, ticket.id));
    return true;
  });
}
