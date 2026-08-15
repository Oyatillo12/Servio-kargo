/**
 * Support-ticket flow (SPEC §3.13 — D-004/D-006). The customer's side only:
 * staff reply from the panel (§5.16), the bot is the delivery channel.
 *
 * Entry → (existing open ticket? append) / (latest closed? continue-or-new) /
 * (category picker) → text prompt → create/append. The pending-prompt state
 * lives in the session, so a deploy mid-flow survives (bot_sessions).
 */

import { InlineKeyboard } from 'grammy';

import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_META,
  TICKET_STATUS_META,
  clampTicketText,
  type TicketCategory,
} from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { cancelKeyboard } from '../keyboards';
import { logger } from '../logger';
import {
  appendCustomerMessage,
  createTicket,
  findLatestTicket,
  findOpenTicket,
  getTrackById,
} from '../queries';

/** Category label as the customer sees it (rule 5 — shared catalogue). */
function categoryLabel(ctx: KargoContext, category: string): string {
  const meta = TICKET_CATEGORY_META[category as TicketCategory];
  return meta ? `${meta.emoji} ${meta[ctx.lang]}` : category;
}

function statusLabel(ctx: KargoContext, status: string): string {
  const meta = TICKET_STATUS_META[status as keyof typeof TICKET_STATUS_META];
  return meta ? meta[ctx.lang] : status;
}

/** One row per category + a cancel row (§3.13 step 3). */
function categoryKeyboard(ctx: KargoContext): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const c of TICKET_CATEGORIES) {
    kb.text(categoryLabel(ctx, c), `tcat:${c}`).row();
  }
  kb.text(ctx.s.nav.cancel, 'cancel');
  return kb;
}

/** Clear only the ticket flow's own session keys. */
function resetTicketFlow(ctx: KargoContext): void {
  if (ctx.session.step === 'awaiting_ticket_text') ctx.session.step = undefined;
  ctx.session.ticketId = undefined;
  ctx.session.ticketCategory = undefined;
  ctx.session.ticketTrackId = undefined;
}

/**
 * `✍️ Murojaat` — the main entry (§3.13). Decides between appending to the
 * open ticket, offering to continue the closed one, or starting fresh.
 */
export async function ticketMenuHandler(ctx: KargoContext): Promise<void> {
  const s = ctx.s;
  if (!ctx.customer) {
    await ctx.reply(s.ticketRegisterFirst);
    return;
  }
  resetTicketFlow(ctx);

  const open = await findOpenTicket(ctx.tenant.id, ctx.customer.id);
  if (open) {
    ctx.session.step = 'awaiting_ticket_text';
    ctx.session.ticketId = open.id;
    await ctx.reply(
      s.ticketOpenHeader(
        categoryLabel(ctx, open.category),
        statusLabel(ctx, open.status),
      ),
      { reply_markup: cancelKeyboard(s) },
    );
    return;
  }

  const latest = await findLatestTicket(ctx.tenant.id, ctx.customer.id);
  if (latest) {
    // Latest exists and is closed (an open one was handled above): D-006 —
    // continuing REOPENS it; a fresh dispute starts its own thread.
    ctx.session.ticketId = latest.id;
    await ctx.reply(s.ticketClosedChoice(categoryLabel(ctx, latest.category)), {
      reply_markup: new InlineKeyboard()
        .text(s.ticketContinue, 'tcont')
        .text(s.ticketNew, 'tnew')
        .row()
        .text(s.nav.cancel, 'cancel'),
    });
    return;
  }

  await askCategory(ctx);
}

