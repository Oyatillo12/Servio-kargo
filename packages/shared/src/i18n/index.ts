/**
 * i18n for SERVIO Kargo user-facing strings (CLAUDE.md rule 5, SPEC §4).
 *
 * Uzbek (Latin) is the default, Russian secondary. Every customer-facing string
 * lives here — never hardcode text in handlers. The `Strings` interface is the
 * canonical catalogue; `uz` and `ru` implement it and `t(lang)` selects one.
 *
 * NOTE: CLAUDE.md names the path `packages/shared/i18n/{uz,ru}.ts`; we keep it
 * under `src/i18n/` to match this package's actual `src/` layout (as with
 * `normalize.ts`). The strings themselves are canonical per SPEC §4.
 */

import type { TrackStatus } from '../status';

export type Lang = 'uz' | 'ru';

/** Language-selection button labels — identical regardless of current lang. */
export const LANG_BUTTON_UZ = "O'zbekcha 🇺🇿";
export const LANG_BUTTON_RU = 'Русский 🇷🇺';

export interface ReadyDetail {
  /** Formatted kg string, e.g. "1.5". */
  kg: string;
  /** Formatted so'm string (no suffix), e.g. "82 500". */
  som: string;
}

export interface InfoCardVars {
  /**
   * Active-tariff lines, each already formatted as `{name} — {price}` (the
   * price rendered per §7.4: so'm/kg for UZS, `3.5$ / 44 300 so'm` for USD).
   */
  tariffLines: string[];
  /** Formatted so'm rate (no suffix), present only in USD mode → kurs line. */
  usdRateSom?: string;
  /** Omit any of these when the tenant's source field is empty (§3.5). */
  address?: string;
  hours?: string;
  phone?: string;
  /** Free-text info block (prohibited goods, rules, FAQ) — §3.5 point 4. */
  infoText?: string;
}

export interface CalcResultVars {
  tariffName: string;
  /** Formatted kg, e.g. "3.2". */
  kg: string;
  /** Formatted so'm (no suffix), e.g. "176 000". */
  som: string;
  /** Formatted USD amount incl. `$` (e.g. "3.5$"), present only in USD mode. */
  usd?: string;
}

export interface LookupCardVars {
  code: string;
  statusEmoji: string;
  statusLabel: string;
  /** Last event date, DD.MM.YYYY. */
  date: string;
  /** Batch name — present only when the batch line should show (§3.6). */
  batchName?: string;
  /** Batch ETA, DD.MM.YYYY — present only when the batch has an eta_date. */
  batchEta?: string;
  /** Formatted kg, present only when weight is set. */
  kg?: string;
  /** Formatted so'm (no suffix), present only when price is set. */
  som?: string;
  /**
   * Goods description (§7.13) — owner's own card only, never the limited one.
   * Marka and note are panel-only and must never reach this card at all.
   */
  description?: string;
}

export interface ReadyNotifVars {
  code: string;
  kg?: string;
  som?: string;
  pickupAddress: string;
  workingHours: string;
}

export interface Strings {
  // --- §4.1 onboarding & service texts ---
  welcome(tenantName: string): string;
  askPhone: string;
  askPhoneButton: string;
  registered(clientCode: string): string;
  askTracks: string;
  noTracks: string;
  helpFallback: string;
  errorGeneric: string;

  // --- §3.1 main menu labels (reply keyboard) ---
  menuAddTrack: string;
  menuMyTracks: string;
  menuCalculator: string;
  menuBalance: string;
  menuChinaAddress: string;
  menuInfo: string;
  menuLang: string;
  /** §3.13 support-ticket entry. */
  menuTicket: string;
  /** Premium reply-keyboard entry into the Mini App (SPEC §10.1). */
  menuCabinet: string;

  // --- Telegram command-menu descriptions (setMyCommands) ---
  commands: {
    start: string;
    mytracks: string;
    balance: string;
    calc: string;
    info: string;
    manzil: string;
    help: string;
  };

