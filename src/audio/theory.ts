/**
 * Music theory and composition for the procedural soundtrack. Everything here
 * is pure (no WebAudio) and deterministic per seed, so it can be unit tested.
 * Times and lengths are in beats; a bar has four beats.
 */
import { Rng } from '../util/rng';

export type Feel = 'swing' | 'ballad' | 'bossa' | 'smooth';
export type LeadVoice = 'vibes' | 'trumpet';
export type DrumKind = 'kick' | 'snare' | 'brush' | 'swish' | 'rim' | 'ride' | 'crash' | 'hat' | 'openhat' | 'chick';
export type Part = 'intro' | 'head' | 'solo' | 'outro';

/** A pitched note: start and length in beats, MIDI pitch, velocity 0..1. */
export interface Note {
  t: number;
  d: number;
  m: number;
  v: number;
  /** Chromatic approach note: it resolves by a half step into the next note. */
  approach?: boolean;
  /** Chord symbol a comping voicing was built for (keys only). */
  chord?: string;
}

/** A drum hit at a time in beats. */
export interface Hit {
  t: number;
  k: DrumKind;
  v: number;
}

/** A chord: root pitch class (0 = C), quality key and display symbol. */
export interface Chord {
  root: number;
  quality: string;
  symbol: string;
}

export interface Song {
  seed: number;
  title: string;
  form: string;
  feel: Feel;
  bpm: number;
  /** Where the off-beat eighth falls inside the beat (0.5 = straight). */
  swing: number;
  /** Key root as a pitch class, and the mode of the tune. */
  key: number;
  mode: 'major' | 'minor';
  leadVoice: LeadVoice;
  /** Chord per beat for the whole arrangement. */
  beats: Chord[];
  /** Part per bar. */
  parts: Part[];
  /** First bar of each chorus. */
  choruses: { bar: number; part: Part }[];
  lengthBeats: number;
  lead: Note[];
  bass: Note[];
  keys: Note[];
  drums: Hit[];
}

export const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI ranges per instrument. */
export const RANGES = {
  vibes: { lo: 62, hi: 84 },
  trumpet: { lo: 58, hi: 79 },
  bass: { lo: 28, hi: 50 },
  keys: { lo: 50, hi: 76 },
} as const;

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

// ------------------------------------------------------------------ chords

const SCALES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian2: [0, 2, 3, 5, 6, 8, 10],
  halfWhole: [0, 1, 3, 4, 6, 7, 9, 10],
  wholeHalf: [0, 2, 3, 5, 6, 8, 9, 11],
};

interface QualityDef {
  /** Root, third, fifth and seventh (or sixth) as intervals. */
  tones: number[];
  /** Colour tones (pitch-class intervals) that also sound good on strong beats. */
  tensions: number[];
  /** Chord scale for passing notes. */
  scale: number[];
  /** Rootless four-note voicings (intervals above the root), A and B forms. */
  voicings: number[][];
}

// prettier-ignore
const MAJ7: QualityDef = { tones: [0, 4, 7, 11], tensions: [2], scale: SCALES.ionian, voicings: [[4, 7, 11, 14], [11, 14, 16, 19]] };
// prettier-ignore
const MIN7: QualityDef = { tones: [0, 3, 7, 10], tensions: [2, 5], scale: SCALES.dorian, voicings: [[3, 7, 10, 14], [10, 14, 15, 19]] };
// prettier-ignore
const DOM7: QualityDef = { tones: [0, 4, 7, 10], tensions: [2, 9], scale: SCALES.mixolydian, voicings: [[4, 9, 10, 14], [10, 14, 16, 21]] };
// prettier-ignore
const SUS4: QualityDef = { tones: [0, 5, 7, 10], tensions: [2, 9], scale: SCALES.mixolydian, voicings: [[5, 9, 10, 14], [10, 14, 17, 21]] };

// prettier-ignore
export const QUALITIES: Record<string, QualityDef> = {
  maj7: MAJ7,
  maj9: MAJ7,
  '6': { tones: [0, 4, 7, 9], tensions: [2], scale: SCALES.ionian, voicings: [[4, 7, 9, 14], [9, 14, 16, 19]] },
  m7: MIN7,
  m9: MIN7,
  m6: { tones: [0, 3, 7, 9], tensions: [2], scale: SCALES.dorian, voicings: [[3, 7, 9, 14], [9, 14, 15, 19]] },
  '7': DOM7,
  '9': DOM7,
  '13': DOM7,
  '7b9': { tones: [0, 4, 7, 10], tensions: [1], scale: SCALES.halfWhole, voicings: [[4, 7, 10, 13], [10, 13, 16, 19]] },
  '7sus4': SUS4,
  '13sus4': SUS4,
  m7b5: { tones: [0, 3, 6, 10], tensions: [5], scale: SCALES.locrian2, voicings: [[3, 6, 10, 12], [10, 12, 15, 18]] },
  dim7: { tones: [0, 3, 6, 9], tensions: [], scale: SCALES.wholeHalf, voicings: [[3, 6, 9, 12], [6, 9, 12, 15]] },
};

