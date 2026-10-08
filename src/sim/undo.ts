/**
 * Undo for map actions (zoning, networks, buildings, bulldozing, trees and
 * terraforming). Before a plan is applied, the tiles it changes are recorded:
 * their layers, the terrain corners and the buildings on them. While it is
 * applied, the changes to the track networks (roads, rails, highways) are
 * recorded too. Undo puts it all back, removes anything built on those tiles
 * since, and refunds the cost.
 */
import type { Building } from './types';
import { applyPlan, type Plan } from './actions';
import type { Sim } from './sim';
import { DIRTY_ALL } from './world';
import { TRACK_KINDS, type TrackKind, type TrackLog } from './tracks/net';

export interface UndoEntry {
  /** What was done, for messages ("Road", "Bulldoze", …). */
  label: string;
  /** Game day of the action. */
  day: number;
  /** Money the action cost (given back on undo). */
  refund: number;
  /** Recorded tile indices and their layers before the action. */
  tiles: Int32Array;
  zone: Uint8Array;
  density: Uint8Array;
  net: Uint8Array;
  tree: Uint8Array;
  rubble: Uint8Array;
  landfill: Float32Array;
  /** Changed terrain corners: [corner index, old height]. */
  corners: [number, number][];
  /** Copies of the buildings that stood on the recorded tiles. */
  buildings: Building[];
  /** Changes to the track networks. */
  tracks: { kind: TrackKind; log: TrackLog }[];
}

/** Record everything a plan is about to change. */
export function captureUndo(sim: Sim, plan: Plan, label: string): UndoEntry {
  const w = sim.world;
  const tiles = new Set<number>();
  for (const t of plan.tiles) if (t.ok && t.change && w.inBounds(t.x, t.y)) tiles.add(w.idx(t.x, t.y));
  const corners: [number, number][] = [];
  const W = w.w + 1;
  for (const k of plan.corners ?? []) {
    corners.push([k, w.heights[k]]);
    const cx = k % W;
    const cy = (k / W) | 0;
    for (const [tx, ty] of [
      [cx - 1, cy - 1],
      [cx, cy - 1],
      [cx - 1, cy],
      [cx, cy],
    ]) {
      if (w.inBounds(tx, ty)) tiles.add(w.idx(tx, ty));
    }
  }
  // whole footprints: a bulldozer removes the entire building, not just the dragged tiles
  const buildings = new Map<number, Building>();
  for (const i of [...tiles]) {
    const id = w.bld[i];
    if (!id || buildings.has(id)) continue;
    const b = w.buildings.get(id);
    if (!b) continue;
    buildings.set(id, { ...b });
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) tiles.add(w.idx(x, y));
  }
  const list = Int32Array.from(tiles);
  const pick = <T extends Uint8Array | Float32Array>(layer: T, out: T): T => {
    list.forEach((i, k) => (out[k] = layer[i]));
    return out;
  };
  const n = list.length;
  return {
    label,
    day: sim.city.day,
    refund: 0,
    tiles: list,
    zone: pick(w.zone, new Uint8Array(n)),
    density: pick(w.density, new Uint8Array(n)),
    net: pick(w.net, new Uint8Array(n)),
    tree: pick(w.tree, new Uint8Array(n)),
    rubble: pick(w.rubble, new Uint8Array(n)),
    landfill: pick(w.landfill, new Float32Array(n)),
    corners,
    buildings: [...buildings.values()],
    tracks: [],
  };
}

/** Put the recorded tiles, corners and buildings back and refund the cost. */
export function restoreUndo(sim: Sim, e: UndoEntry): void {
  const w = sim.world;
  const known = new Set(e.buildings.map((b) => b.id));
  const remove = (id: number) => {
    const b = w.removeBuilding(id);
    if (b) sim.events.emit('building', { type: 'remove', b });
  };
  // anything built on these tiles since the action goes
  for (const i of e.tiles) {
    const id = w.bld[i];
    if (id && !known.has(id)) remove(id);
  }
  // buildings that were removed (or redeveloped) come back
  for (const old of e.buildings) {
    if (w.buildings.has(old.id)) continue;
    for (let y = old.y; y < old.y + old.h; y++) {
      for (let x = old.x; x < old.x + old.w; x++) {
        const id = w.bld[w.idx(x, y)];
        if (id) remove(id);
      }
    }
    const b = w.putBuilding({ ...old });
    sim.events.emit('building', { type: 'add', b });
  }
  e.tiles.forEach((i, k) => {
    w.zone[i] = e.zone[k];
    w.density[i] = e.density[k];
    w.net[i] = e.net[k];
    w.tree[i] = e.tree[k];
    w.rubble[i] = e.rubble[k];
    w.landfill[i] = e.landfill[k];
    const x = i % w.w;
    const y = (i / w.w) | 0;
    w.markArea(x, y, x, y, DIRTY_ALL);
  });
  for (const { kind, log } of e.tracks) w.tracks[kind].revert(log);
  w.syncTracks();
  if (e.corners.length) {
    const W = w.w + 1;
    for (const [k, v] of e.corners) {
      w.heights[k] = v;
      const cx = k % W;
      const cy = (k / W) | 0;
      w.markArea(cx - 1, cy - 1, cx, cy, DIRTY_ALL);
    }
    w.heightsDirty = true;
    sim.dirty.land = true;
  }
  w.tilesDirty = true;
  w.roadVersion++;
  w.buildVersion++;
  const d = sim.dirty;
  d.roads = d.power = d.water = d.coverage = true;
  if (e.refund > 0) {
    sim.city.funds += e.refund;
    sim.events.emit('funds', sim.city.funds);
  }
}

/** The most recent map actions, newest last. */
export class UndoStack {
  private entries: UndoEntry[] = [];

  constructor(private limit = 25) {}

  get size(): number {
    return this.entries.length;
  }

  /** The action that the next undo reverts. */
  peek(): UndoEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  clear(): void {
    this.entries = [];
  }

  /** Apply a plan and remember how to revert it. Returns false if the plan could not be applied. */
  apply(sim: Sim, plan: Plan, label: string): boolean {
    if (!plan.ok) return false;
    const entry = captureUndo(sim, plan, label);
    const before = sim.city.funds;
    const nets = TRACK_KINDS.map((kind) => ({ kind, net: sim.world.tracks[kind] }));
    for (const { net } of nets) net.begin();
    let applied: boolean;
    try {
      applied = applyPlan(plan);
    } finally {
      for (const { kind, net } of nets) {
        const log = net.commit();
        if (log.ops.length) entry.tracks.push({ kind, log });
      }
    }
    if (!applied) return false;
    entry.refund = Math.max(0, before - sim.city.funds);
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.shift();
    return true;
  }

  /** Revert the most recent action. Returns it, or null if there is nothing to undo. */
  undo(sim: Sim): UndoEntry | null {
    const e = this.entries.pop();
    if (!e) return null;
    restoreUndo(sim, e);
    return e;
  }
}
