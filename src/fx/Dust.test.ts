import { describe, expect, it } from 'vitest';
import { stepPuff, type Puff } from './Dust';

const mk = (): Puff => ({ x: 0, y: 0, z: 0, vx: 1, vy: 0, vz: 0, age: 0, life: 0.4 });

describe('stepPuff', () => {
  it('moves and survives within its lifetime', () => {
    const p = mk();
    expect(stepPuff(p, 0.1)).toBe(true);
    expect(p.x).toBeCloseTo(0.1);
  });
  it('dies after life expires', () => {
    const p = mk();
    expect(stepPuff(p, 0.5)).toBe(false);
  });
});
