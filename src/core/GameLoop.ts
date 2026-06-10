export class GameLoop {
  readonly fixedDt = 1 / 60;
  private last = 0;
  private acc = 0;
  private raf = 0;

  constructor(
    private fixedUpdate: (dt: number) => void,
    private render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      let frame = (now - this.last) / 1000;
      this.last = now;
      frame = Math.min(frame, 0.1); // tab-switch clamp
      this.acc += frame;
      while (this.acc >= this.fixedDt) {
        this.fixedUpdate(this.fixedDt);
        this.acc -= this.fixedDt;
      }
      this.render(this.acc / this.fixedDt, frame);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void { cancelAnimationFrame(this.raf); }
}
