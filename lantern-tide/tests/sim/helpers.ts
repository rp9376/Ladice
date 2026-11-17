import { createLeg } from '../../src/sim/gen';
import { FIXED_DT, step } from '../../src/sim/leg';
import { botInput } from '../../src/sim/bot';
import { NO_ASSIST, NO_MUTATORS, type BiomeId, type Input, type LegKind, type LegSpec, type LegState, type SimEvent } from '../../src/sim/types';

export function spec(over: Partial<LegSpec> = {}): LegSpec {
  return {
    kind: 'patrol' as LegKind, biome: 'ice' as BiomeId, seed: 1234, difficulty: 0, duration: 30,
    loadout: { planks: 3, maxPlanks: 3, upgrades: { hull: 0, ram: 0, engine: 0, boost: 0, lantern: 0, flare: 0 }, crew: [], oil: 1 },
    mutators: { ...NO_MUTATORS }, assist: { ...NO_ASSIST }, karma: 0, sea: 0, lights: [], bottle: false,
    ...over,
  };
}

/** An empty arena with only the player: handy for staging exact collisions. */
export function emptyLeg(over: Partial<LegSpec> = {}): LegState {
  const s = createLeg(spec(over));
  s.pirates = []; s.animals = []; s.hazards = []; s.pickups = []; s.zones = [];
  s.targetPirates = 0;
  s.status = 'running';
  s.player.x = 500; s.player.y = 500; s.player.angle = 0;
  return s;
}

export function run(s: LegState, seconds: number, input: Input | ((s: LegState) => Input)): SimEvent[] {
  const events: SimEvent[] = [];
  const n = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < n; i++) {
    step(s, typeof input === 'function' ? input(s) : input, FIXED_DT);
    events.push(...s.events);
    s.events = [];
  }
  return events;
}

export function playBot(sp: LegSpec, maxSeconds = 120, skill = 1): { s: LegState; events: SimEvent[] } {
  const s = createLeg(sp);
  const events: SimEvent[] = [];
  const n = Math.round(maxSeconds / FIXED_DT);
  for (let i = 0; i < n && (s.status === 'ready' || s.status === 'running'); i++) {
    step(s, botInput(s, skill), FIXED_DT);
    events.push(...s.events);
    s.events = [];
  }
  return { s, events };
}

export const EAST: Input = { sx: 1, sy: 0, boost: false, brake: false, flare: false };
