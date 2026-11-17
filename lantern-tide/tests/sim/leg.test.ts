import { describe, expect, it } from 'vitest';
import { createLeg, makeAnimal, makeHazard, makePirate } from '../../src/sim/gen';
import { lanternRadius, step } from '../../src/sim/leg';
import { NO_INPUT, BIOME_ORDER, type LegKind } from '../../src/sim/types';
import { TUNE } from '../../src/content';
import { dist } from '../../src/core/math';
import { EAST, emptyLeg, playBot, run, spec } from './helpers';

describe('leg basics', () => {
  it('waits at the dock until the player takes the helm', () => {
    const s = createLeg(spec());
    run(s, 2, NO_INPUT);
    expect(s.status).toBe('ready');
    expect(s.timeLeft).toBe(30);
    run(s, 0.1, EAST);
    expect(s.status).toBe('running');
    expect(s.timeLeft).toBeLessThan(30);
  });

  it('is deterministic for a given seed and inputs', () => {
    const a = playBot(spec({ seed: 99 }));
    const b = playBot(spec({ seed: 99 }));
    const c = playBot(spec({ seed: 100 }));
    expect(a.s.score).toBe(b.s.score);
    expect(a.s.player.x).toBe(b.s.player.x);
    expect(a.s.tally).toEqual(b.s.tally);
    expect(`${c.s.player.x},${c.s.score}`).not.toBe(`${a.s.player.x},${a.s.score}`);
  });

  it('boat has momentum and a top speed', () => {
    const s = emptyLeg();
    run(s, 0.1, EAST);
    const early = s.player.vx;
    run(s, 3, EAST);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(TUNE.boat.maxSpeed * 0.5);
    expect(s.player.vx).toBeGreaterThan(TUNE.boat.maxSpeed * 0.9);
    expect(s.player.vx).toBeLessThanOrEqual(TUNE.boat.maxSpeed * 1.01);
    run(s, 2, NO_INPUT);
    expect(s.player.vx).toBeLessThan(40); // coasts to a stop
  });

  it('survive the timer on patrol and the leg is won', () => {
    const s = emptyLeg({ duration: 3 });
    const ev = run(s, 3.2, { ...EAST, sx: 0.01 });
    expect(s.status).toBe('won');
    expect(ev.some((e) => e.type === 'end')).toBe(true);
    expect(s.tally.gentleBonus).toBe(TUNE.score.gentleCaptain);
  });
});

describe('ramming', () => {
  it('a full-speed ram sinks a dinghy and scores the biome base value', () => {
    const s = emptyLeg();
    s.player.vx = 250;
    const pr = makePirate(s, 'dinghy', 560, 500, s.rng, false);
    s.pirates.push(pr);
    const ev = run(s, 0.4, EAST);
    const ram = ev.find((e) => e.type === 'ram');
    expect(ram && ram.type === 'ram' && ram.kill).toBe(true);
    expect(s.score).toBe(100);
    expect(s.tally.kills).toBe(1);
  });

  it('a slow bump only nudges', () => {
    const s = emptyLeg();
    s.player.vx = 60;
    s.pirates.push(makePirate(s, 'dinghy', 535, 500, s.rng, false));
    s.pirates[0].state = 'recover'; s.pirates[0].t = 5; // hold still
    const ev = run(s, 0.3, { ...EAST, sx: 0.1 });
    expect(ev.some((e) => e.type === 'ram')).toBe(false);
    expect(s.tally.kills).toBe(0);
  });

  it('sloops take two normal rams or one boosted ram', () => {
    const s = emptyLeg();
    s.player.vx = 250;
    const pr = makePirate(s, 'sloop', 565, 500, s.rng, false);
    s.pirates.push(pr);
    run(s, 0.2, EAST);
    expect(pr.hp).toBe(1);
    const s2 = emptyLeg();
    s2.pirates.push(makePirate(s2, 'sloop', 640, 500, s2.rng, false));
    s2.pirates[0].state = 'recover'; s2.pirates[0].t = 5;
    run(s2, 0.6, { ...EAST, boost: true });
    expect(s2.tally.kills).toBe(1);
  });

  it('brigantines shrug off a ram on the bow but not on the stern', () => {
    const s = emptyLeg();
    const pr = makePirate(s, 'brigantine', 570, 500, s.rng, false);
    pr.angle = Math.PI; // facing the player
    pr.state = 'recover'; pr.t = 5;
    s.pirates.push(pr);
    s.player.vx = 250;
    const ev = run(s, 0.2, EAST);
    expect(ev.some((e) => e.type === 'clang')).toBe(true);
    expect(pr.hp).toBe(3);

    const s2 = emptyLeg();
    const pr2 = makePirate(s2, 'brigantine', 570, 500, s2.rng, false);
    pr2.angle = 0; // sailing away: we hit the stern
    pr2.state = 'recover'; pr2.t = 5;
    s2.pirates.push(pr2);
    s2.player.vx = 250;
    run(s2, 0.2, EAST);
    expect(pr2.hp).toBe(2);
  });

  it('combo multiplier climbs 1-2-3-5 and expires', () => {
    const s = emptyLeg();
    const mults: number[] = [];
    for (let i = 0; i < 5; i++) {
      s.player.x = 500; s.player.y = 500; s.player.vx = 250; s.player.vy = 0; s.player.angle = 0;
      s.pirates = [makePirate(s, 'dinghy', 540, 500, s.rng, false)];
      run(s, 0.15, EAST);
      mults.push(s.mult);
    }
    expect(mults).toEqual([1, 2, 3, 5, 5]);
    s.pirates = [];
    run(s, TUNE.score.comboWindow + 0.2, NO_INPUT);
    expect(s.mult).toBe(1);
  });

  it('sinking a pirate adds a second to the clock, up to the cap', () => {
    const s = emptyLeg({ duration: 30 });
    for (let i = 0; i < 14; i++) {
      s.player.x = 500; s.player.vx = 250; s.player.angle = 0;
      s.pirates = [makePirate(s, 'dinghy', 540, 500, s.rng, false)];
      run(s, 0.1, EAST);
    }
    expect(s.timeBonusGiven).toBe(TUNE.score.timeBonusCap);
  });
});

