import Phaser from 'phaser';
import { AudioEngine, type TrackId } from './audio/audio';
import { BIOMES } from './content';
import { setLang, t } from './core/i18n';
import { InputManager } from './core/input';
import { clamp } from './core/math';
import { addScore, defaultProfile, loadProfile, qualifies, saveProfile, unlock, type AchievementId, type Profile } from './meta/profile';
import { applyLeg, biomeOf, canRetry, currentChoices, leaveHarbour, legSpec, newRun, restoreCheckpoint, saveCheckpoint, type ChartNode, type LegOutcome, type Mode, type RunState } from './meta/run';
import { arrivalScene, bossIntroScene, bossOutroScene, type Line } from './meta/story';
import { BootScene, setRenderWidth } from './render/boot';
import { LegScene, type LegHooks } from './render/LegScene';
import { TitleScene } from './render/TitleScene';
import { isClassic } from './sim/leg';
import { NO_ASSIST, NO_MUTATORS, type BiomeId, type LegKind, type LegSpec, type LegState, type SimEvent } from './sim/types';
import { ICONS, artUrl } from './render/art';
import { h, icon } from './ui/dom';
import { Hud } from './ui/hud';
import {
  achievementsScreen, chartScreen, endingScreen, harbourScreen, logbookScreen, lunarScreen, overScreen, pauseScreen, scoresScreen, settingsScreen,
  storyScreen, tallyScreen, textScreen, titleScreen, PORTRAIT, type AppApi, type OverData,
} from './ui/screens';

type Renderer = (() => HTMLElement) | null;

export class App implements AppApi {
  game: Phaser.Game;
  profile: Profile = loadProfile();
  run: RunState | null = null;
  input: InputManager;
  audio = new AudioEngine();
  /** Current leg simulation (null in menus). Exposed for tests and debugging. */
  sim: LegState | null = null;
  ready = false;
  /** Name of the screen on show, for tests. */
  screen = 'boot';

  private ui = document.getElementById('ui')!;
  private hudLayer = h('div', { class: 'screen' });
  private screenLayer = h('div', { class: 'screen' });
  private toasts = h('div', { class: 'toasts' });
  private fadeEl = h('div', { id: 'fade' });
  private fading = false;
  private lastOutcome: LegOutcome | null = null;
  private kegWarned = false;
  private tideShown = false;
  private renderer: Renderer = null;
  private hud: Hud | null = null;
  private node: ChartNode | undefined;
  private paused = false;
  private inLeg = false;
  private standaloneTutorial = false;
  private debugSpec: LegSpec | null = null;
  private bot = false;
  private navHeld = false;
  private lowOilWarned = false;
  private query = new URLSearchParams(location.search);

