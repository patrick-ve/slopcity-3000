import { World } from './world';
import { Sim, type CityState } from './sim';
import type { Building } from './types';
import { DEFS } from './catalog';

export const SAVE_VERSION = 1;

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

const BUILDING_KEYS: (keyof Building)[] = ['id', 'def', 'x', 'y', 'w', 'h', 'rot', 'variant', 'seed', 'pop', 'build', 'abandoned', 'fire', 'age', 'unhappy'];

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
      heights: b64(w.heights),
      zone: b64(w.zone),
      density: b64(w.density),
      net: b64(w.net),
      tree: b64(w.tree),
      rubble: b64(w.rubble),
      landfill: b64(new Uint8Array(w.landfill.buffer.slice(0))),
    },
    buildings: [...w.buildings.values()].map((b) => BUILDING_KEYS.map((k) => (typeof b[k] === 'boolean' ? (b[k] ? 1 : 0) : (b[k] as number | string)))),
    nextId: w.nextId,
    city: sim.city,
    rng: sim.rng.state,
  };
  return JSON.stringify(file);
}

export function deserialize(json: string): Sim {
  const file = JSON.parse(json) as SaveFile;
  if (file.app !== 'slopcity') throw new Error('Not a SlopCity save file');
  if (file.version > SAVE_VERSION) throw new Error('Save file is from a newer version');
  const w = new World(file.w, file.h);
  w.seaLevel = file.seaLevel;
  w.heights.set(unb64(file.layers.heights));
  w.zone.set(unb64(file.layers.zone));
  w.density.set(unb64(file.layers.density));
  w.net.set(unb64(file.layers.net));
  w.tree.set(unb64(file.layers.tree));
  w.rubble.set(unb64(file.layers.rubble));
  w.landfill.set(new Float32Array(unb64(file.layers.landfill).buffer));
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
