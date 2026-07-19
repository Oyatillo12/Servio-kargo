/**
 * Router for plain text messages. Precedence:
 *   1. a main-menu label (either language) → run that menu action;
 *   2. we're awaiting track codes → add-track flow;
 *   3. otherwise → free-text status lookup / help fallback.
 */

import type { KargoContext } from '../context';
import { langKeyboard } from '../keyboards';
import { handleAddTracks } from './addTrack';
import { matchMenuAction } from './common';
import { handleLookup } from './lookup';
import { showBalance, showInfo, showMyTracks } from './menu';

export async function textRouter(ctx: KargoContext): Promise<void> {
  const text = ctx.message?.text ?? '';

  const action = matchMenuAction(text);
  if (action) {
    // A menu tap ends any pending "awaiting tracks" prompt.
    if (action !== 'addTrack') ctx.session.step = undefined;
    switch (action) {
      case 'addTrack':
        ctx.session.step = 'awaiting_tracks';
        await ctx.reply(ctx.s.askTracks);
        return;
      case 'myTracks':
        return showMyTracks(ctx);
      case 'balance':
        return showBalance(ctx);
      case 'info':
        return showInfo(ctx);
      case 'lang':
        await ctx.reply(ctx.s.welcome(ctx.tenant.name), {
          reply_markup: langKeyboard(),
        });
        return;
    }
  }

  if (ctx.session.step === 'awaiting_tracks') {
    ctx.session.step = undefined;
    await handleAddTracks(ctx, text);
    return;
  }

  await handleLookup(ctx, text);
}
