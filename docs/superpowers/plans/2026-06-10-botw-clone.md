# BoTW-Style Exploration Tech Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-playable, cel-shaded BoTW-style exploration demo: procedural island, third-person character that runs, jumps, climbs any surface, and paraglides, with stamina, day/night cycle, grass, landmarks, and gamepad support.

**Architecture:** Vanilla Three.js scene driven by a fixed-timestep (60 Hz) game loop; Rapier (kinematic character controller + trimesh terrain collider) for movement; player logic is an explicit state machine (Grounded/Airborne/Climbing/Gliding). Pure logic (terrain heightmap, stamina, palettes, dead zones) lives in dependency-free modules tested with vitest; everything visual is verified by running the game.

**Tech Stack:** Vite, TypeScript (strict), Three.js, `@dimforge/rapier3d-compat`, vitest. Character model: `Soldier.glb` from the three.js examples (known URL, includes Idle/Walk/Run clips — climb/glide reuse Walk/Run with pose tweaks). Audio is synthesized with WebAudio (no external files).

**Spec:** `docs/superpowers/specs/2026-06-10-botw-clone-design.md`. Two pragmatic deviations from spec, both in service of "playable ASAP": audio is synthesized instead of CC0 files (no flaky downloads), and terrain visual mesh is 257×257 (not 512×512) so the collision trimesh and visual mesh are the exact same geometry.

**Working directory for all commands:** `botw-clone/` (repo root).

**Conventions used throughout (do not rename):**

```ts
// World: island centered at origin, x/z ∈ [-512, 512] (size 1024 m). Sea level y = 0.
// src/world/terrain/heightmap.ts
export interface TerrainData {
  size: number;            // 1024
  resolution: number;      // 257 (verts per side)
  heights: Float32Array;   // row-major: heights[zi * resolution + xi]
  heightAt(x: number, z: number): number;            // world coords, bilinear
  normalAt(x: number, z: number): { x: number; y: number; z: number };
}

// src/core/Input.ts
export interface Actions {
  move: { x: number; y: number };  // -1..1 each; y=+1 means forward
  look: { x: number; y: number };  // accumulated delta since last fixed update
  jumpPressed: boolean;            // edge-triggered, true for one fixed update
  jumpHeld: boolean;
  sprintHeld: boolean;
}

// src/player/Stamina.ts
// max 100; drain(amount); update(dt, regenerating); .value, .exhausted
// exhausted stays true until value >= 30.

// Player states: 'grounded' | 'airborne' | 'climbing' | 'gliding'
```

**File structure (final):**

```
botw-clone/
  index.html
  package.json / tsconfig.json
  public/assets/character.glb
  src/
    main.ts                      # boot: loading, asset/physics init, wiring, loop
    style.css                    # HUD + loading overlay styles
    core/GameLoop.ts             # fixed timestep loop
    core/Input.ts                # keyboard/mouse/gamepad -> Actions
    core/deadzone.ts             # pure stick dead-zone math (tested)
    core/toon.ts                 # shared MeshToonMaterial factory + gradient map
    physics/Physics.ts           # Rapier init wrapper, world, helpers
    world/terrain/heightmap.ts   # pure terrain generation (tested)
    world/terrain/TerrainMesh.ts # visual mesh + vertex colors + trimesh collider
    world/Sky.ts                 # sky dome shader, sun/moon, stars
    world/daynight.ts            # pure palette math (tested) + DayNight clock
    world/Water.ts               # toon water plane
    world/Props.ts               # instanced trees/rocks + colliders
    world/Landmarks.ts           # tower + 2 ruins + colliders
    player/Player.ts             # state machine + KCC movement
    player/Stamina.ts            # pure stamina logic (tested)
    player/CharacterAvatar.ts    # glb loading, AnimationMixer, outline shell
    camera/ThirdPersonCamera.ts  # spring-arm orbit camera
    fx/Grass.ts                  # instanced swaying grass re-scattered near player
    fx/WindStreaks.ts            # glide wind lines
    ui/StaminaWheel.ts           # SVG stamina HUD
    ui/LoadingScreen.ts          # progress + error overlay
    audio/AudioManager.ts        # synthesized ambient piano / wind / footsteps
  tests/
    heightmap.test.ts
    stamina.test.ts
    deadzone.test.ts
    daynight.test.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `index.html`, `src/style.css`, `src/main.ts`, `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "botw-clone",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dimforge/rapier3d-compat": "^0.14.0",
    "three": "^0.165.0"
  },
  "devDependencies": {
    "@types/three": "^0.165.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BoTW Demo</title>
</head>
<body>
  <div id="app"></div>
  <div id="hud"></div>
  <div id="loading">
    <div class="loading-box">
      <h1>Loading…</h1>
      <div class="bar"><div class="bar-fill" id="loading-fill"></div></div>
      <p id="loading-error" hidden></p>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 4: Write `src/style.css`**

```css
html, body { margin: 0; height: 100%; overflow: hidden; background: #0b1320; font-family: system-ui, sans-serif; }
#app, #app canvas { width: 100%; height: 100%; display: block; }
#hud { position: fixed; inset: 0; pointer-events: none; }
#loading { position: fixed; inset: 0; background: #0b1320; color: #cfe8ff; display: flex; align-items: center; justify-content: center; transition: opacity 0.6s; z-index: 10; }
#loading.done { opacity: 0; pointer-events: none; }
.loading-box { width: 320px; text-align: center; }
.bar { height: 6px; background: #1d2c44; border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; width: 0%; background: #58c8e0; transition: width 0.2s; }
#loading-error { color: #ff7b7b; white-space: pre-wrap; }
#fade { position: fixed; inset: 0; background: #000; opacity: 0; pointer-events: none; transition: opacity 0.4s; z-index: 5; }
.stamina-wheel { position: fixed; left: 50%; top: 50%; transform: translate(-90px, -60px); opacity: 0; transition: opacity 0.3s; }
.stamina-wheel.visible { opacity: 1; }
.stamina-wheel.exhausted circle.fill { stroke: #ff5252; animation: blink 0.4s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
```

- [ ] **Step 5: Write placeholder `src/main.ts`**

```ts
import './style.css';
console.log('botw-clone boot');
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 7: Install and verify**

Run: `npm install` then `npm run typecheck`
Expected: install succeeds, typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + TypeScript project"
```

---

### Task 2: Game loop and Three.js scene bootstrap

**Files:**
- Create: `src/core/GameLoop.ts`, `src/core/toon.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/core/GameLoop.ts`**

```ts
export class GameLoop {
  readonly fixedDt = 1 / 60;
  private last = 0;
  private acc = 0;
  private raf = 0;

  constructor(
    private fixedUpdate: (dt: number) => void,
    private render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      let frame = (now - this.last) / 1000;
      this.last = now;
      frame = Math.min(frame, 0.1); // tab-switch clamp
      this.acc += frame;
      while (this.acc >= this.fixedDt) {
        this.fixedUpdate(this.fixedDt);
        this.acc -= this.fixedDt;
      }
      this.render(this.acc / this.fixedDt, frame);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void { cancelAnimationFrame(this.raf); }
}
```

- [ ] **Step 2: Write `src/core/toon.ts`**

```ts
import * as THREE from 'three';

let gradientMap: THREE.DataTexture | null = null;

export function getGradientMap(): THREE.DataTexture {
  if (!gradientMap) {
    const data = new Uint8Array([80, 160, 255]); // 3-step toon ramp
    gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

export function toonMaterial(
  color: THREE.ColorRepresentation,
  opts: Partial<THREE.MeshToonMaterialParameters> = {},
): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap(), ...opts });
}
```

- [ ] **Step 3: Rewrite `src/main.ts` with renderer, lights, and a spinning toon cube**

```ts
import './style.css';
import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';
import { toonMaterial } from './core/toon';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed7ff);
scene.fog = new THREE.Fog(0x9ed7ff, 200, 900);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(4, 3, 6);
camera.lookAt(0, 0, 0);

const sun = new THREE.DirectionalLight(0xfff4d6, 2.2);
sun.position.set(50, 80, 30);
sun.castShadow = true;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xbcd8ff, 0.9));

const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), toonMaterial(0x4caf50));
scene.add(cube);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const loop = new GameLoop(
  (dt) => { cube.rotation.y += dt; cube.rotation.x += dt * 0.4; },
  () => renderer.render(scene, camera),
);
loop.start();

document.getElementById('loading')!.classList.add('done');
```

- [ ] **Step 4: Verify in browser**

Run the dev server, open the page.
Expected: sky-blue background, green flat-shaded cube with visible toon banding, spinning smoothly; no console errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: fixed-timestep game loop and toon-shaded scene bootstrap"
```

---

### Task 3: Terrain heightmap generation (pure logic, TDD)

**Files:**
- Create: `src/world/terrain/heightmap.ts`
- Test: `tests/heightmap.test.ts`

No Three.js imports in this module — it must run in vitest without a DOM.

- [ ] **Step 1: Write the failing tests — `tests/heightmap.test.ts`**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/heightmap.test.ts`
Expected: FAIL — cannot resolve `../src/world/terrain/heightmap`.

- [ ] **Step 3: Implement `src/world/terrain/heightmap.ts`**

```ts
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
  const d = Math.sqrt(nx * nx + nz * nz) * 2;               // 0 center -> 1 edge midpoint
  const island = Math.max(0, 1 - Math.pow(d, 2.2));         // radial falloff
  const base = fbm(nx * 4 + 10, nz * 4 + 10, seed);         // rolling hills 0..1
  const mountain = Math.pow(fbm(nx * 2.5 + 50, nz * 2.5 + 50, seed + 7), 2.5);
  return (base * 38 + mountain * 110) * island - 6;         // -6 sinks all edges below sea
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/heightmap.test.ts`
Expected: PASS (8 tests). If "peak above 30 m" fails for seed 1337, bump the mountain weight (110) up — do not weaken the test below 30.

- [ ] **Step 5: Commit**

```bash
git add src/world/terrain/heightmap.ts tests/heightmap.test.ts
git commit -m "feat: procedural island heightmap with tested sampling"
```

---

### Task 4: Terrain mesh with vertex colors

**Files:**
- Create: `src/world/terrain/TerrainMesh.ts`
- Modify: `src/main.ts` (replace cube with terrain)

- [ ] **Step 1: Write `src/world/terrain/TerrainMesh.ts`**

```ts
import * as THREE from 'three';
import { getGradientMap } from '../../core/toon';
import type { TerrainData } from './heightmap';

const SAND = new THREE.Color(0xd9c38a);
const GRASS = new THREE.Color(0x6ab04c);
const ROCK = new THREE.Color(0x8d8d93);
const SNOW = new THREE.Color(0xf2f5fa);

export function colorForVertex(height: number, slopeY: number): THREE.Color {
  // slopeY = normal.y (1 flat, 0 vertical)
  if (slopeY < 0.55) return ROCK.clone();
  if (height < 2.5) return SAND.clone();
  if (height > 75) return SNOW.clone();
  if (height > 55) return ROCK.clone().lerp(SNOW, (height - 55) / 20);
  return GRASS.clone().lerp(ROCK, Math.max(0, (height - 35) / 20));
}

export function buildTerrainMesh(terrain: TerrainData): THREE.Mesh {
  const r = terrain.resolution;
  const geo = new THREE.PlaneGeometry(terrain.size, terrain.size, r - 1, r - 1);
  geo.rotateX(-Math.PI / 2); // plane is XY by default; make it XZ with +Y up

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrain.heightAt(x, z);
    pos.setY(i, h);
    const n = terrain.normalAt(x, z);
    const c = colorForVertex(h, n.y);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradientMap() });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
```

- [ ] **Step 2: Wire into `src/main.ts`**

Remove the cube. Add:

```ts
import { generateTerrain } from './world/terrain/heightmap';
import { buildTerrainMesh } from './world/terrain/TerrainMesh';

const terrain = generateTerrain(1337);
const terrainMesh = buildTerrainMesh(terrain);
scene.add(terrainMesh);

// temporary fly-over view of the island
camera.position.set(0, 350, 620);
camera.lookAt(0, 0, 0);
```

In the fixed-update callback, replace the cube spin with a slow camera orbit so you can inspect the island:

```ts
let orbit = 0;
// fixedUpdate:
orbit += dt * 0.05;
camera.position.set(Math.sin(orbit) * 620, 350, Math.cos(orbit) * 620);
camera.lookAt(0, 0, 0);
```

- [ ] **Step 3: Verify in browser**

Expected: an island with sandy edges, green hills, grey cliffs/peaks, white snow on the summit, faceted toon look, slowly orbiting camera. No console errors, smooth framerate.

- [ ] **Step 4: Run `npm run typecheck`** — Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: terrain mesh with height/slope vertex colors"
```

---

### Task 5: Rapier physics with terrain collider

**Files:**
- Create: `src/physics/Physics.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/physics/Physics.ts`**

```ts
import RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three';

export { RAPIER };

export class Physics {
  private constructor(public world: RAPIER.World) {}

  static async create(): Promise<Physics> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;
    return new Physics(world);
  }

  step(): void { this.world.step(); }

  /** Static trimesh collider from any Three mesh geometry (terrain, landmarks). */
  addStaticMesh(mesh: THREE.Mesh): RAPIER.Collider {
    const geo = mesh.geometry.index ? mesh.geometry : mesh.geometry.toNonIndexed();
    mesh.updateWorldMatrix(true, false);
    const src = geo.attributes.position.array as Float32Array;
    const vertices = new Float32Array(src.length);
    const v = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < src.length; i += 3) {
      // bake world transform so collider matches the rendered mesh
      const e = mesh.matrixWorld.elements;
      v.x = src[i]; v.y = src[i + 1]; v.z = src[i + 2];
      vertices[i] = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12];
      vertices[i + 1] = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13];
      vertices[i + 2] = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14];
    }
    let indices: Uint32Array;
    if (geo.index) {
      indices = new Uint32Array(geo.index.array);
    } else {
      indices = new Uint32Array(src.length / 3);
      for (let i = 0; i < indices.length; i++) indices[i] = i;
    }
    return this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices));
  }

  /** Raycast helper. Returns hit point + normal or null. */
  raycast(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    maxToi: number,
    excludeCollider?: RAPIER.Collider,
  ): { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; toi: number } | null {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxToi, true, undefined, undefined, excludeCollider);
    if (!hit) return null;
    const p = ray.pointAt(hit.timeOfImpact);
    return { point: { x: p.x, y: p.y, z: p.z }, normal: hit.normal, toi: hit.timeOfImpact };
  }
}
```

Note: in `@dimforge/rapier3d-compat` 0.14 the ray hit field is `timeOfImpact`. On older versions it is `toi` — if typecheck complains, use the name TypeScript suggests.

- [ ] **Step 2: Wire into `src/main.ts` with a debug bouncing ball**

`main.ts` becomes async-bootstrapped:

```ts
import { Physics, RAPIER } from './physics/Physics';

