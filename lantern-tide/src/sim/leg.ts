import { BIOMES, PIRATES, TUNE, type PirateDef } from '../content';
import { angDiff, clamp, dist, rotateToward, segCircle } from '../core/math';
import { stepBoss, collideBoss } from './boss';
import { WHIRLPOOL_CORE, findSpot, makeAnimal, makeHazard, makePirate, pickPirateType } from './gen';
import type {
  Animal, Hazard, Input, LegState, LegStatus, Pirate, PirateType, SimEvent,
} from './types';

const B = TUNE.boat;
const L = TUNE.lantern;
const SC = TUNE.score;
const UE = TUNE.upgradeEffects;
const KEG = TUNE.keg;
const UT = TUNE.untimed;

export function seaOf(s: LegState) { return TUNE.sea[s.spec.sea]; }
function hasLight(s: LegState, k: string): boolean { return s.spec.lights.includes(k as never); }

export const FIXED_DT = 1 / 60;

// ---------------------------------------------------------------- derived stats

export function isClassic(s: LegState): boolean { return s.spec.kind === 'classic'; }

export function lanternRadius(s: LegState): number {
  if (isClassic(s)) return 280;
  const up = s.spec.loadout.upgrades;
  const oil = L.minFactor + (1 - L.minFactor) * s.player.oil;
  return L.radius * BIOMES[s.spec.biome].lanternFactor * oil * (1 + up.lantern * UE.lanternRadiusPerLevel)
    * (s.env.aurora > 0 ? 1.35 : 1) * (s.env.storm ? 0.85 : 1) * s.spec.assist.lantern * (hasLight(s, 'frostbeard') ? 1.1 : 1);
}

export function maxSpeed(s: LegState): number {
  const p = s.player;
  const tow = 1 - Math.min(0.45, p.towed.length * B.towSlow);
  const base = (p.boostT > 0 ? B.boostMaxSpeed : B.maxSpeed) * (1 + s.spec.loadout.upgrades.engine * UE.enginePerLevel);
  return base * tow * (p.onPad ? B.padSlow : 1) * (p.snare > 0 ? 0.45 : 1);
}

export function ramSpeed(s: LegState): number {
  return isClassic(s) ? 0 : B.ramSpeed * (1 - s.spec.loadout.upgrades.ram * UE.ramSpeedPerLevel);
}
export function boostCooldown(s: LegState): number { return B.boostCooldown * (1 - s.spec.loadout.upgrades.boost * UE.boostCooldownPerLevel); }
export function flareCooldown(s: LegState): number { return L.flareCooldown * (1 - s.spec.loadout.upgrades.flare * UE.flareCooldownPerLevel) * (hasLight(s, 'ember') ? 0.75 : 1); }

/** Everything is visible (lightning, flare, sonar, or the See-everything mutator). */
export function revealAll(s: LegState): boolean {
  return s.env.flash > 0 || s.player.flareT > 0 || s.spec.mutators.seeAll;
}

/** Fire-rate multiplier: above 1 means pirates shoot more often. Kind captains face calmer guns; depth and rough seas speed them up. */
function fireScale(s: LegState): number {
  const karma = s.spec.karma >= 3 ? 0.85 : s.spec.karma <= -3 ? 1.15 : 1;
  return karma * Math.min(1.4, 1 + 0.035 * s.spec.difficulty) * seaOf(s).fire;
}
function speedScale(s: LegState): number { return (1 + Math.min(0.2, s.spec.difficulty * 0.02)) * seaOf(s).speed; }

// ---------------------------------------------------------------- shared helpers

export function emit(s: LegState, e: SimEvent) { s.events.push(e); }

export function drainEvents(s: LegState): SimEvent[] {
  const e = s.events;
  s.events = [];
  return e;
}

export function addScore(s: LegState, n: number) { s.score += Math.round(n * (isClassic(s) ? 1 : seaOf(s).score)); }

export function endLeg(s: LegState, status: LegStatus) {
  if (s.status !== 'running') return;
  s.status = status;
  if (status === 'won' && !isClassic(s) && s.spec.kind !== 'tutorial') {
    if (s.tally.animalsHit === 0) { s.tally.gentleBonus = SC.gentleCaptain; addScore(s, SC.gentleCaptain); }
    if (s.spec.kind === 'rescue' || s.spec.kind === 'convoy') {
      const bonus = Math.round(Math.max(0, s.timeLeft)) * SC.secondsLeftBonus;
      s.tally.timeBonus = bonus; addScore(s, bonus);
    }
    // Untimed legs pay for speed instead: every second under par is worth a bonus.
    if (s.spec.kind === 'bounty' || s.spec.kind === 'beacons') {
      const par = s.spec.kind === 'bounty' ? UT.bountyPar + (s.goal - UT.bountyGoal) * 5 : UT.beaconPar + (s.goal - 5) * 15;
      const bonus = Math.round(Math.max(0, par - s.time)) * SC.secondsLeftBonus;
      s.tally.timeBonus = bonus; addScore(s, bonus);
    }
  }
  if (status === 'timeout') s.tally.karma -= 1;
  // Anyone still in a net when the leg ends is lost.
  if (s.spec.kind === 'convoy') s.tally.lostAnimals = s.animals.filter((a) => a.state !== 'safe').length;
  emit(s, { type: 'end', status });
}

export function resetCombo(s: LegState) {
  if (s.mult > 1) emit(s, { type: 'comboLost' });
  s.combo = 0; s.comboT = 0; s.mult = 1;
}

export function bumpCombo(s: LegState) {
  if (isClassic(s)) return;
  s.combo++;
  s.comboT = SC.comboWindow;
  const m = SC.comboSteps[Math.min(s.combo - 1, SC.comboSteps.length - 1)];
  if (m > s.mult) { s.mult = m; emit(s, { type: 'comboUp', mult: m }); }
  s.tally.maxMult = Math.max(s.tally.maxMult, s.mult);
}

/** Damage the player's hull. Returns true if a plank was actually lost. */
export function hurtPlayer(s: LegState, by: 'shot' | 'pirate' | 'boss' | 'whirlpool', x: number, y: number): boolean {
  const p = s.player;
  if (s.spec.mutators.invincible || p.invuln > 0 || s.status !== 'running') return false;
  if ((by === 'shot' || by === 'pirate' || by === 'boss') && p.hopReady) {
    p.hopReady = false; p.invuln = 1.0;
    emit(s, { type: 'hop', x: p.x, y: p.y });
    return false;
  }
  losePlank(s);
  emit(s, { type: 'playerHit', x, y, by });
  return true;
}

function losePlank(s: LegState) {
  const p = s.player;
  p.planks -= 1;
  p.invuln = seaOf(s).invuln;
  s.tally.planksLost++;
  resetCombo(s);
  if (p.planks <= 0) {
    emit(s, { type: 'sink', x: p.x, y: p.y });
    endLeg(s, 'lost');
  }
}

export function fireShot(s: LegState, x0: number, y0: number, tx: number, ty: number, dur: number, r: number, kind: 'ball' | 'net' = 'ball') {
  tx = clamp(tx, 20, s.w - 20); ty = clamp(ty, 20, s.h - 20);
  s.shots.push({ id: s.nextId++, x0, y0, tx, ty, t: 0, dur, r, kind });
  emit(s, { type: 'cannonFire', x: x0, y: y0 });
}

