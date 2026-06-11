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

  /** Call from a user-gesture handler (browser autoplay policy). Idempotent. */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);

    // looping wind: filtered white noise
    const len = this.ctx.sampleRate * 2;
    const windBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const windData = windBuf.getChannelData(0);
    for (let i = 0; i < len; i++) windData[i] = Math.random() * 2 - 1;
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = windBuf;
    windSrc.loop = true;
    const windBp = this.ctx.createBiquadFilter();
    windBp.type = 'bandpass';
    windBp.frequency.value = 500;
    windBp.Q.value = 0.5;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(windBp).connect(this.windGain).connect(this.master);
    windSrc.start();

    // Terrain loop: grass rustle (noise -> bandpass 1100 Hz Q 0.8)
    const grassBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const grassData = grassBuf.getChannelData(0);
    for (let i = 0; i < len; i++) grassData[i] = Math.random() * 2 - 1;
    const grassSrc = this.ctx.createBufferSource();
    grassSrc.buffer = grassBuf;
    grassSrc.loop = true;
    const grassBp = this.ctx.createBiquadFilter();
    grassBp.type = 'bandpass';
    grassBp.frequency.value = 1100;
    grassBp.Q.value = 0.8;
    this.grassGain = this.ctx.createGain();
    this.grassGain.gain.value = 0;
    grassSrc.connect(grassBp).connect(this.grassGain).connect(this.master);
    grassSrc.start();

    // Terrain loop: shore waves (noise -> bandpass 380 Hz Q 0.6 + 0.08 Hz LFO modulation)
    const waveBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const waveData = waveBuf.getChannelData(0);
    for (let i = 0; i < len; i++) waveData[i] = Math.random() * 2 - 1;
    const waveSrc = this.ctx.createBufferSource();
    waveSrc.buffer = waveBuf;
    waveSrc.loop = true;
    const waveBp = this.ctx.createBiquadFilter();
    waveBp.type = 'bandpass';
    waveBp.frequency.value = 380;
    waveBp.Q.value = 0.6;
    this.waveGain = this.ctx.createGain();
    this.waveGain.gain.value = 0;
    const waveLfo = this.ctx.createOscillator();
    waveLfo.frequency.value = 0.08;
    const waveLfoAmp = this.ctx.createGain();
    waveLfoAmp.gain.value = 0.012;
    waveLfo.connect(waveLfoAmp); waveLfoAmp.connect(this.waveGain.gain);
    waveSrc.connect(waveBp).connect(this.waveGain).connect(this.master);
    waveSrc.start();
    waveLfo.start();

    // Composed music and day/night ambience
    this.music = new Music(this.ctx, this.master);
    this.ambience = new Ambience(this.ctx, this.master);
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
