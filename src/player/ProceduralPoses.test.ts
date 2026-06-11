import { describe, expect, it } from 'vitest';
import { advanceClimbPhase, approachWeight, climbTargets, glideTargets } from './ProceduralPoses';

describe('approachWeight', () => {
  it('rises toward 1 in ~0.15s when active', () => {
    let w = 0;
    for (let i = 0; i < 9; i++) w = approachWeight(w, true, 1 / 60);
    expect(w).toBeGreaterThan(0.9);
  });
  it('falls toward 0 when inactive', () => {
    let w = 1;
    for (let i = 0; i < 9; i++) w = approachWeight(w, false, 1 / 60);
    expect(w).toBeLessThan(0.1);
  });
});

describe('advanceClimbPhase', () => {
  it('is frozen when speed is 0', () => {
    expect(advanceClimbPhase(1.2, 0, 0.016)).toBe(1.2);
  });
  it('advances proportionally to climbed distance', () => {
    const a = advanceClimbPhase(0, 2.2, 0.5);
    expect(a).toBeCloseTo(2.2 * 0.5 * 2.4, 5);
  });
});

describe('pose targets', () => {
  it('climb alternates limbs: half a cycle apart, arms mirror', () => {
    const p0 = climbTargets(0);
    const pHalf = climbTargets(Math.PI);
    expect(p0.armL.x).toBeCloseTo(pHalf.armR.x, 5);
    expect(p0.legR.x).toBeCloseTo(pHalf.legL.x, 5);
  });
  it('glide raises both arms symmetrically', () => {
    const g = glideTargets(0);
    expect(g.armL.x).toBeLessThan(-1.5);
    expect(g.armL.x).toBeCloseTo(g.armR.x, 5);
    expect(g.armL.z).toBeCloseTo(-g.armR.z, 5);
  });
});
