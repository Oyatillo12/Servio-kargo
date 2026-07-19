'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  TRACK_STATUSES,
  classifyImportCandidates,
  normalizeCode,
  isValidTrackCode,
  parseImportText,
  splitAgainstExisting,
  type ImportCode,
  type TrackStatus,
} from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { applyImport, getExistingNormalizedCodes } from '@/lib/queries';
import { readXlsxCandidates } from '@/lib/xlsx';

const statusSchema = z.enum(
  TRACK_STATUSES as unknown as [TrackStatus, ...TrackStatus[]],
);

export interface PreviewResult {
  error?: string;
  ok?: boolean;
  status?: TrackStatus;
  toCreate?: ImportCode[];
  toUpdate?: ImportCode[];
  malformed?: string[];
  duplicateCount?: number;
}

/** Step 1→2: parse xlsx/text, classify, split against the DB. Writes nothing. */
export async function previewImportAction(
  formData: FormData,
): Promise<PreviewResult> {
  const { tenant } = await requireAdmin();

  const status = statusSchema.safeParse(formData.get('status'));
  if (!status.success) return { error: 'Statusni tanlang.' };

  // Prefer an uploaded spreadsheet; fall back to pasted text.
  const file = formData.get('file');
  const text = (formData.get('text') as string | null) ?? '';

  let candidates: string[];
  if (file instanceof File && file.size > 0) {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return { error: 'Faqat .xlsx fayl qabul qilinadi.' };
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      candidates = readXlsxCandidates(buffer);
    } catch {
      return { error: "Faylni o'qib bo'lmadi. .xlsx ekanini tekshiring." };
    }
  } else if (text.trim()) {
    candidates = parseImportText(text);
  } else {
    return { error: 'Fayl yuklang yoki trek kodlarini kiriting.' };
  }

  const classified = classifyImportCandidates(candidates);
  const existing = await getExistingNormalizedCodes(
    tenant.id,
    classified.valid.map((c) => c.normalized),
  );
  const split = splitAgainstExisting(classified.valid, existing);

  return {
    ok: true,
    status: status.data,
    toCreate: split.toCreate,
    toUpdate: split.toUpdate,
    malformed: classified.malformed,
    duplicateCount: classified.duplicateCount,
  };
}

const applySchema = z.object({
  status: statusSchema,
  batchId: z.string().uuid().nullable().optional(),
  codes: z
    .array(z.object({ original: z.string(), normalized: z.string() }))
    .max(50000),
});

export interface ApplyResult {
  error?: string;
  ok?: boolean;
  created?: number;
  updated?: number;
  queued?: number;
}

/** Step 3: upsert + append events + enqueue notifications; optional Reys (§7.2). */
export async function applyImportAction(input: {
  status: TrackStatus;
  batchId?: string | null;
  codes: ImportCode[];
}): Promise<ApplyResult> {
  const { tenant, admin } = await requireAdmin();

  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { error: 'Xatolik yuz berdi.' };

  // Re-normalize server-side (never trust the client's normalized field).
  const seen = new Set<string>();
  const codes: ImportCode[] = [];
  for (const c of parsed.data.codes) {
    const normalized = normalizeCode(c.original);
    if (!isValidTrackCode(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    codes.push({ original: c.original.trim(), normalized });
  }

  const result = await applyImport(
    tenant.id,
    parsed.data.status,
    codes,
    admin.id,
    parsed.data.batchId ?? null,
  );
  revalidatePath('/tracks');

  return { ok: true, ...result };
}
