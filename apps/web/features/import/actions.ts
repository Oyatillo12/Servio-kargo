'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import {
  MAX_CELL_LENGTH,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  TRACK_STATUSES,
  can,
  classifyMappedRows,
  detectImportLayout,
  parseImportText,
  type ColumnMapping,
  type TrackStatus,
} from '@kargotrack/shared';

import { authorize } from '@/lib/auth';
import {
  applyImport,
  getImportTargets,
  resolveCustomerRefs,
  type ImportRow,
} from '@/lib/queries';
import { readXlsxGrid } from '@/lib/xlsx';

const statusSchema = z.enum(
  TRACK_STATUSES as unknown as [TrackStatus, ...TrackStatus[]],
);

/** How many rows of each category the preview lists. The counts stay exact. */
const SAMPLE_LIMIT = 200;
/** Rows shown in the column-mapping table. */
const MAPPING_PREVIEW_ROWS = 6;
/** An .xlsx bigger than this is not a track list (see `serverActions` limit). */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

// --- Source reading ---------------------------------------------------------

type Grid = string[][];

/**
 * Read the uploaded source into a grid. The client re-sends the file (or the
 * pasted text) at every step instead of shipping the parsed grid back and
 * forth: the bytes are smaller than the JSON, and the server re-derives every
 * value from the source, so nothing a client could tamper with reaches a write.
 */
async function readSource(
  formData: FormData,
  t: Awaited<ReturnType<typeof getTranslations>>,
): Promise<
  { grid: Grid; sheetName: string; truncated: boolean } | { error: string }
> {
  const file = formData.get('file');
  const text = (formData.get('text') as string | null) ?? '';

  if (file instanceof File && file.size > 0) {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return { error: t('onlyXlsx') };
    }
    if (file.size > MAX_FILE_BYTES) return { error: t('fileTooBig') };
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { rows, sheetName, truncated } = readXlsxGrid(buffer);
      if (rows.length === 0) return { error: t('emptyFile') };
      return { grid: rows, sheetName, truncated };
    } catch {
      return { error: t('unreadableFile') };
    }
  }

  if (text.trim()) {
    return { grid: gridFromText(text), sheetName: '', truncated: false };
  }
  return { error: t('noInput') };
}

/**
 * Pasted text → grid. A tab anywhere means the admin copied cells out of Excel,
 * so tabs are column separators. Without tabs we keep the historical behaviour
 * exactly: one code per line, commas and semicolons separating codes, never
 * columns (a single code may contain spaces that §7.1 strips).
 */
function gridFromText(text: string): Grid {
  if (text.includes('\t')) {
    return text
      .split(/\r\n|\r|\n/)
      .slice(0, MAX_IMPORT_ROWS)
      .map((line) =>
        line
          .split('\t')
          .slice(0, MAX_IMPORT_COLUMNS)
          .map((cell) => cell.trim().slice(0, MAX_CELL_LENGTH)),
      );
  }
  return parseImportText(text)
    .slice(0, MAX_IMPORT_ROWS)
    .map((line) => [line.trim().slice(0, MAX_CELL_LENGTH)]);
}

// --- Step 1: read the file and guess its layout -----------------------------

export interface SourceResult {
  error?: string;
  ok?: boolean;
  /** First rows, for the mapping table. */
  sample?: Grid;
  columnCount?: number;
  /** Data rows in the whole source (header excluded). */
  rowCount?: number;
  hasHeader?: boolean;
  mapping?: ColumnMapping;
  sheetName?: string;
  /** The file had more rows than `MAX_IMPORT_ROWS` and was cut. */
  truncated?: boolean;
  /** Fields this admin's role may not import (§9) — hidden in the UI. */
  lockedFields?: string[];
}

/** Step 1→2: parse the source, detect the header and guess the columns. */
export async function readImportSourceAction(
  formData: FormData,
): Promise<SourceResult> {
  const auth = await authorize('import.run');
  if (!auth.ok) return { error: auth.error };
  const t = await getTranslations('import');

  const source = await readSource(formData, t);
  if ('error' in source) return { error: source.error };

  const layout = detectImportLayout(source.grid);
  if (!layout.mapping) return { error: t('noCodeColumn') };

  const locked = lockedFields(auth.ctx.role);
  const mapping = { ...layout.mapping };
  if (locked.includes('customer')) mapping.customer = null;
  if (locked.includes('weight')) mapping.weight = null;
  if (locked.includes('price')) mapping.price = null;
  if (locked.includes('description')) mapping.description = null;

  return {
    ok: true,
    sample: source.grid.slice(0, MAPPING_PREVIEW_ROWS),
    columnCount: layout.columnCount,
    rowCount: source.grid.length - (layout.hasHeader ? 1 : 0),
    hasHeader: layout.hasHeader,
    mapping,
    sheetName: source.sheetName,
    truncated: source.truncated,
    lockedFields: locked,
  };
}

