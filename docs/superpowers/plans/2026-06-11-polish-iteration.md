# Polish Iteration v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder character with a recolored KayKit Rogue (real jump clips + procedural climb/glide poses + visible paraglider), rewrite the music as composed synthesized piano with day/night ambience, diversify trees into 3 archetypes, and add a climbable cliff, campfire/fireflies, clouds, shore foam, dust, and birds.

**Architecture:** Spec at `docs/superpowers/specs/2026-06-11-polish-iteration-design.md`. All new systems follow the v1 patterns: toon materials via `src/core/toon.ts`, outline = BackSide shell, instancing for repeated geometry, pure logic extracted for vitest, browser verification per task. No new runtime dependencies (only `pngjs` as devDependency for a tools script).

**Tech Stack:** Vite + TS strict + Three.js 0.165 + @dimforge/rapier3d-compat + vitest. Node ≥ 20 for tools scripts.

**Conventions for implementers:**
- Run `npx vitest run` and `npx tsc --noEmit` before every commit; both must pass.
- All new meshes that should look toon use `toonMaterial(color)` from `src/core/toon.ts`.
- Numeric tuning values in this plan are validated starting points; the controller does a visual tuning pass in browser after each visual task. Do not "improve" them yourself.
- The dev server runs on port 5173; do not start a second one.

---

### Task 1: KayKit assets, clip manifest, recolored atlas

**Files:**
- Create: `tools/fetch-kaykit.mjs`, `tools/inspect-glb.mjs`, `tools/recolor-atlas.mjs`
- Create: `src/player/kaykit.ts`
- Create: `public/assets/` new character files (names recorded in manifest)
- Modify: `package.json` (devDependency `pngjs@^7`)

- [ ] **Step 1: Fetch the pack**

```js
// tools/fetch-kaykit.mjs
// Shallow-clones the CC0 KayKit Adventurers pack and copies the Rogue model
// (glTF/GLB + textures) into public/assets/.
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = 'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
const tmp = mkdtempSync(join(tmpdir(), 'kaykit-'));
execSync(`git clone --depth 1 ${REPO} "${tmp}"`, { stdio: 'inherit' });

/** Recursively find files whose lowercase name matches `pred`. */
function find(dir, pred, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) find(p, pred, out);
    else if (pred(name.toLowerCase())) out.push(p);
  }
  return out;
}

const models = find(tmp, (n) => n.includes('rogue') && (n.endsWith('.glb') || n.endsWith('.gltf')));
const textures = find(tmp, (n) => n.endsWith('.png') && (n.includes('atlas') || n.includes('texture') || n.includes('skin')));
console.log('Rogue models found:\n' + models.join('\n'));
console.log('Textures found:\n' + textures.slice(0, 20).join('\n'));
if (models.length === 0) throw new Error('No Rogue model found — list the repo tree and adjust the predicate.');

// Prefer .glb (self-contained). If only .gltf exists, copy it AND its sibling
// .bin/textures from the same directory so relative URIs keep working.
const glb = models.find((m) => m.endsWith('.glb'));
if (glb) {
  cpSync(glb, 'public/assets/character.glb');
  console.log('Copied', glb, '-> public/assets/character.glb');
} else {
  const gltf = models[0];
  const dir = dirname(gltf); // add `dirname` to the node:path import
  cpSync(dir, 'public/assets/kaykit', { recursive: true });
  console.log('Copied dir', dir, '-> public/assets/kaykit/ (entry: rename note in manifest)');
}
```

Run: `node tools/fetch-kaykit.mjs`
Expected: prints found model + texture paths, copies files. If the repo layout differs (it is a Godot addon layout under `addons/kaykit_character_pack_adventures/`), adjust the predicates — the goal is: Rogue model + its atlas texture end up under `public/assets/`.

**IMPORTANT:** v1's `public/assets/character.glb` (Soldier) gets overwritten or replaced. That is intended.

- [ ] **Step 2: Inspect clips and bones**

```js
// tools/inspect-glb.mjs — zero-dependency GLB/glTF inspector.
// Usage: node tools/inspect-glb.mjs public/assets/character.glb
import { readFileSync } from 'node:fs';

const path = process.argv[2];
const buf = readFileSync(path);
let json;
if (path.endsWith('.glb')) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a GLB');
  const jsonLen = buf.readUInt32LE(12); // first chunk header at byte 12
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('First chunk is not JSON');
  json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
} else {
  json = JSON.parse(buf.toString('utf8'));
}
console.log('== Animations ==');
for (const a of json.animations ?? []) console.log(' ', a.name);
console.log('== Skin joints (bones) ==');
const joints = json.skins?.[0]?.joints ?? [];
for (const j of joints) console.log(' ', json.nodes[j].name);
console.log('== Images ==');
for (const im of json.images ?? []) console.log(' ', im.uri ?? im.mimeType);
console.log('== Meshes ==');
for (const m of json.meshes ?? []) console.log(' ', m.name);
```

Run: `node tools/inspect-glb.mjs public/assets/character.glb` (or the .gltf path)
Expected: a list of animation clip names (≈75) and bone names. Paste the full output into the task report.

- [ ] **Step 3: Write the manifest from the inspect output**

`src/player/kaykit.ts` — hand-filled from real output, no guessing:

```ts
/**
 * Manifest for the KayKit Rogue asset. Filled by hand from
 * `node tools/inspect-glb.mjs` output — clip/bone names are VERBATIM.
 * If the asset changes, re-run the inspector and update here.
 */
export const MODEL_URL = '/assets/character.glb'; // or '/assets/kaykit/<entry>.gltf'
export const ATLAS_URL = '/assets/character-atlas.png';

/** Our animation needs -> verbatim KayKit clip names. */
export const CLIPS = {
  idle: '<FILL: e.g. Idle>',
  walk: '<FILL: e.g. Walking_A>',
  run: '<FILL: e.g. Running_A>',
  jumpStart: '<FILL: e.g. Jump_Start>',
  jumpAir: '<FILL: e.g. Jump_Idle>',
  jumpLand: '<FILL: e.g. Jump_Land>',
} as const;

/** Bones used by the procedural pose layer -> verbatim bone names. */
export const BONES = {
  spine: '<FILL>',
  head: '<FILL>',
  armL: '<FILL: upper arm left>',
  armR: '<FILL>',
  forearmL: '<FILL>',
  forearmR: '<FILL>',
  legL: '<FILL: upper leg / thigh left>',
  legR: '<FILL>',
} as const;
```

Selection rules when several candidates exist: prefer exact `Idle` over `Idle_B`; prefer `Running_A` over strafes; jump clips are usually `Jump_Start` / `Jump_Idle` / `Jump_Land` in KayKit packs. The `<FILL>` markers above are instructions to YOU, implementer — the committed file must contain only real names and compile under TS strict.

- [ ] **Step 4: Recolor the atlas**

`npm i -D pngjs`, then:

