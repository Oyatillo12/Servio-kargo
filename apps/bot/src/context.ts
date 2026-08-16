/**
 * Custom grammY context for SERVIO Kargo. Middleware in `bot.ts` loads the tenant
 * and (if any) the customer per update, resolves the effective language, and
 * attaches the i18n string catalogue — so handlers stay thin.
 */

import type { Context, SessionFlavor } from 'grammy';

import type { AdminUser, Customer, Tenant } from '@kargotrack/db/schema';
import type { Lang, Strings } from '@kargotrack/shared';

/** Transient per-chat state for the multi-step flows. */
export interface SessionData {
  /** Language chosen during /start, before a customer row exists. */
  lang?: Lang;
  /** Which prompt we're waiting on. */
  step?:
    | 'awaiting_phone'
    | 'awaiting_tracks'
    | 'awaiting_calc_kg'
    | 'awaiting_calc_dims'
    | 'awaiting_ticket_text';
  /** Calculator (§3.9): the tariff chosen before entering a weight. */
  calcTariffId?: string;
  /** Calculator: whether we've already re-asked once after a bad number (§3.9). */
  calcRetried?: boolean;
  /** Calculator (§7.16): the weight typed at step 2, kept for the dims step. */
  calcGrams?: number;
  /** Ticket flow (§3.13): the ticket the next message appends to. */
  ticketId?: string;
  /** Ticket flow: category picked for a NEW ticket (no ticketId yet). */
  ticketCategory?: string;
  /** Ticket flow: track the new ticket is bound to (`issue:{id}`, §3.13). */
  ticketTrackId?: string;
}

/** Fields the loading middleware guarantees on every handled update. */
export interface KargoFlavor {
  /** The tenant that owns this bot (loaded fresh each update). */
  tenant: Tenant;
  /** The customer for `ctx.from`, if already registered. */
  customer?: Customer;
  /**
   * The EMPLOYEE for `ctx.from`, if they have linked this Telegram account
   * (SPEC §3.8). The same `admin_users` row the panel signs in, so a role change
   * or a deactivation lands on both surfaces at once — it used to be a bare id
   * in `tenants.settings.staff_tg_ids` with no role and no way to revoke it.
   *
   * Independent of `customer`: an owner may well be their own first customer.
   */
  staff?: AdminUser;
  /** Effective language: customer's, else session choice, else 'uz'. */
  lang: Lang;
  /** Resolved string catalogue for `lang`. */
  s: Strings;
}

export type KargoContext = Context & SessionFlavor<SessionData> & KargoFlavor;