export function spawnMinion(s: LegState, type: PirateType, x: number, y: number): Pirate {
  const pr = makePirate(s, type, clamp(x, 60, s.w - 60), clamp(y, 60, s.h - 60), s.rng, true);
  pr.minion = true;
  s.pirates.push(pr);
  emit(s, { type: 'spawn', x: pr.x, y: pr.y });
  return pr;
}

export function freeAnimal(s: LegState, a: Animal, x: number, y: number) {
  a.captor = -1;
  a.x = x + s.rng.range(-26, 26); a.y = y + s.rng.range(-26, 26);
  if (s.spec.kind === 'convoy') { a.state = 'convoy'; }
  else { a.state = 'freed'; a.t = 0; }
  a.vx = 0; a.vy = 0;
  emit(s, { type: 'freed', x: a.x, y: a.y, animal: a.type });
}

function killPirate(s: LegState, pr: Pirate) {
  const def = PIRATES[pr.type];
  pr.state = 'sinking'; pr.t = 0.7; pr.hp = 0;
  s.tally.kills++;
  s.tally.killsByType[pr.type] = (s.tally.killsByType[pr.type] ?? 0) + 1;
  s.tally.doubloons += def.coins;
  for (const id of pr.netted) {
    const a = s.animals.find((q) => q.id === id);
    if (a) freeAnimal(s, a, pr.x, pr.y);
  }
  pr.netted = [];
  if (isClassic(s)) return;
  if (s.timed && s.timeBonusGiven < SC.timeBonusCap) {
    s.timeBonusGiven += SC.timeBonusPerKill;
    s.timeLeft += SC.timeBonusPerKill;
    emit(s, { type: 'timeBonus', seconds: SC.timeBonusPerKill });
  }
  const p = s.player;
  if (s.rng.chance(p.oil < 0.35 ? 0.6 : 0.3)) dropPickup(s, 'barrel', pr.x, pr.y);
  else if (p.planks < p.maxPlanks && s.rng.chance(seaOf(s).plankDrop)) dropPickup(s, 'plank', pr.x, pr.y);
}

export function dropPickup(s: LegState, type: 'barrel' | 'plank' | 'firefly', x: number, y: number) {
  const a = s.rng.range(0, Math.PI * 2);
  s.pickups.push({ id: s.nextId++, type, x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, t: type === 'firefly' ? 9999 : 14, phase: s.rng.range(0, 10) });
}

/** Apply ram damage from the player. Returns the score awarded. */
function ramPirate(s: LegState, pr: Pirate, dmg: number, heavy: boolean, nx: number, ny: number) {
  const def = PIRATES[pr.type];
  bumpCombo(s);
  s.tally.rams++;
  pr.hp -= dmg;
  pr.hitCd = 0.35;
  let score: number;
  const kill = pr.hp <= 0;
  if (kill) {
    score = Math.round(s.baseScore * def.scoreMult * s.mult);
    killPirate(s, pr);
    pr.vx = nx * 140; pr.vy = ny * 140;
  } else {
    score = SC.chipHit * s.mult;
    pr.stun = 0.7;
    pr.vx += nx * 240; pr.vy += ny * 240;
  }
  addScore(s, score);
  emit(s, { type: 'ram', x: pr.x, y: pr.y, kill, score, mult: s.mult, pirate: pr.type, heavy });
}

// ---------------------------------------------------------------- player

function stepPlayer(s: LegState, inp: Input, dt: number) {
  const p = s.player;
  const mag = Math.min(1, Math.hypot(inp.sx, inp.sy));
  const speed = Math.hypot(p.vx, p.vy);

  p.invuln = Math.max(0, p.invuln - dt);
  p.snare = Math.max(0, p.snare - dt);
  p.boostCd = Math.max(0, p.boostCd - dt);
  p.boostT = Math.max(0, p.boostT - dt);
  p.flareCd = Math.max(0, p.flareCd - dt);
  p.flareT = Math.max(0, p.flareT - dt);
  p.sonarPulse = Math.max(0, p.sonarPulse - dt);

  if (mag > 0.05) {
    const want = Math.atan2(inp.sy, inp.sx);
    const rate = (inp.brake ? B.brakeTurnRate : B.turnRate) * (0.5 + 0.5 * Math.min(1, speed / 110));
    p.angle = rotateToward(p.angle, want, rate * dt);
  }
  const fx = Math.cos(p.angle), fy = Math.sin(p.angle);

  if (inp.boost && p.boostCd <= 0 && p.snare <= 0) {
    p.boostT = B.boostTime;
    p.boostCd = boostCooldown(s);
    p.vx += fx * B.boostImpulse; p.vy += fy * B.boostImpulse;
    if (s.tutorial) s.tutorial.boosted = true;
    emit(s, { type: 'boost', x: p.x, y: p.y });
  }

  const maxSp = maxSpeed(s);
  const acc = B.accel * (p.boostT > 0 ? 1.7 : 1) * (1 + s.spec.loadout.upgrades.engine * UE.enginePerLevel);
  const thrust = (p.boostT > 0 ? Math.max(mag, 0.8) : mag) * acc * (inp.brake ? 0.3 : 1);
  p.vx += fx * thrust * dt; p.vy += fy * thrust * dt;

  // Split velocity into forward and sideways so the hull grips the water like a keel.
  let vf = p.vx * fx + p.vy * fy;
  let vl = -p.vx * fy + p.vy * fx;
  const drag = acc / maxSp + (inp.brake ? B.brakeDrag : 0);
  vf *= Math.exp(-drag * dt);
  vl *= Math.exp(-(inp.brake ? B.driftGrip : B.lateralGrip) * dt);
  p.vx = fx * vf - fy * vl; p.vy = fy * vf + fx * vl;

  if (s.env.storm) { p.vx += s.env.windX * dt; p.vy += s.env.windY * dt; }

  p.x += p.vx * dt; p.y += p.vy * dt;
  const m = p.r + 4;
  if (p.x < m) { p.x = m; p.vx = Math.abs(p.vx) * 0.3; }
  if (p.x > s.w - m) { p.x = s.w - m; p.vx = -Math.abs(p.vx) * 0.3; }
  if (p.y < m) { p.y = m; p.vy = Math.abs(p.vy) * 0.3; }
  if (p.y > s.h - m) { p.y = s.h - m; p.vy = -Math.abs(p.vy) * 0.3; }

  // Lantern oil.
  if (!isClassic(s) && s.spec.kind !== 'tutorial') {
    const burn = L.oilTime * (1 + s.spec.loadout.upgrades.lantern * UE.lanternBurnPerLevel) * (s.spec.kind === 'boss' ? 2 : 1)
      * seaOf(s).oil * (hasLight(s, 'bogqueen') ? 1.2 : 1) * (s.timed || s.spec.kind === 'boss' ? 1 : UT.oil);
    p.oil = Math.max(0, p.oil - dt / burn);
  }

  // Flare.
  if (inp.flare && p.flareCd <= 0 && !isClassic(s)) {
    const lvl = s.spec.loadout.upgrades.flare;
    const bark = p.barkReady;
    p.barkReady = false;
    p.flareT = L.flareTime;
    p.flareCd = flareCooldown(s);
    for (const pr of s.pirates) {
      if (pr.state === 'spawning' || pr.state === 'sinking') continue;
      if (bark) pr.stun = Math.max(pr.stun, 3);
      else if (dist(pr.x, pr.y, p.x, p.y) < L.flareRadius) pr.stun = Math.max(pr.stun, L.flareStun * (1 + lvl * 0.6));
    }
    const b = s.boss;
    if (b && b.kind === 'bogqueen' && b.hidden) { b.hidden = false; b.state = 'surface'; b.t = 0.6; emit(s, { type: 'bossSurface', x: b.x, y: b.y }); }
    emit(s, { type: 'flare', x: p.x, y: p.y, bark });
  }

  // Ribica's sonar.
  if (s.spec.loadout.crew.includes('ribica')) {
    p.sonarT -= dt;
    if (p.sonarT <= 0) { p.sonarT = 10; p.sonarPulse = 2.4; emit(s, { type: 'sonar', x: p.x, y: p.y }); }
  }

  // Towed animals follow in a conga line.
  let lx = p.x, ly = p.y;
  for (const id of p.towed) {
    const a = s.animals.find((q) => q.id === id);
    if (!a) continue;
    const dx = a.x - lx, dy = a.y - ly;
    const d = Math.hypot(dx, dy) || 1;
    const gap = 30;
    if (d > gap) { a.x = lx + (dx / d) * gap; a.y = ly + (dy / d) * gap; }
    a.angle = Math.atan2(-dy, -dx);
    lx = a.x; ly = a.y;
  }
}