async function boot() {
  const physics = await Physics.create();
  physics.addStaticMesh(terrainMesh);

  // debug: dynamic ball dropped on the island
  const ballBody = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(20, 120, 20),
  );
  physics.world.createCollider(RAPIER.ColliderDesc.ball(1).setRestitution(0.6), ballBody);
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), toonMaterial(0xff5252));
  scene.add(ballMesh);

  // in fixedUpdate:
  //   physics.step();
  //   const p = ballBody.translation();
  //   ballMesh.position.set(p.x, p.y, p.z);
}
boot().catch((e) => {
  const err = document.getElementById('loading-error')!;
  err.hidden = false;
  err.textContent = String(e);
});
```

Restructure the existing scene/loop code inside `boot()` (everything except imports). Keep the orbit camera but target the ball drop area: `camera.lookAt(20, 40, 20)`, radius 150.

- [ ] **Step 3: Verify in browser**

Expected: red ball falls from the sky, bounces on the visible terrain surface (not above or below it), rolls downhill, settles. If the ball passes through the terrain or floats, the trimesh transform bake in `addStaticMesh` is wrong — fix before continuing.

- [ ] **Step 4: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Rapier physics with terrain trimesh collider"
```

---

### Task 6: Input layer (keyboard/mouse + gamepad)

**Files:**
- Create: `src/core/deadzone.ts`, `src/core/Input.ts`
- Test: `tests/deadzone.test.ts`

- [ ] **Step 1: Write the failing tests — `tests/deadzone.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { applyDeadzone } from '../src/core/deadzone';

describe('applyDeadzone', () => {
  it('zeroes input below the threshold', () => {
    expect(applyDeadzone(0.1, 0.05)).toEqual({ x: 0, y: 0 });
  });

  it('keeps full deflection at magnitude 1', () => {
    const r = applyDeadzone(1, 0);
    expect(Math.hypot(r.x, r.y)).toBeCloseTo(1, 5);
  });

  it('rescales smoothly: just above threshold is near zero, not a jump', () => {
    const r = applyDeadzone(0.16, 0);
    expect(Math.hypot(r.x, r.y)).toBeLessThan(0.05);
  });

  it('preserves direction', () => {
    const r = applyDeadzone(0.5, 0.5);
    expect(r.x).toBeCloseTo(r.y, 5);
    expect(r.x).toBeGreaterThan(0);
  });

  it('clamps overshooting diagonals to magnitude 1', () => {
    const r = applyDeadzone(1, 1);
    expect(Math.hypot(r.x, r.y)).toBeLessThanOrEqual(1.000001);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/deadzone.test.ts`
Expected: FAIL — cannot resolve `../src/core/deadzone`.

- [ ] **Step 3: Implement `src/core/deadzone.ts`**

