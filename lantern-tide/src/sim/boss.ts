import { TUNE } from '../content';
import { angDiff, clamp, dist, rotateToward, segCircle } from '../core/math';
import { findSpot, makeAnimal, makeHazard } from './gen';
import { addScore, bumpCombo, emit, endLeg, fireShot, hurtPlayer, ramSpeed, revealAll, spawnMinion } from './leg';
import type { Boss, LegState } from './types';

const SC = TUNE.score;

function minions(s: LegState): number { return s.pirates.filter((p) => p.minion && p.state !== 'sinking').length; }

function toward(s: LegState, b: Boss, tx: number, ty: number, speed: number, dt: number, agility = 2) {
  let dx = tx - b.x, dy = ty - b.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;
  const k = Math.min(1, agility * dt);
  const sp = d < 20 ? 0 : speed;
  b.vx += (dx * sp - b.vx) * k; b.vy += (dy * sp - b.vy) * k;
}

function lead(s: LegState, t: number, spread = 0): { x: number; y: number } {
  const p = s.player;
  t *= 0.6 + 0.5 * TUNE.sea[s.spec.sea].lead;
  return { x: p.x + p.vx * t + s.rng.range(-spread, spread), y: p.y + p.vy * t + s.rng.range(-spread, spread) };
}

function setPhase(s: LegState, b: Boss, phase: number) {
  if (phase <= b.phase) return;
  b.phase = phase;
  emit(s, { type: 'bossPhase', phase });
}

function startCharge(s: LegState, b: Boss, aimTime: number) {
  b.state = 'aim'; b.t = aimTime;
  emit(s, { type: 'bossTelegraph', x: b.x, y: b.y });
}

/** Shared aim → charge → crash logic (Frostbeard, Hollow Galleon). Returns true while busy. */
function chargeStates(s: LegState, b: Boss, dt: number, speed: number, recover: number): boolean {
  const p = s.player;
  if (b.state === 'aim') {
    b.t -= dt;
    b.vx *= Math.exp(-4 * dt); b.vy *= Math.exp(-4 * dt);
    b.angle = rotateToward(b.angle, Math.atan2(p.y - b.y, p.x - b.x), 3.2 * dt);
    if (b.t <= 0) { b.state = 'charge'; b.t = 1.7; b.dirX = Math.cos(b.angle); b.dirY = Math.sin(b.angle); }
    return true;
  }
  if (b.state === 'charge') {
    b.t -= dt;
    b.vx = b.dirX * speed; b.vy = b.dirY * speed;
    let crashed = b.t <= 0 ? 1 : 0;
    const m = b.r + 6;
    if (b.x < m || b.x > s.w - m || b.y < m || b.y > s.h - m) crashed = 2;
    for (let i = s.hazards.length - 1; i >= 0; i--) {
      const h = s.hazards[i];
      if (!h.solid || h.pushable || !h.hurts) continue;
      if (dist(h.x, h.y, b.x, b.y) < b.r + h.r * 0.9) {
        // Smashing into something solid shatters it and leaves the boss dazed.
        s.hazards.splice(i, 1);
        if (h.type === 'iceberg') {
          for (let k = 0; k < 3; k++) {
            const a = s.rng.range(0, Math.PI * 2);
            const f = makeHazard(s, 'floe', h.x + Math.cos(a) * 20, h.y + Math.sin(a) * 20, s.rng.range(18, 23), s.rng);
            f.vx = Math.cos(a) * 90; f.vy = Math.sin(a) * 90;
            s.hazards.push(f);
          }
        }
        emit(s, { type: 'calve', x: h.x, y: h.y });
        crashed = 3;
        break;
      }
    }
    if (crashed) {
      b.state = 'stunned';
      b.stun = crashed === 3 ? recover + 1.4 : crashed === 2 ? recover : recover * 0.6;
      b.vx *= -0.2; b.vy *= -0.2;
      b.x = clamp(b.x, m + 2, s.w - m - 2); b.y = clamp(b.y, m + 2, s.h - m - 2);
      if (crashed > 1) emit(s, { type: 'bossStun', x: b.x, y: b.y });
    }
    return true;
  }
  if (b.state === 'stunned') {
    b.stun -= dt;
    b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt);
    if (b.stun <= 0) { b.stun = 0; b.state = 'cruise'; b.t = 1.6; }
    return true;
  }
  return false;
}

