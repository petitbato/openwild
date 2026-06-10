import { describe, expect, it } from 'vitest';
import { applyDeadzone } from '../src/core/deadzone';

describe('applyDeadzone', () => {
  it('zeroes input below the threshold', () => {
    expect(applyDeadzone(0.1, 0.05)).toEqual({ x: 0, y: 0 });
  });

  it('keeps full deflection at magnitude 1', () => {
    const r = applyDeadzone(1, 0);
    expect(Math.hypot(r.x, r.y)).toBeCloseTo(1, 5);
  });

  it('rescales smoothly: just above threshold is near zero, not a jump', () => {
    const r = applyDeadzone(0.16, 0);
    expect(Math.hypot(r.x, r.y)).toBeLessThan(0.05);
  });

  it('preserves direction', () => {
    const r = applyDeadzone(0.5, 0.5);
    expect(r.x).toBeCloseTo(r.y, 5);
    expect(r.x).toBeGreaterThan(0);
  });

  it('clamps overshooting diagonals to magnitude 1', () => {
    const r = applyDeadzone(1, 1);
    expect(Math.hypot(r.x, r.y)).toBeLessThanOrEqual(1.000001);
  });

  it('returns zero for zero input even with zero threshold', () => {
    expect(applyDeadzone(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});
