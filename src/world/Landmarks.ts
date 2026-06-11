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
