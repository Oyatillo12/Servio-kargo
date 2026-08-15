import { describe, expect, it } from 'vitest';

import { planWeighEntry, type WeighInput } from './weigh';

const CUSTOMER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

/** A UZS tenant, 30 000 so'm/kg, weighing 3.2 kg of an unknown code. */
function input(over: Partial<WeighInput> = {}): WeighInput {
  return {
    currency: 'UZS',
    usdRateTiyin: null,
    tariff: { id: 'tariff-1', pricePerKgMinor: 3_000_000 },
    weightGrams: 3200,
    track: null,
    markaTyped: false,
    markaCustomerId: null,
    ...over,
  };
}

/** Narrow to the success branch — a rejected plan in these tests is a failure. */
function plan(over: Partial<WeighInput> = {}) {
  const result = planWeighEntry(input(over));
  if (!result.ok) throw new Error(`unexpected rejection: ${result.reason}`);
  return result;
}

describe('planWeighEntry — pricing (§7.4)', () => {
  it('prices weight × tariff in tiyin for a UZS tenant', () => {
    // 3.2 kg × 30 000 so'm = 96 000 so'm = 9 600 000 tiyin
    expect(plan().pricing).toEqual({
      weightGrams: 3200,
      tariffId: 'tariff-1',
      priceTiyin: 9_600_000,
      priceUsdCents: null,
      usdRateUsed: null,
      priceManual: false,
    });
  });

  it('freezes the kurs onto a USD tenant’s parcel', () => {
    const p = plan({
      currency: 'USD',
      usdRateTiyin: 1_290_000, // 12 900 so'm per USD
      tariff: { id: 'tariff-usd', pricePerKgMinor: 750 }, // $7.50/kg
    });
    expect(p.pricing.priceUsdCents).toBe(2400); // $24.00
    expect(p.pricing.usdRateUsed).toBe(1_290_000);
    expect(p.pricing.priceTiyin).toBe(30_960_000); // 309 600 so'm
  });

  it('refuses a USD tenant with no kurs instead of guessing one', () => {
    expect(planWeighEntry(input({ currency: 'USD', usdRateTiyin: null }))).toEqual(
      { ok: false, reason: 'NO_RATE' },
    );
  });

  it('refuses when no default tariff exists rather than pricing at zero', () => {
    // A parcel written down as free is a debt nobody ever collects.
    expect(planWeighEntry(input({ tariff: null }))).toEqual({
      ok: false,
      reason: 'NO_TARIFF',
    });
  });

  it('always clears a manual price override — weighing is the auto path', () => {
    expect(plan({ track: { currentStatus: 'CHINA_WAREHOUSE', customerId: null } })
      .pricing.priceManual).toBe(false);
  });
});

describe('planWeighEntry — unknown code (§3.8)', () => {
  it('creates the parcel unattached, already at the China warehouse', () => {
    const p = plan();
    expect(p.create).toBe(true);
    expect(p.newStatus).toBe('CHINA_WAREHOUSE');
    expect(p.willEvent).toBe(true);
    expect(p.attachCustomerId).toBeNull();
    expect(p.willNotify).toBe(false);
    expect(p.marka).toEqual({ kind: 'none' });
  });

  it('attaches and notifies when the marka names a customer', () => {
    const p = plan({ markaTyped: true, markaCustomerId: CUSTOMER });
    expect(p.create).toBe(true);
    expect(p.attachCustomerId).toBe(CUSTOMER);
    expect(p.willNotify).toBe(true);
    expect(p.notifyCustomerId).toBe(CUSTOMER);
    expect(p.marka).toEqual({ kind: 'attached', customerId: CUSTOMER });
  });

  it('still creates the parcel when the marka matches nobody', () => {
    // W2: an unknown marka is not an error — the parcel is real either way.
    const p = plan({ markaTyped: true, markaCustomerId: null });
    expect(p.create).toBe(true);
    expect(p.attachCustomerId).toBeNull();
    expect(p.willNotify).toBe(false);
    expect(p.marka).toEqual({ kind: 'notFound' });
  });
});

describe('planWeighEntry — existing parcel (§3.8)', () => {
  it('advances a CREATED parcel and notifies its owner', () => {
    const p = plan({ track: { currentStatus: 'CREATED', customerId: CUSTOMER } });
    expect(p.create).toBe(false);
    expect(p.newStatus).toBe('CHINA_WAREHOUSE');
    expect(p.willEvent).toBe(true);
    expect(p.willNotify).toBe(true);
    expect(p.notifyCustomerId).toBe(CUSTOMER);
  });

  it('advances an unowned CREATED parcel with an event but no message', () => {
    const p = plan({ track: { currentStatus: 'CREATED', customerId: null } });
    expect(p.newStatus).toBe('CHINA_WAREHOUSE');
    expect(p.willEvent).toBe(true);
    expect(p.willNotify).toBe(false);
    expect(p.notifyCustomerId).toBeNull();
  });

  it('re-weighs a parcel further down the pipeline without touching its status', () => {
    const p = plan({
      track: { currentStatus: 'IN_TRANSIT', customerId: CUSTOMER },
      weightGrams: 4000,
    });
    expect(p.newStatus).toBe('IN_TRANSIT');
    expect(p.willEvent).toBe(false);
    expect(p.willNotify).toBe(false);
    expect(p.pricing.priceTiyin).toBe(12_000_000); // the new weight IS written
  });
});

