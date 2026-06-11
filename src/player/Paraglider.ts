import * as THREE from 'three';
import { toonMaterial } from '../core/toon';

/** BoTW-style paraglider built from primitives. Deploys/folds with scaling. */
export class Paraglider {
  readonly group = new THREE.Group();
  private deploy = 0; // 0 folded → 1 deployed

  constructor() {
    // Canopy: half-sphere segment squashed into a wing.
    const canopyMat = toonMaterial(0xc8e8f5);
    canopyMat.side = THREE.DoubleSide; // underside visible while gliding below it
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.32),
      canopyMat,
    );
    canopy.scale.set(1.25, 0.55, 0.85);
    // Rim band: darker ring under the canopy edge.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.05, 6, 20), toonMaterial(0x8a5a32));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.12;
    rim.scale.set(1.25, 0.85, 1);
    // Frame: two crossed wooden bars + two handles.
    const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.1, 6);
    const wood = toonMaterial(0x6e4a26);
    const barX = new THREE.Mesh(barGeo, wood); barX.rotation.z = Math.PI / 2; barX.position.y = 0.1;
    const barZ = new THREE.Mesh(barGeo, wood); barZ.rotation.x = Math.PI / 2; barZ.position.y = 0.1;
    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6);
    const hL = new THREE.Mesh(handleGeo, wood); hL.position.set(-0.3, -0.18, 0);
    const hR = new THREE.Mesh(handleGeo, wood); hR.position.set(0.3, -0.18, 0);
    this.group.add(canopy, rim, barX, barZ, hL, hR);
    // Outline shell for the canopy only (cheap): clone, BackSide dark.
    const shell = canopy.clone();
    (shell as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.BackSide });
    shell.scale.multiplyScalar(1.04);
    this.group.add(shell);
    // Anchor above the avatar's head (group is added to avatar.group by a later task).
    this.group.position.set(0, 1.95, 0.05);
    this.group.visible = false;
  }

  update(dt: number, gliding: boolean): void {
    const target = gliding ? 1 : 0;
    const speed = gliding ? dt / 0.2 : dt / 0.15;
    this.deploy = Math.max(0, Math.min(1, this.deploy + (target === 1 ? speed : -speed)));
    this.group.visible = this.deploy > 0.01;
    const e = 1 - Math.pow(1 - this.deploy, 3); // easeOutCubic
    this.group.scale.set(0.15 + 0.85 * e, 0.15 + 0.85 * e, 0.15 + 0.85 * e);
  }
}
