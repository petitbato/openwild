import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getGradientMap } from '../core/toon';
import { MODEL_URL, ATLAS_URL, CLIPS, BONES } from './kaykit';
import { ProceduralPoses } from './ProceduralPoses';
import { Paraglider } from './Paraglider';
import type { Player, PlayerState } from './Player';

// ---------- helpers --------------------------------------------------------

// GLTFLoader sanitizes node names (strips dots etc.) — match what it produces.
const HANDSLOTS = new Set(
  ['handslot.l', 'handslot.r'].map((n) => THREE.PropertyBinding.sanitizeNodeName(n)),
);

function isUnderHandslot(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj.parent;
  while (cur) {
    if (HANDSLOTS.has(cur.name)) return true;
    cur = cur.parent;
  }
  return false;
}

// ---------- class ----------------------------------------------------------

export class CharacterAvatar {
  /** main.ts positions this and sets rotation.y — we never touch it */
  readonly group = new THREE.Group();
  /** orientation + glide lean live here */
  private inner = new THREE.Group();

  private mixer: THREE.AnimationMixer;
  private actions: {
    idle: THREE.AnimationAction;
    walk: THREE.AnimationAction;
    run: THREE.AnimationAction;
    jumpStart: THREE.AnimationAction;
    jumpAir: THREE.AnimationAction;
    jumpLand: THREE.AnimationAction;
  };

  private poses: ProceduralPoses;
  private paraglider: Paraglider;

  private prevState: PlayerState = 'grounded';
  private landTimer = 0;

  private constructor(
    scene: THREE.Group,
    animations: THREE.AnimationClip[],
    mixer: THREE.AnimationMixer,
    actions: CharacterAvatar['actions'],
    poses: ProceduralPoses,
    paraglider: Paraglider,
    inner: THREE.Group,
  ) {
    this.inner = inner;
    this.mixer = mixer;
    this.actions = actions;
    this.poses = poses;
    this.paraglider = paraglider;

    this.inner.add(scene);
    this.group.add(this.inner);
    this.group.add(this.paraglider.group);

    // Kick off all looping actions at weight 0 so fade maths work immediately.
    for (const key of ['idle', 'walk', 'run', 'jumpAir'] as const) {
      this.actions[key].setEffectiveWeight(0).play();
    }
    // One-shots just need to be referenced — played on demand.
  }

  // -------------------------------------------------------------------------
  // Static factory
  // -------------------------------------------------------------------------

  static async load(_url: string, onProgress?: (f: number) => void): Promise<CharacterAvatar> {
    // Load model
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL, (e) => {
      if (onProgress && e.total > 0) onProgress(e.loaded / e.total);
    });

    // Load atlas texture
    const atlas = await new THREE.TextureLoader().loadAsync(ATLAS_URL);
    atlas.flipY = false; // glTF UV convention
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.magFilter = THREE.NearestFilter;

