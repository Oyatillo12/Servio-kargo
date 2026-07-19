/**
 * Staff weighing mode (SPEC §3.8).
 *
 * A staff message — a photo caption or plain text — of the form `CODE 3.2`
 * (weight in kg, dot or comma decimal) sets a track's weight and price. These
 * two pure helpers keep the parsing and the CREATED→CHINA_WAREHOUSE transition
 * rule framework-free and testable; the DB work lives in the bot's queries.
 */

import { isValidTrackCode, normalizeCode } from '../normalize';
import type { TrackStatus } from '../status';
import { parseKgToGrams } from './calc';
import { shouldEnqueueNotification } from './notify';

export interface StaffWeighing {
  /** Normalized code for matching/insert (SPEC §7.1). */
  codeNormalized: string;
  /** The code exactly as the staff member typed it, for display + storage. */
  codeOriginal: string;
  /** Weight in integer grams (CLAUDE.md rule 6). */
  weightGrams: number;
}

/**
 * Parse a staff weighing command `CODE <kg>` into its code + grams, or `null`
 * when the message isn't a weighing command (so the caller falls through to the
 * normal photo/lookup handling). Requires exactly a code token followed by a
 * single valid kg number — a bare lookup code (one token) or trailing units
 * (`… 3kg`) yield `null`.
 */
export function parseStaffWeighing(input: string): StaffWeighing | null {
  const match = input.trim().match(/^(\S+)\s+(.+)$/);
  const codeToken = match?.[1];
  const weightToken = match?.[2];
  if (codeToken == null || weightToken == null) return null;

  const codeNormalized = normalizeCode(codeToken);
  if (!isValidTrackCode(codeNormalized)) return null;

  const weightGrams = parseKgToGrams(weightToken);
  if (weightGrams == null) return null;

  return { codeNormalized, codeOriginal: codeToken, weightGrams };
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