/** Parse a chord symbol such as "Dm7", "G13", "F#m7b5" or "Bb7b9". */
export function parseChord(symbol: string): Chord {
  const m = /^([A-G])([#b]?)(.*)$/.exec(symbol);
  if (!m) throw new Error(`Bad chord symbol ${symbol}`);
  const quality = m[3];
  if (!QUALITIES[quality]) throw new Error(`Unknown chord quality "${quality}" in ${symbol}`);
  const root = mod12(LETTER_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
  return { root, quality, symbol };
}

function asChord(c: Chord | string): Chord {
  return typeof c === 'string' ? parseChord(c) : c;
}

/** Pitch classes of root, third, fifth and seventh. */
export function chordTones(c: Chord | string): number[] {
  const ch = asChord(c);
  return QUALITIES[ch.quality].tones.map((i) => mod12(ch.root + i));
}

/** Chord tones plus colour tones: notes that sound stable on a strong beat. */
export function targetTones(c: Chord | string): number[] {
  const ch = asChord(c);
  const q = QUALITIES[ch.quality];
  return [...q.tones, ...q.tensions].map((i) => mod12(ch.root + i));
}

/** Pitch classes of the chord scale. */
export function scaleOf(c: Chord | string): number[] {
  const ch = asChord(c);
  return QUALITIES[ch.quality].scale.map((i) => mod12(ch.root + i));
}

/** Third and seventh (the notes that define the chord colour). */
export function guideTones(c: Chord | string): number[] {
  const t = chordTones(c);
  return [t[1], t[3]];
}

/** Chord from a key-relative template such as "2:m7" (degree in semitones : quality). */
export function chordFromTemplate(key: number, tpl: string): Chord {
  const [deg, quality] = tpl.split(':');
  const root = mod12(key + Number(deg));
  if (!QUALITIES[quality]) throw new Error(`Unknown chord quality "${quality}"`);
  return { root, quality, symbol: NOTE_NAMES[root] + quality };
}

/** The pitch with class `pc` nearest to `ref` inside [lo, hi]. */
export function nearestPitch(pc: number, ref: number, lo: number, hi: number): number {
  let best = lo;
  let bd = Infinity;
  for (let m = lo; m <= hi; m++) {
    if (mod12(m) !== pc) continue;
    const d = Math.abs(m - ref);
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

/** Nearest pitch whose class is in `pcs`; ties go in direction `dir` (or down). */
function snapTo(m: number, pcs: number[], dir = 0): number {
  for (let d = 0; d <= 6; d++) {
    const up = pcs.includes(mod12(m + d));
    const down = pcs.includes(mod12(m - d));
    if (up && down) return dir > 0 ? m + d : m - d;
    if (up) return m + d;
    if (down) return m - d;
  }
  return m;
}

/** Move `steps` scale degrees away from `m` (after snapping it to the scale). */
function scaleStep(m: number, steps: number, scale: number[]): number {
  let p = snapTo(m, scale, steps);
  const dir = Math.sign(steps);
  for (let k = 0; k < Math.abs(steps); k++) {
    do p += dir;
    while (!scale.includes(mod12(p)));
  }
  return p;
}

/** Shift an off-beat eighth (x.5) to the swing position inside the beat. */
export function swingTime(t: number, ratio: number): number {
  const b = Math.floor(t + 1e-9);
  return Math.abs(t - b - 0.5) < 1e-6 ? b + ratio : t;
}

// ------------------------------------------------------------------- forms

interface FormDef {
  name: string;
  mode: 'major' | 'minor';
  feel: Feel;
  bpm: [number, number];
  /** Bars per section; each bar holds one or two chords ("degree:quality"). */
  sections: Record<string, string[]>;
  order: string[];
  intro?: string[];
  ending: string;
  leads: LeadVoice[];
}

const FORMS: FormDef[] = [
  {
    name: 'Rhythm changes',
    mode: 'major',
    feel: 'swing',
    bpm: [104, 116],
    sections: {
      A: ['0:maj7 9:7', '2:m7 7:7', '4:m7 9:7', '2:m7 7:7', '0:maj7 0:7', '5:maj7 6:dim7', '4:m7 9:7b9', '2:m7 7:7'],
      A2: ['0:maj7 9:7', '2:m7 7:7', '4:m7 9:7', '2:m7 7:7', '0:maj7 0:7', '5:maj7 6:dim7', '2:m7 7:7', '0:6'],
      B: ['4:7', '4:7b9', '9:7', '9:13', '2:9', '2:7', '2:m7', '7:7'],
    },
    order: ['A', 'A2', 'B', 'A2'],
    ending: '0:maj9',
    leads: ['vibes', 'trumpet'],
  },
  {
    name: 'Falling leaves',
    mode: 'major',
    feel: 'swing',
    bpm: [92, 104],
    sections: {
      A: ['2:m7', '7:7', '0:maj7', '5:maj7', '11:m7b5', '4:7b9', '9:m7', '9:m7'],
      A2: ['2:m7', '7:7', '0:maj7', '5:maj7', '11:m7b5', '4:7b9', '9:m7', '11:m7b5 4:7b9'],
    },
    order: ['A', 'A2'],
    intro: ['9:m7', '9:m7', '4:m7b5', '9:7b9'],
    ending: '9:m9',
    leads: ['vibes', 'trumpet'],
  },
  {
    name: 'Minor blues',
    mode: 'minor',
    feel: 'swing',
    bpm: [96, 110],
    sections: { A: ['0:m9', '5:m9', '0:m9', '0:m7', '5:m9', '5:m7', '0:m9', '0:m7', '8:7', '7:7b9', '0:m9', '2:m7b5 7:7b9'] },
    order: ['A'],
    ending: '0:m9',
    leads: ['vibes', 'trumpet'],
  },
  {
    name: 'Jazz blues',
    mode: 'major',
    feel: 'swing',
    bpm: [110, 122],
    sections: { A: ['0:7', '5:7', '0:7', '7:m7 0:7', '5:7', '6:dim7', '0:7', '9:7b9', '2:m7', '7:7', '0:7 9:7b9', '2:m7 7:7'] },
    order: ['A'],
    ending: '0:9',
    leads: ['vibes', 'trumpet'],
  },
  {
    name: 'Blue bossa',
    mode: 'minor',
    feel: 'bossa',
    bpm: [124, 136],
    sections: {
      A: ['0:m9', '0:m9', '5:m9', '5:m9', '2:m7b5', '7:7b9', '0:m9', '0:m9'],
      B: ['3:m7', '8:7', '1:maj7', '1:maj7', '2:m7b5', '7:7b9', '0:m9', '2:m7b5 7:7b9'],
    },
    order: ['A', 'B'],
    ending: '0:m9',
    leads: ['vibes'],
  },
  {
    name: 'Seaside bossa',
    mode: 'major',
    feel: 'bossa',
    bpm: [122, 134],
    sections: {
      A: ['0:maj7', '0:maj7', '2:7', '2:7', '2:m7', '1:7', '0:maj7', '1:7'],
      A2: ['0:maj7', '0:maj7', '2:7', '2:7', '2:m7', '1:7', '0:6', '0:6'],
    },
    order: ['A', 'A2'],
    ending: '0:maj9',
    leads: ['vibes', 'trumpet'],
  },
  {
    name: 'Ballad',
    mode: 'major',
    feel: 'ballad',
    bpm: [72, 82],
    sections: {
      A: ['0:maj9', '9:m9', '2:m9', '7:13', '4:m7 9:7b9', '2:m9 7:13', '0:maj9', '7:13sus4'],
      B: ['5:maj9', '5:m6', '4:m7', '9:7b9', '2:m9', '7:13', '0:maj9', '7:13sus4'],
    },
    order: ['A', 'B'],
    ending: '0:maj9',
    leads: ['vibes', 'trumpet'],
  },
  {
    name: 'Smooth groove',
    mode: 'major',
    feel: 'smooth',
    bpm: [90, 100],
    sections: {
      A: ['2:m9', '7:13sus4', '0:maj9', '5:maj9', '2:m9', '7:13sus4', '0:maj9', '0:maj9'],
      B: ['5:maj9', '4:m7', '9:m9', '7:13sus4 7:13', '5:maj9', '4:m7', '2:m9', '7:13sus4'],
    },
    order: ['A', 'B'],
    intro: ['0:maj9', '5:maj9', '0:maj9', '9:7b9'],
    ending: '0:maj9',
    leads: ['trumpet', 'vibes'],
  },
];

const MAJOR_KEYS = [0, 5, 10, 3, 7, 2, 8];
const MINOR_KEYS = [0, 7, 2, 9, 5, 4];
const MAJOR_INTRO = ['0:maj7 9:7', '2:m7 7:7', '0:maj7 9:7', '2:m7 7:7'];
const MINOR_INTRO = ['0:m9', '2:m7b5 7:7b9', '0:m9', '2:m7b5 7:7b9'];

const TITLE_A = [
  'Rush Hour',
  'Zoning Board',
  'Skyline',
  'Low-Poly',
  'Polygon',
  'Downtown',
  'Midnight',
  'Suburban',
  'Llama',
  'Cheetah',
  'Gridlock',
  'Budget Surplus',
  'Monorail',
  'Waterfront',
  'Municipal',
  'Concrete',
  'Power Line',
  'Bus Stop',
];
const TITLE_B: Record<Feel, string[]> = {
  swing: ['Swing', 'Shuffle', 'Strut', 'Stroll', 'Blues', 'Bounce'],
  ballad: ['Ballad', 'Serenade', 'Lullaby', 'Reverie', 'Nocturne'],
  bossa: ['Bossa', 'Samba', 'Breeze', 'Promenade'],
  smooth: ['Groove', 'Lounge', 'Glide', 'Cruise'],
};

// ----------------------------------------------------------------- melody

type Rhythm = [number, number][];

/** Two-bar motif rhythms (onset and length in eighths), by feel. Each ends on a long note. */
// prettier-ignore
const MOTIFS: Record<Feel, Rhythm[]> = {
  swing: [
    [[0, 2], [2, 1], [3, 3], [8, 2], [10, 2], [12, 3]],
    [[1, 1], [2, 2], [4, 1], [5, 3], [8, 6]],
    [[0, 2], [2, 2], [4, 2], [6, 1], [7, 5]],
    [[2, 1], [3, 1], [4, 2], [6, 2], [8, 4]],
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 4], [10, 1], [11, 3]],
    [[0, 1], [1, 2], [3, 1], [4, 3], [7, 1], [8, 4]],
    [[3, 1], [4, 1], [5, 1], [6, 2], [8, 2], [10, 4]],
  ],
  ballad: [
    [[0, 4], [4, 2], [6, 2], [8, 6]],
    [[0, 3], [3, 1], [4, 4], [10, 2], [12, 3]],
    [[2, 2], [4, 2], [6, 4], [12, 3]],
    [[0, 2], [2, 2], [4, 6], [11, 1], [12, 3]],
  ],
  bossa: [
    [[0, 3], [3, 3], [6, 2], [8, 6]],
    [[1, 2], [3, 2], [5, 3], [8, 1], [9, 1], [10, 4]],
    [[0, 2], [2, 1], [3, 3], [6, 2], [8, 6]],
    [[2, 1], [3, 2], [5, 1], [6, 2], [8, 2], [10, 4]],
  ],
  smooth: [
    [[0, 3], [3, 1], [4, 2], [6, 4], [12, 1], [13, 2]],
    [[1, 1], [2, 1], [3, 3], [6, 2], [8, 6]],
    [[0, 2], [3, 1], [4, 3], [8, 2], [10, 1], [11, 3]],
    [[2, 2], [4, 1], [5, 3], [8, 5]],
  ],
};

/** Two-bar phrase endings with a long final note. */
// prettier-ignore
const CADENCES: Rhythm[] = [
  [[0, 2], [2, 2], [4, 10]],
  [[0, 3], [3, 1], [4, 2], [6, 8]],
  [[1, 1], [2, 2], [4, 10]],
  [[0, 4], [4, 10]],
];

interface Motif {
  rhythm: Rhythm;
  steps: number[];
  first: number;
}

interface Phrase {
  /** Start of the phrase in beats. */
  start: number;
  rhythm: Rhythm;
  /** Scale steps between consecutive notes. */
  steps: number[];
  /** Which target tone the first note takes (0 = third, 1 = fifth, …). */
  first: number;
  /** End on root, third or fifth. */
  cadence: boolean;
  /** Allow chromatic approach notes (solos). */
  approach: boolean;
}

function contour(rng: Rng, n: number): number[] {
  const arc = rng.pick(['up', 'down', 'arch', 'valley'] as const);
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const firstHalf = k < n / 2;
    let dir = arc === 'up' ? 1 : arc === 'down' ? -1 : arc === 'arch' ? (firstHalf ? 1 : -1) : firstHalf ? -1 : 1;
    if (rng.chance(0.2)) dir = -dir;
    out.push(dir * rng.weighted([1, 2, 3, 4], [0.55, 0.28, 0.12, 0.05]));
  }
  return out;
}

function makeMotif(rng: Rng, feel: Feel): Motif {
  const rhythm = rng.pick(MOTIFS[feel]).map(([p, d]) => [p, d] as [number, number]);
  return { rhythm, steps: contour(rng, rhythm.length - 1), first: rng.int(0, 3) };
}

function cadenceMotif(rng: Rng): Motif {
  const rhythm = rng.pick(CADENCES).map(([p, d]) => [p, d] as [number, number]);
  const steps = rhythm.slice(1).map(() => -rng.weighted([1, 2], [0.7, 0.3]));
  return { rhythm, steps, first: rng.int(1, 3) };
}

/** Stretch the last note of a rhythm so the phrase fills `eighths`. */
function extendLast(r: Rhythm, eighths: number): Rhythm {
  const out = r.map(([p, d]) => [p, d] as [number, number]);
  const last = out[out.length - 1];
  last[1] = Math.max(last[1], eighths - last[0]);
  return out;
}

/** Change one or two steps of a contour a little. */
function mutate(rng: Rng, steps: number[]): number[] {
  const out = steps.slice();
  const n = rng.int(1, 2);
  for (let k = 0; k < n && out.length; k++) {
    const i = rng.int(0, out.length - 1);
    out[i] += rng.pick([-1, 1]);
    if (out[i] === 0) out[i] = rng.pick([-1, 1]);
  }
  return out;
}

interface Timeline {
  chordAt(beat: number): Chord;
}

/** Velocity from the metric position and the place inside the phrase (no randomness). */
function velocity(beat: number, k: number, n: number): number {
  const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
  const strong = onBeat && Math.round(beat) % 2 === 0;
  const swell = n > 1 ? Math.sin((Math.PI * k) / (n - 1)) * 0.07 : 0;
  return Math.min(0.95, Math.max(0.35, 0.64 + (strong ? 0.1 : 0) - (onBeat ? 0 : 0.08) + swell));
}

/** Turn a phrase into notes over the chords of the timeline. */
function realize(ph: Phrase, tl: Timeline, lo: number, hi: number, ref: number, rng: Rng | null): Note[] {
  const notes: Note[] = [];
  const n = ph.rhythm.length;
  let prev = ref;
  for (let k = 0; k < n; k++) {
    const [p, d] = ph.rhythm[k];
    const beat = ph.start + p / 2;
    const ch = tl.chordAt(beat);
    const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
    const strong = onBeat && Math.round(beat) % 2 === 0;
    let m: number;
    if (k === 0) {
      const q = QUALITIES[ch.quality];
      const order = [q.tones[1], q.tones[2], q.tones[3], ...q.tensions, q.tones[0]];
      m = nearestPitch(mod12(ch.root + order[ph.first % order.length]), ref, lo + 3, hi - 3);
    } else {
      const step = ph.steps[k - 1] ?? 0;
      const scale = scaleOf(ch);
      m = scaleStep(prev, step, scale);
      if (m > hi || m < lo) m = scaleStep(prev, -step, scale);
      if (strong || d >= 3) m = snapTo(m, targetTones(ch), Math.sign(step));
    }
    if (k === n - 1 && ph.cadence) m = snapTo(m, chordTones(ch).slice(0, 3));
    while (m > hi) m -= 12;
    while (m < lo) m += 12;
    notes.push({ t: beat, d: (d / 2) * 0.94, m, v: velocity(beat, k, n) });
    prev = m;
  }
  // chromatic approach into strong-beat notes
  if (ph.approach && rng) {
    for (let k = 1; k < notes.length; k++) {
      const cur = notes[k];
      const before = notes[k - 1];
      const onBeat = Math.abs(cur.t - Math.round(cur.t)) < 1e-6;
      if (!onBeat || Math.round(cur.t) % 2 !== 0) continue;
      if (Math.abs(cur.t - before.t - 0.5) > 1e-6 || before.approach || !rng.chance(0.4)) continue;
      const fromAbove = before.m > cur.m;
      let a = cur.m + (fromAbove ? 1 : -1);
      if (a > hi || a < lo) a = cur.m + (fromAbove ? -1 : 1);
      before.m = a;
      before.approach = true;
    }
  }
  return notes;
}

/** Phrases for one theme section of 8 or 12 bars. */
function themePlan(rng: Rng, motif: Motif, bars: number, start: number): Phrase[] {
  const ph = (bar: number, m: Motif, cadence = false, first = m.first): Phrase => ({
    start: start + bar * 4,
    rhythm: m.rhythm,
    steps: m.steps,
    first,
    cadence,
    approach: false,
  });
  if (bars === 12) {
    // blues: call, call again over the IV chord, then the answer
    const answer = cadenceMotif(rng);
    return [ph(0, motif), ph(4, motif), ph(8, answer, true)];
  }
  const seq: Motif = { rhythm: extendLast(motif.rhythm, 13), steps: motif.steps, first: motif.first };
  const varied: Motif = { rhythm: motif.rhythm, steps: mutate(rng, motif.steps), first: motif.first };
  return [ph(0, motif), ph(2, seq, false, motif.first + 1), ph(4, varied)];
}

function lineRhythm(rng: Rng, feel: Feel): Rhythm {
  const out: Rhythm = [];
  const unit = feel === 'ballad' ? 2 : 1;
  const n = rng.int(4, feel === 'ballad' ? 6 : 10);
  let p = 0;
  for (let k = 0; k < n; k++) {
    const d = k === n - 1 ? rng.int(2, 4) : rng.chance(0.15) ? unit * 2 : unit;
    out.push([p, d]);
    p += d;
  }
  return out;
}

function lineSteps(rng: Rng, n: number, arp: boolean): number[] {
  let dir = rng.pick([1, -1]);
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    if (rng.chance(arp ? 0.2 : 0.28)) dir = -dir;
    out.push(dir * (arp ? 2 : rng.weighted([1, 2, 3], [0.7, 0.25, 0.05])));
  }
  return out;
}

/** Improvised phrases for one solo chorus. */
function soloPlan(rng: Rng, feel: Feel, start: number, beats: number, motifs: Motif[]): Phrase[] {
  const out: Phrase[] = [];
  let t = start + rng.pick([0, 0.5, 1]);
  const end = start + beats;
  while (t < end - 2) {
    const kind = rng.weighted(
      ['motif', 'line', 'arp', 'lyric'] as const,
      feel === 'ballad' ? [2, 1, 1, 3] : feel === 'bossa' ? [2, 2, 1, 2] : [2, 4, 2, 1],
    );
    let rhythm: Rhythm;
    let steps: number[];
    if (kind === 'motif') {
      const m = rng.pick(motifs);
      const shift = rng.pick([0, 0, 1, 2]);
      rhythm = m.rhythm.map(([p, d]) => [p + shift, d] as [number, number]);
      steps = mutate(rng, m.steps);
    } else if (kind === 'lyric') {
      rhythm = [];
      let p = 0;
      const n = rng.int(2, 4);
      for (let k = 0; k < n; k++) {
        const d = rng.int(2, 6);
        rhythm.push([p, d]);
        p += d + (rng.chance(0.3) ? 1 : 0);
      }
      steps = rhythm.slice(1).map(() => rng.pick([-3, -2, -1, 1, 2, 3]));
    } else {
      rhythm = kind === 'arp' ? lineRhythm(rng, feel).slice(0, rng.int(4, 6)) : lineRhythm(rng, feel);
      const last = rhythm[rhythm.length - 1];
      last[1] = Math.max(last[1], 2);
      steps = lineSteps(rng, rhythm.length - 1, kind === 'arp');
    }
    const last = rhythm[rhythm.length - 1];
    const room = (end - t) * 2;
    if (last[0] + last[1] > room) {
      rhythm = rhythm.filter(([p]) => p < room - 1);
      if (rhythm.length < 2) break;
      const l = rhythm[rhythm.length - 1];
      l[1] = Math.min(l[1], room - l[0]);
      steps = steps.slice(0, rhythm.length - 1);
    }
    out.push({ start: t, rhythm, steps, first: rng.int(0, 3), cadence: rng.chance(0.5), approach: kind === 'line' || kind === 'arp' });
    const len = rhythm[rhythm.length - 1][0] + rhythm[rhythm.length - 1][1];
    t += len / 2 + rng.pick(feel === 'ballad' ? [1, 1.5, 2, 3] : [0.5, 1, 1.5, 2, 3]);
    t = Math.round(t * 2) / 2;
  }
  return out;
}

/** Remove overlaps so each note ends before the next one starts. */
function legato(notes: Note[]): Note[] {
  notes.sort((a, b) => a.t - b.t);
  for (let i = 0; i + 1 < notes.length; i++) notes[i].d = Math.max(0.1, Math.min(notes[i].d, notes[i + 1].t - notes[i].t - 0.02));
  return notes;
}

// -------------------------------------------------------------- harmony

/** Pick the voicing closest to the previous one (smooth voice leading). */
export function voiceChord(ch: Chord, prev: number[] | null): number[] {
  const { lo, hi } = RANGES.keys;
  let best: number[] = [];
  let bestCost = Infinity;
  for (const v of QUALITIES[ch.quality].voicings) {
    for (let oct = -1; oct <= 2; oct++) {
      const base = 48 + ch.root + 12 * oct;
      const notes = v.map((i) => base + i);
      if (notes[0] < lo || notes[notes.length - 1] > hi) continue;
      const centre = (notes[0] + notes[notes.length - 1]) / 2;
      const cost = (prev ? notes.reduce((s, m, i) => s + Math.abs(m - prev[i]), 0) : 0) + Math.abs(centre - 62) * 0.6;
      if (cost < bestCost) {
        bestCost = cost;
        best = notes;
      }
    }
  }
  return best;
}

type CompCell = [number, number][];

// prettier-ignore
const COMP: Record<Feel, CompCell[]> = {
  swing: [[[0, 3], [3, 2]], [[2, 1], [6, 1]], [[3, 2], [7, 3]], [[0, 2], [5, 2]], [[1, 1], [3, 3]], [[0, 6]]],
  ballad: [[[0, 8]], [[0, 4], [4, 4]], [[0, 6], [6, 2]]],
  bossa: [[[0, 2], [3, 2], [6, 2]], [[2, 2], [5, 3]]],
  smooth: [[[0, 7]], [[0, 3], [3, 1], [7, 1]], [[0, 5], [6, 2]]],
};

/** Walking or pattern bass line for one bar. */
function bassBar(rng: Rng, feel: Feel, bar: number, tl: Timeline, prev: number, out: Note[]): number {
  const { lo, hi } = RANGES.bass;
  const b0 = bar * 4;
  const chords = [0, 1, 2, 3].map((k) => tl.chordAt(b0 + k));
  const next = tl.chordAt(b0 + 4);
  const two = chords[2].symbol !== chords[0].symbol;
  const root = (ch: Chord, ref: number) => nearestPitch(ch.root, ref, lo, hi);
  const push = (t: number, d: number, m: number, v: number) => out.push({ t: b0 + t, d, m, v });
  if (feel === 'swing') {
    const segs: [number, number, Chord, Chord][] = two
      ? [
          [0, 2, chords[0], chords[2]],
          [2, 2, chords[2], next],
        ]
      : [[0, 4, chords[0], next]];
    for (const [s, len, ch, nx] of segs) {
      const r = root(ch, prev);
      const target = root(nx, r);
      const fromBelow = target >= r;
      // last beat leads into the next root: chromatic, from its fifth, or by a scale step
      const options = [
        target + (fromBelow ? -1 : 1),
        nearestPitch(mod12(nx.root + 7), target, lo, hi),
        target + (fromBelow ? -2 : 2),
        target + (fromBelow ? 1 : -1),
      ];
      const order = rng.chance(0.55) ? [0, 1, 2, 3] : rng.chance(0.5) ? [1, 0, 2, 3] : [2, 0, 1, 3];
      let approach = target;
      for (const i of order) {
        const c = options[i];
        if (c >= lo && c <= hi && c !== r) {
          approach = c;
          break;
        }
      }
      push(s, 0.9, r, 0.78);
      if (len === 4) {
        const tones = chordTones(ch);
        const mid1 = snapTo(Math.round(r + (approach - r) / 3) + (approach === r ? 4 : 0), tones, fromBelow ? 1 : -1);
        let mid2 = snapTo(Math.round((mid1 + approach) / 2), scaleOf(ch), fromBelow ? 1 : -1);
        if (mid2 === mid1 || mid2 === approach) mid2 = scaleStep(mid1, fromBelow ? 1 : -1, scaleOf(ch));
        push(s + 1, 0.9, Math.min(hi, Math.max(lo, mid1)), 0.66);
        push(s + 2, 0.9, Math.min(hi, Math.max(lo, mid2)), 0.7);
        push(s + 3, 0.9, approach, 0.64);
      } else {
        push(s + 1, 0.9, approach, 0.64);
      }
      prev = approach;
    }
    return prev;
  }
  if (feel === 'ballad') {
    const r = root(chords[0], prev);
    push(0, 1.9, r, 0.72);
    if (two) {
      prev = root(chords[2], r);
      push(2, 1.9, prev, 0.68);
    } else if (next.symbol !== chords[0].symbol) {
      const t = root(next, r);
      prev = t + (t >= r ? -1 : 1);
      if (prev < lo || prev > hi) prev = nearestPitch(mod12(chords[0].root + 7), r, lo, hi);
      push(2, 1.9, prev, 0.62);
    } else {
      prev = nearestPitch(mod12(chords[0].root + 7), r, lo, hi);
      push(2, 1.9, prev, 0.62);
    }
    return prev;
  }
  if (feel === 'bossa') {
    const r1 = root(chords[0], prev);
    const f1 = nearestPitch(mod12(chords[0].root + 7), r1 - 3, lo, hi);
    push(0, 1.4, r1, 0.76);
    push(1.5, 0.45, f1, 0.6);
    const c2 = chords[2];
    const r2 = two ? root(c2, f1) : f1;
    push(2, 1.4, r2, two ? 0.72 : 0.66);
    prev = next.symbol !== c2.symbol ? root(next, r2) : two ? nearestPitch(mod12(c2.root + 7), r2, lo, hi) : r1;
    push(3.5, 0.45, prev, 0.58);
    return prev;
  }
  // smooth: syncopated eighth-note groove
  const r = root(chords[0], prev);
  const oct = r + 12 <= hi ? r + 12 : r;
  push(0, 1.2, r, 0.8);
  push(1.5, 0.4, oct, 0.55);
  const c2 = chords[2];
  const r2 = two ? root(c2, r) : r;
  push(2, 0.9, two ? r2 : nearestPitch(mod12(c2.root + 7), r, lo, hi), 0.7);
  push(3, 0.4, r2, 0.6);
  const t = root(next, r2);
  prev = next.symbol === c2.symbol ? r2 : t + (t >= r2 ? -1 : 1);
  if (prev < lo || prev > hi) prev = t;
  push(3.5, 0.4, prev, 0.58);
  return prev;
}

/** Drum pattern for one bar. */
function drumBar(rng: Rng, feel: Feel, bar: number, fill: boolean, crash: boolean, out: Hit[]): void {
  const b0 = bar * 4;
  const hit = (t: number, k: DrumKind, v: number) => out.push({ t: b0 + t, k, v });
  if (crash) {
    hit(0, 'crash', feel === 'ballad' ? 0.35 : 0.55);
    hit(0, 'kick', 0.45);
  }
  if (feel === 'swing') {
    for (let k = 0; k < 4; k++) {
      if (!(crash && k === 0)) hit(k, 'ride', k % 2 ? 0.66 : 0.52);
      if (k % 2 === 1) {
        hit(k, 'chick', 0.5);
        if (!rng.chance(0.15)) hit(k + 0.5, 'ride', 0.38);
      }
      hit(k, 'kick', 0.1);
    }
    if (fill) {
      for (let k = 0; k < 6; k++) hit(2 + k / 3, 'snare', 0.22 + k * 0.06);
    } else {
      for (let e = 1; e < 8; e += 2) if (rng.chance(0.1)) hit(e / 2, 'snare', rng.range(0.14, 0.26));
    }
    return;
  }
  if (feel === 'ballad') {
    for (let k = 0; k < 4; k++) {
      hit(k, 'swish', 0.5);
      if (k % 2 === 1) hit(k, 'brush', 0.42);
    }
    hit(0, 'kick', 0.16);
    if (bar % 2 === 0) hit(2, 'ride', 0.22);
    if (fill) for (let k = 0; k < 3; k++) hit(3 + k / 3, 'brush', 0.3 + k * 0.08);
    return;
  }
  if (feel === 'bossa') {
    const rims = bar % 2 === 0 ? [0, 3, 6] : [2, 5];
    for (const e of rims) hit(e / 2, 'rim', 0.48);
    for (let e = 0; e < 8; e++) hit(e / 2, 'hat', e % 2 ? 0.2 : 0.32);
    for (const [t, v] of [
      [0, 0.42],
      [1.5, 0.26],
      [2, 0.36],
      [3.5, 0.26],
    ])
      hit(t, 'kick', v);
    if (fill) for (let e = 4; e < 8; e++) hit(e / 2, 'snare', 0.24 + (e - 4) * 0.08);
    return;
  }
  // smooth
  hit(0, 'kick', 0.5);
  hit(2.5, 'kick', 0.36);
  hit(1, 'rim', 0.5);
  hit(3, 'rim', 0.5);
  for (let e = 0; e < 8; e++) {
    if (e === 7 && bar % 2 === 1) hit(e / 2, 'openhat', 0.26);
    else hit(e / 2, 'hat', e % 2 ? 0.2 : 0.3);
  }
  if (fill) for (let k = 0; k < 4; k++) hit(3 + k / 4, 'snare', 0.24 + k * 0.08);
}

// ------------------------------------------------------------------- song

function swingNotes(notes: Note[], ratio: number): void {
  if (ratio === 0.5) return;
  for (const n of notes) {
    const t = swingTime(n.t, ratio);
    const end = swingTime(n.t + n.d, ratio);
    n.t = t;
    if (end > t) n.d = end - t;
  }
}

/** Compose a whole song (deterministic for a seed). */
export function composeSong(seed: number): Song {
  const rng = new Rng(seed);
  const form = rng.pick(FORMS);
  const feel = form.feel;
  const key = rng.pick(form.mode === 'major' ? MAJOR_KEYS : MINOR_KEYS);
  const bpm = rng.int(form.bpm[0], form.bpm[1]);
  const swing = feel === 'swing' ? Math.round(rng.range(0.6, 0.66) * 100) / 100 : feel === 'ballad' ? 0.6 : 0.5;
  const leadVoice = rng.pick(form.leads);
  const range = RANGES[leadVoice];
  const title = `${rng.pick(TITLE_A)} ${rng.pick(TITLE_B[feel])}`;

  // ---- arrangement
  const chorus: string[] = form.order.flatMap((label) => form.sections[label]);
  const intro = form.intro ?? (form.mode === 'major' ? MAJOR_INTRO : MINOR_INTRO);
  const spb = 60 / bpm;
  const chorusSec = chorus.length * 4 * spb;
  const fixedSec = (intro.length + 2) * 4 * spb;
  const n = Math.max(2, Math.min(7, Math.round((150 - fixedSec) / chorusSec)));
  const kinds: Part[] = n === 2 ? ['head', 'head'] : ['head', ...Array<Part>(n - 2).fill('solo'), 'head'];
  const barTpls: string[] = [...intro];
  const parts: Part[] = intro.map(() => 'intro');
  const choruses: { bar: number; part: Part }[] = [];
  for (const kind of kinds) {
    choruses.push({ bar: barTpls.length, part: kind });
    for (const b of chorus) {
      barTpls.push(b);
      parts.push(kind);
    }
  }
  barTpls.push(form.ending, form.ending);
  parts.push('outro', 'outro');
  const beats: Chord[] = [];
  for (const b of barTpls) {
    const tokens = b.split(' ');
    const a = chordFromTemplate(key, tokens[0]);
    const c = tokens[1] ? chordFromTemplate(key, tokens[1]) : a;
    beats.push(a, a, c, c);
  }
  const tl: Timeline = { chordAt: (t) => beats[Math.max(0, Math.min(beats.length - 1, Math.floor(t + 1e-9)))] };
  const totalBars = barTpls.length;
  const outroBar = totalBars - 2;

  // ---- lead: one theme (head) and improvised solos
  const lead: Note[] = [];
  const centre = Math.round((range.lo + range.hi) / 2);
  const sectionMotifs = new Map<string, Motif>();
  const plans = new Map<string, Phrase[]>();
  const sectionStarts: { label: string; bar: number }[] = [];
  let off = 0;
  for (const label of form.order) {
    sectionStarts.push({ label, bar: off });
    off += form.sections[label].length;
  }
  for (const label of form.order) {
    if (plans.has(label)) continue;
    const family = label[0];
    let motif = sectionMotifs.get(family);
    if (!motif) {
      motif = makeMotif(rng, feel);
      sectionMotifs.set(family, motif);
    }
    const bars = form.sections[label].length;
    const sibling = [...plans.entries()].find(([l]) => l[0] === family)?.[1];
    // sections of one family share their opening phrases (A and A2)
    const opening = sibling ? sibling.filter((p) => p.start < 24 && !p.cadence) : themePlan(rng, motif, bars, 0);
    const close: (Motif & { at: number })[] = bars === 12 ? [] : [{ ...cadenceMotif(rng), at: 6 }];
    const plan: Phrase[] = [
      ...opening.map((p) => ({ ...p })),
      ...close.map((c) => ({ start: c.at * 4, rhythm: c.rhythm, steps: c.steps, first: c.first, cadence: true, approach: false })),
    ];
    plans.set(label, plan);
  }
  for (const c of choruses) {
    const startBeat = c.bar * 4;
    if (c.part === 'head') {
      for (const s of sectionStarts) {
        const base = startBeat + s.bar * 4;
        for (const p of plans.get(s.label)!) lead.push(...realize({ ...p, start: base + p.start }, tl, range.lo, range.hi, centre, null));
      }
    } else {
      let ref = centre;
      for (const p of soloPlan(rng, feel, startBeat, chorus.length * 4, [...sectionMotifs.values()])) {
        const notes = realize(p, tl, range.lo, range.hi, ref, rng);
        lead.push(...notes);
        if (notes.length) ref = Math.round((notes[notes.length - 1].m + centre) / 2);
      }
    }
  }
  const last = lead.length ? lead[lead.length - 1].m : centre;
  const endChord = tl.chordAt(outroBar * 4);
  const endTones = targetTones(endChord);
  lead.push({ t: outroBar * 4, d: 6, m: snapTo(last, endTones), v: 0.6 });
  legato(lead);
  for (const nt of lead) {
    while (nt.m > range.hi) nt.m -= 12;
    while (nt.m < range.lo) nt.m += 12;
  }

  // ---- keys
  const keys: Note[] = [];
  let voicing: number[] | null = null;
  let skipDownbeat = false;
  for (let bar = 0; bar < totalBars; bar++) {
    const cells: CompCell =
      bar >= outroBar
        ? bar === outroBar
          ? [[0, 14]]
          : []
        : feel === 'bossa'
          ? COMP.bossa[bar % 2]
          : bar === outroBar - 1 && feel !== 'ballad'
            ? [
                [0, 3],
                [3, 2],
              ]
            : rng.pick(COMP[feel]);
    const hits = cells.filter(([p]) => !(skipDownbeat && p === 0)).map(([p, d]) => [p, d] as [number, number]);
    skipDownbeat = false;
    const chords = [tl.chordAt(bar * 4), tl.chordAt(bar * 4 + 2)];
    if (chords[1].symbol !== chords[0].symbol && !hits.some(([p]) => p >= 4 && p < 8)) hits.push([4, 2]);
    hits.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < hits.length; i++) {
      const [p, d] = hits[i];
      const t = bar * 4 + p / 2;
      const anticipate = p === 7 && bar + 1 < totalBars;
      const ch = anticipate ? tl.chordAt(bar * 4 + 4) : tl.chordAt(t);
      if (anticipate) skipDownbeat = true;
      const nextP = i + 1 < hits.length ? hits[i + 1][0] : Infinity;
      const len = Math.min(d, nextP - p) / 2;
      voicing = voiceChord(ch, voicing);
      const v = 0.42 + (p % 2 === 0 ? 0.08 : 0.14) + rng.range(-0.05, 0.05);
      for (const m of voicing) keys.push({ t, d: len * 0.95, m, v, chord: ch.symbol });
    }
  }

  // ---- bass
  const bass: Note[] = [];
  let prevBass = 36;
  for (let bar = 0; bar < totalBars; bar++) {
    if (bar >= outroBar) {
      if (bar === outroBar)
        bass.push({ t: bar * 4, d: 6, m: nearestPitch(tl.chordAt(bar * 4).root, prevBass, RANGES.bass.lo, RANGES.bass.hi), v: 0.75 });
      continue;
    }
    prevBass = bassBar(rng, feel, bar, tl, prevBass, bass);
  }

  // ---- drums
  const drums: Hit[] = [];
  const chorusStarts = new Set(choruses.map((c) => c.bar));
  for (let bar = 0; bar < totalBars; bar++) {
    if (bar === outroBar) {
      drums.push({ t: bar * 4, k: 'crash', v: 0.5 }, { t: bar * 4, k: 'kick', v: 0.4 });
      continue;
    }
    if (bar > outroBar) continue;
    const fill = chorusStarts.has(bar + 1) || bar + 1 === outroBar;
    drumBar(rng, feel, bar, fill, chorusStarts.has(bar) && bar > 0, drums);
  }

  // ---- swing feel and sorting
  swingNotes(lead, swing);
  swingNotes(bass, swing);
  swingNotes(keys, swing);
  if (swing !== 0.5) for (const h of drums) h.t = swingTime(h.t, swing);
  const byTime = (a: { t: number }, b: { t: number }) => a.t - b.t;
  lead.sort(byTime);
  bass.sort(byTime);
  keys.sort(byTime);
  drums.sort(byTime);

  return {
    seed,
    title,
    form: form.name,
    feel,
    bpm,
    swing,
    key,
    mode: form.mode,
    leadVoice,
    beats,
    parts,
    choruses,
    lengthBeats: totalBars * 4,
    lead,
    bass,
    keys,
    drums,
  };
}

/** Length of a song in seconds. */
export function songSeconds(song: Song): number {
  return (song.lengthBeats * 60) / song.bpm;
}
