import { TUNE } from '../content';
import { t } from '../core/i18n';
import { boostCooldown, flareCooldown, isClassic } from '../sim/leg';
import type { LegState } from '../sim/types';
import { ICONS, artUrl } from '../render/art';
import { fmt, h, icon } from './dom';

/** In-game overlay: score, combo, timer, hull, crew, banners, sound captions. */
export class Hud {
  el: HTMLElement;
  private score: HTMLElement;
  private combo: HTMLElement;
  private comboBar: HTMLElement;
  private time: HTMLElement;
  private hull: HTMLElement;
  private objective: HTMLElement;
  private bossbar: HTMLElement;
  private bossFill: HTMLElement;
  private banners: HTMLElement;
  private prompt: HTMLElement;
  private subs: HTMLElement;
  private vignette = h('div', { class: 'vignette' });
  private lastPlankCount = -1;
  private tutorial: HTMLElement;
  private boostCd: HTMLElement;
  private flareCd: HTMLElement;
  private crewEls: HTMLElement[] = [];
  private lastPlanks = '';
  private shownScore = 0;
  private lastMult = 1;
  private lastSecond = -1;
  onTick: (() => void) | null = null;

  constructor(s: LegState, opts: { bossName?: string; bossPortrait?: string; bossSea?: string; lunar?: string[]; onPause: () => void; touch: { flare: (on: boolean) => void; brake: (on: boolean) => void } }) {
    const hold = (fn: (on: boolean) => void) => ({
      onpointerdown: (e: Event) => { e.preventDefault(); fn(true); }, onpointerup: () => fn(false), onpointerleave: () => fn(false), onpointercancel: () => fn(false),
    });
    this.score = h('div', { class: 'score stroke', text: '0' });
    this.comboBar = h('i');
    this.combo = h('div', { class: 'combo stroke', style: { visibility: 'hidden' } }, h('span', {}), h('span', { class: 'bar' }, this.comboBar));
    this.time = h('div', { class: 'time stroke' });
    this.hull = h('div', { class: 'hull' });
    this.objective = h('div', { class: 'objective stroke' });
    this.bossFill = h('i');
    this.bossbar = h('div', { class: 'bossbar', style: { display: 'none' } }, this.bossFill);
    this.banners = h('div', {});
    this.prompt = h('div', { class: 'prompt stroke' }, t('hud.castOff'), h('small', { text: t('hud.castOff.mouse') }));
    this.subs = h('div', { class: 'subs' });
    this.tutorial = h('div', { class: 'tutorial', style: { display: 'none' } });
    this.boostCd = h('i');
    this.flareCd = h('i');
    const crew = s.spec.loadout.crew.map((c) => {
      const el = h('div', { class: 'crewp', title: t('crew.' + c) }, h('img', { src: artUrl(c), alt: t('animal.' + c) }));
      this.crewEls.push(el);
      return el;
    });
    const classic = isClassic(s);
    this.el = h('div', { class: 'screen hud' },
      h('div', { class: 'tl', style: { pointerEvents: 'none' } }, h('div', { class: 'label', text: t('hud.score') }), this.score, this.combo),
      h('div', { class: 'tr', style: { pointerEvents: 'none' } }, s.timed ? h('div', { class: 'label', text: t('hud.time') }) : null, this.time,
        classic ? null : h('div', { class: 'label hull-label', text: t('hud.hull') }), this.hull,
        opts.lunar?.length ? h('div', { class: 'lunar-badge' }, icon(ICONS.moon), opts.lunar.join(' · ')) : null),
      this.vignette,
      h('div', { class: 'tc', style: { pointerEvents: 'none' } }, this.objective, this.bossbar),
      h('div', { class: 'bl', style: { pointerEvents: 'none' } },
        classic ? null : h('div', { class: 'cd' }, this.boostCd, icon(ICONS.boost)),
        classic ? null : h('div', { class: 'cd' }, this.flareCd, icon(ICONS.flare), h('small', { text: 'F' })),
        ...crew),
      this.banners, this.prompt, this.tutorial, this.subs,
      h('button', { class: 'btn ghost small pausebtn', text: 'II', 'aria-label': t('hud.paused'), onclick: opts.onPause }),
      h('div', { class: 'touch' },
        h('button', { class: 'btn ghost', text: t('hud.brake'), ...hold(opts.touch.brake) }),
        h('button', { class: 'btn', text: t('hud.flare'), ...hold(opts.touch.flare) })),
    );
    if (opts.bossName) {
      this.objective.textContent = opts.bossName;
      this.bossbar.style.display = 'block';
      // Name card: the captain is announced as the fight opens.
      if (opts.bossPortrait) {
        const card = h('div', { class: 'bosscard' }, h('img', { class: 'portrait', src: opts.bossPortrait, alt: '' }), h('div', {}, h('small', { text: opts.bossSea ?? '' }), h('b', { class: 'stroke', text: opts.bossName })));
        this.el.append(card);
        setTimeout(() => card.remove(), 3600);
      }
    }
    this.update(s, false);
  }

