import Phaser from 'phaser';
import { BIOMES, TUNE } from '../content';
import { clamp, dist, smooth } from '../core/math';
import { VIEW_H, VIEW_W, type InputManager } from '../core/input';
import type { Settings } from '../meta/profile';
import { botInput } from '../sim/bot';
import { createLeg } from '../sim/gen';
import { FIXED_DT, drainEvents, isClassic, lanternRadius, revealAll, step } from '../sim/leg';
import type { Animal, Hazard, LegSpec, LegState, Pirate, SimEvent } from '../sim/types';
import { ZOOM, hexToInt, makeWater, sprite } from './boot';

export interface LegHooks {
  input: InputManager;
  settings: () => Settings;
  onEvent: (e: SimEvent, s: LegState) => void;
  onFrame: (s: LegState, scene: LegScene) => void;
  onEnd: (s: LegState) => void;
  /** Let the autopilot sail (attract mode, tests). */
  bot?: boolean;
}

type Img = Phaser.GameObjects.Image;
const D = { water: 0, zone: 1, whirl: 2, wake: 3, pad: 4, pickup: 5, hazard: 6, animal: 7, pirate: 8, player: 9, glow: 12, dark: 20, glint: 21, beam: 21.5, fx: 23, air: 24, weather: 25, text: 30, flash: 40 };
const GLINT_COLOR: Record<string, number> = { pingo: 0xffffff, zabica: 0x9dff7a, ribica: 0x6fe8ff, turtle: 0xffe27a, marshmallow: 0xffc0de };
const RT_SCALE = 2;
const RT_MARGIN = 40;

export class LegScene extends Phaser.Scene {
  sim!: LegState;
  private hooks!: LegHooks;
  private acc = 0;
  private hitStop = 0;
  private slowMo = 0;
  private endTimer = 0;
  private ended = false;
  private viewX = 0;
  private viewY = 0;
  private camX = 0;
  private camY = 0;
  private t = 0;

  private water!: Phaser.GameObjects.Shader | Phaser.GameObjects.Rectangle;
  private dark!: Phaser.GameObjects.RenderTexture;
  private lamps: Img[] = [];
  private lightN = 0;
  private playerImg!: Img;
  private glowImg!: Img;
  private crewImgs: Img[] = [];
  private oilArc!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private pirateViews = new Map<number, { img: Img; glint: Img; mark?: Img }>();
  private animalViews = new Map<number, { img: Img; glint: Img; halo?: Img }>();
  private hazardViews = new Map<number, Img>();
  private pickupViews = new Map<number, Img>();
  private shotViews = new Map<number, { ball: Img; target: Img }>();
  private zoneImgs: Img[] = [];
  private beamImgs: Img[] = [];
  private arrowImgs: Img[] = [];
  private beaconImgs: { img: Img; glow: Img; k: number }[] = [];
  private hazardFoam = new Map<number, Img>();
  private crackImg!: Img;
  private smokeT = 0;
  private bossView: { img: Img; extra?: Img; glint: Img } | null = null;
  private foam!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splinters!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hearts!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private weather: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private weatherZone = new Phaser.Geom.Rectangle(0, 0, VIEW_W + 200, VIEW_H + 200);
  private wakeT = 0;
  private sinkT = 0;
  private flareRing = 0;
  private darkColor = 0x050818;
  private lastNow = 0;
  private debug = false;
  private debugText!: Phaser.GameObjects.Text;

  constructor() { super('leg'); }

  init(data: { spec: LegSpec; hooks: LegHooks }) {
    this.hooks = data.hooks;
    this.sim = createLeg(data.spec);
    this.acc = 0; this.hitStop = 0; this.slowMo = 0; this.endTimer = 0; this.ended = false; this.t = 0; this.sinkT = 0; this.flareRing = 0;
    this.lamps = []; this.lightN = 0; this.crewImgs = []; this.zoneImgs = []; this.beamImgs = []; this.arrowImgs = []; this.beaconImgs = [];
    this.hazardFoam.clear(); this.pirateViews.clear(); this.animalViews.clear(); this.hazardViews.clear(); this.pickupViews.clear(); this.shotViews.clear();
    this.bossView = null; this.weather = null;
  }

  create() {
    const s = this.sim;
    const biome = BIOMES[s.spec.biome];
    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    const wc = Phaser.Display.Color.IntegerToColor(hexToInt(biome.water[0]));
    this.darkColor = Phaser.Display.Color.GetColor(Math.round(wc.red * 0.3), Math.round(wc.green * 0.3), Math.round(wc.blue * 0.35) + 6);
    this.camX = clamp(s.player.x, VIEW_W / 2, Math.max(VIEW_W / 2, s.w - VIEW_W / 2));
    this.camY = clamp(s.player.y, VIEW_H / 2, Math.max(VIEW_H / 2, s.h - VIEW_H / 2));

    this.water = makeWater(this, VIEW_W + RT_MARGIN * 2, VIEW_H + RT_MARGIN * 2, biome.water).setDepth(D.water);

    // A rope of buoys marks the edge of the patrol area.
    if (!isClassic(s)) {
      for (let x = 50; x < s.w; x += 110) { sprite(this, 'buoy', x, 14, 0.8).setDepth(D.pad); sprite(this, 'buoy', x, s.h - 14, 0.8).setDepth(D.pad); }
      for (let y = 120; y < s.h - 60; y += 110) { sprite(this, 'buoy', 14, y, 0.8).setDepth(D.pad); sprite(this, 'buoy', s.w - 14, y, 0.8).setDepth(D.pad); }
    }

    for (const m of s.moonPatches) {
      sprite(this, 'glow', m.x, m.y, (m.r * 2.2) / 256).setTint(0xcfd8ff).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.zone);
    }

    this.foam = this.add.particles(0, 0, 'foam', { lifespan: 900, scale: { start: 0.12, end: 0.5 }, alpha: { start: 0.5, end: 0 }, speed: { min: 0, max: 14 }, emitting: false }).setDepth(D.wake);
    this.splinters = this.add.particles(0, 0, 'splinter', { lifespan: 700, speed: { min: 90, max: 280 }, scale: { start: 0.7, end: 0.3 }, alpha: { start: 1, end: 0 }, rotate: { min: 0, max: 360 }, tint: [0xa9713c, 0xd7a465, 0x74471f], emitting: false }).setDepth(D.fx);
    this.sparks = this.add.particles(0, 0, 'dot', { lifespan: 500, speed: { min: 60, max: 240 }, scale: { start: 0.6, end: 0 }, blendMode: 'ADD', emitting: false }).setDepth(D.fx);
    this.hearts = this.add.particles(0, 0, 'heart', { lifespan: 1100, speedY: { min: -70, max: -40 }, speedX: { min: -24, max: 24 }, scale: { start: 0.3, end: 0.55 }, alpha: { start: 1, end: 0 }, emitting: false }).setDepth(D.text);

