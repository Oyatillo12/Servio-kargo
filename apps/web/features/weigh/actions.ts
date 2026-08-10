'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import {
  can,
  isValidTrackCode,
  normalizeCode,
  parseKgToGrams,
  MARKA_MAX_LENGTH,
} from '@kargotrack/shared';

import { authorize } from '@/lib/auth';
import { applyPanelWeighing, type WeighedRow } from '@/lib/queries';

/** Which field the console should re-focus after a rejection. */
export type WeighField = 'code' | 'weight' | 'marka';

export interface WeighState {
  row?: WeighedRow;
  error?: string;
  field?: WeighField;
}

// Generous bounds only — the real rules are `isValidTrackCode` (§7.1) and
// `parseKgToGrams` (§3.9), so scanner noise is rejected with a named reason
// rather than a generic "invalid input".
const schema = z.object({
  code: z.string().trim().min(1).max(64),
  weight: z.string().trim().min(1).max(16),
  // Same cap the bot's parser uses, so a marka that is too long to look up is
  // too long on both surfaces.
  marka: z.string().trim().max(MARKA_MAX_LENGTH).nullable().optional(),
});

/**
 * Weigh one parcel from the /weigh console (tasks.md W1/W2, SPEC §3.8).
 *
 * Thin by design: validate, authorize, hand plain data to `applyPanelWeighing`,
 * and return either the finished day-list row or a translated message the client
 * shows in a toast (CLAUDE.md rule 5). The `authorize` call is what actually
 * guards this — a Server Action is a POST endpoint any signed-in user can reach.
 */
export async function weighAction(input: {
  code: string;
  weight: string;
  marka?: string | null;
}): Promise<WeighState> {
  const t = await getTranslations('weigh');

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  const auth = await authorize('tracks.weigh');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin, role } = auth.ctx;

  const codeOriginal = parsed.data.code.trim();
  const codeNormalized = normalizeCode(codeOriginal);
  if (!isValidTrackCode(codeNormalized)) {
    return { error: t('invalidCode'), field: 'code' };
  }

  const weightGrams = parseKgToGrams(parsed.data.weight);
  // Zero is a valid number and a meaningless weight: an untouched scale, not a
  // parcel. Saving it would price the parcel at nothing.
  if (weightGrams == null || weightGrams <= 0) {
    return { error: t('invalidWeight'), field: 'weight' };
  }

  const marka = parsed.data.marka?.trim() || null;
  // Attribution is a second capability, so it gets its own check rather than
  // riding along on `tracks.weigh`.
  if (marka != null && !can(role, 'tracks.assign')) {
    return { error: (await getTranslations('auth'))('forbidden'), field: 'marka' };
  }

  const result = await applyPanelWeighing({
    tenantId: tenant.id,
    currency: tenant.currency,
    usdRateTiyin: tenant.usdRateTiyin,
    codeNormalized,
    codeOriginal,
    weightGrams,
    marka,
    createdBy: admin.id,
  });

  if (!result.ok) {
    return {
      error: result.reason === 'NO_RATE' ? t('noUsdRate') : t('noTariff'),
    };
  }

  // The list and the parcel's own page both changed; the console itself is
  // client-driven and updates from the returned row.
  revalidatePath('/tracks');
  revalidatePath(`/tracks/${result.row.trackId}`);

  return { row: result.row };
}
