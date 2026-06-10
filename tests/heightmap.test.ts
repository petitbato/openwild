import { describe, expect, it } from 'vitest';
import { generateTerrain } from '../src/world/terrain/heightmap';

describe('generateTerrain', () => {
  const t = generateTerrain(1337);

  it('is deterministic for a seed and differs across seeds', () => {
    const t2 = generateTerrain(1337);
    const t3 = generateTerrain(42);
    expect(t.heights[5000]).toBe(t2.heights[5000]);
    expect(Array.from(t.heights.slice(0, 200))).not.toEqual(Array.from(t3.heights.slice(0, 200)));
  });

  it('has the documented size and resolution', () => {
    expect(t.size).toBe(1024);
    expect(t.resolution).toBe(257);
    expect(t.heights.length).toBe(257 * 257);
  });

  it('is an island: every border vertex is below sea level (y=0)', () => {
    const r = t.resolution;
    for (let i = 0; i < r; i++) {
      expect(t.heights[i]).toBeLessThan(0);                 // z = min edge
      expect(t.heights[(r - 1) * r + i]).toBeLessThan(0);   // z = max edge
      expect(t.heights[i * r]).toBeLessThan(0);             // x = min edge
      expect(t.heights[i * r + (r - 1)]).toBeLessThan(0);   // x = max edge
    }
  });

  it('has real elevation: a peak above 30 m and underwater minima', () => {
    let max = -Infinity, min = Infinity;
    for (const h of t.heights) { if (h > max) max = h; if (h < min) min = h; }
    expect(max).toBeGreaterThan(30);
    expect(min).toBeLessThan(0);
  });

  it('heightAt matches the grid exactly on vertices', () => {
    const r = t.resolution, cell = t.size / (r - 1);
    const xi = 100, zi = 140;
    const wx = xi * cell - t.size / 2;
    const wz = zi * cell - t.size / 2;
    expect(t.heightAt(wx, wz)).toBeCloseTo(t.heights[zi * r + xi], 5);
  });

  it('heightAt interpolates linearly between two vertices', () => {
    const r = t.resolution, cell = t.size / (r - 1);
    const xi = 100, zi = 140;
    const wx = xi * cell - t.size / 2;
    const wz = zi * cell - t.size / 2;
    const a = t.heights[zi * r + xi];
    const b = t.heights[zi * r + xi + 1];
    expect(t.heightAt(wx + cell / 2, wz)).toBeCloseTo((a + b) / 2, 5);
  });

  it('heightAt clamps outside the grid instead of crashing', () => {
    expect(Number.isFinite(t.heightAt(99999, -99999))).toBe(true);
  });

  it('normalAt returns a unit, upward-facing vector', () => {
    const n = t.normalAt(10, 20);
    const len = Math.hypot(n.x, n.y, n.z);
    expect(len).toBeCloseTo(1, 5);
    expect(n.y).toBeGreaterThan(0);
  });
});
