import * as THREE from 'three';

let gradientMap: THREE.DataTexture | null = null;

export function getGradientMap(): THREE.DataTexture {
  if (!gradientMap) {
    const data = new Uint8Array([80, 160, 255]); // 3-step toon ramp
    gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

export function toonMaterial(
  color: THREE.ColorRepresentation,
  opts: Partial<THREE.MeshToonMaterialParameters> = {},
): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap(), ...opts });
}