```js
// tools/recolor-atlas.mjs
// 1) `node tools/recolor-atlas.mjs --histogram <src.png>` prints the top 24 colors.
// 2) Fill REMAP below with the Rogue garment swatches you identified,
// 3) `node tools/recolor-atlas.mjs <src.png>` writes public/assets/character-atlas.png
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

// BoTW-champion palette targets:
const TUNIC_BLUE = [74, 127, 181];
const TUNIC_BLUE_DARK = [52, 92, 138];
const ACCENT_LIGHT = [139, 180, 216];

// FILL after running --histogram: source garment colors (the Rogue's dominant
// clothing hues, typically a green/brown family) with per-entry tolerance.
const REMAP = [
  // { from: [r,g,b], to: TUNIC_BLUE, tol: 30 },
];

const src = process.argv.includes('--histogram') ? process.argv[3] : process.argv[2];
const png = PNG.sync.read(readFileSync(src));

if (process.argv.includes('--histogram')) {
  const counts = new Map();
  for (let i = 0; i < png.data.length; i += 4) {
    const key = `${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  for (const [k, n] of top) console.log(k.padEnd(15), n);
  process.exit(0);
}

if (REMAP.length === 0) throw new Error('Fill REMAP first (run --histogram).');
const d2 = (a, p, i) => (a[0] - p[i]) ** 2 + (a[1] - p[i + 1]) ** 2 + (a[2] - p[i + 2]) ** 2;
let changed = 0;
for (let i = 0; i < png.data.length; i += 4) {
  for (const { from, to, tol } of REMAP) {
    if (d2(from, png.data, i) <= tol * tol) {
      // Preserve shading: scale target by source luminance ratio.
      const lum = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / (from[0] + from[1] + from[2]);
      png.data[i] = Math.min(255, to[0] * lum);
      png.data[i + 1] = Math.min(255, to[1] * lum);
      png.data[i + 2] = Math.min(255, to[2] * lum);
      changed++;
      break;
    }
  }
}
writeFileSync('public/assets/character-atlas.png', PNG.sync.write(png));
console.log(`Recolored ${changed} px -> public/assets/character-atlas.png`);
```

Run histogram, pick the garment swatches (KayKit gradient atlases hold a handful of large flat swatch regions — garments are the dominant saturated hues), fill REMAP, run, confirm `changed > 0`.

- [ ] **Step 5: Commit**

```bash
git add tools/ src/player/kaykit.ts public/assets/ package.json package-lock.json
git commit -m "feat: KayKit Rogue asset pipeline (fetch, inspect, manifest, champion-blue atlas)"
```

Report back: full clip list, full bone list, chosen CLIPS/BONES values, REMAP used.

---

### Task 2: CharacterAvatar v2

**Files:**
- Rewrite: `src/player/CharacterAvatar.ts`
- Modify: `src/main.ts` only if the public interface forces it (it should not)

Keep the v1 public interface EXACTLY: `CharacterAvatar.load(url, onProgress)` → instance with `.group: THREE.Group` and `.update(frameDt: number, player: Player): void`. `main.ts` keeps calling it the same way (avatar yaw handled in main.ts via `facing`; model nose must point −Z at yaw 0 — wrap the KayKit scene in an inner group rotated `Math.PI` if it faces +Z, see Step 3).

- [ ] **Step 1: Load + toon + scale + orientation**

Structure (complete the obvious imports; reuse v1 outline-shell code as reference — it is being replaced, read it first via git show HEAD:src/player/CharacterAvatar.ts if needed):

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getGradientMap } from '../core/toon';
import { MODEL_URL, ATLAS_URL, CLIPS, BONES } from './kaykit';
import { ProceduralPoses } from './ProceduralPoses';
import { Paraglider } from './Paraglider';
import type { Player } from './Player';

export class CharacterAvatar {
  readonly group = new THREE.Group();      // outer: main.ts positions/rotates this
  private inner = new THREE.Group();       // orientation fix lives here
  private mixer!: THREE.AnimationMixer;
  private actions!: Record<keyof typeof CLIPS, THREE.AnimationAction>;
  private poses!: ProceduralPoses;
  readonly paraglider = new Paraglider();
  // jump bookkeeping
  private prevState = 'grounded';
  private landTimer = 0;

  static async load(_url: string, onProgress?: (f: number) => void): Promise<CharacterAvatar> {
    const avatar = new CharacterAvatar();
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL, (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    });
    const atlas = await new THREE.TextureLoader().loadAsync(ATLAS_URL);
    atlas.flipY = false;                       // glTF UV convention
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.magFilter = THREE.NearestFilter;     // crisp flat swatches
    avatar.setup(gltf, atlas);
    return avatar;
  }
  // ...
}
```

