import { applyDeadzone } from './deadzone';

export interface Actions {
  move: { x: number; y: number };
  look: { x: number; y: number };
  jumpPressed: boolean;
  jumpHeld: boolean;
  sprintHeld: boolean;
}

export class Input {
  readonly actions: Actions = {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    jumpPressed: false,
    jumpHeld: false,
    sprintHeld: false,
  };

  private keys = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private jumpQueued = false;
  private padJumpWas = false;

  constructor(canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => canvas.requestPointerLock());
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
  }

  /** Call exactly once per fixed update. Fills actions, clears edges/deltas. */
  poll(): void {
    let mx = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let my = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    let jumpHeld = this.keys.has('Space');
    let sprintHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let jumpPressed = this.jumpQueued;
    let lookX = this.mouseDX * 0.0025;
    let lookY = this.mouseDY * 0.0025;

    const pad = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (pad) {
      const ls = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      const rs = applyDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      if (ls.x !== 0 || ls.y !== 0) { mx = ls.x; my = -ls.y; }
      lookX += rs.x * 0.045;
      lookY += rs.y * 0.035;
      const aBtn = pad.buttons[0]?.pressed ?? false;       // A / Cross
      if (aBtn && !this.padJumpWas) jumpPressed = true;
      if (aBtn) jumpHeld = true;
      this.padJumpWas = aBtn;
      if (pad.buttons[1]?.pressed || pad.buttons[10]?.pressed) sprintHeld = true; // B or L3
    }

    const mv = Math.hypot(mx, my);
    const a = this.actions;
    a.move.x = mv > 1 ? mx / mv : mx;
    a.move.y = mv > 1 ? my / mv : my;
    a.look.x = lookX;
    a.look.y = lookY;
    a.jumpPressed = jumpPressed;
    a.jumpHeld = jumpHeld;
    a.sprintHeld = sprintHeld;

    this.mouseDX = 0;
    this.mouseDY = 0;
    this.jumpQueued = false;
  }
}
