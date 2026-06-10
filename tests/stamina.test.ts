import { describe, expect, it } from 'vitest';
import { Stamina } from '../src/player/Stamina';

describe('Stamina', () => {
  it('starts full and not exhausted', () => {
    const s = new Stamina();
    expect(s.value).toBe(100);
    expect(s.exhausted).toBe(false);
    expect(s.fraction).toBe(1);
  });

  it('drains and clamps at zero, flipping exhausted', () => {
    const s = new Stamina();
    s.drain(150);
    expect(s.value).toBe(0);
    expect(s.exhausted).toBe(true);
  });

  it('stays exhausted until refilled to 30', () => {
    const s = new Stamina();
    s.drain(100);
    s.update(1, true); // regen 20/s -> value 20
    expect(s.exhausted).toBe(true);
    s.update(0.6, true); // -> 32
    expect(s.exhausted).toBe(false);
  });

  it('only regenerates when regenerating flag is true', () => {
    const s = new Stamina();
    s.drain(50);
    s.update(1, false);
    expect(s.value).toBe(50);
    s.update(1, true);
    expect(s.value).toBe(70);
  });

  it('regen clamps at max', () => {
    const s = new Stamina();
    s.drain(5);
    s.update(10, true);
    expect(s.value).toBe(100);
  });

  it('canUse is false while exhausted, true otherwise', () => {
    const s = new Stamina();
    expect(s.canUse).toBe(true);
    s.drain(100);
    expect(s.canUse).toBe(false);
  });
});