`setup(gltf, atlas)`:
1. `this.inner.add(gltf.scene)`; `this.group.add(this.inner)`; `this.group.add(this.paraglider.group)`.
2. Traverse: for every `SkinnedMesh`/`Mesh` with material → replace with `new THREE.MeshToonMaterial({ map: atlas, gradientMap: getGradientMap() })`, `castShadow = true`. Keep a list of skinned meshes.
3. Outline shells: for each SkinnedMesh, clone it (`mesh.clone()` shares skeleton+geometry), give it `new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.BackSide })`, no shadows, add as sibling, and scale the shell `1.02` (this is the v1 technique — same look).
4. Scale: compute `new THREE.Box3().setFromObject(gltf.scene)` height; `inner.scale.setScalar(1.8 / height)` so the model is ≈ capsule height.
5. Orientation: KayKit models face +Z; set `inner.rotation.y = Math.PI` so the nose points −Z (KEEP main.ts's `atan2(-facing.x, -facing.z)` working). Verify in browser; remove the rotation if the model already faces −Z.
6. Mixer + actions: `this.mixer = new THREE.AnimationMixer(gltf.scene)`; for each key of CLIPS, `THREE.AnimationClip.findByName(gltf.animations, name)` → action. `jumpStart`/`jumpLand`: `setLoop(THREE.LoopOnce)`, `clampWhenFinished = true`. Throw at load if any clip is missing (fail fast, names come from the manifest).
7. `this.poses = new ProceduralPoses(gltf.scene, BONES)` (Task 3 — until then, stub the two lines marked POSES below with nothing; this task depends on Task 3's file existing, so implement Task 3 FIRST if you were dispatched with both, otherwise create a minimal `ProceduralPoses` class with empty `update`).

- [ ] **Step 2: update(frameDt, player) — state machine**

```ts
update(dt: number, player: Player): void {
  const s = player.state;
  // --- jump one-shots ---
  if (this.prevState === 'grounded' && s === 'airborne' && player.velocityY > 2) {
    this.playOnce(this.actions.jumpStart, 0.06);
  }
  if (this.prevState !== 'grounded' && s === 'grounded') {
    this.playOnce(this.actions.jumpLand, 0.08);
    this.landTimer = 0.25;
  }
  this.landTimer = Math.max(0, this.landTimer - dt);
  this.prevState = s;

  // --- target loop weights ---
  const speed = player.speed;
  const w = { idle: 0, walk: 0, run: 0, jumpAir: 0 };
  if (s === 'grounded') {
    if (this.landTimer > 0 && speed < 1) { /* let jumpLand play */ }
    else if (speed < 0.3) w.idle = 1;
    else if (speed < 6) { w.walk = 1; this.actions.walk.timeScale = Math.max(0.6, speed / 5.5); }
    else { w.run = 1; this.actions.run.timeScale = speed / 9; }
  } else {
    w.jumpAir = 1; // base for airborne AND climb AND glide (pose layer goes on top)
    if (s === 'climbing') w.jumpAir = 0.25;
  }
  for (const k of ['idle', 'walk', 'run', 'jumpAir'] as const) {
    this.fadeTo(this.actions[k], w[k], 0.18);
  }

  this.mixer.update(dt);
  this.poses.update(dt, player);                       // POSES (Task 3)
  this.paraglider.update(dt, s === 'gliding');         // Task 4
  // glide lean (kept from v1): inner pitches forward while gliding
  const targetLean = s === 'gliding' ? 0.55 : 0;
  this.inner.rotation.x += (targetLean - this.inner.rotation.x) * Math.min(1, dt * 8);
}
```

Helpers: `fadeTo(action, weight, tau)` — ensure `action.play()` is running, move `action.weight` toward target by `dt/tau` style damping (`action.weight += (w - action.weight) * Math.min(1, dt / tau)`); `playOnce(action, fade)` — `action.reset().fadeIn(fade).play()`, with weight 1.

- [ ] **Step 3: Type-check, run, verify in browser**

`npx tsc --noEmit` clean. Controller verifies visually: idle/walk/run blend, real jump start/air/land, orientation, scale vs capsule, recolored tunic, outlines. Loading bar still fills (progress callback).

- [ ] **Step 4: Commit**

```bash
git add src/player/CharacterAvatar.ts src/main.ts
git commit -m "feat: KayKit Rogue avatar with real jump animation cycle"
```

---

### Task 3: ProceduralPoses (climb + glide bone layer)

**Files:**
- Create: `src/player/ProceduralPoses.ts`
- Test: `src/player/ProceduralPoses.test.ts`

- [ ] **Step 1: Failing tests for the pure math**

```ts
import { describe, expect, it } from 'vitest';
import { advanceClimbPhase, approachWeight, climbTargets, glideTargets } from './ProceduralPoses';

describe('approachWeight', () => {
  it('rises toward 1 in ~0.15s when active', () => {
    let w = 0;
    for (let i = 0; i < 9; i++) w = approachWeight(w, true, 1 / 60);
    expect(w).toBeGreaterThan(0.9);
  });
  it('falls toward 0 when inactive', () => {
    let w = 1;
    for (let i = 0; i < 9; i++) w = approachWeight(w, false, 1 / 60);
    expect(w).toBeLessThan(0.1);
  });
});

describe('advanceClimbPhase', () => {
  it('is frozen when speed is 0', () => {
    expect(advanceClimbPhase(1.2, 0, 0.016)).toBe(1.2);
  });
  it('advances proportionally to climbed distance', () => {
    const a = advanceClimbPhase(0, 2.2, 0.5);
    expect(a).toBeCloseTo(2.2 * 0.5 * 2.4, 5);
  });
});

describe('pose targets', () => {
  it('climb alternates limbs: half a cycle apart, arms mirror', () => {
    const p0 = climbTargets(0);
    const pHalf = climbTargets(Math.PI);
    expect(p0.armL.x).toBeCloseTo(pHalf.armR.x, 5);
    expect(p0.legR.x).toBeCloseTo(pHalf.legL.x, 5);
  });
  it('glide raises both arms symmetrically', () => {
    const g = glideTargets(0);
    expect(g.armL.x).toBeLessThan(-1.5);
    expect(g.armL.x).toBeCloseTo(g.armR.x, 5);
    expect(g.armL.z).toBeCloseTo(-g.armR.z, 5);
  });
});
```

Run: `npx vitest run src/player/ProceduralPoses.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement**

```ts
import * as THREE from 'three';
import type { Player } from './Player';

/** dt-based exponential approach toward 1 (active) or 0, ~0.15s ramp. */
export function approachWeight(w: number, active: boolean, dt: number): number {
  const target = active ? 1 : 0;
  return w + (target - w) * Math.min(1, dt * 18);
}
```

(At 60 fps this reaches > 0.96 after 9 frames — satisfies the test contract.)

```ts
export function advanceClimbPhase(phase: number, speed: number, dt: number): number {
  return phase + speed * dt * 2.4; // 2.2 m/s climb ≈ 0.84 cycles/s
}

export interface PoseTargets { [bone: string]: THREE.Euler }

/** 4-beat climb cycle. Angles in radians, X = forward pitch of the limb. */
export function climbTargets(phase: number): PoseTargets {
  const s = Math.sin(phase);
  return {
    spine: new THREE.Euler(0.35, 0, 0),
    head: new THREE.Euler(-0.45, 0, 0),
    armL: new THREE.Euler(-2.2 - s * 0.5, 0, -0.25),
    armR: new THREE.Euler(-2.2 + s * 0.5, 0, 0.25),
    forearmL: new THREE.Euler(-0.4 - s * 0.2, 0, 0),
    forearmR: new THREE.Euler(-0.4 + s * 0.2, 0, 0),
    legL: new THREE.Euler(-0.9 + s * 0.45, 0, 0.15),
    legR: new THREE.Euler(-0.9 - s * 0.45, 0, -0.15),
  };
}

/** Arms up gripping paraglider handles, legs dangling with sway. */
export function glideTargets(t: number): PoseTargets {
  const sway = Math.sin(t * 2.0) * 0.08;
  return {
    spine: new THREE.Euler(0.1, 0, 0),
    armL: new THREE.Euler(-2.7, 0, -0.35),
    armR: new THREE.Euler(-2.7, 0, 0.35),
    forearmL: new THREE.Euler(-0.5, 0, 0),
    forearmR: new THREE.Euler(-0.5, 0, 0),
    legL: new THREE.Euler(0.3 + sway, 0, 0.06),
    legR: new THREE.Euler(0.3 - sway, 0, -0.06),
  };
}
```

Runtime class:

```ts
export class ProceduralPoses {
  private bones = new Map<string, THREE.Bone>();
  private climbW = 0; private glideW = 0; private phase = 0; private t = 0;
  private q = new THREE.Quaternion();

  constructor(root: THREE.Object3D, boneNames: Record<string, string>) {
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        for (const [key, name] of Object.entries(boneNames)) {
          if (o.name === name) this.bones.set(key, o as THREE.Bone);
        }
      }
    });
  }

  /** Call AFTER mixer.update(dt). Slerps bones toward pose targets by weight. */
  update(dt: number, player: Player): void {
    this.t += dt;
    this.climbW = approachWeight(this.climbW, player.state === 'climbing', dt);
    this.glideW = approachWeight(this.glideW, player.state === 'gliding', dt);
    if (player.state === 'climbing') this.phase = advanceClimbPhase(this.phase, player.speed, dt);
    if (this.climbW > 0.001) this.apply(climbTargets(this.phase), this.climbW);
    if (this.glideW > 0.001) this.apply(glideTargets(this.t), this.glideW);
  }

  private apply(targets: PoseTargets, w: number): void {
    for (const [key, euler] of Object.entries(targets)) {
      const bone = this.bones.get(key);
      if (!bone) continue;
      this.q.setFromEuler(euler);
      bone.quaternion.slerp(this.q, w);
    }
  }
}
```

- [ ] **Step 3: Tests pass** — `npx vitest run` all green; `npx tsc --noEmit` clean.
- [ ] **Step 4: Commit** — `git commit -m "feat: procedural climb/glide bone pose layer"` (add both files).

**Known tuning:** angle signs depend on the KayKit rig's bone axes; the controller fixes signs/axes in a browser pass after Task 4 — implementers do not need pixel-perfect poses, only the structure + passing tests.

---

### Task 4: Paraglider prop

**Files:**
- Create: `src/player/Paraglider.ts`
- Modify: `src/player/CharacterAvatar.ts` already references it (Task 2)

- [ ] **Step 1: Implement**

```ts
import * as THREE from 'three';
import { toonMaterial } from '../core/toon';