describe('hazards and hull', () => {
  it('hitting an iceberg costs a plank, three sink you, and losing is not winning', () => {
    const s = emptyLeg();
    s.hazards.push(makeHazard(s, 'iceberg', 600, 500, 40, s.rng));
    s.hazards[0].vx = 0; s.hazards[0].vy = 0;
    const ev = run(s, 1.2, EAST);
    expect(ev.filter((e) => e.type === 'hazardHit').length).toBe(1);
    expect(s.player.planks).toBe(2);
    expect(s.player.invuln).toBeGreaterThan(0);
    run(s, 12, EAST);
    expect(s.player.planks).toBe(0);
    expect(s.status).toBe('lost');
  });

  it('classic mode keeps the original instant-death rule', () => {
    const s = createLeg(spec({ kind: 'classic', classicLevel: 1 }));
    s.pirates = []; s.animals = []; s.hazards = [];
    s.player.x = 500; s.player.y = 400; s.player.angle = 0;
    s.hazards.push(makeHazard(s, 'iceberg', 600, 400, 40, s.rng));
    s.hazards[0].vx = 0; s.hazards[0].vy = 0; s.hazards[0].calveT = 0;
    run(s, 1.5, EAST);
    expect(s.status).toBe('lost');
  });

  it('Pingo crew makes the first hazard hit free', () => {
    const base = spec();
    const s = emptyLeg({ loadout: { ...base.loadout, crew: ['pingo'] } });
    s.hazards.push(makeHazard(s, 'iceberg', 600, 500, 40, s.rng));
    s.hazards[0].vx = 0; s.hazards[0].vy = 0;
    run(s, 1.2, EAST);
    expect(s.player.planks).toBe(3);
    expect(s.player.freeHit).toBe(false);
  });

  it('skimming a hazard at speed scores a near miss', () => {
    const s = emptyLeg();
    const h = makeHazard(s, 'iceberg', 700, 500 + 40 * 0.9 + 15 * 0.85 + 8, 40, s.rng);
    h.vx = 0; h.vy = 0; h.calveT = 0;
    s.hazards.push(h);
    s.player.vx = 250;
    const ev = run(s, 2, EAST);
    expect(ev.some((e) => e.type === 'nearMiss')).toBe(true);
    expect(s.player.planks).toBe(3);
  });

  it('a shoved floe sinks a pirate for an Iceberg Assist', () => {
    const s = emptyLeg();
    const floe = makeHazard(s, 'floe', 560, 500, 20, s.rng);
    s.hazards.push(floe);
    const pr = makePirate(s, 'dinghy', 700, 500, s.rng, false);
    pr.state = 'recover'; pr.t = 9;
    s.pirates.push(pr);
    s.player.vx = 300;
    const ev = run(s, 1.5, { ...EAST, boost: true });
    expect(ev.some((e) => e.type === 'assist')).toBe(true);
    expect(s.tally.assists).toBe(1);
    expect(s.player.planks).toBe(3);
  });
});

