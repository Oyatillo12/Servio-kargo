/**
 * Linking a Telegram account to an employee record (SPEC §5.12, AUDIT.md T8).
 *
 * A warehouse hand is told one thing: "open the bot and send this code". So the
 * bare code is accepted as a message — no command to remember, no menu to find.
 * That is unambiguous by construction: invite codes are exactly 6 characters and
 * a track code is 8–20, so a message that parses as one can never be the other,
 * and anything that does not parse falls through to the normal lookup.
 */

import { normalizeInviteCode } from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { logger } from '../logger';
import { linkStaffByCode } from '../queries';

/**
 * Try to consume `text` as an invitation code.
 *
 * Returns `true` when the message was handled (linked, or rejected with a
 * reason), `false` when it was not an invite code at all — the caller then
 * carries on with weighing / lookup.
 */
export async function handleStaffLink(
  ctx: KargoContext,
  text: string,
): Promise<boolean> {
  const code = normalizeInviteCode(text);
  if (!code) return false;

  const tgUserId = ctx.from?.id;
  if (tgUserId == null) return false;

  try {
    const res = await linkStaffByCode({
      tenantId: ctx.tenant.id,
      code,
      tgUserId,
    });

    if (res.ok && res.admin) {
      ctx.staff = res.admin;
      await ctx.reply(
        // Falls back to the phone: an owner may have invited them without
        // filling in a name, and the greeting still has to address someone.
        ctx.s.staffLinked(res.admin.fullName ?? res.admin.phone ?? ''),
      );
      return true;
    }

    switch (res.reason) {
      case 'expired':
        await ctx.reply(ctx.s.staffLinkExpired);
        return true;
      case 'taken':
        await ctx.reply(ctx.s.staffLinkTaken);
        return true;
      case 'used':
      case 'not_found':
      default:
        // A well-formed code that matches nothing is far more likely a typo than
        // a probe, and the person is standing in a warehouse waiting — so this
        // says so plainly rather than falling through to "track not found".
        await ctx.reply(ctx.s.staffLinkNotFound);
        return true;
    }
  } catch (err) {
    logger.error({ err }, 'staff link: failed');
    await ctx.reply(ctx.s.errorGeneric);
    return true;
  }
}