describe('planWeighEntry — marka against an existing parcel (W2)', () => {
  it('attaches an unowned parcel and notifies the new owner of the arrival', () => {
    // The message is about the parcel ARRIVING, and they are its owner at the
    // instant the event is written — which is the point of the marka.
    const p = plan({
      track: { currentStatus: 'CREATED', customerId: null },
      markaTyped: true,
      markaCustomerId: CUSTOMER,
    });
    expect(p.attachCustomerId).toBe(CUSTOMER);
    expect(p.marka).toEqual({ kind: 'attached', customerId: CUSTOMER });
    expect(p.willNotify).toBe(true);
    expect(p.notifyCustomerId).toBe(CUSTOMER);
  });

  it('writes nothing extra when the marka is the owner it already has', () => {
    const p = plan({
      track: { currentStatus: 'CREATED', customerId: CUSTOMER },
      markaTyped: true,
      markaCustomerId: CUSTOMER,
    });
    expect(p.attachCustomerId).toBeNull();
    expect(p.marka).toEqual({ kind: 'alreadyOwned' });
    expect(p.willNotify).toBe(true); // still the CREATED→CHINA_WAREHOUSE message
  });

  it('never moves a parcel off its owner — it saves the weight and warns', () => {
    // A mistyped marka must not move a parcel, and its debt, onto the wrong
    // person. The weight is still worth keeping; the owner is not ours to change.
    const p = plan({
      track: { currentStatus: 'CHINA_WAREHOUSE', customerId: OTHER },
      markaTyped: true,
      markaCustomerId: CUSTOMER,
    });
    expect(p.attachCustomerId).toBeNull();
    expect(p.marka).toEqual({ kind: 'conflict' });
    expect(p.pricing.weightGrams).toBe(3200);
  });

  it('leaves ownership alone when the marka matches nobody', () => {
    const p = plan({
      track: { currentStatus: 'CREATED', customerId: null },
      markaTyped: true,
      markaCustomerId: null,
    });
    expect(p.attachCustomerId).toBeNull();
    expect(p.marka).toEqual({ kind: 'notFound' });
    expect(p.willNotify).toBe(false);
  });

  it('does not notify a conflicting parcel that is already past CREATED', () => {
    const p = plan({
      track: { currentStatus: 'TASHKENT_WAREHOUSE', customerId: OTHER },
      markaTyped: true,
      markaCustomerId: CUSTOMER,
    });
    expect(p.willEvent).toBe(false);
    expect(p.willNotify).toBe(false);
  });
});

describe('planWeighEntry — storeMarka (§7.13, H1)', () => {
  it('keeps the typed string as box evidence, trimmed', () => {
    const p = plan({
      markaTyped: true,
      markaCustomerId: CUSTOMER,
      markaRaw: ' DK-1042 ',
    });
    expect(p.storeMarka).toBe('DK-1042');
  });

  it('keeps it even on a conflict — that IS the dispute evidence', () => {
    const p = plan({
      track: { currentStatus: 'CHINA_WAREHOUSE', customerId: OTHER },
      markaTyped: true,
      markaCustomerId: CUSTOMER,
      markaRaw: 'DK-1042',
    });
    expect(p.marka.kind).toBe('conflict');
    expect(p.storeMarka).toBe('DK-1042');
  });

  it('keeps a marka that matched nobody — the box is real either way', () => {
    const p = plan({
      markaTyped: true,
      markaCustomerId: null,
      markaRaw: 'ZZ-9999',
    });
    expect(p.storeMarka).toBe('ZZ-9999');
  });

  it('truncates to the §7.13 cap instead of refusing mid-shift', () => {
    const p = plan({
      markaTyped: true,
      markaCustomerId: null,
      markaRaw: 'X'.repeat(100),
    });
    expect(p.storeMarka).toBe('X'.repeat(32));
  });

  it('never stores an empty string, so a blank field cannot clear one', () => {
    expect(plan().storeMarka).toBeNull();
    expect(
      plan({ markaTyped: true, markaCustomerId: null, markaRaw: '   ' })
        .storeMarka,
    ).toBeNull();
  });
});