function frostbeard(s: LegState, b: Boss, dt: number) {
  const p = s.player;
  setPhase(s, b, b.hp <= 3 ? 2 : 1);
  if (chargeStates(s, b, dt, b.phase === 2 ? 470 : 420, 2.4)) return;
  // cruise
  b.t -= dt;
  toward(s, b, p.x, p.y, 70, dt);
  if (b.phase === 2) {
    b.fireCd -= dt;
    if (b.fireCd <= 0) { b.fireCd = 2.6; const l = lead(s, 0.8, 30); fireShot(s, b.x, b.y, l.x, l.y, 1.4, 46); }
  }
  if (b.t <= 0) startCharge(s, b, b.phase === 2 ? 0.9 : 1.25);
}

function bogqueen(s: LegState, b: Boss, dt: number) {
  setPhase(s, b, b.hp <= 3 ? 2 : 1);
  if (b.stun > 0) { b.stun -= dt; b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt); return; }
  switch (b.state) {
    case 'hidden': {
      b.hidden = true;
      b.t -= dt;
      toward(s, b, b.dirX, b.dirY, 135, dt);
      b.spawnCd -= dt;
      if (b.spawnCd <= 0 && minions(s) < b.phase + 1 + (s.spec.sea > 0 ? 1 : 0)) {
        b.spawnCd = 3.5;
        const spot = findSpot(s, s.rng, 16, 420);
        spawnMinion(s, 'douser', spot.x, spot.y);
      }
      if (b.t <= 0) { b.state = 'surface'; b.t = 0.9; b.hidden = false; emit(s, { type: 'bossSurface', x: b.x, y: b.y }); }
      break;
    }
    case 'surface': {
      b.hidden = false;
      b.t -= dt;
      b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt);
      if (b.t <= 0) { b.state = 'mortar'; b.shotsLeft = (b.phase === 2 ? 5 : 3) + s.spec.sea; b.fireCd = 0.2; b.t = 1.6; }
      break;
    }
    case 'mortar': {
      b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt);
      b.fireCd -= dt;
      if (b.shotsLeft > 0 && b.fireCd <= 0) {
        b.fireCd = 0.55; b.shotsLeft--;
        const l = lead(s, 0.9, 60);
        fireShot(s, b.x, b.y, l.x, l.y, 1.5, 48);
      }
      if (b.shotsLeft <= 0) { b.t -= dt; if (b.t <= 0) dive(s, b); }
      break;
    }
    default: dive(s, b);
  }
}

function dive(s: LegState, b: Boss) {
  b.state = 'hidden'; b.t = b.phase === 2 ? 2.4 : 3.2;
  const spot = findSpot(s, s.rng, b.r, 380, 160);
  b.dirX = spot.x; b.dirY = spot.y;
}

function ember(s: LegState, b: Boss, dt: number) {
  setPhase(s, b, b.hp <= 3 ? 2 : 1);
  if (b.state === 'intro') { b.state = 'orbit'; b.orbit = -Math.PI / 2; }
  if (!b.shield) {
    b.t -= dt;
    if (b.t <= 0) { b.shield = true; b.stun = 0; }
  } else {
    for (const bm of s.beams) {
      if (segCircle(bm.x1, bm.y1, bm.x2, bm.y2, b.x, b.y, b.r)) {
        b.shield = false; b.t = 5; b.stun = 2.4;
        emit(s, { type: 'shieldBreak', x: b.x, y: b.y });
        break;
      }
    }
  }
  if (b.stun > 0) { b.stun -= dt; b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt); return; }
  b.orbit += (b.phase === 2 ? 0.34 : 0.24) * dt;
  toward(s, b, s.w / 2 + Math.cos(b.orbit) * 430, s.h / 2 + Math.sin(b.orbit) * 300, 125, dt);
  b.fireCd -= dt;
  if (b.fireCd <= 0) {
    b.fireCd = b.phase === 2 ? 2.1 : 2.7;
    const l = lead(s, 0.8, 26);
    fireShot(s, b.x, b.y, l.x, l.y, 1.35, 44);
    if (b.phase === 2) { const l2 = lead(s, 1.3, 70); fireShot(s, b.x, b.y, l2.x, l2.y, 1.7, 44); }
  }
}

