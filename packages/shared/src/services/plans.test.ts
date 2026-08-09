import { describe, expect, it } from 'vitest';

import {
  planIncludes,
  TENANT_PLANS,
  type PlanFeature,
} from './plans';

const ALL_FEATURES: PlanFeature[] = [
  'miniapp',
  'online_payments',
  'bonus',
  'delivery_requests',
];

describe('planIncludes', () => {
  it('basic includes none of the premium features', () => {
    for (const feature of ALL_FEATURES) {
      expect(planIncludes('basic', feature)).toBe(false);
    }
  });

  it('premium includes every feature', () => {
    for (const feature of ALL_FEATURES) {
      expect(planIncludes('premium', feature)).toBe(true);
    }
  });

  it('tiers are inclusive upward: anything basic has, premium has too', () => {
    for (const feature of ALL_FEATURES) {
      if (planIncludes('basic', feature)) {
        expect(planIncludes('premium', feature)).toBe(true);
      }
    }
  });

  it('plan list stays in sync with the db enum values', () => {
    expect(TENANT_PLANS).toEqual(['basic', 'premium']);
  });
});
