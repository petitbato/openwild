import * as THREE from 'three';
import { toonMaterial } from '../core/toon';

export class Clouds {
  readonly group = new THREE.Group();
  private speeds: number[] = [];

  constructor(count = 10, seed = 11) {
    let s = seed;
    const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const mat = toonMaterial(0xffffff, { transparent: true, opacity: 0.92 });
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
