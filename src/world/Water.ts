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
