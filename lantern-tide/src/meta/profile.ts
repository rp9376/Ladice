import { NO_ASSIST, NO_MUTATORS, type AnimalType, type Assist, type BossKind, type Mutators, type PirateType } from '../sim/types';
import type { Mode, RunState } from './run';

export type Action = 'up' | 'down' | 'left' | 'right' | 'boost' | 'brake' | 'flare' | 'pause';
export const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'boost', 'brake', 'flare', 'pause'];
export const DEFAULT_KEYS: Record<Action, string> = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', boost: 'Space', brake: 'ShiftLeft', flare: 'KeyF', pause: 'Escape',
};

export interface Settings {
  music: number;
  sfx: number;
  shake: boolean;
  flashes: boolean;
  subtitles: boolean;
  lang: 'en' | 'sl';
  boostToggle: boolean;
  retro: boolean;
  keys: Record<Action, string>;
  assist: Assist;
  /** Difficulty for new runs: 0 calm, 1 choppy, 2 stormy. */
  sea: 0 | 1 | 2;
}

/** Everything the player has discovered, kept across voyages. */
export interface Logbook {
  letters: number[];
  captains: BossKind[];
  pirates: Partial<Record<PirateType, number>>;
  rescued: Partial<Record<AnimalType, number>>;
}

export interface ScoreEntry { name: string; score: number; date: string; lunar: boolean; assist: boolean; note: string }

export const ACHIEVEMENTS = [
  'monster', 'moonstruck', 'oldsalt', 'marshmallow', 'combo5', 'assist', 'fullcrew', 'gentle',
  'closeshave', 'lightsout', 'nightwatch', 'daily', 'boss1', 'karma', 'penpal', 'stormy',
] as const;
export type AchievementId = (typeof ACHIEVEMENTS)[number];

export interface Profile {
  version: 1;
  settings: Settings;
  scores: Record<Mode, ScoreEntry[]>;
  achievements: Partial<Record<AchievementId, string>>;
  tutorialDone: boolean;
  /** Whether the one-time explanation of hull planks has been shown. */
  hullHintShown: boolean;
  lunarFound: boolean;
  mutators: Mutators;
  wins: number;
  marshmallow: boolean;
  dailyBest: Record<string, number>;
  lastName: string;
  run: RunState | null;
  log: Logbook;
}

const KEY = 'lantern-tide/profile/v1';

export function defaultProfile(): Profile {
  const lang = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('sl') ? 'sl' : 'en';
  return {
    version: 1,
    settings: { music: 0.6, sfx: 0.8, shake: true, flashes: true, subtitles: true, lang, boostToggle: false, retro: false, keys: { ...DEFAULT_KEYS }, assist: { ...NO_ASSIST }, sea: 1 },
    scores: { voyage: [], endless: [], daily: [], classic: [] },
    achievements: {}, tutorialDone: false, hullHintShown: false, lunarFound: false, mutators: { ...NO_MUTATORS }, wins: 0, marshmallow: false,
    dailyBest: {}, lastName: '', run: null,
    log: { letters: [], captains: [], pirates: {}, rescued: {} },
  };
}

let memory: string | null = null;

export function loadProfile(): Profile {
  const d = defaultProfile();
  try {
    const raw = (typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null) ?? memory;
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      ...d, ...p,
      settings: { ...d.settings, ...p.settings, keys: { ...d.settings.keys, ...p.settings?.keys }, assist: { ...d.settings.assist, ...p.settings?.assist } },
      scores: { ...d.scores, ...p.scores },
      mutators: { ...d.mutators, ...p.mutators },
      log: { ...d.log, ...p.log },
      // Saved voyages from before the story update lack these fields.
      run: p.run ? { ...p.run, sea: p.run.sea ?? 1, lights: p.run.lights ?? [], letters: p.run.letters ?? [], seen: p.run.seen ?? ['intro'], checkpoint: p.run.checkpoint ?? null, retries: p.run.retries ?? 0 } : null,
    };
  } catch {
    return d;
  }
}

export function saveProfile(p: Profile) {
  const raw = JSON.stringify(p);
  memory = raw;
  try { localStorage.setItem(KEY, raw); } catch { /* private mode: keep in memory */ }
}

export function addScore(p: Profile, mode: Mode, entry: ScoreEntry): number {
  const list = p.scores[mode];
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  // Keep ten clean and ten lunar entries.
  const clean = list.filter((e) => !e.lunar).slice(0, 10);
  const lunar = list.filter((e) => e.lunar).slice(0, 10);
  p.scores[mode] = [...clean, ...lunar].sort((a, b) => b.score - a.score);
  return p.scores[mode].indexOf(entry);
}

export function qualifies(p: Profile, mode: Mode, score: number, lunar: boolean): boolean {
  const list = p.scores[mode].filter((e) => e.lunar === lunar);
  return list.length < 10 || score > list[list.length - 1].score;
}

export function unlock(p: Profile, id: AchievementId): boolean {
  if (p.achievements[id]) return false;
  p.achievements[id] = new Date().toISOString();
  return true;
}
