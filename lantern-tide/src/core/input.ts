import type { Input } from '../sim/types';
import type { Action, Settings } from '../meta/profile';

/** Size of the visible slice of the world, in world units. The canvas is 1920x1080, so zoom = 1920 / VIEW_W. */
export const VIEW_W = 1120;
export const VIEW_H = 630;

/**
 * Collects mouse, keyboard, gamepad and touch into the single Input the simulation understands.
 * Mouse keeps the original game's one-handed feel: the boat simply sails toward the pointer.
 */
export class InputManager {
  private keys = new Set<string>();
  private mouse = { x: VIEW_W / 2, y: VIEW_H / 2, l: false, r: false, m: false, active: false };
  /** Where the pointer was when the leg began: the boat only follows once the player deliberately moves or clicks. */
  private armed: { x: number; y: number } | null = null;
  private touchSteer: { id: number; x: number; y: number } | null = null;
  private touchBoost = false;
  /** On-screen buttons (touch). */
  ui = { flare: false, brake: false };
  private device: 'mouse' | 'keys' | 'pad' | 'touch' = 'mouse';
  private latch = false;
  private prevBoostHeld = false;
  private pauseQueued = false;
  private prevPadStart = false;
  private prevPadA = false;
  private confirmQueued = false;
  /** Set by tests / attract mode to drive the boat directly. */
  override: Input | null = null;
  enabled = true;
  onRebind: ((code: string) => void) | null = null;

