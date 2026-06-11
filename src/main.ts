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
import { Sky } from './world/Sky';
import { Water } from './world/Water';
import type { TerrainData } from './world/terrain/heightmap';
import { scatterProps } from './world/Props';
import { buildLandmarks } from './world/Landmarks';
import { Grass } from './fx/Grass';
import { AudioManager } from './audio/AudioManager';
import { dayWeight } from './audio/Ambience';
import { Campfire } from './world/Campfire';
import { Fireflies } from './fx/Fireflies';
import { Clouds } from './world/Clouds';
import { ShoreFoam } from './world/ShoreFoam';
import { Dust } from './fx/Dust';
import { Birds } from './fx/Birds';

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
  scene.fog = new THREE.Fog(0x9ed7ff, 200, 900);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

  const sky = new Sky();
  sky.addTo(scene);

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
  scatterProps(scene, physics, terrain);
  const { ruins } = buildLandmarks(scene, physics, terrain);
  const campfire = new Campfire(ruins[0]);
  scene.add(campfire.group);
  const fireflies = new Fireflies(ruins);
  scene.add(fireflies.points);

  const input = new Input(renderer.domElement);
  const player = new Player(physics, findSpawn(terrain));
  const cam = new ThirdPersonCamera(camera, physics, player.collider);

  const staminaWheel = new StaminaWheel(document.getElementById('hud')!);
  const windStreaks = new WindStreaks();
  scene.add(windStreaks.group);

  const water = new Water();
  scene.add(water.mesh);

  const grass = new Grass(terrain);
  scene.add(grass.mesh);

  const clouds = new Clouds();
  scene.add(clouds.group);

  const foam = new ShoreFoam(terrain);
  scene.add(foam.mesh);

  const audio = new AudioManager();
  window.addEventListener('pointerdown', () => audio.init(), { once: true });
  window.addEventListener('keydown', () => audio.init(), { once: true });

  const dust = new Dust();
  scene.add(dust.mesh);

  const birds = new Birds(() => audio.birdCry());
  scene.add(birds.group);

  const fill = document.getElementById('loading-fill') as HTMLDivElement;
  const avatarModel = await CharacterAvatar.load('/assets/character.glb', (f) => {
    fill.style.width = `${Math.round(f * 100)}%`;
  });
  const avatar = avatarModel.group;
  scene.add(avatar);

  let prevAirborne = false;
  let prevVy = 0;
  let sprintDustTimer = 0;

  let respawning = false;
  function respawn() {
    if (respawning) return;
    respawning = true;
    const fade = document.getElementById('fade')!;
    fade.style.opacity = '1';
    setTimeout(() => {
      player.teleport(player.lastGroundedPos.clone().add(new THREE.Vector3(0, 0.5, 0)));
      fade.style.opacity = '0';
      setTimeout(() => { respawning = false; }, 600);
    }, 400);
  }

  const loop = new GameLoop(
    (dt) => {
      input.poll();
      player.update(dt, input.actions, cam.yaw);
      water.update(dt);
      const groundBelow = terrain.heightAt(player.position.x, player.position.z);
      const feetY = player.position.y - (Player.HALF_HEIGHT + Player.RADIUS);
      if (player.position.y < -30) respawn();                       // fell through world
      else if (groundBelow < -1.5 && feetY < 0.2) respawn();        // deep water = drown
      physics.step();
      const fovBoost = player.state === 'gliding' ? 12 : player.sprinting ? 6 : 0;
      cam.update(dt, input.actions.look, player.position, fovBoost);
      staminaWheel.update(player.stamina);
      windStreaks.update(dt, player.state === 'gliding', player.position, player.worldVelocity);
      sky.update(dt, scene, camera.position, player.position);
      if (input.heldKeys.has('KeyT')) sky.time01 = (sky.time01 + dt * 0.02) % 1;
      grass.update(dt, player.position);
      clouds.update(dt);
      foam.update(dt);

      // Dust triggers
      const feetPos = player.position.clone();
      feetPos.y -= Player.HALF_HEIGHT + Player.RADIUS;
      const isAirborne = player.state === 'airborne' || player.state === 'gliding' || player.state === 'climbing';
      if (prevAirborne && !isAirborne && prevVy < -8) {
        dust.burst(feetPos, 10, 2.2);
      }
      if (player.state === 'grounded' && player.sprinting) {
        sprintDustTimer -= dt;
        if (sprintDustTimer <= 0) {
          dust.burst(feetPos, 2, 0.8);
          sprintDustTimer = 0.15;
        }
      } else {
        sprintDustTimer = 0;
      }
      prevAirborne = isAirborne;
      prevVy = player.velocityY;

      const dayW = dayWeight(sky.time01);
      const nightW = 1 - dayW;
      dust.update(dt, camera);
      birds.update(dt, dayW);
      campfire.update(dt, nightW);
      fireflies.update(dt, nightW);
      audio.update(dt, player.state, player.speed, sky.time01, groundBelow);
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
    player, input, cam, terrain, physics, RAPIER, renderer, scene, camera, avatarModel, avatar, sky, water, audio, campfire, fireflies, clouds, foam, dust, birds,
  };

  document.getElementById('loading')!.classList.add('done');
}

boot().catch((e) => {
  const err = document.getElementById('loading-error')!;
  err.hidden = false;
  err.textContent = String(e);
});
