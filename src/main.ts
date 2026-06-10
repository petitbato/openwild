import './style.css';
import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';
import { generateTerrain } from './world/terrain/heightmap';
import { buildTerrainMesh } from './world/terrain/TerrainMesh';

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
camera.position.set(4, 3, 6);
camera.lookAt(0, 0, 0);

const sun = new THREE.DirectionalLight(0xfff4d6, 2.2);
sun.position.set(50, 80, 30);
sun.castShadow = true;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xbcd8ff, 0.9));

const terrain = generateTerrain(1337);
const terrainMesh = buildTerrainMesh(terrain);
scene.add(terrainMesh);

// temporary fly-over view of the island
camera.position.set(0, 350, 620);
camera.lookAt(0, 0, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let orbit = 0;
const loop = new GameLoop(
  (dt) => {
    orbit += dt * 0.05;
    camera.position.set(Math.sin(orbit) * 620, 350, Math.cos(orbit) * 620);
    camera.lookAt(0, 0, 0);
  },
  () => renderer.render(scene, camera),
);
loop.start();

document.getElementById('loading')!.classList.add('done');
