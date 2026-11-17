import Phaser from 'phaser';
import { VIEW_W } from '../core/input';
import { ART } from './art';

/** Camera zoom that maps the world view onto the canvas. Set once at startup from the render width. */
export let ZOOM = 1920 / VIEW_W;
export function setRenderWidth(w: number) { ZOOM = w / VIEW_W; }

export const WATER_FRAG = `
// highp matters: some GPUs (Mesa, many phones) run mediump as 16-bit floats, which flattens the noise.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float time;
uniform vec2 resolution;
uniform vec2 scroll;
uniform vec3 colA;
uniform vec3 colB;
uniform vec3 colC;
uniform vec2 moon;
uniform vec2 stretch;
varying vec2 fragCoord;
float hash(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main(){
  vec2 local = vec2(fragCoord.x, resolution.y - fragCoord.y);
  vec2 world = scroll + local;
  // stretch flattens the ripples for the side-on title view (1,1 = top-down).
  vec2 p = world * stretch / 110.0;
  float n = noise(p + vec2(time * 0.10, time * 0.04)) * 0.6 + noise(p * 2.3 - vec2(time * 0.16, -time * 0.06)) * 0.4;
  // Caustic-style ripples: thin bright lines where two drifting noise fields cross.
  float w1 = noise(p * 1.7 + vec2(time * 0.2, time * 0.05));
  float w2 = noise(p * 2.5 - vec2(time * 0.05, time * 0.16) + 11.0);
  float ca = smoothstep(0.90, 1.0, 1.0 - abs(w1 - w2));
  float sp = noise(p * 6.0 + vec2(time * 0.4, 0.0));
  vec3 col = mix(colA, colB, clamp(n * 0.9 + 0.05, 0.0, 1.0));
  col += colC * (ca * 0.13 + smoothstep(0.90, 1.0, sp) * 0.07);
  // Moon reflection streak (title screen): moon.x = x position, moon.y = strength.
  float sx = (local.x - moon.x) / (26.0 + local.y * 0.22);
  float streak = exp(-sx * sx) * moon.y * (0.35 + 0.65 * noise(vec2(local.x * 0.05, local.y * 0.22 - time * 0.9)));
  col += vec3(1.0, 0.97, 0.85) * streak * 0.55;
  gl_FragColor = vec4(col, 1.0);
}`;

export function hexToVec(hex: string): { x: number; y: number; z: number } {
  const n = parseInt(hex.slice(1), 16);
  return { x: ((n >> 16) & 255) / 255, y: ((n >> 8) & 255) / 255, z: (n & 255) / 255 };
}

export function hexToInt(hex: string): number { return parseInt(hex.slice(1), 16); }

export function makeWater(scene: Phaser.Scene, w: number, h: number, colors: [string, string, string]): Phaser.GameObjects.Shader | Phaser.GameObjects.Rectangle {
  if (scene.game.renderer.type !== Phaser.WEBGL) {
    return scene.add.rectangle(0, 0, w, h, hexToInt(colors[1])).setOrigin(0);
  }
  const base = new Phaser.Display.BaseShader('water' + Math.random(), WATER_FRAG, undefined, {
    scroll: { type: '2f', value: { x: 0, y: 0 } },
    colA: { type: '3f', value: hexToVec(colors[0]) },
    colB: { type: '3f', value: hexToVec(colors[1]) },
    colC: { type: '3f', value: hexToVec(colors[2]) },
    moon: { type: '2f', value: { x: 0, y: 0 } },
    stretch: { type: '2f', value: { x: 1, y: 1 } },
  });
  return scene.add.shader(base, 0, 0, w, h).setOrigin(0);
}

/** Rasterises every SVG in the art manifest into a Phaser texture (at 2x for crisp scaling). */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    const jobs = Object.entries(ART).map(([key, a]) => new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { if (!this.textures.exists(key)) this.textures.addImage(key, img); resolve(); };
      img.onerror = () => { console.warn('art failed to load', key); resolve(); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg);
    }));
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) { jobs.push(fonts.load('600 24px Fredoka').then(() => undefined, () => undefined)); }
    void Promise.all(jobs).then(() => this.game.events.emit('boot-done'));
  }
}

/** Image helper: art is rasterised at 2x, so 0.5 scale = designed size. */
export function sprite(scene: Phaser.Scene, key: string, x = 0, y = 0, scale = 1): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setScale(0.5 * scale);
}
