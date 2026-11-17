import { describe, expect, it } from 'vitest';
import { applyLeg, buyUpgrade, canRetry, currentChoices, generateChart, legSpec, newRun, repair, restoreCheckpoint, toggleCrew, upgradeCost } from '../../src/meta/run';
import { addScore, defaultProfile, qualifies } from '../../src/meta/profile';
import { createLeg } from '../../src/sim/gen';
import { playBot } from './helpers';

function finish(run: ReturnType<typeof newRun>, status: 'won' | 'lost' | 'timeout', over: (s: ReturnType<typeof createLeg>) => void = () => {}) {
  const node = currentChoices(run)[0];
  const s = createLeg(legSpec(run, node));
  s.status = status;
  over(s);
  return { out: applyLeg(run, s, node), node, s };
}

describe('voyage', () => {
  it('charts are deterministic per seed and end in harbour then boss', () => {
    const a = newRun('voyage', { seed: 5 }), b = newRun('voyage', { seed: 5 });
    expect(a.chart).toEqual(b.chart);
    expect(a.chart.map((c) => c.length)).toEqual([1, 2, 2, 1, 1]);
    expect(a.chart[3][0].kind).toBe('harbour');
    expect(a.chart[4][0].kind).toBe('boss');
    expect(new Set(a.chart[1].map((n) => n.kind)).size).toBe(2);
  });

  it('sinking ends the voyage instead of advancing (the original bug)', () => {
    const run = newRun('voyage', { seed: 5 });
    const { out } = finish(run, 'lost');
    expect(out.advanced).toBe(false);
    expect(run.over).toBe(true);
    expect(run.col).toBe(0);
  });

  it('winning a leg banks loot and advances the chart', () => {
    const run = newRun('voyage', { seed: 5 });
    const { out } = finish(run, 'won', (s) => { s.score = 900; s.tally.doubloons = 12; s.tally.pearls = 2; s.tally.karma = 2; s.player.planks = 2; });
    expect(out.advanced).toBe(true);
    expect(run.col).toBe(1);
    expect([run.score, run.doubloons, run.pearls, run.karma, run.planks]).toEqual([900, 12, 2, 2, 2]);
  });

  it('rescued animals join the crew when karma is not negative', () => {
    const run = newRun('voyage', { seed: 5 });
    const { out } = finish(run, 'won', (s) => { s.tally.rescuedTypes = ['pingo', 'pingo']; s.tally.karma = 2; });
    expect(out.newCrew).toEqual(['pingo']);
    expect(run.equipped).toEqual(['pingo']);
    const bad = newRun('voyage', { seed: 5 });
    bad.karma = -4;
    finish(bad, 'won', (s) => { s.tally.rescuedTypes = ['pingo']; s.tally.karma = 1; });
    expect(bad.crew).toEqual([]);
  });

  it('beating a boss moves to the next biome; beating the last wins the voyage', () => {
    const run = newRun('voyage', { seed: 5 });
    run.col = 4; run.planks = 1;
    const { out } = finish(run, 'won', (s) => { s.player.planks = 1; });
    expect(out.biomeCleared).toBe(true);
    expect(run.biome).toBe(1);
    expect(run.col).toBe(0);
    expect(run.planks).toBe(2); // free repair
    run.biome = 4; run.chart = generateChart(run); run.col = 4;
    const end = finish(run, 'won');
    expect(end.out.won).toBe(true);
    expect(run.over && run.won).toBe(true);
  });

  it('beating a captain returns a stolen light, and letters are kept', () => {
    const run = newRun('voyage', { seed: 5 });
    run.col = 4;
    const { out } = finish(run, 'won');
    expect(out.light).toBe('frostbeard');
    expect(run.lights).toEqual(['frostbeard']);
    expect(legSpec(run, currentChoices(run)[0]).lights).toEqual(['frostbeard']);
    run.col = 1;
    expect(legSpec(run, currentChoices(run)[0]).bottle).toBe(true);
    const got = finish(run, 'won', (s) => { s.tally.bottle = true; });
    expect(got.out.letter).toBe(1);
    expect(legSpec(run, currentChoices(run)[0]).bottle).toBe(false);
  });

  it('sinking restarts the current sea, not the whole voyage', () => {
    const run = newRun('voyage', { seed: 5 });
    run.seen.push('intro');
    // Beat the first captain: arriving in the second sea is the new checkpoint.
    run.col = 4;
    finish(run, 'won', (s) => { s.score = 1000; s.tally.doubloons = 40; s.player.planks = 2; });
    expect(run.biome).toBe(1);
    const arrived = { score: run.score, doubloons: run.doubloons, planks: run.planks, lights: [...run.lights] };
    // Make progress in the second sea, then sink.
    finish(run, 'won', (s) => { s.score = 500; s.tally.doubloons = 9; });
    run.seen.push('biome.swamp');
    expect(run.col).toBe(1);
    finish(run, 'lost', (s) => { s.score = 200; });
    expect(run.over).toBe(true);
    expect(canRetry(run)).toBe(true);
    const again = restoreCheckpoint(run)!;
    expect(again.over).toBe(false);
    expect([again.biome, again.col]).toEqual([1, 0]);
    expect({ score: again.score, doubloons: again.doubloons, planks: again.planks, lights: again.lights }).toEqual(arrived);
    expect(again.chart.flat().every((n) => !n.done)).toBe(true);
    expect(again.retries).toBe(1);
    expect(again.seen).toContain('biome.swamp'); // story is not replayed
    // The restarted voyage can sink and restart again from the same place.
    finish(again, 'lost');
    expect(restoreCheckpoint(again)!.retries).toBe(2);
    // Other modes have no chapters.
    const daily = newRun('daily', { date: '2026-11-15' });
    finish(daily, 'lost');
    expect(canRetry(daily)).toBe(false);
  });

  it('low karma brings storms', () => {
    const run = newRun('voyage', { seed: 5 });
    run.karma = -5;
    const chart = generateChart(run);
    expect(chart[1].some((n) => n.kind === 'storm')).toBe(true);
    expect(chart[2].some((n) => n.kind === 'storm')).toBe(true);
  });

  it('harbour: upgrades, repairs and crew slots', () => {
    const run = newRun('voyage', { seed: 5 });
    expect(buyUpgrade(run, 'hull')).toBe(false);
    run.doubloons = 100;
    const cost = upgradeCost(run, 'hull')!;
    expect(buyUpgrade(run, 'hull')).toBe(true);
    expect(run.doubloons).toBe(100 - cost);
    expect(run.maxPlanks).toBe(4);
    run.planks = 2;
    expect(repair(run)).toBe(true);
    expect(run.planks).toBe(3);
    run.crew = ['pingo', 'zabica', 'ribica', 'turtle']; run.equipped = ['pingo', 'zabica', 'ribica'];
    expect(toggleCrew(run, 'turtle')).toBe(false);
    expect(toggleCrew(run, 'pingo')).toBe(true);
    expect(toggleCrew(run, 'turtle')).toBe(true);
    expect(run.equipped).toEqual(['zabica', 'ribica', 'turtle']);
  });

  it('daily tide uses the same seed for everyone on a given date', () => {
    const a = newRun('daily', { date: '2026-11-15' }), b = newRun('daily', { date: '2026-11-15' }), c = newRun('daily', { date: '2026-11-16' });
    expect(a.seed).toBe(b.seed);
    expect(a.seed).not.toBe(c.seed);
  });

  it('classic is three levels and failing one ends it', () => {
    const run = newRun('classic', { seed: 3 });
    for (let i = 0; i < 3; i++) {
      const spec = legSpec(run);
      expect(spec.kind).toBe('classic');
      expect(spec.classicLevel).toBe(i + 1);
      const s = createLeg(spec); s.status = 'won';
      applyLeg(run, s);
    }
    expect(run.won).toBe(true);
    const run2 = newRun('classic', { seed: 3 });
    const s = createLeg(legSpec(run2)); s.status = 'lost';
    applyLeg(run2, s);
    expect(run2.over && !run2.won).toBe(true);
  });

  it('an autopilot can sail a full voyage chart without errors', () => {
    const run = newRun('voyage', { seed: 77 });
    run.maxPlanks = 9; run.planks = 9; // only checking the flow here
    let guard = 0;
    while (!run.over && guard++ < 60) {
      const node = currentChoices(run)[0];
      if (node.kind === 'harbour') { run.col++; continue; }
      const { s } = playBot(legSpec(run, node), 240);
      if (s.status === 'running') s.status = 'timeout';
      applyLeg(run, s, node);
      run.planks = 9;
    }
    expect(run.over).toBe(true);
    expect(run.stats.legs).toBeGreaterThan(5);
  });
});

describe('scoreboard', () => {
  it('keeps the top ten, with lunar runs on their own board', () => {
    const p = defaultProfile();
    for (let i = 0; i < 14; i++) addScore(p, 'voyage', { name: 'a', score: i * 10, date: '', lunar: false, assist: false, note: '' });
    addScore(p, 'voyage', { name: 'moon', score: 5, date: '', lunar: true, assist: false, note: '' });
    const clean = p.scores.voyage.filter((e) => !e.lunar);
    expect(clean.length).toBe(10);
    expect(clean[0].score).toBe(130);
    expect(p.scores.voyage.filter((e) => e.lunar).length).toBe(1);
    expect(qualifies(p, 'voyage', 1, false)).toBe(false);
    expect(qualifies(p, 'voyage', 999, false)).toBe(true);
  });
});
