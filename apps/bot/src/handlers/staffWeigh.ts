/**
 * Staff weighing handler (SPEC §3.8). Given a parsed `CODE 3.2` command from a
 * staff member (via plain text in `text.ts`, or a photo caption in
 * `staffPhoto.ts`), set the track's weight + price, advance a CREATED track to
 * CHINA_WAREHOUSE (event + customer notification), or create the track unattached
 * when the code is unknown. Replies with the §4.5 staff strings.
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
import { applyStaffWeighing } from '../queries';

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
      createdBy: `staff:${ctx.from?.id ?? 'unknown'}`,
    });

    if (!result.ok) {
      // USD tenant with no kurs set — can't price the track.
      await ctx.reply(s.errorGeneric);
      return;
    }

    // Link the photo (if any) to the resolved/created track before confirming.
    if (opts.linkPhoto) await opts.linkPhoto(result.track);

    const kg = formatKg(result.track.weightGrams ?? weighing.weightGrams);
    const som = formatSom(result.track.priceTiyin ?? 0);
    const reply = result.created
      ? s.staffSavedNew(result.track.codeOriginal, kg, som)
      : s.staffSaved(result.track.codeOriginal, kg, som);
    await ctx.reply(reply);
  } catch (err) {
    logger.error(
      { err, code: weighing.codeNormalized },
      'staff weighing: failed',
    );
    await ctx.reply(s.staffPhotoError);
  }
}
