// Shallow-clones the CC0 KayKit Adventurers pack and copies the Rogue model
// (glTF/GLB + textures) into public/assets/.
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const REPO = 'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
const tmp = mkdtempSync(join(tmpdir(), 'kaykit-'));
execSync(`git clone --depth 1 ${REPO} "${tmp}"`, { stdio: 'inherit' });

function find(dir, pred, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) find(p, pred, out);
    else if (pred(name.toLowerCase())) out.push(p);
  }
  return out;
}

const models = find(tmp, (n) => n.includes('rogue') && (n.endsWith('.glb') || n.endsWith('.gltf')));
const textures = find(tmp, (n) => n.endsWith('.png') && (n.includes('atlas') || n.includes('texture') || n.includes('skin')));
console.log('Rogue models found:\n' + models.join('\n'));
console.log('Textures found:\n' + textures.slice(0, 20).join('\n'));
if (models.length === 0) throw new Error('No Rogue model found — list the repo tree and adjust the predicate.');

// Prefer .glb (self-contained). If only .gltf exists, copy it AND its sibling
// .bin/textures from the same directory so relative URIs keep working.
// Among .glb variants, prefer the hooded Rogue (most Link-like).
const glbs = models.filter((m) => m.endsWith('.glb'));
const glb = glbs.find((m) => m.toLowerCase().includes('hooded')) ?? glbs[0];
if (glb) {
  cpSync(glb, 'public/assets/character.glb');
  console.log('Copied', glb, '-> public/assets/character.glb');
  // Copy the Rogue's source atlas next to the tools for the recolor step.
  const atlas = textures.find((t) => t.toLowerCase().includes('rogue'));
  if (atlas) {
    cpSync(atlas, 'tools/rogue_texture.png');
    console.log('Copied', atlas, '-> tools/rogue_texture.png');
  }
} else {
  const gltf = models[0];
  const dir = dirname(gltf);
  cpSync(dir, 'public/assets/kaykit', { recursive: true });
  console.log('Copied dir', dir, '-> public/assets/kaykit/');
}
