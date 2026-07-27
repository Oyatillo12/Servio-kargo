/**
 * Menu actions: My tracks (§3.3, paginated), Balance (§3.4), Info (§3.5),
 * Help (§3.12) and the inline navigation that ties them together (§3.11).
 */

import type { InlineKeyboard } from 'grammy';

import {
  computeDebtTiyin,
  formatDate,
  formatSom,
  formatUsd,
  paginate,
  sortForDisplay,
} from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { balanceKeyboard, myTracksKeyboard } from '../keyboards';
import {
  getActiveTariffs,
  getTrackById,
  listCustomerPayments,
  listCustomerTracks,
} from '../queries';
import { ensureRegistered, renderTrackLine } from './common';
import { renderTrackCard, sendTrackCard } from './lookup';

/** Build the text + inline keyboard for a My-tracks page. */
async function buildMyTracksView(
  ctx: KargoContext,
  requestedPage: number,
): Promise<{ text: string; keyboard: InlineKeyboard | undefined }> {
  const customer = ctx.customer!;
  const all = await listCustomerTracks(ctx.tenant.id, customer.id);
  if (all.length === 0) {
    return { text: ctx.s.noTracks, keyboard: undefined };
  }
  const sorted = sortForDisplay(all);
  const { slice, page, pages } = paginate(sorted, requestedPage);

  const lines = [ctx.s.myTracksHeader];
  for (const track of slice) lines.push(renderTrackLine(track, ctx));
  if (pages > 1) lines.push('', ctx.s.pageIndicator(page, pages));
  lines.push('', ctx.s.myTracksTapHint);

  return {
    text: lines.join('\n'),
    keyboard: myTracksKeyboard(slice, page, pages, ctx.s),
  };
}

/** 📦 My parcels — first page, as a new message. */
export async function showMyTracks(ctx: KargoContext): Promise<void> {
  if (!(await ensureRegistered(ctx))) return;
  const { text, keyboard } = await buildMyTracksView(ctx, 1);
  await ctx.reply(text, { reply_markup: keyboard });
}

/**
 * `mytracks:{page}` and `mytracks:{page}:refresh` — render a page in place.
 *
 * This is also the "back" target from a track card, which is why it edits
 * rather than replies: opening five parcels and returning to the list used to
 * leave eleven messages in the chat, and the list the customer scrolled back to
 * was a stale copy from the top of that pile.
 */
export async function myTracksPageCallback(ctx: KargoContext): Promise<void> {
  if (!ctx.customer) {
    await ctx.answerCallbackQuery();
    return;
  }
  const requested = Number.parseInt(ctx.match?.[1] ?? '1', 10);
  const isRefresh = ctx.match?.[2] === 'refresh';

  const { text, keyboard } = await buildMyTracksView(ctx, requested);
  let changed = true;
  try {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } catch {
    // "message is not modified" — the page already showed exactly this.
    changed = false;
  }
  await ctx.answerCallbackQuery(
    isRefresh
      ? { text: changed ? ctx.s.refreshed : ctx.s.refreshedNoChange }
      : undefined,
  );
}

/**
 * `track:{id}` / `track:{id}:refresh` — open (or re-read) a track's card.
 *
 * The card replaces the list message so the chat stays one screen deep; the
 * card's own keyboard carries the way back. If the edit fails (a refresh with
 * nothing new, or a source message Telegram won't let us rewrite) the callback
 * is still answered, so the button never spins.
 */
export async function trackDetailCallback(ctx: KargoContext): Promise<void> {
  if (!ctx.customer) {
    await ctx.answerCallbackQuery();
    return;
  }
  const trackId = ctx.match?.[1];
  const isRefresh = ctx.match?.[2] === 'refresh';
  if (!trackId) {
    await ctx.answerCallbackQuery();
    return;
  }

  const track = await getTrackById(ctx.tenant.id, trackId);
  // Only reveal a track the requester actually owns (tenant + ownership scoped).
  if (!track || track.deletedAt || track.customerId !== ctx.customer.id) {
    await ctx.answerCallbackQuery({ text: ctx.s.lookupNotFound(trackId) });
    return;
  }

  const { text, keyboard } = await renderTrackCard(ctx, track, { fromPage: 1 });
  try {
    await ctx.editMessageText(text, { reply_markup: keyboard });
    await ctx.answerCallbackQuery(
      isRefresh ? { text: ctx.s.refreshed } : undefined,
    );
  } catch {
    await ctx.answerCallbackQuery(
      isRefresh ? { text: ctx.s.refreshedNoChange } : undefined,
    );
  }
}

