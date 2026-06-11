import * as THREE from 'three';
import type { TerrainData } from './terrain/heightmap';

// The ±520 scan at step 4 yields ~2280 waterline cells; 2500 covers the full
// ring (a 1500 cap left the eastern shore bare — scan ascends in x).
const MAX_INSTANCES = 2500;

export class ShoreFoam {
  readonly mesh: THREE.InstancedMesh;
  private t = 0;
  private readonly mat: THREE.MeshBasicMaterial;

  constructor(terrain: TerrainData) {
    const geo = new THREE.PlaneGeometry(3.2, 3.2);
    geo.rotateX(-Math.PI / 2); // bake flat orientation into geometry

    this.mat = new THREE.MeshBasicMaterial({
      color: 0xeafaff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX_INSTANCES);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    let count = 0;

    outer:
    for (let x = -520; x <= 520; x += 4) {
      for (let z = -520; z <= 520; z += 4) {
        const h = terrain.heightAt(x, z);
        if (h > -0.4 && h < 0.25) {
          dummy.position.set(x, -0.05, z);
          dummy.rotation.y = Math.random() * Math.PI * 2;
          dummy.updateMatrix();
          this.mesh.setMatrixAt(count, dummy.matrix);
          count++;
          if (count >= MAX_INSTANCES) break outer;
        }
      }
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    this.t += dt;
    this.mat.opacity = 0.32 + Math.sin(this.t * 1.4) * 0.18;
  }
}
