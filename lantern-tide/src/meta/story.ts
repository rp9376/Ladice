import type { BiomeId, BossKind } from '../sim/types';
import { KARMA_HIGH, KARMA_LOW, type RunState } from './run';

/** Who is speaking. `narrator` has no portrait. Portrait art keys are resolved in the UI. */
export type Speaker = 'narrator' | 'moon' | 'jaka' | 'marshmallow' | BossKind;
export interface Line { who: Speaker; key: string }

const L = (who: Speaker, key: string): Line => ({ who, key });

const BIOME_INTRO: Record<BiomeId, Line[]> = {
  ice: [L('moon', 'story.ice.1'), L('moon', 'story.ice.2')],
  swamp: [L('moon', 'story.swamp.1'), L('moon', 'story.swamp.2')],
  crystal: [L('moon', 'story.crystal.1'), L('moon', 'story.crystal.2')],
  reef: [L('moon', 'story.reef.1'), L('moon', 'story.reef.2')],
  deep: [L('moon', 'story.deep.1'), L('moon', 'story.deep.2')],
};

const INTRO: Line[] = [
  L('narrator', 'story.intro.1'), L('narrator', 'story.intro.2'), L('jaka', 'story.intro.3'),
  L('jaka', 'story.intro.4'), L('moon', 'story.intro.5'), L('moon', 'story.intro.6'),
];

const BOSS_PRE: Record<BossKind, Line[]> = {
  frostbeard: [L('frostbeard', 'story.frostbeard.pre.1'), L('moon', 'story.frostbeard.pre.2')],
  bogqueen: [L('bogqueen', 'story.bogqueen.pre.1'), L('moon', 'story.bogqueen.pre.2')],
  ember: [L('ember', 'story.ember.pre.1'), L('moon', 'story.ember.pre.2')],
  netmaker: [L('netmaker', 'story.netmaker.pre.1'), L('moon', 'story.netmaker.pre.2')],
  galleon: [L('galleon', 'story.galleon.pre.1'), L('marshmallow', 'story.galleon.pre.2'), L('moon', 'story.galleon.pre.3')],
};

const BOSS_POST: Record<BossKind, Line[]> = {
  frostbeard: [L('frostbeard', 'story.frostbeard.post.1'), L('narrator', 'story.frostbeard.post.2'), L('frostbeard', 'story.frostbeard.post.3')],
  bogqueen: [L('bogqueen', 'story.bogqueen.post.1'), L('narrator', 'story.bogqueen.post.2'), L('bogqueen', 'story.bogqueen.post.3')],
  ember: [L('ember', 'story.ember.post.1'), L('narrator', 'story.ember.post.2'), L('ember', 'story.ember.post.3')],
  netmaker: [L('netmaker', 'story.netmaker.post.1'), L('narrator', 'story.netmaker.post.2'), L('netmaker', 'story.netmaker.post.3')],
  galleon: [L('galleon', 'story.galleon.post.1'), L('narrator', 'story.galleon.post.2'), L('marshmallow', 'story.galleon.post.3'), L('narrator', 'story.galleon.post.4')],
};

/**
 * Returns the scene to play (and marks it seen on the run), or null if it has been shown already.
 * Only full voyages tell the story; the daily and endless modes stay brisk.
 */
function once(run: RunState, id: string, lines: Line[]): Line[] | null {
  if (run.mode !== 'voyage' || run.seen.includes(id)) return null;
  run.seen.push(id);
  return lines;
}

export function arrivalScene(run: RunState, biome: BiomeId): Line[] | null {
  const lines: Line[] = [];
  const intro = once(run, 'intro', INTRO);
  if (intro) lines.push(...intro);
  const arrive = once(run, 'biome.' + biome, BIOME_INTRO[biome]);
  if (arrive) {
    lines.push(...arrive);
    // The Moon has opinions about how you treat the animals.
    if (!intro && run.karma <= KARMA_LOW) lines.push(L('moon', 'story.karmaLow'));
    if (!intro && run.karma >= KARMA_HIGH) lines.push(L('moon', 'story.karmaHigh'));
  }
  return lines.length ? lines : null;
}

export function bossIntroScene(run: RunState, boss: BossKind): Line[] | null { return once(run, 'pre.' + boss, BOSS_PRE[boss]); }
export function bossOutroScene(run: RunState, boss: BossKind): Line[] | null { return once(run, 'post.' + boss, BOSS_POST[boss]); }
