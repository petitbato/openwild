import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getGradientMap } from '../core/toon';
import type { Player } from './Player';

export class CharacterAvatar {
  readonly group = new THREE.Group();   // feet at origin, faces -Z after inner flip
  private inner = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';

  private constructor(model: THREE.Group, clips: THREE.AnimationClip[]) {
    this.inner.add(model);
    this.group.add(this.inner);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.play('Idle');
  }

  static async load(url: string, onProgress?: (f: number) => void): Promise<CharacterAvatar> {
    const gltf = await new GLTFLoader().loadAsync(url, (e) => {
      if (onProgress && e.total > 0) onProgress(e.loaded / e.total);
    });
    const model = gltf.scene;

    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.BackSide });
    outlineMat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed += normalize(objectNormal) * 0.015;',
      );
    };

    const outlines: THREE.SkinnedMesh[] = [];
    model.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) {
        obj.frustumCulled = false;
        obj.castShadow = true;
        const src = obj.material as THREE.MeshStandardMaterial;
        obj.material = new THREE.MeshToonMaterial({
          color: src.color, map: src.map ?? null, gradientMap: getGradientMap(),
        });
        const shell = new THREE.SkinnedMesh(obj.geometry, outlineMat);
        shell.frustumCulled = false;
        shell.bind(obj.skeleton, obj.bindMatrix);
        outlines.push(shell);
      }
    });
    for (const shell of outlines) model.add(shell); // same skeleton drives the shells

    return new CharacterAvatar(model, gltf.animations);
  }

  private play(name: string, fade = 0.18): void {
    if (this.current === name || !this.actions.has(name)) return;
    const next = this.actions.get(name)!;
    next.reset().fadeIn(fade).play();
    const prev = this.actions.get(this.current);
    if (prev) prev.fadeOut(fade);
    this.current = name;
  }

  update(dt: number, player: Player): void {
    let clip = 'Idle';
    let timeScale = 1;
    let lean = 0;

    switch (player.state) {
      case 'grounded':
        if (player.speed < 0.2) clip = 'Idle';
        else if (player.speed < 6.5) { clip = 'Walk'; timeScale = THREE.MathUtils.clamp(player.speed / 3.5, 0.7, 1.8); }
        else { clip = 'Run'; timeScale = player.speed / 7; }
        break;
      case 'airborne':
        clip = 'Idle'; timeScale = 0.4;
        break;
      case 'climbing':
        clip = 'Walk'; timeScale = THREE.MathUtils.clamp(player.speed / 1.5, 0, 2);
        break;
      case 'gliding':
        clip = 'Run'; timeScale = 0.15; // slow flutter
        lean = 0.55;                    // lean forward under the glider
        break;
    }

    this.play(clip);
    const action = this.actions.get(this.current);
    if (action) action.timeScale = timeScale;
    this.inner.rotation.x += (lean - this.inner.rotation.x) * Math.min(1, dt * 8);
    this.mixer.update(dt);
  }
}