// ---------------------------------------------------------------- pirates

function drive(s: LegState, b: { x: number; y: number; vx: number; vy: number; r: number }, tx: number, ty: number, speed: number, dt: number, agility = 3.5) {
  let dx = tx - b.x, dy = ty - b.y;
  const dl = Math.hypot(dx, dy) || 1;
  dx /= dl; dy /= dl;
  for (const hz of s.hazards) {
    if (hz.pushable || (!hz.solid && hz.type !== 'whirlpool')) continue;
    if (hz.type === 'reef' && !hz.exposed) continue;
    const core = hz.type === 'whirlpool' ? 80 : hz.r;
    const ox = b.x - hz.x, oy = b.y - hz.y;
    const od = Math.hypot(ox, oy) || 1;
    const range = core + b.r + 60;
    if (od < range) { const k = ((range - od) / 60) * 1.8; dx += (ox / od) * k; dy += (oy / od) * k; }
  }
  const m = 70;
  if (b.x < m) dx += ((m - b.x) / m) * 2;
  if (b.x > s.w - m) dx -= ((b.x - (s.w - m)) / m) * 2;
  if (b.y < m) dy += ((m - b.y) / m) * 2;
  if (b.y > s.h - m) dy -= ((b.y - (s.h - m)) / m) * 2;
  const nl = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, agility * dt);
  b.vx += ((dx / nl) * speed - b.vx) * k;
  b.vy += ((dy / nl) * speed - b.vy) * k;
}

function catchable(a: Animal): boolean {
  return a.state === 'wander' || a.state === 'flee' || a.state === 'curious' || a.state === 'sit' || a.state === 'convoy' || a.state === 'freed';
}

function stepPirate(s: LegState, pr: Pirate, dt: number) {
  const def: PirateDef = PIRATES[pr.type];
  const p = s.player;
  const rng = s.rng;
  pr.hitCd = Math.max(0, pr.hitCd - dt);
  pr.beamCd = Math.max(0, pr.beamCd - dt);

  if (pr.state === 'spawning') { pr.t -= dt; if (pr.t <= 0) { pr.state = 'patrol'; pr.t = 0; } return; }
  if (pr.state === 'sinking') { pr.t -= dt; pr.vx *= Math.exp(-3 * dt); pr.vy *= Math.exp(-3 * dt); pr.x += pr.vx * dt; pr.y += pr.vy * dt; return; }
  if (pr.stun > 0) {
    pr.stun -= dt;
    pr.vx *= Math.exp(-2.5 * dt); pr.vy *= Math.exp(-2.5 * dt);
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.state === 'charge' || pr.state === 'windup') { pr.state = 'recover'; pr.t = 1.2; pr.lantern = true; }
    return;
  }

  const dx = p.x - pr.x, dy = p.y - pr.y;
  const d = Math.hypot(dx, dy) || 1;
  const sp = speedScale(s);
  const passive = isClassic(s) || s.spec.kind === 'tutorial';

  switch (pr.state) {
    case 'patrol': {
      pr.t -= dt;
      if (pr.t <= 0 || dist(pr.x, pr.y, pr.wx, pr.wy) < 30) {
        pr.wx = clamp(pr.x + rng.range(-420, 420), 80, s.w - 80);
        pr.wy = clamp(pr.y + rng.range(-420, 420), 80, s.h - 80);
        pr.t = rng.range(2.5, 5.5);
        // Classic pirates keep the original's jittery random speeds.
        if (isClassic(s)) pr.phase = rng.range(60, 230);
      }
      drive(s, pr, pr.wx, pr.wy, isClassic(s) ? pr.phase : def.speed * 0.6 * sp, dt);
      if (passive) break;
      if (pr.type === 'douser') {
        // On beacon legs a douser's real job is the nearest lit beacon; it only turns on the boat when it comes close.
        const lit = s.beacons.filter((q) => q.lit);
        if (lit.length > 0) {
          const tgt = lit.reduce((m, q) => (dist(q.x, q.y, pr.x, pr.y) < dist(m.x, m.y, pr.x, pr.y) ? q : m));
          pr.wx = tgt.x; pr.wy = tgt.y; pr.t = 2;
          if (d < 300) { pr.state = 'hunt'; pr.t = 0; }
        } else if (d < 560) { pr.state = 'hunt'; pr.t = 0; }
      } else if (pr.type === 'netter' && pr.netted.length < 2 && d > def.notice && s.animals.some(catchable)) {
        pr.state = 'hunt'; pr.t = 0;
      } else if (d < def.notice) {
        pr.state = 'notice'; pr.t = 0.45;
        emit(s, { type: 'notice', x: pr.x, y: pr.y, pirate: pr.type });
      }
      break;
    }
    case 'notice': {
      pr.t -= dt;
      pr.vx *= Math.exp(-4 * dt); pr.vy *= Math.exp(-4 * dt);
      if (pr.t <= 0) pr.state = pr.type === 'sloop' || pr.type === 'brigantine' ? 'attack' : 'flee';
      break;
    }
    case 'flee': {
      const ax = -dx / d, ay = -dy / d;
      const z = Math.sin(s.time * 5 + pr.phase) * 0.7;
      drive(s, pr, pr.x + (ax - ay * z) * 200, pr.y + (ay + ax * z) * 200, def.fastSpeed * sp, dt, 4.5);
      // On rougher seas a chased dinghy rolls powder kegs off its stern: don't tail it in a straight line.
      if (pr.type === 'dinghy' && seaOf(s).kegs && !pr.minion) {
        pr.fireCd -= dt;
        if (pr.fireCd <= 0 && d < KEG.range && d > 70) {
          pr.fireCd = KEG.cooldown * rng.range(0.9, 1.3);
          const kx = pr.x + ax * -26, ky = pr.y + ay * -26;
          s.shots.push({ id: s.nextId++, x0: kx, y0: ky, tx: kx, ty: ky, t: 0, dur: KEG.fuse, r: KEG.radius, kind: 'keg' });
          emit(s, { type: 'kegDrop', x: kx, y: ky });
        }
      }
      if (d > def.notice * 1.9) { pr.state = 'patrol'; pr.t = 0; }
      break;
    }
    case 'attack': {
      const orbit = def.orbit ?? 240;
      const ux = -dx / d, uy = -dy / d;
      // Circle the player: aim at a point on the orbit ring a little further round.
      const ca = Math.cos(0.5), sa = Math.sin(0.5);
      const ox = (ux * ca - uy * sa) * orbit, oy = (ux * sa + uy * ca) * orbit;
      const fast = d > orbit * 1.5 || d < orbit * 0.55;
      drive(s, pr, p.x + ox, p.y + oy, (fast ? def.fastSpeed : def.speed) * sp, dt);
      pr.fireCd -= dt;
      if (pr.fireCd <= 0 && d < 560) {
        pr.fireCd = (def.fireCooldown ?? 3.5) / fireScale(s) * rng.range(0.9, 1.15);
        // How well the gunners lead a moving boat depends on the sea state: on rough seas you must turn, not just run.
        const lead = 1.3 * seaOf(s).lead;
        const tx = p.x + p.vx * lead + rng.range(-24, 24), ty = p.y + p.vy * lead + rng.range(-24, 24);
        if (pr.type === 'brigantine') {
          const px = -dy / d, py = dx / d;
          fireShot(s, pr.x, pr.y, tx + px * 62, ty + py * 62, 1.35, 44);
          fireShot(s, pr.x, pr.y, tx - px * 62, ty - py * 62, 1.5, 44);
        } else fireShot(s, pr.x, pr.y, tx, ty, 1.3, 44);
      }
      if (d > 760) { pr.state = 'patrol'; pr.t = 0; }
      break;
    }
    case 'hunt': {
      if (pr.type === 'douser') {
        // Stalk from the dark, then commit.
        drive(s, pr, p.x, p.y, def.speed * sp, dt);
        if (d < def.notice) {
          pr.state = 'windup'; pr.t = 0.6;
          emit(s, { type: 'creak', x: pr.x, y: pr.y });
        } else if (d > 800) { pr.state = 'patrol'; pr.t = 0; }
        break;
      }
      // Netter: chase the nearest free animal.
      if (d < def.notice * 0.8) { pr.state = 'notice'; pr.t = 0.4; emit(s, { type: 'notice', x: pr.x, y: pr.y, pirate: pr.type }); break; }
      let best: Animal | null = null, bd = Infinity;
      for (const a of s.animals) {
        if (!catchable(a) || a.state === 'freed') continue;
        const ad = dist(a.x, a.y, pr.x, pr.y);
        if (ad < bd) { bd = ad; best = a; }
      }
      if (!best || pr.netted.length >= 2) { pr.state = 'patrol'; pr.t = 0; break; }
      drive(s, pr, best.x, best.y, def.fastSpeed * 0.9 * sp, dt);
      if (bd < pr.r + best.r + 6) {
        best.state = 'netted'; best.captor = pr.id; pr.netted.push(best.id);
        emit(s, { type: 'netCatch', x: best.x, y: best.y, animal: best.type });
      }
      break;
    }
    case 'windup': {
      pr.t -= dt;
      pr.vx *= Math.exp(-5 * dt); pr.vy *= Math.exp(-5 * dt);
      pr.angle = rotateToward(pr.angle, Math.atan2(dy, dx), 6 * dt);
      if (pr.t <= 0) { pr.state = 'charge'; pr.t = 1.0; pr.dirX = dx / d; pr.dirY = dy / d; }
      break;
    }
    case 'charge': {
      pr.t -= dt;
      pr.vx = pr.dirX * def.fastSpeed * sp; pr.vy = pr.dirY * def.fastSpeed * sp;
      if (pr.t <= 0) { pr.state = 'recover'; pr.t = 1.7; pr.lantern = true; }
      break;
    }
    case 'recover': {
      pr.t -= dt;
      pr.vx *= Math.exp(-2.5 * dt); pr.vy *= Math.exp(-2.5 * dt);
      if (pr.t <= 0) { pr.state = 'patrol'; pr.t = 0; pr.lantern = pr.type !== 'douser' && pr.type !== 'ghost'; }
      break;
    }
  }

  pr.x += pr.vx * dt; pr.y += pr.vy * dt;
  pr.x = clamp(pr.x, pr.r, s.w - pr.r); pr.y = clamp(pr.y, pr.r, s.h - pr.r);
  const v = Math.hypot(pr.vx, pr.vy);
  if (v > 10 && pr.state !== 'windup') pr.angle = rotateToward(pr.angle, Math.atan2(pr.vy, pr.vx), 5 * dt);

  // Netted animals ride along.
  for (let i = 0; i < pr.netted.length; i++) {
    const a = s.animals.find((q) => q.id === pr.netted[i]);
    if (!a) continue;
    const back = pr.angle + Math.PI + (i - (pr.netted.length - 1) / 2) * 0.7;
    a.x = pr.x + Math.cos(back) * (pr.r + 14); a.y = pr.y + Math.sin(back) * (pr.r + 14);
    a.angle = pr.angle;
  }
}

