import { describe, expect, it } from 'vitest';
import { pickArchetype } from './Props';

const rngAt = (v: number) => () => v;

describe('pickArchetype', () => {
  it('beach band yields palms mostly', () => {
    expect(pickArchetype(1.5, rngAt(0.5))).toBe('palm');
  });
  it('high altitude yields conifers mostly', () => {
    expect(pickArchetype(30, rngAt(0.5))).toBe('conifer');
  });
  it('mid altitude yields broadleaf mostly', () => {
    expect(pickArchetype(10, rngAt(0.5))).toBe('broadleaf');
  });
  it('mid altitude can still yield conifers (variety)', () => {
    expect(pickArchetype(10, rngAt(0.95))).toBe('conifer');
  });
  it('h=3 boundary belongs to the mid band, not the beach band', () => {
    expect(pickArchetype(3, rngAt(0.5))).toBe('broadleaf');
  });
  it('h=22 boundary belongs to the high band', () => {
    expect(pickArchetype(22, rngAt(0.5))).toBe('conifer');
  });
});
