/**
 * Tariff invariant logic (SPEC §5.9, §7.4).
 *
 * The one rule that must always hold: a tenant has **exactly one active default
 * tariff**. These pure planners decide how a mutation must ripple across the
 * tariff set so the DB layer can apply it in a transaction — keeping the
 * invariant testable and out of scattered SQL (CLAUDE.md coding conventions).
 */

export interface TariffRow {
  id: string;
  isDefault: boolean;
  active: boolean;
}

/** The id of the current default tariff, or undefined if none (empty set). */
export function resolveDefaultId(tariffs: TariffRow[]): string | undefined {
  return tariffs.find((t) => t.isDefault)?.id;
}

export interface CreatePlan {
  /** Default flag for the new row — forced true when it's the first tariff. */
  isDefault: boolean;
  /** Active flag — forced true when the new row is default (default is active). */
  active: boolean;
  /** Existing tariff ids whose `is_default` must be cleared. */
  unsetDefaultIds: string[];
}

/**
 * Plan a tariff creation. The very first tariff is always the active default; a
 * new default demotes the previous one and is forced active.
 */
export function planCreateTariff(
  existing: TariffRow[],
  input: { isDefault: boolean; active: boolean },
): CreatePlan {
  const isFirst = existing.length === 0;
  const isDefault = isFirst || input.isDefault;
  const active = isDefault ? true : input.active;
  const unsetDefaultIds = isDefault
    ? existing.filter((t) => t.isDefault).map((t) => t.id)
    : [];
  return { isDefault, active, unsetDefaultIds };
}

export interface SetDefaultPlan {
  ok: boolean;
  error?: 'NOT_FOUND';
  /** Ids to clear `is_default` on (all current defaults except the target). */
  unsetDefaultIds: string[];
}

/**
 * Plan promoting `id` to the default tariff: it becomes default + active, every
 * other default is cleared. A default is always active (§5.9), so the caller
 * must also force `active = true` on the target.
 */
export function planSetDefault(all: TariffRow[], id: string): SetDefaultPlan {
  if (!all.some((t) => t.id === id)) {
    return { ok: false, error: 'NOT_FOUND', unsetDefaultIds: [] };
  }
  return {
    ok: true,
    unsetDefaultIds: all.filter((t) => t.isDefault && t.id !== id).map((t) => t.id),
  };
}

export interface MutationResult {
  ok: boolean;
  error?: 'NOT_FOUND' | 'DEFAULT_MUST_STAY_ACTIVE' | 'CANNOT_DELETE_DEFAULT';
}

/**
 * Guard toggling a tariff's `active` flag. The default tariff can't be
 * deactivated — promote another tariff to default first (§5.9).
 */
export function planSetActive(
  all: TariffRow[],
  id: string,
  active: boolean,
): MutationResult {
  const target = all.find((t) => t.id === id);
  if (!target) return { ok: false, error: 'NOT_FOUND' };
  if (!active && target.isDefault) {
    return { ok: false, error: 'DEFAULT_MUST_STAY_ACTIVE' };
  }
  return { ok: true };
}

/**
 * Guard deleting a tariff. The default can't be deleted — that would leave the
 * tenant without an active default (§5.9); set another default first.
 */
export function planDelete(all: TariffRow[], id: string): MutationResult {
  const target = all.find((t) => t.id === id);
  if (!target) return { ok: false, error: 'NOT_FOUND' };
  if (target.isDefault) return { ok: false, error: 'CANNOT_DELETE_DEFAULT' };
  return { ok: true };
}
