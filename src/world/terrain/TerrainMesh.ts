import * as THREE from 'three';
import { getGradientMap } from '../../core/toon';
import type { TerrainData } from './heightmap';

const SAND = new THREE.Color(0xd9c38a);
const GRASS = new THREE.Color(0x6ab04c);
const ROCK = new THREE.Color(0x8d8d93);
const SNOW = new THREE.Color(0xf2f5fa);

export function colorForVertex(height: number, slopeY: number): THREE.Color {
  // slopeY = normal.y (1 flat, 0 vertical)
  if (slopeY < 0.55) return ROCK.clone();
  if (height < 2.5) return SAND.clone();
  if (height > 75) return SNOW.clone();
  if (height > 55) return ROCK.clone().lerp(SNOW, (height - 55) / 20);
  return GRASS.clone().lerp(ROCK, Math.max(0, (height - 35) / 20));
}

export function buildTerrainMesh(terrain: TerrainData): THREE.Mesh {
  const r = terrain.resolution;
  const geo = new THREE.PlaneGeometry(terrain.size, terrain.size, r - 1, r - 1);
  geo.rotateX(-Math.PI / 2); // plane is XY by default; make it XZ with +Y up

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrain.heightAt(x, z);
    pos.setY(i, h);
    const n = terrain.normalAt(x, z);
    const c = colorForVertex(h, n.y);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradientMap() });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
