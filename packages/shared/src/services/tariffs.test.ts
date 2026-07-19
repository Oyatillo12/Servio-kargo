import { describe, expect, it } from 'vitest';

import {
  planCreateTariff,
  planDelete,
  planSetActive,
  planSetDefault,
  resolveDefaultId,
  type TariffRow,
} from './tariffs';

const rows = (...r: TariffRow[]) => r;

describe('resolveDefaultId', () => {
  it('finds the default, or undefined when empty', () => {
    expect(resolveDefaultId([])).toBeUndefined();
    expect(
      resolveDefaultId(
        rows(
          { id: 'a', isDefault: false, active: true },
          { id: 'b', isDefault: true, active: true },
        ),
      ),
    ).toBe('b');
  });
});

describe('planCreateTariff (SPEC §5.9)', () => {
  it('forces the first tariff to be the active default', () => {
    const plan = planCreateTariff([], { isDefault: false, active: false });
    expect(plan.isDefault).toBe(true);
    expect(plan.active).toBe(true);
    expect(plan.unsetDefaultIds).toEqual([]);
  });

  it('a new non-default tariff keeps the existing default untouched', () => {
    const plan = planCreateTariff(
      rows({ id: 'a', isDefault: true, active: true }),
      { isDefault: false, active: true },
    );
    expect(plan.isDefault).toBe(false);
    expect(plan.unsetDefaultIds).toEqual([]);
  });

  it('a new default demotes the previous default and is forced active', () => {
    const plan = planCreateTariff(
      rows(
        { id: 'a', isDefault: true, active: true },
        { id: 'b', isDefault: false, active: true },
      ),
      { isDefault: true, active: false },
    );
    expect(plan.isDefault).toBe(true);
    expect(plan.active).toBe(true);
    expect(plan.unsetDefaultIds).toEqual(['a']);
  });
});

describe('planSetDefault', () => {
  it('clears every other default, keeping the target', () => {
    const plan = planSetDefault(
      rows(
        { id: 'a', isDefault: true, active: true },
        { id: 'b', isDefault: false, active: false },
      ),
      'b',
    );
    expect(plan.ok).toBe(true);
    expect(plan.unsetDefaultIds).toEqual(['a']);
  });

  it('fails for an unknown id', () => {
    const plan = planSetDefault(
      rows({ id: 'a', isDefault: true, active: true }),
      'zzz',
    );
    expect(plan.ok).toBe(false);
    expect(plan.error).toBe('NOT_FOUND');
  });
});

describe('planSetActive', () => {
  it('refuses to deactivate the default tariff', () => {
    const res = planSetActive(
      rows({ id: 'a', isDefault: true, active: true }),
      'a',
      false,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('DEFAULT_MUST_STAY_ACTIVE');
  });

  it('allows deactivating a non-default tariff', () => {
    const res = planSetActive(
      rows(
        { id: 'a', isDefault: true, active: true },
        { id: 'b', isDefault: false, active: true },
      ),
      'b',
      false,
    );
    expect(res.ok).toBe(true);
  });

  it('always allows re-activating', () => {
    const res = planSetActive(
      rows({ id: 'b', isDefault: false, active: false }),
      'b',
      true,
    );
    expect(res.ok).toBe(true);
  });
});

describe('planDelete', () => {
  it('refuses to delete the default tariff', () => {
    const res = planDelete(rows({ id: 'a', isDefault: true, active: true }), 'a');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('CANNOT_DELETE_DEFAULT');
  });

  it('allows deleting a non-default tariff', () => {
    const res = planDelete(
      rows(
        { id: 'a', isDefault: true, active: true },
        { id: 'b', isDefault: false, active: true },
      ),
      'b',
    );
    expect(res.ok).toBe(true);
  });
});
