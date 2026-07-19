/**
 * i18n for KargoTrack user-facing strings (CLAUDE.md rule 5, SPEC §4).
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
  menuBalance: string;
  menuInfo: string;
  menuLang: string;

  // --- §4.3 add-track result summary ---
  summaryAdded(n: number, codes: string): string;
  summaryClaimed(n: number, codes: string): string;
  summaryOtherOwner(n: number, codes: string): string;
  summaryBadFormat(n: number, lines: string): string;
  addNothingNew: string;

  // --- §3.3 my tracks ---
  myTracksHeader: string;
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

  // --- §3.7 language switch ---
  langSwitched: string;

  // --- §3.8 staff photo mode ---
  staffPhotoNoCaption: string;
  staffPhotoNotFound(code: string): string;
  staffPhotoLinked(code: string): string;
  staffPhotoTooLarge(maxMb: number): string;
  staffPhotoError: string;

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
