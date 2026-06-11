import * as THREE from 'three';
import { Physics, RAPIER } from '../physics/Physics';
import type { Actions } from '../core/Input';
import { Stamina } from './Stamina';

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
  readonly stamina = new Stamina();

  get worldVelocity(): THREE.Vector3 {
    return this.state === 'gliding'
      ? this.glideVel.clone().setY(this.velocityY)
      : this.facing.clone().multiplyScalar(this.speed).setY(this.velocityY);
  }

  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  protected controller: RAPIER.KinematicCharacterController;
  protected moveDir = new THREE.Vector3();

  private wallNormal = new THREE.Vector3();
  private climbLeap = 0;       // seconds of climb-jump boost remaining
  private climbCooldown = 0;   // prevents instant re-grab after letting go
  private glideVel = new THREE.Vector3();

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
    const p = this.body.translation();
    this.position.set(p.x, p.y, p.z);
    this.climbCooldown = Math.max(0, this.climbCooldown - dt);

    switch (this.state) {
      case 'grounded':
      case 'airborne':
        this.updateGroundAir(dt, actions, cameraYaw);
        break;
      case 'climbing':
        this.updateClimb(dt, actions);
        break;
      case 'gliding':
        this.updateGlide(dt, actions, cameraYaw);
        break;
    }
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

    if (this.moveDir.lengthSq() > 0.09 && this.tryEnterClimb()) return;

    this.sprinting =
      actions.sprintHeld && grounded && this.moveDir.lengthSq() > 0.01 && this.stamina.canUse;
    const targetSpeed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    this.speed = this.moveDir.length() * targetSpeed;

    if (this.sprinting) this.stamina.drain(10 * dt);
    this.stamina.update(dt, grounded && !this.sprinting);

    this.velocityY += GRAVITY * dt;
    if (grounded && actions.jumpPressed) {
      this.velocityY = JUMP_VELOCITY;
      this.state = 'airborne';
    }

    if (!grounded && actions.jumpPressed && this.stamina.canUse && this.velocityY < 2) {
      this.state = 'gliding';
      this.glideVel.set(this.moveDir.x, 0, this.moveDir.z).multiplyScalar(this.speed);
      return;
    }

    this.applyKinematicMove(
      this.moveDir.x * targetSpeed * dt,
      this.velocityY * dt,
      this.moveDir.z * targetSpeed * dt,
    );
  }

  private updateGlide(dt: number, actions: Actions, cameraYaw: number): void {
    this.computeMoveDir(actions, cameraYaw);
    this.stamina.drain(4 * dt);

    // exit: press jump again, run out of stamina, or touch ground
    if (actions.jumpPressed || !this.stamina.canUse) { this.state = 'airborne'; return; }

    // slow fall
    this.velocityY += GRAVITY * dt * 0.25;
    this.velocityY = Math.max(this.velocityY, -2.5);

    // steer toward input at glide speed
    const targetVel = this.moveDir.clone().multiplyScalar(9);
    this.glideVel.lerp(targetVel, Math.min(1, dt * 1.5));
    this.speed = this.glideVel.length();
    if (this.glideVel.lengthSq() > 0.01) {
      this.facing.copy(this.glideVel.clone().setY(0).normalize());
    }

    this.applyKinematicMove(this.glideVel.x * dt, this.velocityY * dt, this.glideVel.z * dt);
    if (this.state === 'grounded') this.velocityY = -2; // landed
  }

  /** Runs the Rapier KCC and updates grounded state + respawn anchor. */
  protected applyKinematicMove(dx: number, dy: number, dz: number): void {
    this.controller.computeColliderMovement(this.collider, { x: dx, y: dy, z: dz });
    const m = this.controller.computedMovement();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });

    if (this.controller.computedGrounded()) {
      // velocityY > 0 means a jump just launched — don't let ground snap cancel it
      if ((this.state === 'airborne' && this.velocityY <= 0) || this.state === 'gliding') this.state = 'grounded';
      if (this.state === 'grounded') {
        if (this.velocityY < -2) this.velocityY = -2;
        // Only anchor the respawn point on land above the waterline, so
        // drowning never respawns you back into the sea (respawn loop).
        if (t.y - (Player.HALF_HEIGHT + Player.RADIUS) > 0.2) {
          this.lastGroundedPos.set(t.x, t.y, t.z);
        }
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
    this.climbLeap = 0;
    this.climbCooldown = 0.35;
  }

  private tryEnterClimb(): boolean {
    if (this.climbCooldown > 0 || !this.stamina.canUse) return false;
    const dir = this.moveDir.clone().normalize();
    const origin = { x: this.position.x, y: this.position.y + 0.3, z: this.position.z };
    const hit = this.physics.raycast(origin, { x: dir.x, y: 0, z: dir.z }, 0.9, this.collider);
    if (!hit || Math.abs(hit.normal.y) > 0.64) return false; // not steep enough (cos 50°), or overhang
    this.wallNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    // snap to the wall immediately so the re-stick ray in updateClimb is in range
    this.body.setNextKinematicTranslation({
      x: hit.point.x + this.wallNormal.x * (Player.RADIUS + 0.15),
      y: this.position.y + this.wallNormal.y * (Player.RADIUS + 0.15),
      z: hit.point.z + this.wallNormal.z * (Player.RADIUS + 0.15),
    });
    this.state = 'climbing';
    this.velocityY = 0;
    this.climbLeap = 0;
    return true;
  }

  private updateClimb(dt: number, actions: Actions): void {
    // re-stick to the wall
    let inward = this.wallNormal.clone().multiplyScalar(-1);
    const origin = this.position.clone().addScaledVector(this.wallNormal, 0.5);
    const hit = this.physics.raycast(origin, inward, 1.2, this.collider);
    if (!hit) { if (!this.tryVault()) this.exitClimb(); return; }
    this.wallNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    inward = this.wallNormal.clone().multiplyScalar(-1);

    this.stamina.drain(8 * dt);
    if (!this.stamina.canUse) { this.exitClimb(); return; }

    if (actions.jumpPressed) {
      if (actions.move.y < -0.3) { this.exitClimb(); this.velocityY = 2; return; } // let go
      this.stamina.drain(12);
      this.climbLeap = 0.3;
    }
    this.climbLeap = Math.max(0, this.climbLeap - dt);

    // wall tangent basis
    const up = new THREE.Vector3(0, 1, 0);
    const right = up.clone().cross(this.wallNormal);
    if (right.lengthSq() < 1e-6) { this.exitClimb(); return; } // wall turned into floor/ceiling
    right.normalize();
    const wallUp = this.wallNormal.clone().cross(right).normalize();

    if (actions.move.y > 0.1 && this.tryVault()) return;

    const speed = 2.2;
    const boost = this.climbLeap > 0 ? 4 : 1;
    const vel = right.clone().multiplyScalar(-actions.move.x * speed)
      .addScaledVector(wallUp, actions.move.y * speed * boost);

    const target = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z)
      .addScaledVector(this.wallNormal, Player.RADIUS + 0.15)
      .addScaledVector(vel, dt);
    this.body.setNextKinematicTranslation({ x: target.x, y: target.y, z: target.z });

    const face = inward.clone();
    face.y = 0;
    if (face.lengthSq() > 0.001) this.facing.copy(face.normalize());
    this.speed = vel.length(); // drives climb animation speed later
  }

  private exitClimb(): void {
    this.state = 'airborne';
    this.climbCooldown = 0.35;
  }

  /** Returns true if it handled a state change (vault to top, or fall). */
  private tryVault(): boolean {
    const inward = this.wallNormal.clone().multiplyScalar(-1);
    // still a steep wall at head height? then no ledge yet
    const headOrigin = this.position.clone().addScaledVector(this.wallNormal, 0.5);
    headOrigin.y += 1.1;
    const wallAtHead = this.physics.raycast(headOrigin, inward, 1.3, this.collider);
    if (wallAtHead && wallAtHead.normal.y < 0.64) return false;

    // find the surface on top of the ledge
    const overOrigin = this.position.clone().addScaledVector(inward, Player.RADIUS + 0.55);
    overOrigin.y += 1.7;
    const down = this.physics.raycast(overOrigin, { x: 0, y: -1, z: 0 }, 2.6, this.collider);
    if (!down) { this.exitClimb(); return true; } // wall ended with nothing on top

    const standY = down.point.y + Player.HALF_HEIGHT + Player.RADIUS + 0.05;
    this.body.setNextKinematicTranslation({ x: overOrigin.x, y: standY, z: overOrigin.z });
    this.state = 'grounded';
    this.velocityY = 0;
    // Same waterline guard as applyKinematicMove: never anchor respawn underwater.
    if (standY - (Player.HALF_HEIGHT + Player.RADIUS) > 0.2) {
      this.lastGroundedPos.set(overOrigin.x, standY, overOrigin.z);
    }
    this.climbCooldown = 0.2; // brief no-regrab window after topping out
    return true;
  }
}
