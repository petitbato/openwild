export class Stamina {
  static readonly MAX = 100;
  static readonly REGEN_PER_S = 20;
  static readonly RECOVER_THRESHOLD = 30;

  value = Stamina.MAX;
  exhausted = false;

  get fraction(): number { return this.value / Stamina.MAX; }
  get canUse(): boolean { return !this.exhausted; }

  drain(amount: number): void {
    this.value = Math.max(0, this.value - amount);
    if (this.value === 0) this.exhausted = true;
  }

  update(dt: number, regenerating: boolean): void {
    if (regenerating) {
      this.value = Math.min(Stamina.MAX, this.value + Stamina.REGEN_PER_S * dt);
      if (this.exhausted && this.value >= Stamina.RECOVER_THRESHOLD) this.exhausted = false;
    }
  }
}
