import { BIOMES, PIRATES, PIRATE_INTRO, TUNE } from '../content';
import { Rng } from '../core/rng';
import { dist } from '../core/math';
import {
  BIOME_ORDER,
  type Animal, type AnimalType, type BiomeId, type Boss, type BossKind, type Hazard, type HazardType,
  type LegSpec, type LegState, type Pirate, type PirateType, type Tally,
} from './types';

const HAZARD_R: Record<HazardType, [number, number]> = {
  iceberg: [38, 62], floe: [18, 24], lilypad: [36, 50], root: [26, 40],
  crystal: [28, 44], reef: [30, 48], whirlpool: [150, 150], wreck: [36, 54],
};

export const WHIRLPOOL_CORE = 26;

export function emptyTally(): Tally {
  return {
    kills: 0, rams: 0, killsByType: {}, animalsHit: 0, rescued: 0, rescuedTypes: [], nearMisses: 0, assists: 0,
    maxMult: 1, planksLost: 0, doubloons: 0, pearls: 0, karma: 0, gentleBonus: 0, timeBonus: 0, lostAnimals: 0, bottle: false,
  };
}

export function makeHazard(s: LegState, type: HazardType, x: number, y: number, r: number, rng: Rng): Hazard {
  const hz: Hazard = {
    id: s.nextId++, type, x, y, vx: 0, vy: 0, r,
    rot: rng.range(0, Math.PI * 2), variant: rng.int(0, 2),
    solid: type !== 'lilypad' && type !== 'whirlpool',
    hurts: type !== 'lilypad' && type !== 'floe',
    pushable: type === 'floe',
    exposed: true, nearState: 0, nearCd: 0,
    calveT: type === 'iceberg' ? rng.range(8, 22) : 0,
    shoved: false,
  };
  if (type === 'iceberg') { const a = rng.range(0, Math.PI * 2); hz.vx = Math.cos(a) * 5; hz.vy = Math.sin(a) * 5; }
  return hz;
}

export function makePirate(s: LegState, type: PirateType, x: number, y: number, rng: Rng, spawning = true): Pirate {
  const def = PIRATES[type];
  return {
    id: s.nextId++, type, x, y, vx: 0, vy: 0, r: def.radius,
    angle: rng.range(0, Math.PI * 2), hp: def.hp,
    state: spawning ? 'spawning' : 'patrol', t: spawning ? 1.1 : 0,
    wx: x, wy: y, lantern: type !== 'douser' && type !== 'ghost',
    fireCd: (def.fireCooldown ?? 0) * rng.range(0.5, 1), stun: 0, hitCd: 0, beamCd: 0, netted: [],
    phase: rng.range(0, 10), dirX: 1, dirY: 0, minion: false,
  };
}

export function makeAnimal(s: LegState, type: AnimalType, x: number, y: number, rng: Rng): Animal {
  return {
    id: s.nextId++, type, x, y, vx: 0, vy: 0, r: type === 'turtle' || type === 'marshmallow' ? 16 : 13,
    angle: rng.range(0, Math.PI * 2), state: 'wander', t: rng.range(0, 2), wx: x, wy: y, captor: -1,
    route: [], routeI: 0, hopX: x, hopY: y, pathI: 0, phase: rng.range(0, 10),
  };
}

