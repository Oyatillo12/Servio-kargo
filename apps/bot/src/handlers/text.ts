/**
 * Router for plain text messages. Precedence:
 *   1. a main-menu label (either language) → run that menu action;
 *   2. we're awaiting track codes → add-track flow;
 *   3. otherwise → free-text status lookup / help fallback.
 */

import { parseStaffWeighing } from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { langKeyboard } from '../keyboards';
import { handleAddTracks } from './addTrack';
import { handleCalcWeight, showCalculator } from './calculator';
import { showChinaAddress } from './china';
import { matchMenuAction } from './common';
import { handleLookup } from './lookup';
import { showBalance, showInfo, showMyTracks } from './menu';
import { handleStaffWeighing, isStaff } from './staffWeigh';

/** Clear every pending multi-step flow's session state. */
function resetFlows(ctx: KargoContext): void {
  ctx.session.step = undefined;
  ctx.session.calcTariffId = undefined;
  ctx.session.calcRetried = undefined;
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
        ctx.session.step = 'awaiting_tracks';
        await ctx.reply(ctx.s.askTracks);
        return;
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
      case 'lang':
        await ctx.reply(ctx.s.welcome(ctx.tenant.name), {
          reply_markup: langKeyboard(),
        });
        return;
    }
  }

  if (ctx.session.step === 'awaiting_calc_kg') {
    // Consumed → done; not consumed (second bad number) → fall through to lookup.
    if (await handleCalcWeight(ctx, text)) return;
  }

  if (ctx.session.step === 'awaiting_tracks') {
    ctx.session.step = undefined;
    await handleAddTracks(ctx, text);
    return;
  }

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