/** `photo:{id}` — send the warehouse photo for a card opened from the list. */
export async function trackPhotoCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  if (!ctx.customer) return;
  const trackId = ctx.match?.[1];
  if (!trackId) return;

  const track = await getTrackById(ctx.tenant.id, trackId);
  if (!track || track.deletedAt || track.customerId !== ctx.customer.id) return;

  // A text message can't be edited into a photo message, so the picture
  // arrives as its own reply and the card above it stays where it was.
  await sendTrackCard(ctx, track);
}

/** 💰 Balance — debt/advance + last 5 payments (§3.4). */
export async function showBalance(ctx: KargoContext): Promise<void> {
  if (!(await ensureRegistered(ctx))) return;
  const customer = ctx.customer!;
  const s = ctx.s;

  const tracks = await listCustomerTracks(ctx.tenant.id, customer.id);
  const payments = await listCustomerPayments(ctx.tenant.id, customer.id);

  const debt = computeDebtTiyin(
    tracks.map((t) => ({
      currentStatus: t.currentStatus,
      priceTiyin: t.priceTiyin,
      deletedAt: t.deletedAt,
    })),
    payments.map((p) => ({ amountTiyin: p.amountTiyin })),
  );

  const head =
    debt > 0
      ? s.balanceDebt(formatSom(debt))
      : debt < 0
        ? s.balanceAdvance(formatSom(Math.abs(debt)))
        : s.balanceZero;

  const lines = [head, ''];
  const last5 = payments.slice(0, 5);
  if (last5.length === 0) {
    lines.push(s.noPayments);
  } else {
    lines.push(s.paymentsHeader);
    for (const p of last5) {
      lines.push(
        s.paymentLine(
          formatDate(p.createdAt),
          formatSom(p.amountTiyin),
          s.paymentMethod[p.method],
        ),
      );
    }
  }

  await ctx.reply(lines.join('\n'), { reply_markup: balanceKeyboard(s) });
}

/** `balance` inline callback — same card, reached from the help fallback. */
export async function balanceCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await showBalance(ctx);
}

/** ℹ️ Info — tenant info card: tariffs, rate, office info (§3.5). */
export async function showInfo(ctx: KargoContext): Promise<void> {
  const tn = ctx.tenant;
  const isUsd = tn.currency === 'USD';

  const activeTariffs = await getActiveTariffs(tn.id);
  // In USD mode show both `3.5$ / 44 300 so'm`; else just so'm/kg.
  const tariffLines = activeTariffs.map((tf) => {
    if (isUsd && tn.usdRateTiyin != null) {
      const somPerKg = Math.round((tf.pricePerKgMinor * tn.usdRateTiyin) / 100);
      return `• ${tf.name} — ${formatUsd(tf.pricePerKgMinor)} / ${formatSom(somPerKg)} so'm`;
    }
    return `• ${tf.name} — ${formatSom(tf.pricePerKgMinor)} so'm/kg`;
  });

  await ctx.reply(
    ctx.s.infoCard({
      tariffLines,
      usdRateSom:
        isUsd && tn.usdRateTiyin != null
          ? formatSom(tn.usdRateTiyin)
          : undefined,
      address: tn.pickupAddress ?? undefined,
      hours: tn.workingHours ?? undefined,
      phone: tn.contactPhone ?? undefined,
      infoText: tn.settings.info_text?.trim() || undefined,
    }),
  );
}

/**
 * `/help` — what the bot can do, in one message (§3.12).
 *
 * The reply keyboard shows seven labels and explains none of them; a customer
 * who has never used a cargo bot has no way to learn that a bare trek code
 * typed into the chat is itself a query. This says so.
 */
export async function showHelp(ctx: KargoContext): Promise<void> {
  await ctx.reply(ctx.s.helpCard);
}

/** `help` inline callback — the same card from the "didn't understand" row. */
export async function helpCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await showHelp(ctx);
}
