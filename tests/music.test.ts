import { afterEach, describe, expect, it, vi } from 'vitest';
import { Music } from '../src/audio/music';
import {
  chordTones,
  composeSong,
  guideTones,
  mod12,
  parseChord,
  RANGES,
  scaleOf,
  songSeconds,
  swingTime,
  targetTones,
  voiceChord,
  type Song,
} from '../src/audio/theory';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

function chordAt(song: Song, t: number) {
  return song.beats[Math.min(song.beats.length - 1, Math.floor(t + 1e-9))];
}

describe('chords', () => {
  it('spells chord tones for common symbols', () => {
    expect(chordTones('Cmaj7')).toEqual([0, 4, 7, 11]);
    expect(chordTones('Dm7')).toEqual([2, 5, 9, 0]);
    expect(chordTones('G7')).toEqual([7, 11, 2, 5]);
    expect(chordTones('F#m7b5')).toEqual([6, 9, 0, 4]);
    expect(chordTones('Bb7b9')).toEqual([10, 2, 5, 8]);
    expect(chordTones('Ebdim7')).toEqual([3, 6, 9, 0]);
    expect(chordTones('A13sus4')).toEqual([9, 2, 4, 7]);
    expect(guideTones('G13')).toEqual([11, 5]);
    expect(targetTones('Cmaj9')).toContain(2);
  });

  it('rejects unknown symbols', () => {
    expect(() => parseChord('H7')).toThrow();
    expect(() => parseChord('Cxyz')).toThrow();
  });

  it('builds scales that contain the chord tones', () => {
    for (const s of ['Cmaj7', 'Dm9', 'G13', 'E7b9', 'Bm7b5', 'C#dim7', 'F6', 'Gm6', 'D7sus4']) {
      const scale = scaleOf(s);
      for (const pc of targetTones(s)) expect(scale).toContain(pc);
    }
  });

  it('voices chords with their guide tones inside the keys range', () => {
    let prev: number[] | null = null;
    for (const s of ['Dm7', 'G7', 'Cmaj7', 'A7b9', 'Dm9', 'Db7', 'Cmaj9', 'F#m7b5', 'B7b9', 'Em7']) {
      const v = voiceChord(parseChord(s), prev);
      expect(v).toHaveLength(4);
      for (const m of v) {
        expect(m).toBeGreaterThanOrEqual(RANGES.keys.lo);
        expect(m).toBeLessThanOrEqual(RANGES.keys.hi);
      }
      const pcs = v.map(mod12);
      for (const g of guideTones(s)) expect(pcs).toContain(g);
      if (prev) expect(v.reduce((sum, m, i) => sum + Math.abs(m - prev![i]), 0)).toBeLessThanOrEqual(14);
      prev = v;
    }
  });

  it('swings off-beat eighths only', () => {
    expect(swingTime(2.5, 0.64)).toBeCloseTo(2.64);
    expect(swingTime(3, 0.64)).toBe(3);
    expect(swingTime(1 + 1 / 3, 0.64)).toBeCloseTo(1 + 1 / 3);
  });
});

describe('songs', () => {
  it('are deterministic per seed', () => {
    for (const seed of SEEDS.slice(0, 6)) expect(JSON.stringify(composeSong(seed))).toBe(JSON.stringify(composeSong(seed)));
    expect(composeSong(1).lead).not.toEqual(composeSong(2).lead);
  });

  it('last about two to three minutes and use several forms and feels', () => {
    const forms = new Set<string>();
    const feels = new Set<string>();
    for (const seed of SEEDS) {
      const song = composeSong(seed);
      forms.add(song.form);
      feels.add(song.feel);
      expect(songSeconds(song)).toBeGreaterThan(100);
      expect(songSeconds(song)).toBeLessThan(200);
      expect(song.bpm).toBeGreaterThanOrEqual(70);
      expect(song.bpm).toBeLessThanOrEqual(140);
    }
    expect(forms.size).toBeGreaterThanOrEqual(5);
    expect(feels.size).toBe(4);
  });

  it('keeps every part in range and sorted', () => {
    for (const seed of SEEDS) {
      const song = composeSong(seed);
      const lead = RANGES[song.leadVoice];
      for (const n of song.lead) expect(n.m >= lead.lo && n.m <= lead.hi).toBe(true);
      for (const n of song.bass) expect(n.m >= RANGES.bass.lo && n.m <= RANGES.bass.hi).toBe(true);
      for (const n of song.keys) expect(n.m >= RANGES.keys.lo && n.m <= RANGES.keys.hi).toBe(true);
      for (const list of [song.lead, song.bass, song.keys, song.drums]) {
        for (let i = 1; i < list.length; i++) expect(list[i].t).toBeGreaterThanOrEqual(list[i - 1].t);
        for (const e of list) expect(e.t).toBeLessThan(song.lengthBeats);
      }
    }
  });

  it('fits the melody to the chords', () => {
    for (const seed of SEEDS) {
      const song = composeSong(seed);
      for (let i = 0; i < song.lead.length; i++) {
        const n = song.lead[i];
        if (n.approach) {
          // a chromatic approach note resolves by a half step into the next note
          expect(Math.abs(song.lead[i + 1].m - n.m)).toBe(1);
          continue;
        }
        const ch = chordAt(song, n.t);
        expect(scaleOf(ch)).toContain(mod12(n.m));
        const onStrongBeat = Math.abs(n.t - Math.round(n.t)) < 1e-6 && Math.round(n.t) % 2 === 0;
        if (onStrongBeat) expect(targetTones(ch)).toContain(mod12(n.m));
      }
    }
  });

  it('repeats the theme in the first and last chorus, with rests between phrases', () => {
    for (const seed of SEEDS) {
      const song = composeSong(seed);
      const first = song.choruses[0];
      const last = song.choruses[song.choruses.length - 1];
      expect(first.part).toBe('head');
      expect(last.part).toBe('head');
      const chorusBeats = (song.choruses[1].bar - first.bar) * 4;
      const slice = (bar: number) =>
        song.lead.filter((n) => n.t >= bar * 4 && n.t < bar * 4 + chorusBeats).map((n) => [Math.round((n.t - bar * 4) * 100), n.m]);
      const a = slice(first.bar);
      expect(a.length).toBeGreaterThan(8);
      expect(slice(last.bar)).toEqual(a);
      // phrasing: the lead is silent for a good part of the theme
      let silent = 0;
      for (let b = 0; b < chorusBeats; b++) {
        const t = first.bar * 4 + b + 0.25;
        if (!song.lead.some((n) => n.t <= t && n.t + n.d > t)) silent++;
      }
      expect(silent / chorusBeats).toBeGreaterThan(0.12);
    }
  });

  it('plays the root in the bass on every chord change and voices the right chords', () => {
    for (const seed of SEEDS) {
      const song = composeSong(seed);
      for (let b = 0; b < song.beats.length; b++) {
        if (b > 0 && song.beats[b].symbol === song.beats[b - 1].symbol) continue;
        const hit = song.bass.find((n) => Math.abs(n.t - b) < 1e-6);
        expect(hit, `bass at beat ${b} (${song.form})`).toBeDefined();
        expect(mod12(hit!.m)).toBe(song.beats[b].root);
      }
      const groups = new Map<number, typeof song.keys>();
      for (const n of song.keys) groups.set(n.t, [...(groups.get(n.t) ?? []), n]);
      for (const g of groups.values()) {
        const pcs = g.map((n) => mod12(n.m));
        for (const gt of guideTones(g[0].chord!)) expect(pcs).toContain(gt);
      }
    }
  });
});

