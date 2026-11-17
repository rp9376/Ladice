import { BIOMES, CREW_SLOTS, REPAIR_COST, REPAIR_COST_PER_SEA, TUNE, UPGRADES } from '../content';
import { Rng, hashString } from '../core/rng';
import { clamp } from '../core/math';
import {
  BIOME_ORDER, NO_ASSIST, NO_MUTATORS,
  type Assist, type BiomeId, type BossKind, type CrewId, type LegKind, type LegSpec, type LegState, type Mutators, type UpgradeId,
} from '../sim/types';

export type Mode = 'voyage' | 'endless' | 'daily' | 'classic';
export type NodeKind = 'patrol' | 'rescue' | 'convoy' | 'storm' | 'bounty' | 'beacons' | 'harbour' | 'boss';
export interface ChartNode { id: number; kind: NodeKind; col: number; row: number; done: boolean }

export const KARMA_HIGH = 3;
export const KARMA_LOW = -3;

export interface RunStats {
  kills: number; animalsHit: number; rescued: number; maxMult: number; nearMisses: number; assists: number;
  bosses: number; legs: number; planksLost: number; gentleLegs: number;
}

export interface RunState {
  mode: Mode;
  seed: number;
  dateKey: string;
  /** Biome index 0..4 (voyage/daily). */
  biome: number;
  /** Column of the chart the player chooses from next. */
  col: number;
  chart: ChartNode[][];
  doubloons: number;
  pearls: number;
  karma: number;
  planks: number;
  maxPlanks: number;
  upgrades: Record<UpgradeId, number>;
  crew: CrewId[];
  equipped: CrewId[];
  oil: number;
  score: number;
  stats: RunStats;
  mutators: Mutators;
  assist: Assist;
  /** Scores from runs with mutators are kept on a separate "lunar" board. */
  lunar: boolean;
  over: boolean;
  won: boolean;
  /** Endless depth / classic level counter. */
  depth: number;
  tutorial: boolean;
  /** Difficulty: 0 calm, 1 choppy, 2 stormy. */
  sea: 0 | 1 | 2;
  /** Lights won back from beaten captains. */
  lights: BossKind[];
  /** Letters in bottles found this voyage (biome indexes). */
  letters: number[];
  /** Story scenes already shown this voyage. */
  seen: string[];
  /** Snapshot of the voyage as it stood on arriving in the current sea (JSON), for restarting the chapter after sinking. */
  checkpoint: string | null;
  /** How many times a chapter has been restarted this voyage. */
  retries: number;
}

export interface LegOutcome {
  advanced: boolean;
  sunk: boolean;
  newCrew: CrewId[];
  biomeCleared: boolean;
  runOver: boolean;
  won: boolean;
  doubloons: number;
  pearls: number;
  karma: number;
  /** Biome index of a letter found this leg. */
  letter?: number;
  /** A stolen light won back from this captain. */
  light?: BossKind;
}

export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newRun(mode: Mode, opts: { seed?: number; mutators?: Mutators; assist?: Assist; marshmallow?: boolean; tutorial?: boolean; date?: string; sea?: 0 | 1 | 2 } = {}): RunState {
  const dk = opts.date ?? dateKey();
  const seed = mode === 'daily' ? hashString('lantern-tide/' + dk) : (opts.seed ?? (Math.floor(Math.random() * 4294967296) >>> 0));
  const mutators = { ...(opts.mutators ?? NO_MUTATORS) };
  const run: RunState = {
    mode, seed, dateKey: dk, biome: 0, col: 0, chart: [],
    doubloons: 0, pearls: 0, karma: 0,
    planks: TUNE.boat.planks, maxPlanks: TUNE.boat.planks, // adjusted for the sea state below
    upgrades: { hull: 0, ram: 0, engine: 0, boost: 0, lantern: 0, flare: 0 },
    crew: opts.marshmallow && mode !== 'classic' ? ['marshmallow'] : [],
    equipped: opts.marshmallow && mode !== 'classic' ? ['marshmallow'] : [],
    oil: 1, score: 0,
    stats: { kills: 0, animalsHit: 0, rescued: 0, maxMult: 1, nearMisses: 0, assists: 0, bosses: 0, legs: 0, planksLost: 0, gentleLegs: 0 },
    mutators, assist: { ...(opts.assist ?? NO_ASSIST) },
    lunar: Object.values(mutators).some(Boolean),
    over: false, won: false, depth: 0,
    tutorial: !!opts.tutorial && mode === 'voyage',
    sea: mode === 'classic' ? 0 : (opts.sea ?? 1), lights: [], letters: [], seen: [],
    checkpoint: null, retries: 0,
  };
  if (mode !== 'classic') { run.planks = TUNE.sea[run.sea].planks; run.maxPlanks = run.planks; }
  if (mode === 'voyage' || mode === 'daily') run.chart = generateChart(run);
  saveCheckpoint(run);
  return run;
}

