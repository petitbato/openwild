import './style.css';
import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';
import { generateTerrain } from './world/terrain/heightmap';
import { buildTerrainMesh } from './world/terrain/TerrainMesh';
import { Physics, RAPIER } from './physics/Physics';
import { Input } from './core/Input';
import { Player } from './player/Player';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera';
import { StaminaWheel } from './ui/StaminaWheel';
import { WindStreaks } from './fx/WindStreaks';
import { CharacterAvatar } from './player/CharacterAvatar';
import type { TerrainData } from './world/terrain/heightmap';

function findSpawn(terrain: TerrainData): THREE.Vector3 {
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    for (let rad = 480; rad > 100; rad -= 4) {
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const h = terrain.heightAt(x, z);
      if (h > 0.5 && h < 2 && terrain.normalAt(x, z).y > 0.95) {
        return new THREE.Vector3(x, h + 1.5, z);
      }
    }
  }
  return new THREE.Vector3(0, terrain.heightAt(0, 0) + 1.5, 0);
}

function shortestAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app')!.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ed7ff);
  scene.fog = new THREE.Fog(0x9ed7ff, 200, 900);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

  const sun = new THREE.DirectionalLight(0xfff4d6, 2.2);
  sun.position.set(50, 80, 30);
  sun.castShadow = true;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbcd8ff, 0.9));

  const terrain = generateTerrain(1337);
  const terrainMesh = buildTerrainMesh(terrain);
  scene.add(terrainMesh);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const physics = await Physics.create();
  physics.addStaticMesh(terrainMesh);

  const input = new Input(renderer.domElement);
  const player = new Player(physics, findSpawn(terrain));
  const cam = new ThirdPersonCamera(camera, physics, player.collider);

  const staminaWheel = new StaminaWheel(document.getElementById('hud')!);
  const windStreaks = new WindStreaks();
  scene.add(windStreaks.group);

  const fill = document.getElementById('loading-fill') as HTMLDivElement;
  const avatarModel = await CharacterAvatar.load('/assets/character.glb', (f) => {
    fill.style.width = `${Math.round(f * 100)}%`;
  });
  const avatar = avatarModel.group;
  scene.add(avatar);

  const loop = new GameLoop(
    (dt) => {
      input.poll();
      player.update(dt, input.actions, cam.yaw);
      physics.step();
      const fovBoost = player.state === 'gliding' ? 12 : player.sprinting ? 6 : 0;
      cam.update(dt, input.actions.look, player.position, fovBoost);
      staminaWheel.update(player.stamina);
      windStreaks.update(dt, player.state === 'gliding', player.position, player.worldVelocity);
    },
    (_alpha, frameDt) => {
      avatar.position.copy(player.position);
      avatar.position.y -= Player.HALF_HEIGHT + Player.RADIUS; // body center -> feet
      // nose points -z at yaw 0, so face along `facing` with atan2 of the negated vector
      const targetYaw = Math.atan2(-player.facing.x, -player.facing.z);
      avatar.rotation.y += shortestAngle(targetYaw - avatar.rotation.y) * (1 - Math.pow(0.75, frameDt * 60));
      avatarModel.update(frameDt, player);
      renderer.render(scene, camera);
    },
  );
  loop.start();

  (window as unknown as Record<string, unknown>).__debug = {
    player, input, cam, terrain, physics, RAPIER, renderer, scene, camera, avatarModel, avatar,
  };

  document.getElementById('loading')!.classList.add('done');
}

boot().catch((e) => {
  const err = document.getElementById('loading-error')!;
  err.hidden = false;
  err.textContent = String(e);
});