  /**
   * Inline-button labels for the contextual keyboards attached to result
   * messages (SPEC §3.11). Every leaf message ends with at least one of these
   * so a customer is never left in a chat with nowhere to go but the keyboard.
   */
  nav: {
    backToList: string;
    refresh: string;
    myTracks: string;
    addMore: string;
    balance: string;
    cancel: string;
    recalc: string;
    photo: string;
  };

  /** Confirmation after a flow is abandoned via the inline cancel button. */
  cancelled: string;
  /** Callback-answer toast when a refresh found nothing new. */
  refreshedNoChange: string;
  /** Callback-answer toast confirming a refresh applied. */
  refreshed: string;

  /** Language picker prompt for an ALREADY registered customer (§3.7). */
  langChoose: string;

  /** `/help` card — what the bot can do, in one message (§3.12). */
  helpCard: string;

  // --- §4.3 add-track result summary ---
  summaryAdded(n: number, codes: string): string;
  summaryClaimed(n: number, codes: string): string;
  summaryOtherOwner(n: number, codes: string): string;
  summaryBadFormat(n: number, lines: string): string;
  addNothingNew: string;

  // --- §3.3 my tracks ---
  myTracksHeader: string;
  /** Hint under the list: tap a track button to open its full card. */
  myTracksTapHint: string;
  /** Appended to a READY_FOR_PICKUP line when weight/price are set. */
  readyDetail(d: ReadyDetail): string;
  pageIndicator(page: number, pages: number): string;

  // --- §3.4 balance ---
  balanceDebt(som: string): string;
  balanceAdvance(som: string): string;
  balanceZero: string;
  paymentsHeader: string;
  noPayments: string;
  paymentLine(date: string, som: string, method: string): string;
  paymentMethod: Record<'cash' | 'click' | 'payme' | 'other', string>;

  // --- §3.5 info ---
  infoCard(v: InfoCardVars): string;

  // --- §3.6 free-text lookup ---
  lookupCard(v: LookupCardVars): string;
  lookupNotFound(code: string): string;
  /**
   * Line under a limited card shown to a REGISTERED customer who looked up a
   * track that isn't theirs (F1): how to claim it if it is actually theirs.
   * Weight/price/photo are never shown on someone else's track.
   */
  lookupClaimHint: string;

  // --- §3.13 tickets (§4.6 — D-004/D-006) ---
  /** Category picker prompt. */
  ticketAskCategory: string;
  /** Free-text prompt after a category (or continue) is chosen. */
  ticketAskText: string;
  ticketCreated: string;
  ticketAppended: string;
  /** Header + prompt when an open/in_progress ticket already exists. */
  ticketOpenHeader(category: string, status: string): string;
  /** Choice shown when the latest ticket is closed. */
  ticketClosedChoice(category: string): string;
  /** `🔄 Davom ettirish` / `🆕 Yangi murojaat` inline buttons. */
  ticketContinue: string;
  ticketNew: string;
  /** `⚠️ Muammo bor` button on the customer's own track card (§3.6). */
  ticketIssueButton: string;
  /** Unregistered user pressed ✍️ — register first. */
  ticketRegisterFirst: string;
  /** H4: staff reply as delivered to the customer. */
  ticketReply(category: string, text: string): string;
  /** H4: closure notice. */
  ticketClosedNotice(category: string): string;

  // --- §3.9 calculator (§4.5) ---
  /** `1/2 · …` step prefix shown above the tariff picker (§3.11). */
  calcStepTariff: string;
  /** `2/2 · …` step prefix shown above the weight prompt (§3.11). */
  calcStepKg: string;
  calcResult(v: CalcResultVars): string;
  calcInvalid: string;
  /** Calculator opened but the tenant has no active tariff to price against. */
  calcNoTariffs: string;
  /** USD tenant with no kurs set — can't price (config problem, not user error). */
  calcNoRate: string;

  // --- §3.10 China warehouse address (§4.5) ---
  chinaAddrHeader: string;
  chinaAddrFooter(clientCode: string): string;
  chinaAddrMissing(contactPhone: string): string;