    this.smoke = this.add.particles(0, 0, 'dot', { lifespan: 900, speedY: { min: -40, max: -18 }, speedX: { min: -14, max: 14 }, scale: { start: 0.35, end: 1.1 }, alpha: { start: 0.55, end: 0 }, tint: [0x2a2a36, 0x4a4a5a], emitting: false }).setDepth(D.player + 0.3);
    this.glowImg = sprite(this, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow).setTint(0xffb648);
    this.crackImg = sprite(this, 'cracks').setDepth(D.player + 0.05).setAlpha(0);
    this.playerImg = sprite(this, 'player', s.player.x, s.player.y, s.spec.mutators.tinyBoat ? 0.6 : 1).setDepth(D.player);
    const crewKeys = s.spec.loadout.crew.slice(0, 3);
    for (const c of crewKeys) this.crewImgs.push(sprite(this, c, 0, 0, 0.42).setDepth(D.player + 0.1));

    this.dark = this.add.renderTexture(0, 0, (VIEW_W + RT_MARGIN * 2) / RT_SCALE, (VIEW_H + RT_MARGIN * 2) / RT_SCALE).setOrigin(0).setScale(RT_SCALE).setDepth(D.dark);
    this.oilArc = this.add.graphics().setDepth(D.glint + 1);
    this.overlay = this.add.graphics().setDepth(D.glint + 0.5);
    this.flashRect = this.add.rectangle(0, 0, VIEW_W + 200, VIEW_H + 200, 0xffffff).setOrigin(0).setAlpha(0).setDepth(D.flash);

