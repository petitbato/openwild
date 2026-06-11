import { describe, expect, it } from 'vitest';
import { paletteAt, sunAngle } from '../src/world/daynight';

describe('paletteAt', () => {
  it('is full day at t=0.5: bright sun, no stars', () => {
    const p = paletteAt(0.5);
    expect(p.sunIntensity).toBeCloseTo(2.2, 5);
    expect(p.stars).toBe(0);
  });

  it('is night at t=0: no sun, full stars', () => {
    const p = paletteAt(0);
    expect(p.sunIntensity).toBe(0);
    expect(p.stars).toBe(1);
  });

  it('wraps: t=1 equals t=0', () => {
    expect(paletteAt(1)).toEqual(paletteAt(0));
  });

  it('interpolates linearly between keyframes', () => {
    // keys at 0.65 (day, sun 2.2) and 0.77 (dusk, sun 0.5): midpoint 0.71
    const p = paletteAt(0.71);
    expect(p.sunIntensity).toBeCloseTo((2.2 + 0.5) / 2, 5);
  });

  it('every channel stays in 0..1', () => {
    for (let t = 0; t < 1; t += 0.01) {
      const p = paletteAt(t);
      for (const c of [...p.top, ...p.horizon, ...p.fog, ...p.sunColor]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('sunAngle', () => {
  it('sunrise at t=0.25 puts the sun on the horizon going up', () => {
    expect(Math.sin(sunAngle(0.25))).toBeCloseTo(0, 5);
    expect(Math.sin(sunAngle(0.3))).toBeGreaterThan(0);
  });
  it('noon at t=0.5 is overhead', () => {
    expect(Math.sin(sunAngle(0.5))).toBeCloseTo(1, 5);
  });
});