```ts
export function applyDeadzone(x: number, y: number, threshold = 0.15): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag < threshold) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - threshold) / (1 - threshold));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/deadzone.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Implement `src/core/Input.ts`**

```ts
import { applyDeadzone } from './deadzone';

export interface Actions {
  move: { x: number; y: number };
  look: { x: number; y: number };
  jumpPressed: boolean;
  jumpHeld: boolean;
  sprintHeld: boolean;
}

export class Input {
  readonly actions: Actions = {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    jumpPressed: false,
    jumpHeld: false,
    sprintHeld: false,
  };

  private keys = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private jumpQueued = false;
  private padJumpWas = false;

  constructor(canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => canvas.requestPointerLock());
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
  }

  /** Call exactly once per fixed update. Fills actions, clears edges/deltas. */
  poll(): void {
    let mx = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let my = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    let jumpHeld = this.keys.has('Space');
    let sprintHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let jumpPressed = this.jumpQueued;
    let lookX = this.mouseDX * 0.0025;
    let lookY = this.mouseDY * 0.0025;

    const pad = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (pad) {
      const ls = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      const rs = applyDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      if (ls.x !== 0 || ls.y !== 0) { mx = ls.x; my = -ls.y; }
      lookX += rs.x * 0.045;
      lookY += rs.y * 0.035;
      const aBtn = pad.buttons[0]?.pressed ?? false;       // A / Cross
      if (aBtn && !this.padJumpWas) jumpPressed = true;
      if (aBtn) jumpHeld = true;
      this.padJumpWas = aBtn;
      if (pad.buttons[1]?.pressed || pad.buttons[10]?.pressed) sprintHeld = true; // B or L3
    }

    const mv = Math.hypot(mx, my);
    const a = this.actions;
    a.move.x = mv > 1 ? mx / mv : mx;
    a.move.y = mv > 1 ? my / mv : my;
    a.look.x = lookX;
    a.look.y = lookY;
    a.jumpPressed = jumpPressed;
    a.jumpHeld = jumpHeld;
    a.sprintHeld = sprintHeld;

    this.mouseDX = 0;
    this.mouseDY = 0;
    this.jumpQueued = false;
  }
}
```

- [ ] **Step 6: Run `npm run typecheck`** — Expected: exit 0. (Input is wired up in Task 7.)

- [ ] **Step 7: Commit**

```bash
git add src/core/deadzone.ts src/core/Input.ts tests/deadzone.test.ts
git commit -m "feat: input action layer with keyboard/mouse and gamepad"
```

---

### Task 7: Player grounded movement, jump, and third-person camera

**Files:**
- Create: `src/player/Player.ts`, `src/camera/ThirdPersonCamera.ts`
- Modify: `src/main.ts` (capsule placeholder avatar, remove debug ball/orbit)

- [ ] **Step 1: Write `src/player/Player.ts`**

```ts
import * as THREE from 'three';
import { Physics, RAPIER } from '../physics/Physics';
import type { Actions } from '../core/Input';

export type PlayerState = 'grounded' | 'airborne' | 'climbing' | 'gliding';

export const GRAVITY = -30;
const WALK_SPEED = 5.5;
const SPRINT_SPEED = 9;
const JUMP_VELOCITY = 12;

export class Player {
  static readonly HALF_HEIGHT = 0.6;
  static readonly RADIUS = 0.35; // capsule total height 1.9 m

  state: PlayerState = 'airborne';
  readonly position = new THREE.Vector3();
  readonly facing = new THREE.Vector3(0, 0, -1);
  readonly lastGroundedPos = new THREE.Vector3();
  velocityY = 0;
  speed = 0; // horizontal speed, drives animation + FOV
  sprinting = false;

  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  protected controller: RAPIER.KinematicCharacterController;
  protected moveDir = new THREE.Vector3();

  constructor(protected physics: Physics, spawn: THREE.Vector3) {
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(Player.HALF_HEIGHT, Player.RADIUS),
      this.body,
    );
    this.controller = physics.world.createCharacterController(0.05);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.controller.enableAutostep(0.45, 0.25, true);
    this.position.copy(spawn);
    this.lastGroundedPos.copy(spawn);
  }

  update(dt: number, actions: Actions, cameraYaw: number): void {
    switch (this.state) {
      case 'grounded':
      case 'airborne':
        this.updateGroundAir(dt, actions, cameraYaw);
        break;
      case 'climbing': // implemented in Task 9
      case 'gliding':  // implemented in Task 10
        break;
    }
    const p = this.body.translation();
    this.position.set(p.x, p.y, p.z);
  }

  protected computeMoveDir(actions: Actions, cameraYaw: number): void {
    const f = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    this.moveDir.set(0, 0, 0).addScaledVector(f, actions.move.y).addScaledVector(r, actions.move.x);
    if (this.moveDir.lengthSq() > 1) this.moveDir.normalize();
    if (this.moveDir.lengthSq() > 0.0001) this.facing.copy(this.moveDir).normalize();
  }

  private updateGroundAir(dt: number, actions: Actions, cameraYaw: number): void {
    const grounded = this.state === 'grounded';
    this.computeMoveDir(actions, cameraYaw);

    this.sprinting = actions.sprintHeld && grounded && this.moveDir.lengthSq() > 0.01;
    const targetSpeed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    this.speed = this.moveDir.length() * targetSpeed;

    this.velocityY += GRAVITY * dt;
    if (grounded && this.velocityY < -2) this.velocityY = -2;
    if (grounded && actions.jumpPressed) {
      this.velocityY = JUMP_VELOCITY;
      this.state = 'airborne';
    }

    this.applyKinematicMove(
      this.moveDir.x * targetSpeed * dt,
      this.velocityY * dt,
      this.moveDir.z * targetSpeed * dt,
    );
  }

  /** Runs the Rapier KCC and updates grounded state + respawn anchor. */
  protected applyKinematicMove(dx: number, dy: number, dz: number): void {
    this.controller.computeColliderMovement(this.collider, { x: dx, y: dy, z: dz });
    const m = this.controller.computedMovement();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });

    if (this.controller.computedGrounded()) {
      if (this.state === 'airborne' || this.state === 'gliding') this.state = 'grounded';
      if (this.state === 'grounded') {
        if (this.velocityY < -2) this.velocityY = -2;
        this.lastGroundedPos.set(t.x, t.y, t.z);
      }
    } else if (this.state === 'grounded') {
      this.state = 'airborne';
    }
  }

  /** Hard reposition (respawn). */
  teleport(pos: THREE.Vector3): void {
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
    this.velocityY = 0;
    this.state = 'airborne';
  }
}
```

- [ ] **Step 2: Write `src/camera/ThirdPersonCamera.ts`**

```ts
import * as THREE from 'three';
import type { Physics, RAPIER } from '../physics/Physics';

export class ThirdPersonCamera {
  yaw = 0;
  pitch = -0.35;
  distance = 5.5;
  private currentPos = new THREE.Vector3();
  private initialized = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private physics: Physics,
    private playerCollider: RAPIER.Collider,
  ) {}

  update(dt: number, look: { x: number; y: number }, playerPos: THREE.Vector3, fovBoost: number): void {
    this.yaw -= look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.35, 1.0);

    const head = playerPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    let dist = this.distance;
    const hit = this.physics.raycast(head, dir, this.distance, this.playerCollider);
    if (hit) dist = Math.max(0.6, hit.toi - 0.25);

    const desired = head.clone().addScaledVector(dir, dist);
    if (!this.initialized) {
      this.currentPos.copy(desired);
      this.initialized = true;
    }
    this.currentPos.lerp(desired, 1 - Math.pow(0.0001, dt));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(head);

    const targetFov = 60 + fovBoost;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();
  }
}
```

Note the `import type { ... RAPIER }` — `RAPIER.Collider` used as a type only. If TypeScript complains, use `import type RAPIER from '@dimforge/rapier3d-compat'` instead.

- [ ] **Step 3: Wire into `src/main.ts`**

Remove the debug ball and the camera orbit. Add spawn search, player, capsule avatar, camera:

```ts
import { Input } from './core/Input';
import { Player } from './player/Player';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera';
import type { TerrainData } from './world/terrain/heightmap';

function findSpawn(terrain: TerrainData): THREE.Vector3 {
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    for (let rad = 480; rad > 100; rad -= 4) {
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const h = terrain.heightAt(x, z);
      if (h > 0.5 && h < 2 && terrain.normalAt(x, z).y > 0.95) {
        return new THREE.Vector3(x, h + 1.5, z);
      }
    }
  }
  return new THREE.Vector3(0, terrain.heightAt(0, 0) + 1.5, 0);
}

// inside boot(), after physics + terrain:
const input = new Input(renderer.domElement);
const player = new Player(physics, findSpawn(terrain));
const cam = new ThirdPersonCamera(camera, physics, player.collider);

