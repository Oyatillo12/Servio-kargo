/**
 * Customer shapes shared between server queries and client components.
 *
 * Deliberately its OWN module, free of `server-only` and of any DB import: the
 * customer picker is a client component and must be able to name this type
 * without pulling `lib/queries.ts` anywhere near the client bundle.
 */

/** Compact customer row for the assignment picker (SPEC §5.3). */
export interface CustomerOption {
  id: string;
  clientCode: string;
  fullName: string | null;
  phone: string | null;
  /** Whether the customer has ever opened the bot (§7.12 — hand-entered = no). */
  hasTelegram: boolean;
}

/** How many matches the assignment picker shows before asking to narrow down. */
export const CUSTOMER_PICKER_LIMIT = 20;
