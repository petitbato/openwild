import type { PlayerState } from '../player/Player';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private stepTimer = 0;

  /** Call from a user-gesture handler (browser autoplay policy). Idempotent. */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);

    // looping wind: filtered white noise
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.5;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(bp).connect(this.windGain).connect(this.master);
    src.start();

    this.scheduleAmbientNote();
  }

  private scheduleAmbientNote(): void {
    setTimeout(() => {
      this.playPianoPhrase();
      this.scheduleAmbientNote();
    }, 8000 + Math.random() * 14000);
  }

  /** 1-3 sparse pentatonic notes, BoTW-style. */
  private playPianoPhrase(): void {
    if (!this.ctx) return;
    const notes = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3];
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const t = this.ctx.currentTime + i * (0.4 + Math.random() * 0.35);
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = notes[Math.floor(Math.random() * notes.length)];
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 2.8);
    }
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
    bp.frequency.value = 600 + Math.random() * 250;
    const g = this.ctx.createGain();
    g.gain.value = 0.1 * intensity;
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }

  update(dt: number, state: PlayerState, speed: number): void {
    if (!this.ctx) return;
    const windTarget =
      state === 'gliding' ? 0.5 : state === 'airborne' ? 0.15 : Math.min(0.05, speed * 0.005);
    this.windGain.gain.setTargetAtTime(windTarget, this.ctx.currentTime, 0.4);

    if (state === 'grounded' && speed > 0.5) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.footstep(Math.min(1, speed / 9));
        this.stepTimer = 2.6 / speed;
      }
    } else {
      this.stepTimer = 0;
    }
  }
}