// ---------------------------------------------------------------- animals

function stepAnimal(s: LegState, a: Animal, dt: number) {
  const p = s.player;
  const rng = s.rng;
  const dx = a.x - p.x, dy = a.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const pSpeed = Math.hypot(p.vx, p.vy);
  const classic = isClassic(s);

  switch (a.state) {
    case 'netted': case 'towed': return;
    case 'safe': {
      a.t += dt;
      const z = s.zones.find((q) => dist(q.x, q.y, a.x, a.y) < q.r + 40) ?? s.zones[0];
      if (z) {
        const ang = a.phase + a.t * 0.5;
        drive(s, a, z.x + Math.cos(ang) * z.r * 0.45, z.y + Math.sin(ang) * z.r * 0.45, 40, dt, 2);
      }
      break;
    }
    case 'dazed': {
      a.t -= dt;
      a.vx *= Math.exp(-1.5 * dt); a.vy *= Math.exp(-1.5 * dt);
      if (a.t <= 0) a.state = s.spec.kind === 'convoy' ? 'convoy' : 'wander';
      break;
    }
    case 'freed': {
      a.t += dt;
      a.vx *= Math.exp(-3 * dt); a.vy *= Math.exp(-3 * dt);
      break;
    }
    case 'sit': {
      a.t -= dt;
      const pad = s.hazards.find((h) => h.id === a.route[a.routeI]);
      if (pad) { a.x = pad.x; a.y = pad.y; }
      a.vx = 0; a.vy = 0;
      if (a.t <= 0 && a.route.length > 1) {
        a.routeI = (a.routeI + 1) % a.route.length;
        const next = s.hazards.find((h) => h.id === a.route[a.routeI]);
        if (next) {
          a.hopX = a.x; a.hopY = a.y; a.wx = next.x; a.wy = next.y;
          a.state = 'hop'; a.t = 0;
          a.angle = Math.atan2(next.y - a.y, next.x - a.x);
          emit(s, { type: 'frogHop', x: a.x, y: a.y });
        } else a.t = 2;
      }
      break;
    }
    case 'hop': {
      a.t += dt;
      const k = Math.min(1, a.t / 0.65);
      a.x = a.hopX + (a.wx - a.hopX) * k; a.y = a.hopY + (a.wy - a.hopY) * k;
      if (k >= 1) { a.state = 'sit'; a.t = rng.range(1.6, 3.4); }
      return;
    }
    case 'convoy': {
      const target = s.convoyPath[Math.min(a.pathI, s.convoyPath.length - 1)];
      if (!target) { a.state = 'wander'; break; }
      const off = ((a.id % 3) - 1) * 26;
      drive(s, a, target.x, target.y + off, 72, dt, 2.5);
      if (dist(a.x, a.y, target.x, target.y) < 70 && a.pathI < s.convoyPath.length - 1) a.pathI++;
      break;
    }
    case 'flee': {
      a.t -= dt;
      drive(s, a, a.x + (dx / d) * 200, a.y + (dy / d) * 200, 150, dt, 5);
      if (a.t <= 0) a.state = 'wander';
      break;
    }
    case 'curious': {
      const ang = Math.atan2(dy, dx) + 0.6;
      drive(s, a, p.x + Math.cos(ang) * 62, p.y + Math.sin(ang) * 62, 55, dt, 3);
      if (pSpeed > 110 || d > 240) a.state = 'wander';
      break;
    }
    case 'wander': {
      a.t -= dt;
      if (a.t <= 0 || dist(a.x, a.y, a.wx, a.wy) < 20) {
        a.wx = clamp(a.x + rng.range(-220, 220), 60, s.w - 60);
        a.wy = clamp(a.y + rng.range(-220, 220), 60, s.h - 60);
        a.t = rng.range(2, 5);
        if (classic) a.phase = rng.range(60, 200);
      }
      drive(s, a, a.wx, a.wy, classic ? a.phase : 42, dt, 2);
      if (classic) break;
      const approaching = (p.vx * dx + p.vy * dy) / d;
      if (d < 150 && approaching > 150) { a.state = 'flee'; a.t = 1.1; }
      else if (d < 170 && pSpeed < 55) a.state = 'curious';
      break;
    }
  }
  a.x += a.vx * dt; a.y += a.vy * dt;
  a.x = clamp(a.x, a.r, s.w - a.r); a.y = clamp(a.y, a.r, s.h - a.r);
  if (Math.hypot(a.vx, a.vy) > 6) a.angle = rotateToward(a.angle, Math.atan2(a.vy, a.vx), 6 * dt);
}

