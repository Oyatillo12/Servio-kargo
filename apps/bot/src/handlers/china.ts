/**
 * China warehouse address (SPEC §3.10, §4.5). 🇨🇳 → header + the tenant's
 * `china_address_template` rendered in a monospace block with `{client_code}`
 * substituted, then a footer reminding the client to write their code on every
 * box. Empty template → the `china_addr_missing` fallback.
 */

import type { KargoContext } from '../context';
import { ensureRegistered } from './common';

/** Escape the five HTML entities so template text is safe inside `<pre>`. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 🇨🇳 Ombor manzili — the seller-facing shipping address (SPEC §3.10). */
export async function showChinaAddress(ctx: KargoContext): Promise<void> {
  if (!(await ensureRegistered(ctx))) return;
  const customer = ctx.customer!;
  const s = ctx.s;

  const template = ctx.tenant.settings.china_address_template?.trim();
  if (!template) {
    await ctx.reply(s.chinaAddrMissing(ctx.tenant.contactPhone ?? ''));
    return;
  }

  const rendered = template.replaceAll('{client_code}', customer.clientCode);
  const body = [
    escapeHtml(s.chinaAddrHeader),
    `<pre>${escapeHtml(rendered)}</pre>`,
    escapeHtml(s.chinaAddrFooter(customer.clientCode)),
  ].join('\n\n');

  await ctx.reply(body, { parse_mode: 'HTML' });
}
