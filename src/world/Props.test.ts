import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
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

/**
 * Horizontal distance between the top-ring centroid of trunk segment `joint`
 * and the bottom-ring centroid of segment `joint + 1`. Segments are merged in
 * order with identical vertex counts, so the buffer splits into equal blocks.
 */
function jointGap(trunk: THREE.BufferGeometry, segCount: number, joint: number): number {
  const pos = trunk.getAttribute('position');
  const per = pos.count / segCount;
  const ring = (seg: number, top: boolean): { x: number; z: number } => {
    let minY = Infinity, maxY = -Infinity;
    for (let i = seg * per; i < (seg + 1) * per; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const lim = top ? maxY - 0.25 : minY + 0.25;
    let sx = 0, sz = 0, n = 0;
    for (let i = seg * per; i < (seg + 1) * per; i++) {
      const y = pos.getY(i);
      if (top ? y >= lim : y <= lim) { sx += pos.getX(i); sz += pos.getZ(i); n++; }
    }
    return { x: sx / n, z: sz / n };
  };
  const a = ring(joint, true);
  const b = ring(joint + 1, false);
  return Math.hypot(a.x - b.x, a.z - b.z);
}

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

  it('palm trunk segments chain end to end (no lateral gap at the joints)', () => {
    const trunk = geos.palm.trunk;
    expect(jointGap(trunk, 3, 0)).toBeLessThan(0.12);
    expect(jointGap(trunk, 3, 1)).toBeLessThan(0.12);
  });

  it('palm fronds spread outward from the crown, not through it', () => {
    // Centered frond planes poke through the opposite side of the crown
    // (the "X" look) and dip well below the attachment point.
    const canopy = geos.palm.canopy;
    canopy.computeBoundingBox();
    expect(canopy.boundingBox!.min.y).toBeGreaterThan(3.0);
  });
});
