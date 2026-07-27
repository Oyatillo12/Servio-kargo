import { beforeEach, describe, expect, it } from 'vitest';

import { allowLead, resetLeadThrottle } from './throttle';

const HOUR = 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe('allowLead', () => {
  beforeEach(() => resetLeadThrottle());

  it('allows the first five attempts, blocks the sixth', () => {
    for (let i = 0; i < 5; i++) {
      expect(allowLead('1.2.3.4', T0 + i)).toBe(true);
    }
    expect(allowLead('1.2.3.4', T0 + 5)).toBe(false);
  });

  it('tracks IPs independently', () => {
    for (let i = 0; i < 5; i++) allowLead('1.2.3.4', T0 + i);
    expect(allowLead('1.2.3.4', T0 + 10)).toBe(false);
    expect(allowLead('5.6.7.8', T0 + 10)).toBe(true);
  });

  it('lets the window slide: old attempts stop counting after an hour', () => {
    for (let i = 0; i < 5; i++) allowLead('1.2.3.4', T0 + i);
    expect(allowLead('1.2.3.4', T0 + 100)).toBe(false);
    expect(allowLead('1.2.3.4', T0 + HOUR + 101)).toBe(true);
  });

  it('a blocked attempt does not extend the window', () => {
    for (let i = 0; i < 5; i++) allowLead('1.2.3.4', T0 + i);
    // Hammering while blocked...
    for (let i = 0; i < 20; i++) allowLead('1.2.3.4', T0 + 1000 + i);
    // ...still unblocks exactly when the original five expire.
    expect(allowLead('1.2.3.4', T0 + HOUR + 5)).toBe(true);
  });
});
