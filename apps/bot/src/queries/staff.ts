/**
 * Employee lookup + Telegram linking for the bot (SPEC §3.8 / §5.12).
 *
 * Staff mode used to be gated by a list of raw Telegram ids in
 * `tenants.settings.staff_tg_ids` — a second, invisible identity system that the
 * panel could not name, role, or revoke. The bot now resolves the same
 * `admin_users` row the panel signs in, so deactivating someone in one place
 * ends their access in both, and the audit trail names one person (AUDIT.md T8).
 */

import { and, eq, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  adminInvites,
  adminUsers,
  type AdminUser,
} from '@kargotrack/db/schema';

/** The employee behind a Telegram id, within this tenant. */
export async function getStaffByTg(
  tenantId: string,
  tgUserId: number,
): Promise<AdminUser | undefined> {
  const [row] = await getDb()
    .select()
    .from(adminUsers)
    .where(
      and(eq(adminUsers.tenantId, tenantId), eq(adminUsers.tgUserId, tgUserId)),
    )
    .limit(1);
  return row;
}

export interface LinkResult {
  ok: boolean;
  /** Why it failed — distinct reasons need distinct replies. */
  reason?: 'not_found' | 'expired' | 'used' | 'taken';
  admin?: AdminUser;
}

/**
 * Link the sender's Telegram account to the employee an invite code names.
 *
 * Deliberately separate from the panel's `acceptInvite`: a warehouse hand may
 * never open the panel at all, so linking must not require them to have set a
 * password first. The code is consumed either way — one invite, one use.
 */
export async function linkStaffByCode(input: {
  tenantId: string;
  code: string;
  tgUserId: number;
  now?: Date;
}): Promise<LinkResult> {
  const db = getDb();
  const now = input.now ?? new Date();

  const [invite] = await db
    .select({
      id: adminInvites.id,
      adminUserId: adminInvites.adminUserId,
      expiresAt: adminInvites.expiresAt,
    })
    .from(adminInvites)
    .where(
      and(
        eq(adminInvites.code, input.code),
        eq(adminInvites.tenantId, input.tenantId),
        isNull(adminInvites.acceptedAt),
      ),
    )
    .limit(1);
  if (!invite) return { ok: false, reason: 'not_found' };
  if (invite.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  // Someone else in this company already holds this Telegram account. Checked
  // before the write so the reply can say so, rather than surfacing a unique
  // violation as the bot's generic error.
  const existing = await getStaffByTg(input.tenantId, input.tgUserId);
  if (existing && existing.id !== invite.adminUserId) {
    return { ok: false, reason: 'taken' };
  }

  return db.transaction(async (tx) => {
    // Re-checked inside the transaction: this is what makes two people racing
    // the same code end with one winner instead of both being told they won.
    const claimed = await tx
      .update(adminInvites)
      .set({ acceptedAt: now })
      .where(
        and(eq(adminInvites.id, invite.id), isNull(adminInvites.acceptedAt)),
      )
      .returning({ id: adminInvites.id });
    if (claimed.length === 0) return { ok: false, reason: 'used' };

    const [admin] = await tx
      .update(adminUsers)
      .set({ tgUserId: input.tgUserId, active: true })
      .where(eq(adminUsers.id, invite.adminUserId))
      .returning();

    return { ok: true, admin };
  });
}