/**
 * Columns a role may not fill (CLAUDE.md rule 9). `import.run` is held only by
 * owner and manager today, who also hold both of these — this is the guard that
 * keeps that true if the matrix ever changes, since a Server Action is a POST
 * endpoint any signed-in user can call.
 */
function lockedFields(role: Parameters<typeof can>[0]): string[] {
  const locked: string[] = [];
  if (!can(role, 'tracks.assign')) locked.push('customer');
  if (!can(role, 'tracks.weigh')) locked.push('weight', 'price');
  if (!can(role, 'tracks.edit')) locked.push('description');
  return locked;
}

// --- Step 2→3: preview -------------------------------------------------------

const mappingSchema = z.object({
  code: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_IMPORT_COLUMNS - 1),
  customer: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_IMPORT_COLUMNS - 1)
    .nullable(),
  weight: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_IMPORT_COLUMNS - 1)
    .nullable(),
  price: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_IMPORT_COLUMNS - 1)
    .nullable(),
  description: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_IMPORT_COLUMNS - 1)
    .nullable(),
});

/** A source row worth naming in the preview. */
export interface PreviewLine {
  /** 1-based row number as the spreadsheet shows it. */
  line: number;
  text: string;
}

export interface PreviewResult {
  error?: string;
  ok?: boolean;
  status?: TrackStatus;
  counts?: {
    create: number;
    update: number;
    malformed: number;
    duplicate: number;
    /** Rows that will attach an owner. */
    assign: number;
    /** Owner cells nobody matched. */
    missing: number;
    /** Owner cells several customers answer to — left unattached (§7.12). */
    ambiguous: number;
    /** Rows carrying a usable kg. */
    weight: number;
    /** Rows carrying a usable price. */
    price: number;
    /** Rows whose description will land (fill-empty, §7.13). */
    description: number;
  };
  samples?: {
    create: PreviewLine[];
    update: PreviewLine[];
    malformed: PreviewLine[];
    unresolved: PreviewLine[];
    warnings: PreviewLine[];
  };
}

/** Read the mapping fields out of a FormData, respecting the role's locks. */
function mappingFromForm(
  formData: FormData,
  role: Parameters<typeof can>[0],
): ColumnMapping | null {
  const num = (name: string) => {
    const raw = formData.get(name);
    return raw === null || raw === '' ? null : raw;
  };
  const parsed = mappingSchema.safeParse({
    code: num('col.code') ?? -1,
    customer: num('col.customer'),
    weight: num('col.weight'),
    price: num('col.price'),
    description: num('col.description'),
  });
  if (!parsed.success) return null;

  const locked = lockedFields(role);
  return {
    code: parsed.data.code,
    customer: locked.includes('customer') ? null : parsed.data.customer,
    weight: locked.includes('weight') ? null : parsed.data.weight,
    price: locked.includes('price') ? null : parsed.data.price,
    description: locked.includes('description')
      ? null
      : parsed.data.description,
  };
}

interface ImportPlan {
  rows: ImportRow[];
  counts: NonNullable<PreviewResult['counts']>;
  samples: NonNullable<PreviewResult['samples']>;
}

/**
 * Everything both the preview and the apply need: classify the grid, resolve
 * owners against this tenant, and split new vs existing. Preview and apply run
 * the SAME function, so what the admin confirms is what gets written.
 */
