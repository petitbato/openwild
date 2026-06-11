import * as THREE from 'three';
import type { Player } from './Player';

/** dt-based exponential approach toward 1 (active) or 0, ~0.15s ramp. */
export function approachWeight(w: number, active: boolean, dt: number): number {
  const target = active ? 1 : 0;
  return w + (target - w) * Math.min(1, dt * 18);
}

export function advanceClimbPhase(phase: number, speed: number, dt: number): number {
  return phase + speed * dt * 2.4; // 2.2 m/s climb ≈ 0.84 cycles/s
}

/**
 * Pose targets are desired bone DIRECTIONS in character-root space
 * (forward = -Z, up = +Y, right = +X). The class solves local quaternions
 * against each bone's rest orientation, so rig-specific bone rolls
 * (KayKit/Blender) are preserved.
 */
export interface PoseTargets { [bone: string]: THREE.Vector3 }

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** 4-beat climb cycle on a wall at -Z: L-hand reaches with R-foot, then mirrored. */
export function climbTargets(phase: number): PoseTargets {
  const s = Math.sin(phase);
  return {
    spine: v(0, 1, -0.4),
    head: v(0, 1, -0.5),
    armL: v(-0.35, 0.85 + s * 0.35, -0.45),
    armR: v(0.35, 0.85 - s * 0.35, -0.45),
    forearmL: v(-0.25, 0.9 + s * 0.3, -0.55),
    forearmR: v(0.25, 0.9 - s * 0.3, -0.55),
    legL: v(-0.2, -0.85 - s * 0.3, -0.35),
    legR: v(0.2, -0.85 + s * 0.3, -0.35),
  };
}

/** Arms raised toward paraglider handles, legs dangling with subtle sway. */
export function glideTargets(t: number): PoseTargets {
  const sway = Math.sin(t * 2.0) * 0.06;
  return {
    spine: v(0, 1, -0.08),
    armL: v(-0.4, 0.9, -0.05),
    armR: v(0.4, 0.9, -0.05),
    forearmL: v(-0.12, 0.95, -0.1),
    forearmR: v(0.12, 0.95, -0.1),
    legL: v(-0.07, -0.95, 0.22 + sway),
    legR: v(0.07, -0.95, 0.22 - sway),
  };
}

export class ProceduralPoses {
  private bones = new Map<string, THREE.Bone>();
  private restLocal = new Map<string, THREE.Quaternion>();
  private climbW = 0; private glideW = 0; private phase = 0; private t = 0;

  // scratch (avoid per-frame allocations)
  private qParent = new THREE.Quaternion();
  private qRot = new THREE.Quaternion();
  private qTarget = new THREE.Quaternion();
  private vDir = new THREE.Vector3();
  private vRest = new THREE.Vector3();

  constructor(root: THREE.Object3D, boneNames: Record<string, string>) {
    // GLTFLoader sanitizes node names (strips dots etc.) — manifest names are
    // verbatim from the GLB, so sanitize them the same way before matching.
    const wanted = new Map<string, string>(); // sanitized name -> our key
    for (const [key, name] of Object.entries(boneNames)) {
      wanted.set(THREE.PropertyBinding.sanitizeNodeName(name), key);
    }
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        const key = wanted.get(o.name);
        if (key) {
          this.bones.set(key, o as THREE.Bone);
          // Captured before any mixer.update: this is the bind/rest local pose.
          this.restLocal.set(key, o.quaternion.clone());
        }
      }
    });
  }

  /** Call AFTER mixer.update(dt). `rootQuat` = character root world rotation (yaw). */
  update(dt: number, player: Player, rootQuat: THREE.Quaternion): void {
    this.t += dt;
    this.climbW = approachWeight(this.climbW, player.state === 'climbing', dt);
    this.glideW = approachWeight(this.glideW, player.state === 'gliding', dt);
    if (player.state === 'climbing') this.phase = advanceClimbPhase(this.phase, player.speed, dt);
    if (this.climbW > 0.001) this.apply(climbTargets(this.phase), this.climbW, rootQuat);
    if (this.glideW > 0.001) this.apply(glideTargets(this.t), this.glideW, rootQuat);
  }

  private apply(targets: PoseTargets, w: number, rootQuat: THREE.Quaternion): void {
    for (const [key, dirChar] of Object.entries(targets)) {
      const bone = this.bones.get(key);
      const rest = this.restLocal.get(key);
      if (!bone || !rest || !bone.parent) continue;
      // Desired direction: character space -> world -> parent-bone space.
      // NB: qParent is inverted in place here; it is rewritten next iteration.
      bone.parent.getWorldQuaternion(this.qParent);
      this.vDir.copy(dirChar).applyQuaternion(rootQuat)
        .applyQuaternion(this.qParent.invert()).normalize();
      // Bone Y+ direction in parent space at rest.
      this.vRest.set(0, 1, 0).applyQuaternion(rest);
      // Minimal rotation from rest direction to desired, applied on top of rest.
      this.qRot.setFromUnitVectors(this.vRest, this.vDir);
      this.qTarget.copy(this.qRot).multiply(rest);
      bone.quaternion.slerp(this.qTarget, w);
    }
  }
}
