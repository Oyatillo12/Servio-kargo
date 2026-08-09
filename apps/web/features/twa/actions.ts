'use server';

/**
 * Mini App Server Actions (tasks.md: add-track in TWA + language switch).
 * Every action re-runs `getTwaContext` first — an action is a POST endpoint
 * anyone can call, so the TWA session + premium gate are re-checked here,
 * never trusted from the page (CLAUDE.md rule 9 discipline).
 *
 * Add-track mirrors the bot handler line by line via the same shared
 * classifier — one behavior, two doors (SPEC §3.2 / §7.3).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  classifyCandidate,
  isValidTrackCode,
  normalizeCode,
  parseCodeCandidates,
} from '@kargotrack/shared';

import { isUniqueViolation } from '@/lib/queries/internal';
import { getTwaContext } from '@/lib/twa/auth';
import {
  claimTwaTrack,
  createTwaTrack,
  findTwaTrackByCode,
  setTwaCustomerLang,
} from '@/lib/twa/mutations';

export interface AddTracksState {
  /** null until the first submit. */
  result: {
    added: string[];
    claimed: string[];
    otherOwner: string[];
    badFormat: string[];
  } | null;
  error?: boolean;
}

const addSchema = z.object({ codes: z.string().min(1).max(4000) });

export async function addTracksAction(
  tenantId: string,
  _prev: AddTracksState,
  formData: FormData,
): Promise<AddTracksState> {
  const gate = await getTwaContext(tenantId);
  if (gate.state !== 'ok') return { result: null, error: true };
  const { tenant, customer } = gate;

  const parsed = addSchema.safeParse({ codes: formData.get('codes') });
  if (!parsed.success) return { result: null, error: true };

  const createdBy = `customer:${customer.tgUserId ?? customer.id}`;
  const result: NonNullable<AddTracksState['result']> = {
    added: [],
    claimed: [],
    otherOwner: [],
    badFormat: [],
  };

  for (const raw of parseCodeCandidates(parsed.data.codes)) {
    const line = raw.trim();
    const normalized = normalizeCode(line);
    const valid = isValidTrackCode(normalized);

    const existing = valid
      ? await findTwaTrackByCode(tenant.id, normalized)
      : undefined;
    const verdict = classifyCandidate({
      normalized,
      existing: existing ? { customerId: existing.customerId } : null,
      requestingCustomerId: customer.id,
    });

    switch (verdict) {
      case 'added': {
        try {
          await createTwaTrack({
            tenantId: tenant.id,
            customerId: customer.id,
            codeNormalized: normalized,
            codeOriginal: line,
            createdBy,
          });
          result.added.push(normalized);
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
          // Lost a race: the code now exists — re-resolve once (same as bot).
          const now = await findTwaTrackByCode(tenant.id, normalized);
          if (!now) break;
          if (now.customerId == null) {
            if (await claimTwaTrack(now.id, customer.id)) {
              result.claimed.push(normalized);
            } else {
              result.otherOwner.push(normalized);
            }
          } else if (now.customerId === customer.id) {
            // already mine — skip silently (§3.2)
          } else {
            result.otherOwner.push(normalized);
          }
        }
        break;
      }
      case 'claimed': {
        if (await claimTwaTrack(existing!.id, customer.id)) {
          result.claimed.push(normalized);
        } else {
          result.otherOwner.push(normalized);
        }
        break;
      }
      case 'other_owner':
        result.otherOwner.push(normalized);
        break;
      case 'already':
        break; // skip silently (§3.2)
      case 'bad_format':
        result.badFormat.push(line);
        break;
    }
  }

  revalidatePath(`/m/${tenant.id}`, 'layout');
  return { result };
}

const langSchema = z.enum(['uz', 'ru']);

export async function setTwaLangAction(
  tenantId: string,
  lang: string,
): Promise<void> {
  const gate = await getTwaContext(tenantId);
  if (gate.state !== 'ok') return;
  const parsed = langSchema.safeParse(lang);
  if (!parsed.success) return;

  await setTwaCustomerLang(gate.tenant.id, gate.customer.id, parsed.data);
  // Language lives on the customer row — the whole surface re-renders.
  revalidatePath(`/m/${tenantId}`, 'layout');
}
