import * as THREE from 'three';
import { paletteAt, sunAngle } from './daynight';

const CYCLE_SECONDS = 600; // 10-minute full day

export class Sky {
  readonly group = new THREE.Group(); // re-centered on the camera every frame
  readonly sun = new THREE.DirectionalLight(0xffffff, 2);
  readonly ambient = new THREE.AmbientLight(0xbcd8ff, 0.9);
  time01 = 0.35; // start mid-morning

  private domeMat: THREE.ShaderMaterial;
  private starsMat: THREE.PointsMaterial;

  constructor() {
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x57b5ff) },
        horizonColor: { value: new THREE.Color(0xc3e7ff) },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunGlow: { value: 1 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 horizonColor;
        uniform vec3 sunDir; uniform float sunGlow;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
          float s = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 350.0);
          col += vec3(1.0, 0.9, 0.7) * s * sunGlow;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), this.domeMat);
    dome.renderOrder = -10;
    this.group.add(dome);

    const starPos = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.95 + 0.05;
      v.normalize().multiplyScalar(1100);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false,
    });
    const stars = new THREE.Points(starGeo, this.starsMat);
    stars.renderOrder = -9;
    this.group.add(stars);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.far = 400;
    this.sun.shadow.bias = -0.0005;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.group, this.sun, this.sun.target, this.ambient);
  }

  update(dt: number, scene: THREE.Scene, cameraPos: THREE.Vector3, playerPos: THREE.Vector3): void {
    this.time01 = (this.time01 + dt / CYCLE_SECONDS) % 1;
    const p = paletteAt(this.time01);
    const ang = sunAngle(this.time01);
    const dir = new THREE.Vector3(Math.cos(ang) * 0.45, Math.sin(ang), 0.35).normalize();

    this.group.position.copy(cameraPos);
    this.domeMat.uniforms.topColor.value.setRGB(...p.top);
    this.domeMat.uniforms.horizonColor.value.setRGB(...p.horizon);
    this.domeMat.uniforms.sunDir.value.copy(dir);
    this.domeMat.uniforms.sunGlow.value = p.sunIntensity > 0 ? 1 : 0;
    this.starsMat.opacity = p.stars;

    const isNight = dir.y < -0.05;
    const lightDir = isNight ? dir.clone().multiplyScalar(-1) : dir; // moonlight from mirrored sun
    this.sun.position.copy(playerPos).addScaledVector(lightDir, 150);
    this.sun.target.position.copy(playerPos);
    this.sun.intensity = isNight ? 0.25 : Math.max(0.05, p.sunIntensity);
    const sunColor: [number, number, number] = isNight ? [0.62, 0.71, 1] : p.sunColor;
    this.sun.color.setRGB(...sunColor);
    this.ambient.intensity = p.ambient;

    (scene.fog as THREE.Fog).color.setRGB(...(p.fog as [number, number, number]));
  }
}
