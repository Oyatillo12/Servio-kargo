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
