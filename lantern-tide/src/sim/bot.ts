import { dist } from '../core/math';
import { ramSpeed } from './leg';
import type { Input, LegState } from './types';

/**
 * A simple autopilot. Used by tests, balance runs and the title-screen attract mode.
 * It plays like a keen but imperfect human: chases the nearest pirate, tows freed animals home,
 * and steers around hazards and animals. `skill` 0..1 scales how careful it is.
 */
export function botInput(s: LegState, skill = 1): Input {
  const p = s.player;
  let tx = s.w / 2, ty = s.h / 2, hunting = false, best = Infinity, holdStation = false;

  if (s.tutorial) {
    const m = s.markers[0];
    if (m) { tx = m.x; ty = m.y; }
  }
  if (p.towed.length > 0 && s.zones.length > 0) {
    const z = s.zones.reduce((a, b) => (dist(a.x, a.y, p.x, p.y) < dist(b.x, b.y, p.x, p.y) ? a : b));
    tx = z.x; ty = z.y; best = 0;
  } else {
    for (const a of s.animals) {
      if (a.state !== 'freed') continue;
      const d = dist(a.x, a.y, p.x, p.y) * 0.6;
      if (d < best) { best = d; tx = a.x; ty = a.y; hunting = false; }
    }
    for (const pr of s.pirates) {
      if (pr.state === 'spawning' || pr.state === 'sinking') continue;
      const d = dist(pr.x, pr.y, p.x, p.y);
      if (d < best) { best = d; tx = pr.x + pr.vx * 0.25; ty = pr.y + pr.vy * 0.25; hunting = true; }
    }
    for (const k of s.pickups) {
      const want = k.type === 'plank' || p.oil < 0.5;
      const d = dist(k.x, k.y, p.x, p.y);
      if (want && d < 260 && d < best) { best = d; tx = k.x; ty = k.y; hunting = false; }
    }
    // Beacons: head for the nearest dark one unless a pirate is right there for the taking.
    if (s.beacons.some((q) => !q.lit) && best > 200) {
      const dark = s.beacons.filter((q) => !q.lit).reduce((m, q) => (dist(q.x, q.y, p.x, p.y) < dist(m.x, m.y, p.x, p.y) ? q : m));
      tx = dark.x; ty = dark.y; best = dist(tx, ty, p.x, p.y); hunting = false;
      holdStation = best < 110;
    }
    const b = s.boss;
    if (b && b.dying <= 0 && !b.hidden && best > 500) {
      // Aim for the stern.
      tx = b.x - Math.cos(b.angle) * (b.r + 40); ty = b.y - Math.sin(b.angle) * (b.r + 40);
      best = dist(tx, ty, p.x, p.y); hunting = true;
    }
  }

  // Boss-specific tactics (enough to prove each fight is winnable).
  const boss = s.boss;
  let bossBoost = false;
  if (boss && boss.dying <= 0 && p.towed.length === 0) {
    const bd = dist(boss.x, boss.y, p.x, p.y);
    const open = boss.kind === 'frostbeard' ? boss.state === 'stunned'
      : boss.kind === 'ember' || boss.kind === 'netmaker' ? !boss.shield
      : boss.kind === 'galleon' ? boss.state === 'stunned' || boss.phase === 3 : false;
    if (open && !boss.hidden) { tx = boss.x; ty = boss.y; best = bd; hunting = true; bossBoost = bd < 320; }
    else if (boss.kind === 'frostbeard') {
      // Keep an iceberg between us and the icebreaker so its charge crashes.
      const berg = s.hazards.filter((h) => h.type === 'iceberg').sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
      if (berg) {
        const ux = berg.x - boss.x, uy = berg.y - boss.y, ul = Math.hypot(ux, uy) || 1;
        tx = berg.x + (ux / ul) * (berg.r + 75); ty = berg.y + (uy / ul) * (berg.r + 75);
      } else { tx = boss.x - Math.cos(boss.angle) * 90; ty = boss.y - Math.sin(boss.angle) * 90; }
      best = 0; hunting = false;
    } else if (boss.kind === 'ember') {
      // Stand so a crystal sits between the lantern and the Admiral: the beam does the rest.
      const c = s.hazards.filter((h) => h.type === 'crystal').sort((a, b) => dist(a.x, a.y, boss.x, boss.y) - dist(b.x, b.y, boss.x, boss.y))[0];
      if (c) {
        const ux = c.x - boss.x, uy = c.y - boss.y, ul = Math.hypot(ux, uy) || 1;
        tx = c.x + (ux / ul) * (c.r + 80); ty = c.y + (uy / ul) * (c.r + 80);
        best = 0; hunting = false;
      }
    } else if (boss.kind === 'netmaker') {
      // Circle to cut the net.
      const a = Math.atan2(p.y - boss.y, p.x - boss.x) + 0.55;
      tx = boss.x + Math.cos(a) * 190; ty = boss.y + Math.sin(a) * 190;
      best = 0; hunting = false;
    }
  }

  let dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;
  const speed = Math.hypot(p.vx, p.vy);
  const look = 70 + speed * 0.45 * skill;

  for (const h of s.hazards) {
    if (!h.hurts || (h.type === 'reef' && !h.exposed)) continue;
    const core = h.type === 'whirlpool' ? 95 : h.r;
    const ox = p.x - h.x, oy = p.y - h.y;
    const od = Math.hypot(ox, oy) || 1;
    const range = core + p.r + look;
    if (od < range) { const k = ((range - od) / look) * 2.4 * skill; dx += (ox / od) * k; dy += (oy / od) * k; }
  }
  for (const a of s.animals) {
    if (a.state === 'freed' || a.state === 'towed' || a.state === 'safe' || a.state === 'netted' || a.state === 'dazed') continue;
    const ox = p.x - a.x, oy = p.y - a.y;
    const od = Math.hypot(ox, oy) || 1;
    const range = a.r + p.r + 60;
    if (od < range) { const k = ((range - od) / 60) * 2.2 * skill; dx += (ox / od) * k; dy += (oy / od) * k; }
  }
  for (const sh of s.shots) {
    const ox = p.x - sh.tx, oy = p.y - sh.ty;
    const od = Math.hypot(ox, oy) || 1;
    const range = sh.r + 60;
    if (od < range && (sh.kind === 'keg' || sh.dur - sh.t < 0.9)) { const k = ((range - od) / range) * 3 * skill; dx += (ox / od) * k; dy += (oy / od) * k; }
  }
  const b = s.boss;
  if (b && b.state === 'charge') {
    // Sidestep the charge line.
    const px = -b.dirY, py = b.dirX;
    const side = (p.x - b.x) * px + (p.y - b.y) * py;
    dx += px * Math.sign(side || 1) * 2; dy += py * Math.sign(side || 1) * 2;
  }

  const l = Math.hypot(dx, dy) || 1;
  const aligned = Math.cos(Math.atan2(dy, dx) - p.angle) > 0.9;
  const boost = hunting && aligned && best < 300 && (speed < Math.max(ramSpeed(s) * 1.4, 220) || best < 140);
  return {
    // Holding station at a beacon: ease off and brake instead of overshooting.
    sx: (dx / l) * (holdStation ? Math.min(1, best / 60) * 0.5 : 1), sy: (dy / l) * (holdStation ? Math.min(1, best / 60) * 0.5 : 1),
    boost: boost || bossBoost || (s.tutorial?.step === 1),
    brake: holdStation && speed > 90,
    flare: p.flareCd <= 0 && (s.env.storm || (b?.hidden ?? false) || s.pirates.some((q) => q.state === 'charge')),
  };
}
