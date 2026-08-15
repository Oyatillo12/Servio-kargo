/**
 * Ticket domain catalogue + rules (SPEC §3.13, §5.16, §7.15 — D-004, D-006).
 *
 * Pure and framework-free. Category and status display names live HERE
 * (CLAUDE.md rule 5): the bot's picker and the panel's chips must show the
 * same words, and two copies would drift the moment one side is edited.
 */

/** The fixed D-004 category set — cargo disputes' recurring shapes. */
export const TICKET_CATEGORIES = [
  'weight',
  'damage',
  'lost',
  'payment',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_STATUSES = ['open', 'in_progress', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Who wrote a ticket message. */
export const TICKET_AUTHORS = ['customer', 'staff'] as const;
export type TicketAuthor = (typeof TICKET_AUTHORS)[number];

/** §7.15: one message's text cap — fits a Telegram message with headroom. */
export const TICKET_TEXT_MAX = 2000;

export interface TicketLabel {
  emoji: string;
  uz: string;
  ru: string;
}

export const TICKET_CATEGORY_META: Record<TicketCategory, TicketLabel> = {
  weight: { emoji: '⚖️', uz: 'Vazn', ru: 'Вес' },
  damage: { emoji: '📦', uz: 'Shikast', ru: 'Повреждение' },
  lost: { emoji: '🔍', uz: "Yo'qolgan", ru: 'Потеря' },
  payment: { emoji: '💵', uz: "To'lov", ru: 'Оплата' },
  other: { emoji: '✉️', uz: 'Boshqa', ru: 'Другое' },
};

export const TICKET_STATUS_META: Record<TicketStatus, TicketLabel> = {
  open: { emoji: '🟠', uz: 'Ochiq', ru: 'Открыто' },
  in_progress: { emoji: '🔵', uz: 'Jarayonda', ru: 'В работе' },
  closed: { emoji: '✅', uz: 'Yopiq', ru: 'Закрыто' },
};

/**
 * Normalize free ticket text on intake (§7.15): trimmed, truncated to the
 * cap — never refused for length (a customer mid-complaint must not be
 * bounced) — and `null` when nothing usable remains.
 */
export function clampTicketText(raw: string): string | null {
  const s = raw.trim().slice(0, TICKET_TEXT_MAX).trim();
  return s === '' ? null : s;
}

/**
 * The D-006 reopen rule: a CUSTOMER message written into a closed ticket
 * flips it back to open — "the problem came back" must never be silently
 * filed into a closed case. Staff messages never move status implicitly.
 */
export function ticketStatusAfterMessage(
  current: TicketStatus,
  author: TicketAuthor,
): TicketStatus {
  return author === 'customer' && current === 'closed' ? 'open' : current;
}

// --- Delivery queue (tasks.md H4) ------------------------------------------

/** pg-boss queue for staff→customer ticket deliveries (replies + closures). */
export const TICKET_QUEUE = 'ticket';

/**
 * Job payload. Minimal on purpose — the worker re-reads the ticket, message
 * and customer fresh, exactly like NotifyJob does.
 */
export interface TicketJob {
  tenantId: string;
  ticketId: string;
  /** `reply` carries a `messageId`; `closed` announces the closure. */
  kind: 'reply' | 'closed';
  messageId?: string;
}
