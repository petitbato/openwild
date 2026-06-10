import * as THREE from 'three';
import { Physics, RAPIER } from '../physics/Physics';
import type { Actions } from '../core/Input';

export type PlayerState = 'grounded' | 'airborne' | 'climbing' | 'gliding';

export const GRAVITY = -30;
const WALK_SPEED = 5.5;
const SPRINT_SPEED = 9;
const JUMP_VELOCITY = 12;

export class Player {
  static readonly HALF_HEIGHT = 0.6;
  static readonly RADIUS = 0.35; // capsule total height 1.9 m

  state: PlayerState = 'airborne';
  readonly position = new THREE.Vector3();
  readonly facing = new THREE.Vector3(0, 0, -1);
  readonly lastGroundedPos = new THREE.Vector3();
  velocityY = 0;
  speed = 0; // horizontal speed, drives animation + FOV
  sprinting = false;

  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  protected controller: RAPIER.KinematicCharacterController;
  protected moveDir = new THREE.Vector3();

  constructor(protected physics: Physics, spawn: THREE.Vector3) {
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(Player.HALF_HEIGHT, Player.RADIUS),
      this.body,
    );
    this.controller = physics.world.createCharacterController(0.05);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.controller.enableAutostep(0.45, 0.25, true);
    this.position.copy(spawn);
    this.lastGroundedPos.copy(spawn);
  }

  update(dt: number, actions: Actions, cameraYaw: number): void {
    switch (this.state) {
      case 'grounded':
      case 'airborne':
        this.updateGroundAir(dt, actions, cameraYaw);
        break;
      case 'climbing': // implemented in Task 9
      case 'gliding':  // implemented in Task 10
        break;
    }
    const p = this.body.translation();
    this.position.set(p.x, p.y, p.z);
  }

  protected computeMoveDir(actions: Actions, cameraYaw: number): void {
    const f = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    this.moveDir.set(0, 0, 0).addScaledVector(f, actions.move.y).addScaledVector(r, actions.move.x);
    if (this.moveDir.lengthSq() > 1) this.moveDir.normalize();
    if (this.moveDir.lengthSq() > 0.0001) this.facing.copy(this.moveDir).normalize();
  }

  private updateGroundAir(dt: number, actions: Actions, cameraYaw: number): void {
    const grounded = this.state === 'grounded';
    this.computeMoveDir(actions, cameraYaw);

    this.sprinting = actions.sprintHeld && grounded && this.moveDir.lengthSq() > 0.01;
    const targetSpeed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    this.speed = this.moveDir.length() * targetSpeed;

    this.velocityY += GRAVITY * dt;
    if (grounded && this.velocityY < -2) this.velocityY = -2;
    if (grounded && actions.jumpPressed) {
      this.velocityY = JUMP_VELOCITY;
      this.state = 'airborne';
    }

    this.applyKinematicMove(
      this.moveDir.x * targetSpeed * dt,
      this.velocityY * dt,
      this.moveDir.z * targetSpeed * dt,
    );
  }

  /** Runs the Rapier KCC and updates grounded state + respawn anchor. */
  protected applyKinematicMove(dx: number, dy: number, dz: number): void {
    this.controller.computeColliderMovement(this.collider, { x: dx, y: dy, z: dz });
    const m = this.controller.computedMovement();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });

    if (this.controller.computedGrounded()) {
      if (this.state === 'airborne' || this.state === 'gliding') this.state = 'grounded';
      if (this.state === 'grounded') {
        if (this.velocityY < -2) this.velocityY = -2;
        this.lastGroundedPos.set(t.x, t.y, t.z);
      }
    } else if (this.state === 'grounded') {
      this.state = 'airborne';
    }
  }

  /** Hard reposition (respawn). */
  teleport(pos: THREE.Vector3): void {
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
    this.velocityY = 0;
    this.state = 'airborne';
  }
}