  // --- §3.7 language switch ---
  langSwitched: string;

  // --- §3.8 staff mode (weighing + photo) / §4.5 staff strings ---
  staffPhotoNoCaption: string;
  /** `CODE kg → price` saved onto an existing track. */
  staffSaved(code: string, kg: string, som: string): string;
  /** Weighing an unknown code created a new, unattached track. */
  staffSavedNew(code: string, kg: string, som: string): string;
  /** …and the marka named a customer, so it was attached on creation (W5). */
  staffSavedNewOwned(
    code: string,
    kg: string,
    som: string,
    clientCode: string,
  ): string;
  /** Appended line: the marka attached a parcel that had no owner. */
  staffMarkaAttached(clientCode: string): string;
  /**
   * Appended line: the parcel already belongs to somebody else. The weight was
   * still written; the owner was NOT changed.
   */
  staffMarkaConflict(clientCode: string): string;
  /** Appended line: nobody answers to that marka. Not an error — a warning. */
  staffMarkaNotFound(marka: string): string;
  staffPhotoOk(code: string): string;
  staffNotFound(code: string): string;
  staffPhotoTooLarge(maxMb: number): string;
  staffPhotoError: string;

  // --- §5.12 linking a Telegram account to an employee record ---
  /** Confirms the link; `name` is the employee's name, else their phone. */
  staffLinked(name: string): string;
  /** The code matched nothing live in this company. */
  staffLinkNotFound: string;
  /** The code was issued more than 24 hours ago. */
  staffLinkExpired: string;
  /** Somebody in this company already uses this Telegram account. */
  staffLinkTaken: string;

  // --- §4.2 status notifications (strings ready for the deferred sender) ---
  notifChinaWarehouse(code: string): string;
  /** `eta` (DD.MM.YYYY) appends the batch ETA line when the batch has one. */
  notifInTransit(code: string, eta?: string): string;
  notifTashkentWarehouse(code: string): string;
  notifReadyForPickup(v: ReadyNotifVars): string;
  notifDelivered(code: string): string;
  notifSideState(
    code: string,
    statusLabel: string,
    contactPhone: string,
  ): string;

  // --- §4.4 debt reminder ---
  debtReminder(
    name: string,
    tenantName: string,
    debtSom: string,
    contactPhone: string,
  ): string;
}

import { uz } from './uz';
import { ru } from './ru';

export { uz, ru };

const DICTS: Record<Lang, Strings> = { uz, ru };

/** Select the string catalogue for a language (defaults to Uzbek). */
export function t(lang: Lang): Strings {
  return DICTS[lang] ?? uz;
}

/**
 * Build the §4.2 status-change notification for a given status, or `null` for
 * statuses that don't notify (CREATED). Used by the deferred pg-boss sender.
 */
export function statusNotification(
  s: Strings,
  status: TrackStatus,
  vars: {
    code: string;
    kg?: string;
    som?: string;
    pickupAddress: string;
    workingHours: string;
    statusLabel: string;
    contactPhone: string;
    /** Batch ETA (DD.MM.YYYY) for the IN_TRANSIT notification (§4.2). */
    eta?: string;
  },
): string | null {
  switch (status) {
    case 'CHINA_WAREHOUSE':
      return s.notifChinaWarehouse(vars.code);
    case 'IN_TRANSIT':
      return s.notifInTransit(vars.code, vars.eta);
    case 'TASHKENT_WAREHOUSE':
      return s.notifTashkentWarehouse(vars.code);
    case 'READY_FOR_PICKUP':
      return s.notifReadyForPickup({
        code: vars.code,
        kg: vars.kg,
        som: vars.som,
        pickupAddress: vars.pickupAddress,
        workingHours: vars.workingHours,
      });
    case 'DELIVERED':
      return s.notifDelivered(vars.code);
    case 'LOST':
    case 'RETURNED':
      return s.notifSideState(vars.code, vars.statusLabel, vars.contactPhone);
    case 'CREATED':
      return null;
  }
}