async function buildPlan(
  tenantId: string,
  grid: Grid,
  mapping: ColumnMapping,
  hasHeader: boolean,
): Promise<ImportPlan> {
  const parsed = classifyMappedRows(grid, mapping, hasHeader);

  const refs = parsed.rows
    .map((r) => r.customerRef)
    .filter((r): r is NonNullable<typeof r> => r != null);
  const resolved = await resolveCustomerRefs(tenantId, refs);

  const targets = await getImportTargets(
    tenantId,
    parsed.rows.map((r) => r.normalized),
  );

  const counts = {
    create: 0,
    update: 0,
    malformed: parsed.malformed.length,
    duplicate: parsed.duplicateCount,
    assign: 0,
    missing: 0,
    ambiguous: 0,
    weight: 0,
    price: 0,
    description: 0,
  };
  const samples: ImportPlan['samples'] = {
    create: [],
    update: [],
    malformed: parsed.malformed.slice(0, SAMPLE_LIMIT),
    unresolved: [],
    warnings: parsed.warnings
      .slice(0, SAMPLE_LIMIT)
      .map((w) => ({ line: w.line, text: w.value })),
  };

  const rows: ImportRow[] = [];
  for (const row of parsed.rows) {
    // The counts describe what will CHANGE, not what the file contains: an
    // owner or a weight a track already has is left alone (fill-empty rule),
    // and a preview that counted it anyway would promise work it won't do.
    const target = targets.get(row.normalized);
    let customerId: string | null = null;
    if (row.customerRef) {
      const match = resolved.get(row.customerRef.raw);
      if (match?.status === 'found') {
        customerId = match.id;
        if (!target?.hasCustomer) counts.assign++;
      } else {
        if (match?.status === 'ambiguous') counts.ambiguous++;
        else counts.missing++;
        if (samples.unresolved.length < SAMPLE_LIMIT) {
          samples.unresolved.push({
            line: row.line,
            text: row.customerRef.raw,
          });
        }
      }
    }
    if (row.weightGrams != null && !target?.hasWeight) counts.weight++;
    if (row.priceTiyin != null && !target?.hasPrice) counts.price++;
    if (row.description != null && !target?.hasDescription) {
      counts.description++;
    }

    const isNew = target === undefined;
    const bucket = isNew ? 'create' : 'update';
    if (isNew) counts.create++;
    else counts.update++;
    if (samples[bucket].length < SAMPLE_LIMIT) {
      samples[bucket].push({ line: row.line, text: row.original });
    }

    rows.push({
      original: row.original,
      normalized: row.normalized,
      customerId,
      weightGrams: row.weightGrams,
      priceTiyin: row.priceTiyin,
      // §7.13: the owner cell doubles as the box marking when it has the shape
      // of a client code — a name or phone is a reference, not a marking.
      marka: row.customerRef?.codeKey != null ? row.customerRef.raw : null,
      description: row.description,
    });
  }

  return { rows, counts, samples };
}

/** Step 2→3: classify + resolve, write nothing. */
export async function previewImportAction(
  formData: FormData,
): Promise<PreviewResult> {
  const auth = await authorize('import.run');
  if (!auth.ok) return { error: auth.error };
  const { tenant, role } = auth.ctx;
  const t = await getTranslations('import');

  const status = statusSchema.safeParse(formData.get('status'));
  if (!status.success) return { error: t('pickStatus') };

  const mapping = mappingFromForm(formData, role);
  if (!mapping) return { error: t('pickCodeColumn') };

  const source = await readSource(formData, t);
  if ('error' in source) return { error: source.error };

  const plan = await buildPlan(
    tenant.id,
    source.grid,
    mapping,
    formData.get('hasHeader') === '1',
  );
  if (plan.rows.length === 0 && plan.counts.malformed === 0) {
    return { error: t('noInput') };
  }

  return {
    ok: true,
    status: status.data,
    counts: plan.counts,
    samples: plan.samples,
  };
}

// --- Step 3→4: apply ---------------------------------------------------------

export interface ApplyResult {
  error?: string;
  ok?: boolean;
  created?: number;
  updated?: number;
  queued?: number;
  assigned?: number;
  enriched?: number;
}

/** Step 4: upsert + fill + append events + enqueue notifications (§7.2). */
export async function applyImportAction(
  formData: FormData,
): Promise<ApplyResult> {
  const auth = await authorize('import.run');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin, role } = auth.ctx;
  const t = await getTranslations('import');

  const status = statusSchema.safeParse(formData.get('status'));
  if (!status.success) return { error: t('pickStatus') };

  const batchId = z
    .string()
    .uuid()
    .nullable()
    .safeParse(formData.get('batchId') || null);
  if (!batchId.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  const mapping = mappingFromForm(formData, role);
  if (!mapping) return { error: t('pickCodeColumn') };

  const source = await readSource(formData, t);
  if ('error' in source) return { error: source.error };

  // Re-derived from the uploaded bytes, never from what the client says the
  // preview showed: the codes, the owners and the prices are all recomputed.
  const plan = await buildPlan(
    tenant.id,
    source.grid,
    mapping,
    formData.get('hasHeader') === '1',
  );
  if (plan.rows.length === 0) return { error: t('noInput') };

  const result = await applyImport(
    tenant.id,
    status.data,
    plan.rows,
    admin.id,
    batchId.data,
  );
  revalidatePath('/tracks');
  revalidatePath('/customers');

  return { ok: true, ...result };
}