    this.lastNow = 0;
    this.events.on('resume', () => { this.lastNow = 0; });
    // F1: debug overlay (hitboxes, AI states, lantern radius, seed).
    this.debugText = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '11px', color: '#9dff7a', backgroundColor: '#000a' }).setDepth(D.flash + 1).setVisible(false);
    const onKey = (e: KeyboardEvent) => { if (e.code === 'F1') { e.preventDefault(); this.debug = !this.debug; this.debugText.setVisible(this.debug); } };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
    this.makeWeather();
    this.syncCamera(1);
    this.syncAll(0);
    // Build the HUD before the first simulation step so no event is missed.
    this.hooks.onFrame(this.sim, this);
  }

  setBot(on: boolean) { if (this.hooks) this.hooks.bot = on; }

  // ------------------------------------------------------------------ helpers

  private makeWeather() {
    const s = this.sim;
    const base = { emitZone: { type: 'random', source: this.weatherZone } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig };
    if (s.env.storm) {
      this.weather = this.add.particles(0, 0, 'rain', { ...base, lifespan: 500, speedX: -260, speedY: 900, scale: 0.5, alpha: { start: 0.55, end: 0.2 }, rotate: 16, frequency: 8, quantity: 3 });
    } else if (s.spec.biome === 'ice') {
      this.weather = this.add.particles(0, 0, 'dot', { ...base, lifespan: 5000, speedX: { min: -30, max: -8 }, speedY: { min: 14, max: 40 }, scale: { min: 0.2, max: 0.45 }, alpha: { start: 0.7, end: 0 }, frequency: 90 });
    } else if (s.spec.biome === 'swamp') {
      this.weather = this.add.particles(0, 0, 'dot', { ...base, lifespan: 4200, speed: { min: 4, max: 18 }, scale: { min: 0.15, max: 0.3 }, alpha: { start: 0, end: 0.8, ease: 'Sine.easeInOut' }, tint: 0xc8ff8a, blendMode: 'ADD', frequency: 160 });
    } else if (s.spec.biome === 'crystal') {
      this.weather = this.add.particles(0, 0, 'dot', { ...base, lifespan: 3200, speedY: { min: -30, max: -10 }, speedX: { min: -8, max: 8 }, scale: { min: 0.12, max: 0.28 }, alpha: { start: 0.8, end: 0 }, tint: 0xffc56e, blendMode: 'ADD', frequency: 140 });
    } else if (s.spec.biome === 'reef') {
      this.weather = this.add.particles(0, 0, 'ring', { ...base, lifespan: 2600, speedY: { min: -22, max: -8 }, scale: { start: 0.02, end: 0.07 }, alpha: { start: 0.5, end: 0 }, frequency: 260 });
    } else if (s.spec.biome === 'deep') {
      this.weather = this.add.particles(0, 0, 'dot', { ...base, lifespan: 4000, speed: { min: 2, max: 8 }, scale: { min: 0.1, max: 0.22 }, alpha: { start: 0, end: 0.7, ease: 'Sine.easeInOut' }, tint: 0xcdd6ff, blendMode: 'ADD', frequency: 220 });
    }
    this.weather?.setDepth(D.weather);
  }

  /** World → logical view coordinates. */
  toView(x: number, y: number) { return { x: x - this.viewX, y: y - this.viewY }; }

  floatText(x: number, y: number, text: string, color = '#ffffff', size = 22) {
    const t = this.add.text(x, y, text, { fontFamily: 'Fredoka, sans-serif', fontStyle: '600', fontSize: `${size}px`, color, stroke: '#161a33', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(D.text).setResolution(2);
    t.setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, delay: 350, duration: 650, ease: 'Sine.easeIn', onComplete: () => t.destroy() });
  }

  private ringFx(x: number, y: number, to: number, color = 0xffffff, dur = 500, depth = D.fx, alpha = 0.8) {
    const r = sprite(this, 'ring', x, y, 0.1).setTint(color).setDepth(depth).setAlpha(alpha);
    this.tweens.add({ targets: r, scale: (to / 58) * 0.5, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  private splash(x: number, y: number, n = 10) {
    this.foam.emitParticleAt(x, y, n);
    this.ringFx(x, y, 40, 0xffffff, 450, D.wake, 0.6);
  }

  private shake(dur: number, amt: number) {
    if (this.hooks.settings().shake) this.cameras.main.shake(dur, amt);
  }

  private popMark(x: number, y: number, key: string, life = 700) {
    const m = sprite(this, key, x, y - 30, 0.2).setDepth(D.text);
    this.tweens.add({ targets: m, scale: 0.5, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: m, alpha: 0, delay: life - 200, duration: 200, onComplete: () => m.destroy() });
  }

  // ------------------------------------------------------------------ events → juice

  private handle(e: SimEvent) {
    const s = this.sim;
    switch (e.type) {
      case 'ram':
        this.splinters.emitParticleAt(e.x, e.y, e.kill ? 18 : 8);
        this.sparks.emitParticleAt(e.x, e.y, e.heavy ? 12 : 5);
        this.floatText(e.x, e.y - 20, `+${e.score}`, e.mult >= 5 ? '#ff8ad8' : e.mult >= 3 ? '#ffb14a' : e.mult >= 2 ? '#ffe14a' : '#ffffff', 20 + Math.min(14, e.mult * 3));
        this.hitStop = e.kill ? (e.heavy ? 0.08 : 0.055) : 0.03;
        this.shake(e.kill ? 160 : 90, e.heavy ? 0.007 : 0.004);
        if (e.kill) this.splash(e.x, e.y, 14);
        break;
      case 'clang': this.sparks.emitParticleAt(e.x, e.y, 14); this.shake(100, 0.004); this.floatText(e.x, e.y - 20, 'CLANG!', '#cfd6ea', 18); break;
      case 'bump': this.foam.emitParticleAt(e.x, e.y, 4); break;
      case 'bonk': this.floatText(e.x, e.y - 18, `${TUNE.score.animalHit}`, '#ff6b6b', 24); this.popMark(e.x, e.y, 'star'); this.shake(120, 0.004); break;
      case 'hazardHit':
        this.splinters.emitParticleAt(e.x, e.y, e.free ? 4 : 16);
        this.shake(220, 0.012);
        if (e.free) this.floatText(e.x, e.y - 24, 'Pingo!', '#9fe6ff', 20);
        else this.floatText(e.x, e.y - 36, '−1', '#ff6b6b', 34);
        break;
      case 'playerHit': this.floatText(s.player.x, s.player.y - 36, '−1', '#ff6b6b', 34); this.splinters.emitParticleAt(s.player.x, s.player.y, 16); this.shake(240, 0.013); break;
      case 'hop': this.floatText(e.x, e.y - 24, 'Hop!', '#9dff7a', 20); this.ringFx(e.x, e.y, 50, 0x9dff7a); break;
      case 'nearMiss': this.floatText(e.x, e.y - 26, `+${e.score}`, '#9fe6ff', 18); break;
      case 'pickup':
        this.sparks.emitParticleAt(e.x, e.y, 8);
        if (e.pickup === 'barrel') this.ringFx(s.player.x, s.player.y, 70, 0xffc24a, 500, D.glint);
        break;
      case 'spawn': {
        for (let i = 0; i < 3; i++) this.time.delayedCall(i * 300, () => this.ringFx(e.x, e.y, 46, 0xffffff, 700, D.glint, 0.5));
        break;
      }
      case 'notice': this.popMark(e.x, e.y, 'exclaim', 600); break;
      case 'creak': this.ringFx(e.x, e.y, 36, 0xff6b6b, 500, D.glint, 0.6); break;
      case 'cannonFire': this.sparks.emitParticleAt(e.x, e.y, 6); break;
      case 'cannonLand':
        if (e.kind === 'keg') {
          this.ringFx(e.x, e.y, e.r, 0xffb14a, 380, D.glint, 0.9);
          this.sparks.emitParticleAt(e.x, e.y, 26);
          this.splinters.emitParticleAt(e.x, e.y, 10);
          this.shake(180, 0.008);
        }
        this.splash(e.x, e.y, e.kind === 'net' ? 5 : 16);
        if (e.kind === 'ball') this.ringFx(e.x, e.y, e.r, 0xffffff, 350, D.fx, 0.7);
        if (dist(e.x, e.y, s.player.x, s.player.y) < 260) this.shake(90, 0.003);
        break;
      case 'flare': this.flareRing = 0.001; if (this.hooks.settings().flashes) this.flash(0.35, 0xfff3c4); if (e.bark) this.floatText(e.x, e.y - 40, 'ARF!', '#ffffff', 30); break;
      case 'sonar': this.ringFx(e.x, e.y, 520, 0x6fe8ff, 1200, D.glint, 0.5); break;
      case 'freed': this.sparks.emitParticleAt(e.x, e.y, 10); this.hearts.emitParticleAt(e.x, e.y, 1); break;
      case 'towStart': this.hearts.emitParticleAt(e.x, e.y, 2); break;
      case 'delivered': this.hearts.emitParticleAt(e.x, e.y, 5); this.floatText(e.x, e.y - 22, `+${e.score}`, '#bfffe6', 24); break;
      case 'frogHop': this.ringFx(e.x, e.y, 22, 0xb6f5a0, 400, D.pad + 0.1, 0.5); break;
      case 'assist': this.splinters.emitParticleAt(e.x, e.y, 14); this.foam.emitParticleAt(e.x, e.y, 16); this.floatText(e.x, e.y - 30, `+${e.score}`, '#9fe6ff', 24); this.shake(160, 0.007); break;
      case 'floeShove': this.foam.emitParticleAt(e.x, e.y, 8); break;
      case 'calve': this.splash(e.x, e.y, 12); break;
      case 'beamStun': this.sparks.emitParticleAt(e.x, e.y, 10); this.popMark(e.x, e.y, 'star', 900); break;
      case 'lightning': if (this.hooks.settings().flashes) this.flash(0.55, 0xdfe8ff); break;
      case 'bossHit': this.splinters.emitParticleAt(e.x, e.y, 22); this.sparks.emitParticleAt(e.x, e.y, 16); this.hitStop = 0.09; this.shake(220, 0.012); break;
      case 'bossStun': this.popMark(e.x, e.y - 30, 'star', 1400); this.shake(260, 0.014); this.splash(e.x, e.y, 20); break;
      case 'shieldBreak': this.ringFx(e.x, e.y, 140, 0xffd27a, 600, D.glint); this.sparks.emitParticleAt(e.x, e.y, 24); break;
      case 'netCut': this.ringFx(e.x, e.y, 150, 0xe2d1a6, 600, D.glint); this.sparks.emitParticleAt(e.x, e.y, 20); break;
      case 'bossSurface': this.ringFx(e.x, e.y, 110, 0x9dff7a, 800, D.glint); break;
      case 'bossTelegraph': this.popMark(e.x, e.y - 30, 'exclaim', 900); break;
      case 'bossDead':
        this.slowMo = 1.6; this.shake(600, 0.016);
        for (let i = 0; i < 6; i++) this.time.delayedCall(i * 220, () => { this.splinters.emitParticleAt(e.x + Phaser.Math.Between(-40, 40), e.y + Phaser.Math.Between(-30, 30), 14); this.splash(e.x + Phaser.Math.Between(-50, 50), e.y + Phaser.Math.Between(-40, 40), 10); });
        break;
      case 'beaconLit': this.ringFx(e.x, e.y, 170, 0xffd27a, 700, D.glint, 0.9); this.sparks.emitParticleAt(e.x, e.y, 22); this.floatText(e.x, e.y - 30, `+${e.score}`, '#ffe9a8', 24); break;
      case 'beaconOut': this.ringFx(e.x, e.y, 120, 0x6677aa, 600, D.glint, 0.8); this.foam.emitParticleAt(e.x, e.y, 12); break;
      case 'sink': for (let i = 0; i < 5; i++) this.time.delayedCall(250 + i * 220, () => this.ringFx(e.x + Phaser.Math.Between(-16, 16), e.y + Phaser.Math.Between(-16, 16), 14, 0xffffff, 600, D.fx, 0.7)); this.sinkT = 0.001; this.shake(400, 0.014); this.splash(e.x, e.y, 24); break;
      case 'boost': this.foam.emitParticleAt(e.x, e.y, 8); break;
      default: break;
    }
    this.hooks.onEvent(e, s);
  }

  private flash(alpha: number, color: number) {
    this.flashRect.setFillStyle(color).setAlpha(alpha);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 420, ease: 'Quad.easeOut' });
  }

  // ------------------------------------------------------------------ frame

  update(_time: number, _deltaMs: number) {
    const s = this.sim;
    // Use the wall clock: Phaser smooths its delta, which would slow the game down on slow machines.
    const now = performance.now();
    const deltaMs = Math.min(100, this.lastNow ? now - this.lastNow : 16.7);
    this.lastNow = now;
    let dt = deltaMs / 1000;
    this.t += dt;
    const settings = this.hooks.settings();
    let scale = settings.assist.speed * (s.spec.mutators.slowMo ? 0.6 : 1);
    if (this.slowMo > 0) { this.slowMo -= dt; scale *= 0.3; }
    if (this.hitStop > 0) { this.hitStop -= dt; dt = 0; }

    this.acc += dt * scale;
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < 7) {
      const v = this.toView(s.player.x, s.player.y);
      const inp = this.hooks.bot ? botInput(s, 0.9) : this.hooks.input.sample(v.x, v.y);
      if (s.spec.mutators.mirror) inp.sx = -inp.sx;
      step(s, inp, FIXED_DT);
      for (const e of drainEvents(s)) this.handle(e);
      this.acc -= FIXED_DT;
      steps++;
      if (this.hitStop > 0) break;
    }
    if (steps === 7) this.acc = 0;

    this.syncCamera(dt);
    this.syncAll(dt);
    this.hooks.onFrame(s, this);

    if (s.status !== 'ready' && s.status !== 'running' && !this.ended) {
      this.endTimer += deltaMs / 1000;
      const wait = s.status === 'lost' ? 2.0 : s.spec.kind === 'boss' ? 2.4 : 1.3;
      if (this.endTimer >= wait) { this.ended = true; this.hooks.onEnd(s); }
    }
  }

  private syncCamera(dt: number) {
    const s = this.sim, p = s.player;
    let tx = p.x + p.vx * 0.32, ty = p.y + p.vy * 0.32;
    tx = clamp(tx, VIEW_W / 2, Math.max(VIEW_W / 2, s.w - VIEW_W / 2));
    ty = clamp(ty, VIEW_H / 2, Math.max(VIEW_H / 2, s.h - VIEW_H / 2));
    const k = dt >= 1 ? 1 : 1 - Math.exp(-4.5 * dt);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    this.cameras.main.centerOn(this.camX, this.camY);
    this.viewX = this.camX - VIEW_W / 2; this.viewY = this.camY - VIEW_H / 2;
    const ox = this.viewX - RT_MARGIN, oy = this.viewY - RT_MARGIN;
    this.water.setPosition(ox, oy);
    if (this.water instanceof Phaser.GameObjects.Shader) {
      this.water.setUniform('scroll.value.x', ox);
      this.water.setUniform('scroll.value.y', oy);
    }
    this.dark.setPosition(ox, oy);
    this.flashRect.setPosition(this.viewX - 100, this.viewY - 100);
    this.weatherZone.setPosition(this.viewX - 100, this.viewY - 100);
  }

  private light(x: number, y: number, radius: number, alpha = 1) {
    let l = this.lamps[this.lightN];
    if (!l) { l = this.make.image({ key: 'light' }, false); this.lamps.push(l); }
    this.lightN++;
    const ox = this.viewX - RT_MARGIN, oy = this.viewY - RT_MARGIN;
    l.setPosition((x - ox) / RT_SCALE, (y - oy) / RT_SCALE);
    l.setScale((radius * 1.3) / RT_SCALE / 256);
    l.setAlpha(alpha);
  }

  private syncAll(dt: number) {
    const s = this.sim, p = s.player;
    const classic = isClassic(s);
    const R = lanternRadius(s);
    const reveal = revealAll(s);
    const flicker = p.oil < 0.2 && !classic ? 0.9 + 0.1 * Math.sin(this.t * 31) * Math.sin(this.t * 7.3) : 1;
    const Rv = R * flicker;
    const glintRange = R * TUNE.lantern.glintRange * (s.spec.biome === 'swamp' ? 0.8 : 1);
    this.lightN = 0;
    this.overlay.clear();

    const inPatch = (x: number, y: number) => s.moonPatches.some((m) => dist(m.x, m.y, x, y) < m.r);
    const visAt = (x: number, y: number): number => {
      if (reveal) return 1;
      const d = dist(x, y, p.x, p.y);
      if (classic) return d < Rv ? 1 : 0;
      let v = 1 - smooth(Rv * 0.78, Rv * 1.02, d);
      if (inPatch(x, y)) v = 1;
      if (p.sonarPulse > 0 && d < 560) v = Math.max(v, 0.55);
      return v;
    };

    // ---- player
    const blink = p.invuln > 0 && Math.floor(this.t * 14) % 2 === 0;
    const sizeK = s.spec.mutators.tinyBoat ? 0.6 : 1;
    if (this.sinkT > 0) {
      this.sinkT += dt;
      const k = Math.min(1, this.sinkT / 1.4);
      this.playerImg.setPosition(p.x, p.y).setRotation(p.angle + k * 2.5).setScale(0.5 * sizeK * (1 - k * 0.7)).setAlpha(1 - k);
    } else {
      const boostK = p.boostT > 0 ? p.boostT / TUNE.boat.boostTime : 0;
      const bob = 1 + Math.sin(this.t * 3.1) * 0.02;
      this.playerImg.setPosition(p.x, p.y).setRotation(p.angle)
        .setScale(0.5 * sizeK * bob * (1 + boostK * 0.16), 0.5 * sizeK * bob * (1 - boostK * 0.12))
        .setAlpha(blink ? 0.35 : 1);
    }
    const c = Math.cos(p.angle), sn = Math.sin(p.angle);
    const seats = [[-9, 0], [3, -5], [3, 5]];
    this.crewImgs.forEach((img, i) => {
      const [fx, fy] = seats[i];
      img.setPosition(p.x + (c * fx - sn * fy) * sizeK, p.y + (sn * fx + c * fy) * sizeK).setRotation(p.angle).setAlpha(this.sinkT > 0 ? 0 : blink ? 0.35 : 1)
        .setScale(0.5 * 0.4 * sizeK * (1 + Math.sin(this.t * 5 + i * 2) * 0.05));
    });
    const hue = s.spec.mutators.disco ? Phaser.Display.Color.HSVToRGB((this.t * 0.4) % 1, 0.7, 1) as Phaser.Types.Display.ColorObject : null;
    this.glowImg.setPosition(p.x + c * 16, p.y + sn * 16).setScale((Rv * 2.1) / 512).setAlpha(classic ? 0.14 : 0.3 + (s.env.aurora > 0 ? 0.08 : 0))
      .setTint(hue ? Phaser.Display.Color.GetColor(hue.r, hue.g, hue.b) : s.env.aurora > 0 ? 0x9fffd0 : 0xffb648);

    // Cracks show how much hull is gone; the last plank smokes.
    const speed = Math.hypot(p.vx, p.vy);
    const missing = classic || p.maxPlanks <= 0 ? 0 : 1 - p.planks / p.maxPlanks;
    this.crackImg.setPosition(p.x, p.y).setRotation(p.angle).setScale(0.5 * sizeK).setAlpha(this.sinkT > 0 ? 0 : Math.min(1, missing * 1.5) * (blink ? 0.35 : 1));
    if (!classic && p.planks === 1 && p.maxPlanks > 1 && this.sinkT === 0 && s.status === 'running') {
      this.smokeT -= dt;
      if (this.smokeT <= 0) { this.smokeT = 0.16; this.smoke.emitParticleAt(p.x - c * 6, p.y - sn * 6, 1); }
    }
    // Wake.
    this.wakeT -= dt * (speed / 60);
    while (this.wakeT < 0 && speed > 20) {
      this.wakeT += 0.35;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.foam.emitParticleAt(p.x - c * 22 - sn * 9 * side, p.y - sn * 22 + c * 9 * side, 1);
    }

    // Diegetic lantern-oil arc around the boat.
    this.oilArc.clear();
    if (!classic && s.spec.kind !== 'tutorial' && this.sinkT === 0) {
      this.oilArc.lineStyle(3, 0x161a33, 0.5).beginPath().arc(p.x, p.y, 31, 0, Math.PI * 2).strokePath();
      const low = p.oil < 0.25 && Math.floor(this.t * 6) % 2 === 0;
      this.oilArc.lineStyle(3, low ? 0xff6b6b : 0xffc24a, 0.95).beginPath().arc(p.x, p.y, 31, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, p.oil)).strokePath();
      if (p.boostCd > 0) this.oilArc.lineStyle(2, 0x9fe6ff, 0.8).beginPath().arc(p.x, p.y, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.boostCd / TUNE.boat.boostCooldown)).strokePath();
    }

    // ---- lights
    this.light(p.x + c * 14, p.y + sn * 14, Rv);
    for (const m of s.moonPatches) this.light(m.x, m.y, m.r * 0.9, 0.75);
    for (const z of s.zones) this.light(z.x, z.y, z.r * 0.8, 0.45);
    if (this.flareRing > 0) {
      this.flareRing += dt;
      const k = this.flareRing / TUNE.lantern.flareTime;
      if (k >= 1) this.flareRing = 0;
      else this.light(p.x, p.y, 200 + k * 900, 1 - k * k);
    }

    // ---- zones & markers
    const zoneSet = [...s.zones.map((z) => ({ ...z, key: 'zone' })), ...s.markers.map((m) => ({ ...m, key: 'marker' }))];
    while (this.zoneImgs.length < zoneSet.length * 2) this.zoneImgs.push(sprite(this, 'zone'));
    this.zoneImgs.forEach((img, i) => {
      const z = zoneSet[Math.floor(i / 2)];
      if (!z) { img.setVisible(false); return; }
      const top = i % 2 === 1;
      img.setVisible(true).setTexture(z.key).setPosition(z.x, z.y).setDepth(top ? D.glint : D.zone)
        .setScale(((z.r * 2) / (z.key === 'zone' ? 512 : 256)) * (1 + Math.sin(this.t * 2) * 0.02) * (z.key === 'zone' ? 1.12 : 1))
        .setAlpha(top ? 0.3 : 0.9).setRotation(z.key === 'zone' ? this.t * 0.1 : 0);
    });

    // ---- beacons: dark floats until relit, then a pool of light that stays on the map
    while (this.beaconImgs.length < s.beacons.length) {
      const q = s.beacons[this.beaconImgs.length];
      this.beaconImgs.push({ img: sprite(this, 'beacon', q.x, q.y).setDepth(D.glint - 0.1), glow: sprite(this, 'glow', q.x, q.y).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow).setTint(0xffd27a), k: 0 });
    }
    s.beacons.forEach((q, i) => {
      const v = this.beaconImgs[i];
      v.k += ((q.lit ? 1 : 0) - v.k) * Math.min(1, dt * 4);
      const threatened = q.lit && q.douse > 0 && Math.floor(this.t * 10) % 2 === 0;
      v.img.setScale(0.5 * (1 + Math.sin(this.t * 2 + i) * 0.03)).setRotation(Math.sin(this.t * 1.1 + i) * 0.08)
        .setTint(threatened ? 0xff8a8a : q.lit ? 0xffffff : 0x55628f).setAlpha(q.lit ? 1 : 0.75);
      v.glow.setScale((330 / 512) * v.k * (1 + Math.sin(this.t * 3 + i) * 0.04)).setAlpha(0.42 * v.k * (threatened ? 0.5 : 1));
      if (v.k > 0.02) this.light(q.x, q.y, 165 * v.k * (threatened ? 0.75 : 1), 0.95);
      else this.light(q.x, q.y, 30 + q.charge * 60, 0.35 + q.charge * 0.5);
      // Lighting progress ring, and the reach you must stay inside.
      if (!q.lit) {
        this.overlay.lineStyle(2, 0xffe9a8, 0.25).strokeCircle(q.x, q.y, 66);
        if (q.charge > 0.01) this.overlay.lineStyle(5, 0xffd27a, 0.95).beginPath().arc(q.x, q.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q.charge).strokePath();
      }
    });

    // ---- hazards
    const seen = new Set<number>();
    for (const h of s.hazards) {
      seen.add(h.id);
      let img = this.hazardViews.get(h.id);
      if (!img) {
        img = sprite(this, h.type, h.x, h.y).setDepth(h.type === 'whirlpool' ? D.whirl : h.type === 'lilypad' ? D.pad : D.hazard);
        if (h.type === 'floe') { img.setScale(0); this.tweens.add({ targets: img, scale: (h.r * 2) / 104, duration: 300, ease: 'Back.easeOut' }); }
        this.hazardViews.set(h.id, img);
      }
      this.syncHazard(h, img);
    }
    for (const [id, img] of this.hazardViews) if (!seen.has(id)) { this.splash(img.x, img.y, 14); img.destroy(); this.hazardViews.delete(id); this.hazardFoam.get(id)?.destroy(); this.hazardFoam.delete(id); }

    // ---- pickups
    seen.clear();
    for (const k of s.pickups) {
      seen.add(k.id);
      let img = this.pickupViews.get(k.id);
      if (!img) { img = sprite(this, k.type, k.x, k.y).setDepth(k.type === 'firefly' ? D.glint : D.pickup); this.pickupViews.set(k.id, img); }
      const pulse = 1 + Math.sin(this.t * 4 + k.phase) * 0.08;
      img.setPosition(k.x, k.y + Math.sin(this.t * 2 + k.phase) * 2).setScale(0.5 * pulse).setRotation(k.type === 'firefly' ? 0 : Math.sin(this.t + k.phase) * 0.3)
        .setAlpha(k.t < 2 ? (Math.floor(this.t * 10) % 2 ? 0.4 : 1) : k.type === 'firefly' ? 0.6 + 0.4 * Math.sin(this.t * 3 + k.phase) : 1);
      if (k.type !== 'firefly') this.light(k.x, k.y, 34, 0.7);
      else this.light(k.x, k.y, 26, 0.5);
    }
    for (const [id, img] of this.pickupViews) if (!seen.has(id)) { img.destroy(); this.pickupViews.delete(id); }

    // ---- pirates
    seen.clear();
    for (const pr of s.pirates) {
      seen.add(pr.id);
      let v = this.pirateViews.get(pr.id);
      if (!v) {
        v = { img: sprite(this, pr.type, pr.x, pr.y).setDepth(D.pirate), glint: sprite(this, 'glintPirate', pr.x, pr.y).setDepth(D.glint).setBlendMode(Phaser.BlendModes.ADD) };
        this.pirateViews.set(pr.id, v);
      }
      this.syncPirate(pr, v, visAt, glintRange, classic);
    }
    for (const [id, v] of this.pirateViews) if (!seen.has(id)) { v.img.destroy(); v.glint.destroy(); v.mark?.destroy(); this.pirateViews.delete(id); }

    // ---- animals
    seen.clear();
    for (const a of s.animals) {
      seen.add(a.id);
      let v = this.animalViews.get(a.id);
      if (!v) {
        v = { img: sprite(this, a.type, a.x, a.y).setDepth(D.animal), glint: sprite(this, 'glintAnimal', a.x, a.y).setDepth(D.glint).setBlendMode(Phaser.BlendModes.ADD).setTint(GLINT_COLOR[a.type]) };
        this.animalViews.set(a.id, v);
      }
      this.syncAnimal(a, v, visAt, glintRange, classic);
    }
    for (const [id, v] of this.animalViews) if (!seen.has(id)) { v.img.destroy(); v.glint.destroy(); v.halo?.destroy(); this.animalViews.delete(id); }

    // ---- shots
    seen.clear();
    for (const sh of s.shots) {
      seen.add(sh.id);
      let v = this.shotViews.get(sh.id);
      if (!v) {
        v = { ball: sprite(this, sh.kind === 'net' ? 'netShot' : sh.kind === 'keg' ? 'keg' : 'ball').setDepth(sh.kind === 'keg' ? D.glint + 0.2 : D.air), target: sprite(this, sh.kind === 'net' ? 'targetNet' : 'target', sh.tx, sh.ty).setDepth(D.glint) };
        this.shotViews.set(sh.id, v);
      }
      const k = clamp(sh.t / sh.dur, 0, 1);
      if (sh.kind === 'keg') {
        // A keg sits where it was dropped, fuse hissing faster as it burns down.
        const beat = Math.sin(sh.t * (8 + k * 30));
        v.ball.setPosition(sh.tx, sh.ty).setScale(0.5 * (1 + 0.12 * beat)).setRotation(Math.sin(sh.t * 3) * 0.2).setTint(beat > 0.5 && k > 0.4 ? 0xffb0a0 : 0xffffff);
        v.target.setScale(((sh.r * 2) / 232) * (0.4 + k * 0.6)).setAlpha(0.3 + k * 0.6).setRotation(this.t * 0.8);
        this.light(sh.tx, sh.ty, 40, 0.8);
        continue;
      }
      const arc = Math.sin(k * Math.PI);
      v.ball.setPosition(sh.x0 + (sh.tx - sh.x0) * k, sh.y0 + (sh.ty - sh.y0) * k - arc * 110).setScale(0.5 * (1 + arc * 0.9)).setRotation(this.t * 6);
      v.target.setScale(((sh.r * 2) / 232) * (1.25 - k * 0.25)).setAlpha(0.35 + k * 0.6).setRotation(this.t * 0.8);
    }
    for (const [id, v] of this.shotViews) if (!seen.has(id)) { v.ball.destroy(); v.target.destroy(); this.shotViews.delete(id); }

    // ---- crystal beams
    while (this.beamImgs.length < s.beams.length) this.beamImgs.push(sprite(this, 'beam').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.beam));
    this.beamImgs.forEach((img, i) => {
      const b = s.beams[i];
      if (!b) { img.setVisible(false); return; }
      const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      img.setVisible(true).setPosition(b.x1, b.y1).setRotation(Math.atan2(b.y2 - b.y1, b.x2 - b.x1)).setScale(len / 512, 0.5 + Math.sin(this.t * 9 + i) * 0.08).setAlpha(0.8);
    });

    this.syncBoss(visAt);
    this.syncArrows();
    if (this.debug) this.drawDebug(R);

    // ---- darkness
    let darkA = s.env.dark;
    if (s.spec.mutators.seeAll) darkA = 0.2;
    else {
      const k = Math.max(s.env.flash / 0.6, p.flareT / TUNE.lantern.flareTime * 0.6);
      darkA *= 1 - Math.min(1, k) * 0.8;
    }
    this.dark.clear();
    this.dark.fill(this.darkColor, darkA);
    if (this.lightN > 0) this.dark.erase(this.lamps.slice(0, this.lightN));
  }

  /** Edge-of-screen pointers to things worth sailing to: freed animals, home when towing, the captain, a bottle. */
  private syncArrows() {
    const s = this.sim, p = s.player;
    const targets: { x: number; y: number; tint: number }[] = [];
    if (s.status === 'running') {
      for (const a of s.animals) if (a.state === 'freed') targets.push({ x: a.x, y: a.y, tint: 0xbfffe6 });
      if (p.towed.length > 0 && s.zones.length > 0) {
        const z = s.zones.reduce((m, q) => (dist(q.x, q.y, p.x, p.y) < dist(m.x, m.y, p.x, p.y) ? q : m));
        targets.push({ x: z.x, y: z.y, tint: 0xbfffe6 });
      }
      if (s.spec.kind === 'convoy') for (const a of s.animals) if (a.state === 'netted') targets.push({ x: a.x, y: a.y, tint: 0xff8a8a });
      if (s.spec.kind === 'rescue') for (const pr of s.pirates) if (pr.netted.length > 0) targets.push({ x: pr.x, y: pr.y, tint: 0xff8a8a });
      const b = s.boss;
      if (b && !b.hidden && b.dying <= 0) targets.push({ x: b.x, y: b.y, tint: 0xff6b6b });
      for (const k of s.pickups) if (k.type === 'bottle') targets.push({ x: k.x, y: k.y, tint: 0xffe9a8 });
      for (const m of s.markers) targets.push({ x: m.x, y: m.y, tint: 0xffe14a });
      for (const q of s.beacons) if (!q.lit) targets.push({ x: q.x, y: q.y, tint: 0xffe9a8 });
    }
    while (this.arrowImgs.length < targets.length) this.arrowImgs.push(sprite(this, 'arrow').setDepth(D.text));
    const inset = 30, cx = this.viewX + VIEW_W / 2, cy = this.viewY + VIEW_H / 2;
    const hw = VIEW_W / 2 - inset, hh = VIEW_H / 2 - inset;
    this.arrowImgs.forEach((img, i) => {
      const tg = targets[i];
      if (!tg) { img.setVisible(false); return; }
      const dx = tg.x - cx, dy = tg.y - cy;
      if (Math.abs(dx) < hw && Math.abs(dy) < hh) { img.setVisible(false); return; }
      const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
      img.setVisible(true).setPosition(cx + dx * k, cy + dy * k).setRotation(Math.atan2(dy, dx)).setTint(tg.tint)
        .setAlpha(0.6 + 0.35 * Math.sin(this.t * 5)).setScale(0.42 + 0.04 * Math.sin(this.t * 5));
    });
  }

  private drawDebug(R: number) {
    const s = this.sim, p = s.player, g = this.overlay;
    g.lineStyle(1, 0xffc24a, 0.8).strokeCircle(p.x, p.y, R);
    g.lineStyle(1.5, 0x9dff7a, 1).strokeCircle(p.x, p.y, p.r);
    for (const h of s.hazards) g.lineStyle(1, h.hurts && h.exposed ? 0xff6b6b : 0x6fe8ff, 0.9).strokeCircle(h.x, h.y, h.type === 'whirlpool' ? 26 : h.r * (h.pushable ? 1 : 0.9));
    for (const pr of s.pirates) { g.lineStyle(1, 0xff6b6b, 1).strokeCircle(pr.x, pr.y, pr.r); g.lineBetween(pr.x, pr.y, pr.x + Math.cos(pr.angle) * 30, pr.y + Math.sin(pr.angle) * 30); }
    for (const a of s.animals) g.lineStyle(1, 0xffffff, 1).strokeCircle(a.x, a.y, a.r);
    for (const z of s.zones) g.lineStyle(1, 0xbfffe6, 0.8).strokeCircle(z.x, z.y, z.r);
    if (s.boss) g.lineStyle(1.5, 0xff4dff, 1).strokeCircle(s.boss.x, s.boss.y, s.boss.r);
    const lines = [
      `fps ${Math.round(this.game.loop.actualFps)}  seed ${s.spec.seed}  ${s.spec.biome}/${s.spec.kind}  diff ${s.spec.difficulty}  ${s.status}`,
      `speed ${Math.round(Math.hypot(p.vx, p.vy))}  oil ${p.oil.toFixed(2)}  lantern ${Math.round(R)}  combo ${s.combo} x${s.mult}`,
      ...s.pirates.map((q) => `${q.type.padEnd(10)} ${q.state.padEnd(8)} hp ${q.hp}${q.stun > 0 ? ' stun' : ''}`),
      s.boss ? `${s.boss.kind} ${s.boss.state} hp ${s.boss.hp} phase ${s.boss.phase}${s.boss.shield ? ' shield' : ''}${s.boss.hidden ? ' hidden' : ''}` : '',
    ];
    this.debugText.setText(lines.filter(Boolean)).setPosition(this.viewX + 8, this.viewY + 150);
  }

  private syncHazard(h: Hazard, img: Img) {
    const s = this.sim;
    // Foam laps around anything solid that breaks the surface.
    if (h.solid && h.type !== 'floe') {
      let foam = this.hazardFoam.get(h.id);
      if (!foam) { foam = sprite(this, 'foamring', h.x, h.y).setDepth(D.wake + 0.5); this.hazardFoam.set(h.id, foam); }
      const breathe = Math.sin(this.t * 1.4 + h.id * 1.7);
      foam.setPosition(h.x, h.y).setRotation(h.rot * 0.5 + this.t * 0.05 * (h.id % 2 ? 1 : -1))
        .setScale(((h.r * 2 + 22) / 232) * (1 + breathe * 0.04)).setAlpha(h.type === 'reef' && !h.exposed ? 0 : 0.55 + breathe * 0.2);
    }
    const base = (h.r * 2) / (h.type === 'iceberg' ? 220 : h.type === 'floe' ? 104 : h.type === 'lilypad' ? 204 : h.type === 'root' ? 176 : h.type === 'crystal' ? 176 : h.type === 'reef' ? 192 : h.type === 'wreck' ? 216 : 632);
    img.setPosition(h.x, h.y).setRotation(h.rot);
    if (h.type !== 'floe' || img.scale > 0.05) {
      const wob = h.type === 'iceberg' || h.type === 'floe' ? 1 + Math.sin(this.t * 1.3 + h.id) * 0.012 : 1;
      if (!this.tweens.isTweening(img)) img.setScale(base * wob);
    }
    if (h.type === 'reef') {
      const warn = !h.exposed && s.env.tideSwitchIn < 1.3 && Math.floor(this.t * 8) % 2 === 0;
      img.setAlpha(h.exposed ? 1 : warn ? 0.6 : 0.28).setTint(h.exposed ? 0xffffff : 0x66c8d8);
      if (h.exposed && s.env.tideSwitchIn < 1.3) img.setAlpha(Math.floor(this.t * 8) % 2 === 0 ? 0.7 : 1);
    }
    if (h.type === 'crystal') img.setAlpha(0.92 + Math.sin(this.t * 2 + h.id) * 0.08);
  }

  private syncPirate(pr: Pirate, v: { img: Img; glint: Img; mark?: Img }, visAt: (x: number, y: number) => number, glintRange: number, classic: boolean) {
    const s = this.sim, p = s.player;
    const big = s.spec.mutators.bigHeads ? 1.5 : 1;
    const bob = 1 + Math.sin(this.t * 2.6 + pr.phase) * 0.025;
    let vis = visAt(pr.x, pr.y);
    if (pr.type === 'ghost' && !revealAll(s)) {
      const d = dist(pr.x, pr.y, p.x, p.y);
      const R = lanternRadius(s);
      vis = Math.max(s.moonPatches.some((m) => dist(m.x, m.y, pr.x, pr.y) < m.r) ? 0.9 : 0, 1 - smooth(R * 0.3, R * 0.55, d), p.sonarPulse > 0 ? 0.5 : 0);
    }
    if (pr.type === 'douser') v.img.setTexture(pr.lantern ? 'douserLit' : 'douser');
    v.img.setPosition(pr.x, pr.y).setRotation(pr.angle);
    if (pr.state === 'spawning') { v.img.setAlpha(0); v.glint.setAlpha(0); return; }
    if (pr.state === 'sinking') {
      const k = clamp(pr.t / 0.7, 0, 1);
      v.img.setAlpha(k * vis).setScale(0.5 * big * (0.5 + k * 0.5)).setRotation(pr.angle + (1 - k) * 1.6);
      v.glint.setAlpha(0);
      return;
    }
    const windup = pr.state === 'windup' ? 1 + Math.sin(this.t * 40) * 0.05 : 1;
    v.img.setScale(0.5 * big * bob * windup).setAlpha(vis * (pr.type === 'ghost' ? 0.85 : 1));
    v.img.setTint(pr.hitCd > 0.2 ? 0xff9a9a : pr.stun > 0 ? 0xc9d4ff : 0xffffff);
    // Moving ships leave a wake you can follow even at the edge of the light.
    const prSpeed = Math.hypot(pr.vx, pr.vy);
    if (vis > 0.25 && prSpeed > 70 && Math.random() < prSpeed / 2600) this.foam.emitParticleAt(pr.x - Math.cos(pr.angle) * pr.r, pr.y - Math.sin(pr.angle) * pr.r, 1);
    // Lantern pool + glint in the dark.
    const d = dist(pr.x, pr.y, p.x, p.y);
    const lit = pr.lantern && !classic;
    if (lit) this.light(pr.x - Math.cos(pr.angle) * pr.r, pr.y - Math.sin(pr.angle) * pr.r, 44, 0.55);
    const range = 1 - smooth(glintRange * 0.75, glintRange, d);
    const tw = 0.7 + 0.3 * Math.sin(this.t * 5 + pr.phase * 3);
    v.glint.setPosition(pr.x - Math.cos(pr.angle) * pr.r + Math.sin(this.t * 2.2 + pr.phase) * 3, pr.y - Math.sin(pr.angle) * pr.r)
      .setAlpha(lit ? (1 - vis) * range * tw : 0).setScale(0.5 * (0.8 + 0.25 * Math.sin(this.t * 3 + pr.phase)));
    // Stun stars.
    if (pr.stun > 0.05 && vis > 0.3) {
      if (!v.mark) v.mark = sprite(this, 'star', pr.x, pr.y, 0.7).setDepth(D.text);
      v.mark.setPosition(pr.x + Math.cos(this.t * 6) * 14, pr.y - pr.r - 10 + Math.sin(this.t * 6) * 4).setVisible(true);
    } else v.mark?.setVisible(false);
    // Douser charge telegraph line.
    if (pr.state === 'windup' && vis > 0.05) {
      this.overlay.lineStyle(3, 0xff6b6b, 0.5 * (0.5 + 0.5 * Math.sin(this.t * 30)));
      this.overlay.lineBetween(pr.x, pr.y, pr.x + Math.cos(pr.angle) * 320, pr.y + Math.sin(pr.angle) * 320);
    }
  }

  private syncAnimal(a: Animal, v: { img: Img; glint: Img; halo?: Img }, visAt: (x: number, y: number) => number, glintRange: number, classic: boolean) {
    const p = this.sim.player;
    const beacon = a.state === 'freed';
    let vis = visAt(a.x, a.y);
    if (beacon || a.state === 'towed' || a.state === 'safe') vis = Math.max(vis, 0.9);
    let scale = a.type === 'marshmallow' ? 1 : 0.92;
    let y = a.y;
    if (a.state === 'hop') { const k = clamp(a.t / 0.65, 0, 1); const arc = Math.sin(k * Math.PI); scale *= 1 + arc * 0.5; y -= arc * 16; }
    const wiggle = a.state === 'dazed' ? Math.sin(this.t * 20) * 0.3 : a.state === 'freed' ? Math.sin(this.t * 8 + a.phase) * 0.25 : Math.sin(this.t * 4 + a.phase) * 0.08;
    v.img.setPosition(a.x, y).setRotation(a.angle + wiggle).setScale(0.5 * scale * (1 + Math.sin(this.t * 3 + a.phase) * 0.03)).setAlpha(vis * (a.state === 'netted' ? 0.85 : 1));
    v.img.setDepth(a.state === 'netted' ? D.pirate + 0.1 : a.state === 'hop' ? D.player + 0.5 : D.animal);
    const d = dist(a.x, a.y, p.x, p.y);
    const range = 1 - smooth(glintRange * 0.6, glintRange * 0.85, d);
    const quiet = a.state === 'netted' || a.state === 'safe' || a.state === 'towed' || classic;
    const blinkNow = Math.sin(this.t * 0.9 + a.phase * 7) > 0.96 ? 0.1 : 1;
    v.glint.setPosition(a.x + Math.cos(a.angle) * 6, y + Math.sin(a.angle) * 6).setRotation(a.angle + Math.PI / 2)
      .setAlpha(quiet ? 0 : (1 - vis) * range * 0.9 * blinkNow).setScale(0.42);
    if (beacon) {
      if (!v.halo) v.halo = sprite(this, 'ring', a.x, a.y, 0.3).setDepth(D.glint).setTint(0xbfffe6);
      const k = (this.t * 1.2 + a.phase) % 1;
      v.halo.setPosition(a.x, a.y).setScale(0.12 + k * 0.3).setAlpha((1 - k) * 0.9).setVisible(true);
      this.light(a.x, a.y, 48, 0.8);
    } else v.halo?.setVisible(false);
    if (a.state === 'towed' || a.state === 'safe') this.light(a.x, a.y, 30, 0.6);
  }

  private syncBoss(visAt: (x: number, y: number) => number) {
    const s = this.sim, b = s.boss;
    if (!b) {
      if (this.bossView) { this.bossView.img.destroy(); this.bossView.extra?.destroy(); this.bossView.glint.destroy(); this.bossView = null; }
      return;
    }
    if (!this.bossView) {
      const extraKey = b.kind === 'ember' ? 'shield' : b.kind === 'netmaker' ? 'bignet' : null;
      this.bossView = {
        img: sprite(this, b.kind, b.x, b.y).setDepth(D.pirate + 0.2),
        extra: extraKey ? sprite(this, extraKey, b.x, b.y).setDepth(D.glint) : undefined,
        glint: sprite(this, 'glintPirate', b.x, b.y, 1.6).setDepth(D.glint).setBlendMode(Phaser.BlendModes.ADD),
      };
    }
    const v = this.bossView;
    const p = s.player;
    let vis = Math.max(visAt(b.x, b.y), 1 - smooth(200, 420, dist(b.x, b.y, p.x, p.y)));
    if (b.kind === 'bogqueen') vis = b.hidden ? 0 : 1;
    if (b.kind === 'galleon' && b.phase === 3) vis = b.hidden ? Math.min(vis, 0.08) : 1;
    if (b.kind !== 'bogqueen' && !(b.kind === 'galleon' && b.phase === 3)) vis = Math.max(vis, 0.35);
    // Once a captain starts sinking it must stay sunk: the death timer running out must not bring the sprite back.
    const dying = b.state === 'dying' ? clamp(b.dying / 2.2, 0, 1) : 1;
    const shake = b.state === 'aim' ? Math.sin(this.t * 50) * 1.5 : 0;
    v.img.setPosition(b.x + shake, b.y).setRotation(b.angle + (1 - dying) * 0.8).setAlpha(vis * dying)
      .setScale(0.5 * (1 + Math.sin(this.t * 2) * 0.015) * (0.6 + 0.4 * dying))
      .setTint(b.hitCd > 0.45 ? 0xff9a9a : b.stun > 0 || b.state === 'stunned' ? 0xc9d4ff : 0xffffff);
    if (vis > 0.5 && b.dying <= 0) this.light(b.x, b.y, b.r * 2.2, 0.7);
    v.glint.setPosition(b.x - Math.cos(b.angle) * b.r, b.y - Math.sin(b.angle) * b.r).setAlpha(b.kind === 'bogqueen' || b.hidden ? 0 : (1 - vis) * 0.9);
    if (v.extra) {
      if (b.kind === 'ember') v.extra.setPosition(b.x, b.y).setAlpha(b.shield && b.dying <= 0 ? 0.9 : 0).setScale(((b.r * 2 + 36) / 400) * (1 + Math.sin(this.t * 5) * 0.03)).setRotation(this.t * 0.6);
      if (b.kind === 'netmaker') {
        const prog = Math.abs(b.circle) / (Math.PI * 2 * 0.94);
        v.extra.setPosition(b.x, b.y).setAlpha(b.shield && b.dying <= 0 ? 0.85 : 0).setScale((b.r * 2 + 60) / 520).setRotation(this.t * 0.2);
        // Progress ring: how far round you have sailed.
        if (b.shield && prog > 0.02) {
          this.overlay.lineStyle(6, 0xffe14a, 0.9).beginPath().arc(b.x, b.y, b.r + 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, prog) * Math.sign(b.circle || 1), b.circle < 0).strokePath();
        }
      }
    }
    // Charge telegraph.
    if (b.state === 'aim') {
      const a = 0.35 + 0.35 * Math.sin(this.t * 24);
      this.overlay.lineStyle(b.r * 1.4, 0xff4d4d, a * 0.35);
      this.overlay.lineBetween(b.x, b.y, b.x + Math.cos(b.angle) * 900, b.y + Math.sin(b.angle) * 900);
    }
    if ((b.stun > 0 || b.state === 'stunned') && b.dying <= 0) {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 4 + (i * Math.PI * 2) / 3;
        this.overlay.fillStyle(0xffe14a, 1).fillCircle(b.x + Math.cos(a) * 30, b.y - b.r - 8 + Math.sin(a) * 8, 5);
      }
    }
  }
}