/** BoTW-style paraglider built from primitives. Deploys/folds with scaling. */
export class Paraglider {
  readonly group = new THREE.Group();
  private deploy = 0; // 0 folded → 1 deployed

  constructor() {
    // Canopy: half-sphere segment squashed into a wing.
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.32),
      toonMaterial(0xc8e8f5),
    );
    canopy.scale.set(1.25, 0.55, 0.85);
    // Rim band: darker ring under the canopy edge.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.05, 6, 20), toonMaterial(0x8a5a32));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.12;
    rim.scale.set(1.25, 0.85, 1);
    // Frame: two crossed wooden bars + two handles.
    const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.1, 6);
    const wood = toonMaterial(0x6e4a26);
    const barX = new THREE.Mesh(barGeo, wood); barX.rotation.z = Math.PI / 2; barX.position.y = 0.1;
    const barZ = new THREE.Mesh(barGeo, wood); barZ.rotation.x = Math.PI / 2; barZ.position.y = 0.1;
    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6);
    const hL = new THREE.Mesh(handleGeo, wood); hL.position.set(-0.3, -0.18, 0);
    const hR = new THREE.Mesh(handleGeo, wood); hR.position.set(0.3, -0.18, 0);
    this.group.add(canopy, rim, barX, barZ, hL, hR);
    // Outline shell for the canopy only (cheap): clone, BackSide dark.
    const shell = canopy.clone();
    shell.material = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.BackSide });
    shell.scale.multiplyScalar(1.04);
    this.group.add(shell);
    // Anchor above the avatar's head (group is added to avatar.group by Task 2).
    this.group.position.set(0, 2.15, 0.05);
    this.group.visible = false;
  }

  update(dt: number, gliding: boolean): void {
    const target = gliding ? 1 : 0;
    const speed = gliding ? dt / 0.2 : dt / 0.15;
    this.deploy = Math.max(0, Math.min(1, this.deploy + (target === 1 ? speed : -speed)));
    this.group.visible = this.deploy > 0.01;
    const e = 1 - Math.pow(1 - this.deploy, 3); // easeOutCubic
    this.group.scale.set(0.15 + 0.85 * e, 0.15 + 0.85 * e, 0.15 + 0.85 * e);
  }
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; controller browser pass: glider appears over the head when gliding, unfolds, folds on exit, outline visible, doesn't clip the camera.
- [ ] **Step 3: Commit** — `git commit -m "feat: deployable toon paraglider prop"`.

---

### Task 5: Music v2 + day/night ambience + terrain sounds

**Files:**
- Create: `src/audio/Music.ts`, `src/audio/Ambience.ts`
- Test: `src/audio/Music.test.ts`, `src/audio/Ambience.test.ts`
- Modify: `src/audio/AudioManager.ts`, `src/main.ts` (update call signature)

- [ ] **Step 1: Failing tests (pure logic only — no AudioContext in tests)**

```ts
// src/audio/Music.test.ts
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
```

```ts
// src/audio/Ambience.test.ts
import { describe, expect, it } from 'vitest';
import { dayWeight } from './Ambience';

describe('dayWeight', () => {
  it('full day at noon-ish, zero at midnight-ish', () => {
    expect(dayWeight(0.5)).toBeCloseTo(1, 1);
    expect(dayWeight(0.0)).toBeCloseTo(0, 1);
    expect(dayWeight(0.99)).toBeCloseTo(0, 1);
  });
  it('transitions smoothly around dawn/dusk', () => {
    expect(dayWeight(0.27)).toBeGreaterThan(0);
    expect(dayWeight(0.27)).toBeLessThan(1);
  });
});
```

**IMPORTANT:** before writing `dayWeight`, READ `src/world/Sky.ts` to confirm what `time01` means (which values are day vs night in the palette code) and align the constants; adjust the test values to the real convention, then keep them.

Run: `npx vitest run src/audio` — Expected: FAIL.

- [ ] **Step 2: Implement Music.ts**