  constructor() {
    this.ui.append(this.hudLayer, this.screenLayer, this.toasts, this.fadeEl);
    // ?res=960 renders at a lower internal resolution (slow machines, software-rendered test browsers).
    const resW = clamp(Number(this.query.get('res') ?? 1920), 640, 2560);
    setRenderWidth(resW);
    this.game = new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', backgroundColor: '#04060f',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: resW, height: Math.round(resW * 9 / 16) },
      render: { antialias: true, powerPreference: 'high-performance' },
      scene: [BootScene, TitleScene, LegScene],
      audio: { noAudio: true },
      input: { mouse: { preventDefaultWheel: false } },
    });
    this.input = new InputManager(() => this.game.canvas, () => this.profile.settings);
    this.bot = this.query.has('bot');

    const fit = () => {
      const r = this.game.canvas.getBoundingClientRect();
      this.ui.style.left = `${r.left}px`; this.ui.style.top = `${r.top}px`;
      this.ui.style.transform = `scale(${r.width / 1280})`;
    };
    this.game.scale.on('resize', fit);
    window.addEventListener('resize', () => setTimeout(fit, 50));

    const unlockAudio = () => { this.audio.unlock(); this.audio.setVolumes(this.profile.settings.music, this.profile.settings.sfx); };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.inLeg && !this.paused) this.pause(); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !this.inLeg) (this.screenLayer.querySelector('#back') as HTMLElement | null)?.click();
    });

    this.game.events.on('moon', () => this.onMoon());
    this.game.events.on('step', () => this.step());
    this.game.events.once('boot-done', () => {
      fit();
      this.applySettings();
      this.ready = true;
      if (this.query.has('leg')) this.startDebugLeg();
      else this.showTitle();
    });
  }

  // ------------------------------------------------------------------ plumbing

  /** Hand the helm to the autopilot (tests, demos). */
  setBot(on: boolean) {
    this.bot = on;
    const leg = this.game.scene.getScene('leg') as LegScene | undefined;
    leg?.setBot(on);
  }

  /** Play a sound; `name:k` passes a pitch/level parameter (e.g. `type:7`). */
  sfx(name: string) {
    const [n, k] = name.split(':');
    this.audio.sfx(n, 0, k === undefined ? 1 : Number(k));
  }
  save() { saveProfile(this.profile); }

  applySettings() {
    const s = this.profile.settings;
    setLang(s.lang);
    this.audio.setVolumes(s.music, s.sfx);
    document.body.classList.toggle('retro', s.retro && this.inLeg && this.run?.mode === 'classic');
    const title = this.game.scene.getScene('title') as TitleScene | undefined;
    if (title && this.game.scene.isActive('title')) title.setLunar(this.lunarOn());
    if (!this.inLeg) this.audio.music(this.lunarOn() ? 'lunar' : 'title');
  }

  private lunarOn(): boolean { return Object.values(this.profile.mutators).some(Boolean); }

  private setScreen(name: string, r: Renderer) {
    this.screen = name;
    this.renderer = r;
    this.screenLayer.replaceChildren(...(r ? [r()] : []));
  }

  refresh() {
    if (!this.renderer) return;
    const scroll = (this.screenLayer.querySelector('.scroll') as HTMLElement | null)?.scrollTop ?? 0;
    this.screenLayer.replaceChildren(this.renderer());
    const sc = this.screenLayer.querySelector('.scroll') as HTMLElement | null;
    if (sc) sc.scrollTop = scroll;
  }

  /** Dip to black around a change of scene. */
  private transition(fn: () => void) {
    if (this.fading) { fn(); return; }
    this.fading = true;
    this.fadeEl.classList.add('on');
    setTimeout(() => {
      fn();
      setTimeout(() => { this.fadeEl.classList.remove('on'); this.fading = false; }, 120);
    }, 230);
  }

  private playStory(lines: Line[] | null, then: () => void) {
    if (!lines || lines.length === 0) { then(); return; }
    this.save();
    this.setScreen('story', () => storyScreen(this, lines, then));
  }

  private backdrop(tide = false) {
    this.inLeg = false; this.paused = false; this.sim = null;
    this.hud = null; this.hudLayer.replaceChildren();
    document.body.classList.remove('retro');
    this.input.resetLatch();
    if (this.game.scene.isActive('leg') || this.game.scene.isPaused('leg')) this.game.scene.stop('leg');
    if (tide !== this.tideShown && this.game.scene.isActive('title')) this.game.scene.stop('title');
    this.tideShown = tide;
    if (!this.game.scene.isActive('title')) this.game.scene.start('title', { lunar: this.lunarOn(), tide });
  }

  private toast(text: string) {
    const el = h('div', { class: 'toast' }, icon(ICONS.trophy), text);
    this.toasts.append(el);
    setTimeout(() => el.remove(), 3700);
  }

  private award(id: AchievementId) {
    if (!unlock(this.profile, id)) return;
    this.save();
    this.sfx('medal');
    this.toast(t('ach.unlocked', { name: t('ach.' + id) }));
  }

  /** Per-frame housekeeping that must keep running while the leg is paused. */
  private step() {
    if (this.inLeg && this.input.consumePause()) { if (this.paused) { if (this.screen === 'pause') this.resume(); } else if (this.sim && (this.sim.status === 'running' || this.sim.status === 'ready')) this.pause(); }
    else if (!this.inLeg) this.input.consumePause();
    // Gamepad menu navigation.
    if (this.renderer) {
      const nav = this.input.padNav();
      const dir = nav.y || nav.x;
      if (dir && !this.navHeld) {
        const items = Array.from(this.screenLayer.querySelectorAll<HTMLElement>('button:not([disabled]), input'));
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + dir + items.length) % items.length]?.focus();
      }
      this.navHeld = !!dir;
      if (this.input.consumeConfirm()) {
        const a = document.activeElement as HTMLElement | null;
        if (a && this.screenLayer.contains(a)) a.click();
        else (this.screenLayer.querySelector('#play, #continue, #resume, #leave, #save, #back, button') as HTMLElement | null)?.focus();
      }
    } else this.input.consumeConfirm();
  }

  // ------------------------------------------------------------------ menus

  showTitle() {
    if (this.run && !this.run.over && this.run.mode === 'voyage' && !this.standaloneTutorial) { this.profile.run = this.run; this.save(); }
    this.run = null; this.standaloneTutorial = false;
    this.backdrop();
    this.audio.music(this.lunarOn() ? 'lunar' : 'title');
    this.audio.setMuffle(0);
    this.setScreen('title', () => titleScreen(this));
  }

  open(screen: 'scores' | 'achievements' | 'settings' | 'museum' | 'credits' | 'lunar' | 'logbook', back?: () => void) {
    const prevName = this.screen, prev = this.renderer;
    const goBack = back ?? (() => { this.setScreen(prevName, prev); });
    switch (screen) {
      case 'scores': this.openScores(this.run?.mode ?? 'voyage', -1, back ?? (() => this.showTitle())); break;
      case 'achievements': this.setScreen('achievements', () => achievementsScreen(this, goBack)); break;
      case 'settings': this.setScreen('settings', () => settingsScreen(this, goBack)); break;
      case 'museum': case 'credits': this.setScreen(screen, () => textScreen(this, screen, goBack)); break;
      case 'lunar': this.setScreen('lunar', () => lunarScreen(this, goBack)); break;
      case 'logbook': this.setScreen('logbook', () => logbookScreen(this, goBack)); break;
    }
  }

  private openScores(mode: Mode, highlight: number, back: () => void) {
    this.setScreen('scores', () => scoresScreen(this, mode, back, (m) => this.openScores(m, -1, back), highlight));
  }

  private onMoon() {
    if (this.screen !== 'title') return;
    this.audio.unlock();
    this.sfx('moon');
    const first = !this.profile.lunarFound;
    this.profile.lunarFound = true;
    this.save();
    if (first) this.award('moonstruck');
    this.setScreen('lunar', () => lunarScreen(this, () => this.showTitle()));
  }

  wipe() {
    this.profile = defaultProfile();
    this.save();
    this.applySettings();
    this.showTitle();
  }

  // ------------------------------------------------------------------ runs

  startRun(mode: Mode) {
    const seedParam = this.query.get('seed');
    this.run = newRun(mode, {
      seed: seedParam ? Number(seedParam) : undefined,
      mutators: this.profile.mutators,
      assist: { ...this.profile.settings.assist },
      marshmallow: this.profile.marshmallow,
      sea: this.profile.settings.sea,
      tutorial: mode === 'voyage' && !this.profile.tutorialDone && !this.query.has('notutorial'),
    });
    this.standaloneTutorial = false;
    if (mode === 'voyage') { this.profile.run = null; this.save(); }
    if (this.run.tutorial) this.transition(() => this.startLeg());
    else if (mode === 'voyage' || mode === 'daily') this.showChart();
    else this.transition(() => this.startLeg());
  }

  continueVoyage() {
    const saved = this.profile.run;
    if (!saved || saved.over) { this.startRun('voyage'); return; }
    this.run = saved;
    this.run.assist = { ...this.profile.settings.assist };
    // Voyages saved before chapter restarts existed get their first checkpoint when they are next at the start of a sea.
    if (!saved.checkpoint && saved.col === 0) saveCheckpoint(saved);
    this.showChart();
  }

  startTutorial() {
    this.run = newRun('voyage', { tutorial: true });
    this.standaloneTutorial = true;
    this.transition(() => this.startLeg());
  }

  private showChart() {
    this.backdrop();
    this.audio.music('harbour');
    this.audio.setMuffle(0);
    const run = this.run!;
    const show = () => {
      const node = currentChoices(run)[0];
      if (node?.kind === 'harbour') this.setScreen('harbour', () => harbourScreen(this));
      else this.setScreen('chart', () => chartScreen(this));
    };
    // Arriving in a new sea: the Moon has something to say.
    this.playStory(arrivalScene(run, biomeOf(run)), show);
  }

  chooseNode(node: ChartNode) {
    if (node.kind === 'harbour') { this.setScreen('harbour', () => harbourScreen(this)); return; }
    const go = () => this.transition(() => this.startLeg(node));
    if (node.kind === 'boss') this.playStory(bossIntroScene(this.run!, BIOMES[biomeOf(this.run!)].boss), go);
    else go();
  }

  leaveHarbour() {
    const run = this.run!;
    // Night Watch has no chart: its harbour is a quick stop between legs.
    if (run.mode === 'endless') { this.transition(() => this.startLeg()); return; }
    leaveHarbour(run);
    this.profile.run = run; this.save();
    this.showChart();
  }

  // ------------------------------------------------------------------ the leg

  private startDebugLeg() {
    const q = this.query;
    const kind = (q.get('leg') ?? 'patrol') as LegKind;
    this.run = newRun('endless', { seed: Number(q.get('seed') ?? 1) });
    const crew = (q.get('crew') ?? '').split(',').filter(Boolean) as LegSpec['loadout']['crew'];
    this.debugSpec = {
      kind, biome: (q.get('biome') ?? 'ice') as BiomeId, seed: Number(q.get('seed') ?? 1), difficulty: Number(q.get('diff') ?? 0),
      duration: kind === 'convoy' ? 60 : kind === 'rescue' ? 45 : 30, classicLevel: kind === 'classic' ? (Number(q.get('level') ?? 1) as 1 | 2 | 3) : undefined,
      loadout: { planks: Number(q.get('planks') ?? 3), maxPlanks: Number(q.get('planks') ?? 3), upgrades: { hull: 0, ram: 0, engine: 0, boost: 0, lantern: 0, flare: 0 }, crew, oil: 1 },
      mutators: { ...NO_MUTATORS, seeAll: q.has('seeall'), invincible: q.has('god') }, assist: { ...NO_ASSIST }, karma: 0,
      sea: clamp(Number(q.get('sea') ?? 1), 0, 2) as 0 | 1 | 2, lights: [], bottle: q.has('bottle'),
    };
    this.startLeg();
  }

  private startLeg(node?: ChartNode) {
    const run = this.run!;
    this.node = node;
    const spec = this.debugSpec ?? legSpec(run, node);
    this.inLeg = true; this.paused = false; this.hud = null; this.lowOilWarned = false; this.kegWarned = false;
    this.hudLayer.replaceChildren();
    this.setScreen('leg', null);
    this.input.arm();
    if (this.game.scene.isActive('title')) this.game.scene.stop('title');
    if (run.equipped.length >= 3) this.award('fullcrew');

    const hooks: LegHooks = {
      input: this.input,
      settings: () => this.profile.settings,
      onEvent: (e, s) => this.onEvent(e, s),
      onFrame: (s) => this.onFrame(s),
      onEnd: (s) => this.onLegEnd(s),
      bot: this.bot,
    };
    this.game.scene.start('leg', { spec, hooks });
    const track: TrackId = spec.kind === 'boss' ? 'boss' : spec.kind === 'classic' ? 'classic' : spec.biome;
    this.audio.music(track);
    this.audio.setMuffle(0);
    document.body.classList.toggle('retro', this.profile.settings.retro && spec.kind === 'classic');
  }

  private makeHud(s: LegState) {
    const boss = s.boss ? t('boss.' + s.boss.kind) : undefined;
    this.hud = new Hud(s, {
      bossName: boss,
      bossPortrait: s.boss ? artUrl(PORTRAIT[s.boss.kind] ?? s.boss.kind) : undefined,
      bossSea: t('biome.' + s.spec.biome),
      lunar: (Object.keys(s.spec.mutators) as (keyof typeof s.spec.mutators)[]).filter((k) => s.spec.mutators[k]).map((k) => t('mut.' + k)),
      onPause: () => this.pause(),
      touch: { flare: (on) => (this.input.ui.flare = on), brake: (on) => (this.input.ui.brake = on) },
    });
    this.hud.onTick = () => this.sfx('tick');
    this.hudLayer.replaceChildren(this.hud.el);
    // Brief the player while they sit at the dock.
    const k = s.spec.kind;
    if (s.tutorial) this.hud.setTutorial(t('tut.0'));
    else if (k === 'classic') {
      const hz = s.hazards[0]?.type ?? 'iceberg';
      this.hud.setTutorial(t('classic.intro', { n: s.spec.classicLevel ?? 1, hz: t('hz.' + hz), an: t('animal.' + (s.animals[0]?.type ?? 'pingo')) }));
    } else if (k === 'boss') this.hud.setTutorial(t(`boss.${BIOMES[s.spec.biome].boss}.tip`));
    else this.hud.setTutorial(`${t('kind.' + k)}: ${t(`kind.${k}.d`, { n: s.goal })}`);
  }

  private onFrame(s: LegState) {
    this.sim = s;
    if (!this.hud) this.makeHud(s);
    this.hud!.update(s, this.input.isTouch());
    this.audio.setIntensity(s.status === 'running' ? (s.mult - 1) / 4 + (s.boss ? 0.5 : 0) : 0);
    const low = !isClassic(s) && s.spec.kind !== 'tutorial' ? clamp((0.28 - s.player.oil) / 0.28, 0, 1) : 0;
    this.audio.setMuffle(low * 0.75);
    if (low > 0.3 && !this.lowOilWarned && s.status === 'running') { this.lowOilWarned = true; this.hud!.banner(t('banner.lowOil'), 'small bad'); }
    if (low === 0) this.lowOilWarned = false;
  }

  private onEvent(e: SimEvent, s: LegState) {
    const hud = this.hud;
    const p = s.player;
    const pan = 'x' in e ? clamp((e.x - p.x) / 520, -1, 1) : 0;
    const dirOf = (x: number) => (Math.abs(x - p.x) < 140 ? t('dir.near') : x < p.x ? t('dir.left') : t('dir.right'));
    const caption = (key: string, x: number) => { if (this.profile.settings.subtitles) hud?.subtitle(t(key, { dir: dirOf(x) })); };
    const a = this.audio;
    switch (e.type) {
      case 'castOff': a.sfx('castoff'); if (!s.tutorial) hud?.setTutorial(null); break;
      case 'boost': a.sfx('boost'); break;
      case 'ram': a.sfx(e.kill ? 'kill' : 'ram', pan, e.mult); if (e.kill) this.profile.log.pirates[e.pirate] = (this.profile.log.pirates[e.pirate] ?? 0) + 1; break;
      case 'clang': a.sfx('clang', pan); break;
      case 'bump': a.sfx('bump', pan); break;
      case 'bonk': a.sfx('bonk', pan); a.sfx(e.animal, pan); break;
      case 'monster': a.sfx('monster'); hud?.banner(t('banner.monster'), 'bad'); this.award('monster'); break;
      case 'hazardHit': a.sfx('hazard'); if (e.free) hud?.banner(t('banner.pingo'), 'small good'); else this.onPlankLost(s); break;
      case 'playerHit': a.sfx('hurt'); this.onPlankLost(s); break;
      case 'hop': a.sfx('hop'); hud?.banner(t('banner.hop'), 'small good'); break;
      case 'nearMiss': a.sfx('near'); hud?.banner(t('banner.near'), 'small'); break;
      case 'pickup': a.sfx(e.pickup); if (e.pickup === 'bottle') hud?.banner(t('banner.letter'), 'small good'); break;
      case 'beaconLit': a.sfx('beacon', pan); hud?.banner(t('banner.beacon'), 'small good'); break;
      case 'beaconOut': a.sfx('beaconOut', pan); hud?.banner(t('banner.beaconOut'), 'small bad'); break;
      case 'kegDrop': a.sfx('fuse', pan); caption('sub.keg', e.x); if (!this.kegWarned) { this.kegWarned = true; hud?.banner(t('banner.keg'), 'small bad'); } break;
      case 'spawn': a.sfx('spawn', pan); if (Math.abs(e.x - p.x) > 620) caption('sub.splash', e.x); break;
      case 'notice': a.sfx('notice', pan); break;
      case 'creak': a.sfx('creak', pan); caption('sub.creak', e.x); break;
      case 'cannonFire': a.sfx('cannon', pan); caption('sub.cannon', e.x); break;
      case 'cannonLand': a.sfx(e.kind === 'keg' ? 'boom' : 'splash', pan); if (e.kind === 'net' && p.snare > 2) hud?.banner(t('banner.snared'), 'small bad'); break;
      case 'flare': a.sfx(e.bark ? 'bark' : 'flare'); if (e.bark) hud?.banner(t('banner.bark'), 'good'); break;
      case 'sonar': a.sfx('sonar'); break;
      case 'netCatch': a.sfx('netCatch', pan); a.sfx(e.animal, pan); caption('sub.net', e.x); hud?.banner(t('banner.caught'), 'small bad'); break;
      case 'freed': a.sfx('freed', pan); if (e.animal !== 'marshmallow' && s.spec.kind !== 'convoy') hud?.banner(t('banner.freed'), 'small good'); break;
      case 'towStart': a.sfx('tow'); a.sfx(e.animal); if (e.animal === 'marshmallow') this.profile.log.rescued.marshmallow = (this.profile.log.rescued.marshmallow ?? 0) + 1; break;
      case 'delivered': a.sfx('delivered'); hud?.banner(t('banner.rescued'), 'small good'); this.profile.log.rescued[e.animal] = (this.profile.log.rescued[e.animal] ?? 0) + 1; break;
      case 'frogHop': if (Math.abs(e.x - p.x) < 400) a.sfx('zabica', pan); break;
      case 'assist': a.sfx('assist', pan); hud?.banner(t(e.by === 'keg' ? 'banner.kegAssist' : 'banner.assist'), 'good'); if (e.by !== 'keg') this.award('assist'); break;
      case 'floeShove': a.sfx('floe', pan); break;
      case 'calve': a.sfx('splash', pan); break;
      case 'beamStun': a.sfx('beam', pan); break;
      case 'lightning': a.sfx('thunder'); if (this.profile.settings.subtitles) hud?.subtitle(t('sub.thunder')); break;
      case 'aurora': a.sfx('aurora'); hud?.banner(t('banner.aurora'), 'small good'); break;
      case 'tide': a.sfx('tide'); hud?.banner(t(e.exposed ? 'banner.tideLow' : 'banner.tideHigh'), 'small'); break;
      case 'comboUp': a.sfx('combo', 0, e.mult); if (e.mult >= 5) this.award('combo5'); break;
      case 'comboLost': a.sfx('comboLost'); break;
      case 'bossHit': a.sfx('bossHit', pan); break;
      case 'bossStun': a.sfx('bossStun', pan); hud?.banner(t('banner.stunned'), 'small good'); break;
      case 'bossPhase': a.sfx('thunder'); hud?.banner(s.boss?.kind === 'galleon' && e.phase === 3 ? t('banner.dark') : `“${t('taunt.' + (s.boss?.kind ?? 'galleon'))}”`, 'small bad'); break;
      case 'bossSurface': a.sfx('spawn', pan); caption('sub.surface', e.x); break;
      case 'bossTelegraph': a.sfx('notice', pan); break;
      case 'shieldBreak': a.sfx('shield', pan); hud?.banner(t('banner.shield'), 'small good'); break;
      case 'netCut': a.sfx('shield', pan); hud?.banner(t('banner.netCut'), 'small good'); break;
      case 'bossDead': a.sfx('bossDead'); if (s.spec.biome === 'ice') this.award('boss1'); break;
      case 'sink': a.sfx('sink'); hud?.banner(t('banner.sunk'), 'bad'); break;
      case 'tutorialStep': a.sfx('delivered'); hud?.setTutorial(t('tut.' + e.step)); break;
      case 'end': if (e.status === 'won') a.sfx('win'); else if (e.status === 'timeout') a.sfx('lose'); break;
      default: break;
    }
  }

  /** Spell out what a lost plank means the first time it happens, and warn on the last one. */
  private onPlankLost(s: LegState) {
    const hud = this.hud;
    if (!hud || s.player.planks <= 0) return;
    if (s.player.planks === 1 && s.player.maxPlanks > 1) hud.banner(t('banner.lastPlank'), 'small bad');
    if (!this.profile.hullHintShown && !s.tutorial && !isClassic(s)) {
      this.profile.hullHintShown = true;
      this.save();
      hud.setTutorial(t('hud.hullHint'));
      setTimeout(() => { if (this.hud === hud) hud.setTutorial(null); }, 7000);
    }
  }

  pause() {
    if (!this.inLeg || this.paused) return;
    this.paused = true;
    this.game.scene.pause('leg');
    this.audio.setMuffle(0.9);
    this.setScreen('pause', () => pauseScreen(this));
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.input.arm();
    this.setScreen('leg', null);
    this.audio.setMuffle(0);
    this.game.scene.resume('leg');
  }

  quitLeg() {
    // Quitting mid-leg forfeits the leg but keeps a saved voyage where it was.
    if (this.debugSpec) { this.debugSpec = null; this.run = null; }
    this.transition(() => this.showTitle());
  }

  private medal(s: LegState): 'gold' | 'silver' | 'bronze' | null {
    if (s.status !== 'won' || s.spec.kind === 'tutorial') return null;
    if (s.spec.kind === 'boss') return s.tally.planksLost === 0 ? 'gold' : s.tally.planksLost === 1 ? 'silver' : 'bronze';
    const ratio = s.score / s.baseScore;
    return ratio >= 20 ? 'gold' : ratio >= 11 ? 'silver' : ratio >= 5 ? 'bronze' : null;
  }

  private onLegEnd(s: LegState) {
    const run = this.run!;
    this.game.scene.pause('leg');
    this.audio.setMuffle(0.6);

    if (this.debugSpec) {
      const outcome: LegOutcome = { advanced: false, sunk: s.status === 'lost', newCrew: [], biomeCleared: false, runOver: true, won: false, doubloons: s.tally.doubloons, pearls: s.tally.pearls, karma: s.tally.karma };
      this.setScreen('tally', () => tallyScreen(this, { s, outcome, medal: this.medal(s), title: s.status === 'lost' ? t('tally.sunk') : t('tally.won'), onContinue: () => { this.debugSpec = null; this.showTitle(); } }));
      return;
    }

    const wasTutorial = run.tutorial;
    const outcome = applyLeg(run, s, this.node);
    this.lastOutcome = outcome;
    const log = this.profile.log;
    if (outcome.light && !log.captains.includes(outcome.light)) log.captains.push(outcome.light);
    if (outcome.letter !== undefined && !log.letters.includes(outcome.letter)) log.letters.push(outcome.letter);
    if (wasTutorial) {
      if (s.status !== 'won') { this.transition(() => this.startLeg()); return; }
      this.profile.tutorialDone = true; this.save();
      this.transition(() => { if (this.standaloneTutorial) this.showTitle(); else this.showChart(); });
      return;
    }

    // Achievements.
    if (run.stats.gentleLegs >= 5) this.award('gentle');
    if (run.stats.nearMisses >= 10) this.award('closeshave');
    if (s.status === 'won' && s.player.oil <= 0 && !isClassic(s)) this.award('lightsout');
    if (run.mode === 'endless' && run.depth >= 10) this.award('nightwatch');
    if (run.karma >= 6) this.award('karma');
    if (run.over && run.won) {
      if (run.mode === 'classic') this.award('oldsalt');
      else { this.award('marshmallow'); this.profile.marshmallow = true; this.profile.wins++; }
      if (run.mode === 'daily') this.award('daily');
      if (run.mode !== 'classic' && run.sea === 2) this.award('stormy');
    }
    if (this.profile.log.letters.length >= 5) this.award('penpal');
    // A sunk voyage is kept at the start of its current sea, so "Continue Voyage" restarts the chapter rather than the whole game.
    if (run.mode === 'voyage') this.profile.run = !run.over ? run : canRetry(run) ? restoreCheckpoint(run) : null;
    this.save();

    const boss = s.spec.kind === 'boss';
    const title = s.status === 'lost' ? t('tally.sunk')
      : s.status === 'timeout' ? t('tally.timeout')
      : boss ? t('tally.bossWon', { boss: t('boss.' + BIOMES[s.spec.biome].boss) })
      : run.mode === 'classic' ? t('tally.level', { n: s.spec.classicLevel ?? 1 }) : t('tally.won');
    this.setScreen('tally', () => tallyScreen(this, {
      s, outcome, medal: this.medal(s), title,
      note: boss && s.status === 'won' && !run.over ? t('tally.repair') : undefined,
      onContinue: () => this.afterTally(),
    }));
  }

  private afterTally() {
    const run = this.run!;
    const go = () => this.transition(() => {
      if (run.over) this.endRun();
      else if (run.mode === 'voyage' || run.mode === 'daily') this.showChart();
      else if (run.mode === 'endless' && run.depth % 3 === 0) {
        // Every third leg of the Night Watch a harbour lamp appears: repair and refit.
        this.backdrop();
        this.audio.music('harbour');
        this.setScreen('harbour', () => harbourScreen(this));
      } else this.startLeg();
    });
    // A beaten captain gives back the light they stole (and a clue).
    const light = this.lastOutcome?.light;
    this.playStory(light ? bossOutroScene(run, light) : null, go);
  }

  private endRun() {
    const run = this.run!;
    this.backdrop(run.won && run.mode !== 'classic');
    this.audio.music(run.won ? 'harbour' : 'title');
    this.audio.setMuffle(0);
    const mode = run.mode;
    const a = this.profile.settings.assist;
    const assisted = a.extraPlanks > 0 || a.lantern !== 1 || a.speed !== 1;
    const data: OverData = {
      run,
      qualifies: qualifies(this.profile, mode, run.score, run.lunar),
      onSave: (name: string) => {
        this.profile.lastName = name;
        const place = mode === 'daily' ? run.dateKey : mode === 'endless' ? `${run.depth}` : run.won ? '★' : `${t('biome.' + biomeOf(run))}`;
        const where = run.retries > 0 ? `${place} · ↻${run.retries}` : place;
        const note = mode === 'classic' ? where : `${where} · ${t('sea.' + run.sea)}`;
        const i = addScore(this.profile, mode, { name, score: run.score, date: new Date().toISOString(), lunar: run.lunar, assist: assisted, note });
        if (mode === 'daily') this.profile.dailyBest[run.dateKey] = Math.max(this.profile.dailyBest[run.dateKey] ?? -Infinity, run.score);
        this.save();
        this.run = null;
        this.openScores(mode, i, () => this.showTitle());
      },
      onAgain: () => this.startRun(mode),
      // Sunk on a voyage: sail again from the start of this sea, or end the voyage here and bank the score.
      onRetry: canRetry(run) ? () => {
        const again = restoreCheckpoint(run);
        if (!again) return;
        this.run = again;
        this.profile.run = again; this.save();
        this.transition(() => this.showChart());
      } : undefined,
      onEnd: () => {
        this.profile.run = null; this.save();
        const ended = { ...data, onRetry: undefined };
        this.setScreen('over', () => overScreen(this, ended));
      },
    };
    if (run.won) { this.sfx('win'); this.setScreen('ending', () => endingScreen(this, data)); }
    else { this.sfx('lose'); this.setScreen('over', () => overScreen(this, data)); }
  }
}
