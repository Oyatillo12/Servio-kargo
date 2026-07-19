/**
 * Bulk import parsing (SPEC §5.4, §7.1, §7.2). Pure classification of messy
 * candidate tokens (pasted text lines or spreadsheet cells) into valid unique
 * codes vs malformed lines, plus a new/existing split. The web layer does the
 * xlsx reading and the tenant-scoped DB lookups; everything here is pure.
 */

import { isValidTrackCode, normalizeCode } from '../normalize';
import { parseCodeCandidates } from './addTrack';

export interface ImportCode {
  /** Trimmed as-entered form (for display + `code_original`). */
  original: string;
  /** Normalized form (§7.1) used as the upsert key + `code_normalized`. */
  normalized: string;
}

export interface ImportParseResult {
  /** Unique valid codes, first-seen order (within-batch dupes dropped). */
  valid: ImportCode[];
  /** Raw lines whose normalized form fails the 8–20 alnum rule (§7.1). */
  malformed: string[];
  /** How many within-batch duplicate codes were dropped from `valid`. */
  duplicateCount: number;
}

/**
 * Split pasted raw text into candidate lines. Reuses the bot's splitter
 * (newlines / commas / semicolons, NOT interior spaces — a single code may
 * contain spaces that normalization strips, §7.1).
 */
export function parseImportText(text: string): string[] {
  return parseCodeCandidates(text);
}

/**
 * Classify raw candidates into valid unique codes vs malformed lines.
 * De-duplicates within the batch by normalized code (first original wins).
 */
export function classifyImportCandidates(
  candidates: readonly string[],
): ImportParseResult {
  const valid: ImportCode[] = [];
  const malformed: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const raw of candidates) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;

    const normalized = normalizeCode(trimmed);
    if (!isValidTrackCode(normalized)) {
      malformed.push(trimmed);
      continue;
    }
    if (seen.has(normalized)) {
      duplicateCount++;
      continue;
    }
    seen.add(normalized);
    valid.push({ original: trimmed, normalized });
  }

  return { valid, malformed, duplicateCount };
}

// --- Telegram channel-history extraction (demo importer) -------------------
//
// The classifier above is LINE-oriented: it assumes one code per line (the web
// bulk-import UI tells users that). Raw posts copied out of a cargo company's
// public Telegram channel are far messier — codes sit inline among headers,
// dates, emoji, customer names and list markers ("1. YT… — Alisher ✅"). This
// extractor is TOKEN-oriented: it scans every whitespace/punctuation-separated
// token on each line and keeps the ones that normalize to a valid 8–20 code.
// It is pure and MUST NEVER throw on garbage input — each line is parsed inside
// a guard and a line that yields no code is simply counted as skipped.

export interface ChannelExtractResult {
  /** Unique valid codes across the whole file, first-seen order. */
  codes: ImportCode[];
  /** Non-blank lines examined. */
  linesTotal: number;
  /** Lines that yielded at least one new code. */
  linesWithCodes: number;
  /** Lines with no extractable code (headers, dates, chatter, …). */
  linesSkipped: number;
  /** Duplicate codes (same normalized form) dropped from `codes`. */
  duplicateCount: number;
  /** Lines that threw while parsing (defensive; expected to be 0). */
  errorLines: number;
}

/**
 * Leading list marker like `1.`, `2)`, `12. ` at the very start of a line —
 * stripped so `3.JD001234567890` doesn't keep a stray `3`. Only `.`/`)` markers
 * (trailing space optional); a leading dash is left alone because dashes belong
 * inside codes (`12-3456-7890`).
 */
