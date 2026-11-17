/**
 * All sound is synthesised with WebAudio: no audio files, nothing borrowed.
 * Music is a tiny step sequencer playing a lilting 6/8 shanty motif that is re-keyed per biome,
 * with layers that fade in with the combo and muffle when the lantern runs low.
 */
export type TrackId = 'title' | 'lunar' | 'ice' | 'swamp' | 'crystal' | 'reef' | 'deep' | 'boss' | 'harbour' | 'classic';

interface Track { root: number; scale: number[]; tempo: number; chords: number[]; wave: OscillatorType; lead: OscillatorType; swing?: boolean }

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];

const TRACKS: Record<TrackId, Track> = {
  title:   { root: 50, scale: DORIAN, tempo: 96,  chords: [0, 5, 3, 4], wave: 'triangle', lead: 'triangle' },
  lunar:   { root: 50, scale: PHRYG,  tempo: 132, chords: [0, 1, 5, 4], wave: 'sawtooth', lead: 'square' },
  ice:     { root: 52, scale: LYDIAN, tempo: 104, chords: [0, 4, 5, 3], wave: 'sine',     lead: 'triangle' },
  swamp:   { root: 48, scale: DORIAN, tempo: 92,  chords: [0, 3, 6, 4], wave: 'triangle', lead: 'square' },
  crystal: { root: 53, scale: MAJOR,  tempo: 112, chords: [0, 5, 3, 4], wave: 'triangle', lead: 'triangle' },
  reef:    { root: 55, scale: MAJOR,  tempo: 108, chords: [0, 3, 4, 5], wave: 'sine',     lead: 'triangle' },
  deep:    { root: 47, scale: MINOR,  tempo: 88,  chords: [0, 5, 2, 4], wave: 'sine',     lead: 'sine' },
  boss:    { root: 45, scale: MINOR,  tempo: 138, chords: [0, 0, 5, 4], wave: 'sawtooth', lead: 'square' },
  harbour: { root: 55, scale: MAJOR,  tempo: 84,  chords: [0, 3, 0, 4], wave: 'triangle', lead: 'triangle' },
  classic: { root: 57, scale: MAJOR,  tempo: 120, chords: [0, 3, 4, 0], wave: 'square',   lead: 'square' },
};

