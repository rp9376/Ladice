import tuningJson from './tuning.json';
import piratesJson from './pirates.json';
import biomesJson from './biomes.json';
import upgradesJson from './upgrades.json';
import type { AnimalType, BiomeId, BossKind, CrewId, HazardType, PirateType, UpgradeId } from '../sim/types';

export const TUNE = tuningJson;

export interface PirateDef {
  radius: number; hp: number; speed: number; fastSpeed: number; notice: number;
  scoreMult: number; coins: number; fireCooldown?: number; orbit?: number; armorArc?: number;
}
export const PIRATES = piratesJson as Record<PirateType, PirateDef>;

export interface BiomeDef {
  baseScore: number;
  animal: AnimalType | 'mixed';
  animals: number;
  pirates: number;
  pirateMix: Partial<Record<PirateType, number>>;
  hazards: Partial<Record<HazardType, number>>;
  boss: BossKind;
  dark: number;
  lanternFactor: number;
  water: [string, string, string];
  accent: string;
}
export const BIOMES = biomesJson as unknown as Record<BiomeId, BiomeDef>;

export interface UpgradeDef { currency: 'doubloons' | 'pearls'; costs: number[] }
export const UPGRADES = upgradesJson.upgrades as Record<UpgradeId, UpgradeDef>;
export const REPAIR_COST = upgradesJson.repairCost;
export const REPAIR_COST_PER_SEA = upgradesJson.repairCostPerSea;
export const CREW_SLOTS = upgradesJson.crewSlots;
export const UPGRADE_IDS: UpgradeId[] = ['hull', 'ram', 'engine', 'boost', 'lantern', 'flare'];
export const CREW_IDS: CrewId[] = ['pingo', 'zabica', 'ribica', 'turtle', 'marshmallow'];

/** Which pirate types have been introduced by a given biome index (plan §3.4). */
export const PIRATE_INTRO: Record<PirateType, number> = { dinghy: 0, sloop: 0, netter: 1, douser: 1, brigantine: 2, ghost: 4 };
