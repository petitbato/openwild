import * as THREE from 'three';
import { toonMaterial } from '../core/toon';

export class Campfire {
  readonly group = new THREE.Group();
  private light: THREE.PointLight;
  private flames: THREE.Mesh[] = [];
  private t = 0;

  constructor(pos: THREE.Vector3) {
    this.group.position.copy(pos);
    const wood = toonMaterial(0x5a3a20);
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 5), wood);
      log.rotation.z = Math.PI / 2 - 0.35;
      log.rotation.y = (i / 5) * Math.PI * 2;
      log.position.y = 0.12;
      this.group.add(log);
    }
    const stoneMat = toonMaterial(0x8d8d93);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), stoneMat);
      stone.position.set(Math.cos(a) * 0.65, 0.07, Math.sin(a) * 0.65);
      this.group.add(stone);
    }
    // Two crossed flame cones, additive, no lighting.
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff8c2e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let i = 0; i < 2; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.85, 6), flameMat);
      flame.position.y = 0.55;
      flame.rotation.y = i * Math.PI / 2;
      this.flames.push(flame);
      this.group.add(flame);
    }
    this.light = new THREE.PointLight(0xff9a3c, 0, 12, 2);
    this.light.position.y = 0.8;
    this.group.add(this.light);
  }

  /** nightW: 0 day → 1 night (from Ambience.dayWeight complement). */
  update(dt: number, nightW: number): void {
    this.t += dt;
    const flick = 1 + Math.sin(this.t * 11) * 0.12 + Math.sin(this.t * 23.7) * 0.08;
    this.light.intensity = nightW * 14 * flick;
    for (const [i, f] of this.flames.entries()) {
      f.visible = nightW > 0.05;
      f.scale.y = (0.85 + Math.sin(this.t * 9 + i * 1.7) * 0.18) * (0.5 + nightW * 0.5);
      (f.material as THREE.MeshBasicMaterial).opacity = 0.9 * nightW;
    }
  }
}