/** Each biome is a short branching chart: opener → two forks → harbour → boss. */
export function generateChart(run: RunState): ChartNode[][] {
  const rng = new Rng(run.seed + run.biome * 7919 + 13);
  let id = run.biome * 100;
  const mk = (kind: NodeKind, col: number, row: number): ChartNode => ({ id: id++, kind, col, row, done: false });
  // Half the pool is on a clock, half is not: a voyage should never feel like one format repeated.
  const pool: NodeKind[] = ['patrol', 'rescue', 'convoy', 'bounty', 'beacons'];
  if (run.biome >= 1) pool.push('storm');
  const fork = (col: number, n: number): ChartNode[] => {
    const kinds = rng.shuffle([...pool]).slice(0, n);
    // A sea that fears you sends storms.
    if (run.karma <= KARMA_LOW && !kinds.includes('storm')) kinds[0] = 'storm';
    return kinds.map((k, row) => mk(k, col, row));
  };
  return [
    [mk('patrol', 0, 0)],
    fork(1, 2),
    fork(2, run.biome >= 2 ? 3 : 2),
    [mk('harbour', 3, 0)],
    [mk('boss', 4, 0)],
  ];
}

export function currentChoices(run: RunState): ChartNode[] {
  return run.chart[run.col] ?? [];
}

export function biomeOf(run: RunState): BiomeId {
  if (run.mode === 'endless') return BIOME_ORDER[Math.floor(run.depth / 3) % BIOME_ORDER.length];
  if (run.mode === 'classic') return (['ice', 'swamp', 'crystal'] as BiomeId[])[Math.min(2, run.depth)];
  return BIOME_ORDER[run.biome];
}

const DURATION: Record<string, number> = { patrol: 30, storm: 30, rescue: 45, convoy: 60, bounty: 0, beacons: 0, boss: 0, classic: 30, tutorial: 0 };

function loadout(run: RunState) {
  return { planks: run.planks, maxPlanks: run.maxPlanks, upgrades: { ...run.upgrades }, crew: [...run.equipped], oil: run.oil };
}

export function legSpec(run: RunState, node?: ChartNode): LegSpec {
  const base = { loadout: loadout(run), mutators: run.mutators, assist: run.assist, karma: run.karma, sea: run.sea, lights: [...run.lights], bottle: false };
  if (run.mode === 'classic') {
    return { ...base, kind: 'classic', biome: biomeOf(run), seed: run.seed + run.depth * 101, difficulty: 0, duration: 30, classicLevel: (run.depth + 1) as 1 | 2 | 3 };
  }
  if (run.tutorial) {
    return { ...base, kind: 'tutorial', biome: 'ice', seed: 1, difficulty: 0, duration: 0 };
  }
  if (run.mode === 'endless') {
    const rng = new Rng(run.seed + run.depth * 977);
    const kind: LegKind = run.depth % 3 === 1 ? rng.pick<LegKind>(['rescue', 'convoy', 'storm', 'bounty', 'beacons']) : 'patrol';
    return { ...base, kind, biome: biomeOf(run), seed: run.seed + run.depth * 977, difficulty: run.depth, duration: DURATION[kind] };
  }
  const kind = (node?.kind ?? 'patrol') as LegKind;
  return {
    ...base, kind, biome: biomeOf(run), seed: run.seed + (node?.id ?? 0) * 6151 + 7,
    // One letter per sea, findable on any leg after the opener until it has been picked up.
    bottle: kind !== 'boss' && run.col >= 1 && !run.letters.includes(run.biome),
    difficulty: run.biome * 2 + run.col * 0.5, duration: DURATION[kind],
  };
}

