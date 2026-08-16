/**
 * Shared handler helpers: registration gating, menu-label matching and the
 * per-track display line.
 */

import {
  formatKg,
  formatSom,
  ru,
  storedChargeableWeight,
  STATUS_META,
  uz,
} from '@kargotrack/shared';
import type { Track } from '@kargotrack/db/schema';

import type { KargoContext } from '../context';
import { langKeyboard } from '../keyboards';

/** Menu action keys, mapped to their i18n label getters. */
export type MenuAction =
  | 'addTrack'
  | 'myTracks'
  | 'calculator'
  | 'balance'
  | 'chinaAddress'
  | 'info'
  | 'card'
  | 'ticket'
  | 'lang';

const MENU_LABEL: Record<MenuAction, (d: typeof uz) => string> = {
  addTrack: (d) => d.menuAddTrack,
  myTracks: (d) => d.menuMyTracks,
  calculator: (d) => d.menuCalculator,
  balance: (d) => d.menuBalance,
  chinaAddress: (d) => d.menuChinaAddress,
  info: (d) => d.menuInfo,
  card: (d) => d.menuCard,
  ticket: (d) => d.menuTicket,
  lang: (d) => d.menuLang,
};

/**
 * Match a text against a menu action in EITHER language, so a button tapped
 * before a language switch (its label is from the old language) still routes.
 */
export function matchMenuAction(text: string): MenuAction | undefined {
  const trimmed = text.trim();
  for (const action of Object.keys(MENU_LABEL) as MenuAction[]) {
    const get = MENU_LABEL[action];
    if (trimmed === get(uz) || trimmed === get(ru)) return action;
  }
  return undefined;
}

/**
 * Ensure the interacting user is a registered customer. If not, kick off
 * registration (welcome + language buttons) and return false so the caller
 * stops.
 */
export async function ensureRegistered(ctx: KargoContext): Promise<boolean> {
  if (ctx.customer) return true;
  ctx.session.step = undefined;
  await ctx.reply(ctx.s.welcome(ctx.tenant.name), {
    reply_markup: langKeyboard(),
  });
  return false;
}

/** Render one My-tracks / listing line: `{emoji} {code}` (+ ready detail). */
export function renderTrackLine(track: Track, ctx: KargoContext): string {
  const meta = STATUS_META[track.currentStatus];
  let line = `${meta.emoji} ${track.codeOriginal}`;
  if (
    track.currentStatus === 'READY_FOR_PICKUP' &&
    track.weightGrams != null &&
    track.priceTiyin != null
  ) {
    // §7.16: the kg on this line sits next to the price, so it has to be the kg
    // that price was built on — a customer doing the arithmetic on the scale
    // reading is a dispute waiting to be written.
    const charged = storedChargeableWeight(
      track.weightGrams,
      track.volumetricGrams,
    );
    line += ctx.s.readyDetail({
      kg: formatKg(charged?.grams ?? track.weightGrams),
      actualKg:
        charged?.basis === 'volumetric'
          ? formatKg(track.weightGrams)
          : undefined,
      som: formatSom(track.priceTiyin),
    });
  }
  return line;
}
