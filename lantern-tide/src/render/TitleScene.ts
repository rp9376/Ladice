import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../core/input';
import { ZOOM, makeWater, sprite } from './boot';

const HORIZON = 392;
/** Where the galleon's hull meets the sea, and the ship's resting position. */
const WATERLINE = HORIZON + 56;
const SHIP_Y = HORIZON - 92;
const MOON_X = 900;
const MOON_Y = 104;

/** The moonlit backdrop behind every menu: a nod to the original title screen (galleon, moon, night sea). */
export class TitleScene extends Phaser.Scene {
  private moon!: Phaser.GameObjects.Image;
  private ship!: Phaser.GameObjects.Image;
  private stars: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private reflection!: Phaser.GameObjects.Image;
  private foam: Phaser.GameObjects.Ellipse[] = [];
  private clicks: number[] = [];
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private lunar = false;
  /** The Lantern Tide has risen (voyage won): the whole sea glows. */
  private tide = false;
  private t = 0;

  constructor() { super('title'); }

  init(data: { lunar?: boolean; tide?: boolean }) { this.lunar = !!data.lunar; this.tide = !!data.tide; this.stars = []; this.clouds = []; this.foam = []; this.clicks = []; this.t = 0; }

  create() {
    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.centerOn(VIEW_W / 2, VIEW_H / 2);

    const sky = this.add.graphics();
    sky.fillGradientStyle(0x050818, 0x050818, 0x1a3a6e, 0x1a3a6e, 1);
    sky.fillRect(-20, -20, VIEW_W + 40, HORIZON + 20);

    const rng = new Phaser.Math.RandomDataGenerator(['lantern']);
    for (let i = 0; i < 90; i++) {
      const s = sprite(this, 'dot', rng.between(0, VIEW_W), rng.between(0, HORIZON - 40), rng.realInRange(0.12, 0.36)).setAlpha(rng.realInRange(0.3, 0.9));
      s.setData('p', rng.realInRange(0, 6));
      this.stars.push(s);
    }

    this.moon = sprite(this, 'moon', MOON_X, MOON_Y, 0.86).setInteractive(new Phaser.Geom.Circle(256, 256, 150), Phaser.Geom.Circle.Contains);
    this.moon.on('pointerdown', (p: Phaser.Input.Pointer) => this.onMoon(p));
    this.moon.on('pointerup', () => this.holdTimer?.remove());
    this.moon.on('pointerout', () => this.holdTimer?.remove());

    for (let i = 0; i < 4; i++) {
      const c = sprite(this, 'cloud', rng.between(0, VIEW_W), rng.between(40, 250), rng.realInRange(0.7, 1.3)).setAlpha(rng.realInRange(0.5, 0.85));
      c.setData('v', rng.realInRange(3, 9));
      this.clouds.push(c);
    }

    // Far coastline.
    const coast = this.add.graphics();
    coast.fillStyle(0x0c1a3c, 1);
    coast.beginPath(); coast.moveTo(-10, HORIZON + 2);
    for (let x = -10; x <= VIEW_W + 10; x += 40) coast.lineTo(x, HORIZON - 6 - Math.abs(Math.sin(x * 0.011) * 14) - (x > 700 ? Math.sin((x - 700) * 0.012) * 10 : 0));
    coast.lineTo(VIEW_W + 10, HORIZON + 2); coast.closePath(); coast.fillPath();

    const colors: [string, string, string] = this.tide ? ['#06323f', '#12a596', '#e6fff6'] : ['#07102c', '#16386e', '#cfe0ff'];
    const water = makeWater(this, VIEW_W + 40, VIEW_H - HORIZON + 20, colors).setPosition(-20, HORIZON);
    if (water instanceof Phaser.GameObjects.Shader) {
      water.setUniform('moon.value.x', MOON_X + 20);
      water.setUniform('moon.value.y', 1);
      water.setUniform('stretch.value.x', 0.55);
      water.setUniform('stretch.value.y', 2.4);
    }
    if (this.tide) {
      // Glowing motes drift up from the sea.
      this.add.particles(0, 0, 'dot', {
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, HORIZON + 10, VIEW_W, VIEW_H - HORIZON) } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        lifespan: 3600, speedY: { min: -46, max: -16 }, speedX: { min: -8, max: 8 }, scale: { min: 0.12, max: 0.34 },
        alpha: { start: 0.9, end: 0 }, tint: [0x9dffe0, 0xdffff4, 0x7ef0d8], blendMode: 'ADD', frequency: 45,
      });
    }

    // The hull's dark reflection and a line of foam where it meets the water.
    // The hull sits IN the water: a mirrored reflection below, the ship, then water lapping over the keel.
    this.reflection = sprite(this, 'galleonSide', 250, 0, 0.86).setFlipY(true).setAlpha(0.2).setTint(0x1a2c66);
    this.ship = sprite(this, 'galleonSide', 250, SHIP_Y, 0.86);
    for (let i = 0; i < 5; i++) this.add.ellipse(250, WATERLINE + 9 + i * 3, 470 - i * 14, 22, this.tide ? 0x0e7f78 : 0x12306a, 0.34);
    for (let i = 0; i < 11; i++) this.foam.push(this.add.ellipse(52 + i * 40 + rng.between(-8, 8), WATERLINE + rng.between(-2, 3), rng.between(24, 44), 5, 0xcfe0ff, 0.32));

    this.applyLunar();
  }

  setLunar(on: boolean) { this.lunar = on; this.applyLunar(); }
  private applyLunar() { this.moon?.setTint(this.lunar ? 0xb8ffe9 : 0xffffff); }

  /** The moon secret: middle-click, triple-click, or long-press (touch). */
  private onMoon(p: Phaser.Input.Pointer) {
    if (p.middleButtonDown()) { this.fire(); return; }
    const now = this.time.now;
    this.clicks = this.clicks.filter((c) => now - c < 1400);
    this.clicks.push(now);
    if (this.clicks.length >= 3) { this.clicks = []; this.fire(); return; }
    this.holdTimer?.remove();
    this.holdTimer = this.time.delayedCall(900, () => this.fire());
  }

  private fire() {
    this.holdTimer?.remove();
    this.tweens.add({ targets: this.moon, scale: 0.48, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
    this.game.events.emit('moon');
  }

  update(_t: number, dms: number) {
    this.t += dms / 1000;
    for (const s of this.stars) s.setAlpha(0.45 + 0.4 * Math.sin(this.t * 1.3 + (s.getData('p') as number)));
    for (const c of this.clouds) { c.x += (c.getData('v') as number) * (dms / 1000); if (c.x > VIEW_W + 220) c.x = -220; }
    const bob = Math.sin(this.t * 0.8) * 3;
    this.ship.y = SHIP_Y + bob;
    this.ship.rotation = Math.sin(this.t * 0.6) * 0.012;
    // The reflection mirrors the ship about the waterline (squashed, as reflections on water are).
    this.reflection.setScale(0.43, 0.43 * 0.55).setPosition(250, WATERLINE + (WATERLINE - this.ship.y) * 0.55).setRotation(-this.ship.rotation);
    this.foam.forEach((f, i) => { f.setAlpha(0.2 + 0.16 * Math.sin(this.t * 1.7 + i * 1.3)); f.scaleX = 1 + 0.2 * Math.sin(this.t * 1.1 + i); });
  }
}
