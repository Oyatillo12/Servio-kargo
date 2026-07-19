/**
 * Track-code normalization (SPEC 7.1, CLAUDE.md rule 4).
 *
 * Rule: uppercase, keep only [A-Z0-9] (strip spaces, dashes, punctuation and
 * any non-ASCII-alphanumeric such as CJK), then a normalized code is valid when
 * its length is 8–20.
 *
 * Store `code_normalized` (this output) alongside `code_original`; match user
 * input after applying the same normalization.
 */

export const TRACK_CODE_MIN_LENGTH = 8;
export const TRACK_CODE_MAX_LENGTH = 20;

/**
 * Normalize a raw track-code candidate: uppercase and keep only A–Z / 0–9.
 * Everything else (spaces, dashes, punctuation, CJK, Cyrillic, …) is stripped.
 */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * A *normalized* code is valid when its length is within [8, 20].
 * Pass the output of {@link normalizeCode}; passing a raw string may report
 * false positives because separators inflate the length.
 */
export function isValidTrackCode(normalized: string): boolean {
  return (
    normalized.length >= TRACK_CODE_MIN_LENGTH &&
    normalized.length <= TRACK_CODE_MAX_LENGTH
  );
}
