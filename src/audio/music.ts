/**
 * Procedural lounge-jazz soundtrack. Songs come from theory.ts; this file
 * plays them on WebAudio with small synthesised instruments (electric piano,
 * upright bass, vibraphone or muted trumpet, brushes and cymbals) and a
 * lookahead scheduler on the audio clock. No audio assets.
 */
import { hash3 } from '../util/rng';
import { composeSong, midiToFreq, type DrumKind, type Hit, type Note, type Song } from './theory';

/** Scheduler interval (ms) and how far ahead notes are scheduled (s). */
const TICK_MS = 25;
const LOOKAHEAD = 0.18;
/** Silence between songs (s). */
const SONG_GAP = 3;
/** Output level at volume 1, so the music sits under the sound effects. */
const LEVEL = 0.75;

type Track = 'lead' | 'bass' | 'keys' | 'drums';
const TRACKS: Track[] = ['lead', 'bass', 'keys', 'drums'];

interface Graph {
  out: GainNode;
  keys: GainNode;
  lead: GainNode;
  bass: GainNode;
  /** Drum buses: hats left, kit centre, cymbals right. */
  hatBus: GainNode;
  kitBus: GainNode;
  cymBus: GainNode;
  /** Depth of the vibraphone motor tremolo (0 for the trumpet). */
  leadTremolo: GainNode;
  noise: AudioBuffer;
}

export class Music {
  private ctx: AudioContext | null = null;
  private g: Graph | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private song: Song | null = null;
  private count = 0;
  private readonly seedBase = Math.floor(Math.random() * 0x7fffffff);
  /** Audio time of beat 0 of the current song. */
  private origin = 0;
  /** Beat where playback paused. */
  private pausedAt = 0;
  private cursor: Record<Track, number> = { lead: 0, bass: 0, keys: 0, drums: 0 };
  /** Audio time when the next song starts (-1 while a song plays). */
  private nextSongAt = -1;
  private unlocked = false;
  private enabled = true;
  private muted = false;
  private volume = 0.35;
  private playing = false;