const avatar = new THREE.Group();
const capsuleMesh = new THREE.Mesh(
  new THREE.CapsuleGeometry(Player.RADIUS, Player.HALF_HEIGHT * 2, 4, 12),
  toonMaterial(0x3aa0c9),
);
capsuleMesh.castShadow = true;
avatar.add(capsuleMesh);
const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), toonMaterial(0xffc107));
nose.rotation.x = Math.PI / 2;
nose.position.set(0, 0.5, -0.4);
avatar.add(nose); // facing indicator
scene.add(avatar);
```

Fixed update becomes:

```ts
(dt) => {
  input.poll();
  player.update(dt, input.actions, cam.yaw);
  physics.step();
  const fovBoost = player.state === 'gliding' ? 12 : player.sprinting ? 6 : 0;
  cam.update(dt, input.actions.look, player.position, fovBoost);
},
```

Render callback syncs the avatar:

```ts
() => {
  avatar.position.copy(player.position);
  avatar.position.y -= Player.HALF_HEIGHT + Player.RADIUS; // body center -> feet
  const targetYaw = Math.atan2(player.facing.x, player.facing.z);
  avatar.rotation.y += shortestAngle(targetYaw - avatar.rotation.y) * 0.25;
  renderer.render(scene, camera);
}
```

with the helper at module scope:

```ts
function shortestAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
```

Position the avatar group's contents so feet sit at y=0 of the group: shift `capsuleMesh.position.y = Player.HALF_HEIGHT + Player.RADIUS;` and `nose.position.y = 1.4;`.

- [ ] **Step 4: Feel check in browser**

Click canvas for pointer lock. Verify, fixing signs/feel before committing:
- W runs away from camera, S toward, A/D strafe; mouse orbits; camera never goes under terrain.
- Pushing W moves in the direction the camera faces (if inverted, flip the sign in `computeMoveDir`'s `f` vector).
- Space jumps (~2.4 m), Shift sprints visibly faster with slight FOV kick.
- Walking up gentle hills works; walls steeper than ~50° stop you; no jitter standing still on slopes.
- With a gamepad plugged in: left stick moves, right stick orbits, A jumps.

- [ ] **Step 5: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: kinematic player with jump and third-person camera"
```

---

### Task 8: Stamina system (TDD) + stamina wheel HUD + sprint gating

**Files:**
- Create: `src/player/Stamina.ts`, `src/ui/StaminaWheel.ts`
- Modify: `src/player/Player.ts`, `src/main.ts`
- Test: `tests/stamina.test.ts`

- [ ] **Step 1: Write the failing tests — `tests/stamina.test.ts`**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stamina.test.ts`
Expected: FAIL — cannot resolve `../src/player/Stamina`.

- [ ] **Step 3: Implement `src/player/Stamina.ts`**

```ts
export class Stamina {
  static readonly MAX = 100;
  static readonly REGEN_PER_S = 20;
  static readonly RECOVER_THRESHOLD = 30;

  value = Stamina.MAX;
  exhausted = false;

  get fraction(): number { return this.value / Stamina.MAX; }
  get canUse(): boolean { return !this.exhausted; }

  drain(amount: number): void {
    this.value = Math.max(0, this.value - amount);
    if (this.value === 0) this.exhausted = true;
  }

  update(dt: number, regenerating: boolean): void {
    if (regenerating) {
      this.value = Math.min(Stamina.MAX, this.value + Stamina.REGEN_PER_S * dt);
      if (this.exhausted && this.value >= Stamina.RECOVER_THRESHOLD) this.exhausted = false;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stamina.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write `src/ui/StaminaWheel.ts`**

```ts
import type { Stamina } from '../player/Stamina';

const R = 26;
const CIRC = 2 * Math.PI * R;

export class StaminaWheel {
  private root: HTMLDivElement;
  private fill: SVGCircleElement;

  constructor(hud: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'stamina-wheel';
    this.root.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="${R}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="7" />
        <circle class="fill" cx="32" cy="32" r="${R}" fill="none" stroke="#7ddf5a" stroke-width="7"
          stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="0"
          transform="rotate(-90 32 32)" />
      </svg>`;
    hud.appendChild(this.root);
    this.fill = this.root.querySelector('circle.fill')!;
  }

  update(stamina: Stamina): void {
    this.fill.setAttribute('stroke-dashoffset', String(CIRC * (1 - stamina.fraction)));
    this.root.classList.toggle('visible', stamina.fraction < 0.999);
    this.root.classList.toggle('exhausted', stamina.exhausted);
  }
}
```

- [ ] **Step 6: Gate sprint on stamina in `src/player/Player.ts`**

Add to the class:

```ts
import { Stamina } from './Stamina';
// field:
readonly stamina = new Stamina();
```

In `updateGroundAir`, replace the `this.sprinting = ...` line and add drain/regen:

```ts
this.sprinting =
  actions.sprintHeld && grounded && this.moveDir.lengthSq() > 0.01 && this.stamina.canUse;
const targetSpeed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;
this.speed = this.moveDir.length() * targetSpeed;

if (this.sprinting) this.stamina.drain(10 * dt);
this.stamina.update(dt, grounded && !this.sprinting);
```

- [ ] **Step 7: Wire the HUD in `src/main.ts`**

```ts
import { StaminaWheel } from './ui/StaminaWheel';
const staminaWheel = new StaminaWheel(document.getElementById('hud')!);
// at the end of fixedUpdate:
staminaWheel.update(player.stamina);
```

- [ ] **Step 8: Verify in browser**

Expected: wheel is invisible when full; sprinting fades in a green ring near screen center that depletes (~10 s full drain); releasing Shift refills (~5 s); draining to zero flashes red and blocks sprinting until ~30 %.

- [ ] **Step 9: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: stamina system with HUD wheel and sprint gating"
```

---

### Task 9: Climbing

**Files:**
- Modify: `src/player/Player.ts`

All climbing motion bypasses the KCC — position is set directly while stuck to the wall via raycasts.

- [ ] **Step 1: Add climbing fields and dispatch to `Player`**

New fields:

```ts
private wallNormal = new THREE.Vector3();
private climbLeap = 0;       // seconds of climb-jump boost remaining
private climbCooldown = 0;   // prevents instant re-grab after letting go
```

At the top of `update()`:

```ts
this.climbCooldown = Math.max(0, this.climbCooldown - dt);
```

In the `switch`, route `case 'climbing': this.updateClimb(dt, actions); break;`

In `updateGroundAir`, right after `this.computeMoveDir(...)`:

```ts
if (this.moveDir.lengthSq() > 0.09 && this.tryEnterClimb()) return;
```

- [ ] **Step 2: Implement climb entry**

```ts
private tryEnterClimb(): boolean {
  if (this.climbCooldown > 0 || !this.stamina.canUse) return false;
  const dir = this.moveDir.clone().normalize();
  const origin = { x: this.position.x, y: this.position.y + 0.3, z: this.position.z };
  const hit = this.physics.raycast(origin, { x: dir.x, y: 0, z: dir.z }, 0.9, this.collider);
  if (!hit || hit.normal.y > 0.64) return false; // not steep enough (cos 50°)
  this.wallNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
  this.state = 'climbing';
  this.velocityY = 0;
  this.climbLeap = 0;
  return true;
}
```

- [ ] **Step 3: Implement `updateClimb`**

```ts
private updateClimb(dt: number, actions: Actions): void {
  // re-stick to the wall
  let inward = this.wallNormal.clone().multiplyScalar(-1);
  const origin = this.position.clone().addScaledVector(this.wallNormal, 0.5);
  const hit = this.physics.raycast(origin, inward, 1.2, this.collider);
  if (!hit) { this.tryVault(); return; }
  this.wallNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
  inward = this.wallNormal.clone().multiplyScalar(-1);

  this.stamina.drain(8 * dt);
  if (!this.stamina.canUse) { this.exitClimb(); return; }

  if (actions.jumpPressed) {
    if (actions.move.y < -0.3) { this.exitClimb(); this.velocityY = 2; return; } // let go
    this.stamina.drain(12);
    this.climbLeap = 0.3;
  }
  this.climbLeap = Math.max(0, this.climbLeap - dt);

  // wall tangent basis
  const up = new THREE.Vector3(0, 1, 0);
  const right = up.clone().cross(this.wallNormal).normalize();
  const wallUp = this.wallNormal.clone().cross(right).normalize();

  if (actions.move.y > 0.1 && this.tryVault()) return;

  const speed = 2.2;
  const boost = this.climbLeap > 0 ? 4 : 1;
  const vel = right.clone().multiplyScalar(-actions.move.x * speed)
    .addScaledVector(wallUp, actions.move.y * speed * boost);

  const target = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z)
    .addScaledVector(this.wallNormal, Player.RADIUS + 0.15)
    .addScaledVector(vel, dt);
  this.body.setNextKinematicTranslation({ x: target.x, y: target.y, z: target.z });

  const face = inward.clone();
  face.y = 0;
  if (face.lengthSq() > 0.001) this.facing.copy(face.normalize());
  this.speed = vel.length(); // drives climb animation speed later
}

private exitClimb(): void {
  this.state = 'airborne';
  this.climbCooldown = 0.35;
}
```

- [ ] **Step 4: Implement `tryVault`**

```ts
/** Returns true if it handled a state change (vault to top, or fall). */
private tryVault(): boolean {
  const inward = this.wallNormal.clone().multiplyScalar(-1);
  // still a steep wall at head height? then no ledge yet
  const headOrigin = this.position.clone().addScaledVector(this.wallNormal, 0.5);
  headOrigin.y += 1.1;
  const wallAtHead = this.physics.raycast(headOrigin, inward, 1.3, this.collider);
  if (wallAtHead && wallAtHead.normal.y < 0.64) return false;

  // find the surface on top of the ledge
  const overOrigin = this.position.clone().addScaledVector(inward, Player.RADIUS + 0.55);
  overOrigin.y += 1.7;
  const down = this.physics.raycast(overOrigin, { x: 0, y: -1, z: 0 }, 2.6, this.collider);
  if (!down) { this.exitClimb(); return true; } // wall ended with nothing on top

  const standY = down.point.y + Player.HALF_HEIGHT + Player.RADIUS + 0.05;
  this.body.setNextKinematicTranslation({ x: overOrigin.x, y: standY, z: overOrigin.z });
  this.state = 'grounded';
  this.velocityY = 0;
  this.lastGroundedPos.set(overOrigin.x, standY, overOrigin.z);
  return true;
}
```

- [ ] **Step 5: Feel check in browser**

Find a cliff (grey rock face) and verify:
- Running into it grabs on; character sticks and W/S/A/D move along the wall (if A/D are mirrored, flip the `-actions.move.x` sign).
- Stamina ring drains while hanging; hitting zero drops you.
- Space while pushing up does a climb-leap (faster ascent burst, visible extra drain).
- Space + S lets go.
- Topping out over a ledge vaults you onto the surface, state returns to grounded, stamina starts regenerating.
- You cannot grab while exhausted; gentle slopes (<50°) never trigger climbing.

- [ ] **Step 6: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/player/Player.ts
git commit -m "feat: climb-any-surface with stamina, climb-jump, and ledge vault"
```

---

### Task 10: Paraglider + wind streaks

**Files:**
- Create: `src/fx/WindStreaks.ts`
- Modify: `src/player/Player.ts`, `src/main.ts`

- [ ] **Step 1: Add glide logic to `Player`**

In `updateGroundAir`, after the jump handling, add glide entry (press jump again mid-air):

```ts
if (!grounded && actions.jumpPressed && this.stamina.canUse && this.velocityY < 2) {
  this.state = 'gliding';
  this.glideVel.set(this.moveDir.x, 0, this.moveDir.z).multiplyScalar(this.speed);
  return;
}
```

New field and method:

```ts
private glideVel = new THREE.Vector3();

private updateGlide(dt: number, actions: Actions, cameraYaw: number): void {
  this.computeMoveDir(actions, cameraYaw);
  this.stamina.drain(4 * dt);

  // exit: press jump again, run out of stamina, or touch ground
  if (actions.jumpPressed || !this.stamina.canUse) { this.state = 'airborne'; return; }

  // slow fall
  this.velocityY += GRAVITY * dt * 0.25;
  this.velocityY = Math.max(this.velocityY, -2.5);

  // steer toward input at glide speed
  const targetVel = this.moveDir.clone().multiplyScalar(9);
  this.glideVel.lerp(targetVel, Math.min(1, dt * 1.5));
  this.speed = this.glideVel.length();
  if (this.glideVel.lengthSq() > 0.01) {
    this.facing.copy(this.glideVel.clone().setY(0).normalize());
  }

  this.applyKinematicMove(this.glideVel.x * dt, this.velocityY * dt, this.glideVel.z * dt);
  if (this.state === 'grounded') this.velocityY = -2; // landed
}
```

Route it in the `switch`: `case 'gliding': this.updateGlide(dt, actions, cameraYaw); break;`

Note `applyKinematicMove` already flips state to `grounded` on landing — the `if` above just settles velocity.

- [ ] **Step 2: Write `src/fx/WindStreaks.ts`**

```ts
import * as THREE from 'three';

const COUNT = 14;

export class WindStreaks {
  readonly group = new THREE.Group();
  private offsets: THREE.Vector3[] = [];
  private phases: number[] = [];

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    const geo = new THREE.BoxGeometry(0.03, 0.03, 2.2);
    for (let i = 0; i < COUNT; i++) {
      const m = new THREE.Mesh(geo, mat);
      this.group.add(m);
      this.offsets.push(new THREE.Vector3(
        (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6,
      ));
      this.phases.push(Math.random() * 10);
    }
    this.group.visible = false;
  }

