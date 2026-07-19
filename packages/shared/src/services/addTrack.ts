/**
 * Add-track flow logic (SPEC §3.2, §4.3, §7.3). Pure decisions + summary
 * rendering; the bot handler does the tenant-scoped DB reads/writes.
 */

import type { Strings } from '../i18n';
import { isValidTrackCode, normalizeCode } from '../normalize';

/**
 * Split a raw message into per-code candidate lines. Codes go one per line (the
 * registration text tells users exactly that), so we split on newlines, commas
 * and semicolons — but NOT on interior spaces, because a single code may contain
 * spaces that normalization strips (SPEC §7.1, e.g. `yt-7583 234 uz`). Blank
 * candidates are dropped.
 */
export function parseCodeCandidates(text: string): string[] {
  return text
    .split(/[\n\r,;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export type CandidateVerdict =
  | 'added' // no such code for this tenant → create + attach
  | 'claimed' // existed unattached → attach to this customer
  | 'already' // already attached to this customer → skip silently (§3.2)
  | 'other_owner' // attached to a different customer → refuse politely
  | 'bad_format'; // normalized form fails the 8–20 alnum rule

/** Existing track row for a code, as far as classification cares. */
export interface ExistingTrack {
  customerId: string | null;
}

/**
 * Decide what happens to a single candidate. `existing` is the current DB row
 * for the normalized code (tenant-scoped) or `null` if none exists.
 */
export function classifyCandidate(args: {
  normalized: string;
  existing: ExistingTrack | null;
  requestingCustomerId: string;
}): CandidateVerdict {
  const { normalized, existing, requestingCustomerId } = args;
  if (!isValidTrackCode(normalized)) return 'bad_format';
  if (existing == null) return 'added';
  if (existing.customerId == null) return 'claimed';
  return existing.customerId === requestingCustomerId
    ? 'already'
    : 'other_owner';
}

/** Codes/lines collected per verdict for the summary message. */
export interface AddGroups {
  added: string[];
  claimed: string[];
  otherOwner: string[];
  badFormat: string[];
}

export function emptyAddGroups(): AddGroups {
  return { added: [], claimed: [], otherOwner: [], badFormat: [] };
}

/**
 * Render the §4.3 summary — one message, only non-empty groups. When nothing
 * was added/claimed/refused/rejected (e.g. every code was already the user's),
 * return the "nothing new" fallback so we always reply something.
 */
export function buildAddSummary(groups: AddGroups, s: Strings): string {
  const lines: string[] = [];
  if (groups.added.length > 0) {
    lines.push(s.summaryAdded(groups.added.length, groups.added.join(', ')));
  }
  if (groups.claimed.length > 0) {
    lines.push(
      s.summaryClaimed(groups.claimed.length, groups.claimed.join(', ')),
    );
  }
  if (groups.otherOwner.length > 0) {
    lines.push(
      s.summaryOtherOwner(
        groups.otherOwner.length,
        groups.otherOwner.join(', '),
      ),
    );
  }
  if (groups.badFormat.length > 0) {
    lines.push(
      s.summaryBadFormat(groups.badFormat.length, groups.badFormat.join(', ')),
    );
  }
  return lines.length > 0 ? lines.join('\n') : s.addNothingNew;
}

/** Re-export for convenience so callers can normalize + classify from one module. */
export { normalizeCode, isValidTrackCode };