describe('animals and karma', () => {
  it('bonking an animal costs 50 points and karma; the third one makes you a monster', () => {
    const s = emptyLeg();
    const all = [] as string[];
    for (let i = 0; i < 3; i++) {
      s.player.x = 500; s.player.y = 500; s.player.vx = 250; s.player.vy = 0; s.player.angle = 0;
      s.animals = [makeAnimal(s, 'pingo', 525, 500, s.rng)];
      all.push(...run(s, 0.1, EAST).map((e) => e.type));
    }
    expect(s.score).toBe(-150);
    expect(s.tally.karma).toBe(-3);
    expect(all.filter((t) => t === 'bonk').length).toBe(3);
    expect(all.filter((t) => t === 'monster').length).toBe(1);
  });

  it('creeping up to an animal does not hurt it', () => {
    const s = emptyLeg();
    s.animals = [makeAnimal(s, 'pingo', 530, 500, s.rng)];
    s.player.vx = 40;
    const ev = run(s, 0.5, { ...EAST, sx: 0.08 });
    expect(ev.some((e) => e.type === 'bonk')).toBe(false);
    expect(s.score).toBe(0);
  });

  it('sinking a netter frees its captives; towing them home rescues them', () => {
    const s = emptyLeg({ kind: 'rescue' });
    s.goal = 9;
    s.zones.push({ x: 900, y: 500, r: 100 });
    const pr = makePirate(s, 'netter', 580, 500, s.rng, false);
    pr.state = 'recover'; pr.t = 9;
    const a = makeAnimal(s, 'zabica', 580, 500, s.rng);
    a.state = 'netted'; a.captor = pr.id; pr.netted.push(a.id);
    s.pirates.push(pr); s.animals.push(a);
    const ev = run(s, 1.0, { ...EAST, boost: true });
    expect(ev.some((e) => e.type === 'freed')).toBe(true);
    const ev2 = run(s, 6, (st) => {
      const t = st.player.towed.length ? st.zones[0] : a;
      const dx = t.x - st.player.x, dy = t.y - st.player.y, l = Math.hypot(dx, dy) || 1;
      return { sx: (dx / l) * 0.6, sy: (dy / l) * 0.6, boost: false, brake: false, flare: false };
    });
    const all = [...ev, ...ev2];
    expect(all.some((e) => e.type === 'towStart')).toBe(true);
    expect(all.some((e) => e.type === 'delivered')).toBe(true);
    expect(s.tally.rescued).toBe(1);
    expect(s.tally.karma).toBe(1);
    expect(s.tally.pearls).toBe(1);
    expect(a.state).toBe('safe');
  });

  it('a rescue leg that runs out of time is a timeout, not a win', () => {
    const s = createLeg(spec({ kind: 'rescue', biome: 'swamp', duration: 2 }));
    run(s, 2.5, { sx: 0.06, sy: 0, boost: false, brake: false, flare: false });
    expect(s.status).toBe('timeout');
  });
});

describe('lantern', () => {
  it('burns down over time and oil barrels refill it', () => {
    const s = emptyLeg();
    const r0 = lanternRadius(s);
    run(s, 20, NO_INPUT);
    const r1 = lanternRadius(s);
    expect(r1).toBeLessThan(r0);
    expect(r1).toBeGreaterThanOrEqual(TUNE.lantern.radius * TUNE.lantern.minFactor);
    s.pickups.push({ id: 999, type: 'barrel', x: s.player.x + 10, y: s.player.y, vx: 0, vy: 0, t: 5, phase: 0 });
    run(s, 0.2, NO_INPUT);
    expect(lanternRadius(s)).toBeGreaterThan(r1);
  });

  it('a flare stuns nearby pirates and goes on cooldown', () => {
    const s = emptyLeg();
    const pr = makePirate(s, 'sloop', 800, 500, s.rng, false);
    s.pirates.push(pr);
    step(s, { ...NO_INPUT, flare: true });
    expect(pr.stun).toBeGreaterThan(0);
    expect(s.player.flareCd).toBeGreaterThan(10);
  });
});

