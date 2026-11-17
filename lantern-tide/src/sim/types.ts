import type { Rng } from '../core/rng';

export type BiomeId = 'ice' | 'swamp' | 'crystal' | 'reef' | 'deep';
export type LegKind = 'patrol' | 'rescue' | 'convoy' | 'storm' | 'bounty' | 'beacons' | 'boss' | 'tutorial' | 'classic';
export type PirateType = 'dinghy' | 'sloop' | 'netter' | 'douser' | 'brigantine' | 'ghost';
export type AnimalType = 'pingo' | 'zabica' | 'ribica' | 'turtle' | 'marshmallow';
export type HazardType = 'iceberg' | 'floe' | 'lilypad' | 'root' | 'crystal' | 'reef' | 'whirlpool' | 'wreck';
export type CrewId = 'pingo' | 'zabica' | 'ribica' | 'turtle' | 'marshmallow';
export type BossKind = 'frostbeard' | 'bogqueen' | 'ember' | 'netmaker' | 'galleon';
export type UpgradeId = 'hull' | 'ram' | 'engine' | 'boost' | 'lantern' | 'flare';

export const BIOME_ORDER: BiomeId[] = ['ice', 'swamp', 'crystal', 'reef', 'deep'];

export interface Mutators {
  invincible: boolean;
  seeAll: boolean;
  tinyBoat: boolean;
  bigHeads: boolean;
  disco: boolean;
  slowMo: boolean;
  mirror: boolean;
}
export const NO_MUTATORS: Mutators = { invincible: false, seeAll: false, tinyBoat: false, bigHeads: false, disco: false, slowMo: false, mirror: false };

export interface Assist {
  /** Extra hull planks granted at the start of each leg. */
  extraPlanks: number;
  /** Lantern radius multiplier. */
  lantern: number;
  /** Game speed multiplier (handled by the loop, recorded here for scores). */
  speed: number;
}
export const NO_ASSIST: Assist = { extraPlanks: 0, lantern: 1, speed: 1 };

export interface Loadout {
  planks: number;
  maxPlanks: number;
  upgrades: Record<UpgradeId, number>;
  crew: CrewId[];
  /** Starting lantern oil 0..1. */
  oil: number;
}

export interface LegSpec {
  kind: LegKind;
  biome: BiomeId;
  seed: number;
  /** 0 = first legs of a voyage; grows with depth. */
  difficulty: number;
  duration: number;
  classicLevel?: 1 | 2 | 3;
  loadout: Loadout;
  mutators: Mutators;
  assist: Assist;
  /** Voyage karma at leg start; shifts how the sea behaves. */
  karma: number;
  /** Difficulty: 0 calm, 1 choppy (default), 2 stormy. */
  sea: 0 | 1 | 2;
  /** Stolen lights won back from captains this voyage; each is a small permanent blessing. */
  lights: BossKind[];
  /** Whether a message in a bottle can be found on this leg. */
  bottle: boolean;
}

export interface Input {
  /** Steering vector, magnitude 0..1. */
  sx: number;
  sy: number;
  boost: boolean;
  brake: boolean;
  flare: boolean;
}
export const NO_INPUT: Input = { sx: 0, sy: 0, boost: false, brake: false, flare: false };

export interface Body { x: number; y: number; vx: number; vy: number; r: number }

export interface Player extends Body {
  angle: number;
  boostT: number;
  boostCd: number;
  planks: number;
  maxPlanks: number;
  invuln: number;
  oil: number;
  flareCd: number;
  flareT: number;
  onPad: boolean;
  snare: number;
  towed: number[];
  /** Pingo perk: first hazard hit this leg is free. */
  freeHit: boolean;
  /** Žabica perk: hop out of one pirate attack. */
  hopReady: boolean;
  /** Marshmallow perk: first flare is a map-wide bark. */
  barkReady: boolean;
  sonarT: number;
  /** Seconds remaining of sonar reveal. */
  sonarPulse: number;
}