  update(dt: number, active: boolean, playerPos: THREE.Vector3, velocity: THREE.Vector3): void {
    this.group.visible = active && velocity.lengthSq() > 4;
    if (!this.group.visible) return;
    const dir = velocity.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    this.group.children.forEach((child, i) => {
      this.phases[i] += dt * 3;
      const slide = ((this.phases[i] % 2) - 1) * 6; // -6..6 along travel dir
      child.position.copy(playerPos).add(this.offsets[i]).addScaledVector(dir, -slide);
      child.quaternion.copy(q);
    });
  }
}
```

Expose what it needs from `Player` — add a getter:

```ts
get worldVelocity(): THREE.Vector3 {
  return this.state === 'gliding'
    ? this.glideVel.clone().setY(this.velocityY)
    : this.facing.clone().multiplyScalar(this.speed).setY(this.velocityY);
}
```

- [ ] **Step 3: Wire in `src/main.ts`**

```ts
import { WindStreaks } from './fx/WindStreaks';
const windStreaks = new WindStreaks();
scene.add(windStreaks.group);
// end of fixedUpdate:
windStreaks.update(dt, player.state === 'gliding', player.position, player.worldVelocity);
```

(The `fovBoost` glide case from Task 7 now activates.)

- [ ] **Step 4: Feel check in browser**

- Jump off a cliff, press Space again mid-air: fall slows visibly, white wind lines stream past, FOV widens.
- Steering with WASD/left-stick curves the glide; releasing input keeps current momentum.
- Stamina drains (~25 s of glide); exhaustion drops you; Space cancels the glider.
- Landing returns to grounded cleanly (no bounce/jitter); you can glide again after jumping.
- Glide from a high cliff across a valley: should carry hundreds of meters.

- [ ] **Step 5: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: paraglider with steering, stamina drain, and wind streaks"
```

---

### Task 11: Character model and animations

**Files:**
- Create: `public/assets/character.glb` (downloaded), `src/player/CharacterAvatar.ts`
- Modify: `src/main.ts` (replace capsule avatar)

- [ ] **Step 1: Download the character model**

```bash
curl -L -o public/assets/character.glb https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb
```

Expected: file ~2-4 MB. This model (three.js examples, MIT-licensed repo) contains clips named `Idle`, `Walk`, `Run`, `TPose`. If the URL 404s, try `https://threejs.org/examples/models/gltf/Soldier.glb`. If both fail, STOP and ask the user to provide any rigged glb with idle/walk/run clips.

- [ ] **Step 2: Write `src/player/CharacterAvatar.ts`**

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getGradientMap } from '../core/toon';
import type { Player } from './Player';

export class CharacterAvatar {
  readonly group = new THREE.Group();   // feet at origin, faces -Z after inner flip
  private inner = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';

  private constructor(model: THREE.Group, clips: THREE.AnimationClip[]) {
    this.inner.add(model);
    this.group.add(this.inner);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.play('Idle');
  }

