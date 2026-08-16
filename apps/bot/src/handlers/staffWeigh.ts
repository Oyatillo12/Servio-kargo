/**
 * Staff weighing handler (SPEC §3.8, §5.14). Given a parsed `CODE 3.2 [MARKA]`
 * command from a staff member (via plain text in `text.ts`, or a photo caption
 * in `staffPhoto.ts`), set the track's weight + price, advance a CREATED track
 * to CHINA_WAREHOUSE (event + customer notification), create the track
 * unattached when the code is unknown, and attribute it when a marka names a
 * customer. Replies with the §4.5 staff strings.
 *
 * This is the FALLBACK channel: Telegram is blocked in China, so the panel's
 * /weigh console is the primary surface. Both execute the same shared plan.
 */

import type { Track } from '@kargotrack/db/schema';
import {
  canUseStaffMode,
  formatKg,
  formatSom,
  type StaffWeighing,
} from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { logger } from '../logger';
import { applyStaffWeighing, type StaffWeighingResult } from '../queries';

/**
 * Whether the interacting user may use staff mode (SPEC §3.8).
 *
 * Reads the `admin_users` row the loading middleware attached, not the retired
 * `tenants.settings.staff_tg_ids` list. That matters beyond tidiness: access now
 * ends the moment an owner deactivates the person in the panel, and the row
 * carries a role, so the same predicate can gate more than weighing later
 * (AUDIT.md T8). Every role qualifies — an owner weighs parcels too.
 */
export function isStaff(ctx: KargoContext): boolean {
  const staff = ctx.staff;
  if (!staff) return false;
  return canUseStaffMode({
    tgUserId: staff.tgUserId,
    active: staff.active,
    role: staff.role,
  });
}

export interface StaffWeighOptions {
  /** Link the message's photo to the weighed track (used by the photo flow). */
  linkPhoto?: (track: Track) => Promise<void>;
}

/**
 * Run a weighing command. Assumes the caller has already confirmed the sender is
 * staff and parsed the command. Wrapped so a DB/send failure logs and replies the
 * generic photo error rather than crashing the bot (CLAUDE.md rule 8).
 */
export async function handleStaffWeighing(
  ctx: KargoContext,
  weighing: StaffWeighing,
  opts: StaffWeighOptions = {},
): Promise<void> {
  const s = ctx.s;
  try {
    const result = await applyStaffWeighing({
      tenant: ctx.tenant,
      codeNormalized: weighing.codeNormalized,
      codeOriginal: weighing.codeOriginal,
      weightGrams: weighing.weightGrams,
      marka: weighing.marka,
      createdBy: `staff:${ctx.from?.id ?? 'unknown'}`,
    });

    if (!result.ok) {
      // No default tariff, or a USD tenant with no kurs — the parcel can't be
      // priced, and writing it down as free is worse than saying nothing.
      await ctx.reply(s.errorGeneric);
      return;
    }

    // Link the photo (if any) to the resolved/created track before confirming.
    if (opts.linkPhoto) await opts.linkPhoto(result.track);

    await ctx.reply(weighingReply(ctx, weighing, result));
  } catch (err) {
    logger.error(
      { err, code: weighing.codeNormalized },
      'staff weighing: failed',
    );
    await ctx.reply(s.staffPhotoError);
  }
}

/**
 * The confirmation a warehouse hand reads while still holding the box: what was
 * saved, then — only when there is something to say — what the marka did.
 *
 * `conflict` and `notFound` are warnings, not failures: the weight and price
 * were written either way, and the point of putting them on screen is that the
 * person who can fix it is standing over the parcel right now.
 */
function weighingReply(
  ctx: KargoContext,
  weighing: StaffWeighing,
  result: Extract<StaffWeighingResult, { ok: true }>,
): string {
  const s = ctx.s;
  const code = result.track.codeOriginal;
  const kg = formatKg(result.track.weightGrams ?? weighing.weightGrams);
  const som = formatSom(result.track.priceTiyin ?? 0);
  const owner = result.ownerClientCode;
  // §7.16: the price came from the parcel's stored volume, not the scale. The
  // console shows this as a tag; the fallback channel says it in words, so an
  // operator is never surprised by a price they cannot explain to a customer.
  const volumetric =
    result.basis === 'volumetric'
      ? `\n${s.staffVolumetricNote(formatKg(result.chargeableGrams))}`
      : '';

  if (result.created) {
    const base =
      (result.marka === 'attached' && owner
        ? s.staffSavedNewOwned(code, kg, som, owner)
        : s.staffSavedNew(code, kg, som)) + volumetric;
    return result.marka === 'notFound' && weighing.marka
      ? `${base}\n${s.staffMarkaNotFound(weighing.marka)}`
      : base;
  }

  const base = s.staffSaved(code, kg, som) + volumetric;
  switch (result.marka) {
    case 'attached':
      return owner ? `${base}\n${s.staffMarkaAttached(owner)}` : base;
    case 'conflict':
      return owner ? `${base}\n${s.staffMarkaConflict(owner)}` : base;
    case 'notFound':
      return weighing.marka
        ? `${base}\n${s.staffMarkaNotFound(weighing.marka)}`
        : base;
    default:
      return base;
  }
}
