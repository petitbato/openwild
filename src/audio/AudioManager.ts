import type { PlayerState } from '../player/Player';
import { Music } from './Music';
import { Ambience, dayWeight } from './Ambience';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private grassGain!: GainNode;
  private waveGain!: GainNode;
  private stepBpFreq = 700;
  private stepTimer = 0;
  private music: Music | null = null;
  private ambience: Ambience | null = null;

  /** Looping white noise -> bandpass -> gain(0) -> master. Returns the gain for level control. */
  private startNoiseLoop(ctx: AudioContext, freq: number, q: number): GainNode {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(bp).connect(gain).connect(this.master);
    src.start();
    return gain;
  }

  /** Call from a user-gesture handler (browser autoplay policy). Idempotent. */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);

    // Looping beds: wind, grass rustle, shore waves (filtered white noise)
    this.windGain = this.startNoiseLoop(this.ctx, 500, 0.5);
    this.grassGain = this.startNoiseLoop(this.ctx, 1100, 0.8);
    this.waveGain = this.startNoiseLoop(this.ctx, 380, 0.6);

    // Waves get a slow swell: 0.08 Hz LFO into the wave gain
    const waveLfo = this.ctx.createOscillator();
    waveLfo.frequency.value = 0.08;
    const waveLfoAmp = this.ctx.createGain();
    waveLfoAmp.gain.value = 0.012;
    waveLfo.connect(waveLfoAmp); waveLfoAmp.connect(this.waveGain.gain);
    waveLfo.start();

    // Composed music and day/night ambience
    this.music = new Music(this.ctx, this.master);
    this.ambience = new Ambience(this.ctx, this.master);
  }

  birdCry(): void {
    if (!this.ambience) return;
    this.ambience.chirp(1900);
    this.ambience.chirp(1900, 0.18);
  }

  private footstep(intensity: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.05);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = this.stepBpFreq + Math.random() * 250;
    const g = this.ctx.createGain();
    g.gain.value = 0.1 * intensity;
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }

  update(dt: number, state: PlayerState, speed: number, time01: number, terrainH: number): void {
    if (!this.ctx) return;

    // Wind
    const windTarget =
      state === 'gliding' ? 0.5 : state === 'airborne' ? 0.15 : Math.min(0.05, speed * 0.005);
    this.windGain.gain.setTargetAtTime(windTarget, this.ctx.currentTime, 0.4);

    // Footsteps — vary bandpass center by terrain height (sand vs grass)
    this.stepBpFreq = terrainH < 2.5 ? 360 : 700;
    if (state === 'grounded' && speed > 0.5) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.footstep(Math.min(1, speed / 9));
        this.stepTimer = 2.6 / speed;
      }
    } else {
      this.stepTimer = 0;
    }

    // Grass rustle
    const grassTarget =
      state === 'grounded' && terrainH > 2.5 && terrainH < 45
        ? Math.min(0.05, speed * 0.006)
        : 0;
    this.grassGain.gain.setTargetAtTime(grassTarget, this.ctx.currentTime, 0.3);

    // Shore waves
    const waveTarget = terrainH < 3 ? 0.05 * (1 - Math.max(0, terrainH) / 3) : 0;
    this.waveGain.gain.setTargetAtTime(waveTarget, this.ctx.currentTime, 0.6);

    // Music and ambience
    if (this.music) this.music.update(dt, dayWeight(time01) > 0.5);
    if (this.ambience) this.ambience.update(dt, time01);
  }
}