    // Outline material — same technique as v1: SkinnedMesh shells sharing the
    // original skeleton, back-face with normal-offset via onBeforeCompile.
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.BackSide });
    outlineMat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed += normalize(objectNormal) * 0.015;',
      );
    };

    // Hide weapon meshes and apply toon material
    const outlines: THREE.SkinnedMesh[] = [];
    gltf.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.SkinnedMesh)) return;

      // Hide anything parented under a hand-slot bone
      if (isUnderHandslot(obj)) {
        obj.visible = false;
        return;
      }

      obj.frustumCulled = false;
      obj.castShadow = true;
      obj.material = new THREE.MeshToonMaterial({
        map: atlas,
        gradientMap: getGradientMap(),
      });

      // Outline shell for skinned meshes only
      if (obj instanceof THREE.SkinnedMesh) {
        const shell = new THREE.SkinnedMesh(obj.geometry, outlineMat);
        shell.frustumCulled = false;
        shell.castShadow = false;
        shell.bind(obj.skeleton, obj.bindMatrix);
        outlines.push(shell);
      }
    });
    for (const shell of outlines) gltf.scene.add(shell);

    // Scale: normalise to 1.8 m tall
    const inner = new THREE.Group();
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const height = box.max.y - box.min.y;
    inner.scale.setScalar(1.8 / height);
    // KayKit faces +Z; flip so nose points −Z (main.ts convention)
    inner.rotation.y = Math.PI;

    // Mixer + actions
    const mixer = new THREE.AnimationMixer(gltf.scene);

    function requireClip(name: string): THREE.AnimationClip {
      const clip = THREE.AnimationClip.findByName(gltf.animations, name);
      if (!clip) throw new Error(`CharacterAvatar: animation clip "${name}" not found in ${MODEL_URL}`);
      return clip;
    }

    const idleAction = mixer.clipAction(requireClip(CLIPS.idle));
    const walkAction = mixer.clipAction(requireClip(CLIPS.walk));
    const runAction = mixer.clipAction(requireClip(CLIPS.run));
    const jumpStartAction = mixer.clipAction(requireClip(CLIPS.jumpStart));
    const jumpAirAction = mixer.clipAction(requireClip(CLIPS.jumpAir));
    const jumpLandAction = mixer.clipAction(requireClip(CLIPS.jumpLand));

    // One-shots must not loop
    jumpStartAction.setLoop(THREE.LoopOnce, 1);
    jumpStartAction.clampWhenFinished = true;
    jumpLandAction.setLoop(THREE.LoopOnce, 1);
    jumpLandAction.clampWhenFinished = true;

    const actions: CharacterAvatar['actions'] = {
      idle: idleAction,
      walk: walkAction,
      run: runAction,
      jumpStart: jumpStartAction,
      jumpAir: jumpAirAction,
      jumpLand: jumpLandAction,
    };

    const poses = new ProceduralPoses(gltf.scene, BONES);
    const paraglider = new Paraglider();

    return new CharacterAvatar(gltf.scene, gltf.animations, mixer, actions, poses, paraglider, inner);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Fade a looping action toward a target weight. */
  private fadeTo(action: THREE.AnimationAction, weight: number, tau: number, dt: number): void {
    if (!action.isRunning()) action.play();
    action.weight += (weight - action.weight) * Math.min(1, dt / tau);
  }

  /** Trigger a one-shot animation on top of the current layer. */
  private playOnce(action: THREE.AnimationAction, fade: number): void {
    action.reset().setEffectiveWeight(1).fadeIn(fade).play();
  }

  // -------------------------------------------------------------------------
  // Public update
  // -------------------------------------------------------------------------

  update(frameDt: number, player: Player): void {
    const s = player.state;
    const dt = frameDt;

    // Jump start: transition from grounded → airborne with upward velocity
    if (this.prevState === 'grounded' && s === 'airborne' && player.velocityY > 2) {
      this.playOnce(this.actions.jumpStart, 0.06);
    }
    // Landing
    if (this.prevState !== 'grounded' && s === 'grounded') {
      this.playOnce(this.actions.jumpLand, 0.08);
      this.landTimer = 0.25;
    }
    this.landTimer = Math.max(0, this.landTimer - dt);
    this.prevState = s;

    const speed = player.speed;
    const w = { idle: 0, walk: 0, run: 0, jumpAir: 0 };

    if (s === 'grounded') {
      if (this.landTimer > 0 && speed < 1) {
        // let jumpLand play — base layer is silent
      } else if (speed < 0.3) {
        w.idle = 1;
      } else if (speed < 6) {
        w.walk = 1;
        this.actions.walk.timeScale = Math.max(0.6, speed / 5.5);
      } else {
        w.run = 1;
        this.actions.run.timeScale = speed / 9;
      }
    } else {
      // airborne, climbing, gliding — jump-air as base
      w.jumpAir = s === 'climbing' ? 0.25 : 1;
    }

    for (const k of ['idle', 'walk', 'run', 'jumpAir'] as const) {
      this.fadeTo(this.actions[k], w[k], 0.18, dt);
    }

    this.mixer.update(dt);
    this.poses.update(dt, player, this.group.quaternion);
    this.paraglider.update(dt, s === 'gliding');

    // Glide lean
    const targetLean = s === 'gliding' ? 0.55 : 0;
    this.inner.rotation.x += (targetLean - this.inner.rotation.x) * Math.min(1, dt * 8);
  }
}
