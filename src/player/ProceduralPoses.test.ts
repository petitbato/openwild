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

describe('climb targets (bone directions, wall at -Z)', () => {
  it('L-hand reaches with R-foot, mirrored half a cycle later', () => {
    const reach = climbTargets(Math.PI / 2); // sin = +1
    const other = climbTargets(3 * Math.PI / 2); // sin = -1
    // armL highest when legR is most lifted
    expect(reach.armL.y).toBeGreaterThan(other.armL.y);
    expect(reach.legR.y).toBeGreaterThan(other.legR.y);
    // mirrored pair half a cycle later
    expect(reach.armL.y).toBeCloseTo(other.armR.y, 5);
    expect(reach.legR.y).toBeCloseTo(other.legL.y, 5);
  });
  it('all limbs angled toward the wall (-Z), legs pointing down', () => {
    const p = climbTargets(0.7);
    for (const k of ['spine', 'armL', 'armR', 'forearmL', 'forearmR', 'legL', 'legR'] as const) {
      expect(p[k].z).toBeLessThan(0);
    }
    expect(p.legL.y).toBeLessThan(0);
    expect(p.legR.y).toBeLessThan(0);
  });
});

describe('glide targets', () => {
  it('raises both arms symmetrically toward the handles', () => {
    const g = glideTargets(0);
    expect(g.armL.y).toBeGreaterThan(0.5);
    expect(g.armL.y).toBeCloseTo(g.armR.y, 5);
    expect(g.armL.x).toBeCloseTo(-g.armR.x, 5);
  });
  it('legs dangle down and sway in counterphase', () => {
    const t = Math.PI / 4; // sin(2t) = 1 -> max sway
    const g = glideTargets(t);
    expect(g.legL.y).toBeLessThan(0);
    expect(g.legR.y).toBeLessThan(0);
    expect(g.legL.z - g.legR.z).toBeCloseTo(2 * 0.06, 5);
  });
});