```ts
export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** [midi, timeSec, velocity 0..1] */
export type Motif = ReadonlyArray<readonly [number, number, number]>;

export const DAY_MOTIFS: Motif[] = [
  [[76, 0, 0.55], [79, 0.75, 0.4], [81, 1.5, 0.45], [76, 3, 0.35], [74, 4.5, 0.5], [72, 6, 0.4]],
  [[72, 0, 0.5], [76, 1, 0.4], [79, 2, 0.45], [84, 3.5, 0.55], [81, 5, 0.35], [79, 6.5, 0.3]],
  [[67, 0, 0.45], [72, 0.75, 0.5], [74, 2, 0.35], [76, 2.75, 0.5], [72, 4.5, 0.4]],
];
export const NIGHT_MOTIFS: Motif[] = [
  [[57, 0, 0.45], [60, 1.5, 0.35], [64, 3, 0.4], [62, 5, 0.3]],
  [[55, 0, 0.4], [62, 2, 0.45], [60, 4, 0.3], [57, 6, 0.35]],
  [[64, 0, 0.35], [60, 1, 0.3], [57, 2.5, 0.4], [52, 5, 0.45]],
];

export class MotifScheduler {
  nextAt = 0;
  private last: Motif | null = null;
  constructor(private rng: () => number = Math.random) {}
  /** Returns a motif to start now, or null. Call with current music-time (s). */
  next(t: number, isDay: boolean): Motif | null {
    if (t < this.nextAt) return null;
    const set = isDay ? DAY_MOTIFS : NIGHT_MOTIFS;
    let pick = set[Math.floor(this.rng() * set.length)];
    if (pick === this.last) pick = set[(set.indexOf(pick) + 1) % set.length];
    this.last = pick;
    this.nextAt = t + 20 + this.rng() * 25;
    return pick;
  }
}

/** Piano-ish voice + generated-IR reverb. Constructed lazily after user gesture. */
export class Music {
  private convolver: ConvolverNode;
  private out: GainNode;
  private scheduler = new MotifScheduler();
  private t = 0;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.5;
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = Music.impulseResponse(ctx, 2.5);
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    const dry = ctx.createGain(); dry.gain.value = 0.8;
    this.out.connect(dry); dry.connect(dest);
    this.out.connect(this.convolver); this.convolver.connect(wet); wet.connect(dest);
  }

  static impulseResponse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-3 * (i / len) * seconds);
    }
    return buf;
  }

  /** One piano-like note: detuned sine partials with per-partial decay. */
  note(midi: number, vel: number, when: number): void {
    const f0 = midiToHz(midi);
    const partials = [1, 2.003, 3.01, 4.2];
    const gains = [1, 0.45, 0.22, 0.08];
    for (let i = 0; i < partials.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f0 * partials[i];
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vel * gains[i] * 0.16, when + 0.008);
      g.gain.setTargetAtTime(0, when + 0.01, 1.1 / (i + 1));
      osc.connect(g); g.connect(this.out);
      osc.start(when); osc.stop(when + 4);
    }
  }

  update(dt: number, isDay: boolean): void {
    this.t += dt;
    const motif = this.scheduler.next(this.t, isDay);
    if (motif) {
      const base = this.ctx.currentTime + 0.05;
      for (const [m, t, v] of motif) {
        this.note(m, v, base + t + (Math.random() - 0.5) * 0.06); // ±30ms humanize
      }
    }
  }
}
```

- [ ] **Step 3: Implement Ambience.ts**

```ts
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 1 in full day, 0 at night. CONFIRM band edges against Sky.ts's palette code. */
export function dayWeight(time01: number): number {
  return smooth(0.22, 0.32, time01) * (1 - smooth(0.68, 0.78, time01));
}

export class Ambience {
  private cricketGain: GainNode;
  private birdTimer = 3;
  constructor(private ctx: AudioContext, private dest: AudioNode) {
    // Cricket bed: 4.2kHz sine, tremolo via LFO -> gain, mastered by night weight.
    const osc = ctx.createOscillator(); osc.frequency.value = 4200; osc.type = 'sine';
    const trem = ctx.createGain(); trem.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 26;
    const lfoAmp = ctx.createGain(); lfoAmp.gain.value = 0.5;
    lfo.connect(lfoAmp); lfoAmp.connect(trem.gain);
    this.cricketGain = ctx.createGain(); this.cricketGain.gain.value = 0;
    osc.connect(trem); trem.connect(this.cricketGain); this.cricketGain.connect(dest);
    osc.start(); lfo.start();
  }

  private chirp(): void {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(2800, t);
    osc.frequency.linearRampToValueAtTime(3400, t + 0.07);
    osc.frequency.linearRampToValueAtTime(2500, t + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.02);
    g.gain.setTargetAtTime(0, t + 0.1, 0.05);
    const pan = this.ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
    osc.connect(g); g.connect(pan); pan.connect(this.dest);
    osc.start(t); osc.stop(t + 0.4);
  }

  update(dt: number, time01: number): void {
    const day = dayWeight(time01);
    this.cricketGain.gain.setTargetAtTime((1 - day) * 0.028, this.ctx.currentTime, 0.8);
    this.birdTimer -= dt;
    if (this.birdTimer <= 0 && day > 0.4 && Math.random() < day) {
      this.chirp();
      if (Math.random() < 0.5) setTimeout(() => this.chirp(), 140); // double chirp
      this.birdTimer = 2 + Math.random() * 7;
    } else if (this.birdTimer <= 0) {
      this.birdTimer = 1.5;
    }
  }
}
```

- [ ] **Step 4: Rework AudioManager**

Read the current `src/audio/AudioManager.ts` first. Changes:
1. DELETE the random pentatonic ambient (notes array, its timer, its trigger).
2. In `init()`: construct `this.music = new Music(ctx, masterGain)` and `this.ambience = new Ambience(ctx, masterGain)`.
3. Add terrain loops (created in `init()`, gains start 0):
   - grass rustle: looping noise `BufferSource` → bandpass 1100 Hz Q 0.8 → gain.
   - waves: looping noise → bandpass 380 Hz Q 0.6 → gain; ALSO modulate with a 0.08 Hz LFO: `lfo.connect(lfoAmp); lfoAmp.connect(waveGain.gain)` with `lfoAmp.gain.value = 0.012`, base gain set via setTargetAtTime.
4. New signature: `update(dt, state, speed, time01, terrainH)` where `terrainH` = terrain height under the player. Per tick:
   - `music.update(dt, dayWeight(time01) > 0.5)`; `ambience.update(dt, time01)`.
   - grass gain target: `state === 'grounded' && terrainH > 2.5 && terrainH < 45 ? Math.min(0.05, speed * 0.006) : 0`, τ 0.3.
   - wave gain target: `terrainH < 3 ? 0.05 * (1 - Math.max(0, terrainH) / 3) : 0`, τ 0.6.
   - footstep bandpass center per step: `terrainH < 2.5 ? 360 : 700` (sand vs grass), else keep v1 default for higher ground.
