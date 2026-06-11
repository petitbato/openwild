export interface TerrainData {
  size: number;
  resolution: number;
  heights: Float32Array;
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number): { x: number; y: number; z: number };
}

function hash2(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 144665087) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return smooth(t);
}

/** Cliff sector parameters. theta is the sector's central angle (radians). */
export const CLIFF = {
  theta: -2.2,      // southwest sector — far from tower (~0.15) and ruins (~0 / ~2.15)
  halfAngle: 0.38,
  r0: 286,          // plateau edge (full height inside r0); pushed outward so base terrain stays low
  r1: 295,          // foot of the wall (zero boost outside r1) → 16m over 9m ≈ 60.6°
  height: 16,
};

/** Additive height term producing a steep climbable wall with a plateau behind it. */
export function cliffBoost(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < 40 || r > 320) return 0;
  let dTheta = Math.atan2(z, x) - CLIFF.theta;
  dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta)); // wrap to [-π, π]
  const ang = 1 - smoothstep(CLIFF.halfAngle * 0.55, CLIFF.halfAngle, Math.abs(dTheta));
  if (ang <= 0) return 0;
  const radial = 1 - smoothstep(CLIFF.r0, CLIFF.r1, r);
  // fade plateau in gently from island interior so it blends and doesn't displace the tower
  const inner = smoothstep(235, 276, r);
  return CLIFF.height * ang * radial * inner;
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx), v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; // 0..1
}

export function fbm(x: number, z: number, seed: number, octaves = 5): number {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm; // 0..1
}

function sampleHeight(x: number, z: number, seed: number, size: number): number {
  const nx = x / size, nz = z / size;                       // -0.5..0.5
  const d = Math.sqrt(nx * nx + nz * nz);                   // 0 center -> 0.707 edge
  const island = Math.max(0, Math.pow(1 - Math.pow(d / 0.707, 1.5), 3));  // strong edge cutoff
  const base = fbm(nx * 4 + 10, nz * 4 + 10, seed);         // rolling hills 0..1
  const mountain = Math.pow(fbm(nx * 2.5 + 50, nz * 2.5 + 50, seed + 701), 2.5);
  return (base * 38 + mountain * 150) * island - 6 + cliffBoost(x, z);  // -6 sinks all edges below sea
}

export function generateTerrain(seed = 1337, size = 1024, resolution = 257): TerrainData {
  const heights = new Float32Array(resolution * resolution);
  const half = size / 2;
  const cell = size / (resolution - 1);
  for (let zi = 0; zi < resolution; zi++) {
    for (let xi = 0; xi < resolution; xi++) {
      heights[zi * resolution + xi] = sampleHeight(xi * cell - half, zi * cell - half, seed, size);
    }
  }

  function heightAt(x: number, z: number): number {
    const gx = Math.min(Math.max((x + half) / cell, 0), resolution - 1.001);
    const gz = Math.min(Math.max((z + half) / cell, 0), resolution - 1.001);
    const xi = Math.floor(gx), zi = Math.floor(gz);
    const fx = gx - xi, fz = gz - zi;
    const a = heights[zi * resolution + xi];
    const b = heights[zi * resolution + xi + 1];
    const c = heights[(zi + 1) * resolution + xi];
    const d = heights[(zi + 1) * resolution + xi + 1];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  function normalAt(x: number, z: number) {
    const e = cell;
    const dx = heightAt(x - e, z) - heightAt(x + e, z);
    const dz = heightAt(x, z - e) - heightAt(x, z + e);
    const len = Math.hypot(dx, 2 * e, dz);
    return { x: dx / len, y: (2 * e) / len, z: dz / len };
  }

  return { size, resolution, heights, heightAt, normalAt };
}