  update(s: LegState, touch: boolean) {
    const p = s.player;
    // Score ticks up rather than jumping.
    this.shownScore += (s.score - this.shownScore) * 0.25;
    if (Math.abs(s.score - this.shownScore) < 1) this.shownScore = s.score;
    this.score.textContent = fmt(this.shownScore);

    if (s.mult > 1) {
      this.combo.style.visibility = 'visible';
      (this.combo.firstChild as HTMLElement).textContent = `x${s.mult}`;
      this.combo.className = `combo stroke m${s.mult}`;
      this.comboBar.style.width = `${Math.max(0, (s.comboT / TUNE.score.comboWindow) * 100)}%`;
      if (s.mult !== this.lastMult) { this.combo.style.transform = 'scale(1.5)'; setTimeout(() => (this.combo.style.transform = ''), 120); }
    } else this.combo.style.visibility = 'hidden';
    this.lastMult = s.mult;

    if (!s.timed && (s.spec.kind === 'bounty' || s.spec.kind === 'beacons')) {
      // No countdown here: show the time taken so far (speed is what earns the bonus).
      const sec = Math.floor(s.time);
      this.time.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      this.time.classList.add('up');
    }
    if (s.timed) {
      const sec = Math.max(0, Math.ceil(s.timeLeft));
      this.time.textContent = String(sec);
      this.time.classList.toggle('low', sec <= 5 && s.status === 'running');
      if (sec !== this.lastSecond && sec <= 5 && sec > 0 && s.status === 'running') this.onTick?.();
      this.lastSecond = sec;
    }

    // A lost plank must be impossible to miss: the hull row jolts and the screen edge flashes red.
    if (this.lastPlankCount >= 0 && p.planks < this.lastPlankCount) {
      for (const el of [this.hull, this.vignette]) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
    }
    this.lastPlankCount = p.planks;
    this.hull.classList.toggle('last', p.planks === 1 && p.maxPlanks > 1 && s.status === 'running');
    const key = s.spec.mutators.invincible ? 'inf' : `${p.planks}/${p.maxPlanks}`;
    if (key === 'inf' && this.lastPlanks !== key) { this.lastPlanks = key; this.hull.replaceChildren(h('span', { class: 'inf stroke', text: '∞' })); }
    else if (key !== this.lastPlanks) {
      this.lastPlanks = key;
      this.hull.replaceChildren(...Array.from({ length: Math.max(p.maxPlanks, 1) }, (_, i) => icon(i < p.planks ? ICONS.plank : ICONS.plankEmpty)));
    }

    if (s.boss) {
      this.bossFill.style.width = `${(s.boss.hp / s.boss.maxHp) * 100}%`;
    } else if (s.spec.kind === 'boss') {
      this.bossbar.style.display = 'none';
      this.objective.textContent = s.status === 'running' ? t('hud.findHer') : '';
    } else if (s.spec.kind === 'rescue') this.objective.textContent = t('hud.rescued', { a: s.tally.rescued, b: s.goal });
    else if (s.spec.kind === 'convoy') this.objective.textContent = t('hud.convoy', { a: s.tally.rescued, b: s.goal });
    else if (s.spec.kind === 'bounty') this.objective.textContent = t('hud.bounty', { a: Math.min(s.tally.kills, s.goal), b: s.goal });
    else if (s.spec.kind === 'beacons') this.objective.textContent = t('hud.beacons', { a: s.beacons.filter((q) => q.lit).length, b: s.goal });

    this.prompt.style.display = s.status === 'ready' ? 'block' : 'none';
    this.boostCd.style.height = `${(p.boostCd / boostCooldown(s)) * 100}%`;
    this.flareCd.style.height = `${(p.flareCd / flareCooldown(s)) * 100}%`;
    this.flareCd.parentElement?.classList.toggle('ready', p.flareCd <= 0);
    s.spec.loadout.crew.forEach((c, i) => {
      const spent = (c === 'pingo' && !p.freeHit) || (c === 'zabica' && !p.hopReady) || (c === 'marshmallow' && !p.barkReady);
      this.crewEls[i]?.classList.toggle('spent', spent);
    });
    this.el.classList.toggle('touching', touch);
  }

  banner(text: string, cls = '') {
    const b = h('div', { class: `banner stroke pop ${cls}`, text });
    this.banners.replaceChildren(b);
    setTimeout(() => b.remove(), 1700);
  }

  subtitle(text: string) {
    const d = h('div', { text });
    this.subs.append(d);
    while (this.subs.children.length > 3) this.subs.firstChild?.remove();
    setTimeout(() => d.remove(), 2700);
  }

  setTutorial(text: string | null) {
    this.tutorial.style.display = text ? 'block' : 'none';
    if (text) this.tutorial.textContent = text;
  }
}