  constructor(private canvasOf: () => HTMLCanvasElement | null, private settings: () => Settings) {
    window.addEventListener('keydown', (e) => {
      if (this.onRebind) { e.preventDefault(); const cb = this.onRebind; this.onRebind = null; cb(e.code); return; }
      if (e.code === this.settings().keys.pause || e.code === 'KeyP') this.pauseQueued = true;
      if (e.target instanceof HTMLInputElement) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (this.dirKeys()) this.device = 'keys';
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = this.mouse.m = false; });
    window.addEventListener('mousemove', (e) => {
      this.setMouse(e.clientX, e.clientY);
      this.device = 'mouse';
      if (!this.armed || Math.hypot(this.mouse.x - this.armed.x, this.mouse.y - this.armed.y) > 36) { this.mouse.active = true; this.armed = null; }
    });
    window.addEventListener('mousedown', (e) => {
      if (!this.onCanvas(e.target)) return;
      this.setMouse(e.clientX, e.clientY);
      this.device = 'mouse'; this.mouse.active = true; this.armed = null;
      if (e.button === 0) this.mouse.l = true;
      if (e.button === 1) { this.mouse.m = true; e.preventDefault(); }
      if (e.button === 2) this.mouse.r = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.l = false;
      if (e.button === 1) this.mouse.m = false;
      if (e.button === 2) this.mouse.r = false;
    });
    window.addEventListener('contextmenu', (e) => { if (this.onCanvas(e.target)) e.preventDefault(); });
    const touch = (e: TouchEvent) => {
      if (!this.onCanvas(e.target)) return;
      e.preventDefault();
      this.device = 'touch';
      const ts = Array.from(e.touches);
      const first = this.touchSteer ? ts.find((t) => t.identifier === this.touchSteer!.id) ?? ts[0] : ts[0];
      if (first) { const p = this.toLogical(first.clientX, first.clientY); this.touchSteer = { id: first.identifier, x: p.x, y: p.y }; }
      else this.touchSteer = null;
      this.touchBoost = ts.length >= 2;
    };
    for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) window.addEventListener(t, touch, { passive: false });
  }

  private onCanvas(target: EventTarget | null): boolean {
    return target instanceof HTMLCanvasElement || (target instanceof HTMLElement && target.id === 'ui');
  }

  private toLogical(cx: number, cy: number) {
    const c = this.canvasOf();
    if (!c) return { x: cx, y: cy };
    const r = c.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * VIEW_W, y: ((cy - r.top) / r.height) * VIEW_H };
  }
  private setMouse(cx: number, cy: number) { const p = this.toLogical(cx, cy); this.mouse.x = p.x; this.mouse.y = p.y; }

  private key(a: Action): boolean { return this.keys.has(this.settings().keys[a]); }
  private dirKeys(): boolean {
    return this.key('up') || this.key('down') || this.key('left') || this.key('right')
      || this.keys.has('ArrowUp') || this.keys.has('ArrowDown') || this.keys.has('ArrowLeft') || this.keys.has('ArrowRight');
  }

  private pad(): Gamepad | null {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  /** Mouse position in logical view coordinates. */
  pointer() { return { x: this.mouse.x, y: this.mouse.y }; }
  isTouch() { return this.device === 'touch'; }

  consumePause(): boolean {
    const pad = this.pad();
    const start = !!pad?.buttons[9]?.pressed;
    if (start && !this.prevPadStart) this.pauseQueued = true;
    this.prevPadStart = start;
    const q = this.pauseQueued;
    this.pauseQueued = false;
    return q;
  }

  /** Gamepad A as a "confirm" edge for menus. */
  consumeConfirm(): boolean {
    const pad = this.pad();
    const a = !!pad?.buttons[0]?.pressed;
    if (a && !this.prevPadA) this.confirmQueued = true;
    this.prevPadA = a;
    const q = this.confirmQueued;
    this.confirmQueued = false;
    return q;
  }

  padNav(): { x: number; y: number } {
    const pad = this.pad();
    if (!pad) return { x: 0, y: 0 };
    const x = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0) || (Math.abs(pad.axes[0]) > 0.6 ? Math.sign(pad.axes[0]) : 0);
    const y = (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0) || (Math.abs(pad.axes[1]) > 0.6 ? Math.sign(pad.axes[1]) : 0);
    return { x, y };
  }

  /** Sample the current input. (px, py) is the boat's position in logical view coordinates. */
  sample(px: number, py: number): Input {
    if (this.override) return this.override;
    if (!this.enabled) return { sx: 0, sy: 0, boost: false, brake: false, flare: false };
    let sx = 0, sy = 0, boostHeld = false, brake = false, flare = false;

    const pad = this.pad();
    if (pad) {
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      const m = Math.hypot(ax, ay);
      if (m > 0.22) { this.device = 'pad'; }
      if (this.device === 'pad' && m > 0.22) { const k = Math.min(1, (m - 0.22) / 0.7) / m; sx = ax * k; sy = ay * k; }
      boostHeld ||= !!pad.buttons[0]?.pressed || !!pad.buttons[7]?.pressed;
      brake ||= !!pad.buttons[1]?.pressed || !!pad.buttons[6]?.pressed;
      flare ||= !!pad.buttons[2]?.pressed || !!pad.buttons[3]?.pressed;
    }

    const kx = (this.key('right') || this.keys.has('ArrowRight') ? 1 : 0) - (this.key('left') || this.keys.has('ArrowLeft') ? 1 : 0);
    const ky = (this.key('down') || this.keys.has('ArrowDown') ? 1 : 0) - (this.key('up') || this.keys.has('ArrowUp') ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); sx = kx / l; sy = ky / l; this.device = 'keys'; }

    const toward = (tx: number, ty: number) => {
      const dx = tx - px, dy = ty - py;
      const d = Math.hypot(dx, dy);
      if (d < 16) return;
      const k = Math.min(1, (d - 16) / 105) / d;
      sx = dx * k; sy = dy * k;
    };
    if (this.device === 'mouse' && this.mouse.active) toward(this.mouse.x, this.mouse.y);
    if (this.device === 'touch' && this.touchSteer) toward(this.touchSteer.x, this.touchSteer.y);

    boostHeld ||= this.key('boost') || (this.device === 'mouse' && this.mouse.l) || this.touchBoost;
    brake ||= this.key('brake') || this.keys.has('ShiftRight') || (this.device === 'mouse' && this.mouse.r) || this.ui.brake;
    flare ||= this.key('flare') || this.keys.has('KeyE') || this.mouse.m || this.ui.flare;

    // Accessibility: tap once to keep boosting, tap again to stop.
    let boost = boostHeld;
    if (this.settings().boostToggle) {
      if (boostHeld && !this.prevBoostHeld) this.latch = !this.latch;
      boost = this.latch;
    }
    this.prevBoostHeld = boostHeld;
    return { sx, sy, boost, brake, flare };
  }

  resetLatch() { this.latch = false; this.keys.clear(); this.mouse.l = this.mouse.r = this.mouse.m = false; }

  /** Call when a leg starts or resumes: the mouse must move (or click) before it steers again. */
  arm() { this.resetLatch(); this.mouse.active = false; this.armed = { x: this.mouse.x, y: this.mouse.y }; this.touchSteer = null; }
}
