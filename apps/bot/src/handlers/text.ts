/**
 * Router for plain text messages. Precedence:
 *   1. a main-menu label (either language) → run that menu action;
 *   2. we're awaiting track codes → add-track flow;
 *   3. otherwise → free-text status lookup / help fallback.
 */

import { parseStaffWeighing } from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { langKeyboard } from '../keyboards';
import { askForTracks, handleAddTracks } from './addTrack';
import { handleCalcDims, handleCalcWeight, showCalculator } from './calculator';
import { showChinaAddress } from './china';
import { matchMenuAction } from './common';
import { handleLookup } from './lookup';
import { showBalance, showInfo, showMyTracks } from './menu';
import { handleStaffLink } from './staffLink';
import { handleStaffWeighing, isStaff } from './staffWeigh';
import { handleTicketText, ticketMenuHandler } from './tickets';

/** Clear every pending multi-step flow's session state. */
export function resetFlows(ctx: KargoContext): void {
  ctx.session.step = undefined;
  ctx.session.calcTariffId = undefined;
  ctx.session.calcRetried = undefined;
  ctx.session.ticketId = undefined;
  ctx.session.ticketCategory = undefined;
  ctx.session.ticketTrackId = undefined;
}

export async function textRouter(ctx: KargoContext): Promise<void> {
  const text = ctx.message?.text ?? '';

  const action = matchMenuAction(text);
  if (action) {
    // A menu tap ends any pending prompt — except tapping the button that owns
    // that prompt (add-track / calculator start their own flow below).
    if (action !== 'addTrack' && action !== 'calculator') resetFlows(ctx);
    switch (action) {
      case 'addTrack':
        resetFlows(ctx);
        return askForTracks(ctx);
      case 'myTracks':
        return showMyTracks(ctx);
      case 'calculator':
        return showCalculator(ctx);
      case 'balance':
        return showBalance(ctx);
      case 'chinaAddress':
        return showChinaAddress(ctx);
      case 'info':
        return showInfo(ctx);
      case 'ticket':
        return ticketMenuHandler(ctx);
      case 'lang':
        // A registered customer switching language does not need re-greeting;
        // the welcome copy ("welcome to X") read as if they had been logged out.
        await ctx.reply(
          ctx.customer ? ctx.s.langChoose : ctx.s.welcome(ctx.tenant.name),
          { reply_markup: langKeyboard() },
        );
        return;
    }
  }

  if (ctx.session.step === 'awaiting_calc_kg') {
    // Consumed → done; not consumed (second bad number) → fall through to lookup.
    if (await handleCalcWeight(ctx, text)) return;
  }

  if (ctx.session.step === 'awaiting_calc_dims') {
    // §7.16 step 3 — optional, so it always answers with a price in the end.
    if (await handleCalcDims(ctx, text)) return;
  }

  if (ctx.session.step === 'awaiting_tracks') {
    ctx.session.step = undefined;
    await handleAddTracks(ctx, text);
    return;
  }

  if (ctx.session.step === 'awaiting_ticket_text') {
    await handleTicketText(ctx, text);
    return;
  }

  // An invitation code links this Telegram account to an employee record
  // (§5.12). Checked before weighing and lookup because it is what a brand-new
  // warehouse hand sends first, and a 6-character code can never be a track
  // code (8–20), so nothing legitimate is shadowed.
  if (!isStaff(ctx) && (await handleStaffLink(ctx, text))) return;

  // Staff weighing (§3.8): a staff member's free-text `CODE 3.2` weighs the
  // track. Only staff, and only when it parses — otherwise fall through to lookup.
  if (isStaff(ctx)) {
    const weighing = parseStaffWeighing(text);
    if (weighing) {
      await handleStaffWeighing(ctx, weighing);
      return;
    }
  }

  await handleLookup(ctx, text);
}

/**
 * `cancel` inline callback — abandon whatever prompt is pending (§3.11).
 *
 * The prompt message keeps its text but loses its button, so the chat history
 * still shows what was asked while making it obvious the question is closed.
 */
export async function cancelCallback(ctx: KargoContext): Promise<void> {
  resetFlows(ctx);
  await ctx.answerCallbackQuery({ text: ctx.s.cancelled });
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  } catch {
    // Message too old to edit, or already cleared — nothing to undo.
  }
}
