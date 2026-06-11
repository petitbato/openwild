// 1) `node tools/recolor-atlas.mjs --histogram <src.png>` prints the top 24 colors.
// 2) Fill REMAP below with the Rogue garment swatches you identified,
// 3) `node tools/recolor-atlas.mjs <src.png>` writes public/assets/character-atlas.png
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const TUNIC_BLUE = [74, 127, 181];
const TUNIC_BLUE_DARK = [52, 92, 138];
const ACCENT_LIGHT = [139, 180, 216];

// FILL after running --histogram: source garment colors with per-entry tolerance.
// Rogue garment = the green family (hood/cloak/tunic). Browns are leather
// (kept), light peach ramps are skin (avoided). First matching entry wins.
const REMAP = [
  { from: [15, 131, 69], to: TUNIC_BLUE, tol: 55 },     // main green: flat 15,131,69 + emerald ramps (0,89..175,74..93 / 6..9,89..143,78..109)
  { from: [80, 178, 110], to: TUNIC_BLUE, tol: 55 },    // mid section of yellow-green->teal garment gradient
  { from: [34, 137, 147], to: TUNIC_BLUE, tol: 45 },    // teal end of garment gradient (34..46,137..147,138..147)
  { from: [160, 205, 90], to: ACCENT_LIGHT, tol: 55 },  // light yellow-green accent (196,217,83 .. ~115,191,100)
  { from: [10, 70, 67], to: TUNIC_BLUE_DARK, tol: 40 }, // dark green shadow ramp (9..11,53..88,58..78)
];

const src = process.argv.includes('--histogram') ? process.argv[3] : process.argv[2];
const png = PNG.sync.read(readFileSync(src));

if (process.argv.includes('--histogram')) {
  const counts = new Map();
  for (let i = 0; i < png.data.length; i += 4) {
    const key = `${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  for (const [k, n] of top) console.log(k.padEnd(15), n);
  process.exit(0);
}

if (REMAP.length === 0) throw new Error('Fill REMAP first (run --histogram).');
const d2 = (a, p, i) => (a[0] - p[i]) ** 2 + (a[1] - p[i + 1]) ** 2 + (a[2] - p[i + 2]) ** 2;
let changed = 0;
const perEntry = REMAP.map(() => 0);
for (let i = 0; i < png.data.length; i += 4) {
  for (let e = 0; e < REMAP.length; e++) {
    const { from, to, tol } = REMAP[e];
    if (d2(from, png.data, i) <= tol * tol) {
      const lum = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / (from[0] + from[1] + from[2]);
      png.data[i] = Math.min(255, to[0] * lum);
      png.data[i + 1] = Math.min(255, to[1] * lum);
      png.data[i + 2] = Math.min(255, to[2] * lum);
      changed++;
      perEntry[e]++;
      break;
    }
  }
}
writeFileSync('public/assets/character-atlas.png', PNG.sync.write(png));
for (let e = 0; e < REMAP.length; e++) {
  console.log(`  entry ${e} [${REMAP[e].from}] -> [${REMAP[e].to}] tol ${REMAP[e].tol}: ${perEntry[e]} px`);
}
console.log(`Recolored ${changed} px -> public/assets/character-atlas.png`);