function netmaker(s: LegState, b: Boss, dt: number) {
  const p = s.player;
  setPhase(s, b, b.hp <= 2 ? 2 : 1);
  if (b.state === 'intro') { b.state = 'weave'; b.lastAng = Math.atan2(p.y - b.y, p.x - b.x); }
  if (b.stun > 0) {
    b.stun -= dt;
    b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt);
    if (b.stun <= 0) { b.shield = true; b.circle = 0; }
    return;
  }
  // Circle the boss to cut its net.
  const ang = Math.atan2(p.y - b.y, p.x - b.x);
  const d = dist(p.x, p.y, b.x, b.y);
  if (d > b.r + 10 && d < 330) b.circle += angDiff(b.lastAng, ang);
  else b.circle *= Math.exp(-1.2 * dt);
  b.lastAng = ang;
  if (Math.abs(b.circle) >= Math.PI * 2 * 0.94) {
    b.circle = 0; b.shield = false; b.stun = b.phase === 2 ? 3.8 : 4.6;
    emit(s, { type: 'netCut', x: b.x, y: b.y });
    // Each cut spills a couple of captives.
    for (let i = 0; i < 2; i++) {
      const a = makeAnimal(s, 'turtle', b.x + s.rng.range(-90, 90), b.y + s.rng.range(-90, 90), s.rng);
      a.state = 'freed';
      s.animals.push(a);
      emit(s, { type: 'freed', x: a.x, y: a.y, animal: a.type });
    }
    return;
  }
  if (b.phase === 2) {
    b.orbit += 0.3 * dt;
    toward(s, b, s.w / 2 + Math.cos(b.orbit) * 230, s.h / 2 - 100 + Math.sin(b.orbit) * 160, 60, dt);
  } else { b.vx *= Math.exp(-2 * dt); b.vy *= Math.exp(-2 * dt); }
  b.fireCd -= dt;
  if (b.fireCd <= 0) {
    b.fireCd = b.phase === 2 ? 1.6 : 2.2;
    // Two nets: one where the boat will be, one a little further along its course. Circling in a steady ring gets you caught.
    const l = lead(s, 1.1, 14), l2 = lead(s, 1.75, 30);
    fireShot(s, b.x, b.y, l.x, l.y, 1.1, 54, 'net');
    if (b.phase === 2 || s.spec.sea > 0) fireShot(s, b.x, b.y, l2.x, l2.y, 1.45, 50, 'net');
  }
  // A tangled boat is a sitting duck: his gunners open up the moment a net lands.
  b.t -= dt;
  if (p.snare > 1.9 && b.t <= 0) {
    b.t = 2.4;
    fireShot(s, b.x, b.y, p.x + p.vx * 0.5, p.y + p.vy * 0.5, 1.05, 46);
    fireShot(s, b.x, b.y, p.x + p.vx * 1.1 + s.rng.range(-30, 30), p.y + p.vy * 1.1 + s.rng.range(-30, 30), 1.3, 46);
  }
  b.spawnCd -= dt;
  if (b.spawnCd <= 0) {
    b.spawnCd = 6;
    if (minions(s) < b.phase + 1) { const spot = findSpot(s, s.rng, 20, 380); spawnMinion(s, 'sloop', spot.x, spot.y); }
  }
}