  static async load(url: string, onProgress?: (f: number) => void): Promise<CharacterAvatar> {
    const gltf = await new GLTFLoader().loadAsync(url, (e) => {
      if (onProgress && e.total > 0) onProgress(e.loaded / e.total);
    });
    const model = gltf.scene;

    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.BackSide });
    outlineMat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed += normalize(objectNormal) * 0.015;',
      );
    };

    const outlines: THREE.SkinnedMesh[] = [];
    model.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) {
        obj.frustumCulled = false;
        obj.castShadow = true;
        const src = obj.material as THREE.MeshStandardMaterial;
        obj.material = new THREE.MeshToonMaterial({
          color: src.color, map: src.map ?? null, gradientMap: getGradientMap(),
        });
        const shell = new THREE.SkinnedMesh(obj.geometry, outlineMat);
        shell.frustumCulled = false;
        shell.bind(obj.skeleton, obj.bindMatrix);
        outlines.push(shell);
      }
    });
    for (const shell of outlines) model.add(shell); // same skeleton drives the shells

    return new CharacterAvatar(model, gltf.animations);
  }

  private play(name: string, fade = 0.18): void {
    if (this.current === name || !this.actions.has(name)) return;
    const next = this.actions.get(name)!;
    next.reset().fadeIn(fade).play();
    const prev = this.actions.get(this.current);
    if (prev) prev.fadeOut(fade);
    this.current = name;
  }

  update(dt: number, player: Player): void {
    let clip = 'Idle';
    let timeScale = 1;
    let lean = 0;

    switch (player.state) {
      case 'grounded':
        if (player.speed < 0.2) clip = 'Idle';
        else if (player.speed < 6.5) { clip = 'Walk'; timeScale = THREE.MathUtils.clamp(player.speed / 3.5, 0.7, 1.8); }
        else { clip = 'Run'; timeScale = player.speed / 7; }
        break;
      case 'airborne':
        clip = 'Idle'; timeScale = 0.4;
        break;
      case 'climbing':
        clip = 'Walk'; timeScale = THREE.MathUtils.clamp(player.speed / 1.5, 0, 2);
        break;
      case 'gliding':
        clip = 'Run'; timeScale = 0.15; // slow flutter
        lean = 0.55;                    // lean forward under the glider
        break;
    }

    this.play(clip);
    const action = this.actions.get(this.current);
    if (action) action.timeScale = timeScale;
    this.inner.rotation.x += (lean - this.inner.rotation.x) * Math.min(1, dt * 8);
    this.mixer.update(dt);
  }
}
```

- [ ] **Step 3: Replace the capsule in `src/main.ts`**

Delete `capsuleMesh` and `nose`. Load the avatar during boot (before starting the loop), feeding the loading bar:

```ts
import { CharacterAvatar } from './player/CharacterAvatar';

const fill = document.getElementById('loading-fill') as HTMLDivElement;
const avatarModel = await CharacterAvatar.load('/assets/character.glb', (f) => {
  fill.style.width = `${Math.round(f * 100)}%`;
});
const avatar = avatarModel.group;
scene.add(avatar);
```

In the render callback keep the existing position/rotation sync and add:

```ts
avatarModel.update(frameDt, player);
```

(The render callback signature is `(alpha, frameDt)` — use the second argument.)

- [ ] **Step 4: Verify in browser**

- Character is a toon-shaded soldier with a dark outline, feet on the ground (adjust the `avatar.position.y -=` offset in the render sync if floating/sunk).
- If he runs backwards relative to movement, set `this.inner.rotation.y = Math.PI;` in the `CharacterAvatar` constructor.
- Idle → walk → run blend with speed; sprint looks faster than walk.
- Climbing plays a slow clamber; gliding leans him forward; falling looks acceptable.
- No T-pose flashes during transitions.

- [ ] **Step 5: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: rigged toon character with animation state blending"
```

---

### Task 12: Day/night cycle and sky (palette math TDD)

**Files:**
- Create: `src/world/daynight.ts`, `src/world/Sky.ts`
- Modify: `src/main.ts` (replace static lights)
- Test: `tests/daynight.test.ts`

- [ ] **Step 1: Write the failing tests — `tests/daynight.test.ts`**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/daynight.test.ts`
Expected: FAIL — cannot resolve `../src/world/daynight`.

- [ ] **Step 3: Implement `src/world/daynight.ts`** (pure, no Three.js)

```ts
export interface Palette {
  top: [number, number, number];
  horizon: [number, number, number];
  fog: [number, number, number];
  sunColor: [number, number, number];
  sunIntensity: number;
  ambient: number;
  stars: number; // 0..1 star opacity
}

type RGB = [number, number, number];
const rgb = (hex: number): RGB => [
  ((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255,
];

const NIGHT: Palette = {
  top: rgb(0x0b1026), horizon: rgb(0x1a2440), fog: rgb(0x141d35),
  sunColor: rgb(0x9db4ff), sunIntensity: 0, ambient: 0.28, stars: 1,
};
const DAWN: Palette = {
  top: rgb(0x35487f), horizon: rgb(0xff9d5c), fog: rgb(0xc98a6a),
  sunColor: rgb(0xffc187), sunIntensity: 0.7, ambient: 0.5, stars: 0.15,
};
const DAY: Palette = {
  top: rgb(0x57b5ff), horizon: rgb(0xc3e7ff), fog: rgb(0xa8d8ff),
  sunColor: rgb(0xfff4d6), sunIntensity: 2.2, ambient: 0.9, stars: 0,
};
const DUSK: Palette = {
  top: rgb(0x3b3a73), horizon: rgb(0xff8e4f), fog: rgb(0xd39a72),
  sunColor: rgb(0xffb36b), sunIntensity: 0.5, ambient: 0.45, stars: 0.15,
};

const KEYS: { t: number; p: Palette }[] = [
  { t: 0.0, p: NIGHT }, { t: 0.2, p: NIGHT }, { t: 0.26, p: DAWN },
  { t: 0.35, p: DAY }, { t: 0.65, p: DAY }, { t: 0.77, p: DUSK },
  { t: 0.85, p: NIGHT }, { t: 1.0, p: NIGHT },
];

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const lerpRGB = (a: RGB, b: RGB, f: number): RGB => [
  lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f),
];

export function paletteAt(t: number): Palette {
  const tt = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= tt) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const f = b.t === a.t ? 0 : (tt - a.t) / (b.t - a.t);
  return {
    top: lerpRGB(a.p.top, b.p.top, f),
    horizon: lerpRGB(a.p.horizon, b.p.horizon, f),
    fog: lerpRGB(a.p.fog, b.p.fog, f),
    sunColor: lerpRGB(a.p.sunColor, b.p.sunColor, f),
    sunIntensity: lerp(a.p.sunIntensity, b.p.sunIntensity, f),
    ambient: lerp(a.p.ambient, b.p.ambient, f),
    stars: lerp(a.p.stars, b.p.stars, f),
  };
}