// ---------------------------------------------------------------- environment & hazards

function stepEnv(s: LegState, dt: number) {
  const e = s.env;
  const rng = s.rng;
  e.flash = Math.max(0, e.flash - dt);
  if (isClassic(s) || s.spec.kind === 'tutorial') return;

  if (s.spec.biome === 'ice') {
    if (e.aurora > 0) e.aurora = Math.max(0, e.aurora - dt);
    else { e.auroraT -= dt; if (e.auroraT <= 0) { e.aurora = 5.5; e.auroraT = rng.range(13, 19); emit(s, { type: 'aurora' }); } }
  }
  if (e.storm) {
    e.lightningT -= dt;
    if (e.lightningT <= 0) { e.flash = 0.6; e.lightningT = rng.range(3, 5.2); emit(s, { type: 'lightning' }); }
    const a = s.time * 0.17;
    e.windX = Math.cos(a) * 34; e.windY = Math.sin(a) * 34;
  }
  if (s.spec.biome === 'crystal' && s.timed) e.dark = 0.42 + 0.46 * clamp(s.time / Math.max(1, s.spec.duration), 0, 1);
  if (s.spec.biome === 'reef') {
    const cycle = 11, up = 6.5;
    const ph = s.time % cycle;
    e.tide = ph / cycle;
    const exposed = ph < up;
    e.tideSwitchIn = exposed ? up - ph : cycle - ph;
    if (exposed !== e.reefExposed) {
      e.reefExposed = exposed;
      emit(s, { type: 'tide', exposed });
      for (const h of s.hazards) {
        if (h.type !== 'reef') continue;
        h.exposed = exposed;
        // Surfacing under the boat shoves it clear instead of costing a plank.
        if (exposed && dist(h.x, h.y, s.player.x, s.player.y) < h.r + s.player.r) s.player.invuln = Math.max(s.player.invuln, 0.7);
      }
    }
  }

  // Crystals refract the lantern into beams.
  s.beams.length = 0;
  if (s.spec.biome === 'crystal') {
    const p = s.player;
    const R = lanternRadius(s);
    for (const h of s.hazards) {
      if (h.type !== 'crystal') continue;
      const dx = h.x - p.x, dy = h.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > R + h.r * 0.5 || d < 1) continue;
      const len = 460;
      s.beams.push({ x1: h.x, y1: h.y, x2: h.x + (dx / d) * len, y2: h.y + (dy / d) * len, hazard: h.id });
    }
    for (const bm of s.beams) {
      for (const pr of s.pirates) {
        if (pr.beamCd > 0 || pr.state === 'spawning' || pr.state === 'sinking') continue;
        if (segCircle(bm.x1, bm.y1, bm.x2, bm.y2, pr.x, pr.y, pr.r + 6)) {
          pr.stun = Math.max(pr.stun, 1.3); pr.beamCd = 3.5;
          emit(s, { type: 'beamStun', x: pr.x, y: pr.y });
        }
      }
    }
  }
}

function stepHazards(s: LegState, dt: number) {
  const p = s.player;
  const rng = s.rng;
  const floes = s.hazards.filter((h) => h.type === 'floe').length;
  for (let i = s.hazards.length - 1; i >= 0; i--) {
    const h = s.hazards[i];
    h.nearCd = Math.max(0, h.nearCd - dt);
    if (h.type === 'iceberg') {
      h.x += h.vx * dt; h.y += h.vy * dt;
      if (h.x < h.r + 30 || h.x > s.w - h.r - 30) h.vx = -h.vx;
      if (h.y < h.r + 30 || h.y > s.h - h.r - 30) h.vy = -h.vy;
      if (h.calveT > 0) {
        h.calveT -= dt;
        if (h.calveT <= 0) {
          h.calveT = rng.range(16, 28);
          if (floes < 9 && h.r > 34) {
            const a = rng.range(0, Math.PI * 2);
            const f = makeHazard(s, 'floe', h.x + Math.cos(a) * (h.r + 24), h.y + Math.sin(a) * (h.r + 24), rng.range(18, 23), rng);
            f.vx = Math.cos(a) * 45; f.vy = Math.sin(a) * 45;
            h.r -= 3;
            s.hazards.push(f);
            emit(s, { type: 'calve', x: f.x, y: f.y });
          }
        }
      }
    } else if (h.type === 'floe') {
      h.vx *= Math.exp(-0.7 * dt); h.vy *= Math.exp(-0.7 * dt);
      h.x += h.vx * dt; h.y += h.vy * dt;
      h.rot += Math.hypot(h.vx, h.vy) * 0.004 * dt;
      if (h.x < h.r || h.x > s.w - h.r) { h.vx = -h.vx * 0.6; h.x = clamp(h.x, h.r, s.w - h.r); }
      if (h.y < h.r || h.y > s.h - h.r) { h.vy = -h.vy * 0.6; h.y = clamp(h.y, h.r, s.h - h.r); }
      const sp = Math.hypot(h.vx, h.vy);
      if (sp < 60) h.shoved = false;
      for (const o of s.hazards) {
        if (o === h || !o.solid || (o.type === 'reef' && !o.exposed)) continue;
        const dx = h.x - o.x, dy = h.y - o.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < h.r + o.r) {
          const nx = dx / d, ny = dy / d;
          h.x = o.x + nx * (h.r + o.r); h.y = o.y + ny * (h.r + o.r);
          const vn = h.vx * nx + h.vy * ny;
          if (vn < 0) { h.vx -= nx * vn * 1.6; h.vy -= ny * vn * 1.6; }
        }
      }
      // A shoved floe is a weapon.
      if (h.shoved && sp > 110) {
        let hit = false;
        for (const pr of s.pirates) {
          if (pr.state === 'spawning' || pr.state === 'sinking') continue;
          if (dist(pr.x, pr.y, h.x, h.y) < pr.r + h.r) {
            pr.hp -= 1; pr.hitCd = 0.3;
            bumpCombo(s);
            let score = SC.assist * s.mult;
            if (pr.hp <= 0) { score += Math.round(s.baseScore * PIRATES[pr.type].scoreMult * s.mult); killPirate(s, pr); }
            else pr.stun = 1;
            addScore(s, score);
            s.tally.assists++;
            emit(s, { type: 'assist', x: pr.x, y: pr.y, score });
            hit = true;
            break;
          }
        }
        const b = s.boss;
        if (!hit && b && !b.hidden && b.dying <= 0 && dist(b.x, b.y, h.x, h.y) < b.r + h.r) {
          b.stun = Math.max(b.stun, 1.5);
          s.tally.assists++;
          addScore(s, SC.assist);
          emit(s, { type: 'assist', x: b.x, y: b.y, score: SC.assist });
          hit = true;
        }
        if (hit) { s.hazards.splice(i, 1); continue; }
      }
    } else if (h.type === 'whirlpool') {
      h.rot += dt * 2.2;
      const pull = (b: { x: number; y: number; vx: number; vy: number }, k: number) => {
        const dx = h.x - b.x, dy = h.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > h.r) return d;
        const f = 1 - d / h.r;
        const nx = dx / d, ny = dy / d;
        b.vx += (nx * (60 + 230 * f) - ny * 150 * f) * k * dt;
        b.vy += (ny * (60 + 230 * f) + nx * 150 * f) * k * dt;
        return d;
      };
      const d = pull(p, 1);
      if (d < WHIRLPOOL_CORE + p.r * 0.5 && p.invuln <= 0) {
        const dx = p.x - h.x, dy = p.y - h.y;
        const l = Math.hypot(dx, dy) || 1;
        hurtPlayer(s, 'whirlpool', h.x, h.y);
        p.vx = (dx / l) * 420; p.vy = (dy / l) * 420;
        p.invuln = Math.max(p.invuln, 1.2);
      }
      for (const pk of s.pickups) pull(pk, 0.5);
    }
  }
}

