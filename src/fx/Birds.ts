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
      const u = bird.userData as { center: THREE.Vector3; radius: number; phase: number; speed: number; flap: number };
      const a = this.t * u.speed + u.phase;
      bird.position.set(u.center.x + Math.cos(a) * u.radius, u.center.y + Math.sin(a * 0.7) * 3, u.center.z + Math.sin(a) * u.radius);
      bird.rotation.y = -a - Math.PI / 2;
      bird.scale.y = 0.4 + Math.abs(Math.sin(this.t * u.flap + u.phase)) * 0.9; // flap
    }
    this.cryTimer -= dt;
    if (this.cryTimer <= 0) { if (Math.random() < dayW) this.onCry(); this.cryTimer = 6 + Math.random() * 14; }
  }
}
