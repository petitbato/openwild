const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * 1 in full day, 0 at night.
 *
 * Band edges match daynight.ts KEYS (lines 33-37):
 *   DAWN start:  t=0.26, DAY full:  t=0.35  => rise from 0.26 to 0.35
 *   DAY full:    t=0.65, DUSK done: t=0.77  => fall from 0.65 to 0.77
 * (draft used 0.22/0.32/0.68/0.78 — adjusted to the actual KEYS values)
 */
export function dayWeight(time01: number): number {
  return smooth(0.26, 0.35, time01) * (1 - smooth(0.65, 0.77, time01));
}

export class Ambience {
  private cricketGain: GainNode;
  private birdTimer = 3;
  private doubleChirpIn = -1; // seconds until the echo chirp; <0 = none pending
  constructor(private ctx: AudioContext, private dest: AudioNode) {
    // Cricket bed: 4.2kHz sine, tremolo via LFO -> gain, mastered by night weight.
    const osc = ctx.createOscillator(); osc.frequency.value = 4200; osc.type = 'sine';
    const trem = ctx.createGain(); trem.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 26;
    const lfoAmp = ctx.createGain(); lfoAmp.gain.value = 0.5;
    lfo.connect(lfoAmp); lfoAmp.connect(trem.gain);
    this.cricketGain = ctx.createGain(); this.cricketGain.gain.value = 0;
    osc.connect(trem); trem.connect(this.cricketGain); this.cricketGain.connect(dest);
    osc.start(); lfo.start();
  }

  chirp(freqBase = 2800, delay = 0): void {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(freqBase, t);
    osc.frequency.linearRampToValueAtTime(freqBase * 3400 / 2800, t + 0.07);
    osc.frequency.linearRampToValueAtTime(freqBase * 2500 / 2800, t + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.02);
    g.gain.setTargetAtTime(0, t + 0.1, 0.05);
    const pan = this.ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
    osc.connect(g); g.connect(pan); pan.connect(this.dest);
    osc.start(t); osc.stop(t + 0.4);
    osc.onended = () => { osc.disconnect(); g.disconnect(); pan.disconnect(); };
  }

  update(dt: number, time01: number): void {
    const day = dayWeight(time01);
    this.cricketGain.gain.setTargetAtTime((1 - day) * 0.028, this.ctx.currentTime, 0.8);
    if (this.doubleChirpIn >= 0) {
      this.doubleChirpIn -= dt;
      if (this.doubleChirpIn < 0) this.chirp(); // echo of a double chirp
    }
    this.birdTimer -= dt;
    if (this.birdTimer <= 0 && day > 0.4 && Math.random() < day) {
      this.chirp();
      if (Math.random() < 0.5) this.doubleChirpIn = 0.14;
      this.birdTimer = 2 + Math.random() * 7;
    } else if (this.birdTimer <= 0) {
      this.birdTimer = 1.5;
    }
  }
}
