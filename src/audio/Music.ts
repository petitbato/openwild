export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** [midi, timeSec, velocity 0..1] */
export type Motif = ReadonlyArray<readonly [number, number, number]>;

export const DAY_MOTIFS: Motif[] = [
  [[76, 0, 0.55], [79, 0.75, 0.4], [81, 1.5, 0.45], [76, 3, 0.35], [74, 4.5, 0.5], [72, 6, 0.4]],
  [[72, 0, 0.5], [76, 1, 0.4], [79, 2, 0.45], [84, 3.5, 0.55], [81, 5, 0.35], [79, 6.5, 0.3]],
  [[67, 0, 0.45], [72, 0.75, 0.5], [74, 2, 0.35], [76, 2.75, 0.5], [72, 4.5, 0.4]],
];
export const NIGHT_MOTIFS: Motif[] = [
  [[57, 0, 0.45], [60, 1.5, 0.35], [64, 3, 0.4], [62, 5, 0.3]],
  [[55, 0, 0.4], [62, 2, 0.45], [60, 4, 0.3], [57, 6, 0.35]],
  [[64, 0, 0.35], [60, 1, 0.3], [57, 2.5, 0.4], [52, 5, 0.45]],
];

export class MotifScheduler {
  nextAt = 0;
  private last: Motif | null = null;
  constructor(private rng: () => number = Math.random) {}
  /** Returns a motif to start now, or null. Call with current music-time (s). */
  next(t: number, isDay: boolean): Motif | null {
    if (t < this.nextAt) return null;
    const set = isDay ? DAY_MOTIFS : NIGHT_MOTIFS;
    let pick = set[Math.floor(this.rng() * set.length)];
    if (pick === this.last) pick = set[(set.indexOf(pick) + 1) % set.length];
    this.last = pick;
    this.nextAt = t + 20 + this.rng() * 25;
    return pick;
  }
}

/** Piano-ish voice + generated-IR reverb. Constructed lazily after user gesture. */
export class Music {
  private convolver: ConvolverNode;
  private out: GainNode;
  private scheduler = new MotifScheduler();
  private t = 0;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.5;
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = Music.impulseResponse(ctx, 2.5);
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    const dry = ctx.createGain(); dry.gain.value = 0.8;
    this.out.connect(dry); dry.connect(dest);
    this.out.connect(this.convolver); this.convolver.connect(wet); wet.connect(dest);
  }

  static impulseResponse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      // Decay exponent = -3 * t (t in seconds): tail ≈ e^-7.5 ≈ 0.06% at the
      // buffer end, so `seconds` sets both the length and the audible decay.
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-3 * (i / len) * seconds);
    }
    return buf;
  }

  /** One piano-like note: detuned sine partials with per-partial decay. */
  note(midi: number, vel: number, when: number): void {
    const f0 = midiToHz(midi);
    const partials = [1, 2.003, 3.01, 4.2];
    const gains = [1, 0.45, 0.22, 0.08];
    for (let i = 0; i < partials.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f0 * partials[i];
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vel * gains[i] * 0.16, when + 0.008);
      g.gain.setTargetAtTime(0, when + 0.01, 1.1 / (i + 1));
      osc.connect(g); g.connect(this.out);
      osc.start(when); osc.stop(when + 4);
      osc.onended = () => { g.disconnect(); osc.disconnect(); };
    }
  }

  update(dt: number, isDay: boolean): void {
    this.t += dt;
    const motif = this.scheduler.next(this.t, isDay);
    if (motif) {
      const base = this.ctx.currentTime + 0.05;
      for (const [m, t, v] of motif) {
        this.note(m, v, base + t + (Math.random() - 0.5) * 0.06); // ±30ms humanize
      }
    }
  }
}
