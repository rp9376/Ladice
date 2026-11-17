import { en, type StringKey } from '../locales/en';
import { sl } from '../locales/sl';

export type Lang = 'en' | 'sl';
const TABLES: Record<Lang, Partial<Record<StringKey, string>>> = { en, sl };
let lang: Lang = 'en';

export function setLang(l: Lang) { lang = l; document.documentElement.lang = l; }
export function getLang(): Lang { return lang; }

/** Translate a key, filling {placeholders}. Falls back to English, then to the key itself. */
export function t(key: StringKey | string, params?: Record<string, string | number>): string {
  let s = (TABLES[lang] as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
  if (params) for (const k of Object.keys(params)) s = s.replace(`{${k}}`, String(params[k]));
  return s;
}
