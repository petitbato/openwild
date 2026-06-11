import * as THREE from 'three';

export class Fireflies {
  readonly points: THREE.Points;
  private base: Float32Array;
  private t = 0;
  private mat: THREE.PointsMaterial;

  constructor(centers: THREE.Vector3[], perSite = 20) {
    const n = centers.length * perSite;
    this.base = new Float32Array(n * 3);
    let k = 0;
    for (const c of centers) {
      for (let i = 0; i < perSite; i++) {
        this.base[k++] = c.x + (Math.random() - 0.5) * 24;
        this.base[k++] = c.y + 0.5 + Math.random() * 2.5;
        this.base[k++] = c.z + (Math.random() - 0.5) * 24;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.base.slice(), 3));
    this.mat = new THREE.PointsMaterial({
      color: 0xd8f06a, size: 0.18, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  update(dt: number, nightW: number): void {
    this.t += dt;
    this.mat.opacity = nightW * 0.85;
    this.points.visible = nightW > 0.02;
    if (!this.points.visible) return;
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const j = i * 3, p = this.t * 0.7 + i * 2.39996;
      arr[j] = this.base[j] + Math.sin(p) * 1.6 + Math.sin(p * 0.37) * 1.1;
      arr[j + 1] = this.base[j + 1] + Math.sin(p * 0.9 + 1) * 0.7;
      arr[j + 2] = this.base[j + 2] + Math.cos(p * 0.8) * 1.6;
    }
    pos.needsUpdate = true;
  }
}
