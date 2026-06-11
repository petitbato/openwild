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
