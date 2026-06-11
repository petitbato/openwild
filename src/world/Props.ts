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
