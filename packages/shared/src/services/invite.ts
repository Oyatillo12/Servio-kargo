/**
 * Panel invitation codes (SPEC §5.12, AUDIT.md T8).
 *
 * An owner never sets a colleague's password. Knowing it would let them sign in
 * as that person, which would quietly void the whole point of writing
 * `created_by` on payments and track events. So the owner creates an invite and
 * the invitee redeems the code to set their own password.
 *
 * Codes are read out loud over a phone in a noisy warehouse, so the alphabet
 * drops every character that gets misheard or mistyped — no `O`/`0`, no `I`/`1`
 * — and redemption normalizes case and separators rather than rejecting them.
 */

/**
 * 32 unambiguous symbols. The size matters twice: it removes modulo bias when
 * mapping a random byte (256 % 32 === 0), and it puts a 6-character code at
 * ~10^9 combinations — far past guessing, while still short enough to dictate.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const INVITE_CODE_LENGTH = 6;

/** How long an invite stays redeemable. Long enough to span a working day. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Draw a code from `randomBytes`.
 *
 * The randomness is injected rather than imported so this module stays pure and
 * bundler-safe — `@kargotrack/shared` is imported by client components, and a
 * top-level `node:crypto` import would follow it into the browser bundle.
 * Callers pass `crypto.randomBytes`; tests pass a fixed sequence.
 */
export function generateInviteCode(
  randomBytes: (size: number) => Uint8Array,
): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    const byte = bytes[i] ?? 0;
    code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Turn whatever the invitee typed into a canonical code, or `null` if it cannot
 * be one. Accepts lower case and any separators, because the code is shown
 * grouped (`ABC-234`) and people type back what they see.
 */
export function normalizeInviteCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== INVITE_CODE_LENGTH) return null;
  for (const ch of cleaned) {
    if (!INVITE_CODE_ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}

/** Group a code for display — `ABC234` → `ABC-234`, easier to read back. */
export function formatInviteCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

export interface InviteState {
  expiresAt: Date;
  acceptedAt: Date | null;
}

/** Why an invite cannot be redeemed, or `null` when it can. */
export type InviteRejection = 'expired' | 'used';

/**
 * Check an invite at redemption time. Both conditions are checked here rather
 * than in the SQL lookup so the caller can tell the person which one it was —
 * "this code was already used" and "this code expired" need different reactions.
 */
export function checkInvite(
  invite: InviteState,
  now: Date = new Date(),
): InviteRejection | null {
  if (invite.acceptedAt !== null) return 'used';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  return null;
}

/** Expiry for an invite created at `now`. */
export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

/** Minimum panel password. Short enough to be typed on a phone, hourly. */
export const MIN_PASSWORD_LENGTH = 8;

/** Whether a chosen password is acceptable. */
export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
