import { describe, expect, it } from 'vitest';
import { buildArchetypeGeometries, pickArchetype } from './Props';

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

describe('archetype geometries', () => {
  const geos = buildArchetypeGeometries();
  const archetypes = ['broadleaf', 'conifer', 'palm'] as const;

  for (const arch of archetypes) {
    it(`${arch} trunk base sits at y=0 (instances are placed at ground height)`, () => {
      const trunk = geos[arch].trunk;
      trunk.computeBoundingBox();
      expect(trunk.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.01);
      expect(trunk.boundingBox!.min.y).toBeLessThanOrEqual(0.01);
    });

    it(`${arch} canopy overlaps the trunk top (no floating gap)`, () => {
      const { trunk, canopy } = geos[arch];
      trunk.computeBoundingBox();
      canopy.computeBoundingBox();
      expect(canopy.boundingBox!.min.y).toBeLessThan(trunk.boundingBox!.max.y);
    });
  }
});
