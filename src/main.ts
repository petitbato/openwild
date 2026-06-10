import './style.css';
import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';
import { generateTerrain } from './world/terrain/heightmap';
import { buildTerrainMesh } from './world/terrain/TerrainMesh';
import { toonMaterial } from './core/toon';
import { Physics } from './physics/Physics';
import { Input } from './core/Input';
import { Player } from './player/Player';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera';
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

  const avatar = new THREE.Group();
  const capsuleMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(Player.RADIUS, Player.HALF_HEIGHT * 2, 4, 12),
    toonMaterial(0x3aa0c9),
  );
  capsuleMesh.castShadow = true;
  capsuleMesh.position.y = Player.HALF_HEIGHT + Player.RADIUS;
  avatar.add(capsuleMesh);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), toonMaterial(0xffc107));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.4, -0.4);
  avatar.add(nose); // facing indicator
  scene.add(avatar);

  const loop = new GameLoop(
    (dt) => {
      input.poll();
      player.update(dt, input.actions, cam.yaw);
      physics.step();
      const fovBoost = player.state === 'gliding' ? 12 : player.sprinting ? 6 : 0;
      cam.update(dt, input.actions.look, player.position, fovBoost);
    },
    () => {
      avatar.position.copy(player.position);
      avatar.position.y -= Player.HALF_HEIGHT + Player.RADIUS; // body center -> feet
      // nose points -z at yaw 0, so face along `facing` with atan2 of the negated vector
      const targetYaw = Math.atan2(-player.facing.x, -player.facing.z);
      avatar.rotation.y += shortestAngle(targetYaw - avatar.rotation.y) * 0.25;
      renderer.render(scene, camera);
    },
  );
  loop.start();

  (window as unknown as Record<string, unknown>).__debug = { player, input, cam };

  document.getElementById('loading')!.classList.add('done');
}

boot().catch((e) => {
  const err = document.getElementById('loading-error')!;
  err.hidden = false;
  err.textContent = String(e);
});
