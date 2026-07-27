/**
 * Add-track flow (SPEC §3.2, §4.3, §7.3). The user sends one message with one
 * or many codes; we normalize + classify each against the tenant's tracks, act
 * (create / claim / refuse / skip), and reply with the grouped summary.
 */

import {
  buildAddSummary,
  classifyCandidate,
  emptyAddGroups,
  isValidTrackCode,
  normalizeCode,
  parseCodeCandidates,
} from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { addSummaryKeyboard, cancelKeyboard } from '../keyboards';
import {
  claimTrack,
  createTrackForCustomer,
  findTrackByCode,
  isUniqueViolation,
} from '../queries';
import { ensureRegistered } from './common';

/**
 * Open the add-track prompt (SPEC §3.2, §3.11). The prompt owns the customer's
 * next message, so it carries a cancel button — a customer who tapped ➕ by
 * mistake used to have no way back except sending something that failed to
 * parse as a code.
 */
export async function askForTracks(ctx: KargoContext): Promise<void> {
  if (!(await ensureRegistered(ctx))) return;
  ctx.session.step = 'awaiting_tracks';
  await ctx.reply(ctx.s.askTracks, { reply_markup: cancelKeyboard(ctx.s) });
}

/** `addmore` inline callback — re-open the prompt from a summary (§3.11). */
export async function addMoreCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await askForTracks(ctx);
}

export async function handleAddTracks(
  ctx: KargoContext,
  text: string,
): Promise<void> {
  if (!(await ensureRegistered(ctx))) return;
  const customer = ctx.customer!;
  const tenantId = ctx.tenant.id;
  const createdBy = `customer:${ctx.from?.id ?? 'unknown'}`;
  const groups = emptyAddGroups();

  for (const raw of parseCodeCandidates(text)) {
    const line = raw.trim();
    const normalized = normalizeCode(line);
    const valid = isValidTrackCode(normalized);

    const existing = valid
      ? await findTrackByCode(tenantId, normalized)
      : undefined;
    const verdict = classifyCandidate({
      normalized,
      existing: existing ? { customerId: existing.customerId } : null,
      requestingCustomerId: customer.id,
    });

    switch (verdict) {
      case 'added': {
        try {
          await createTrackForCustomer({
            tenantId,
            customerId: customer.id,
            codeNormalized: normalized,
            codeOriginal: line,
            createdBy,
          });
          groups.added.push(normalized);
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
          // Lost a race: the code now exists — re-resolve once.
          await resolveRacedCode(tenantId, normalized, customer.id, groups);
        }
        break;
      }
      case 'claimed': {
        const ok = await claimTrack(existing!.id, customer.id);
        if (ok) groups.claimed.push(normalized);
        else groups.otherOwner.push(normalized); // someone claimed it first
        break;
      }
      case 'other_owner':
        groups.otherOwner.push(normalized);
        break;
      case 'already':
        break; // skip silently (§3.2)
      case 'bad_format':
        groups.badFormat.push(line);
        break;
    }
  }

  await ctx.reply(buildAddSummary(groups, ctx.s), {
    reply_markup: addSummaryKeyboard(ctx.s),
  });
}

/** Re-classify a code that appeared between our read and our insert. */
async function resolveRacedCode(
  tenantId: string,
  normalized: string,
  customerId: string,
  groups: ReturnType<typeof emptyAddGroups>,
): Promise<void> {
  const now = await findTrackByCode(tenantId, normalized);
  if (!now) return; // vanished (soft-deleted) — nothing to report
  if (now.customerId == null) {
    const ok = await claimTrack(now.id, customerId);
    if (ok) groups.claimed.push(normalized);
    else groups.otherOwner.push(normalized);
  } else if (now.customerId !== customerId) {
    groups.otherOwner.push(normalized);
  }
  // else it's already ours now — skip silently
}
