import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

export type TreeArchetype = 'palm' | 'broadleaf' | 'conifer';

export function pickArchetype(h: number, rng: () => number): TreeArchetype {
  if (h >= 0.5 && h < 3) return rng() < 0.85 ? 'palm' : 'broadleaf';
  if (h >= 22) return rng() < 0.75 ? 'conifer' : 'broadleaf';
  return rng() < 0.8 ? 'broadleaf' : 'conifer';
}

// ---- Geometry builders ----

function buildBroadleafTrunk(): THREE.BufferGeometry {
  // CylinderGeometry is centered on the origin — lift by half height so the
  // base sits at y=0 (instances are placed at terrain height).
  const g = new THREE.CylinderGeometry(0.22, 0.38, 2.6, 6);
  g.translate(0, 1.3, 0);
  return g;
}

function buildBroadleafCanopy(): THREE.BufferGeometry {
  const positions: [number, number, number][] = [
    [0, 3.6, 0],
    [0.9, 3.0, 0.3],
    [-0.8, 3.1, -0.2],
  ];
  const radii = [1.5, 1.1, 1.0];
  const geos = positions.map(([px, py, pz], i) => {
    const g = new THREE.IcosahedronGeometry(radii[i], 1).toNonIndexed();
    g.translate(px, py, pz);
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  return merged;
}

function buildConiferTrunk(): THREE.BufferGeometry {
  // Same centering correction as the broadleaf trunk.
  const g = new THREE.CylinderGeometry(0.18, 0.3, 1.8, 6);
  g.translate(0, 0.9, 0);
  return g;
}

function buildConiferCanopy(): THREE.BufferGeometry {
  const cones: [number, number, number][] = [
    [1.7, 2.2, 2.5],
    [1.3, 2.0, 3.9],
    [0.9, 1.8, 5.2],
  ];
  const geos = cones.map(([r, h, y]) => {
    const g = new THREE.ConeGeometry(r, h, 7).toNonIndexed();
    g.translate(0, y, 0);
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  return merged;
}

function buildPalmTrunk(): THREE.BufferGeometry {
  const segments: [number, number, number][] = [
    [0, 0, 0],
    [0.18, 1.2, 0.1],
    [0.42, 2.4, 0.2],
  ];
  const geos = segments.map(([xOff, yOff, zRot]) => {
    const g = new THREE.CylinderGeometry(0.14, 0.18, 1.2, 6).toNonIndexed();
    g.rotateZ(zRot);
    g.translate(xOff, yOff + 0.6, 0);
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  return merged;
}

function buildPalmCanopy(): THREE.BufferGeometry {
  const fronds: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.PlaneGeometry(0.5, 1.8).toNonIndexed();
    // Droop around X, fan around Y
    g.rotateX(-0.9 + i * 0.05);
    g.rotateY(i * Math.PI / 3);
    // Position at trunk top (lean x ≈ 0.6, y ≈ 3.3)
    g.translate(0.6, 3.3, 0);
    fronds.push(g);
  }
  const merged = mergeGeometries(fronds, false);
  fronds.forEach(g => g.dispose());
  return merged;
}

// ---- Archetype geometry tables ----

interface ArchetypeGeometry {
  trunk: THREE.BufferGeometry;
  canopy: THREE.BufferGeometry;
  trunkColor: number;
  canopyColor: number;
}

export function buildArchetypeGeometries(): Record<TreeArchetype, ArchetypeGeometry> {
  return {
    broadleaf: {
      trunk: buildBroadleafTrunk(),
      canopy: buildBroadleafCanopy(),
      trunkColor: 0x7a5230,
      canopyColor: 0x3e8e4f,
    },
    conifer: {
      trunk: buildConiferTrunk(),
      canopy: buildConiferCanopy(),
      trunkColor: 0x6a4a2e,
      canopyColor: 0x2f6e46,
    },
    palm: {
      trunk: buildPalmTrunk(),
      canopy: buildPalmCanopy(),
      trunkColor: 0x8a6a40,
      canopyColor: 0x4a9a55,
    },
  };
}

const MAX_TREES = 600;
const BEACH_TREES = 80;
const CAPACITY = MAX_TREES + BEACH_TREES;
const MAX_ROCKS = 250;

export function scatterProps(scene: THREE.Scene, physics: Physics, terrain: TerrainData, seed = 7): void {
  const rand = mulberry32(seed);

  // Build per-archetype InstancedMeshes
  const archetypeGeos = buildArchetypeGeometries();
  const archetypes: TreeArchetype[] = ['broadleaf', 'conifer', 'palm'];

  const trunkMeshes = {} as Record<TreeArchetype, THREE.InstancedMesh>;
  const canopyMeshes = {} as Record<TreeArchetype, THREE.InstancedMesh>;

  for (const arch of archetypes) {
    const ag = archetypeGeos[arch];
    const trunkMat = toonMaterial(0xffffff);
    const canopyMat = toonMaterial(0xffffff, {
      side: arch === 'palm' ? THREE.DoubleSide : THREE.FrontSide,
    });
    const tm = new THREE.InstancedMesh(ag.trunk, trunkMat, CAPACITY);
    const cm = new THREE.InstancedMesh(ag.canopy, canopyMat, CAPACITY);
    tm.castShadow = cm.castShadow = true;
    tm.frustumCulled = cm.frustumCulled = false;
    trunkMeshes[arch] = tm;
    canopyMeshes[arch] = cm;
  }

  // Counts per archetype
  const counts: Record<TreeArchetype, number> = { broadleaf: 0, conifer: 0, palm: 0 };

  const tmpObj = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  function placeTree(x: number, z: number, h: number, arch: TreeArchetype,
                     s: number, rotY: number, tiltX: number, tiltZ: number,
                     hueJitter: number, lightJitter: number): void {
    const ag = archetypeGeos[arch];
    const idx = counts[arch];

    tmpObj.position.set(x, h, z);
    tmpObj.rotation.set(tiltX, rotY, tiltZ, 'YXZ');
    tmpObj.scale.setScalar(s);
    tmpObj.updateMatrix();

    // Trunk color
    tmpColor.setHex(ag.trunkColor);
    const trunkHSL = { h: 0, s: 0, l: 0 };
    tmpColor.getHSL(trunkHSL);
    tmpColor.setHSL(
      trunkHSL.h + hueJitter,
      trunkHSL.s,
      Math.max(0, Math.min(1, trunkHSL.l + lightJitter)),
    );
    trunkMeshes[arch].setMatrixAt(idx, tmpObj.matrix);
    trunkMeshes[arch].setColorAt(idx, tmpColor);

    // Canopy color
    tmpColor.setHex(ag.canopyColor);
    const canopyHSL = { h: 0, s: 0, l: 0 };
    tmpColor.getHSL(canopyHSL);
    tmpColor.setHSL(
      canopyHSL.h + hueJitter,
      canopyHSL.s,
      Math.max(0, Math.min(1, canopyHSL.l + lightJitter)),
    );
    canopyMeshes[arch].setMatrixAt(idx, tmpObj.matrix);
    canopyMeshes[arch].setColorAt(idx, tmpColor);

    // Physics collider
    const colliderRadius = arch === 'palm' ? 0.25 * s : 0.35 * s;
    const colliderHalfH = arch === 'palm' ? 1.8 * s : 1.2 * s;
    physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(colliderHalfH, colliderRadius).setTranslation(x, h + colliderHalfH, z),
    );

    counts[arch]++;
  }

  // Main scatter loop (h 3–45, normal.y >= 0.8)
  let n = 0;
  for (let i = 0; i < 6000 && n < MAX_TREES; i++) {
    // Always draw 9 rng calls per iteration (x, z already drawn; draw remaining)
    const x = (rand() * 2 - 1) * 470;
    const z = (rand() * 2 - 1) * 470;
    const h = terrain.heightAt(x, z);
    const s = rand();           // call 3
    const rotY = rand();        // call 4
    const tiltX = rand();       // call 5
    const tiltZ = rand();       // call 6
    const hueRoll = rand();     // call 7
    const lightRoll = rand();   // call 8
    const archRoll = rand();    // call 9

    if (h < 3 || h > 45 || terrain.normalAt(x, z).y < 0.8) continue;

    const scale = 0.7 + s * 0.7;
    // h >= 3 here, so pickArchetype never returns 'palm' (palms spawn in the beach loop below)
    const arch = pickArchetype(h, () => archRoll);

    placeTree(x, z, h, arch, scale, rotY * Math.PI * 2,
      (tiltX - 0.5) * 0.14, (tiltZ - 0.5) * 0.14,
      (hueRoll - 0.5) * 0.06, (lightRoll - 0.5) * 0.16);
    n++;
  }

  // Beach band scatter loop for palms (h 0.5–3)
  let p = 0;
  for (let i = 0; i < 3000 && p < BEACH_TREES; i++) {
    const x = (rand() * 2 - 1) * 470;
    const z = (rand() * 2 - 1) * 470;
    const h = terrain.heightAt(x, z);
    const s = rand();
    const rotY = rand();
    const tiltX = rand();
    const tiltZ = rand();
    const hueRoll = rand();
    const lightRoll = rand();
    rand(); // archRoll — keep call count uniform

    if (h < 0.5 || h >= 3 || terrain.normalAt(x, z).y < 0.8) continue;

    const scale = 0.7 + s * 0.7;
    placeTree(x, z, h, 'palm', scale, rotY * Math.PI * 2,
      (tiltX - 0.5) * 0.14, (tiltZ - 0.5) * 0.14,
      (hueRoll - 0.5) * 0.06, (lightRoll - 0.5) * 0.16);
    p++;
  }

  // Finalize InstancedMeshes
  for (const arch of archetypes) {
    const c = counts[arch];
    const tm = trunkMeshes[arch];
    const cm = canopyMeshes[arch];
    tm.count = cm.count = c;
    tm.instanceMatrix.needsUpdate = true;
    cm.instanceMatrix.needsUpdate = true;
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    if (c > 0) scene.add(tm, cm);
  }

  // ---- Rocks (unchanged) ----
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);

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