/** Sun elevation angle: sunrise t=0.25, noon t=0.5, sunset t=0.75. */
export function sunAngle(t: number): number {
  return (t - 0.25) * Math.PI * 2;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/daynight.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write `src/world/Sky.ts`**

```ts
import * as THREE from 'three';
import { paletteAt, sunAngle } from './daynight';

const CYCLE_SECONDS = 600; // 10-minute full day

export class Sky {
  readonly group = new THREE.Group(); // re-centered on the camera every frame
  readonly sun = new THREE.DirectionalLight(0xffffff, 2);
  readonly ambient = new THREE.AmbientLight(0xbcd8ff, 0.9);
  time01 = 0.35; // start mid-morning

  private domeMat: THREE.ShaderMaterial;
  private starsMat: THREE.PointsMaterial;

  constructor() {
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x57b5ff) },
        horizonColor: { value: new THREE.Color(0xc3e7ff) },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunGlow: { value: 1 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 horizonColor;
        uniform vec3 sunDir; uniform float sunGlow;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
          float s = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 350.0);
          col += vec3(1.0, 0.9, 0.7) * s * sunGlow;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), this.domeMat);
    dome.renderOrder = -10;
    this.group.add(dome);

    const starPos = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.95 + 0.05;
      v.normalize().multiplyScalar(1100);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false,
    });
    const stars = new THREE.Points(starGeo, this.starsMat);
    stars.renderOrder = -9;
    this.group.add(stars);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.far = 400;
    this.sun.shadow.bias = -0.0005;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.group, this.sun, this.sun.target, this.ambient);
  }

  update(dt: number, scene: THREE.Scene, cameraPos: THREE.Vector3, playerPos: THREE.Vector3): void {
    this.time01 = (this.time01 + dt / CYCLE_SECONDS) % 1;
    const p = paletteAt(this.time01);
    const ang = sunAngle(this.time01);
    const dir = new THREE.Vector3(Math.cos(ang) * 0.45, Math.sin(ang), 0.35).normalize();

    this.group.position.copy(cameraPos);
    this.domeMat.uniforms.topColor.value.setRGB(...p.top);
    this.domeMat.uniforms.horizonColor.value.setRGB(...p.horizon);
    this.domeMat.uniforms.sunDir.value.copy(dir);
    this.domeMat.uniforms.sunGlow.value = p.sunIntensity > 0 ? 1 : 0;
    this.starsMat.opacity = p.stars;

    const isNight = dir.y < -0.05;
    const lightDir = isNight ? dir.clone().multiplyScalar(-1) : dir; // moonlight from mirrored sun
    this.sun.position.copy(playerPos).addScaledVector(lightDir, 150);
    this.sun.target.position.copy(playerPos);
    this.sun.intensity = isNight ? 0.25 : Math.max(0.05, p.sunIntensity);
    this.sun.color.setRGB(...(isNight ? ([0.62, 0.71, 1] as const) : p.sunColor));
    this.ambient.intensity = p.ambient;

    (scene.fog as THREE.Fog).color.setRGB(...p.fog);
  }
}
```

- [ ] **Step 6: Wire into `src/main.ts`**

Delete the static `sun`/ambient lights and `scene.background`. Add:

```ts
import { Sky } from './world/Sky';
const sky = new Sky();
sky.addTo(scene);
// end of fixedUpdate:
sky.update(dt, scene, camera.position, player.position);
```

For quick visual checking add a temporary time accelerator: holding `KeyT` multiplies progression — easiest is in fixedUpdate:

```ts
if ((input as any).keys?.has?.('KeyT')) sky.time01 = (sky.time01 + dt * 0.02) % 1;
```

Make `keys` accessible by adding a public getter to `Input`: `get heldKeys(): ReadonlySet<string> { return this.keys; }` and use `input.heldKeys.has('KeyT')` (avoid the `any` cast).

- [ ] **Step 7: Verify in browser**

Hold T to spin the day: blue noon sky → orange dusk at the horizon → dark night with stars and faint blue moonlight → orange dawn → day. Fog and terrain lighting follow. Shadows track the player everywhere on the island. Sun disc glow visible in the dome.

- [ ] **Step 8: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: day/night cycle with sky dome, stars, and tested palettes"
```

---

### Task 13: Water and respawn watchdog

**Files:**
- Create: `src/world/Water.ts`
- Modify: `index.html` (fade div), `src/main.ts`

- [ ] **Step 1: Write `src/world/Water.ts`**

```ts
import * as THREE from 'three';
import { getGradientMap } from '../core/toon';

export class Water {
  readonly mesh: THREE.Mesh;
  private timeUniform = { value: 0 };

  constructor() {
    const geo = new THREE.PlaneGeometry(4000, 4000, 64, 64);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshToonMaterial({
      color: 0x2e7fa8, gradientMap: getGradientMap(), transparent: true, opacity: 0.88,
    });
    const tu = this.timeUniform;
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTime = tu;
      s.vertexShader = `uniform float uTime;\n` + s.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.y += sin(transformed.x * 0.06 + uTime * 1.2) * 0.25
                        + cos(transformed.z * 0.05 + uTime * 0.9) * 0.25;`,
      );
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = -0.15;
    this.mesh.name = 'water';
  }

  update(dt: number): void { this.timeUniform.value += dt; }
}
```

- [ ] **Step 2: Add the fade overlay to `index.html`**

Add `<div id="fade"></div>` right after `<div id="hud"></div>`. (The CSS already exists from Task 1.)

- [ ] **Step 3: Wire water + watchdog in `src/main.ts`**

```ts
import { Water } from './world/Water';
const water = new Water();
scene.add(water.mesh);

let respawning = false;
function respawn() {
  if (respawning) return;
  respawning = true;
  const fade = document.getElementById('fade')!;
  fade.style.opacity = '1';
  setTimeout(() => {
    player.teleport(player.lastGroundedPos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    fade.style.opacity = '0';
    setTimeout(() => { respawning = false; }, 600);
  }, 400);
}
```

In fixedUpdate (after `player.update`):

```ts
water.update(dt);
const groundBelow = terrain.heightAt(player.position.x, player.position.z);
const feetY = player.position.y - (Player.HALF_HEIGHT + Player.RADIUS);
if (player.position.y < -30) respawn();                       // fell through world
else if (groundBelow < -1.5 && feetY < 0.2) respawn();        // deep water = drown
```

- [ ] **Step 4: Verify in browser**

- Ocean surrounds the island with gentle toon waves; beach shoreline reads clearly.
- Walk into the sea: shallow water (ankle depth near shore) is walkable; continuing into deep water fades to black and respawns you on the beach where you last stood.
- Glide far over the ocean until stamina dies: you drown and respawn at the launch point.
- Stamina/state behave normally after respawn.

- [ ] **Step 5: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: toon ocean and drowning/out-of-bounds respawn"
```

---

### Task 14: Props (trees/rocks) and landmarks (tower + ruins)

**Files:**
- Create: `src/world/Props.ts`, `src/world/Landmarks.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/world/Props.ts`**

```ts
import * as THREE from 'three';
import { toonMaterial } from '../core/toon';
import { Physics, RAPIER } from '../physics/Physics';
import type { TerrainData } from './terrain/heightmap';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_TREES = 600;
const MAX_ROCKS = 250;

export function scatterProps(scene: THREE.Scene, physics: Physics, terrain: TerrainData, seed = 7): void {
  const rand = mulberry32(seed);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6), toonMaterial(0x7a5230), MAX_TREES);
  const canopies = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.2, 4.5, 7), toonMaterial(0x3e8e4f), MAX_TREES);
  trunks.castShadow = canopies.castShadow = true;

  let n = 0;
  for (let i = 0; i < 6000 && n < MAX_TREES; i++) {
    const x = (rand() * 2 - 1) * 470, z = (rand() * 2 - 1) * 470;
    const h = terrain.heightAt(x, z);
    if (h < 3 || h > 45 || terrain.normalAt(x, z).y < 0.8) continue;
    const s = 0.8 + rand() * 0.9;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, h + 1.2 * s, z), q, new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(n, m);
    m.compose(new THREE.Vector3(x, h + (2.4 + 2.25) * s, z), q, new THREE.Vector3(s, s, s));
    canopies.setMatrixAt(n, m);
    physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(1.2 * s, 0.35 * s).setTranslation(x, h + 1.2 * s, z));
    n++;
  }
  trunks.count = canopies.count = n;
  scene.add(trunks, canopies);

  const rocks = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.8, 0), toonMaterial(0x8d8d93), MAX_ROCKS);
  rocks.castShadow = true;
  let r = 0;
  for (let i = 0; i < 4000 && r < MAX_ROCKS; i++) {
    const x = (rand() * 2 - 1) * 480, z = (rand() * 2 - 1) * 480;
    const h = terrain.heightAt(x, z);
    if (h < 1 || h > 80) continue;
    const s = 0.6 + rand() * 2.0;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, h + 0.3 * s, z), q, new THREE.Vector3(s, s * 0.8, s));
    rocks.setMatrixAt(r, m);
    if (s > 1.4) {
      physics.world.createCollider(
        RAPIER.ColliderDesc.ball(0.7 * s).setTranslation(x, h + 0.3 * s, z));
    }
    r++;
  }
  rocks.count = r;
  scene.add(rocks);
}
```

- [ ] **Step 2: Write `src/world/Landmarks.ts`**

```ts
import * as THREE from 'three';
import { toonMaterial } from '../core/toon';
import { Physics, RAPIER } from '../physics/Physics';
import type { TerrainData } from './terrain/heightmap';

const STONE = 0x4a4f5d;
const GLOW = 0x53d7f0;
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.BackSide });

/** Box with toon material, inverted-hull outline, and a static cuboid collider. */
function stoneBox(
  scene: THREE.Scene, physics: Physics,
  w: number, h: number, d: number, x: number, y: number, z: number,
): void {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, toonMaterial(STONE));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set(x, y, z);
  const shell = new THREE.Mesh(geo, OUTLINE);
  shell.position.copy(mesh.position);
  shell.scale.setScalar(1.03);
  scene.add(mesh, shell);
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z));
}

function column(
  scene: THREE.Scene, physics: Physics,
  height: number, x: number, y: number, z: number, tiltZ = 0,
): void {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, height, 8), toonMaterial(STONE));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set(x, y + height / 2, z);
  mesh.rotation.z = tiltZ;
  scene.add(mesh);
  if (tiltZ === 0) {
    physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(height / 2, 0.6).setTranslation(x, y + height / 2, z));
  }
}

