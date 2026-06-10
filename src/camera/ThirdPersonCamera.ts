import * as THREE from 'three';
import type { Physics } from '../physics/Physics';
import type RAPIER from '@dimforge/rapier3d-compat';

export class ThirdPersonCamera {
  yaw = 0;
  pitch = -0.35;
  distance = 5.5;
  private currentPos = new THREE.Vector3();
  private initialized = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private physics: Physics,
    private playerCollider: RAPIER.Collider,
  ) {}

  update(dt: number, look: { x: number; y: number }, playerPos: THREE.Vector3, fovBoost: number): void {
    this.yaw -= look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.35, 1.0);

    const head = playerPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    let dist = this.distance;
    const hit = this.physics.raycast(head, dir, this.distance, this.playerCollider);
    if (hit) dist = Math.max(0.6, hit.toi - 0.25);

    const desired = head.clone().addScaledVector(dir, dist);
    if (!this.initialized) {
      this.currentPos.copy(desired);
      this.initialized = true;
    }
    this.currentPos.lerp(desired, 1 - Math.pow(0.0001, dt));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(head);

    const targetFov = 60 + fovBoost;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();
  }
}
