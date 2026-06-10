import * as THREE from 'three';

const COUNT = 14;

export class WindStreaks {
  readonly group = new THREE.Group();
  private offsets: THREE.Vector3[] = [];
  private phases: number[] = [];

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    const geo = new THREE.BoxGeometry(0.03, 0.03, 2.2);
    for (let i = 0; i < COUNT; i++) {
      const m = new THREE.Mesh(geo, mat);
      this.group.add(m);
      this.offsets.push(new THREE.Vector3(
        (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6,
      ));
      this.phases.push(Math.random() * 10);
    }
    this.group.visible = false;
  }

  update(dt: number, active: boolean, playerPos: THREE.Vector3, velocity: THREE.Vector3): void {
    this.group.visible = active && velocity.lengthSq() > 4;
    if (!this.group.visible) return;
    const dir = velocity.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    this.group.children.forEach((child, i) => {
      this.phases[i] += dt * 3;
      const slide = ((this.phases[i] % 2) - 1) * 6; // -6..6 along travel dir
      child.position.copy(playerPos).add(this.offsets[i]).addScaledVector(dir, -slide);
      child.quaternion.copy(q);
    });
  }
}
