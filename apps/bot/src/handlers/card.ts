/**
 * Client card (SPEC §3.14, tasks.md L1 — D-009).
 *
 * `🪪 Mening kartam` → a QR of the customer's client_code, captioned with the
 * code itself. The customer shows it at the counter and the employee scans it
 * into the picker (§5.15) or the /weigh marka field (§5.14).
 *
 * The QR carries the PLAIN code, nothing signed: it selects a customer at a
 * desk where the employee then reads their name, phone and balance before
 * doing anything, and that code is already written on their boxes (§7.13).
 * The readable code under the image is the fallback that matters — a scuffed
 * print, a dead camera, or a customer reading it down the phone.
 */

import { InputFile } from 'grammy';
import QRCode from 'qrcode';

import type { KargoContext } from '../context';

/**
 * QR pixel size. Big enough that a mid-range phone camera locks on from a
 * counter's distance, small enough that Telegram does not recompress it into
 * mush — the image is useless if it cannot be scanned.
 */
const QR_WIDTH = 600;

/** Render a client code as a PNG buffer. */
async function renderQr(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: 'png',
    width: QR_WIDTH,
    // A quiet zone smaller than 2 modules breaks detection on some scanners.
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

/** `🪪 Mening kartam` / `/karta` — send the customer their QR card (§3.14). */
export async function showClientCard(ctx: KargoContext): Promise<void> {
  const customer = ctx.customer;
  if (!customer) {
    // Nothing to put on a card yet — same answer the ticket flow gives.
    await ctx.reply(ctx.s.ticketRegisterFirst);
    return;
  }

  const png = await renderQr(customer.clientCode);
  await ctx.replyWithPhoto(new InputFile(png, 'card.png'), {
    caption: ctx.s.cardCaption(customer.clientCode),
    parse_mode: 'HTML',
  });
}