function collidePlayerHazards(s: LegState) {
  const p = s.player;
  const speed = Math.hypot(p.vx, p.vy);
  p.onPad = false;
  for (const h of s.hazards) {
    if (h.type === 'whirlpool') continue;
    if (h.type === 'reef' && !h.exposed) { h.nearState = 0; continue; }
    const dx = p.x - h.x, dy = p.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    if (!h.solid) {
      // Lily pads only slow the boat (Žabica knows the way through).
      if (d < h.r * 0.85 + p.r * 0.3 && !s.spec.loadout.crew.includes('zabica')) p.onPad = true;
      continue;
    }
    // Slightly forgiving hit radius: art is drawn to the full radius.
    const hitR = h.r * (h.pushable ? 1 : 0.9) + p.r * 0.85;
    if (d < hitR) {
      const nx = dx / d, ny = dy / d;
      h.nearState = 0;
      if (h.pushable) {
        const vn = -(p.vx * nx + p.vy * ny);
        p.x = h.x + nx * hitR; p.y = h.y + ny * hitR;
        if (vn > 0) {
          h.vx = -nx * vn * 1.15 + p.vx * 0.15; h.vy = -ny * vn * 1.15 + p.vy * 0.15;
          p.vx += nx * vn * 0.45; p.vy += ny * vn * 0.45;
          if (vn > 110) { h.shoved = true; emit(s, { type: 'floeShove', x: h.x, y: h.y }); }
        }
        continue;
      }
      p.x = h.x + nx * hitR; p.y = h.y + ny * hitR;
      const vn = p.vx * nx + p.vy * ny;
      if (vn < 0) { p.vx -= nx * vn * 1.5; p.vy -= ny * vn * 1.5; }
      if (!h.hurts || s.spec.mutators.invincible || p.invuln > 0) continue;
      h.nearCd = 4;
      if (isClassic(s)) {
        // Original rules: touching an obstacle ends the level.
        p.planks = 0; s.tally.planksLost++;
        emit(s, { type: 'hazardHit', x: p.x, y: p.y, hazard: h.type, free: false });
        emit(s, { type: 'sink', x: p.x, y: p.y });
        endLeg(s, 'lost');
        return;
      }
      p.vx += nx * 120; p.vy += ny * 120;
      if (p.freeHit) {
        p.freeHit = false; p.invuln = 1.0;
        emit(s, { type: 'hazardHit', x: p.x, y: p.y, hazard: h.type, free: true });
        continue;
      }
      emit(s, { type: 'hazardHit', x: p.x, y: p.y, hazard: h.type, free: false });
      losePlank(s);
      if (s.status !== 'running') return;
    } else if (h.hurts && !isClassic(s)) {
      // Near miss: skim past at speed without touching.
      const band = hitR + 20;
      if (d < band) {
        if (h.nearState === 0 && h.nearCd <= 0 && speed > 190 && p.invuln <= 0) h.nearState = 1;
      } else if (h.nearState === 1) {
        h.nearState = 0;
        if (d < band + 40) {
          h.nearCd = 4;
          s.tally.nearMisses++;
          addScore(s, SC.nearMiss);
          emit(s, { type: 'nearMiss', x: p.x, y: p.y, score: SC.nearMiss });
        }
      }
    }
  }
}

function collidePlayerPirates(s: LegState) {
  const p = s.player;
  const rs = ramSpeed(s);
  const ramLvl = s.spec.loadout.upgrades.ram;
  for (const pr of s.pirates) {
    if (pr.state === 'spawning' || pr.state === 'sinking') continue;
    const dx = pr.x - p.x, dy = pr.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const min = pr.r + p.r + 2;
    if (d >= min) continue;
    const nx = dx / d, ny = dy / d;
    const toward = p.vx * nx + p.vy * ny;
    const overlap = min - d;
    p.x -= nx * overlap * 0.4; p.y -= ny * overlap * 0.4;
    pr.x += nx * overlap * 0.6; pr.y += ny * overlap * 0.6;
    const def = PIRATES[pr.type];
    const speed = Math.hypot(p.vx, p.vy);

    if (pr.hitCd <= 0 && (isClassic(s) || toward >= rs)) {
      if (def.armorArc && pr.stun <= 0 && Math.abs(angDiff(pr.angle, Math.atan2(-ny, -nx))) < def.armorArc) {
        // Armoured bow: bounce off.
        p.vx -= nx * toward * 1.5; p.vy -= ny * toward * 1.5;
        pr.hitCd = 0.35;
        emit(s, { type: 'clang', x: pr.x - nx * pr.r, y: pr.y - ny * pr.r });
        continue;
      }
      const heavy = !isClassic(s) && (p.boostT > 0 || speed >= B.heavyRamSpeed);
      const dmg = 1 + (heavy ? 1 : 0) + (heavy && ramLvl >= 2 ? 1 : 0);
      ramPirate(s, pr, dmg, heavy, nx, ny);
      if (pr.hp > 0) { p.vx -= nx * toward * 1.1; p.vy -= ny * toward * 1.1; }
      else { p.vx *= 0.82; p.vy *= 0.82; }
    } else if (pr.state === 'charge' && pr.hitCd <= 0) {
      hurtPlayer(s, 'pirate', pr.x, pr.y);
      pr.state = 'recover'; pr.t = 1.7; pr.lantern = true; pr.hitCd = 0.5;
      p.vx -= nx * 200; p.vy -= ny * 200;
      pr.vx *= 0.2; pr.vy *= 0.2;
      if (s.status !== 'running') return;
    } else {
      const push = Math.max(0, toward) * 0.6;
      p.vx -= nx * push; p.vy -= ny * push;
      pr.vx += nx * push * 0.8; pr.vy += ny * push * 0.8;
      if (toward > 50 && pr.hitCd <= 0) { pr.hitCd = 0.3; emit(s, { type: 'bump', x: (p.x + pr.x) / 2, y: (p.y + pr.y) / 2 }); }
    }
  }
}