export function applyLeg(run: RunState, s: LegState, node?: ChartNode): LegOutcome {
  const t = s.tally;
  const out: LegOutcome = { advanced: false, sunk: false, newCrew: [], biomeCleared: false, runOver: false, won: false, doubloons: t.doubloons, pearls: t.pearls, karma: t.karma };

  if (run.tutorial) {
    // The tutorial never counts for or against the voyage.
    if (s.status === 'won') run.tutorial = false;
    out.advanced = s.status === 'won';
    out.doubloons = 0; out.pearls = 0; out.karma = 0;
    return out;
  }

  run.score += s.score;
  run.stats.kills += t.kills; run.stats.animalsHit += t.animalsHit; run.stats.rescued += t.rescued;
  run.stats.maxMult = Math.max(run.stats.maxMult, t.maxMult);
  run.stats.nearMisses += t.nearMisses; run.stats.assists += t.assists; run.stats.planksLost += t.planksLost;

  // The original bug let you sail on after sinking. Not here.
  if (s.status === 'lost') {
    run.over = true; run.planks = 0;
    out.sunk = true; out.runOver = true;
    return out;
  }

  run.stats.legs++;
  if (t.gentleBonus > 0) run.stats.gentleLegs++;
  run.doubloons += t.doubloons;
  run.pearls += t.pearls;
  run.karma = clamp(run.karma + t.karma, -9, 9);
  const perLegBonus = (run.equipped.includes('turtle') ? 1 : 0) + run.assist.extraPlanks;
  run.planks = clamp(s.player.planks - perLegBonus, 1, run.maxPlanks);
  out.advanced = true;

  if (run.mode === 'classic') {
    run.depth++;
    if (run.depth >= 3) { run.won = true; run.over = true; out.won = true; out.runOver = true; }
    return out;
  }

  // Rescued animals may sign on, if the sea trusts you.
  if (run.karma >= 0) {
    for (const type of t.rescuedTypes) {
      if (type === 'marshmallow') continue;
      const id = type as CrewId;
      if (!run.crew.includes(id) && out.newCrew.length === 0) {
        run.crew.push(id);
        out.newCrew.push(id);
        if (run.equipped.length < CREW_SLOTS) run.equipped.push(id);
      }
    }
  }

  if (run.mode === 'endless') {
    run.depth++;
    // The lantern never fully refuels on the Night Watch.
    run.oil = Math.min(0.65, s.player.oil + 0.3);
    return out;
  }

  if (t.bottle && !run.letters.includes(run.biome)) { run.letters.push(run.biome); out.letter = run.biome; }
  if (node) node.done = true;
  run.col++;
  if (s.spec.kind === 'boss') {
    run.stats.bosses++;
    const captain = BIOMES[BIOME_ORDER[run.biome]].boss;
    if (!run.lights.includes(captain)) { run.lights.push(captain); out.light = captain; }
    // The reef's light mends the hull for good.
    if (captain === 'netmaker') { run.maxPlanks++; run.planks++; }
    out.biomeCleared = true;
    run.planks = Math.min(run.maxPlanks, run.planks + TUNE.sea[run.sea].bossRepair);
    if (run.biome >= BIOME_ORDER.length - 1) {
      run.won = true; run.over = true; out.won = true; out.runOver = true;
    } else {
      run.biome++; run.col = 0;
      run.chart = generateChart(run);
      saveCheckpoint(run);
    }
  }
  return out;
}

/** Remember the voyage as it stands on arriving in a sea. Only full voyages have chapters to restart. */
export function saveCheckpoint(run: RunState) {
  if (run.mode !== 'voyage') return;
  run.checkpoint = JSON.stringify({ ...run, checkpoint: null });
}

export function canRetry(run: RunState): boolean { return run.mode === 'voyage' && !!run.checkpoint && run.over && !run.won; }

/**
 * After sinking: the voyage as it was on arriving in the current sea (hull, loot, crew, score, an untouched chart).
 * Story scenes already seen stay seen, and the restart is counted.
 */
export function restoreCheckpoint(run: RunState): RunState | null {
  if (!run.checkpoint) return null;
  const snap = JSON.parse(run.checkpoint) as RunState;
  snap.checkpoint = run.checkpoint;
  snap.retries = run.retries + 1;
  snap.seen = Array.from(new Set([...snap.seen, ...run.seen]));
  snap.over = false; snap.won = false;
  return snap;
}

export function leaveHarbour(run: RunState) {
  const node = currentChoices(run)[0];
  if (node && node.kind === 'harbour') { node.done = true; run.col++; }
}

function discount(run: RunState): number { return run.karma >= KARMA_HIGH ? 0.8 : 1; }

export function upgradeCost(run: RunState, id: UpgradeId): number | null {
  const def = UPGRADES[id];
  const lvl = run.upgrades[id];
  if (lvl >= def.costs.length) return null;
  const c = def.costs[lvl];
  return def.currency === 'doubloons' ? Math.ceil(c * discount(run)) : c;
}

export function canBuy(run: RunState, id: UpgradeId): boolean {
  const cost = upgradeCost(run, id);
  if (cost === null) return false;
  return (UPGRADES[id].currency === 'doubloons' ? run.doubloons : run.pearls) >= cost;
}

export function buyUpgrade(run: RunState, id: UpgradeId): boolean {
  if (!canBuy(run, id)) return false;
  const cost = upgradeCost(run, id)!;
  if (UPGRADES[id].currency === 'doubloons') run.doubloons -= cost; else run.pearls -= cost;
  run.upgrades[id]++;
  if (id === 'hull') { run.maxPlanks++; run.planks++; }
  return true;
}

/** Shipwrights charge more the further from home you are. */
export function repairCost(run: RunState): number { return Math.ceil((REPAIR_COST + run.biome * REPAIR_COST_PER_SEA) * discount(run)); }

export function repair(run: RunState): boolean {
  if (run.planks >= run.maxPlanks || run.doubloons < repairCost(run)) return false;
  run.doubloons -= repairCost(run);
  run.planks++;
  return true;
}

export function toggleCrew(run: RunState, id: CrewId): boolean {
  if (!run.crew.includes(id)) return false;
  const i = run.equipped.indexOf(id);
  if (i >= 0) { run.equipped.splice(i, 1); return true; }
  if (run.equipped.length >= CREW_SLOTS) return false;
  run.equipped.push(id);
  return true;
}
