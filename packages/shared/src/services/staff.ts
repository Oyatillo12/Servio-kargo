/**
 * Staff weighing mode (SPEC §3.8).
 *
 * A staff message — a photo caption or plain text — of the form `CODE 3.2`
 * (weight in kg, dot or comma decimal), optionally followed by the marka the
 * customer's boxes are labelled with (`CODE 3.2 DK-1042`), sets a track's
 * weight and price and attributes it. These pure helpers keep the parsing and
 * the CREATED→CHINA_WAREHOUSE transition rule framework-free and testable; the
 * DB work lives in the bot's queries, and what a weighing DOES is decided by
 * `planWeighEntry` — the same planner the panel's /weigh console calls.
 */

import { isValidTrackCode, normalizeCode } from '../normalize';
import type { TrackStatus } from '../status';
import { parseKgToGrams } from './calc';
import { shouldEnqueueNotification } from './notify';

/**
 * Longest marka we accept. A client_code is `DK-1042`-shaped; anything past
 * this is a sentence, and treating it as a customer reference wastes a lookup.
 * Shared with the panel console's input validation so both surfaces agree.
 */
export const MARKA_MAX_LENGTH = 32;

export interface StaffWeighing {
  /** Normalized code for matching/insert (SPEC §7.1). */
  codeNormalized: string;
  /** The code exactly as the staff member typed it, for display + storage. */
  codeOriginal: string;
  /** Weight in integer grams (CLAUDE.md rule 6). */
  weightGrams: number;
  /** The marka as typed, or `null` when the message carried only a weight. */
  marka: string | null;
}

/**
 * Parse a staff weighing command `CODE <kg> [MARKA]` into its parts, or `null`
 * when the message isn't a weighing command (so the caller falls through to the
 * normal photo/lookup handling).
 *
 * Requires a code token, a single valid kg number, and at most one more token.
 * A bare lookup code (one token) or a fourth token yield `null`: past three
 * tokens this is prose, not a command.
 *
 * A third token only counts as a marka if it is marka-SHAPED — a client_code is
 * `<prefix>-<sequence>`, so it always carries a digit. That one rule is what
 * keeps `ABC12345 3.2 kg` meaning "3.2 kg" rather than "3.2 kg for customer
 * 'kg'", without a deny-list of unit words in every language.
 *
 * Whether a customer actually answers to the marka is NOT decided here: that is
 * a database question, and "no such marka" is not an error — the parcel is real
 * either way (tasks.md W2).
 */
export function parseStaffWeighing(input: string): StaffWeighing | null {
  const tokens = input.trim().split(/\s+/);
  if (tokens.length < 2 || tokens.length > 3) return null;

  const [codeToken, weightToken, markaToken] = tokens;
  if (codeToken == null || weightToken == null) return null;

  const codeNormalized = normalizeCode(codeToken);
  if (!isValidTrackCode(codeNormalized)) return null;

  const weightGrams = parseKgToGrams(weightToken);
  if (weightGrams == null) return null;

  if (markaToken != null && !isMarkaShaped(markaToken)) return null;

  return {
    codeNormalized,
    codeOriginal: codeToken,
    weightGrams,
    marka: markaToken ?? null,
  };
}

/** Could this token be a client_code? Length-bounded and carrying a digit. */
export function isMarkaShaped(token: string): boolean {
  return token.length <= MARKA_MAX_LENGTH && /\d/.test(token);
}

export interface StaffWeighingPlan {
  /** Status the track should have after weighing (advances CREATED tracks). */
  newStatus: TrackStatus;
  /** Append a `track_events` row — only on the CREATED→CHINA_WAREHOUSE move. */
  willEvent: boolean;
  /** Enqueue a §4.2 notification for the attached customer. */
  willNotify: boolean;
}

/**
 * Decide the status effect of weighing an existing track (SPEC §3.8): a track
 * still in CREATED advances to CHINA_WAREHOUSE with an audit event and — when a
 * customer is attached — a notification; any other status is left as-is (the
 * weight/price still gets written, but that's not a status change). Mirrors
 * `planStatusChange` so the transition rule lives in one tested place.
 */
export function planStaffWeighing(input: {
  currentStatus: TrackStatus;
  customerId: string | null;
}): StaffWeighingPlan {
  const willEvent = input.currentStatus === 'CREATED';
  const newStatus: TrackStatus = willEvent
    ? 'CHINA_WAREHOUSE'
    : input.currentStatus;
  return {
    willEvent,
    newStatus,
    willNotify:
      willEvent &&
      shouldEnqueueNotification({
        previousStatus: input.currentStatus,
        newStatus,
        customerId: input.customerId,
      }),
  };
}
