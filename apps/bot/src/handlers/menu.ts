/**
 * Menu actions: My tracks (§3.3, paginated), Balance (§3.4), Info (§3.5).
 */

import type { InlineKeyboard } from 'grammy';

import {
  computeDebtTiyin,
  formatDate,
  formatSom,
  paginate,
  sortForDisplay,
} from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { paginationKeyboard } from '../keyboards';
import { listCustomerPayments, listCustomerTracks } from '../queries';
import { ensureRegistered, renderTrackLine } from './common';

/** Build the text + pagination keyboard for a My-tracks page. */
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

  return { text: lines.join('\n'), keyboard: paginationKeyboard(page, pages) };
}

/** 📦 Mening yuklarim — first page. */
export async function showMyTracks(ctx: KargoContext): Promise<void> {
  if (!(await ensureRegistered(ctx))) return;
  const { text, keyboard } = await buildMyTracksView(ctx, 1);
  await ctx.reply(text, { reply_markup: keyboard });
}

/** `mytracks:{page}` inline callback — edit the message in place. */
export async function myTracksPageCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  if (!ctx.customer) return;
  const requested = Number.parseInt(ctx.match?.[1] ?? '1', 10);
  const { text, keyboard } = await buildMyTracksView(ctx, requested);
  try {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } catch {
    // "message is not modified" (same page tapped) — safe to ignore.
  }
}

/** 💰 Balans — debt/advance + last 5 payments (§3.4). */
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

  await ctx.reply(lines.join('\n'));
}

/** ℹ️ Ma'lumot — static tenant info card (§3.5). */
export async function showInfo(ctx: KargoContext): Promise<void> {
  const tn = ctx.tenant;
  await ctx.reply(
    ctx.s.infoCard({
      address: tn.pickupAddress ?? '—',
      hours: tn.workingHours ?? '—',
      pricePerKgSom: formatSom(tn.pricePerKgTiyin),
      phone: tn.contactPhone ?? '—',
    }),
  );
}