const LEADING_LIST_MARKER = /^\s*\d{1,3}[.)]\s*/;
/** Split a line into candidate tokens on whitespace + code-free punctuation. */
const TOKEN_SEPARATORS = /[\s,;:|·•*"'`()[\]{}<>]+/;
/** dd.mm.yyyy / d-m-yy / d/m (dash-joined dates survive normalization otherwise). */
const DATE_LIKE = /^\d{1,4}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?$/;
/** hh:mm(:ss) — colons are separators, but guard the glued form too. */
const TIME_LIKE = /^\d{1,2}:\d{2}(?::\d{2})?$/;
/** A phone number: leading + then only digits/formatting. */
const PHONE_LIKE = /^\+[\d()\-.]+$/;

/** Obvious non-codes that happen to pass the 8–20 length rule once normalized. */
function isObviousNonCode(token: string): boolean {
  return DATE_LIKE.test(token) || TIME_LIKE.test(token) || PHONE_LIKE.test(token);
}

/**
 * Channel prose is full of 8+ letter words (place names, Uzbek status words like
 * "topshirildi") that pass the bare 8–20 length rule. A real track code always
 * carries at least one digit, so we require one here. This is stricter than
 * {@link isValidTrackCode} on purpose — it applies only to unstructured channel
 * extraction, never to codes a user typed explicitly into the bot/import UI.
 */
function looksLikeChannelCode(normalized: string): boolean {
  return isValidTrackCode(normalized) && /\d/.test(normalized);
}

/**
 * Extract every plausible track code from raw Telegram-channel text.
 *
 * A "plausible" code is any token that, after {@link normalizeCode}, is 8–20
 * alphanumerics (SPEC §7.1) containing at least one digit (see
 * {@link looksLikeChannelCode}) and is not an obvious date/time/phone. Duplicates
 * (by normalized form) are dropped, first original kept. Blank lines are
 * ignored entirely; every other line is counted as either yielding codes or
 * skipped. Never throws — malformed/garbage lines are caught and counted.
 */
export function extractTrackCodesFromChannel(
  text: string,
): ChannelExtractResult {
  const codes: ImportCode[] = [];
  const seen = new Set<string>();
  let linesTotal = 0;
  let linesWithCodes = 0;
  let linesSkipped = 0;
  let duplicateCount = 0;
  let errorLines = 0;

  // Defensive: accept only strings; anything else yields an empty result.
  const source = typeof text === 'string' ? text : '';
  for (const rawLine of source.split(/\r\n|\r|\n/)) {
    if (rawLine.trim().length === 0) continue; // ignore blank lines
    linesTotal++;
    try {
      const line = rawLine.replace(LEADING_LIST_MARKER, '');
      let foundOnLine = 0;
      for (const token of line.split(TOKEN_SEPARATORS)) {
        if (token.length === 0 || isObviousNonCode(token)) continue;
        const normalized = normalizeCode(token);
        if (!looksLikeChannelCode(normalized)) continue;
        if (seen.has(normalized)) {
          duplicateCount++;
          continue;
        }
        seen.add(normalized);
        codes.push({ original: token.trim(), normalized });
        foundOnLine++;
      }
      if (foundOnLine > 0) linesWithCodes++;
      else linesSkipped++;
    } catch {
      // Pure string ops shouldn't throw, but the contract is "never crash".
      errorLines++;
      linesSkipped++;
    }
  }

  return {
    codes,
    linesTotal,
    linesWithCodes,
    linesSkipped,
    duplicateCount,
    errorLines,
  };
}

export interface ImportSplit {
  /** Codes not yet in the DB → created (SPEC §5.4 "Yangi"). */
  toCreate: ImportCode[];
  /** Codes already in the DB → status updated (SPEC §5.4 "Yangilanadi"). */
  toUpdate: ImportCode[];
}

/**
 * Split valid codes into new vs already-existing, given the set of the tenant's
 * existing normalized codes (§7.2 key = tenant_id + code_normalized).
 */
export function splitAgainstExisting(
  codes: readonly ImportCode[],
  existingNormalized: ReadonlySet<string>,
): ImportSplit {
  const toCreate: ImportCode[] = [];
  const toUpdate: ImportCode[] = [];
  for (const c of codes) {
    if (existingNormalized.has(c.normalized)) toUpdate.push(c);
    else toCreate.push(c);
  }
  return { toCreate, toUpdate };
}