function galleon(s: LegState, b: Boss, dt: number) {
  const p = s.player;
  const phase = b.hp <= b.maxHp / 3 ? 3 : b.hp <= (b.maxHp * 2) / 3 ? 2 : 1;
  if (phase > b.phase) {
    setPhase(s, b, phase);
    if (phase === 2) {
      for (let i = 0; i < 2; i++) {
        const spot = findSpot(s, s.rng, 150, 330, 230);
        s.hazards.push(makeHazard(s, 'whirlpool', spot.x, spot.y, 150, s.rng));
      }
    }
    if (phase === 3) { s.env.dark = 0.96; b.state = 'sail'; b.t = 4; }
  }
  if (b.state === 'intro') { b.state = 'sail'; b.t = 6; b.orbit = -Math.PI / 2; }

  if (b.phase === 3) {
    const lit = s.moonPatches.some((m) => dist(m.x, m.y, b.x, b.y) < m.r + b.r * 0.5);
    b.hidden = !(lit || revealAll(s) || b.shotsLeft > 0 || b.stun > 0);
  } else b.hidden = false;
  if (b.shotsLeft > 0) b.shotsLeft = Math.max(0, b.shotsLeft - dt);

  if (b.phase === 2 && chargeStates(s, b, dt, 400, 2.6)) return;
  if (b.stun > 0) { b.stun -= dt; b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt); return; }
  if (b.state !== 'sail') { b.state = 'sail'; b.t = 5; }

  b.orbit += (b.phase === 3 ? 0.24 : 0.15) * dt;
  toward(s, b, s.w / 2 + Math.cos(b.orbit) * 560, s.h / 2 + Math.sin(b.orbit) * 340, b.phase === 3 ? 150 : 100, dt, 1.5);

  b.fireCd -= dt;
  if (b.fireCd <= 0 && dist(p.x, p.y, b.x, b.y) < 900) {
    b.fireCd = b.phase === 3 ? 3.0 : 3.6;
    const n = b.phase === 1 ? 4 : b.phase === 2 ? 3 : 5;
    const l = lead(s, 0.8);
    const a0 = s.rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const rr = i === 0 ? 0 : 95;
      fireShot(s, b.x, b.y, l.x + Math.cos(a) * rr, l.y + Math.sin(a) * rr, 1.4 + i * 0.12, 44);
    }
    b.shotsLeft = 1.2; // briefly lit by its own cannon fire
  }
  b.spawnCd -= dt;
  if (b.spawnCd <= 0) {
    b.spawnCd = 7;
    if (minions(s) < 2) { const spot = findSpot(s, s.rng, 16, 380); spawnMinion(s, 'ghost', spot.x, spot.y); }
  }
  if (b.phase === 2) { b.t -= dt; if (b.t <= 0) startCharge(s, b, 1.3); }
}

export function stepBoss(s: LegState, b: Boss, dt: number) {
  b.hitCd = Math.max(0, b.hitCd - dt);
  if (b.dying > 0) {
    b.dying -= dt;
    b.vx *= Math.exp(-2 * dt); b.vy *= Math.exp(-2 * dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.dying <= 0) {
      for (const pr of s.pirates) if (pr.state !== 'sinking') { pr.state = 'sinking'; pr.t = 0.7; }
      s.shots.length = 0;
      if (b.kind === 'galleon') {
        // The hold bursts open: Marshmallow is free. Sail over to her to bring her home.
        const a = makeAnimal(s, 'marshmallow', b.x, b.y, s.rng);
        a.state = 'freed';
        s.animals.push(a);
        s.env.dark = 0.55;
        emit(s, { type: 'freed', x: a.x, y: a.y, animal: 'marshmallow' });
        s.boss = null;
      } else endLeg(s, 'won');
    }
    return;
  }
  if (b.state === 'intro' && b.kind !== 'ember' && b.kind !== 'netmaker' && b.kind !== 'galleon') {
    b.t -= dt;
    if (b.t <= 0) { if (b.kind === 'bogqueen') dive(s, b); else { b.state = 'cruise'; b.t = 1.2; } }
    return;
  }
  switch (b.kind) {
    case 'frostbeard': frostbeard(s, b, dt); break;
    case 'bogqueen': bogqueen(s, b, dt); break;
    case 'ember': ember(s, b, dt); break;
    case 'netmaker': netmaker(s, b, dt); break;
    case 'galleon': galleon(s, b, dt); break;
  }
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.x = clamp(b.x, b.r, s.w - b.r); b.y = clamp(b.y, b.r, s.h - b.r);
  const v = Math.hypot(b.vx, b.vy);
  if (v > 12 && b.state !== 'aim' && b.state !== 'stunned') b.angle = rotateToward(b.angle, Math.atan2(b.vy, b.vx), 2.5 * dt);
}

