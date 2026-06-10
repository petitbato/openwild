import './style.css';
import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';
import { toonMaterial } from './core/toon';

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

const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), toonMaterial(0x4caf50));
scene.add(cube);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const loop = new GameLoop(
  (dt) => { cube.rotation.y += dt; cube.rotation.x += dt * 0.4; },
  () => renderer.render(scene, camera),
);
loop.start();

document.getElementById('loading')!.classList.add('done');
