import { describe, expect, it } from 'vitest';
import { BIOME_ORDER, type LegKind } from '../../src/sim/types';
import { playBot, spec } from './helpers';

/**
 * Not a pass/fail gate so much as a readout: `npm run balance` prints how the autopilot fares.
 * The autopilot (skill 0.8) stands in for a competent player; "planks-" is hull lost per leg.
 */
describe('balance readout', () => {
  it('prints bot results per sea state, biome and leg type', () => {
    const rows: string[] = [];
    for (const sea of [0, 1, 2] as const) {
      rows.push(`--- sea ${['calm', 'choppy', 'stormy'][sea]}`);
      for (const biome of BIOME_ORDER) for (const kind of ['patrol', 'rescue', 'convoy', 'storm', 'boss'] as LegKind[]) {
        let score = 0, kills = 0, lost = 0, planks = 0, won = 0, bonk = 0, resc = 0, coins = 0, time = 0;
        const N = 8;
        for (let seed = 1; seed <= N; seed++) {
          const { s } = playBot(spec({ sea, biome, kind, seed: seed * 7919, duration: kind === 'convoy' ? 60 : kind === 'rescue' ? 45 : 30, difficulty: BIOME_ORDER.indexOf(biome) * 2 + 0.5 }), 180, 0.8);
          score += s.score; kills += s.tally.kills; planks += s.tally.planksLost; bonk += s.tally.animalsHit; resc += s.tally.rescued; coins += s.tally.doubloons; time += s.time;
          if (s.status === 'lost') lost++;
          if (s.status === 'won') won++;
        }
        rows.push(`${biome.padEnd(8)} ${kind.padEnd(7)} score ${(score / N).toFixed(0).padStart(6)}  kills ${(kills / N).toFixed(1).padStart(5)}  planks- ${(planks / N).toFixed(1)}  bonks ${(bonk / N).toFixed(1)}  rescued ${(resc / N).toFixed(1)}  coins ${(coins / N).toFixed(0).padStart(3)}  won ${won}/${N} sunk ${lost}/${N}  t ${(time / N).toFixed(0)}s`);
      }
    }
    console.log('\n' + rows.join('\n'));
    expect(rows.length).toBe(78);
  });
});