function collidePlayerAnimals(s: LegState) {
  const p = s.player;
  const speed = Math.hypot(p.vx, p.vy);
  for (const a of s.animals) {
    if (a.state === 'netted' || a.state === 'towed' || a.state === 'safe' || a.state === 'dazed' || a.state === 'hop') continue;
    const dx = a.x - p.x, dy = a.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d >= a.r + p.r) continue;
    const nx = dx / d, ny = dy / d;
    if (a.state === 'freed') {
      a.state = 'towed';
      p.towed.push(a.id);
      emit(s, { type: 'towStart', x: a.x, y: a.y, animal: a.type });
      if (a.type === 'marshmallow') endLeg(s, 'won');
      continue;
    }
    if (s.spec.mutators.invincible) continue;
    if (isClassic(s) || speed >= B.bonkSpeed) {
      s.tally.animalsHit++;
      s.tally.karma -= 1;
      addScore(s, SC.animalHit);
      resetCombo(s);
      emit(s, { type: 'bonk', x: a.x, y: a.y, animal: a.type });
      if (s.tally.animalsHit === SC.monsterAt) emit(s, { type: 'monster' });
      if (isClassic(s)) {
        // Original behaviour: the animal reappears somewhere else.
        const spot = findSpot(s, s.rng, a.r, 260, 50);
        a.x = spot.x; a.y = spot.y; a.state = 'wander'; a.t = 0;
      } else {
        a.state = 'dazed'; a.t = 3;
        a.vx = nx * 190 + p.vx * 0.3; a.vy = ny * 190 + p.vy * 0.3;
        a.route = [];
      }
    } else {
      // Gentle nudge.
      a.x = p.x + nx * (a.r + p.r); a.y = p.y + ny * (a.r + p.r);
      if (a.state === 'sit') { a.route = []; a.state = 'wander'; a.t = 0; }
    }
  }
}

function stepPickups(s: LegState, dt: number) {
  const p = s.player;
  for (let i = s.pickups.length - 1; i >= 0; i--) {
    const k = s.pickups[i];
    k.t -= dt;
    if (k.type === 'firefly' && k.t > 0) {
      k.vx += Math.cos(s.time * 0.9 + k.phase) * 26 * dt; k.vy += Math.sin(s.time * 1.3 + k.phase * 2) * 26 * dt;
      k.vx *= Math.exp(-0.8 * dt); k.vy *= Math.exp(-0.8 * dt);
    } else { k.vx *= Math.exp(-2 * dt); k.vy *= Math.exp(-2 * dt); }
    const dx = p.x - k.x, dy = p.y - k.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 70) { k.vx += (dx / d) * 500 * dt; k.vy += (dy / d) * 500 * dt; }
    k.x = clamp(k.x + k.vx * dt, 20, s.w - 20); k.y = clamp(k.y + k.vy * dt, 20, s.h - 20);
    if (d < p.r + 14) {
      if (k.type === 'barrel') p.oil = Math.min(1, p.oil + L.barrelOil);
      else if (k.type === 'firefly') {
        p.oil = Math.min(1, p.oil + L.fireflyOil);
        // Fireflies drift back in elsewhere.
        const spot = findSpot(s, s.rng, 8, 420);
        s.pickups.push({ id: s.nextId++, type: 'firefly', x: spot.x, y: spot.y, vx: 0, vy: 0, t: 9999, phase: s.rng.range(0, 10) });
      } else if (k.type === 'plank') p.planks = Math.min(p.maxPlanks, p.planks + 1);
      else if (k.type === 'bottle') s.tally.bottle = true;
      emit(s, { type: 'pickup', x: k.x, y: k.y, pickup: k.type });
      s.pickups.splice(i, 1);
    } else if (k.t <= 0) s.pickups.splice(i, 1);
  }
}

function stepShots(s: LegState, dt: number) {
  const p = s.player;
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i];
    sh.t += dt;
    if (sh.t < sh.dur) continue;
    emit(s, { type: 'cannonLand', x: sh.tx, y: sh.ty, r: sh.r, kind: sh.kind });
    if (dist(p.x, p.y, sh.tx, sh.ty) < sh.r + p.r * 0.4) {
      if (sh.kind === 'net') {
        // A first net only tangles the boat; a second one while tangled drags it under.
        if (p.snare > 0) hurtPlayer(s, 'shot', sh.tx, sh.ty);
        else if (!s.spec.mutators.invincible && p.invuln <= 0) p.snare = 2.2;
      }
      else hurtPlayer(s, 'shot', sh.tx, sh.ty);
    }
    // Powder does not care whose side you are on: lure pirates into their own kegs.
    if (sh.kind === 'keg') {
      for (const pr of s.pirates) {
        if (pr.state === 'spawning' || pr.state === 'sinking' || dist(pr.x, pr.y, sh.tx, sh.ty) > sh.r + pr.r * 0.5) continue;
        pr.hp -= 1; pr.hitCd = 0.3;
        bumpCombo(s);
        let score = SC.assist * s.mult;
        if (pr.hp <= 0) { score += Math.round(s.baseScore * PIRATES[pr.type].scoreMult * s.mult); killPirate(s, pr); }
        else pr.stun = 1.2;
        addScore(s, score);
        s.tally.assists++;
        emit(s, { type: 'assist', x: pr.x, y: pr.y, score, by: 'keg' });
      }
    }
    s.shots.splice(i, 1);
  }
}

function stepZones(s: LegState) {
  const p = s.player;
  // Towed animals are dropped off when the boat (or they) enter a safe zone.
  for (const z of s.zones) {
    for (let i = p.towed.length - 1; i >= 0; i--) {
      const a = s.animals.find((q) => q.id === p.towed[i]);
      if (!a) { p.towed.splice(i, 1); continue; }
      if (dist(a.x, a.y, z.x, z.y) < z.r || dist(p.x, p.y, z.x, z.y) < z.r * 0.8) {
        p.towed.splice(i, 1);
        deliver(s, a);
      }
    }
    for (const a of s.animals) {
      if (a.state === 'convoy' && dist(a.x, a.y, z.x, z.y) < z.r * 0.7) deliver(s, a);
    }
  }
}

function stepBeacons(s: LegState, dt: number) {
  const p = s.player;
  for (const b of s.beacons) {
    if (!b.lit) {
      // Lighting takes a moment of holding station beside the float: time in which the pirates are not idle.
      if (dist(p.x, p.y, b.x, b.y) < UT.lightRadius) b.charge = Math.min(1, b.charge + dt / UT.lightTime);
      else b.charge = Math.max(0, b.charge - dt * 0.5);
      if (b.charge >= 1) {
        b.lit = true; b.douse = 0; b.charge = 0;
        const score = s.baseScore * UT.beaconScore * s.mult;
        addScore(s, score);
        p.oil = Math.min(1, p.oil + 0.15);
        emit(s, { type: 'beaconLit', x: b.x, y: b.y, score });
      }
      continue;
    }
    // A douser sitting on a lit beacon snuffs it unless it is driven off in time.
    const sitter = s.pirates.some((pr) => pr.type === 'douser' && pr.state !== 'spawning' && pr.state !== 'sinking' && pr.stun <= 0 && dist(pr.x, pr.y, b.x, b.y) < 46);
    if (sitter) {
      b.douse += dt;
      if (b.douse >= UT.douseTime) { b.lit = false; b.douse = 0; emit(s, { type: 'beaconOut', x: b.x, y: b.y }); }
    } else b.douse = Math.max(0, b.douse - dt);
  }
}