export type PirateState = 'spawning' | 'patrol' | 'notice' | 'flee' | 'attack' | 'hunt' | 'windup' | 'charge' | 'recover' | 'sinking';
export interface Pirate extends Body {
  id: number;
  type: PirateType;
  angle: number;
  hp: number;
  state: PirateState;
  t: number;
  wx: number;
  wy: number;
  lantern: boolean;
  fireCd: number;
  stun: number;
  hitCd: number;
  beamCd: number;
  netted: number[];
  /** Random per-pirate phase used for zig-zags and bobbing. */
  phase: number;
  /** Seconds the pirate has been revealed by moonlight/flare (ghosts). */
  dirX: number;
  dirY: number;
  minion: boolean;
}

export type AnimalState = 'wander' | 'flee' | 'curious' | 'sit' | 'hop' | 'netted' | 'freed' | 'towed' | 'safe' | 'dazed' | 'convoy';
export interface Animal extends Body {
  id: number;
  type: AnimalType;
  angle: number;
  state: AnimalState;
  t: number;
  wx: number;
  wy: number;
  captor: number;
  /** Lily pad route for frogs (hazard ids) and index into it. */
  route: number[];
  routeI: number;
  hopX: number;
  hopY: number;
  /** Convoy progress along the path. */
  pathI: number;
  phase: number;
}

export interface Hazard extends Body {
  id: number;
  type: HazardType;
  rot: number;
  variant: number;
  solid: boolean;
  hurts: boolean;
  pushable: boolean;
  /** Reefs: false while under water. */
  exposed: boolean;
  nearState: number;
  nearCd: number;
  calveT: number;
  /** Floes: set once the player has shoved it, cleared when it slows down. */
  shoved: boolean;
}

export type PickupType = 'barrel' | 'firefly' | 'plank' | 'bottle';
export interface Pickup { id: number; type: PickupType; x: number; y: number; vx: number; vy: number; t: number; phase: number }

export interface Shot {
  id: number;
  x0: number; y0: number;
  tx: number; ty: number;
  t: number; dur: number;
  r: number;
  kind: 'ball' | 'net' | 'keg';
}

export interface Zone { x: number; y: number; r: number }
export interface Beam { x1: number; y1: number; x2: number; y2: number; hazard: number }
export interface MoonPatch { x: number; y: number; r: number }
export interface Marker { x: number; y: number; r: number }
/** A harbour light to relight. `douse` counts up while a Lantern-Douser sits on it. */
export interface Beacon { x: number; y: number; lit: boolean; douse: number; /** 0..1 while the player holds station to light it. */ charge: number }

export interface Boss extends Body {
  kind: BossKind;
  hp: number;
  maxHp: number;
  angle: number;
  state: string;
  t: number;
  phase: number;
  stun: number;
  shield: boolean;
  hidden: boolean;
  hitCd: number;
  dirX: number;
  dirY: number;
  fireCd: number;
  spawnCd: number;
  /** Netmaker: accumulated circling angle. */
  circle: number;
  lastAng: number;
  shotsLeft: number;
  dying: number;
  orbit: number;
}

export interface Env {
  /** Darkness 0..1 for the renderer. */
  dark: number;
  /** >0 while lightning or a flare reveals everything. */
  flash: number;
  aurora: number;
  auroraT: number;
  lightningT: number;
  /** Reef tide phase 0..1; reefs exposed when tideUp is false. */
  tide: number;
  reefExposed: boolean;
  /** Seconds until the reefs change state (for telegraphing). */
  tideSwitchIn: number;
  windX: number;
  windY: number;
  storm: boolean;
}