  constructor(private readonly getContext: () => AudioContext | null) {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.update());
  }

  /** Title of the song that plays now, if any. */
  get title(): string | null {
    return this.playing && this.song && this.nextSongAt < 0 ? this.song.title : null;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.update();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.update();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.g && this.playing) this.g.out.gain.setTargetAtTime(this.volume * LEVEL, this.ctx.currentTime, 0.05);
    this.update();
  }

  /** Call from a user gesture: browsers only start audio after one. */
  unlock(): void {
    this.unlocked = true;
    const ctx = this.getContext();
    if (ctx?.state === 'suspended') void ctx.resume();
    this.update();
  }

  /** Skip to the next song. */
  next(): void {
    if (!this.ctx || !this.playing) return;
    this.song = null;
    this.nextSongAt = this.ctx.currentTime + 0.4;
  }

  private update(): void {
    const hidden = typeof document !== 'undefined' && document.hidden;
    const want = this.unlocked && this.enabled && !this.muted && this.volume > 0 && !hidden;
    if (want && !this.playing) this.resume();
    else if (!want && this.playing) this.pause();
  }

  private resume(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (this.ctx !== ctx) {
      this.ctx = ctx;
      this.g = this.build(ctx);
    }
    const now = ctx.currentTime;
    if (this.song && this.nextSongAt < 0) {
      // continue the current song where it paused
      const spb = 60 / this.song.bpm;
      this.origin = now + 0.1 - this.pausedAt * spb;
      for (const tr of TRACKS) this.cursor[tr] = (this.song[tr] as { t: number }[]).findIndex((e) => e.t >= this.pausedAt);
      for (const tr of TRACKS) if (this.cursor[tr] < 0) this.cursor[tr] = this.song[tr].length;
    } else {
      this.nextSongAt = now + 0.15;
    }
    this.playing = true;
    this.g!.out.gain.cancelScheduledValues(now);
    this.g!.out.gain.setTargetAtTime(this.volume * LEVEL, now, 0.2);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private pause(): void {
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    if (!ctx || !this.g) return;
    if (this.song && this.nextSongAt < 0) this.pausedAt = Math.max(0, (ctx.currentTime - this.origin) / (60 / this.song.bpm));
    this.g.out.gain.cancelScheduledValues(ctx.currentTime);
    this.g.out.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  }

  private startSong(at: number): void {
    const song = composeSong(hash3(this.seedBase, this.count++, 0x5107));
    this.song = song;
    this.origin = at;
    this.pausedAt = 0;
    this.cursor = { lead: 0, bass: 0, keys: 0, drums: 0 };
    this.nextSongAt = -1;
    this.g!.leadTremolo.gain.setValueAtTime(song.leadVoice === 'vibes' ? 0.22 : 0, at);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const now = ctx.currentTime;
    if (!this.song || this.nextSongAt >= 0) {
      if (now < this.nextSongAt - 0.05) return;
      this.startSong(Math.max(now + 0.05, this.nextSongAt));
    }
    const song = this.song!;
    const spb = 60 / song.bpm;
    const horizon = now + LOOKAHEAD;
    let done = true;
    for (const tr of TRACKS) {
      const list = song[tr] as (Note | Hit)[];
      let i = this.cursor[tr];
      while (i < list.length) {
        const ev = list[i];
        const at = this.origin + ev.t * spb;
        if (at >= horizon) break;
        if (at >= now - 0.03) this.play(tr, ev, Math.max(at, now + 0.005), spb);
        i++;
      }
      this.cursor[tr] = i;
      if (i < list.length) done = false;
    }
    const end = this.origin + song.lengthBeats * spb;
    if (done && now >= end) this.nextSongAt = end + SONG_GAP;
  }

  private play(track: Track, ev: Note | Hit, at: number, spb: number): void {
    // a little human timing and dynamics
    const t = at + (Math.random() - 0.5) * 0.008;
    const human = 0.92 + Math.random() * 0.16;
    if (track === 'drums') {
      const h = ev as Hit;
      this.drum(t, h.k, h.v * human);
      return;
    }
    const n = ev as Note;
    const dur = n.d * spb;
    const v = Math.min(1, n.v * human);
    if (track === 'keys') this.epiano(t, n.m, dur, v);
    else if (track === 'bass') this.bass(at, n.m, dur, v);
    else if (this.song?.leadVoice === 'trumpet') this.trumpet(at, n.m, dur, v);
    else this.vibes(at, n.m, dur, v);
  }

  // ---------------------------------------------------------------- graph

  private build(ctx: AudioContext): Graph {
    // limiter at the end so the music never clips
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(ctx.destination);
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(limiter);
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18;
    glue.knee.value = 12;
    glue.ratio.value = 3;
    glue.attack.value = 0.015;
    glue.release.value = 0.25;
    glue.connect(out);
    const mix = ctx.createGain();
    mix.connect(glue);

    // small room: three damped feedback delays
    const verb = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    wet.connect(mix);
    for (const [time, pan] of [
      [0.067, -0.6],
      [0.109, 0.6],
      [0.151, 0],
    ]) {
      const d = ctx.createDelay(1);
      d.delayTime.value = time;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const fb = ctx.createGain();
      fb.gain.value = 0.42;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      verb.connect(d);
      d.connect(lp);
      lp.connect(fb);
      fb.connect(d);
      lp.connect(p);
      p.connect(wet);
    }
    const bus = (gain: number, pan: number, send: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = gain;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(mix);
      if (send > 0) {
        const s = ctx.createGain();
        s.gain.value = send;
        g.connect(s);
        s.connect(verb);
      }
      return g;
    };
    const lfo = (rate: number, depth: number, target: AudioParam): GainNode => {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const d = ctx.createGain();
      d.gain.value = depth;
      o.connect(d);
      d.connect(target);
      o.start();
      return d;
    };
    // electric piano tremolo, vibraphone motor tremolo
    const keys = ctx.createGain();
    keys.gain.value = 0.88;
    keys.connect(bus(0.9, -0.22, 0.5));
    lfo(4.3, 0.1, keys.gain);
    const lead = ctx.createGain();
    lead.gain.value = 0.78;
    lead.connect(bus(0.85, 0.18, 0.55));
    const leadTremolo = lfo(5.6, 0, lead.gain);

    const len = ctx.sampleRate * 2;
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    return {
      out,
      keys,
      lead,
      bass: bus(1, 0, 0.08),
      hatBus: bus(0.8, -0.35, 0.12),
      kitBus: bus(0.85, 0, 0.15),
      cymBus: bus(0.8, 0.35, 0.18),
      leadTremolo,
      noise,
    };
  }

  // ----------------------------------------------------------- instruments

  private env(t: number, peak: number, attack: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, stop: number, dest: AudioNode): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  }

  /** Rhodes-like electric piano: 1:1 FM for the tine bark, plus a soft bell partial. */
  private epiano(t: number, m: number, dur: number, v: number): void {
    const ctx = this.ctx!;
    const f = midiToFreq(m);
    const peak = 0.06 * v;
    const amp = this.env(t, peak, 0.004);
    amp.gain.setTargetAtTime(peak * 0.3, t + 0.004, 0.7);
    amp.gain.setTargetAtTime(0.0001, t + dur, 0.14);
    amp.connect(this.g!.keys);
    const stop = t + dur + 0.9;
    const car = this.osc('sine', f, t, stop, amp);
    const modGain = ctx.createGain();
    const index = f * (0.6 + 1.2 * v) * (m < 60 ? 0.7 : 1);
    modGain.gain.setValueAtTime(index, t);
    modGain.gain.setTargetAtTime(f * 0.08, t, 0.18);
    modGain.connect(car.frequency);
    this.osc('sine', f, t, stop, modGain);
    const bell = this.env(t, peak * 0.22, 0.002);
    bell.gain.setTargetAtTime(0.0001, t + 0.002, 0.09);
    bell.connect(amp);
    this.osc('sine', f * 4.01, t, t + 0.6, bell);
  }

  /** Vibraphone: sine with a fourth-octave partial, long ring and damper. */
  private vibes(t: number, m: number, dur: number, v: number): void {
    const f = midiToFreq(m);
    const peak = 0.17 * v;
    const amp = this.env(t, peak, 0.002);
    amp.gain.setTargetAtTime(0.0001, t + 0.002, 1.3);
    amp.gain.setTargetAtTime(0.0001, t + dur + 0.25, 0.09);
    amp.connect(this.g!.lead);
    const stop = t + dur + 0.9;
    this.osc('sine', f, t, stop, amp);
    const partial = this.env(t, 0.22, 0.002);
    partial.gain.setTargetAtTime(0.0001, t + 0.002, 0.22);
    partial.connect(amp);
    this.osc('sine', f * 4, t, Math.min(stop, t + 1.2), partial);
    // mallet click
    this.noiseHit(t, 0.012, 0.025 * v, 'highpass', 3500, 0.7, this.g!.lead);
  }

  /** Harmon-muted trumpet: sawtooth through a nasal band-pass, with delayed vibrato. */
  private trumpet(t: number, m: number, dur: number, v: number): void {
    const ctx = this.ctx!;
    const f = midiToFreq(m);
    const peak = 0.075 * v;
    const amp = this.env(t, peak, 0.035);
    amp.gain.setTargetAtTime(peak * 0.8, t + 0.035, 0.3);
    amp.gain.setTargetAtTime(0.0001, t + dur, 0.06);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(2600, Math.max(800, f * 2.6));
    bp.Q.value = 1.4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    bp.connect(lp);
    lp.connect(amp);
    amp.connect(this.g!.lead);
    const stop = t + dur + 0.4;
    const o = this.osc('sawtooth', f, t, stop, bp);
    // vibrato fades in on longer notes
    const vib = ctx.createGain();
    vib.gain.setValueAtTime(0, t);
    vib.gain.linearRampToValueAtTime(dur > 0.5 ? f * 0.007 : 0, t + Math.min(0.6, dur));
    vib.connect(o.frequency);
    this.osc('sine', 5.2, t, stop, vib);
  }

  /** Upright bass: sine and triangle, a small pitch drop for the pluck, low-pass. */
  private bass(t: number, m: number, dur: number, v: number): void {
    const ctx = this.ctx!;
    const f = midiToFreq(m);
    const peak = 0.28 * v;
    const amp = this.env(t, peak, 0.006);
    amp.gain.setTargetAtTime(peak * 0.45, t + 0.006, 0.2);
    amp.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420 + 380 * v;
    lp.Q.value = 0.8;
    lp.connect(amp);
    amp.connect(this.g!.bass);
    const stop = t + dur + 0.35;
    for (const [type, gain] of [
      ['sine', 1],
      ['triangle', 0.4],
    ] as const) {
      const g = ctx.createGain();
      g.gain.value = gain;
      g.connect(lp);
      const o = this.osc(type, f, t, stop, g);
      o.frequency.setValueAtTime(f * 1.015, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    }
  }

  private noiseHit(
    t: number,
    dur: number,
    gain: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    dest: AudioNode,
    attack = 0.001,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.g!.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = this.env(t, gain, attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + dur + 0.05);
  }

  private drum(t: number, kind: DrumKind, v: number): void {
    const g = this.g!;
    switch (kind) {
      case 'kick': {
        const amp = this.env(t, 0.42 * v, 0.003);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        amp.connect(g.kitBus);
        const o = this.osc('sine', 110, t, t + 0.35, amp);
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
        break;
      }
      case 'snare':
        this.noiseHit(t, 0.12, 0.13 * v, 'bandpass', 1900, 0.7, g.kitBus);
        this.noiseHit(t, 0.05, 0.05 * v, 'highpass', 4000, 0.7, g.kitBus);
        break;
      case 'brush':
        this.noiseHit(t, 0.1, 0.09 * v, 'bandpass', 2600, 0.6, g.kitBus);
        break;
      case 'swish':
        this.noiseHit(t, 0.26, 0.035 * v, 'bandpass', 3400, 0.4, g.kitBus, 0.07);
        break;
      case 'rim': {
        const amp = this.env(t, 0.07 * v, 0.001);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        amp.connect(g.kitBus);
        this.osc('triangle', 1650, t, t + 0.06, amp);
        this.noiseHit(t, 0.02, 0.05 * v, 'bandpass', 3200, 1.2, g.kitBus);
        break;
      }
      case 'ride': {
        this.noiseHit(t, 0.4, 0.045 * v, 'bandpass', 7600, 0.9, g.cymBus);
        const ping = this.env(t, 0.012 * v, 0.001);
        ping.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        ping.connect(g.cymBus);
        this.osc('sine', 5150, t, t + 0.4, ping);
        break;
      }
      case 'crash':
        this.noiseHit(t, 1.5, 0.06 * v, 'highpass', 5200, 0.7, g.cymBus);
        break;
      case 'hat':
        this.noiseHit(t, 0.035, 0.04 * v, 'highpass', 8000, 0.8, g.hatBus);
        break;
      case 'openhat':
        this.noiseHit(t, 0.22, 0.035 * v, 'highpass', 7600, 0.8, g.hatBus);
        break;
      case 'chick':
        this.noiseHit(t, 0.045, 0.04 * v, 'bandpass', 6400, 1, g.hatBus);
        break;
    }
  }
}