function deliver(s: LegState, a: Animal) {
  a.state = 'safe'; a.t = 0;
  const score = SC.rescue * (isClassic(s) ? 1 : s.mult);
  addScore(s, score);
  s.tally.rescued++;
  s.tally.rescuedTypes.push(a.type);
  s.tally.pearls++;
  s.tally.karma += 1;
  emit(s, { type: 'delivered', x: a.x, y: a.y, animal: a.type, score });
}

function stepSpawns(s: LegState, dt: number) {
  // Remove sunk pirates.
  for (let i = s.pirates.length - 1; i >= 0; i--) {
    const pr = s.pirates[i];
    if (pr.state === 'sinking' && pr.t <= 0) s.pirates.splice(i, 1);
  }
  if (s.spec.kind === 'tutorial') return;
  const alive = s.pirates.filter((q) => q.state !== 'sinking' && !q.minion).length;
  if (alive + s.spawnQueue.length < s.targetPirates) s.spawnQueue.push(isClassic(s) ? 0 : 1.2);
  for (let i = s.spawnQueue.length - 1; i >= 0; i--) {
    s.spawnQueue[i] -= dt;
    if (s.spawnQueue[i] > 0) continue;
    s.spawnQueue.splice(i, 1);
    const type = isClassic(s) ? 'dinghy' : pickPirateType(s, s.rng);
    const spot = findSpot(s, s.rng, PIRATES[type].radius, isClassic(s) ? 260 : 400);
    const pr = makePirate(s, type, spot.x, spot.y, s.rng, !isClassic(s));
    s.pirates.push(pr);
    if (!isClassic(s)) emit(s, { type: 'spawn', x: pr.x, y: pr.y });
  }
}

function separatePirates(s: LegState) {
  for (const pr of s.pirates) {
    if (pr.state === 'spawning' || pr.state === 'sinking') continue;
    for (const h of s.hazards) {
      if (!h.solid || h.pushable || (h.type === 'reef' && !h.exposed)) continue;
      const dx = pr.x - h.x, dy = pr.y - h.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = pr.r + h.r * 0.92;
      if (d < min) {
        pr.x = h.x + (dx / d) * min; pr.y = h.y + (dy / d) * min;
        if (pr.state === 'charge') { pr.state = 'recover'; pr.t = 1.7; pr.lantern = true; }
      }
    }
    for (const o of s.pirates) {
      if (o.id <= pr.id || o.state === 'spawning' || o.state === 'sinking') continue;
      const dx = o.x - pr.x, dy = o.y - pr.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = o.r + pr.r;
      if (d < min) { const k = (min - d) / 2; pr.x -= (dx / d) * k; pr.y -= (dy / d) * k; o.x += (dx / d) * k; o.y += (dy / d) * k; }
    }
  }
}

// ---------------------------------------------------------------- tutorial

function stepTutorial(s: LegState, dt: number) {
  const t = s.tutorial!;
  const p = s.player;
  t.t += dt;
  const next = () => { t.step++; t.t = 0; emit(s, { type: 'tutorialStep', step: t.step }); };
  switch (t.step) {
    case 0:
      if (s.markers[0] && dist(p.x, p.y, s.markers[0].x, s.markers[0].y) < s.markers[0].r + p.r) { s.markers.length = 0; t.boosted = false; next(); }
      break;
    case 1:
      if (t.boosted) {
        next();
        const pr = makePirate(s, 'dinghy', clamp(p.x + 380, 150, s.w - 150), clamp(p.y - 120, 150, s.h - 150), s.rng, true);
        s.pirates.push(pr);
        emit(s, { type: 'spawn', x: pr.x, y: pr.y });
      }
      break;
    case 2:
      if (s.tally.kills >= 1) {
        next();
        p.oil = 0.15;
        s.pickups.length = 0;
        s.pickups.push({ id: s.nextId++, type: 'barrel', x: clamp(p.x - 260, 120, s.w - 120), y: clamp(p.y + 160, 120, s.h - 120), vx: 0, vy: 0, t: 9999, phase: 0 });
      }
      break;
    case 3:
      if (p.oil > 0.4) {
        next();
        const a = makeAnimal(s, 'pingo', 900, 600, s.rng);
        a.state = 'freed';
        s.animals.push(a);
      }
      break;
    case 4:
      if (s.tally.rescued >= 1) { next(); endLeg(s, 'won'); }
      break;
  }
}

// ---------------------------------------------------------------- main step

export function step(s: LegState, inp: Input, dt: number = FIXED_DT) {
  if (s.status === 'ready') {
    // Homage to the original: nothing moves until you take the helm.
    if (Math.hypot(inp.sx, inp.sy) > 0.05 || inp.boost) { s.status = 'running'; emit(s, { type: 'castOff' }); }
    else return;
  }
  if (s.status !== 'running') { s.endT += dt; return; }

  s.time += dt;
  if (s.timed) s.timeLeft -= dt;

  stepPlayer(s, inp, dt);
  stepEnv(s, dt);
  for (const pr of s.pirates) stepPirate(s, pr, dt);
  for (const a of s.animals) stepAnimal(s, a, dt);
  stepHazards(s, dt);
  if (s.status !== 'running') return;
  stepShots(s, dt);
  if (s.status !== 'running') return;
  separatePirates(s);
  collidePlayerHazards(s);
  if (s.status !== 'running') return;
  collidePlayerPirates(s);
  if (s.status !== 'running') return;
  collidePlayerAnimals(s);
  if (s.status !== 'running') return;
  stepPickups(s, dt);
  stepZones(s);
  if (s.beacons.length) stepBeacons(s, dt);
  if (s.boss) {
    stepBoss(s, s.boss, dt);
    if (s.status !== 'running') return;
    if (s.boss) collideBoss(s, s.boss);
    if (s.status !== 'running') return;
  }
  stepSpawns(s, dt);
  if (s.tutorial) stepTutorial(s, dt);

  if (s.comboT > 0) { s.comboT -= dt; if (s.comboT <= 0) resetCombo(s); }

  // End conditions.
  if (s.status !== 'running') return;
  if (s.spec.kind === 'rescue' && s.tally.rescued >= s.goal) endLeg(s, 'won');
  else if (s.spec.kind === 'bounty' && s.tally.kills >= s.goal) endLeg(s, 'won');
  else if (s.spec.kind === 'beacons' && s.beacons.every((b) => b.lit)) endLeg(s, 'won');
  else if (s.spec.kind === 'convoy' && s.animals.every((a) => a.state === 'safe')) endLeg(s, 'won');
  else if (s.timed && s.timeLeft <= 0) {
    s.timeLeft = 0;
    if (s.spec.kind === 'rescue') endLeg(s, 'timeout');
    else if (s.spec.kind === 'convoy') endLeg(s, s.tally.rescued >= s.goal ? 'won' : 'timeout');
    else endLeg(s, 'won');
  }
}

export type { Hazard };
