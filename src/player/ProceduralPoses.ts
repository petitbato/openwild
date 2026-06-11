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

export interface PoseTargets { [bone: string]: THREE.Euler }

/** 4-beat climb cycle. Angles in radians, X = forward pitch of the limb. */
export function climbTargets(phase: number): PoseTargets {
  const s = Math.sin(phase);
  return {
    spine: new THREE.Euler(0.35, 0, 0),
    head: new THREE.Euler(-0.45, 0, 0),
    armL: new THREE.Euler(-2.2 - s * 0.5, 0, -0.25),
    armR: new THREE.Euler(-2.2 + s * 0.5, 0, 0.25),
    forearmL: new THREE.Euler(-0.4 - s * 0.2, 0, 0),
    forearmR: new THREE.Euler(-0.4 + s * 0.2, 0, 0),
    legL: new THREE.Euler(-0.9 + s * 0.45, 0, 0.15),
    legR: new THREE.Euler(-0.9 - s * 0.45, 0, -0.15),
  };
}

/** Arms up gripping paraglider handles, legs dangling with sway. */
export function glideTargets(t: number): PoseTargets {
  const sway = Math.sin(t * 2.0) * 0.08;
  return {
    spine: new THREE.Euler(0.1, 0, 0),
    armL: new THREE.Euler(-2.7, 0, -0.35),
    armR: new THREE.Euler(-2.7, 0, 0.35),
    forearmL: new THREE.Euler(-0.5, 0, 0),
    forearmR: new THREE.Euler(-0.5, 0, 0),
    legL: new THREE.Euler(0.3 + sway, 0, 0.06),
    legR: new THREE.Euler(0.3 - sway, 0, -0.06),
  };
}

export class ProceduralPoses {
  private bones = new Map<string, THREE.Bone>();
  private climbW = 0; private glideW = 0; private phase = 0; private t = 0;
  private q = new THREE.Quaternion();

  constructor(root: THREE.Object3D, boneNames: Record<string, string>) {
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        for (const [key, name] of Object.entries(boneNames)) {
          if (o.name === name) this.bones.set(key, o as THREE.Bone);
        }
      }
    });
  }

  /** Call AFTER mixer.update(dt). Slerps bones toward pose targets by weight. */
  update(dt: number, player: Player): void {
    this.t += dt;
    this.climbW = approachWeight(this.climbW, player.state === 'climbing', dt);
    this.glideW = approachWeight(this.glideW, player.state === 'gliding', dt);
    if (player.state === 'climbing') this.phase = advanceClimbPhase(this.phase, player.speed, dt);
    if (this.climbW > 0.001) this.apply(climbTargets(this.phase), this.climbW);
    if (this.glideW > 0.001) this.apply(glideTargets(this.t), this.glideW);
  }

  private apply(targets: PoseTargets, w: number): void {
    for (const [key, euler] of Object.entries(targets)) {
      const bone = this.bones.get(key);
      if (!bone) continue;
      this.q.setFromEuler(euler);
      bone.quaternion.slerp(this.q, w);
    }
  }
}
