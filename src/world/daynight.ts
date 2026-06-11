export interface Palette {
  top: [number, number, number];
  horizon: [number, number, number];
  fog: [number, number, number];
  sunColor: [number, number, number];
  sunIntensity: number;
  ambient: number;
  stars: number; // 0..1 star opacity
}

type RGB = [number, number, number];
const rgb = (hex: number): RGB => [
  ((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255,
];

const NIGHT: Palette = {
  top: rgb(0x0b1026), horizon: rgb(0x1a2440), fog: rgb(0x141d35),
  sunColor: rgb(0x9db4ff), sunIntensity: 0, ambient: 0.28, stars: 1,
};
const DAWN: Palette = {
  top: rgb(0x35487f), horizon: rgb(0xff9d5c), fog: rgb(0xc98a6a),
  sunColor: rgb(0xffc187), sunIntensity: 0.7, ambient: 0.5, stars: 0.15,
};
const DAY: Palette = {
  top: rgb(0x57b5ff), horizon: rgb(0xc3e7ff), fog: rgb(0xa8d8ff),
  sunColor: rgb(0xfff4d6), sunIntensity: 2.2, ambient: 0.9, stars: 0,
};
const DUSK: Palette = {
  top: rgb(0x3b3a73), horizon: rgb(0xff8e4f), fog: rgb(0xd39a72),
  sunColor: rgb(0xffb36b), sunIntensity: 0.5, ambient: 0.45, stars: 0.15,
};

const KEYS: { t: number; p: Palette }[] = [
  { t: 0.0, p: NIGHT }, { t: 0.2, p: NIGHT }, { t: 0.26, p: DAWN },
  { t: 0.35, p: DAY }, { t: 0.65, p: DAY }, { t: 0.77, p: DUSK },
  { t: 0.85, p: NIGHT }, { t: 1.0, p: NIGHT },
];

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const lerpRGB = (a: RGB, b: RGB, f: number): RGB => [
  lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f),
];

export function paletteAt(t: number): Palette {
  const tt = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= tt) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const f = b.t === a.t ? 0 : (tt - a.t) / (b.t - a.t);
  return {
    top: lerpRGB(a.p.top, b.p.top, f),
    horizon: lerpRGB(a.p.horizon, b.p.horizon, f),
    fog: lerpRGB(a.p.fog, b.p.fog, f),
    sunColor: lerpRGB(a.p.sunColor, b.p.sunColor, f),
    sunIntensity: lerp(a.p.sunIntensity, b.p.sunIntensity, f),
    ambient: lerp(a.p.ambient, b.p.ambient, f),
    stars: lerp(a.p.stars, b.p.stars, f),
  };
}

/** Sun elevation angle: sunrise t=0.25, noon t=0.5, sunset t=0.75. */
export function sunAngle(t: number): number {
  return (t - 0.25) * Math.PI * 2;
}