5. `src/main.ts`: the audio call becomes `audio.update(dt, player.state, player.speed, sky.time01, groundBelow)` — `groundBelow` is already computed in the loop; move its declaration above the audio call if needed (it is — it's computed before `physics.step()`; reuse the same variable).

- [ ] **Step 5: Tests green, type-check, commit**

`npx vitest run` + `npx tsc --noEmit`.

```bash
git add src/audio/ src/main.ts
git commit -m "feat: composed piano music, day/night ambience, terrain-aware sound"
```

---

### Task 6: Tree archetypes + per-instance variation

**Files:**
- Rewrite: `src/world/Props.ts` (trees part; keep rocks exactly as-is)
- Test: `src/world/Props.test.ts`

- [ ] **Step 1: Failing tests for distribution logic**

```ts
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
});
```

Run: FAIL (export missing).

- [ ] **Step 2: Implement**

In `Props.ts`:

```ts
export type TreeArchetype = 'palm' | 'broadleaf' | 'conifer';

export function pickArchetype(h: number, rng: () => number): TreeArchetype {
  if (h >= 0.5 && h < 3) return rng() < 0.85 ? 'palm' : 'broadleaf';
  if (h >= 22) return rng() < 0.75 ? 'conifer' : 'broadleaf';
  return rng() < 0.8 ? 'broadleaf' : 'conifer';
}
```

Geometry builders (use `mergeGeometries` from `three/examples/jsm/utils/BufferGeometryUtils.js`; each archetype = ONE merged trunk geometry + ONE merged canopy geometry → 2 InstancedMesh per archetype, 6 draw calls total):

- *broadleaf*: trunk `CylinderGeometry(0.22, 0.38, 2.6, 6)`; canopy = 3 `IcosahedronGeometry(r, 1)` blobs merged at offsets — r/positions: `(1.5 @ 0, 3.6, 0)`, `(1.1 @ 0.9, 3.0, 0.3)`, `(1.0 @ -0.8, 3.1, -0.2)`.
- *conifer*: trunk `CylinderGeometry(0.18, 0.3, 1.8, 6)`; canopy = 3 cones merged: `ConeGeometry(1.7, 2.2, 7) @ y=2.5`, `ConeGeometry(1.3, 2.0, 7) @ y=3.9`, `ConeGeometry(0.9, 1.8, 7) @ y=5.2`.
- *palm*: trunk = 3 stacked `CylinderGeometry(0.14, 0.18, 1.2, 6)` merged with progressive x-offset (0, 0.18, 0.42) and slight z-rotation (0, 0.1, 0.2) — a curved lean; canopy = 6 fronds, each `PlaneGeometry(0.5, 1.8)` rotated to droop (rotation.x ≈ -0.9 + i*0.05) and fanned around Y (i * Math.PI/3), positioned at trunk top (≈ y 3.3, with the trunk's total lean x-offset ≈ 0.6); material DoubleSide.

Per-instance setup (single pass over 600 positions, seeded `mulberry32(7)` AS BEFORE so placement stays deterministic — draw the SAME number of rng() calls per accepted position regardless of archetype, i.e. always draw: x, z, scale, rotY, tiltX, tiltZ, hue, light, archetypeRoll → 9 calls):
- placement filter unchanged: h 3–45 & normal.y ≥ 0.8 — EXCEPT palms: also allow h 0.5–3 (add a second scatter loop of 80 attempts over the beach band with the same rng stream, after the main loop).
- scale `0.7 + rng()*0.7`; tilt `(rng()-0.5)*0.14` on X and Z; rotY `rng()*Math.PI*2`.
- `instanceColor`: materials use `color: 0xffffff`; canopy base colors — broadleaf `#3e8e4f`, conifer `#2f6e46`, palm `#4a9a55`; trunk base — broadleaf `#7a5230`, conifer `#6a4a2e`, palm `#8a6a40`. Jitter: convert base to HSL, `h += (rng()-0.5)*0.06`, `l += (rng()-0.5)*0.16`, set via `setColorAt(i, c)`.
- colliders: same cylinder colliders as v1, radius scaled by instance scale; palms use radius 0.25, height 3.6.

Count: keep total ≈ 600 + 80 beach palms. After filling, set `count` per InstancedMesh to actual instances and call `instanceMatrix.needsUpdate = true` and `instanceColor!.needsUpdate = true`.

- [ ] **Step 3: Tests green + visual check + commit**

`npx vitest run`, `npx tsc --noEmit`. Controller: screenshot forest mid-island (3 silhouettes visible, hue variation), beach (palms), high ground (conifers); fps unchanged.

```bash
git add src/world/Props.ts src/world/Props.test.ts
git commit -m "feat: three tree archetypes with per-instance color/scale/tilt variation"
```

---

### Task 7: Climbable cliff

**Files:**
- Modify: `src/world/terrain/heightmap.ts`
- Test: `src/world/terrain/cliff.test.ts`

- [ ] **Step 1: READ the existing heightmap code.** Find the function that computes height from (x, z) (noise stack). The cliff is an additive term applied inside it, before `heightAt` consumers see it (mesh, physics, spawn, props all flow from the same function — that is the point).

- [ ] **Step 2: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { cliffBoost, CLIFF } from './heightmap';

describe('cliffBoost', () => {
  it('is zero far outside the sector', () => {
    expect(cliffBoost(480, 0)).toBe(0);     // wrong angle
    expect(cliffBoost(-10, -10)).toBe(0);   // r too small
  });
  it('reaches full height on the plateau side at sector center', () => {
    const a = CLIFF.theta;
    const r = CLIFF.r0 - 10;
    expect(cliffBoost(Math.cos(a) * r, Math.sin(a) * r)).toBeCloseTo(CLIFF.height, 1);
  });
  it('creates a steep face: drops ≥60° between r0 and r1 at sector center', () => {
    const a = CLIFF.theta;
    const run = CLIFF.r1 - CLIFF.r0;
    const drop = cliffBoost(Math.cos(a) * CLIFF.r0, Math.sin(a) * CLIFF.r0)
               - cliffBoost(Math.cos(a) * CLIFF.r1, Math.sin(a) * CLIFF.r1);
    expect(drop / run).toBeGreaterThan(Math.tan(Math.PI / 3)); // > tan 60°
  });
  it('is continuous (no step bigger than 1.5m over 0.5m) along a radial line', () => {
    const a = CLIFF.theta;
    let prev = cliffBoost(Math.cos(a) * 150, Math.sin(a) * 150);
    for (let r = 150.5; r < 300; r += 0.5) {
      const v = cliffBoost(Math.cos(a) * r, Math.sin(a) * r);
      expect(Math.abs(v - prev)).toBeLessThan(1.5);
      prev = v;
    }
  });
});
```

Run: FAIL.

- [ ] **Step 3: Implement**

In `heightmap.ts`:

```ts
const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Cliff sector parameters. theta is the sector's central angle (radians). */
export const CLIFF = {
  theta: -2.2,      // southwest sector — far from tower (~0.15) and ruins (~0 / ~2.15)
  halfAngle: 0.38,
  r0: 230,          // plateau edge (full height inside r0)
  r1: 241,          // foot of the wall (zero boost outside r1) → 20m over 11m ≈ 61°
  height: 20,
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
  // fade the plateau back down toward the island interior so it blends in
  const inner = smoothstep(150, 195, r);
  return CLIFF.height * ang * radial * inner;
}
```

Add `+ cliffBoost(x, z)` to the existing height computation (the single source-of-truth height function). Do NOT touch normals code — finite differences pick the cliff up automatically.

- [ ] **Step 4: Full test suite + invariants check**

`npx vitest run` — the v1 terrain tests must still pass (if any assert exact heights in the cliff sector, examine: the sector was chosen to avoid landmarks; report if a v1 test conflicts rather than changing it silently).

Write a throwaway check (run with `npx tsx` or a temp vitest) printing: tower position, both ruin positions, spawn point — using the same calls as `main.ts`/`Landmarks.ts`. Requirement: tower stays at its v1 spot (255.1, 38.6) and ruins stay at (100, 0) / (−72, 110). If the tower moved (plateau too high), reduce `CLIFF.height` to 16 and/or shift `r0/r1` outward by 10 and re-run until stable, keeping the face ≥ 60°.

- [ ] **Step 5: Commit**

```bash
git add src/world/terrain/heightmap.ts src/world/terrain/cliff.test.ts
git commit -m "feat: carved climbable cliff sector with summit plateau"
```

Controller then verifies in browser: walk to the wall (sector −2.2 rad ≈ southwest), climb engages on it, vault onto plateau works, grass/trees absent from the face, fps stable.

---

### Task 8: Campfire + fireflies (night life at ruins)

**Files:**
- Create: `src/world/Campfire.ts`, `src/fx/Fireflies.ts`
- Modify: `src/world/Landmarks.ts` (export ruin positions), `src/main.ts` (wire + update)

- [ ] **Step 1: Expose ruin positions.** `buildLandmarks` currently places ruins internally; change its return type to `{ ruins: THREE.Vector3[] }` (world positions at ground height) and return them. Update `main.ts` call site.

- [ ] **Step 2: Campfire**

```ts
import * as THREE from 'three';
import { toonMaterial } from '../core/toon';

export class Campfire {
  readonly group = new THREE.Group();
  private light: THREE.PointLight;
  private flames: THREE.Mesh[] = [];
  private t = 0;

  constructor(pos: THREE.Vector3) {
    this.group.position.copy(pos);
    const wood = toonMaterial(0x5a3a20);
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 5), wood);
      log.rotation.z = Math.PI / 2 - 0.35;
      log.rotation.y = (i / 5) * Math.PI * 2;
      log.position.y = 0.12;
      this.group.add(log);
    }
    const stoneMat = toonMaterial(0x8d8d93);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), stoneMat);
      stone.position.set(Math.cos(a) * 0.65, 0.07, Math.sin(a) * 0.65);
      this.group.add(stone);
    }
    // Two crossed flame cones, additive, no lighting.
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff8c2e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let i = 0; i < 2; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.85, 6), flameMat);
      flame.position.y = 0.55;
      flame.rotation.y = i * Math.PI / 2;
      this.flames.push(flame);
      this.group.add(flame);
    }
    this.light = new THREE.PointLight(0xff9a3c, 0, 12, 2);
    this.light.position.y = 0.8;
    this.group.add(this.light);
  }

  /** nightW: 0 day → 1 night (from Ambience.dayWeight complement). */
  update(dt: number, nightW: number): void {
    this.t += dt;
    const flick = 1 + Math.sin(this.t * 11) * 0.12 + Math.sin(this.t * 23.7) * 0.08;
    this.light.intensity = nightW * 14 * flick;
    for (const [i, f] of this.flames.entries()) {
      f.visible = nightW > 0.05;
      f.scale.y = (0.85 + Math.sin(this.t * 9 + i * 1.7) * 0.18) * (0.5 + nightW * 0.5);
      (f.material as THREE.MeshBasicMaterial).opacity = 0.9 * nightW;
    }
  }
}
```

- [ ] **Step 3: Fireflies**

```ts
import * as THREE from 'three';