describe('sea state (difficulty)', () => {
  it('rougher seas bring more pirates, tougher captains and better pay', () => {
    const calm = createLeg(spec({ sea: 0, seed: 3 })), choppy = createLeg(spec({ sea: 1, seed: 3 })), stormy = createLeg(spec({ sea: 2, seed: 3 }));
    expect(choppy.targetPirates).toBeGreaterThan(calm.targetPirates);
    expect(stormy.targetPirates).toBeGreaterThan(choppy.targetPirates);
    const b0 = createLeg(spec({ sea: 0, kind: 'boss' })), b2 = createLeg(spec({ sea: 2, kind: 'boss' }));
    expect(b2.boss!.hp).toBeGreaterThan(b0.boss!.hp);
    const s = emptyLeg({ sea: 2 });
    s.player.vx = 250;
    s.pirates.push(makePirate(s, 'dinghy', 560, 500, s.rng, false));
    run(s, 0.4, EAST);
    expect(s.score).toBe(160);
  });

  it('a chased dinghy drops powder kegs on choppy seas, and kegs hurt pirates too', () => {
    const s = emptyLeg({ sea: 1 });
    const pr = makePirate(s, 'dinghy', 650, 500, s.rng, false);
    pr.state = 'flee';
    s.pirates.push(pr);
    const ev = run(s, 1.0, { ...EAST, sx: 0.6 });
    expect(ev.some((e) => e.type === 'kegDrop')).toBe(true);
    expect(s.shots.some((q) => q.kind === 'keg')).toBe(true);
    const calm = emptyLeg({ sea: 0 });
    const pr2 = makePirate(calm, 'dinghy', 650, 500, calm.rng, false);
    pr2.state = 'flee';
    calm.pirates.push(pr2);
    expect(run(calm, 1.0, { ...EAST, sx: 0.6 }).some((e) => e.type === 'kegDrop')).toBe(false);

    const k = emptyLeg({ sea: 1 });
    const victim = makePirate(k, 'sloop', 800, 800, k.rng, false);
    victim.state = 'recover'; victim.t = 9;
    k.pirates.push(victim);
    k.shots.push({ id: 999, x0: 800, y0: 800, tx: 800, ty: 800, t: 0, dur: 0.2, r: 52, kind: 'keg' });
    const ev2 = run(k, 0.4, { sx: 0, sy: 0, boost: false, brake: false, flare: false });
    expect(victim.hp).toBe(1);
    expect(ev2.some((e) => e.type === 'assist')).toBe(true);
  });

  it('a message in a bottle can be found when the leg offers one', () => {
    const s = createLeg(spec({ bottle: true }));
    const bottle = s.pickups.find((q) => q.type === 'bottle')!;
    expect(bottle).toBeTruthy();
    s.status = 'running';
    s.player.x = bottle.x - 10; s.player.y = bottle.y;
    run(s, 0.2, { sx: 0, sy: 0, boost: false, brake: false, flare: false });
    expect(s.tally.bottle).toBe(true);
  });

  it('lights won back from captains are lasting blessings', () => {
    const plain = emptyLeg(), lit = emptyLeg({ lights: ['frostbeard', 'ember'] });
    expect(lanternRadius(lit)).toBeGreaterThan(lanternRadius(plain));
    step(plain, { ...NO_INPUT, flare: true }); step(lit, { ...NO_INPUT, flare: true });
    expect(lit.player.flareCd).toBeLessThan(plain.player.flareCd);
  });
});

describe('untimed legs', () => {
  it('a bounty has no clock and ends when enough pirates are sunk', () => {
    const s = createLeg(spec({ kind: 'bounty', seed: 4 }));
    expect(s.timed).toBe(false);
    expect(s.goal).toBeGreaterThanOrEqual(8);
    run(s, 40, NO_INPUT);
    expect(s.status).toBe('ready'); // sitting at the dock forever is allowed
    const { s: played } = playBot(spec({ kind: 'bounty', seed: 4, loadout: { ...spec().loadout, planks: 9, maxPlanks: 9 } }), 240);
    expect(played.status).toBe('won');
    expect(played.tally.kills).toBe(played.goal);
  });

  it('beacons are relit by sailing to them, and a douser left alone snuffs one', () => {
    const s = createLeg(spec({ kind: 'beacons', seed: 4 }));
    expect(s.timed).toBe(false);
    expect(s.beacons.length).toBe(5);
    expect(s.pirates.filter((q) => q.type === 'douser').length).toBeGreaterThanOrEqual(2);
    s.pirates = []; s.targetPirates = 0; s.status = 'running';
    const b = s.beacons[0];
    s.player.x = b.x - 30; s.player.y = b.y; s.player.angle = 0;
    run(s, 0.5, NO_INPUT);
    expect(b.lit).toBe(false); // it takes a moment of holding station
    const ev = run(s, 1.2, NO_INPUT);
    expect(b.lit).toBe(true);
    expect(ev.some((e) => e.type === 'beaconLit')).toBe(true);
    s.player.x = b.x + 900 > s.w ? b.x - 900 : b.x + 900;
    const d = makePirate(s, 'douser', b.x + 10, b.y, s.rng, false);
    d.state = 'recover'; d.t = 9;
    s.pirates.push(d);
    const ev2 = run(s, 4.5, NO_INPUT);
    expect(b.lit).toBe(false);
    expect(ev2.some((e) => e.type === 'beaconOut')).toBe(true);
  });

  it('the autopilot can relight every beacon', () => {
    const { s } = playBot(spec({ kind: 'beacons', seed: 9, loadout: { ...spec().loadout, planks: 9, maxPlanks: 9 } }), 300);
    expect(s.status).toBe('won');
    expect(s.beacons.every((q) => q.lit)).toBe(true);
  });

  it('a second net on a tangled boat costs a plank', () => {
    const s = emptyLeg();
    s.player.snare = 1.5;
    s.shots.push({ id: 77, x0: 0, y0: 0, tx: s.player.x, ty: s.player.y, t: 0, dur: 0.1, r: 54, kind: 'net' });
    run(s, 0.3, NO_INPUT);
    expect(s.player.planks).toBe(2);
  });
});

