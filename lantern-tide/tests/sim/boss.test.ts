import { describe, expect, it } from 'vitest';
import { BIOME_ORDER } from '../../src/sim/types';
import { bossVulnerable } from '../../src/sim/boss';
import { makeBoss } from '../../src/sim/gen';
import { playBot, spec } from './helpers';

describe('bosses', () => {
  it('each boss can be beaten by the autopilot using its intended weakness', () => {
    for (const biome of BIOME_ORDER) {
      let wins = 0;
      const N = 6;
      for (let seed = 1; seed <= N; seed++) {
        const base = spec();
        const { s } = playBot(spec({ biome, kind: 'boss', seed: seed * 31, loadout: { ...base.loadout, planks: 5, maxPlanks: 5 } }), 240);
        if (s.status === 'won') wins++;
      }
      console.log(`${biome} boss: autopilot wins ${wins}/${N}`);
      expect(wins, `${biome} boss`).toBeGreaterThan(0);
    }
  });

  it('weak points are where the design says', () => {
    const f = makeBoss('frostbeard', 0, 0);
    f.state = 'cruise'; f.angle = 0; // sailing east
    expect(bossVulnerable(f, 1, 0)).toBe(false); // player ahead of the bow
    expect(bossVulnerable(f, -1, 0)).toBe(true); // player astern
    f.state = 'stunned';
    expect(bossVulnerable(f, 1, 0)).toBe(true);
    const e = makeBoss('ember', 0, 0);
    expect(bossVulnerable(e, 1, 0)).toBe(false);
    e.shield = false;
    expect(bossVulnerable(e, 1, 0)).toBe(true);
  });
});