/** `⚠️ Muammo bor` on the customer's own track card — ticket bound to it. */
export async function ticketIssueCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const s = ctx.s;
  if (!ctx.customer) {
    await ctx.reply(s.ticketRegisterFirst);
    return;
  }
  const trackId = ctx.match?.[1];
  if (!trackId) return;

  // Ownership gate, same stance as `track:{id}` (§3.11).
  const track = await getTrackById(ctx.tenant.id, trackId);
  if (!track || track.deletedAt || track.customerId !== ctx.customer.id) return;

  resetTicketFlow(ctx);

  // §3.13 step 1 holds here too — one open dispute at a time. The new message
  // joins the open thread (its track binding stays as it was).
  const open = await findOpenTicket(ctx.tenant.id, ctx.customer.id);
  if (open) {
    ctx.session.step = 'awaiting_ticket_text';
    ctx.session.ticketId = open.id;
    await ctx.reply(
      s.ticketOpenHeader(
        categoryLabel(ctx, open.category),
        statusLabel(ctx, open.status),
      ),
      { reply_markup: cancelKeyboard(s) },
    );
    return;
  }

  ctx.session.ticketTrackId = track.id;
  await askCategory(ctx);
}

async function askCategory(ctx: KargoContext): Promise<void> {
  await ctx.reply(ctx.s.ticketAskCategory, {
    reply_markup: categoryKeyboard(ctx),
  });
}

/** `tcat:{category}` — category picked; ask for the text. */
export async function ticketCategoryCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  if (!ctx.customer) return;
  const category = ctx.match?.[1];
  if (!category || !TICKET_CATEGORIES.includes(category as TicketCategory)) {
    return;
  }

  ctx.session.step = 'awaiting_ticket_text';
  ctx.session.ticketCategory = category;
  ctx.session.ticketId = undefined;
  await stripButtons(ctx);
  await ctx.reply(ctx.s.ticketAskText, {
    reply_markup: cancelKeyboard(ctx.s),
  });
}

/** `tcont` — append to the (closed) latest ticket; the append reopens it. */
export async function ticketContinueCallback(
  ctx: KargoContext,
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (!ctx.customer || !ctx.session.ticketId) return;
  ctx.session.step = 'awaiting_ticket_text';
  await stripButtons(ctx);
  await ctx.reply(ctx.s.ticketAskText, {
    reply_markup: cancelKeyboard(ctx.s),
  });
}

/** `tnew` — a fresh dispute instead of continuing the closed one. */
export async function ticketNewCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  if (!ctx.customer) return;
  resetTicketFlow(ctx);
  await stripButtons(ctx);
  await askCategory(ctx);
}

/**
 * Consume the awaited ticket text (called from the text router). Creates or
 * appends per the session state set by the steps above.
 */
export async function handleTicketText(
  ctx: KargoContext,
  raw: string,
): Promise<void> {
  const s = ctx.s;
  const customer = ctx.customer;
  const { ticketId, ticketCategory, ticketTrackId } = ctx.session;
  resetTicketFlow(ctx);
  if (!customer) return;

  const text = clampTicketText(raw);
  if (!text) {
    await ctx.reply(s.errorGeneric);
    return;
  }

  try {
    if (ticketId) {
      const ok = await appendCustomerMessage({
        tenantId: ctx.tenant.id,
        customerId: customer.id,
        ticketId,
        text,
      });
      await ctx.reply(ok ? s.ticketAppended : s.errorGeneric);
      return;
    }

    if (!ticketCategory) {
      // Session lost its category mid-flow (expired, another device) — start over.
      await askCategory(ctx);
      return;
    }

    const ticket = await createTicket({
      tenantId: ctx.tenant.id,
      customerId: customer.id,
      trackId: ticketTrackId ?? null,
      category: ticketCategory as TicketCategory,
      text,
    });
    await ctx.reply(ticket ? s.ticketCreated : s.errorGeneric);
  } catch (err) {
    logger.error({ err }, 'ticket: failed to save');
    await ctx.reply(s.errorGeneric);
  }
}

/** Remove the inline buttons off the message the callback came from. */
async function stripButtons(ctx: KargoContext): Promise<void> {
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  } catch {
    // Too old to edit or already stripped — cosmetic either way.
  }
}
