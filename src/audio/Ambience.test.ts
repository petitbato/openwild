import { describe, expect, it } from 'vitest';
import { dayWeight } from './Ambience';

// dayWeight band edges are derived from daynight.ts KEYS (lines 33-37):
// NIGHT full:  t=0.0..0.20 and t=0.85..1.0
// DAWN:        t=0.26 (start) -> t=0.35 (full day)
// DAY full:    t=0.35..0.65
// DUSK:        t=0.65 (start) -> t=0.77 -> t=0.85 (full night)
// => smooth(0.26, 0.35, t) * (1 - smooth(0.65, 0.77, t))

describe('dayWeight', () => {
  it('full day at noon-ish, zero at midnight-ish', () => {
    expect(dayWeight(0.5)).toBeCloseTo(1, 1);
    expect(dayWeight(0.0)).toBeCloseTo(0, 1);
    expect(dayWeight(0.99)).toBeCloseTo(0, 1);
  });
  it('transitions smoothly around dawn/dusk', () => {
    expect(dayWeight(0.27)).toBeGreaterThan(0);
    expect(dayWeight(0.27)).toBeLessThan(1);
  });
});
