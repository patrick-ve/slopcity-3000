import { NET, SERVICE_KINDS, type Building, type ServiceKind, type ZoneKind } from './types';
import { getDef, type BuildingDef } from './catalog';
import { TRACK_KINDS, TrackNet, type TrackKind } from './tracks/net';

/** World height of one terrain level (tile size is 1). */
export const LEVEL_H = 0.25;
/** Chunk size in tiles (render batching). */
export const CHUNK = 16;
export const MAX_LEVEL = 40;

/** Chunk dirty flags. */
export const DIRTY_GROUND = 1;
export const DIRTY_OBJECTS = 2;
export const DIRTY_PIPES = 4;
export const DIRTY_ALL = 7;

/** Direction bits for connectivity masks: N (y-1), E (x+1), S (y+1), W (x-1). */
export const DIR_N = 1;
export const DIR_E = 2;
export const DIR_S = 4;
export const DIR_W = 8;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export class World {
  readonly w: number;
  readonly h: number;
  readonly size: number;
  seaLevel = 4;

  /** Corner heights, (w+1)*(h+1), in levels. */
  heights: Uint8Array;
  zone: Uint8Array;
  density: Uint8Array;
  /** Building id per tile (0 = none). */
  bld: Int32Array;
  /** NET bit flags per tile. */
  net: Uint8Array;
  /** Tree density 0..3. */
  tree: Uint8Array;
  rubble: Uint8Array;
  /** Tons of garbage stored on landfill tiles. */
  landfill: Float32Array;

  // ---- simulation fields (0..1 unless noted)
  landValue: Float32Array;
  pollution: Float32Array;
  crime: Float32Array;
  /** Commuter trips per road tile (raw count). */
  trips: Float32Array;
  /** Congestion 0..1+ per road tile. */
  traffic: Float32Array;
  /** Congestion 0..1+ per highway tile. */
  hwyTraffic: Float32Array;
  powered: Uint8Array;
  watered: Uint8Array;
  /** Manhattan distance to the nearest road (255 = none within range). */
  roadDist: Uint8Array;
  /** Index of the nearest road tile (-1 = none). */
  nearestRoad: Int32Array;
  fireRisk: Float32Array;
  popDensity: Float32Array;
  cover: Record<ServiceKind, Float32Array>;

  buildings = new Map<number, Building>();
  nextId = 1;
  /** Roads, rails and highways as curves; their NET bits follow the tiles they cover (see syncTracks). */
  readonly tracks: Record<TrackKind, TrackNet>;

  // ---- change tracking for the renderer
  readonly chunksX: number;
  readonly chunksY: number;
  dirtyChunks = new Map<number, number>();
  tilesDirty = true;
  heightsDirty = true;
  /** Bumped whenever the road network changes (for traffic/cars). */
  roadVersion = 0;
  /** Bumped whenever buildings change. */
  buildVersion = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.size = w * h;
    const n = w * h;
    this.heights = new Uint8Array((w + 1) * (h + 1));
    this.zone = new Uint8Array(n);
    this.density = new Uint8Array(n);
    this.bld = new Int32Array(n);
    this.net = new Uint8Array(n);
    this.tree = new Uint8Array(n);
    this.rubble = new Uint8Array(n);
    this.landfill = new Float32Array(n);
    this.landValue = new Float32Array(n);
    this.pollution = new Float32Array(n);
    this.crime = new Float32Array(n);
    this.trips = new Float32Array(n);
    this.traffic = new Float32Array(n);
    this.hwyTraffic = new Float32Array(n);
    this.powered = new Uint8Array(n);
    this.watered = new Uint8Array(n);
    this.roadDist = new Uint8Array(n).fill(255);
    this.nearestRoad = new Int32Array(n).fill(-1);
    this.fireRisk = new Float32Array(n);
    this.popDensity = new Float32Array(n);
    this.cover = {} as Record<ServiceKind, Float32Array>;
    for (const k of SERVICE_KINDS) this.cover[k] = new Float32Array(n);
    this.chunksX = Math.ceil(w / CHUNK);
    this.chunksY = Math.ceil(h / CHUNK);
    this.tracks = { road: new TrackNet('road', w, h), rail: new TrackNet('rail', w, h), highway: new TrackNet('highway', w, h) };
  }

  // ------------------------------------------------------------- indexing

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  corner(cx: number, cy: number): number {
    return this.heights[cy * (this.w + 1) + cx];
  }

  setCorner(cx: number, cy: number, v: number): void {
    this.heights[cy * (this.w + 1) + cx] = v;
  }

  // -------------------------------------------------------------- terrain

  /** Corner heights of a tile: [h00, h10, h11, h01] (x,y)=(0,0),(1,0),(1,1),(0,1). */
  tileCorners(x: number, y: number): [number, number, number, number] {
    const W = this.w + 1;
    const H = this.heights;
    const i = y * W + x;
    return [H[i], H[i + 1], H[i + W + 1], H[i + W]];
  }

  tileMin(x: number, y: number): number {
    const c = this.tileCorners(x, y);
    return Math.min(c[0], c[1], c[2], c[3]);
  }

  tileMax(x: number, y: number): number {
    const c = this.tileCorners(x, y);
    return Math.max(c[0], c[1], c[2], c[3]);
  }

  isWater(x: number, y: number): boolean {
    return this.tileMin(x, y) < this.seaLevel;
  }

  isWaterIdx(i: number): boolean {
    return this.isWater(i % this.w, (i / this.w) | 0);
  }

  isFlat(x: number, y: number): boolean {
    const c = this.tileCorners(x, y);
    return c[0] === c[1] && c[1] === c[2] && c[2] === c[3];
  }

  /** True if the tile is split along the (0,0)-(1,1) diagonal. */
  splitsMain(x: number, y: number): boolean {
    const [a, b, c, d] = this.tileCorners(x, y);
    if (a === c) return true;
    if (b === d) return false;
    return true;
  }

  /** Exact surface height (levels) of the triangulated terrain at world (fx, fz). */
  heightAt(fx: number, fz: number): number {
    const x = Math.min(this.w - 1, Math.max(0, Math.floor(fx)));
    const y = Math.min(this.h - 1, Math.max(0, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - x));
    const v = Math.min(1, Math.max(0, fz - y));
    const [h00, h10, h11, h01] = this.tileCorners(x, y);
    if (this.splitsMain(x, y)) {
      // triangles (00,10,11) where u>=v and (00,11,01) where v>u
      if (u >= v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
      return h00 + (h11 - h01) * u + (h01 - h00) * v;
    }
    // split along 10-01: triangles (00,10,01) where u+v<=1 and (10,11,01)
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  surfaceY(fx: number, fz: number): number {
    return this.heightAt(fx, fz) * LEVEL_H;
  }

  /** Max corner level over a footprint (building base level). */
  footprintMax(x0: number, y0: number, w: number, h: number): number {
    let m = 0;
    for (let y = y0; y <= y0 + h; y++) for (let x = x0; x <= x0 + w; x++) m = Math.max(m, this.corner(x, y));
    return m;
  }

  footprintMin(x0: number, y0: number, w: number, h: number): number {
    let m = 255;
    for (let y = y0; y <= y0 + h; y++) for (let x = x0; x <= x0 + w; x++) m = Math.min(m, this.corner(x, y));
    return m;
  }

  /** True if any tile in the footprint is water. */
  footprintHasWater(x0: number, y0: number, w: number, h: number): boolean {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.isWater(x, y)) return true;
    return false;
  }

  /** Land tile next to (4-neighbour) a water tile. */
  touchesWater(x0: number, y0: number, w: number, h: number): boolean {
    for (let y = y0 - 1; y <= y0 + h; y++) {
      for (let x = x0 - 1; x <= x0 + w; x++) {
        const inside = x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
        if (inside || !this.inBounds(x, y)) continue;
        const corner = (x < x0 || x >= x0 + w) && (y < y0 || y >= y0 + h);
        if (corner) continue;
        if (this.isWater(x, y)) return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------- networks

  hasNet(x: number, y: number, flag: number): boolean {
    return this.inBounds(x, y) && (this.net[this.idx(x, y)] & flag) !== 0;
  }

  /** Connectivity mask of a network flag around (x, y). */
  netMask(x: number, y: number, flag: number): number {
    let m = 0;
    if (this.hasNet(x, y - 1, flag)) m |= DIR_N;
    if (this.hasNet(x + 1, y, flag)) m |= DIR_E;
    if (this.hasNet(x, y + 1, flag)) m |= DIR_S;
    if (this.hasNet(x - 1, y, flag)) m |= DIR_W;
    return m;
  }

  isRoad(i: number): boolean {
    return (this.net[i] & NET.ROAD) !== 0;
  }

  /**
   * Bring the NET bits of roads, rails and highways in line with the tiles
   * their track covers, clear what new track runs over (zones, trees, rubble)
   * and mark the changed chunks for redrawing. Returns true if anything changed.
   */
  syncTracks(): boolean {
    let changed = false;
    for (const kind of TRACK_KINDS) {
      const net = this.tracks[kind];
      if (!net.flips.size && !net.touched.size) continue;
      changed = true;
      const flag = net.profile.flag;
      for (const i of net.flips.keys()) {
        if (net.cover[i] > 0) {
          if (this.net[i] & flag) continue;
          this.net[i] |= flag;
          this.tree[i] = 0;
          this.rubble[i] = 0;
          if (this.zone[i]) this.setZone(i % this.w, (i / this.w) | 0, 0, 0);
        } else {
          this.net[i] &= ~flag;
        }
      }
      for (const i of net.touched) {
        const x = i % this.w;
        const y = (i / this.w) | 0;
        this.markArea(x, y, x, y, DIRTY_GROUND | DIRTY_OBJECTS);
      }
      net.flips.clear();
      net.touched.clear();
    }
    if (changed) {
      this.tilesDirty = true;
      this.roadVersion++;
    }
    return changed;
  }

  // ------------------------------------------------------------ buildings

  buildingAt(x: number, y: number): Building | undefined {
    if (!this.inBounds(x, y)) return undefined;
    const id = this.bld[this.idx(x, y)];
    return id ? this.buildings.get(id) : undefined;
  }

  defOf(b: Building): BuildingDef {
    return getDef(b.def);
  }

  addBuilding(b: Omit<Building, 'id'>): Building {
    return this.putBuilding({ ...b, id: this.nextId++ });
  }

  /** Insert a building that already has an id (undo, loading). */
  putBuilding(full: Building): Building {
    this.buildings.set(full.id, full);
    this.nextId = Math.max(this.nextId, full.id + 1);
    for (let y = full.y; y < full.y + full.h; y++) {
      for (let x = full.x; x < full.x + full.w; x++) {
        const i = this.idx(x, y);
        this.bld[i] = full.id;
        this.tree[i] = 0;
        this.rubble[i] = 0;
      }
    }
    this.markArea(full.x, full.y, full.x + full.w - 1, full.y + full.h - 1, DIRTY_OBJECTS | DIRTY_GROUND);
    this.tilesDirty = true;
    this.buildVersion++;
    return full;
  }

  removeBuilding(id: number): Building | undefined {
    const b = this.buildings.get(id);
    if (!b) return undefined;
    this.buildings.delete(id);
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const i = this.idx(x, y);
        if (this.bld[i] === id) this.bld[i] = 0;
      }
    }
    this.markArea(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, DIRTY_OBJECTS | DIRTY_GROUND);
    this.tilesDirty = true;
    this.buildVersion++;
    return b;
  }

  // -------------------------------------------------------- dirty tracking

  chunkOf(x: number, y: number): number {
    return Math.floor(y / CHUNK) * this.chunksX + Math.floor(x / CHUNK);
  }

  markDirty(x: number, y: number, flags: number): void {
    if (!this.inBounds(x, y)) return;
    const c = this.chunkOf(x, y);
    this.dirtyChunks.set(c, (this.dirtyChunks.get(c) ?? 0) | flags);
  }

  /** Mark an inclusive tile rectangle (plus a 1-tile border for connectivity). */
  markArea(x0: number, y0: number, x1: number, y1: number, flags: number): void {
    const cx0 = Math.floor(Math.max(0, x0 - 1) / CHUNK);
    const cy0 = Math.floor(Math.max(0, y0 - 1) / CHUNK);
    const cx1 = Math.floor(Math.min(this.w - 1, x1 + 1) / CHUNK);
    const cy1 = Math.floor(Math.min(this.h - 1, y1 + 1) / CHUNK);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = cy * this.chunksX + cx;
        this.dirtyChunks.set(c, (this.dirtyChunks.get(c) ?? 0) | flags);
      }
    }
  }

  markAllDirty(): void {
    for (let c = 0; c < this.chunksX * this.chunksY; c++) this.dirtyChunks.set(c, DIRTY_ALL);
    this.tilesDirty = true;
    this.heightsDirty = true;
  }

  // ---------------------------------------------------------------- zones

  setZone(x: number, y: number, zone: ZoneKind, density: number): void {
    const i = this.idx(x, y);
    this.zone[i] = zone;
    this.density[i] = zone === 0 ? 0 : density;
    this.tilesDirty = true;
    this.markDirty(x, y, DIRTY_OBJECTS);
  }
}