export class Fireflies {
  readonly points: THREE.Points;
  private base: Float32Array;
  private t = 0;
  private mat: THREE.PointsMaterial;

  constructor(centers: THREE.Vector3[], perSite = 20) {
    const n = centers.length * perSite;
    this.base = new Float32Array(n * 3);
    let k = 0;
    for (const c of centers) {
      for (let i = 0; i < perSite; i++) {
        this.base[k++] = c.x + (Math.random() - 0.5) * 24;
        this.base[k++] = c.y + 0.5 + Math.random() * 2.5;
        this.base[k++] = c.z + (Math.random() - 0.5) * 24;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.base.slice(), 3));
    this.mat = new THREE.PointsMaterial({
      color: 0xd8f06a, size: 0.18, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  update(dt: number, nightW: number): void {
    this.t += dt;
    this.mat.opacity = nightW * 0.85;
    this.points.visible = nightW > 0.02;
    if (!this.points.visible) return;
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const j = i * 3, p = this.t * 0.7 + i * 2.39996;
      pos.array[j] = this.base[j] + Math.sin(p) * 1.6 + Math.sin(p * 0.37) * 1.1;
      pos.array[j + 1] = this.base[j + 1] + Math.sin(p * 0.9 + 1) * 0.7;
      pos.array[j + 2] = this.base[j + 2] + Math.cos(p * 0.8) * 1.6;
    }
    pos.needsUpdate = true;
  }
}
```

- [ ] **Step 4: Wire in main.ts.** Import `dayWeight` from `src/audio/Ambience.ts`; `const nightW = 1 - dayWeight(sky.time01)` once per tick (compute after `sky.update`); construct `Campfire` at `ruins[0]` and `Fireflies(ruins)`, add to scene, update both each tick. Add to `__debug`.

- [ ] **Step 5: Verify + commit.** `npx tsc --noEmit`; controller checks night screenshot (KeyT to advance time): flames + warm light + fireflies at ruins, all gone by day.

```bash
git add src/world/Campfire.ts src/fx/Fireflies.ts src/world/Landmarks.ts src/main.ts
git commit -m "feat: night campfire and fireflies at the ruins"
```

---

### Task 9: Drifting clouds + shore foam

**Files:**
- Create: `src/world/Clouds.ts`, `src/world/ShoreFoam.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Clouds**

```ts
import * as THREE from 'three';

export class Clouds {
  readonly group = new THREE.Group();
  private speeds: number[] = [];

  constructor(count = 10, seed = 11) {
    let s = seed; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const blobs = 3 + Math.floor(rng() * 3);
      for (let b = 0; b < blobs; b++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + rng() * 7, 1), mat);
        m.position.set((b - blobs / 2) * 8 + rng() * 4, rng() * 2, (rng() - 0.5) * 7);
        m.scale.y = 0.45;
        cloud.add(m);
      }
      cloud.position.set((rng() - 0.5) * 1400, 130 + rng() * 50, (rng() - 0.5) * 1400);
      this.group.add(cloud);
      this.speeds.push(1.2 + rng() * 1.6);
    }
  }

  update(dt: number): void {
    for (const [i, c] of this.group.children.entries()) {
      c.position.x += this.speeds[i] * dt;
      if (c.position.x > 750) c.position.x = -750;
    }
  }
}
```

Note: use `toonMaterial(0xffffff, { transparent: true, opacity: 0.92 })` from `core/toon` instead of raw MeshToonMaterial (gradient map consistency). Clouds need `castShadow = false` (default) — do NOT enable shadows on them.

- [ ] **Step 2: Shore foam.** Scan the heightmap on a grid (step 4 m over ±520 m): cells where `terrain.heightAt` crosses the waterline (`h(x,z) > -0.4 && h < 0.25`) get a foam quad. Build ONE InstancedMesh of `PlaneGeometry(3.2, 3.2)` rotated flat (rotation.x = −π/2), `MeshBasicMaterial({ color: 0xeafaff, transparent: true, opacity: 0.5, depthWrite: false })`, instances at `y = -0.05` with random rotZ. Cap at 1500 instances (stop scanning when full). `update(dt)`: advance `t`; set material opacity `0.32 + Math.sin(t * 1.4) * 0.18` (pulses with roughly the water's wave period).

- [ ] **Step 3: Wire, verify, commit.** Add both to scene + update loop + `__debug`. Controller: screenshot beach (foam ring follows shoreline), sky (clouds drifting on a long eval), fps.

```bash
git add src/world/Clouds.ts src/world/ShoreFoam.ts src/main.ts
git commit -m "feat: drifting toon clouds and pulsing shore foam"
```

---

### Task 10: Dust particles + birds

**Files:**
- Create: `src/fx/Dust.ts`, `src/fx/Birds.ts`
- Test: `src/fx/Dust.test.ts`
- Modify: `src/main.ts`, `src/audio/AudioManager.ts` (one public method), `src/audio/Ambience.ts` (no change — bird cries reuse `chirp` via a public wrapper, see Step 3)

- [ ] **Step 1: Dust pool with tests for the pure lifecycle**

Pure part, exported for tests:

```ts
export interface Puff { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number }

export function stepPuff(p: Puff, dt: number): boolean {
  p.age += dt;
  if (p.age >= p.life) return false;
  p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  p.vy += 1.2 * dt;          // dust floats up slightly
  p.vx *= 1 - 1.5 * dt; p.vz *= 1 - 1.5 * dt;
  return true;
}
```

Tests:

```ts
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
```

Class `Dust`: InstancedMesh of 64 `PlaneGeometry(0.35, 0.35)` quads, `MeshBasicMaterial({ color: 0xcfc4a8, transparent: true, depthWrite: false })`, free-list pool. `burst(pos, n, spread)` spawns n puffs with random horizontal velocity ≤ spread, life 0.3–0.5. `update(dt, camera)`: step all live puffs, write matrices (billboard: copy camera quaternion into each instance's rotation), scale grows `0.6 + age/life`, hide dead ones (scale 0), opacity is per-material (single value 0.55 — acceptable since puffs are short-lived). `instanceMatrix.needsUpdate = true` each frame.

- [ ] **Step 2: Trigger wiring in main.ts.** Track `prevAirborne` + `prevVy` across ticks: on `airborne→grounded` with `prevVy < -8` → `dust.burst(feetPos, 10, 2.2)`; while `player.sprinting && state === 'grounded'` → every 0.15 s `dust.burst(feetPos, 2, 0.8)`. `feetPos` = player.position minus capsule half (same formula as avatar feet).

- [ ] **Step 3: Birds**

```ts
import * as THREE from 'three';

/** Flocks of 2-triangle flapping silhouettes circling waypoints. */
export class Birds {
  readonly group = new THREE.Group();
  private t = 0;
  private cryTimer = 8;

  constructor(private onCry: () => void, flocks = 3) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x222630, side: THREE.DoubleSide });
    for (let f = 0; f < flocks; f++) {
      const center = new THREE.Vector3((Math.random() - 0.5) * 500, 70 + Math.random() * 35, (Math.random() - 0.5) * 500);
      for (let i = 0; i < 5 + Math.floor(Math.random() * 3); i++) {
        const geo = new THREE.BufferGeometry();
        // two triangles sharing the body axis — wings flap by scaling y in update
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          0, 0, 0.35,  -0.9, 0.15, -0.2,  0, 0, -0.15,   // left wing
          0, 0, 0.35,   0.9, 0.15, -0.2,  0, 0, -0.15,   // right wing
        ]), 3));
        const bird = new THREE.Mesh(geo, mat);
        bird.userData = { center, radius: 18 + Math.random() * 14, phase: Math.random() * Math.PI * 2, speed: 0.25 + Math.random() * 0.15, flap: 4 + Math.random() * 3 };
        this.group.add(bird);
      }
    }
  }

  update(dt: number, dayW: number): void {
    this.t += dt;
    this.group.visible = dayW > 0.1;
    if (!this.group.visible) return;
    for (const bird of this.group.children as THREE.Mesh[]) {
      const u = bird.userData;
      const a = this.t * u.speed + u.phase;
      bird.position.set(u.center.x + Math.cos(a) * u.radius, u.center.y + Math.sin(a * 0.7) * 3, u.center.z + Math.sin(a) * u.radius);
      bird.rotation.y = -a - Math.PI / 2;
      bird.scale.y = 0.4 + Math.abs(Math.sin(this.t * u.flap + u.phase)) * 0.9; // flap
    }
    this.cryTimer -= dt;
    if (this.cryTimer <= 0) { if (Math.random() < dayW) this.onCry(); this.cryTimer = 6 + Math.random() * 14; }
  }
}
```

Bird cry: add a public `birdCry()` on AudioManager that calls the Ambience chirp twice with a lower start frequency (expose `chirp(freqBase = 2800)` as public on Ambience and call `chirp(1900)`); no-op before init. Wire `new Birds(() => audio.birdCry())`.

- [ ] **Step 4: Tests, type-check, browser pass (landing dust visible, sprint kicks, birds circling + flapping by day, gone at night), commit.**

```bash
git add src/fx/Dust.ts src/fx/Dust.test.ts src/fx/Birds.ts src/main.ts src/audio/
git commit -m "feat: landing/sprint dust and circling birds with cries"
```

---

### Task 11: Final integration playtest (controller-driven)

No subagent. The controller:

- [ ] Full suite: `npx vitest run` (all green) + `npx tsc --noEmit` + `npx vite build` (clean).
- [ ] Browser, day: run/jump (start/air/land clips), climb the new cliff (procedural pose, phase freezes when idle), glide off the plateau (paraglider deploys, arms up), trees (3 archetypes + variation), foam, clouds, birds, dust on landing.
- [ ] Browser, night (KeyT): campfire + fireflies on, birds off, crickets on, night motif plays (WebAudio spy), music day/night sets switch.
- [ ] Audio spies: piano partials scheduled on motif trigger (count `createOscillator` bursts), cricket gain target ≈ 0.028 at night, grass/wave gains react to position.
- [ ] Perf: worst scene (gliding over grass near cliff, clouds + birds visible) — sample 120 frames, 0 frames > 20 ms.
- [ ] Fix-forward anything found, then final code review (opus subagent) on `git diff <pre-iteration-sha>..HEAD`, then superpowers:finishing-a-development-branch.

---

## Self-review notes

- Spec coverage: character/animations (T1–T4), music+ambience+terrain sounds (T5), trees (T6), cliff (T7), night life (T8), sky/sea (T9), dust+birds (T10), perf+verification (T11). All spec sections mapped.
- The `<FILL>` markers in Task 1 are explicit implementer instructions to transcribe inspector output, not placeholders left to chance; the committed manifest must compile and contain verbatim names.
- Type consistency: `CharacterAvatar.update(dt, player)` matches v1 call site; `audio.update` signature change is applied in T5 Step 5; `buildLandmarks` return change is applied in T8 Step 1 with its call site.
- Tuning values (pose angles, gains, cliff sector) are starting points; controller owns browser tuning passes — implementers must not deviate from given values.
