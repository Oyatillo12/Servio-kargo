/**
 * Custom grammY context for KargoTrack. Middleware in `bot.ts` loads the tenant
 * and (if any) the customer per update, resolves the effective language, and
 * attaches the i18n string catalogue — so handlers stay thin.
 */

import type { Context, SessionFlavor } from 'grammy';

import type { Customer, Tenant } from '@kargotrack/db/schema';
import type { Lang, Strings } from '@kargotrack/shared';

/** Transient per-chat state for the multi-step flows. */
export interface SessionData {
  /** Language chosen during /start, before a customer row exists. */
  lang?: Lang;
  /** Which prompt we're waiting on. */
  step?: 'awaiting_phone' | 'awaiting_tracks' | 'awaiting_calc_kg';
  /** Calculator (§3.9): the tariff chosen before entering a weight. */
  calcTariffId?: string;
  /** Calculator: whether we've already re-asked once after a bad number (§3.9). */
  calcRetried?: boolean;
}

/** Fields the loading middleware guarantees on every handled update. */
export interface KargoFlavor {
  /** The tenant that owns this bot (loaded fresh each update). */
  tenant: Tenant;
  /** The customer for `ctx.from`, if already registered. */
  customer?: Customer;
  /** Effective language: customer's, else session choice, else 'uz'. */
  lang: Lang;
  /** Resolved string catalogue for `lang`. */
  s: Strings;
}

export type KargoContext = Context & SessionFlavor<SessionData> & KargoFlavor;
