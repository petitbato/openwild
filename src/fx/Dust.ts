import * as THREE from 'three';

export interface Puff {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; life: number;
}

export function stepPuff(p: Puff, dt: number): boolean {
  p.age += dt;
  if (p.age >= p.life) return false;
  p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  p.vy += 1.2 * dt;          // dust floats up slightly
  p.vx *= 1 - 1.5 * dt; p.vz *= 1 - 1.5 * dt;
  return true;
}

const MAX = 64;
const ZERO_MAT = new THREE.Matrix4().makeScale(0, 0, 0);

export class Dust {
  readonly mesh: THREE.InstancedMesh;
  private puffs: (Puff | null)[] = new Array(MAX).fill(null);
  private readonly mat: THREE.MeshBasicMaterial;
  private dummy = new THREE.Object3D();

  constructor() {
    const geo = new THREE.PlaneGeometry(0.35, 0.35);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xcfc4a8, transparent: true, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.frustumCulled = false;
    this.mat.opacity = 0.55;
    // Hide all instances initially
    for (let i = 0; i < MAX; i++) {
      this.mesh.setMatrixAt(i, ZERO_MAT);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  burst(pos: THREE.Vector3, n: number, spread: number): void {
    let spawned = 0;
    for (let i = 0; i < MAX && spawned < n; i++) {
      if (this.puffs[i] !== null) continue;
      const angle = Math.random() * Math.PI * 2;
      const mag = Math.random() * spread;
      this.puffs[i] = {
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(angle) * mag,
        vy: 0.5 + Math.random() * 0.5,
        vz: Math.sin(angle) * mag,
        age: 0,
        life: 0.3 + Math.random() * 0.2,
      };
      spawned++;
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    const camQuat = camera.quaternion;

    for (let i = 0; i < MAX; i++) {
      const p = this.puffs[i];
      if (p === null) {
        this.mesh.setMatrixAt(i, ZERO_MAT);
        continue;
      }
      const alive = stepPuff(p, dt);
      if (!alive) {
        this.puffs[i] = null;
        this.mesh.setMatrixAt(i, ZERO_MAT);
        continue;
      }
      const scale = 0.6 + p.age / p.life;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.quaternion.copy(camQuat);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
