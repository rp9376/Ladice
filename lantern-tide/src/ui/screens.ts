import { CREW_SLOTS, UPGRADES, UPGRADE_IDS } from '../content';
import { t, type Lang } from '../core/i18n';
import type { InputManager } from '../core/input';
import { ACHIEVEMENTS, ACTIONS, DEFAULT_KEYS, type Profile } from '../meta/profile';
import {
  KARMA_HIGH, KARMA_LOW, biomeOf, buyUpgrade, canBuy, currentChoices, repair, repairCost, toggleCrew, upgradeCost,
  type ChartNode, type LegOutcome, type Mode, type RunState,
} from '../meta/run';
import { BIOMES } from '../content';
import { ICONS, artUrl } from '../render/art';
import type { Line, Speaker } from '../meta/story';
import { BIOME_ORDER, type AnimalType, type BossKind, type LegState, type Mutators, type PirateType } from '../sim/types';
import { fmt, h, icon } from './dom';

export interface AppApi {
  profile: Profile;
  run: RunState | null;
  input: InputManager;
  sfx(name: string): void;
  save(): void;
  applySettings(): void;
  showTitle(): void;
  startRun(mode: Mode): void;
  continueVoyage(): void;
  startTutorial(): void;
  chooseNode(node: ChartNode): void;
  leaveHarbour(): void;
  open(screen: 'scores' | 'achievements' | 'settings' | 'museum' | 'credits' | 'lunar' | 'logbook', back?: () => void): void;
  refresh(): void;
  resume(): void;
  quitLeg(): void;
  wipe(): void;
}

const GEAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="#f1e9d2" stroke="#161a33" stroke-width="1.2" stroke-linejoin="round">${[0, 45, 90, 135].map((a) => `<rect x="10" y="1.5" width="4" height="21" rx="1.2" transform="rotate(${a} 12 12)"/>`).join('')}<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="#16214d"/></g></svg>`;

function btn(app: AppApi, label: string, onclick: () => void, cls = '', extra: Record<string, unknown> = {}): HTMLButtonElement {
  return h('button', { class: 'btn ' + cls, onclick: () => { app.sfx('click'); onclick(); }, onmouseenter: () => app.sfx('hover'), ...extra }, label);
}

/** A button that asks "sure?" on the first press instead of opening a system dialog. */
function confirmBtn(app: AppApi, label: string, sure: string, action: () => void, cls = 'ghost small'): HTMLButtonElement {
  let armed = false;
  const b = btn(app, label, () => {
    if (armed) { action(); return; }
    armed = true; b.textContent = sure; b.classList.add('danger'); b.classList.remove('ghost');
    setTimeout(() => { armed = false; b.textContent = label; b.classList.remove('danger'); b.classList.add('ghost'); }, 3000);
  }, cls);
  return b;
}

function seg<T extends string | number>(app: AppApi, options: [T, string][], current: T, onPick: (v: T) => void): HTMLElement {
  return h('div', { class: 'seg' }, options.map(([v, label]) => h('button', { class: v === current ? 'on' : '', text: label, onclick: () => { app.sfx('click'); onPick(v); } })));
}

function planks(n: number, max: number): HTMLElement {
  return h('span', { class: 'planks' }, Array.from({ length: max }, (_, i) => icon(i < n ? ICONS.plank : ICONS.plankEmpty)));
}

function statusBar(run: RunState): HTMLElement {
  return h('div', { class: 'statusbar' },
    h('span', { class: 'chip' }, planks(run.planks, run.maxPlanks)),
    h('span', { class: 'chip' }, icon(ICONS.doubloon), fmt(run.doubloons)),
    h('span', { class: 'chip' }, icon(ICONS.pearl), fmt(run.pearls)),
    h('span', { class: 'chip', title: 'Karma' }, icon(ICONS.heart), (run.karma > 0 ? '+' : '') + run.karma),
    run.equipped.length ? h('span', { class: 'chip crew-mini' }, run.equipped.map((c) => h('img', { class: 'portrait', src: artUrl(c), alt: t('animal.' + c), title: t('crew.' + c) }))) : null,
    run.lights.length ? h('span', { class: 'chip', title: run.lights.map((l) => t('light.' + l)).join(' · ') }, icon(ICONS.flare), `${run.lights.length}/5`) : null,
    h('span', { class: 'chip' }, icon(ICONS.trophy), fmt(run.score)),
  );
}

// ------------------------------------------------------------------ title

export function titleScreen(app: AppApi): HTMLElement {
  const p = app.profile;
  const saved = p.run && !p.run.over && p.run.mode === 'voyage';
  const best = (m: Mode) => { const e = p.scores[m].find((x) => !x.lunar); return e ? `${t('menu.best')}: ${fmt(e.score)}` : ''; };
  const lunarOn = Object.values(p.mutators).some(Boolean);
  return h('div', { class: 'screen' },
    h('div', { class: 'title-logo', style: { pointerEvents: 'none' } },
      h('h1', { class: 'stroke', text: 'Ladice' }),
      h('div', { class: 'sub stroke', text: t('title.sub') }),
      h('div', { class: 'tag', text: t('title.tag') })),
    h('div', { class: 'title-menu' },
      saved
        ? btn(app, t('menu.continue'), () => app.continueVoyage(), 'big', { id: 'play' })
        : btn(app, t('menu.setSail'), () => app.startRun('voyage'), 'big', { id: 'play', title: t('menu.voyage.d') }),
      h('div', { class: 'modes' },
        saved ? confirmBtn(app, t('menu.newVoyage'), t('menu.newVoyage') + '?', () => app.startRun('voyage'), 'ghost') : null,
        btn(app, t('menu.endless'), () => app.startRun('endless'), 'ghost', { title: `${t('menu.endless.d')} ${best('endless')}` }),
        btn(app, t('menu.daily'), () => app.startRun('daily'), 'ghost', { title: `${t('menu.daily.d')} ${best('daily')}` }),
        btn(app, t('menu.classic'), () => app.startRun('classic'), 'ghost', { title: `${t('menu.classic.d')} ${best('classic')}` })),
      h('div', { class: 'sea-pick', title: t(`sea.${p.settings.sea}.d`) },
        h('span', { class: 'stroke', text: t('sea.label') }),
        seg<number>(app, [[0, t('sea.0')], [1, t('sea.1')], [2, t('sea.2')]], p.settings.sea, (v) => { p.settings.sea = v as 0 | 1 | 2; app.save(); app.refresh(); })),
      h('div', { class: 'sea-note', text: t(`sea.${p.settings.sea}.d`) })),
    h('div', { class: 'title-top' },
      btn(app, '', () => app.open('scores'), 'round ghost', { 'aria-label': t('menu.scores'), title: t('menu.scores'), html: ICONS.trophy }),
      btn(app, '', () => app.open('settings'), 'round ghost', { 'aria-label': t('menu.settings'), title: t('menu.settings'), html: GEAR })),
    h('div', { class: 'title-links' },
      h('button', { class: 'link', text: t('menu.howto'), onclick: () => { app.sfx('click'); app.startTutorial(); } }),
      h('button', { class: 'link', text: t('menu.logbook'), onclick: () => { app.sfx('click'); app.open('logbook'); } }),
      h('button', { class: 'link', text: t('menu.achievements'), onclick: () => { app.sfx('click'); app.open('achievements'); } }),
      h('button', { class: 'link', text: t('menu.museum'), onclick: () => { app.sfx('click'); app.open('museum'); } }),
      h('button', { class: 'link', text: t('menu.credits'), onclick: () => { app.sfx('click'); app.open('credits'); } })),
    h('div', { class: 'title-foot' },
      p.lunarFound ? h('button', { class: 'link', onclick: () => { app.sfx('click'); app.open('lunar'); } }, icon(ICONS.moon), ' ', t('lunar.title'), lunarOn ? ' ●' : '') : null,
      seg<Lang>(app, [['en', 'EN'], ['sl', 'SL']], p.settings.lang, (l) => { p.settings.lang = l; app.applySettings(); app.save(); app.refresh(); })),
  );
}

// ------------------------------------------------------------------ chart

export function chartScreen(app: AppApi): HTMLElement {
  const run = app.run!;
  const biome = biomeOf(run);
  const cols = run.chart.length;
  const pos = (n: ChartNode) => ({ x: 9 + (n.col / (cols - 1)) * 82, y: run.chart[n.col].length === 1 ? 50 : 16 + (n.row / (run.chart[n.col].length - 1)) * 68 });
  let lines = '';
  for (let c = 0; c < cols - 1; c++) for (const a of run.chart[c]) for (const b of run.chart[c + 1]) {
    const pa = pos(a), pb = pos(b);
    const active = c === run.col - 1 ? a.done : c < run.col - 1 ? a.done && b.done : false;
    lines += `<line x1="${pa.x}%" y1="${pa.y}%" x2="${pb.x}%" y2="${pb.y}%" stroke="${active ? '#ffc24a' : '#5b6aa8'}" stroke-width="${active ? 4 : 3}" stroke-dasharray="${active ? '' : '8 8'}" stroke-linecap="round" opacity="${active ? 1 : 0.6}"/>`;
  }
  const nodes = run.chart.flat().map((n) => {
    const { x, y } = pos(n);
    const here = n.col === run.col;
    const label = n.kind === 'boss' ? t('boss.' + BIOMES[biome].boss) : t('kind.' + n.kind);
    const kids = [
      h('span', { class: 'dot' }, icon(ICONS[n.kind])),
      h('span', { class: 'name stroke', text: label }),
      here ? h('span', { class: 'desc', text: t(`kind.${n.kind}.d`, { n: 3 }) }) : null,
    ];
    const style = { left: `${x}%`, top: `${y}%` };
    return here
      ? h('button', { class: 'node', style, onclick: () => { app.sfx('click'); app.chooseNode(n); }, onmouseenter: () => app.sfx('hover'), 'data-kind': n.kind }, kids)
      : h('div', { class: `node ${n.done ? 'done' : 'future'}`, style }, kids);
  });
  const karmaCls = run.karma >= KARMA_HIGH ? 'high' : run.karma <= KARMA_LOW ? 'low' : '';
  const karmaText = run.karma >= KARMA_HIGH ? t('chart.karmaHigh') : run.karma <= KARMA_LOW ? t('chart.karmaLow') : t('chart.karmaMid');
  const choices = currentChoices(run);
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel wide' },
      h('div', { class: 'row between' },
        h('span', { class: 'muted', text: t('chart.title', { n: run.biome + 1 }) + (run.mode === 'daily' ? ` · ${t('mode.daily')} ${run.dateKey}` : '') }),
        run.karma <= KARMA_LOW ? h('span', { class: 'wanted', text: t('chart.wanted') }) : null),
      h('h2', { text: t('biome.' + biome) }),
      statusBar(run),
      h('div', { class: 'chart' }, h('div', { html: `<svg>${lines}</svg>` }), nodes),
      h('div', { class: `karma-line ${karmaCls}`, text: choices[0]?.kind === 'boss' ? t(`boss.${BIOMES[biome].boss}.tip`) : karmaText }),
      h('div', { class: 'row between' },
        btn(app, t('chart.abandon'), () => app.showTitle(), 'ghost small'),
        h('span', { class: 'muted', text: t('chart.pick') })),
    ));
}

// ------------------------------------------------------------------ harbour

export function harbourScreen(app: AppApi): HTMLElement {
  const run = app.run!;
  const upgrades = UPGRADE_IDS.map((id) => {
    const def = UPGRADES[id];
    const lvl = run.upgrades[id];
    const cost = upgradeCost(run, id);
    const buy = cost === null
      ? h('span', { class: 'muted', text: t('harbour.max') })
      : h('button', { class: 'btn small', disabled: !canBuy(run, id), 'data-up': id, onclick: () => { if (buyUpgrade(run, id)) { app.sfx('buy'); app.save(); app.refresh(); } else app.sfx('deny'); } },
        icon(def.currency === 'doubloons' ? ICONS.doubloon : ICONS.pearl), ' ', String(cost));
    return h('div', { class: 'item' },
      h('div', { class: 't' }, h('b', { text: t('up.' + id) }), h('span', { class: 'pips' }, def.costs.map((_, i) => h('i', { class: i < lvl ? 'on' : '' }))), h('small', { text: t(`up.${id}.d`) })),
      buy);
  });
  const damaged = run.planks < run.maxPlanks;
  const repairRow = h('div', { class: 'item' },
    h('div', { class: 't' }, h('b', { text: t('harbour.repair') }), ' ', planks(run.planks, run.maxPlanks)),
    damaged
      ? h('button', { class: 'btn small', disabled: run.doubloons < repairCost(run), onclick: () => { if (repair(run)) { app.sfx('plank'); app.save(); app.refresh(); } else app.sfx('deny'); } }, icon(ICONS.doubloon), ' ', String(repairCost(run)))
      : h('span', { class: 'muted', text: t('harbour.full') }));
  const crew = run.crew.length === 0
    ? [h('p', { class: 'muted', text: t('harbour.noCrew') })]
    : run.crew.map((c) => {
      const on = run.equipped.includes(c);
      return h('div', { class: 'item' + (on ? '' : ' off') },
        h('img', { class: 'portrait', src: artUrl(c), alt: '' }),
        h('div', { class: 't' }, h('b', { text: t('animal.' + c) }), h('small', { text: t('crew.' + c) })),
        h('button', { class: 'btn small ' + (on ? '' : 'ghost'), text: on ? t('harbour.aboard') : t('harbour.ashore'), onclick: () => { if (toggleCrew(run, c)) { app.sfx('click'); app.save(); app.refresh(); } else app.sfx('deny'); } }));
    });
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel wide' },
      h('h2', { text: t('harbour.title') }),
      statusBar(run),
      h('div', { class: 'shop' },
        h('div', { class: 'col' }, h('h3', { text: t('harbour.upgrades') }), repairRow, upgrades),
        h('div', { class: 'col' }, h('h3', { text: t('harbour.crew', { a: run.equipped.length, b: CREW_SLOTS }) }), crew)),
      h('div', { class: 'row center' }, btn(app, t('harbour.leave'), () => app.leaveHarbour(), '', { id: 'leave' })),
    ));
}

// ------------------------------------------------------------------ tally

export interface TallyData { s: LegState; outcome: LegOutcome; medal: 'gold' | 'silver' | 'bronze' | null; title: string; note?: string; onContinue: () => void }

export function tallyScreen(app: AppApi, d: TallyData): HTMLElement {
  const ta = d.s.tally;
  const rows: HTMLElement[] = [];
  const counters: { el: HTMLElement; to: number; prefix: string }[] = [];
  const row = (label: string, value: number, cls = '', prefix = '') => {
    const v = h('span', { class: 'v ' + cls, text: prefix + '0' });
    rows.push(h('span', { class: cls, text: label }), v);
    counters.push({ el: v, to: value, prefix });
  };
  if (ta.kills) row(t('tally.kills'), ta.kills);
  if (ta.rescued) row(t('tally.rescued'), ta.rescued, 'good');
  if (ta.nearMisses) row(t('tally.near'), ta.nearMisses);
  if (ta.assists) row(t('tally.assists'), ta.assists);
  if (ta.maxMult > 1) row(t('tally.maxCombo'), ta.maxMult, '', 'x');
  if (ta.animalsHit) row(t('tally.bonked'), ta.animalsHit, 'bad');
  if (ta.gentleBonus) row(t('tally.gentle'), ta.gentleBonus, 'good', '+');
  if (ta.timeBonus) row(t('tally.timeBonus'), ta.timeBonus, 'good', '+');
  const total = h('span', { class: 'v total', text: '0' });
  rows.push(h('span', { class: 'total', text: t('tally.total') }), total);
  counters.push({ el: total, to: d.s.score, prefix: '' });

  // Count the numbers up one row at a time.
  let i = 0, frame = 0;
  const timer = window.setInterval(() => {
    const c = counters[i];
    if (!c) { clearInterval(timer); return; }
    frame++;
    const k = Math.min(1, frame / 9);
    c.el.textContent = c.prefix + fmt(c.to * k);
    if (frame % 3 === 0) app.sfx('count');
    if (k >= 1) { i++; frame = 0; }
  }, 28);

  const o = d.outcome;
  const loot = d.s.spec.kind === 'classic' ? [] : [
    o.doubloons ? h('span', { class: 'chip' }, icon(ICONS.doubloon), `+${o.doubloons}`) : null,
    o.pearls ? h('span', { class: 'chip' }, icon(ICONS.pearl), `+${o.pearls}`) : null,
    o.karma ? h('span', { class: 'chip' }, icon(ICONS.heart), (o.karma > 0 ? '+' : '') + o.karma) : null,
  ].filter(Boolean);
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel narrow' },
      h('h2', { text: d.title }),
      d.medal ? h('div', { class: 'row center' }, h('div', { class: `medal ${d.medal}`, text: t('tally.medal.' + d.medal) })) : null,
      h('div', { class: 'tally-rows' }, rows),
      loot.length ? h('div', { class: 'row center wrap' }, loot) : null,
      d.note ? h('p', { class: 'muted', style: { textAlign: 'center' }, text: d.note }) : null,
      o.light ? h('div', { class: 'joined light' }, icon(ICONS.flare), h('b', { text: t('light.won', { name: t('light.' + o.light) }) })) : null,
      o.letter !== undefined ? h('div', { class: 'letter' }, h('b', { text: t('letter.found') }), h('p', { text: t('letter.' + o.letter) })) : null,
      o.newCrew.map((c) => h('div', { class: 'joined' }, h('img', { class: 'portrait', src: artUrl(c), alt: '' }), h('div', {}, h('b', { text: t('tally.joined', { name: t('animal.' + c) }) }), h('div', { class: 'muted', text: t('crew.' + c) })))),
      h('div', { class: 'row center' }, btn(app, t('common.continue'), d.onContinue, '', { id: 'continue' })),
    ));
}

// ------------------------------------------------------------------ game over / ending

export interface OverData {
  run: RunState; qualifies: boolean; onSave: (name: string) => void; onAgain: () => void;
  /** Present when the chapter can be restarted. */
  onRetry?: () => void;
  onEnd?: () => void;
}

function nameEntry(app: AppApi, d: OverData): HTMLElement {
  const input = h('input', { class: 'name', type: 'text', maxLength: 14, value: app.profile.lastName, placeholder: '...', 'aria-label': t('over.name') });
  const save = () => { const name = input.value.trim() || 'Kapitan'; d.onSave(name); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); e.stopPropagation(); });
  setTimeout(() => input.focus(), 50);
  return h('div', { class: 'col', style: { alignItems: 'center' } },
    h('div', { class: 'muted', text: t('over.name') }), input, btn(app, t('over.save'), save, '', { id: 'save' }));
}

export function overScreen(app: AppApi, d: OverData): HTMLElement {
  const run = d.run;
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel narrow' },
      h('h2', { text: run.mode === 'classic' ? t('over.classic') : t('over.title') }),
      h('div', { class: 'tally-rows' },
        h('span', { text: t('tally.kills') }), h('span', { class: 'v', text: fmt(run.stats.kills) }),
        h('span', { text: t('tally.rescued') }), h('span', { class: 'v good', text: fmt(run.stats.rescued) }),
        h('span', { text: t('tally.bonked') }), h('span', { class: 'v bad', text: fmt(run.stats.animalsHit) }),
        run.mode === 'endless' ? h('span', { text: t('over.depth', { n: run.depth }) }) : null, run.mode === 'endless' ? h('span', {}) : null,
        h('span', { class: 'total', text: t('over.score') }), h('span', { class: 'v total', text: fmt(run.score) })),
      run.mode !== 'classic' ? h('p', { style: { textAlign: 'center', fontStyle: 'italic' }, text: `“${t('over.moon.' + (Math.abs(run.seed + run.stats.legs) % 3))}” — ${t('who.moon')}` }) : null,
      run.lunar ? h('p', { class: 'muted', style: { textAlign: 'center' } }, icon(ICONS.moon), ' ', t('over.lunar')) : null,
      // While the chapter can still be restarted, the score is not banked yet: that only happens when the voyage is ended.
      d.onRetry ? h('p', { class: 'muted', style: { textAlign: 'center' }, text: t('over.retry.d') }) : null,
      d.qualifies && !d.onRetry ? nameEntry(app, d) : null,
      d.onRetry
        ? h('div', { class: 'row center wrap' },
          btn(app, t('over.retry', { sea: t('biome.' + biomeOf(run)) }), d.onRetry, '', { id: 'retry' }),
          btn(app, t('over.end'), () => d.onEnd?.(), 'ghost', { id: 'end' }),
          btn(app, t('over.title2'), () => app.showTitle(), 'ghost'))
        : h('div', { class: 'row center' },
          btn(app, t('over.again'), d.onAgain, d.qualifies ? 'ghost' : ''),
          btn(app, t('over.title2'), () => app.showTitle(), 'ghost')),
    ));
}

export function endingScreen(app: AppApi, d: OverData): HTMLElement {
  const run = d.run;
  const classic = run.mode === 'classic';
  const mood = run.karma >= KARMA_HIGH ? 'end.good' : run.karma <= KARMA_LOW ? 'end.bad' : 'end.mid';
  return h('div', { class: 'screen dim bright' },
    h('div', { class: 'panel ending', style: { alignItems: 'center', textAlign: 'center' } },
      h('h2', { class: 'stroke', text: t('end.title') }),
      h('img', { class: 'hero', src: artUrl('pMarshmallow'), alt: 'Marshmallow' }),
      h('p', { style: { fontSize: '26px', fontWeight: '600' }, text: t('end.line') }),
      h('p', { text: classic ? t('end.classic') : t(mood) }),
      !classic && run.karma > KARMA_LOW && run.equipped.length
        ? h('div', { class: 'row center crewrow' }, run.equipped.filter((c) => c !== 'marshmallow').map((c, i) => h('img', { src: artUrl(c), alt: '', style: { '--d': `${i * 0.2}s` } as unknown as Record<string, string> })))
        : null,
      h('div', { class: 'row center' }, h('span', { class: 'chip' }, icon(ICONS.trophy), fmt(run.score)), run.lunar ? h('span', { class: 'chip' }, icon(ICONS.moon), t('lunar.title')) : null),
      !classic ? h('p', { class: 'muted', text: t('end.unlocked') }) : null,
      d.qualifies ? nameEntry(app, d) : h('div', { class: 'row center' }, btn(app, t('common.continue'), () => app.open('scores'), '', { id: 'continue' })),
    ));
}

// ------------------------------------------------------------------ scores & achievements

export function scoresScreen(app: AppApi, mode: Mode, back: () => void, pick: (m: Mode) => void, highlight = -1): HTMLElement {
  const list = app.profile.scores[mode];
  const modes: Mode[] = ['voyage', 'endless', 'daily', 'classic'];
  const rows = list.length === 0
    ? [h('p', { class: 'muted', style: { textAlign: 'center' }, text: t('scores.empty') })]
    : [h('div', { class: 'board' }, list.flatMap((e, i) => {
      const cls = i === highlight ? ' me' : '';
      return [
        h('span', { class: 'n' + cls, text: `${i + 1}.` }),
        h('span', { class: cls }, e.name, e.lunar ? h('span', { title: t('lunar.title') }, ' ', icon(ICONS.moon)) : null, e.assist ? h('span', { class: 'muted', text: ' +' }) : null, e.note ? h('span', { class: 'muted', text: ' · ' + e.note }) : null),
        h('span', { class: 's' + cls, text: fmt(e.score) }),
      ];
    }))];
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel' },
      h('h2', { text: t('scores.title') }),
      h('div', { class: 'tabs' }, modes.map((m) => btn(app, t('mode.' + m), () => pick(m), 'small ghost' + (m === mode ? ' on' : '')))),
      h('div', { class: 'scroll' }, rows),
      h('div', { class: 'row between' },
        btn(app, t('menu.back'), back, 'ghost', { id: 'back' }),
        list.length ? confirmBtn(app, t('scores.clear'), t('scores.clearConfirm'), () => { app.profile.scores[mode] = []; app.save(); pick(mode); }) : null),
    ));
}

export function achievementsScreen(app: AppApi, back: () => void): HTMLElement {
  const got = app.profile.achievements;
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel' },
      h('h2', { text: `${t('ach.title')} ${Object.keys(got).length}/${ACHIEVEMENTS.length}` }),
      h('div', { class: 'scroll' }, h('div', { class: 'ach' }, ACHIEVEMENTS.map((id) => {
        const done = !!got[id];
        const secret = id === 'moonstruck';
        return h('div', { class: 'item' + (done ? '' : ' locked') },
          icon(done ? (secret ? ICONS.moon : ICONS.trophy) : ICONS.lock),
          h('div', { class: 't' }, h('b', { text: secret && !done ? '???' : t('ach.' + id) }), h('small', { text: secret ? (done ? t('ach.moonstruck.done') : '???') : t(`ach.${id}.d`) })));
      }))),
      h('div', { class: 'row' }, btn(app, t('menu.back'), back, 'ghost', { id: 'back' })),
    ));
}

// ------------------------------------------------------------------ settings

function keyName(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl').replace('Arrow', '');
}

export function settingsScreen(app: AppApi, back: () => void): HTMLElement {
  const s = app.profile.settings;
  const commit = () => { app.applySettings(); app.save(); };
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) =>
    h('div', { class: 'setrow' }, h('span', { text: label }), seg<number>(app, [[1, t('common.on')], [0, t('common.off')]], get() ? 1 : 0, (v) => { set(!!v); commit(); app.refresh(); }));
  const slider = (label: string, get: () => number, set: (v: number) => void, test: string) =>
    h('div', { class: 'setrow' }, h('span', { text: label }), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: get(), 'aria-label': label, oninput: (e: Event) => { set(Number((e.target as HTMLInputElement).value)); commit(); }, onchange: () => app.sfx(test) }));
  const keys = ACTIONS.map((a) => {
    const b = h('button', { class: 'btn small ghost key', text: keyName(s.keys[a]) });
    b.addEventListener('click', () => {
      b.textContent = t('set.press');
      app.input.onRebind = (code) => { if (code !== 'Escape' || a === 'pause') s.keys[a] = code; commit(); app.refresh(); };
    });
    return h('div', { class: 'setrow' }, h('span', { text: t('act.' + a) }), b);
  });
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel wide' },
      h('h2', { text: t('set.title') }),
      h('div', { class: 'scroll' },
        h('div', { class: 'setgrid' },
          slider(t('set.music'), () => s.music, (v) => (s.music = v), 'click'),
          slider(t('set.sfx'), () => s.sfx, (v) => (s.sfx = v), 'ram'),
          toggle(t('set.shake'), () => s.shake, (v) => (s.shake = v)),
          toggle(t('set.flashes'), () => s.flashes, (v) => (s.flashes = v)),
          toggle(t('set.subtitles'), () => s.subtitles, (v) => (s.subtitles = v)),
          toggle(t('set.boostToggle'), () => s.boostToggle, (v) => (s.boostToggle = v)),
          h('div', { class: 'setrow' }, h('span', { text: t('set.lang') }), seg<Lang>(app, [['en', 'English'], ['sl', 'Slovenščina']], s.lang, (l) => { s.lang = l; commit(); app.refresh(); })),
          toggle(t('set.retro'), () => s.retro, (v) => (s.retro = v))),
        h('h3', { text: t('set.assist'), style: { marginTop: '14px' } }),
        h('div', { class: 'setgrid' },
          h('div', { class: 'setrow' }, h('span', { text: t('set.speed') }), seg<number>(app, [[1, '100%'], [0.85, '85%'], [0.7, '70%']], s.assist.speed, (v) => { s.assist.speed = v; commit(); app.refresh(); })),
          h('div', { class: 'setrow' }, h('span', { text: t('set.planks') }), seg<number>(app, [[0, '0'], [1, '+1'], [2, '+2']], s.assist.extraPlanks, (v) => { s.assist.extraPlanks = v; commit(); app.refresh(); })),
          h('div', { class: 'setrow' }, h('span', { text: t('set.lantern') }), seg<number>(app, [[1, t('common.off')], [1.3, '+30%']], s.assist.lantern, (v) => { s.assist.lantern = v; commit(); app.refresh(); }))),
        h('p', { class: 'muted', text: t('set.assistNote') }),
        h('h3', { text: t('set.keys'), style: { marginTop: '14px' } }),
        h('div', { class: 'setgrid' }, keys),
        h('p', { class: 'muted', style: { marginTop: '8px' }, text: t('set.controls') })),
      h('div', { class: 'row between' },
        btn(app, t('menu.back'), back, 'ghost', { id: 'back' }),
        h('div', { class: 'row' },
          btn(app, t('set.reset'), () => { s.keys = { ...DEFAULT_KEYS }; commit(); app.refresh(); }, 'ghost small'),
          confirmBtn(app, t('set.wipe'), t('set.wipeConfirm'), () => app.wipe()))),
    ));
}

// ------------------------------------------------------------------ small screens

export function textScreen(app: AppApi, kind: 'museum' | 'credits', back: () => void): HTMLElement {
  const body = kind === 'museum'
    ? [h('p', { text: t('museum.p1') }), h('p', { text: t('museum.p2') }), h('p', { text: t('museum.p3') }), h('blockquote', { text: t('museum.quote') }), h('p', { text: t('museum.p4') })]
    : [h('p', { text: t('credits.p1') }), h('p', { text: t('credits.p2') }), h('p', { text: t('credits.p3') }), h('p', { text: t('credits.p4') })];
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel' },
      h('h2', { text: t(`${kind}.title`) }),
      h('div', { class: 'scroll prose' }, body),
      h('div', { class: 'row' }, btn(app, t('menu.back'), back, 'ghost', { id: 'back' })),
    ));
}

export function lunarScreen(app: AppApi, back: () => void): HTMLElement {
  const m = app.profile.mutators;
  const ids = Object.keys(m) as (keyof Mutators)[];
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel narrow' },
      h('h2', {}, icon(ICONS.moon), ' ', t('lunar.title')),
      h('p', { class: 'muted', style: { textAlign: 'center' }, text: t('lunar.note') }),
      h('div', { class: 'col' }, ids.map((id) => h('div', { class: 'setrow' }, h('span', { text: t('mut.' + id) }),
        seg<number>(app, [[1, t('common.on')], [0, t('common.off')]], m[id] ? 1 : 0, (v) => { m[id] = !!v; app.sfx(v ? 'moon' : 'click'); app.applySettings(); app.save(); app.refresh(); })))),
      h('div', { class: 'row' }, btn(app, t('menu.back'), back, 'ghost', { id: 'back' })),
    ));
}

export function pauseScreen(app: AppApi): HTMLElement {
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel narrow', style: { alignItems: 'center' } },
      h('h2', { text: t('hud.paused') }),
      btn(app, t('hud.resume'), () => app.resume(), '', { id: 'resume' }),
      btn(app, t('menu.settings'), () => app.open('settings'), 'ghost'),
      confirmBtn(app, t('hud.quit'), t('hud.quitConfirm'), () => app.quitLeg(), 'ghost'),
      h('p', { class: 'muted', style: { textAlign: 'center' }, text: t('set.controls') }),
    ));
}

// ------------------------------------------------------------------ story

export const PORTRAIT: Record<Speaker, string | null> = {
  narrator: null, moon: 'pMoon', jaka: 'pJaka', marshmallow: 'pMarshmallow',
  frostbeard: 'pFrostbeard', bogqueen: 'pBogqueen', ember: 'pEmber', netmaker: 'pNetmaker', galleon: 'pGalleon',
};
const VOICE: Record<Speaker, number> = { narrator: 2, moon: 7, jaka: 0, marshmallow: 12, frostbeard: -3, bogqueen: 4, ember: 1, netmaker: -1, galleon: -6 };

/** A talking-heads scene: one line at a time, typed out. Click, Space, Enter or gamepad A advances. */
export function storyScreen(app: AppApi, lines: Line[], onDone: () => void): HTMLElement {
  let i = 0, shown = 0, timer = 0;
  const portrait = h('img', { class: 'portrait', alt: '' });
  const name = h('div', { class: 'who' });
  const text = h('div', { class: 'say' });
  const hint = h('div', { class: 'muted hint2', text: t('story.next') });
  const box = h('button', { class: 'dialogue', id: 'continue' }, portrait, h('div', { class: 'body' }, name, text), hint);
  const finish = () => { clearInterval(timer); onDone(); };
  const show = () => {
    const line = lines[i];
    const full = t(line.key);
    const art = PORTRAIT[line.who];
    box.classList.toggle('narrator', line.who === 'narrator');
    portrait.style.display = art ? 'block' : 'none';
    if (art) portrait.src = artUrl(art);
    portrait.className = 'portrait ' + line.who;
    name.textContent = t('who.' + line.who);
    shown = 0;
    clearInterval(timer);
    timer = window.setInterval(() => {
      shown = Math.min(full.length, shown + 2);
      text.textContent = full.slice(0, shown);
      if (shown % 6 === 0 && full[shown - 1] !== ' ') app.sfx('type:' + VOICE[line.who]);
      if (shown >= full.length) clearInterval(timer);
    }, 22);
  };
  box.addEventListener('click', () => {
    const full = t(lines[i].key);
    if (shown < full.length) { shown = full.length; clearInterval(timer); text.textContent = full; return; }
    i++;
    if (i >= lines.length) { finish(); return; }
    app.sfx('page');
    show();
  });
  show();
  setTimeout(() => box.focus(), 30);
  return h('div', { class: 'screen dim story' },
    box,
    h('button', { class: 'link skip', id: 'back', text: t('story.skip'), onclick: () => { app.sfx('click'); finish(); } }));
}

// ------------------------------------------------------------------ logbook

export function logbookScreen(app: AppApi, back: () => void): HTMLElement {
  const log = app.profile.log;
  const captains = BIOME_ORDER.map((b) => BIOMES[b].boss);
  const pirates: PirateType[] = ['dinghy', 'sloop', 'netter', 'douser', 'brigantine', 'ghost'];
  const friends: AnimalType[] = ['pingo', 'zabica', 'ribica', 'turtle', 'marshmallow'];
  const locked = (label = t('log.unknown')) => h('div', { class: 'item locked' }, icon(ICONS.lock), h('div', { class: 't' }, h('b', { text: '???' }), h('small', { text: label })));
  return h('div', { class: 'screen dim' },
    h('div', { class: 'panel wide' },
      h('h2', {}, icon(ICONS.book), ' ', t('log.title')),
      h('div', { class: 'scroll' },
        h('h3', { text: `${t('log.letters')} ${log.letters.length}/5` }),
        h('div', { class: 'col', style: { margin: '6px 0 14px' } }, [0, 1, 2, 3, 4].map((n) => log.letters.includes(n)
          ? h('div', { class: 'letter' }, h('b', { text: t('biome.' + BIOME_ORDER[n]) }), h('p', { text: t('letter.' + n) }))
          : locked(t('biome.' + BIOME_ORDER[n])))),
        h('h3', { text: `${t('log.lights')} ${log.captains.length}/5` }),
        h('div', { class: 'ach', style: { margin: '6px 0 14px' } }, captains.map((c: BossKind) => log.captains.includes(c)
          ? h('div', { class: 'item' }, h('img', { class: 'portrait ' + c, src: artUrl(PORTRAIT[c] ?? c), alt: '' }), h('div', { class: 't' }, h('b', { text: t('boss.' + c) }), h('small', { text: t('light.' + c) })))
          : locked())),
        h('h3', { text: t('log.pirates') }),
        h('div', { class: 'ach', style: { margin: '6px 0 14px' } }, pirates.map((k) => log.pirates[k]
          ? h('div', { class: 'item' }, h('img', { class: 'portrait', src: artUrl(k), alt: '' }), h('div', { class: 't' }, h('b', { text: `${t('pirate.' + k)} × ${fmt(log.pirates[k] ?? 0)}` }), h('small', { text: t(`pirate.${k}.d`) })))
          : locked())),
        h('h3', { text: t('log.friends') }),
        h('div', { class: 'ach', style: { margin: '6px 0' } }, friends.map((k) => log.rescued[k]
          ? h('div', { class: 'item' }, h('img', { class: 'portrait', src: artUrl(k), alt: '' }), h('div', { class: 't' }, h('b', { text: `${t('animal.' + k)} × ${fmt(log.rescued[k] ?? 0)}` }), h('small', { text: t('crew.' + k) })))
          : locked()))),
      h('div', { class: 'row' }, btn(app, t('menu.back'), back, 'ghost', { id: 'back' })),
    ));
}
