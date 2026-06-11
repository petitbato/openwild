import { readFileSync } from 'node:fs';

const path = process.argv[2];
const buf = readFileSync(path);
let json;
if (path.endsWith('.glb')) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('First chunk is not JSON');
  json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
} else {
  json = JSON.parse(buf.toString('utf8'));
}
console.log('== Animations ==');
for (const a of json.animations ?? []) console.log(' ', a.name);
console.log('== Skin joints (bones) ==');
const joints = json.skins?.[0]?.joints ?? [];
for (const j of joints) console.log(' ', json.nodes[j].name);
console.log('== Images ==');
for (const im of json.images ?? []) console.log(' ', im.uri ?? im.mimeType);
console.log('== Meshes ==');
for (const m of json.meshes ?? []) console.log(' ', m.name);