export function buildLandmarks(scene: THREE.Scene, physics: Physics, terrain: TerrainData): void {
  // tower site: highest point in the 120-300 m ring from center
  let tx = 0, tz = 0, th = -Infinity;
  for (let a = 0; a < Math.PI * 2; a += 0.03) {
    for (let r = 120; r <= 300; r += 6) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = terrain.heightAt(x, z);
      if (h > th) { th = h; tx = x; tz = z; }
    }
  }
  // 5 tapering levels + top platform = ~39 m tower
  for (let i = 0; i < 5; i++) {
    const w = 9 - i * 1.2;
    stoneBox(scene, physics, w, 7.5, w, tx, th + 3.75 + i * 7.5, tz);
  }
  stoneBox(scene, physics, 10, 1, 10, tx, th + 5 * 7.5 + 0.5, tz);
  // glowing corner pillars on top
  for (const [ox, oz] of [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.4], [4.4, 4.4]]) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 2.4, 0.4),
      new THREE.MeshBasicMaterial({ color: GLOW }),
    );
    glow.position.set(tx + ox, th + 5 * 7.5 + 2.2, tz + oz);
    scene.add(glow);
  }

  // two ruins on flat grass, far from the tower and from each other
  const sites: { x: number; z: number }[] = [];
  outer:
  for (let a = 0; a < Math.PI * 2 && sites.length < 2; a += 0.05) {
    for (let r = 100; r <= 380; r += 8) {
      const x = Math.cos(a + sites.length * 2.1) * r, z = Math.sin(a + sites.length * 2.1) * r;
      const h = terrain.heightAt(x, z);
      if (h < 5 || h > 35 || terrain.normalAt(x, z).y < 0.93) continue;
      if (Math.hypot(x - tx, z - tz) < 150) continue;
      if (sites.some((s) => Math.hypot(x - s.x, z - s.z) < 200)) continue;
      sites.push({ x, z });
      continue outer;
    }
  }
  for (const site of sites) {
    const y = terrain.heightAt(site.x, site.z);
    const heights = [3.5, 2.2, 4, 1.4, 3, 2.6, 1.8, 3.8]; // "broken" ring
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      column(scene, physics, heights[i], site.x + Math.cos(ang) * 6, y, site.z + Math.sin(ang) * 6);
    }
    column(scene, physics, 4, site.x + 9, y + 0.6, site.z, Math.PI / 2); // fallen column
    // arch
    stoneBox(scene, physics, 1, 5, 1, site.x - 2, y + 2.5, site.z);
    stoneBox(scene, physics, 1, 5, 1, site.x + 2, y + 2.5, site.z);
    stoneBox(scene, physics, 5.4, 1, 1.2, site.x, y + 5.5, site.z);
  }
}
```

- [ ] **Step 3: Wire in `src/main.ts`** (inside boot, after terrain collider)

```ts
import { scatterProps } from './world/Props';
import { buildLandmarks } from './world/Landmarks';
scatterProps(scene, physics, terrain);
buildLandmarks(scene, physics, terrain);
```

- [ ] **Step 4: Verify in browser**

- Trees cover grassy hills (not beaches/peaks); rocks scattered everywhere; you collide with trunks and big rocks, walk through small ones.
- A grey tower with glowing blue top pillars stands on a ridge, visible from spawn; every wall of it is climbable; from the top you can glide a long way.
- Two ruins with column rings and an arch sit on flat grass; columns are climbable and block movement.
- Framerate still smooth (instanced draws: 3 for all trees+rocks).

- [ ] **Step 5: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: instanced trees/rocks and climbable tower + ruins"
```

---

### Task 15: Swaying grass

**Files:**
- Create: `src/fx/Grass.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/fx/Grass.ts`**

```ts
import * as THREE from 'three';
import { getGradientMap } from '../core/toon';
import type { TerrainData } from '../world/terrain/heightmap';

const COUNT = 60000;
const RADIUS = 70;          // blades live within this radius of the anchor
const RESCATTER_DIST = 25;  // re-scatter when the player strays this far

export class Grass {
  readonly mesh: THREE.InstancedMesh;
  private timeUniform = { value: 0 };
  private anchor = new THREE.Vector3(Infinity, 0, Infinity);
  private dummy = new THREE.Object3D();

  constructor(private terrain: TerrainData) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.06, 0, 0,  0.06, 0, 0,  0, 0.55, 0,
    ]), 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshToonMaterial({
      color: 0x5fae4a, gradientMap: getGradientMap(), side: THREE.DoubleSide,
    });
    const tu = this.timeUniform;
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTime = tu;
      s.vertexShader = `uniform float uTime;\n` + s.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.x += sin(uTime * 2.0 + instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.7)
                          * position.y * 0.35;`,
      );
    };

    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.timeUniform.value += dt;
    if (playerPos.distanceTo(this.anchor) > RESCATTER_DIST) this.scatter(playerPos);
  }

  private scatter(center: THREE.Vector3): void {
    this.anchor.copy(center);
    let n = 0;
    for (let i = 0; i < COUNT * 2 && n < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * RADIUS;
      const x = center.x + Math.cos(a) * r;
      const z = center.z + Math.sin(a) * r;
      const h = this.terrain.heightAt(x, z);
      if (h < 2.5 || h > 45 || this.terrain.normalAt(x, z).y < 0.8) continue;
      this.dummy.position.set(x, h, z);
      this.dummy.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.7 + Math.random() * 0.7;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n++, this.dummy.matrix);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
```

- [ ] **Step 2: Wire in `src/main.ts`**

```ts
import { Grass } from './fx/Grass';
const grass = new Grass(terrain);
scene.add(grass.mesh);
// end of fixedUpdate:
grass.update(dt, player.position);
```

- [ ] **Step 3: Verify in browser**

- Grassy areas around the player are covered in swaying blades; sand, rock, snow, and underwater areas stay bare.
- Walking/gliding far refreshes the carpet around you without a visible hitch (if the re-scatter stutters, drop COUNT to 40000).
- 60 fps sustained while sprinting through dense grass (check with the FPS overlay from your browser or `requestAnimationFrame` timing in devtools).

- [ ] **Step 4: Run `npm run typecheck` and `npm test`** — Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: instanced swaying grass that follows the player"
```

---

### Task 16: Synthesized audio, polish, and final playtest

**Files:**
- Create: `src/audio/AudioManager.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/audio/AudioManager.ts`** (all WebAudio, no asset files)

```ts
import type { PlayerState } from '../player/Player';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private stepTimer = 0;

  /** Call from a user-gesture handler (browser autoplay policy). Idempotent. */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);

    // looping wind: filtered white noise
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.5;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(bp).connect(this.windGain).connect(this.master);
    src.start();

    this.scheduleAmbientNote();
  }

  private scheduleAmbientNote(): void {
    setTimeout(() => {
      this.playPianoPhrase();
      this.scheduleAmbientNote();
    }, 8000 + Math.random() * 14000);
  }

  /** 1-3 sparse pentatonic notes, BoTW-style. */
  private playPianoPhrase(): void {
    if (!this.ctx) return;
    const notes = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3];
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const t = this.ctx.currentTime + i * (0.4 + Math.random() * 0.35);
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = notes[Math.floor(Math.random() * notes.length)];
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 2.8);
    }
  }

  private footstep(intensity: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.05);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600 + Math.random() * 250;
    const g = this.ctx.createGain();
    g.gain.value = 0.1 * intensity;
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }

  update(dt: number, state: PlayerState, speed: number): void {
    if (!this.ctx) return;
    const windTarget =
      state === 'gliding' ? 0.5 : state === 'airborne' ? 0.15 : Math.min(0.05, speed * 0.005);
    this.windGain.gain.setTargetAtTime(windTarget, this.ctx.currentTime, 0.4);

    if (state === 'grounded' && speed > 0.5) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.footstep(Math.min(1, speed / 9));
        this.stepTimer = 2.6 / speed;
      }
    } else {
      this.stepTimer = 0;
    }
  }
}
```

- [ ] **Step 2: Wire in `src/main.ts`**

```ts
import { AudioManager } from './audio/AudioManager';
const audio = new AudioManager();
window.addEventListener('pointerdown', () => audio.init(), { once: true });
window.addEventListener('keydown', () => audio.init(), { once: true });
// end of fixedUpdate:
audio.update(dt, player.state, player.speed);
```

- [ ] **Step 3: Verify audio in browser**

After the first click/keypress: occasional soft piano notes; wind swells while gliding and fades on landing; footstep ticks while running that speed up when sprinting. No clicks/pops; muting the tab works.

- [ ] **Step 4: Full playtest — the spec's manual checklist**

1. Reload fresh: loading bar fills, fades into the island; spawn on a beach.
2. Walk/sprint/jump across slopes — responsive, no jitter, stamina wheel behaves.
3. Climb a cliff and the tower: drain, climb-jump, exhaustion drop, ledge vault all work.
4. Glide from the tower top across the island; steer, watch wind streaks + FOV + wind audio.
5. Hold T through a full day/night: dawn, noon, dusk, stars, moonlight all transition smoothly.
6. Walk into deep ocean → fade + respawn on shore.
7. Repeat 2-4 entirely on a gamepad.
8. Performance: 60 fps gliding over dense grass with the tower in view (devtools performance tab, no long frames > 20 ms).

Fix anything that fails before the final commit. Tuning constants live where they're used (speeds in `Player.ts`, drains in each state, cycle length in `Sky.ts`).

- [ ] **Step 5: Final check — `npm run build`**

Run: `npm run build`
Expected: typecheck + production build succeed. Optionally `npx vite preview` to confirm the built bundle runs.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: synthesized ambient audio and final polish pass"
```

---

## Plan Self-Review Notes

- **Spec coverage:** traversal kit (Tasks 7-10), stamina+HUD (8), cel look + outlines (2, 11, 14), procedural island (3-4), water + respawn (13), day/night + stars (12), grass + wind streaks (10, 15), landmarks (14), props (14), gamepad (6), ambient audio (16), loading screen + error overlay (1, 5, 11), performance target + playtest checklist (15-16). Out-of-scope items from the spec are absent by design.
- **Known sign/feel ambiguities are flagged in feel-check steps** (move direction, climb lateral mirroring, soldier facing) — these depend on runtime behavior and are resolved at the keyboard, not in the plan.
- **Rapier API drift:** `timeOfImpact` vs `toi` noted in Task 5; trust TypeScript's suggestion.

