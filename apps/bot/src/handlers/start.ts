/**
 * Registration flow (SPEC §3.1, §4.1) + language switch callback (§3.7).
 *
 * /start → language choice (inline) → phone (contact button) → create/update
 * customer with a client_code → main menu. The same `lang:*` callback is reused
 * by the 🌐 menu button: for an already-registered customer it persists the new
 * language and re-renders the menu instead of asking for a phone.
 */

import type { Lang } from '@kargotrack/shared';
import { t } from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { langKeyboard, mainMenuKeyboard, phoneKeyboard } from '../keyboards';
import { registerCustomer, setCustomerLang } from '../queries';

/** /start — greet and offer the two language buttons. */
export async function startCommand(ctx: KargoContext): Promise<void> {
  ctx.session.step = undefined;
  await ctx.reply(ctx.s.welcome(ctx.tenant.name), {
    reply_markup: langKeyboard(),
  });
}

/** `lang:uz` / `lang:ru` inline callback. */
export async function langCallback(ctx: KargoContext): Promise<void> {
  const chosen = ctx.match?.[1] as Lang | undefined;
  const lang: Lang = chosen === 'ru' ? 'ru' : 'uz';
  ctx.session.lang = lang;
  const s = t(lang);
  await ctx.answerCallbackQuery();

  if (ctx.customer) {
    // Language switch for an existing customer — persist + re-render the menu.
    await setCustomerLang(ctx.customer.id, lang);
    ctx.customer = { ...ctx.customer, lang };
    // Drop the language buttons from the message that offered them: leaving
    // them live invites a second tap that would look like it did nothing.
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {
      // The picker came from a message we can no longer edit — harmless.
    }
    await ctx.reply(s.langSwitched, { reply_markup: mainMenuKeyboard(s) });
    return;
  }

  // New user — proceed to the phone request.
  ctx.session.step = 'awaiting_phone';
  await ctx.reply(s.askPhone, { reply_markup: phoneKeyboard(s) });
}

/** Contact shared → create/update the customer and show the main menu. */
export async function contactHandler(ctx: KargoContext): Promise<void> {
  const contact = ctx.message?.contact;
  const from = ctx.from;
  if (!contact || !from) return;

  const lang: Lang = ctx.session.lang ?? ctx.customer?.lang ?? 'uz';
  const s = t(lang);

  // Only accept the user's OWN phone number (SPEC §3.1).
  if (contact.user_id !== from.id) {
    await ctx.reply(s.askPhone, { reply_markup: phoneKeyboard(s) });
    return;
  }

  const fullName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    [from.first_name, from.last_name].filter(Boolean).join(' ') ||
    from.username ||
    'Mijoz';

  const customer = await registerCustomer({
    tenant: ctx.tenant,
    tgUserId: from.id,
    phone: contact.phone_number,
    fullName,
    lang,
  });
  ctx.customer = customer;
  // The `registered` copy invites the user to send their codes now, so arm the
  // add-tracks flow — a pasted code goes to "add", not the free-text lookup.
  ctx.session.step = 'awaiting_tracks';

  await ctx.reply(s.registered(customer.clientCode), {
    reply_markup: mainMenuKeyboard(s),
  });
  // …and immediately follow with the one-message tour. A brand-new customer is
  // looking at seven unexplained buttons; this is the cheapest moment to say
  // what they do (§3.12).
  await ctx.reply(s.helpCard);
}