/** Can the player damage the boss when ramming from direction (nx, ny) = boss→player? */
export function bossVulnerable(b: Boss, nx: number, ny: number): boolean {
  const fromRear = (arc: number) => Math.abs(angDiff(b.angle + Math.PI, Math.atan2(ny, nx))) < arc;
  switch (b.kind) {
    case 'frostbeard': return b.state === 'stunned' || (b.state !== 'charge' && fromRear(1.0));
    case 'bogqueen': return !b.hidden;
    case 'ember': return !b.shield;
    case 'netmaker': return !b.shield;
    case 'galleon': return b.phase === 3 || b.state === 'stunned' || (b.state !== 'charge' && fromRear(0.95));
  }
}

export function collideBoss(s: LegState, b: Boss) {
  if (b.dying > 0 || (b.kind === 'bogqueen' && b.hidden)) return;
  const p = s.player;
  const dx = p.x - b.x, dy = p.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  const min = b.r + p.r;
  if (d >= min) return;
  const nx = dx / d, ny = dy / d;
  const into = -(p.vx * nx + p.vy * ny);
  p.x = b.x + nx * min; p.y = b.y + ny * min;

  if (b.state === 'charge') {
    hurtPlayer(s, 'boss', p.x, p.y);
    p.vx = nx * 380; p.vy = ny * 380;
    return;
  }
  if (b.hitCd > 0) { if (into > 0) { p.vx += nx * into * 1.3; p.vy += ny * into * 1.3; } return; }
  if (into >= ramSpeed(s) && bossVulnerable(b, nx, ny)) {
    const heavy = p.boostT > 0 || Math.hypot(p.vx, p.vy) >= TUNE.boat.heavyRamSpeed;
    // The Hollow Galleon is too big to hurry: only a ram on a dazed hull bites deep.
    const deep = b.kind === 'galleon' ? b.state === 'stunned' : heavy;
    b.hp -= deep ? 2 : 1;
    b.hitCd = b.kind === 'galleon' ? 1.3 : 0.8;
    bumpCombo(s);
    s.tally.rams++;
    const score = SC.chipHit * 4 * s.mult;
    addScore(s, score);
    p.vx += nx * into * 1.6; p.vy += ny * into * 1.6;
    b.vx -= nx * 60; b.vy -= ny * 60;
    emit(s, { type: 'bossHit', x: b.x + nx * b.r, y: b.y + ny * b.r, hp: Math.max(0, b.hp) });
    if (b.hp <= 0) {
      b.hp = 0; b.dying = 2.2; b.hidden = false; b.state = 'dying';
      addScore(s, s.baseScore * 10);
      s.tally.doubloons += 25;
      s.tally.kills++;
      emit(s, { type: 'bossDead', x: b.x, y: b.y });
      return;
    }
    // Per-boss reaction to a hit.
    if (b.kind === 'bogqueen') { b.stun = 0.4; dive(s, b); }
    if (b.kind === 'ember') { b.t = 0.6; b.orbit += Math.PI * 0.7; }
    if (b.kind === 'frostbeard' && b.state === 'stunned') b.stun = Math.min(b.stun, 0.8);
    if (b.kind === 'netmaker') b.stun = Math.min(b.stun, 1.6);
    if (b.kind === 'galleon' && b.state === 'stunned') b.stun = Math.min(b.stun, 0.9);
  } else if (into > 60) {
    p.vx += nx * into * 1.6; p.vy += ny * into * 1.6;
    b.hitCd = 0.3;
    emit(s, { type: 'clang', x: b.x + nx * b.r, y: b.y + ny * b.r });
  }
}
