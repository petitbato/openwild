import { describe, expect, it } from 'vitest';
import { MotifScheduler, DAY_MOTIFS, NIGHT_MOTIFS, midiToHz } from './Music';

const rng = (seq: number[]) => { let i = 0; return () => seq[i++ % seq.length]; };

describe('midiToHz', () => {
  it('A4 = 440', () => expect(midiToHz(69)).toBeCloseTo(440));
  it('C4 ≈ 261.63', () => expect(midiToHz(60)).toBeCloseTo(261.63, 1));
});

describe('MotifScheduler', () => {
  it('waits 20–45s between motifs', () => {
    const s = new MotifScheduler(rng([0.5, 0.5, 0.5]));
    const first = s.next(0, true);
    expect(first).not.toBeNull();
    expect(s.nextAt).toBeGreaterThanOrEqual(20);
    expect(s.nextAt).toBeLessThanOrEqual(45);
    expect(s.next(s.nextAt - 1, true)).toBeNull(); // not yet
  });
  it('never repeats the same motif twice in a row', () => {
    const s = new MotifScheduler(rng([0, 0, 0, 0, 0, 0, 0, 0]));
    const a = s.next(0, true)!;
    const b = s.next(1000, true)!;
    expect(b).not.toBe(a);
  });
  it('picks from the night set at night', () => {
    const s = new MotifScheduler(rng([0.1, 0.1]));
    const m = s.next(0, false)!;
    expect(NIGHT_MOTIFS).toContain(m);
    expect(DAY_MOTIFS).not.toContain(m);
  });
});