/** Find a free spot away from the player, hazards and the arena edge. */
export function findSpot(s: LegState, rng: Rng, r: number, minPlayer: number, margin = 70): { x: number; y: number } {
  let best = { x: s.w / 2, y: s.h / 2 }, bestScore = -Infinity;
  for (let i = 0; i < 40; i++) {
    const x = rng.range(margin, s.w - margin), y = rng.range(margin, s.h - margin);
    const dp = dist(x, y, s.player.x, s.player.y);
    let clear = Infinity;
    for (const h of s.hazards) {
      const core = h.type === 'whirlpool' ? 70 : h.r;
      clear = Math.min(clear, dist(x, y, h.x, h.y) - core - r);
    }
    if (dp >= minPlayer && clear >= 14) return { x, y };
    const score = Math.min(dp - minPlayer, 0) + Math.min(clear - 14, 0) * 3;
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  return best;
}

function placeHazards(s: LegState, rng: Rng, table: Partial<Record<HazardType, number>>, scale: number, keepClear: { x: number; y: number; r: number }[]) {
  const order: HazardType[] = ['whirlpool', 'iceberg', 'wreck', 'reef', 'crystal', 'root', 'lilypad', 'floe'];
  for (const type of order) {
    const n = Math.round((table[type] ?? 0) * (type === 'whirlpool' || type === 'floe' ? 1 : scale));
    for (let i = 0; i < n; i++) {
      const [r0, r1] = HAZARD_R[type];
      const r = rng.range(r0, r1);
      for (let tries = 0; tries < 30; tries++) {
        const m = type === 'whirlpool' ? 220 : 60;
        const x = rng.range(m, s.w - m), y = rng.range(m, s.h - m);
        let ok = true;
        for (const k of keepClear) if (dist(x, y, k.x, k.y) < k.r + r) { ok = false; break; }
        if (!ok) continue;
        for (const h of s.hazards) {
          const gap = type === 'lilypad' || h.type === 'lilypad' ? 12 : type === 'whirlpool' || h.type === 'whirlpool' ? -60 : 74;
          if (dist(x, y, h.x, h.y) < h.r + r + gap) { ok = false; break; }
        }
        if (!ok) continue;
        s.hazards.push(makeHazard(s, type, x, y, r, rng));
        break;
      }
    }
  }
}

export function pickPirateType(s: LegState, rng: Rng): PirateType {
  const biomeIndex = BIOME_ORDER.indexOf(s.spec.biome);
  const mix = BIOMES[s.spec.biome].pirateMix;
  const table: Partial<Record<PirateType, number>> = {};
  for (const k of Object.keys(mix) as PirateType[]) {
    if (PIRATE_INTRO[k] > biomeIndex && !(k === 'douser' && s.spec.kind === 'beacons')) continue;
    let w = mix[k] ?? 0;
    // Ease new players in: tougher ships are rarer at low difficulty.
    if ((k === 'brigantine' || k === 'douser') && s.spec.difficulty < 1) w *= 0.5;
    if (k === 'douser' && s.spec.kind === 'beacons') w = Math.max(w, 1.5);
    // Netters only matter where there is someone to catch.
    if (k === 'netter' && s.zones.length === 0) w = 0;
    // Heat: the more pirates you sink, the tougher the ships that come looking for you.
    if (k !== 'dinghy' && k !== 'netter') w *= 1 + s.tally.kills * TUNE.sea[s.spec.sea].heat;
    table[k] = w;
  }
  return rng.weighted(table);
}

function animalTypeFor(biome: BiomeId, rng: Rng): AnimalType {
  const a = BIOMES[biome].animal;
  return a === 'mixed' ? rng.pick<AnimalType>(['pingo', 'zabica', 'ribica', 'turtle']) : a;
}

function assignFrogRoutes(s: LegState, rng: Rng) {
  const pads = s.hazards.filter((h) => h.type === 'lilypad');
  if (pads.length < 2) return;
  for (const a of s.animals) {
    if (a.type !== 'zabica') continue;
    const start = rng.pick(pads);
    const near = pads.filter((p) => p !== start).sort((p, q) => dist(p.x, p.y, start.x, start.y) - dist(q.x, q.y, start.x, start.y)).slice(0, 3);
    const route = [start, ...near.filter((p) => dist(p.x, p.y, start.x, start.y) < 420)];
    if (route.length < 2) continue;
    a.route = route.map((p) => p.id);
    a.routeI = 0;
    a.x = start.x; a.y = start.y; a.state = 'sit'; a.t = rng.range(1.2, 3.2);
  }
}

export function makeBoss(kind: BossKind, x: number, y: number, extraHp = 0): Boss {
  const base: Record<BossKind, number> = { frostbeard: 7, bogqueen: 6, ember: 6, netmaker: 5, galleon: 18 };
  const hp = { [kind]: base[kind] + extraHp } as Record<BossKind, number>;
  const r: Record<BossKind, number> = { frostbeard: 44, bogqueen: 42, ember: 40, netmaker: 46, galleon: 60 };
  return {
    kind, x, y, vx: 0, vy: 0, r: r[kind], hp: hp[kind], maxHp: hp[kind], angle: Math.PI / 2,
    state: 'intro', t: 2, phase: 1, stun: 0, shield: kind === 'ember' || kind === 'netmaker', hidden: false, hitCd: 0,
    dirX: 0, dirY: 1, fireCd: 3, spawnCd: 4, circle: 0, lastAng: 0, shotsLeft: 0, dying: 0, orbit: 0,
  };
}

export function createLeg(spec: LegSpec): LegState {
  const rng = new Rng(spec.seed);
  const biome = BIOMES[spec.biome];
  const classic = spec.kind === 'classic';
  const sea = TUNE.sea[spec.sea];
  const boss = spec.kind === 'boss';
  const tutorial = spec.kind === 'tutorial';
  const w = classic ? 1120 : tutorial ? 1500 : boss ? 1800 : TUNE.arena.width;
  const h = classic ? 630 : tutorial ? 900 : boss ? 1200 : TUNE.arena.height;
  const crew = spec.loadout.crew;
  const maxPlanks = spec.loadout.maxPlanks + (crew.includes('turtle') ? 1 : 0) + spec.assist.extraPlanks;
  const planks = Math.min(maxPlanks, spec.loadout.planks + (crew.includes('turtle') ? 1 : 0) + spec.assist.extraPlanks);

  const s: LegState = {
    spec, w, h, time: 0, timeLeft: spec.duration, timed: !boss && !tutorial && spec.kind !== 'bounty' && spec.kind !== 'beacons', status: 'ready', endT: 0,
    player: {
      x: classic ? 980 : w / 2, y: classic ? 96 : boss ? h - 220 : h / 2, vx: 0, vy: 0,
      r: TUNE.boat.radius * (spec.mutators.tinyBoat ? 0.6 : 1), angle: classic ? Math.PI : -Math.PI / 2,
      boostT: 0, boostCd: 0, planks, maxPlanks, invuln: 0, oil: spec.loadout.oil, flareCd: 0, flareT: 0, onPad: false, snare: 0,
      towed: [], freeHit: crew.includes('pingo'), hopReady: crew.includes('zabica'), barkReady: crew.includes('marshmallow'),
      sonarT: 6, sonarPulse: 0,
    },
    pirates: [], animals: [], hazards: [], pickups: [], shots: [], zones: [], beams: [], moonPatches: [], markers: [], beacons: [],
    boss: null,
    env: {
      dark: spec.kind === 'storm' ? 0.95 : biome.dark, flash: 0, aurora: 0, auroraT: rng.range(6, 11), lightningT: rng.range(2, 4),
      tide: 0, reefExposed: true, tideSwitchIn: 6, windX: 0, windY: 0, storm: spec.kind === 'storm',
    },
    score: 0, combo: 0, comboT: 0, mult: 1,
    baseScore: classic ? (spec.classicLevel ?? 1) * 100 : biome.baseScore,
    targetPirates: 0, spawnQueue: [], timeBonusGiven: 0, goal: 0,
    tally: emptyTally(), tutorial: null, convoyPath: [], events: [], nextId: 1,
    rng: rng.fork(),
  };

  if (classic) { s.player.planks = 1; s.player.maxPlanks = 1; buildClassic(s, rng); return s; }
  if (tutorial) { buildTutorial(s, rng); return s; }

  const keepClear = [{ x: s.player.x, y: s.player.y, r: 240 }];
  const biomeIndex = BIOME_ORDER.indexOf(spec.biome);

  // Safe zones: wherever animals can be captured (netters exist) or need a home.
  const wantsZones = spec.kind === 'rescue' || spec.kind === 'convoy' || biomeIndex >= 1 || (boss && biome.boss === 'netmaker');
  if (spec.kind === 'convoy') {
    s.zones.push({ x: w - 190, y: h / 2 + rng.range(-200, 200), r: 120 });
  } else if (wantsZones && !(boss && biome.boss !== 'netmaker' && biome.boss !== 'galleon')) {
    s.zones.push({ x: rng.range(220, w * 0.35), y: rng.range(220, h - 220), r: 105 });
    if (!boss) s.zones.push({ x: rng.range(w * 0.65, w - 220), y: rng.range(220, h - 220), r: 105 });
  }
  for (const z of s.zones) keepClear.push({ x: z.x, y: z.y, r: z.r + 50 });

  // Beacons to relight: one per quarter of the arena, so the player has to cross the dark to reach them.
  if (spec.kind === 'beacons') {
    const quarters = rng.shuffle([[0.2, 0.22], [0.8, 0.22], [0.2, 0.78], [0.8, 0.78], [0.5, 0.12], [0.5, 0.88]]).slice(0, spec.difficulty >= 4 ? 6 : 5);
    for (const [qx, qy] of quarters) {
      const bx = w * qx + rng.range(-150, 150), by = h * qy + rng.range(-110, 110);
      s.beacons.push({ x: bx, y: by, lit: false, douse: 0, charge: 0 });
      keepClear.push({ x: bx, y: by, r: 95 });
    }
    s.goal = s.beacons.length;
  }

  if (boss) {
    keepClear.push({ x: w / 2, y: 300, r: 220 });
    const table: Partial<Record<HazardType, number>> =
      biome.boss === 'frostbeard' ? { iceberg: 8, floe: 3 } :
      biome.boss === 'bogqueen' ? { lilypad: 9, root: 5 } :
      biome.boss === 'ember' ? { crystal: 9 } :
      biome.boss === 'netmaker' ? { reef: 7 } : { wreck: 5, whirlpool: 0 };
    placeHazards(s, rng, table, 1, keepClear);
    s.boss = makeBoss(biome.boss, w / 2, 300, sea.bossHp);
    if (biome.boss === 'netmaker') {
      // A broken ring of reef around him: the circle you must sail to cut his net is not a clear run, and it changes with the tide.
      const a0 = rng.range(0, Math.PI * 2);
      for (let i = 0; i < 5; i++) {
        const a = a0 + (i / 5) * Math.PI * 2 + rng.range(-0.15, 0.15);
        const rr = rng.range(205, 240);
        s.hazards.push(makeHazard(s, 'reef', w / 2 + Math.cos(a) * rr, 300 + Math.sin(a) * rr, rng.range(26, 34), rng));
      }
    }
    s.targetPirates = 0;
    if (biome.boss === 'galleon') for (let i = 0; i < 4; i++) s.moonPatches.push({ x: rng.range(250, w - 250), y: rng.range(250, h - 250), r: 170 });
    if (biome.boss === 'netmaker') s.goal = 0;
    return s;
  }

  // Convoy lane must stay reasonably open.
  if (spec.kind === 'convoy') {
    const y0 = h / 2 + rng.range(-150, 150);
    const zone = s.zones[0];
    s.convoyPath = [
      { x: 150, y: y0 },
      { x: w * 0.3, y: y0 + rng.range(-220, 220) },
      { x: w * 0.6, y: (y0 + zone.y) / 2 + rng.range(-160, 160) },
      { x: zone.x, y: zone.y },
    ];
    for (let i = 0; i < s.convoyPath.length - 1; i++) {
      const a = s.convoyPath[i], b = s.convoyPath[i + 1];
      for (let k = 0; k <= 4; k++) keepClear.push({ x: a.x + (b.x - a.x) * (k / 4), y: a.y + (b.y - a.y) * (k / 4), r: 80 });
    }
    s.player.x = 330; s.player.y = y0;
    keepClear[0] = { x: s.player.x, y: s.player.y, r: 220 };
  }

  const hazardScale = (0.85 + Math.min(0.4, spec.difficulty * 0.08)) * sea.hazards;
  placeHazards(s, rng, biome.hazards, hazardScale, keepClear);

  if (spec.biome === 'deep') for (let i = 0; i < 5; i++) s.moonPatches.push({ x: rng.range(200, w - 200), y: rng.range(200, h - 200), r: rng.range(130, 180) });

  // Animals.
  if (spec.kind === 'convoy') {
    const type = animalTypeFor(spec.biome, rng);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = makeAnimal(s, type, s.convoyPath[0].x - i * 34, s.convoyPath[0].y + (i % 2 ? 16 : -16), rng);
      a.state = 'convoy'; a.pathI = 1;
      s.animals.push(a);
    }
    s.goal = 3;
  } else {
    const n = biome.animals + (spec.kind === 'rescue' ? -1 : 0);
    for (let i = 0; i < n; i++) {
      const type = animalTypeFor(spec.biome, rng);
      const p = findSpot(s, rng, 16, 260);
      s.animals.push(makeAnimal(s, type, p.x, p.y, rng));
    }
    assignFrogRoutes(s, rng);
  }

  // Pirates.
  let count = biome.pirates + Math.min(3, Math.floor(spec.difficulty / 2)) + sea.pirates;
  if (spec.kind === 'storm') count -= 1;
  if (spec.kind === 'bounty') { count += 1; s.goal = Math.min(15, TUNE.untimed.bountyGoal + Math.floor(spec.difficulty)); }
  if (spec.kind === 'convoy') count -= 1;
  s.targetPirates = count;

  if (spec.kind === 'rescue') {
    // Netters start with full nets; the goal is to free and deliver.
    const netters = 3;
    s.goal = 3;
    for (let i = 0; i < netters; i++) {
      const p = findSpot(s, rng, 30, 380);
      const pr = makePirate(s, 'netter', p.x, p.y, rng, false);
      s.pirates.push(pr);
      for (let k = 0; k < 2; k++) {
        const a = makeAnimal(s, animalTypeFor(spec.biome, rng), p.x, p.y, rng);
        a.state = 'netted'; a.captor = pr.id; pr.netted.push(a.id);
        s.animals.push(a);
      }
    }
  }
  // Beacon legs always bring Lantern-Dousers: they are the ones who put the lights out.
  if (spec.kind === 'beacons') for (let i = 0; i < 2; i++) { const p = findSpot(s, rng, 16, 480); s.pirates.push(makePirate(s, 'douser', p.x, p.y, rng, false)); }
  while (s.pirates.length < count) {
    const type = spec.kind === 'convoy' && s.pirates.length < 2 ? 'netter' : pickPirateType(s, rng);
    const p = findSpot(s, rng, PIRATES[type].radius, 420);
    s.pirates.push(makePirate(s, type, p.x, p.y, rng, false));
  }

  // A message in a bottle bobs somewhere out in the dark.
  if (spec.bottle) {
    const p = findSpot(s, rng, 12, 420);
    s.pickups.push({ id: s.nextId++, type: 'bottle', x: p.x, y: p.y, vx: 0, vy: 0, t: 9999, phase: rng.range(0, 10) });
  }

  // Swamp fireflies.
  if (spec.biome === 'swamp') {
    for (let i = 0; i < 9; i++) {
      const p = findSpot(s, rng, 8, 150);
      s.pickups.push({ id: s.nextId++, type: 'firefly', x: p.x, y: p.y, vx: 0, vy: 0, t: 9999, phase: rng.range(0, 10) });
    }
  }
  return s;
}