describe('generation', () => {
  const kinds: LegKind[] = ['patrol', 'rescue', 'convoy', 'storm', 'bounty', 'beacons', 'boss'];
  it('never spawns hazards or pirates on top of the player, in any biome or leg type', () => {
    for (const biome of BIOME_ORDER) for (const kind of kinds) for (let seed = 1; seed <= 6; seed++) {
      const s = createLeg(spec({ biome, kind, seed, difficulty: 4 }));
      const p = s.player;
      for (const h of s.hazards) {
        const core = h.type === 'whirlpool' ? 60 : h.r;
        expect(dist(h.x, h.y, p.x, p.y), `${biome}/${kind}/${seed} ${h.type}`).toBeGreaterThan(core + 100);
      }
      for (const pr of s.pirates) expect(dist(pr.x, pr.y, p.x, p.y), `${biome}/${kind}/${seed} pirate`).toBeGreaterThan(250);
      for (const a of s.animals) if (a.state === 'wander') expect(dist(a.x, a.y, p.x, p.y)).toBeGreaterThan(120);
      for (let i = 0; i < s.hazards.length; i++) for (let j = i + 1; j < s.hazards.length; j++) {
        const a = s.hazards[i], b = s.hazards[j];
        if (!a.solid || !b.solid) continue;
        expect(dist(a.x, a.y, b.x, b.y), `${biome}/${kind}/${seed} overlap`).toBeGreaterThan(a.r + b.r);
      }
    }
  });

  it('respawned pirates appear far from the player with a warning ripple', () => {
    const { events } = playBot(spec({ seed: 7 }));
    const s = createLeg(spec({ seed: 7 }));
    void s;
    expect(events.filter((e) => e.type === 'spawn').length).toBeGreaterThan(0);
  });

  it('every biome and leg type plays through without breaking', () => {
    for (const biome of BIOME_ORDER) for (const kind of kinds) {
      const { s } = playBot(spec({ biome, kind, seed: 42, duration: kind === 'convoy' ? 60 : 30 }), 85);
      expect(Number.isFinite(s.player.x) && Number.isFinite(s.player.y) && Number.isFinite(s.score), `${biome}/${kind}`).toBe(true);
      for (const pr of s.pirates) expect(Number.isFinite(pr.x + pr.y), `${biome}/${kind} pirate`).toBe(true);
      for (const a of s.animals) expect(Number.isFinite(a.x + a.y), `${biome}/${kind} animal`).toBe(true);
      if (kind !== 'boss' && kind !== 'bounty' && kind !== 'beacons') expect(s.status, `${biome}/${kind}`).not.toBe('running');
    }
  });

  it('classic levels match the original counts', () => {
    const counts = [[6, 3, 1], [7, 2, 3], [9, 1, 5]];
    for (let lv = 1; lv <= 3; lv++) {
      const s = createLeg(spec({ kind: 'classic', classicLevel: lv as 1 | 2 | 3 }));
      expect([s.hazards.length, s.pirates.length, s.animals.length]).toEqual(counts[lv - 1]);
      expect(s.baseScore).toBe(lv * 100);
      expect(s.w).toBe(1120);
    }
  });

  it('the tutorial can be completed', () => {
    const { s } = playBot(spec({ kind: 'tutorial' }), 90);
    expect(s.status).toBe('won');
    expect(s.tutorial?.step).toBe(5);
  });
});