// ------------------------------------------------- engine on a fake audio clock

class FakeParam {
  value = 0;
  private check(v: number, t: number): this {
    if (!Number.isFinite(v) || !Number.isFinite(t) || t < 0) throw new Error(`bad automation ${v} @ ${t}`);
    return this;
  }
  setValueAtTime(v: number, t: number) {
    return this.check(v, t);
  }
  linearRampToValueAtTime(v: number, t: number) {
    return this.check(v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (v <= 0) throw new RangeError('exponential ramp to a non-positive value');
    return this.check(v, t);
  }
  setTargetAtTime(v: number, t: number, tau: number) {
    if (tau <= 0) throw new RangeError('bad time constant');
    return this.check(v, t);
  }
  cancelScheduledValues(t: number) {
    return this.check(0, t);
  }
}

class FakeNode {
  constructor(protected ctx: FakeContext) {}
  connect<T>(n: T): T {
    return n;
  }
}

class FakeSource extends FakeNode {
  frequency = new FakeParam();
  type = 'sine';
  buffer: unknown = null;
  private startedAt = -1;
  start(when = 0) {
    // 0 means "now" in WebAudio
    const t = when || this.ctx.currentTime;
    if (t < this.ctx.currentTime - 0.05) throw new Error(`start in the past: ${t} < ${this.ctx.currentTime}`);
    this.startedAt = t;
    this.ctx.started++;
  }
  stop(t: number) {
    if (t < this.startedAt) throw new Error('stop before start');
  }
}

class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  started = 0;
  destination = new FakeNode(this);
  createGain() {
    return Object.assign(new FakeNode(this), { gain: new FakeParam() });
  }
  createOscillator() {
    return new FakeSource(this);
  }
  createBufferSource() {
    return new FakeSource(this);
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(this), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
  }
  createDelay() {
    return Object.assign(new FakeNode(this), { delayTime: new FakeParam() });
  }
  createStereoPanner() {
    return Object.assign(new FakeNode(this), { pan: new FakeParam() });
  }
  createDynamicsCompressor() {
    const p = () => new FakeParam();
    return Object.assign(new FakeNode(this), { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() });
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume() {
    return Promise.resolve();
  }
}

describe('music engine', () => {
  afterEach(() => vi.useRealTimers());

  it('plays songs back to back on the audio clock and stops when muted', () => {
    vi.useFakeTimers();
    const ctx = new FakeContext();
    const music = new Music(() => ctx as unknown as AudioContext);
    const step = (seconds: number) => {
      for (let s = 0; s < seconds * 40; s++) {
        ctx.currentTime += 0.025;
        vi.advanceTimersByTime(25);
      }
    };
    step(1);
    expect(ctx.started).toBe(0); // nothing before a user gesture
    music.unlock();
    step(2);
    const first = music.title;
    expect(first).toBeTruthy();
    expect(ctx.started).toBeGreaterThan(20);
    // mute pauses scheduling; unmute continues the same song
    music.setMuted(true);
    const paused = ctx.started;
    step(3);
    expect(ctx.started).toBe(paused);
    music.setMuted(false);
    step(1);
    expect(ctx.started).toBeGreaterThan(paused);
    expect(music.title).toBe(first);
    // the next song follows after the first one ends
    step(240);
    expect((music as unknown as { count: number }).count).toBeGreaterThanOrEqual(2);
    expect(music.title).toBeTruthy();
  });
});