// Four bars of twelve steps (6/8 felt in two). Scale degrees, -1 = rest.
const MOTIF = [
  [0, -1, 2, 4, -1, 2, 5, -1, 4, 2, -1, 0],
  [1, -1, 2, 4, -1, 5, 4, -1, -1, 2, -1, -1],
  [7, -1, 5, 4, -1, 2, 4, -1, 5, 7, -1, 5],
  [4, -1, 2, 1, -1, 2, 0, -1, -1, -1, -1, -1],
];
const MOTIF_B = [
  [4, -1, 4, 5, -1, 7, 9, -1, 7, 5, -1, 4],
  [5, -1, 4, 2, -1, 4, 5, -1, -1, 4, -1, 2],
  [0, -1, 2, 4, -1, 5, 7, -1, 5, 4, -1, 2],
  [1, -1, 2, 1, -1, -1, 0, -1, -1, -1, -1, -1],
];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private track: TrackId | null = null;
  private wanted: TrackId | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private stepI = 0;
  private intensity = 0;
  private vol = { music: 0.6, sfx: 0.8 };
  private last: Record<string, number> = {};

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(c.destination);
    this.musicBus = c.createGain();
    this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 9000;
    this.musicBus.connect(this.musicFilter); this.musicFilter.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.setVolumes(this.vol.music, this.vol.sfx);
    if (this.wanted) { const w = this.wanted; this.track = null; this.music(w); }
  }

  setVolumes(music: number, sfx: number) {
    this.vol = { music, sfx };
    if (!this.ctx) return;
    this.musicBus.gain.value = music * 0.5;
    this.sfxBus.gain.value = sfx;
  }

  suspend(on: boolean) { if (this.ctx) void (on ? this.ctx.suspend() : this.ctx.resume()); }

  // ------------------------------------------------------------------ primitives

  private tone(bus: AudioNode, f: number, dur: number, type: OscillatorType, vol: number, opts: { to?: number; at?: number; attack?: number; pan?: number; vib?: number } = {}) {
    const c = this.ctx!;
    const t0 = (opts.at ?? c.currentTime) + 0.001;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
    if (opts.vib) { const l = c.createOscillator(); const lg = c.createGain(); l.frequency.value = opts.vib; lg.gain.value = f * 0.06; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    const g = c.createGain();
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    this.out(g, bus, opts.pan);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  private noise(bus: AudioNode, dur: number, vol: number, freq: number, opts: { type?: BiquadFilterType; to?: number; at?: number; q?: number; pan?: number; attack?: number } = {}) {
    const c = this.ctx!;
    const t0 = (opts.at ?? c.currentTime) + 0.001;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = opts.type ?? 'lowpass'; f.Q.value = opts.q ?? 0.8;
    f.frequency.setValueAtTime(freq, t0);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + (opts.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g);
    this.out(g, bus, opts.pan);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  }

  private out(node: AudioNode, bus: AudioNode, pan?: number) {
    const c = this.ctx!;
    if (pan !== undefined && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); p.connect(bus); }
    else node.connect(bus);
  }

  // ------------------------------------------------------------------ sound effects

  /** Play a named effect. `pan` -1..1 places it left/right; `k` is a free parameter (combo level etc.). */
  sfx(name: string, pan = 0, k = 1) {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    // Avoid machine-gunning the same sound.
    const now = c.currentTime;
    if (now - (this.last[name] ?? -1) < 0.04) return;
    this.last[name] = now;
    const b = this.sfxBus;
    const T = (f: number, d: number, ty: OscillatorType, v: number, o: Parameters<AudioEngine['tone']>[5] = {}) => this.tone(b, f, d, ty, v, { pan, ...o });
    const N = (d: number, v: number, f: number, o: Parameters<AudioEngine['noise']>[4] = {}) => this.noise(b, d, v, f, { pan, ...o });
    switch (name) {
      case 'ram': N(0.16, 0.5, 1400, { to: 300 }); T(130, 0.18, 'sine', 0.5, { to: 55 }); break;
      case 'kill': N(0.3, 0.55, 2400, { to: 250 }); T(150, 0.28, 'sine', 0.6, { to: 45 }); N(0.12, 0.3, 4000, { type: 'highpass', at: now + 0.03 }); T(880 * (1 + k * 0.06), 0.12, 'triangle', 0.16, { at: now + 0.08 }); T(1320 * (1 + k * 0.06), 0.16, 'triangle', 0.14, { at: now + 0.14 }); break;
      case 'clang': T(820, 0.3, 'square', 0.14); T(1237, 0.26, 'square', 0.1); T(2210, 0.18, 'triangle', 0.08); break;
      case 'bump': T(160, 0.08, 'sine', 0.2, { to: 90 }); break;
      case 'bonk': T(320, 0.16, 'sine', 0.45, { to: 140 }); T(900, 0.2, 'sawtooth', 0.12, { to: 1500, at: now + 0.06 }); break;
      case 'monster': T(196, 0.5, 'sawtooth', 0.2, { to: 98 }); T(147, 0.7, 'sawtooth', 0.2, { to: 73, at: now + 0.2 }); break;
      case 'hazard': N(0.35, 0.7, 1800, { to: 180 }); T(90, 0.35, 'sine', 0.7, { to: 38 }); break;
      case 'hurt': N(0.3, 0.6, 2200, { to: 200 }); T(220, 0.3, 'square', 0.18, { to: 80 }); break;
      case 'boost': N(0.35, 0.3, 500, { type: 'bandpass', to: 2600, q: 1.4 }); break;
      case 'flare': N(0.7, 0.3, 800, { type: 'bandpass', to: 6000, q: 2 }); T(660, 0.6, 'triangle', 0.14, { to: 1760 }); T(990, 0.7, 'sine', 0.1, { to: 2640, at: now + 0.05 }); break;
      case 'bark': T(520, 0.14, 'sawtooth', 0.3, { to: 360 }); T(560, 0.16, 'sawtooth', 0.3, { to: 340, at: now + 0.2 }); break;
      case 'barrel': T(300, 0.1, 'sine', 0.3, { to: 520 }); T(380, 0.12, 'sine', 0.3, { to: 660, at: now + 0.1 }); break;
      case 'firefly': T(1400, 0.12, 'sine', 0.16); T(1870, 0.18, 'sine', 0.14, { at: now + 0.07 }); break;
      case 'plank': T(240, 0.07, 'square', 0.2); T(360, 0.1, 'square', 0.2, { at: now + 0.08 }); break;
      case 'cannon': N(0.25, 0.4, 500, { to: 90 }); T(80, 0.22, 'sine', 0.4, { to: 40 }); break;
      case 'splash': N(0.4, 0.3, 1500, { type: 'bandpass', to: 500, q: 0.7 }); break;
      case 'notice': T(700, 0.07, 'square', 0.12); T(1050, 0.1, 'square', 0.12, { at: now + 0.08 }); break;
      case 'creak': T(92, 0.5, 'sawtooth', 0.22, { to: 70, vib: 9 }); T(138, 0.4, 'sawtooth', 0.1, { to: 110, vib: 13, at: now + 0.1 }); break;
      case 'spawn': T(240, 0.25, 'sine', 0.12, { to: 420 }); break;
      case 'combo': T(mtof(64 + k * 3), 0.1, 'triangle', 0.22); T(mtof(71 + k * 3), 0.16, 'triangle', 0.2, { at: now + 0.07 }); break;
      case 'comboLost': T(300, 0.2, 'triangle', 0.1, { to: 180 }); break;
      case 'near': N(0.16, 0.16, 3000, { type: 'bandpass', to: 900, q: 3 }); T(1200, 0.08, 'sine', 0.08); break;
      case 'freed': T(660, 0.1, 'triangle', 0.2); T(880, 0.14, 'triangle', 0.2, { at: now + 0.09 }); break;
      case 'tow': T(520, 0.08, 'sine', 0.2, { to: 780 }); break;
      case 'delivered': [0, 4, 7, 12].forEach((s, i) => T(mtof(72 + s), 0.25, 'triangle', 0.2, { at: now + i * 0.07 })); break;
      case 'netCatch': T(400, 0.2, 'square', 0.12, { to: 200 }); break;
      case 'pingo': T(900, 0.08, 'sawtooth', 0.12, { to: 1400 }); break;
      case 'zabica': T(110, 0.14, 'square', 0.16, { vib: 30 }); break;
      case 'ribica': T(420, 0.1, 'sine', 0.18, { to: 220 }); break;
      case 'marshmallow': T(540, 0.12, 'sawtooth', 0.22, { to: 380 }); break;
      case 'turtle': T(180, 0.16, 'sine', 0.18, { to: 140 }); break;
      case 'hop': T(300, 0.12, 'sine', 0.14, { to: 620 }); break;
      case 'floe': N(0.18, 0.3, 2400, { type: 'bandpass', q: 2 }); T(500, 0.1, 'sine', 0.14, { to: 300 }); break;
      case 'assist': N(0.3, 0.5, 3000, { to: 400 }); T(1047, 0.2, 'triangle', 0.2, { at: now + 0.05 }); T(1568, 0.25, 'triangle', 0.2, { at: now + 0.13 }); break;
      case 'beam': T(1800, 0.25, 'sine', 0.12, { to: 900 }); T(2400, 0.2, 'triangle', 0.08, { to: 1200 }); break;
      case 'thunder': N(1.6, 0.7, 300, { to: 60, attack: 0.02 }); N(0.2, 0.4, 4000, { type: 'highpass' }); break;
      case 'aurora': [0, 7, 12, 16].forEach((s, i) => T(mtof(76 + s), 0.9, 'sine', 0.07, { at: now + i * 0.12, attack: 0.1 })); break;
      case 'tide': N(1.2, 0.2, 600, { type: 'bandpass', to: 1500, q: 0.6, attack: 0.3 }); break;
      case 'sonar': T(1200, 0.5, 'sine', 0.16, { to: 1150 }); break;
      case 'bossHit': N(0.4, 0.7, 2600, { to: 200 }); T(110, 0.4, 'sawtooth', 0.4, { to: 40 }); break;
      case 'bossStun': N(0.6, 0.6, 1200, { to: 150 }); T(70, 0.6, 'sine', 0.6, { to: 35 }); break;
      case 'shield': T(1500, 0.5, 'triangle', 0.2, { to: 300 }); N(0.4, 0.3, 5000, { type: 'highpass' }); break;
      case 'bossDead': N(1.4, 0.7, 2000, { to: 80 }); [0, -3, -7, -12].forEach((s, i) => T(mtof(57 + s), 0.5, 'sawtooth', 0.2, { at: now + i * 0.18 })); break;
      case 'sink': T(300, 1.1, 'sawtooth', 0.22, { to: 50 }); N(1.0, 0.4, 900, { to: 120 }); break;
      case 'tick': T(1000, 0.04, 'square', 0.1); break;
      case 'click': T(640, 0.05, 'triangle', 0.16); break;
      case 'hover': T(880, 0.025, 'sine', 0.05); break;
      case 'buy': T(784, 0.08, 'triangle', 0.2); T(1175, 0.16, 'triangle', 0.2, { at: now + 0.07 }); break;
      case 'deny': T(180, 0.14, 'square', 0.12); break;
      case 'win': [0, 4, 7, 12, 16].forEach((s, i) => T(mtof(67 + s), 0.4, 'triangle', 0.22, { at: now + i * 0.11 })); break;
      case 'lose': [0, -2, -5, -9].forEach((s, i) => T(mtof(62 + s), 0.5, 'triangle', 0.2, { at: now + i * 0.2 })); break;
      case 'moon': [0, 6, 12, 18].forEach((s, i) => T(mtof(69 + s), 0.6, 'sine', 0.16, { at: now + i * 0.1, vib: 6 })); break;
      case 'castoff': T(196, 0.5, 'sawtooth', 0.14, { attack: 0.08 }); T(294, 0.6, 'sawtooth', 0.1, { attack: 0.08, at: now + 0.04 }); break;
      case 'count': T(mtof(60 + k), 0.06, 'triangle', 0.14); break;
      case 'beacon': [0, 5, 9, 14].forEach((s, i) => T(mtof(74 + s), 0.5, 'triangle', 0.18, { at: now + i * 0.06 })); break;
      case 'beaconOut': T(520, 0.5, 'triangle', 0.18, { to: 180 }); N(0.4, 0.2, 2000, { to: 300 }); break;
      case 'type': T(260 + k * 55, 0.035, 'triangle', 0.05); break;
      case 'fuse': N(0.5, 0.12, 5000, { type: 'highpass' }); T(900, 0.06, 'square', 0.06); break;
      case 'boom': N(0.5, 0.8, 1600, { to: 80 }); T(70, 0.5, 'sine', 0.7, { to: 30 }); N(0.15, 0.4, 5000, { type: 'highpass' }); break;
      case 'bottle': [0, 7, 12].forEach((s, i) => T(mtof(79 + s), 0.3, 'sine', 0.14, { at: now + i * 0.08 })); break;
      case 'page': N(0.12, 0.1, 3000, { type: 'bandpass', q: 1 }); break;
      case 'medal': T(1320, 0.3, 'triangle', 0.2); T(1760, 0.5, 'triangle', 0.2, { at: now + 0.1 }); break;
    }
  }

  // ------------------------------------------------------------------ music

  music(id: TrackId | null) {
    this.wanted = id;
    if (!this.ctx || id === this.track) return;
    this.track = id;
    this.stepI = 0;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (!id) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 30);
  }

  /** 0..1: how heated the action is (combo). Brings in percussion and the counter-melody. */
  setIntensity(v: number) { this.intensity += (Math.max(0, Math.min(1, v)) - this.intensity) * 0.08; }

  /** 0..1: muffles the music as the lantern runs dry. */
  setMuffle(v: number) {
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(9000 - 8200 * Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.4);
  }

  private schedule() {
    const c = this.ctx;
    if (!c || !this.track || c.state !== 'running') return;
    const tr = TRACKS[this.track];
    const stepDur = 60 / tr.tempo / 3; // three steps per beat (6/8 feel)
    while (this.nextTime < c.currentTime + 0.14) {
      this.playStep(tr, this.stepI, this.nextTime, stepDur);
      this.stepI++;
      this.nextTime += stepDur;
    }
  }

  private deg(tr: Track, d: number, oct = 0): number {
    const n = tr.scale.length;
    const o = Math.floor(d / n);
    return mtof(tr.root + tr.scale[((d % n) + n) % n] + 12 * (o + oct));
  }

  private playStep(tr: Track, i: number, t: number, sd: number) {
    const bus = this.musicBus;
    const bar = Math.floor(i / 12) % 8;
    const st = i % 12;
    const chord = tr.chords[bar % 4];
    const motif = bar < 4 ? MOTIF : MOTIF_B;
    const boss = this.track === 'boss';
    const hot = this.intensity;

    // Pad: root + third + fifth, re-struck each bar.
    if (st === 0) for (const d of [0, 2, 4]) this.tone(bus, this.deg(tr, chord + d, 0), sd * 12, tr.wave, tr.wave === 'sawtooth' ? 0.035 : 0.07, { at: t, attack: 0.25 });
    // Bass on the two big beats.
    if (st === 0 || st === 6) this.tone(bus, this.deg(tr, chord, -1), sd * 5, 'sine', 0.2, { at: t });
    if (boss && st % 3 === 0) this.tone(bus, this.deg(tr, chord, -1), sd * 1.5, 'sawtooth', 0.06, { at: t });
    // Lead melody.
    const note = motif[bar % 4][st];
    if (note >= 0) this.tone(bus, this.deg(tr, note, 1), sd * 2.2, tr.lead, tr.lead === 'square' ? 0.045 : 0.1, { at: t, attack: 0.012 });
    // Counter-melody arpeggio joins as things heat up.
    if (hot > 0.3 && st % 2 === 0) this.tone(bus, this.deg(tr, chord + [0, 2, 4, 7, 4, 2][(st / 2) % 6], 2), sd * 1.4, 'triangle', 0.04 * hot, { at: t });
    // Percussion: always a soft pulse, more with intensity.
    const perc = boss || this.track === 'lunar' ? Math.max(hot, 0.7) : hot;
    if (st === 0 || st === 6) { this.tone(bus, 110, 0.16, 'sine', 0.1 + 0.25 * perc, { at: t, to: 45 }); }
    if (perc > 0.2 && (st === 3 || st === 9)) this.noise(bus, 0.09, 0.12 * perc, 3000, { type: 'highpass', at: t });
    if (perc > 0.5 && st % 3 !== 0) this.noise(bus, 0.03, 0.05 * perc, 7000, { type: 'highpass', at: t });
  }
}
