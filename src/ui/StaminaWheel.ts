import type { Stamina } from '../player/Stamina';

const R = 26;
const CIRC = 2 * Math.PI * R;

export class StaminaWheel {
  private root: HTMLDivElement;
  private fill: SVGCircleElement;

  constructor(hud: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'stamina-wheel';
    this.root.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="${R}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="7" />
        <circle class="fill" cx="32" cy="32" r="${R}" fill="none" stroke="#7ddf5a" stroke-width="7"
          stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="0"
          transform="rotate(-90 32 32)" />
      </svg>`;
    hud.appendChild(this.root);
    this.fill = this.root.querySelector('circle.fill')!;
  }

  update(stamina: Stamina): void {
    this.fill.setAttribute('stroke-dashoffset', String(CIRC * (1 - stamina.fraction)));
    this.root.classList.toggle('visible', stamina.fraction < 0.999);
    this.root.classList.toggle('exhausted', stamina.exhausted);
  }
}