/** Faithful layout of the original three levels on a single screen (800x600 scaled 1.4x). */
function buildClassic(s: LegState, rng: Rng) {
  const lv = s.spec.classicLevel ?? 1;
  const cfg = [
    { hz: 'iceberg' as HazardType, n: 6, pirates: 3, animals: 1, animal: 'pingo' as AnimalType },
    { hz: 'lilypad' as HazardType, n: 7, pirates: 2, animals: 3, animal: 'zabica' as AnimalType },
    { hz: 'crystal' as HazardType, n: 9, pirates: 1, animals: 5, animal: 'ribica' as AnimalType },
  ][lv - 1];
  s.env.dark = 0.8;
  for (let i = 0; i < cfg.n; i++) {
    const r = rng.range(22, 54);
    for (let tries = 0; tries < 60; tries++) {
      const x = rng.range(r, s.w - r), y = rng.range(r, s.h - r);
      // The original kept the top-right start corner clear; do the same.
      if (x > 700 - r && y < 250 + r) continue;
      if (s.hazards.some((h) => dist(x, y, h.x, h.y) < h.r + r + 34)) continue;
      const hz = makeHazard(s, cfg.hz, x, y, r, rng);
      hz.vx = 0; hz.vy = 0; hz.calveT = 0; hz.solid = true; hz.hurts = true;
      s.hazards.push(hz);
      break;
    }
  }
  for (let i = 0; i < cfg.pirates; i++) {
    const p = findSpot(s, rng, 16, 260, 50);
    const pr = makePirate(s, 'dinghy', p.x, p.y, rng, false);
    s.pirates.push(pr);
  }
  for (let i = 0; i < cfg.animals; i++) {
    const p = findSpot(s, rng, 14, 260, 50);
    s.animals.push(makeAnimal(s, cfg.animal, p.x, p.y, rng));
  }
  s.targetPirates = cfg.pirates;
}

function buildTutorial(s: LegState, rng: Rng) {
  s.env.dark = 0.7;
  s.tutorial = { step: 0, t: 0, boosted: false };
  s.player.x = 300; s.player.y = 600;
  s.markers.push({ x: 640, y: 420, r: 46 });
  s.hazards.push(makeHazard(s, 'iceberg', 420, 240, 48, rng));
  s.hazards.push(makeHazard(s, 'iceberg', 1180, 700, 54, rng));
  for (const h of s.hazards) { h.vx = 0; h.vy = 0; h.calveT = 0; }
  s.zones.push({ x: 1250, y: 250, r: 110 });
}