export type SimEvent =
  | { type: 'castOff' }
  | { type: 'boost'; x: number; y: number }
  | { type: 'ram'; x: number; y: number; kill: boolean; score: number; mult: number; pirate: PirateType; heavy: boolean }
  | { type: 'clang'; x: number; y: number }
  | { type: 'bump'; x: number; y: number }
  | { type: 'bonk'; x: number; y: number; animal: AnimalType }
  | { type: 'monster' }
  | { type: 'hazardHit'; x: number; y: number; hazard: HazardType; free: boolean }
  | { type: 'playerHit'; x: number; y: number; by: 'shot' | 'pirate' | 'boss' | 'whirlpool' }
  | { type: 'hop'; x: number; y: number }
  | { type: 'nearMiss'; x: number; y: number; score: number }
  | { type: 'pickup'; x: number; y: number; pickup: PickupType }
  | { type: 'spawn'; x: number; y: number }
  | { type: 'notice'; x: number; y: number; pirate: PirateType }
  | { type: 'creak'; x: number; y: number }
  | { type: 'cannonFire'; x: number; y: number }
  | { type: 'cannonLand'; x: number; y: number; r: number; kind: 'ball' | 'net' | 'keg' }
  | { type: 'kegDrop'; x: number; y: number }
  | { type: 'beaconLit'; x: number; y: number; score: number }
  | { type: 'beaconOut'; x: number; y: number }
  | { type: 'flare'; x: number; y: number; bark: boolean }
  | { type: 'sonar'; x: number; y: number }
  | { type: 'netCatch'; x: number; y: number; animal: AnimalType }
  | { type: 'freed'; x: number; y: number; animal: AnimalType }
  | { type: 'towStart'; x: number; y: number; animal: AnimalType }
  | { type: 'delivered'; x: number; y: number; animal: AnimalType; score: number }
  | { type: 'frogHop'; x: number; y: number }
  | { type: 'assist'; x: number; y: number; score: number; by?: 'keg' }
  | { type: 'floeShove'; x: number; y: number }
  | { type: 'calve'; x: number; y: number }
  | { type: 'beamStun'; x: number; y: number }
  | { type: 'lightning' }
  | { type: 'aurora' }
  | { type: 'tide'; exposed: boolean }
  | { type: 'comboUp'; mult: number }
  | { type: 'comboLost' }
  | { type: 'timeBonus'; seconds: number }
  | { type: 'bossHit'; x: number; y: number; hp: number }
  | { type: 'bossStun'; x: number; y: number }
  | { type: 'bossPhase'; phase: number }
  | { type: 'bossSurface'; x: number; y: number }
  | { type: 'bossTelegraph'; x: number; y: number }
  | { type: 'shieldBreak'; x: number; y: number }
  | { type: 'netCut'; x: number; y: number }
  | { type: 'bossDead'; x: number; y: number }
  | { type: 'sink'; x: number; y: number }
  | { type: 'tutorialStep'; step: number }
  | { type: 'end'; status: LegStatus };

export type LegStatus = 'ready' | 'running' | 'won' | 'lost' | 'timeout';

export interface Tally {
  kills: number;
  rams: number;
  killsByType: Partial<Record<PirateType, number>>;
  animalsHit: number;
  rescued: number;
  rescuedTypes: AnimalType[];
  nearMisses: number;
  assists: number;
  maxMult: number;
  planksLost: number;
  doubloons: number;
  pearls: number;
  karma: number;
  gentleBonus: number;
  timeBonus: number;
  lostAnimals: number;
  bottle: boolean;
}

export interface Tutorial { step: number; t: number; boosted: boolean }

export interface LegState {
  spec: LegSpec;
  w: number;
  h: number;
  time: number;
  timeLeft: number;
  timed: boolean;
  status: LegStatus;
  endT: number;
  player: Player;
  pirates: Pirate[];
  animals: Animal[];
  hazards: Hazard[];
  pickups: Pickup[];
  shots: Shot[];
  zones: Zone[];
  beams: Beam[];
  moonPatches: MoonPatch[];
  beacons: Beacon[];
  markers: Marker[];
  boss: Boss | null;
  env: Env;
  score: number;
  combo: number;
  comboT: number;
  mult: number;
  baseScore: number;
  targetPirates: number;
  spawnQueue: number[];
  timeBonusGiven: number;
  goal: number;
  tally: Tally;
  tutorial: Tutorial | null;
  convoyPath: { x: number; y: number }[];
  events: SimEvent[];
  nextId: number;
  /** Runtime randomness (AI decisions, drops). Seeded from the leg seed. */
  rng: Rng;
}
