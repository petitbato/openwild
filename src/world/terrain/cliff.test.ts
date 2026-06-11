import { describe, expect, it } from 'vitest';
import { cliffBoost, CLIFF } from './heightmap';

describe('cliffBoost', () => {
  it('is zero far outside the sector', () => {
    expect(cliffBoost(480, 0)).toBe(0);     // wrong angle
    expect(cliffBoost(-10, -10)).toBe(0);   // r too small
  });
  it('reaches full height on the plateau side at sector center', () => {
    const a = CLIFF.theta;
    const r = CLIFF.r0 - 10;
    expect(cliffBoost(Math.cos(a) * r, Math.sin(a) * r)).toBeCloseTo(CLIFF.height, 1);
  });
  it('creates a steep face: drops ≥60° between r0 and r1 at sector center', () => {
    const a = CLIFF.theta;
    const run = CLIFF.r1 - CLIFF.r0;
    const drop = cliffBoost(Math.cos(a) * CLIFF.r0, Math.sin(a) * CLIFF.r0)
               - cliffBoost(Math.cos(a) * CLIFF.r1, Math.sin(a) * CLIFF.r1);
    expect(drop / run).toBeGreaterThan(Math.tan(Math.PI / 3)); // > tan 60°
  });
  it('is continuous (no step bigger than 1.5m over 0.5m) along a radial line', () => {
    const a = CLIFF.theta;
    let prev = cliffBoost(Math.cos(a) * 150, Math.sin(a) * 150);
    for (let r = 150.5; r < 300; r += 0.5) {
      const v = cliffBoost(Math.cos(a) * r, Math.sin(a) * r);
      expect(Math.abs(v - prev)).toBeLessThan(1.5);
      prev = v;
    }
  });
});
