import { World } from './world';
import { Sim, type CityState } from './sim';
import type { Building } from './types';
import { DEFS } from './catalog';

/** Current save format. Bump it (and add a migration) whenever the format changes. */
export const SAVE_VERSION = 3;

interface SaveFile {
  version: number;
  app: 'slopcity';
  savedAt: string;
  w: number;
  h: number;
  seaLevel: number;
  layers: Record<string, string>;
  buildings: (number | string)[][];
  nextId: number;
  city: CityState;
  rng: number;
}

function b64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

function unb64(str: string): Uint8Array {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Run-length encoding: pairs of (run length 1..255, value). */
function rle(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < bytes.length;) {
    const v = bytes[i];
    let n = 1;
    while (n < 255 && i + n < bytes.length && bytes[i + n] === v) n++;
    out.push(n, v);
    i += n;
  }
  return Uint8Array.from(out);
}

function unrle(packed: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i + 1 < packed.length && o < length; i += 2) {
    out.fill(packed[i + 1], o, Math.min(length, o + packed[i]));
    o += packed[i];
  }
  return out;
}

/** A map layer as text: run-length encoded when that is smaller (most layers are mostly empty). */
function packLayer(bytes: Uint8Array): string {
  const packed = rle(bytes);
  return packed.length < bytes.length * 0.9 ? `rle:${b64(packed)}` : b64(bytes);
}

function unpackLayer(text: string, length: number): Uint8Array {
  return text.startsWith('rle:') ? unrle(unb64(text.slice(4)), length) : unb64(text);
}

const BUILDING_KEYS: (keyof Building)[] = [
  'id',
  'def',
  'x',
  'y',
  'w',
  'h',
  'rot',
  'variant',
  'seed',
  'pop',
  'build',
  'abandoned',
  'fire',
  'age',
  'unhappy',
];

export function serialize(sim: Sim): string {
  const w = sim.world;
  const file: SaveFile = {
    version: SAVE_VERSION,
    app: 'slopcity',
    savedAt: new Date().toISOString(),
    w: w.w,
    h: w.h,
    seaLevel: w.seaLevel,
    layers: {
      heights: packLayer(w.heights),
      zone: packLayer(w.zone),
      density: packLayer(w.density),
      net: packLayer(w.net),
      tree: packLayer(w.tree),
      rubble: packLayer(w.rubble),
      landfill: packLayer(new Uint8Array(w.landfill.buffer.slice(0))),
    },
    buildings: [...w.buildings.values()].map((b) =>
      BUILDING_KEYS.map((k) => (typeof b[k] === 'boolean' ? (b[k] ? 1 : 0) : (b[k] as number | string))),
    ),
    nextId: w.nextId,
    city: sim.city,
    rng: sim.rng.state,
  };
  return JSON.stringify(file);
}

/** A save file of any version, before migration. */
type OldSave = { version: number; app?: string; city?: Record<string, unknown> } & Record<string, unknown>;

/**
 * Upgrade steps for old save files: MIGRATIONS[v] turns a version v file into
 * version v + 1. Steps run in order, so a file from any older version loads.
 */
const MIGRATIONS: Record<number, (file: OldSave) => void> = {
  // v2: sandbox mode and scenarios
  1: (file) => {
    const city = (file.city ??= {});
    city.sandbox ??= false;
    city.scenario ??= null;
  },
  // v3: map layers may be run-length encoded ("rle:" prefix); plain base64 layers stay valid
  2: () => {},
};

/** Bring a parsed save file up to SAVE_VERSION. */
export function migrate(raw: unknown): SaveFile {
  const file = raw as OldSave;
  if (!file || typeof file !== 'object' || file.app !== 'slopcity') throw new Error('Not a SlopCity save file');
  if (typeof file.version !== 'number' || file.version < 1) throw new Error('Unknown save file version');
  if (file.version > SAVE_VERSION) throw new Error('This save file is from a newer version of SlopCity 3000');
  for (let v = file.version; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`Cannot upgrade a version ${v} save file`);
    step(file);
    file.version = v + 1;
  }
  return file as unknown as SaveFile;
}

export function deserialize(json: string): Sim {
  const file = migrate(JSON.parse(json));
  const w = new World(file.w, file.h);
  w.seaLevel = file.seaLevel;
  const n = w.size;
  w.heights.set(unpackLayer(file.layers.heights, w.heights.length));
  w.zone.set(unpackLayer(file.layers.zone, n));
  w.density.set(unpackLayer(file.layers.density, n));
  w.net.set(unpackLayer(file.layers.net, n));
  w.tree.set(unpackLayer(file.layers.tree, n));
  w.rubble.set(unpackLayer(file.layers.rubble, n));
  w.landfill.set(new Float32Array(unpackLayer(file.layers.landfill, n * 4).buffer));
  for (const row of file.buildings) {
    const b = {} as Record<string, unknown>;
    BUILDING_KEYS.forEach((k, i) => (b[k] = row[i]));
    b.abandoned = !!b.abandoned;
    b.powered = false;
    b.watered = false;
    const bb = b as unknown as Building;
    if (!DEFS[bb.def]) continue;
    w.buildings.set(bb.id, bb);
    for (let y = bb.y; y < bb.y + bb.h; y++) for (let x = bb.x; x < bb.x + bb.w; x++) w.bld[w.idx(x, y)] = bb.id;
  }
  w.nextId = file.nextId;
  const city = file.city;
  const sim = new Sim(w, { name: city.name, mayor: city.mayor, startYear: city.startYear, difficulty: city.difficulty, seed: city.seed });
  sim.city = { ...sim.city, ...city };
  sim.rng.state = file.rng;
  w.markAllDirty();
  sim.recompute(true);
  return sim;
}

// ----------------------------------------------------------- local storage

const KEY_PREFIX = 'slopcity.save.';
const INDEX_KEY = 'slopcity.saves';

export interface SaveSlot {
  slot: string;
  name: string;
  population: number;
  date: string;
  savedAt: string;
}

export function listSaves(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as SaveSlot[]) : [];
  } catch {
    return [];
  }
}

export function saveToSlot(sim: Sim, slot: string, dateLabel: string): boolean {
  try {
    localStorage.setItem(KEY_PREFIX + slot, serialize(sim));
    const list = listSaves().filter((s) => s.slot !== slot);
    list.unshift({ slot, name: sim.city.name, population: sim.stats.residents, date: dateLabel, savedAt: new Date().toISOString() });
    localStorage.setItem(INDEX_KEY, JSON.stringify(list.slice(0, 12)));
    return true;
  } catch (e) {
    console.error('Save failed', e);
    return false;
  }
}

export function loadFromSlot(slot: string): Sim | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + slot);
    return raw ? deserialize(raw) : null;
  } catch (e) {
    console.error('Load failed', e);
    return null;
  }
}

export function deleteSlot(slot: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + slot);
    localStorage.setItem(INDEX_KEY, JSON.stringify(listSaves().filter((s) => s.slot !== slot)));
  } catch {
    /* ignore */
  }
}
