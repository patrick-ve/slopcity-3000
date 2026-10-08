/**
 * Player actions. Each action has a `plan*` function (validation + cost,
 * used for the live preview) and is applied with `applyPlan`.
 */
import { NET, type ZoneKind } from './types';
import { COSTS, getDef, LINE_YEARS, type BuildingDef } from './catalog';
import type { Sim } from './sim';
import { DIRTY_GROUND, DIRTY_OBJECTS, DIRTY_PIPES, MAX_LEVEL } from './world';
import { faceRoad } from './growth';

export type LineKind = 'road' | 'rail' | 'power' | 'pipe' | 'highway' | 'subway';

/** Network flag of each line kind. */
export const LINE_FLAGS: Record<LineKind, number> = {
  road: NET.ROAD,
  rail: NET.RAIL,
  power: NET.POWER,
  pipe: NET.PIPE,
  highway: NET.HIGHWAY,
  subway: NET.SUBWAY,
};

/** Surface networks that block zones, buildings and trees. */
export const SURFACE_NET = NET.ROAD | NET.RAIL | NET.POWER | NET.HIGHWAY;
/** Networks under the ground (kept by the surface bulldozer). */
export const UNDERGROUND_NET = NET.PIPE | NET.SUBWAY;
/** Networks that pin the terrain corners under them. */
const FIXED_NET = NET.ROAD | NET.RAIL | NET.HIGHWAY;

export interface PlanTile {
  x: number;
  y: number;
  ok: boolean;
  /** Tile will change (costs money). */
  change: boolean;
}

export interface Plan {
  kind: string;
  tiles: PlanTile[];
  cost: number;
  ok: boolean;
  reason?: string;
  apply: () => void;
  /** Terrain corner indices the plan changes (terraforming). */
  corners?: number[];
  /** For building placement. */
  def?: BuildingDef;
  x?: number;
  y?: number;
  rot?: number;
  /** Footprint (rotated). */
  w?: number;
  h?: number;
}

function finish(sim: Sim, kind: string, tiles: PlanTile[], cost: number, apply: () => void, reason?: string): Plan {
  const anyChange = tiles.some((t) => t.change && t.ok);
  let ok = anyChange && !reason;
  if (ok && !sim.canAfford(cost)) {
    ok = false;
    reason = 'Not enough money';
  }
  return { kind, tiles, cost, ok, reason: ok ? undefined : (reason ?? (anyChange ? undefined : 'Nothing to do here')), apply };
}

function rectTiles(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const ax = Math.min(x0, x1);
  const bx = Math.max(x0, x1);
  const ay = Math.min(y0, y1);
  const by = Math.max(y0, y1);
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) out.push([x, y]);
  return out;
}

/** L-shaped path from a to b (major axis first unless `flip`). */
export function linePath(x0: number, y0: number, x1: number, y1: number, flip = false): [number, number][] {
  const out: [number, number][] = [];
  const horizontalFirst = flip ? Math.abs(y1 - y0) > Math.abs(x1 - x0) : Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  let x = x0;
  let y = y0;
  out.push([x, y]);
  const stepX = () => {
    while (x !== x1) {
      x += Math.sign(x1 - x);
      out.push([x, y]);
    }
  };
  const stepY = () => {
    while (y !== y1) {
      y += Math.sign(y1 - y);
      out.push([x, y]);
    }
  };
  if (horizontalFirst) {
    stepX();
    stepY();
  } else {
    stepY();
    stepX();
  }
  return out;
}

// ------------------------------------------------------------------ zoning

export function planZone(sim: Sim, x0: number, y0: number, x1: number, y1: number, zone: ZoneKind, density: number): Plan {
  const w = sim.world;
  const tiles: PlanTile[] = [];
  let cost = 0;
  const per = zone === 4 ? COSTS.landfill : COSTS.zone[density];
  for (const [x, y] of rectTiles(x0, y0, x1, y1)) {
    if (!w.inBounds(x, y)) continue;
    const i = w.idx(x, y);
    let ok = !w.isWater(x, y) && !(w.net[i] & SURFACE_NET) && w.tileMax(x, y) - w.tileMin(x, y) <= 2;
    const b = w.buildingAt(x, y);
    if (b) {
      const def = getDef(b.def);
      if (!def.growable || def.zone !== zone) ok = false;
    }
    if (zone === 4 && b) ok = false;
    const change = ok && (w.zone[i] !== zone || w.density[i] !== (zone === 4 ? 1 : density));
    if (change) cost += per;
    tiles.push({ x, y, ok, change });
  }
  return finish(sim, 'zone', tiles, cost, () => {
    if (!sim.spend(cost)) return;
    for (const t of tiles) if (t.ok && t.change) w.setZone(t.x, t.y, zone, zone === 4 ? 1 : density);
    sim.dirty.power = true;
    sim.events.emit('sound', 'zone');
  });
}

export function planDezone(sim: Sim, x0: number, y0: number, x1: number, y1: number): Plan {
  const w = sim.world;
  const tiles: PlanTile[] = [];
  let cost = 0;
  for (const [x, y] of rectTiles(x0, y0, x1, y1)) {
    if (!w.inBounds(x, y)) continue;
    const i = w.idx(x, y);
    const ok = !w.bld[i];
    const change = ok && w.zone[i] !== 0;
    if (change) cost += COSTS.dezone;
    tiles.push({ x, y, ok, change });
  }
  return finish(sim, 'dezone', tiles, cost, () => {
    if (!sim.spend(cost)) return;
    for (const t of tiles) {
      if (!t.change) continue;
      w.setZone(t.x, t.y, 0, 0);
      w.landfill[w.idx(t.x, t.y)] = 0;
    }
    sim.dirty.power = true;
    sim.events.emit('sound', 'bulldoze');
  });
}

// --------------------------------------------------------------- networks

function axisAt(path: [number, number][], k: number): 'x' | 'y' | 'both' {
  const [x, y] = path[k];
  const dirs = new Set<string>();
  for (const j of [k - 1, k + 1]) {
    if (j < 0 || j >= path.length) continue;
    dirs.add(path[j][0] !== x ? 'x' : path[j][1] !== y ? 'y' : '');
  }
  dirs.delete('');
  if (dirs.size === 1) return [...dirs][0] as 'x' | 'y';
  return 'both';
}

/** Axis of an existing straight network piece, or null if not straight. */
function straightAxis(sim: Sim, x: number, y: number, flag: number): 'x' | 'y' | null {
  const w = sim.world;
  const ew = w.hasNet(x - 1, y, flag) || w.hasNet(x + 1, y, flag);
  const ns = w.hasNet(x, y - 1, flag) || w.hasNet(x, y + 1, flag);
  if (ew && !ns) return 'x';
  if (ns && !ew) return 'y';
  if (!ew && !ns) return null;
  return null;
}

export function planLine(sim: Sim, kind: LineKind, path: [number, number][]): Plan {
  const w = sim.world;
  const flag = LINE_FLAGS[kind];
  const tiles: PlanTile[] = [];
  let cost = 0;
  let reason: string | undefined;
  const year = LINE_YEARS[kind];
  const tooEarly = !sim.city.sandbox && year !== undefined && sim.year < year;
  if (tooEarly) reason = `Available in ${year}`;
  for (let k = 0; k < path.length; k++) {
    const [x, y] = path[k];
    if (!w.inBounds(x, y)) continue;
    const i = w.idx(x, y);
    const water = w.isWater(x, y);
    let ok = true;
    let tileCost: number;
    const has = (w.net[i] & flag) !== 0;
    const b = w.buildingAt(x, y);
    if (kind === 'pipe') {
      ok = !water;
      tileCost = COSTS.pipe;
    } else if (kind === 'subway') {
      tileCost = water ? COSTS.subwayUnderWater : COSTS.subway;
    } else if (kind === 'highway') {
      // elevated: crosses roads, rails, slopes and water, but not buildings
      if (b) {
        ok = false;
        reason ??= 'Blocked by a building';
      }
      tileCost = water ? COSTS.highwayBridge : COSTS.highway;
    } else if (kind === 'power') {
      ok = !b;
      tileCost = water ? COSTS.powerLine * 2 : COSTS.powerLine;
      if (b) reason ??= 'Buildings conduct power already';
    } else {
      // road / rail
      if (b) {
        ok = false;
        reason ??= 'Blocked by a building';
      }
      if (w.tileMax(x, y) - w.tileMin(x, y) > 2) {
        ok = false;
        reason ??= 'Too steep';
      }
      const other = kind === 'road' ? NET.RAIL : NET.ROAD;
      const axis = axisAt(path, k);
      if (w.net[i] & other) {
        const oa = straightAxis(sim, x, y, other);
        if (!oa || axis === 'both' || axis === oa) {
          ok = false;
          reason ??= 'Crossings must be straight and perpendicular';
        }
      }
      if (water) {
        if (axis === 'both' || w.tileMin(x, y) < w.seaLevel - 3) {
          ok = false;
          reason ??= 'Bridges must be straight';
        }
        tileCost = kind === 'road' ? COSTS.bridge : COSTS.railBridge;
      } else {
        tileCost = kind === 'road' ? COSTS.road : COSTS.rail;
      }
    }
    if (tooEarly) ok = false;
    const change = ok && !has;
    if (change) cost += tileCost;
    tiles.push({ x, y, ok, change });
  }
  if (kind === 'road' || kind === 'rail' || kind === 'highway') {
    // a bridge must not end on water: the first/last path tile must be land unless connecting to existing network
    const first = path[0];
    const last = path[path.length - 1];
    for (const [x, y] of [first, last]) {
      if (w.inBounds(x, y) && w.isWater(x, y) && !w.hasNet(x, y, flag)) {
        const t = tiles.find((tt) => tt.x === x && tt.y === y);
        if (t) {
          t.ok = false;
          reason ??= 'Bridges must end on land';
        }
      }
    }
  }
  return finish(
    sim,
    kind,
    tiles,
    cost,
    () => {
      if (!sim.spend(cost)) return;
      for (const t of tiles) {
        if (!t.ok || !t.change) continue;
        const i = w.idx(t.x, t.y);
        w.net[i] |= flag;
        const underground = kind === 'pipe' || kind === 'subway';
        if (!underground) {
          w.tree[i] = 0;
          w.rubble[i] = 0;
          if (w.zone[i]) w.setZone(t.x, t.y, 0, 0);
        }
        w.markArea(t.x, t.y, t.x, t.y, underground ? DIRTY_PIPES : DIRTY_GROUND | DIRTY_OBJECTS);
      }
      w.tilesDirty = true;
      // the commute graph uses roads, highways and subways
      if (kind === 'road' || kind === 'highway' || kind === 'subway') sim.dirty.roads = true;
      if (kind === 'road' || kind === 'rail' || kind === 'highway') w.roadVersion++;
      sim.dirty.power = true;
      sim.dirty.water = true;
      sim.events.emit('sound', 'build');
    },
    reason,
  );
}

// ------------------------------------------------------------- buildings

export function isAvailable(sim: Sim, def: BuildingDef): { ok: boolean; why?: string } {
  if (def.id === 'nuclear_plant' && sim.city.ordinances.nuclear_free)
    return { ok: false, why: 'Banned by the Nuclear Free Zone ordinance' };
  // sandbox mode: everything is unlocked, and rewards can be built more than once
  if (sim.city.sandbox) return { ok: true };
  if (def.year && sim.year < def.year) return { ok: false, why: `Available in ${def.year}` };
  if (def.reward && !sim.city.unlocked.includes(def.id))
    return { ok: false, why: `Unlocks at ${def.reward.toLocaleString('en-US')} residents` };
  if (def.reward && def.id !== 'arcology') {
    for (const b of sim.world.buildings.values()) if (b.def === def.id) return { ok: false, why: 'Already built' };
  }
  return { ok: true };
}

/** Front direction (dx, dy) of each building rotation. */
const FRONT: [number, number][] = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
];

/** Rotation that puts a road in front of (x, y) and a highway behind it, or null. */
export function rampRotation(sim: Sim, x: number, y: number): number | null {
  const w = sim.world;
  for (let r = 0; r < 4; r++) {
    const [fx, fy] = FRONT[r];
    if (w.hasNet(x + fx, y + fy, NET.ROAD) && w.hasNet(x - fx, y - fy, NET.HIGHWAY)) return r;
  }
  return null;
}

/** Best rotation for a placed building: shore buildings face water, others face a road. */
export function autoRotation(sim: Sim, def: BuildingDef, x: number, y: number): number {
  const w = sim.world;
  if (def.needsHighway) return rampRotation(sim, x, y) ?? 0;
  if (def.needsShore) {
    // find the side with the most water
    const counts = [0, 0, 0, 0]; // rot 0 faces +y, 1 -x, 2 -y, 3 +x
    for (let k = 0; k < def.w; k++) {
      if (w.inBounds(x + k, y + def.h) && w.isWater(x + k, y + def.h)) counts[0]++;
      if (w.inBounds(x + k, y - 1) && w.isWater(x + k, y - 1)) counts[2]++;
    }
    for (let k = 0; k < def.h; k++) {
      if (w.inBounds(x - 1, y + k) && w.isWater(x - 1, y + k)) counts[1]++;
      if (w.inBounds(x + def.w, y + k) && w.isWater(x + def.w, y + k)) counts[3]++;
    }
    let best = 0;
    for (let r = 1; r < 4; r++) if (counts[r] > counts[best]) best = r;
    return best;
  }
  if (def.needsRail) {
    const counts = [0, 0, 0, 0];
    for (let k = 0; k < def.w; k++) {
      if (w.hasNet(x + k, y + def.h, NET.RAIL)) counts[0]++;
      if (w.hasNet(x + k, y - 1, NET.RAIL)) counts[2]++;
    }
    for (let k = 0; k < def.h; k++) {
      if (w.hasNet(x - 1, y + k, NET.RAIL)) counts[1]++;
      if (w.hasNet(x + def.w, y + k, NET.RAIL)) counts[3]++;
    }
    let best = 0;
    for (let r = 1; r < 4; r++) if (counts[r] > counts[best]) best = r;
    return best;
  }
  return faceRoad(sim, x, y, def.w, def.h, 0);
}

/** Plan placing a building with its (rotated) footprint's top-left at (x, y). */
export function planPlace(sim: Sim, defId: string, x: number, y: number, rot: number | 'auto'): Plan {
  const w = sim.world;
  const def = getDef(defId);
  const avail = isAvailable(sim, def);
  // rotation decides footprint orientation for non-square buildings
  let r = rot === 'auto' ? 0 : rot;
  let fw = r % 2 ? def.h : def.w;
  let fh = r % 2 ? def.w : def.h;
  if (rot === 'auto') {
    r = def.w === def.h ? autoRotation(sim, def, x, y) : 0;
    fw = r % 2 ? def.h : def.w;
    fh = r % 2 ? def.w : def.h;
  }
  const tiles: PlanTile[] = [];
  let reason: string | undefined = avail.ok ? undefined : avail.why;
  let allOk = avail.ok;
  for (let yy = y; yy < y + fh; yy++) {
    for (let xx = x; xx < x + fw; xx++) {
      let ok = w.inBounds(xx, yy);
      if (ok) {
        const i = w.idx(xx, yy);
        if (w.isWater(xx, yy)) {
          ok = false;
          reason ??= 'Cannot build on water';
        } else if (w.bld[i]) {
          ok = false;
          reason ??= 'Blocked by a building';
        } else if (w.net[i] & SURFACE_NET) {
          ok = false;
          reason ??= 'Blocked by a road, rail, highway or power line';
        }
      } else reason ??= 'Outside the map';
      if (!ok) allOk = false;
      tiles.push({ x: xx, y: yy, ok, change: true });
    }
  }
  if (allOk) {
    if (w.footprintMax(x, y, fw, fh) - w.footprintMin(x, y, fw, fh) > 3) {
      allOk = false;
      reason ??= 'Ground is too steep';
    }
    if (def.needsShore && !w.touchesWater(x, y, fw, fh)) {
      allOk = false;
      reason ??= 'Must be built next to water';
    }
    if (def.needsRail) {
      let rail = false;
      for (let yy = y - 1; yy <= y + fh; yy++) for (let xx = x - 1; xx <= x + fw; xx++) if (w.hasNet(xx, yy, NET.RAIL)) rail = true;
      if (!rail) {
        allOk = false;
        reason ??= 'Must be built next to rail tracks';
      }
    }
    if (def.needsHighway && rampRotation(sim, x, y) === null) {
      allOk = false;
      reason ??= 'Place it in a line between a road and a highway';
    }
    if (def.needsSubway) {
      let sub = false;
      for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) if (w.hasNet(xx, yy, NET.SUBWAY)) sub = true;
      if (!sub) {
        allOk = false;
        reason ??= 'Must be built on a subway line';
      }
    }
  }
  if (def.needsHighway) r = rampRotation(sim, x, y) ?? r;
  if (!allOk) for (const t of tiles) t.ok = false;
  const cost = def.cost ?? 0;
  const plan = finish(
    sim,
    'place',
    tiles,
    cost,
    () => {
      if (!sim.spend(cost)) return;
      for (const t of tiles) {
        const i = w.idx(t.x, t.y);
        if (w.zone[i]) w.setZone(t.x, t.y, 0, 0);
      }
      const b = w.addBuilding({
        def: def.id,
        x,
        y,
        w: fw,
        h: fh,
        rot: r,
        variant: sim.rng.int(0, 7),
        seed: sim.rng.int(0, 255),
        pop: 0,
        build: 0,
        powered: false,
        watered: false,
        abandoned: false,
        fire: 0,
        age: 0,
        unhappy: 0,
      });
      sim.dirty.power = true;
      sim.dirty.water = true;
      sim.dirty.coverage = true;
      // stations and on-ramps change the commute graph
      if (def.needsSubway || def.needsHighway) sim.dirty.roads = true;
      sim.events.emit('building', { type: 'add', b });
      sim.events.emit('sound', 'build');
    },
    reason,
  );
  plan.def = def;
  plan.x = x;
  plan.y = y;
  plan.rot = r;
  plan.w = fw;
  plan.h = fh;
  return plan;
}

// --------------------------------------------------------------- bulldoze

export function planBulldoze(sim: Sim, x0: number, y0: number, x1: number, y1: number, underground = false): Plan {
  const w = sim.world;
  const tiles: PlanTile[] = [];
  const buildings = new Set<number>();
  let cost = 0;
  for (const [x, y] of rectTiles(x0, y0, x1, y1)) {
    if (!w.inBounds(x, y)) continue;
    const i = w.idx(x, y);
    let change = false;
    if (underground) {
      if (w.net[i] & UNDERGROUND_NET) {
        change = true;
        cost += w.net[i] & NET.SUBWAY ? COSTS.bulldoze : 1;
      }
    } else {
      if (w.bld[i] && !buildings.has(w.bld[i])) {
        const b = w.buildings.get(w.bld[i])!;
        buildings.add(b.id);
        cost += COSTS.bulldozeBuilding * b.w * b.h;
        change = true;
      } else if (w.bld[i]) change = true;
      if (w.net[i] & SURFACE_NET) {
        cost += w.isWater(x, y) ? COSTS.bulldoze * 4 : COSTS.bulldoze;
        change = true;
      }
      if (!change && (w.tree[i] || w.rubble[i])) {
        cost += 1;
        change = true;
      }
    }
    tiles.push({ x, y, ok: true, change });
  }
  return finish(sim, 'bulldoze', tiles, cost, () => {
    if (!sim.spend(cost)) return;
    let roads = false;
    for (const id of buildings) {
      const b = w.removeBuilding(id);
      if (!b) continue;
      const def = getDef(b.def);
      if (def.needsSubway || def.needsHighway) roads = true;
      sim.events.emit('building', { type: 'remove', b });
    }
    for (const t of tiles) {
      if (!t.change) continue;
      const i = w.idx(t.x, t.y);
      if (underground) {
        if (w.net[i] & NET.SUBWAY) roads = true;
        w.net[i] &= ~UNDERGROUND_NET;
        w.markArea(t.x, t.y, t.x, t.y, DIRTY_PIPES);
        continue;
      }
      if (w.net[i] & FIXED_NET) roads = true;
      w.net[i] &= UNDERGROUND_NET;
      w.tree[i] = 0;
      w.rubble[i] = 0;
      w.markArea(t.x, t.y, t.x, t.y, DIRTY_GROUND | DIRTY_OBJECTS);
    }
    w.tilesDirty = true;
    if (roads) {
      sim.dirty.roads = true;
      w.roadVersion++;
    }
    sim.dirty.power = true;
    sim.dirty.water = true;
    sim.dirty.coverage = true;
    sim.events.emit('sound', 'bulldoze');
  });
}

// ---------------------------------------------------------------- trees

export function planTrees(sim: Sim, x0: number, y0: number, x1: number, y1: number): Plan {
  const w = sim.world;
  const tiles: PlanTile[] = [];
  let cost = 0;
  for (const [x, y] of rectTiles(x0, y0, x1, y1)) {
    if (!w.inBounds(x, y)) continue;
    const i = w.idx(x, y);
    const ok = !w.isWater(x, y) && !w.bld[i] && !(w.net[i] & (NET.ROAD | NET.RAIL | NET.HIGHWAY));
    const change = ok && w.tree[i] < 3;
    if (change) cost += COSTS.tree;
    tiles.push({ x, y, ok, change });
  }
  return finish(sim, 'trees', tiles, cost, () => {
    if (!sim.spend(cost)) return;
    for (const t of tiles) {
      if (!t.change) continue;
      const i = w.idx(t.x, t.y);
      w.tree[i] = Math.min(3, w.tree[i] + 1);
      w.rubble[i] = 0;
      w.markDirty(t.x, t.y, DIRTY_OBJECTS);
    }
    sim.events.emit('sound', 'zone');
  });
}

// ------------------------------------------------------------- terraform

export type TerraformMode = 'raise' | 'lower' | 'level';

/** Corners touching a tile that must not move (buildings, roads, rails). */
function lockedCorner(sim: Sim, cx: number, cy: number): boolean {
  const w = sim.world;
  for (const [tx, ty] of [
    [cx - 1, cy - 1],
    [cx, cy - 1],
    [cx - 1, cy],
    [cx, cy],
  ]) {
    if (!w.inBounds(tx, ty)) continue;
    const i = w.idx(tx, ty);
    if (w.bld[i] || w.net[i] & FIXED_NET) return true;
  }
  return false;
}

export function planTerraform(sim: Sim, mode: TerraformMode, x0: number, y0: number, x1: number, y1: number): Plan {
  const w = sim.world;
  const W = w.w + 1;
  const ax = Math.min(x0, x1);
  const bx = Math.max(x0, x1) + 1;
  const ay = Math.min(y0, y1);
  const by = Math.max(y0, y1) + 1;
  const target = new Map<number, number>();
  const startLevel = w.corner(Math.min(W - 1, x0), Math.min(w.h, y0));
  for (let cy = ay; cy <= by; cy++) {
    for (let cx = ax; cx <= bx; cx++) {
      if (cx < 0 || cy < 0 || cx > w.w || cy > w.h) continue;
      const h = w.corner(cx, cy);
      const v = mode === 'raise' ? h + 1 : mode === 'lower' ? h - 1 : startLevel;
      target.set(cy * W + cx, Math.max(0, Math.min(MAX_LEVEL, v)));
    }
  }
  // propagate slope constraint outward
  const heights = new Map<number, number>(target);
  const get = (k: number) => heights.get(k) ?? w.heights[k];
  const queue = [...target.keys()];
  for (let qi = 0; qi < queue.length && qi < 20000; qi++) {
    const k = queue[qi];
    const cx = k % W;
    const cy = (k / W) | 0;
    const h = get(k);
    for (const [nx, ny] of [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx > w.w || ny > w.h) continue;
      const nk = ny * W + nx;
      if (target.has(nk)) continue;
      const nh = get(nk);
      if (nh < h - 1) {
        heights.set(nk, h - 1);
        queue.push(nk);
      } else if (nh > h + 1) {
        heights.set(nk, h + 1);
        queue.push(nk);
      }
    }
  }
  let cost = 0;
  let reason: string | undefined;
  const changed: [number, number][] = [];
  for (const [k, v] of heights) {
    const old = w.heights[k];
    if (old === v) continue;
    const cx = k % W;
    const cy = (k / W) | 0;
    if (lockedCorner(sim, cx, cy)) reason ??= 'Cannot reshape land under buildings or roads';
    cost += Math.abs(v - old) * COSTS.terraform;
    changed.push([k, v]);
  }
  const tiles: PlanTile[] = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (w.inBounds(x, y)) tiles.push({ x, y, ok: !reason, change: changed.length > 0 });
    }
  }
  const plan = finish(
    sim,
    'terraform',
    tiles,
    cost,
    () => {
      if (reason || !sim.spend(cost)) return;
      let minX = w.w;
      let minY = w.h;
      let maxX = 0;
      let maxY = 0;
      for (const [k, v] of changed) {
        w.heights[k] = v;
        const cx = k % W;
        const cy = (k / W) | 0;
        minX = Math.min(minX, cx - 1);
        minY = Math.min(minY, cy - 1);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);
      }
      // water tiles cannot hold zones
      for (let y = Math.max(0, minY); y <= Math.min(w.h - 1, maxY); y++) {
        for (let x = Math.max(0, minX); x <= Math.min(w.w - 1, maxX); x++) {
          if (w.isWater(x, y)) {
            const i = w.idx(x, y);
            if (w.zone[i]) w.setZone(x, y, 0, 0);
            w.tree[i] = 0;
          }
        }
      }
      w.markArea(minX, minY, maxX, maxY, DIRTY_GROUND | DIRTY_OBJECTS | DIRTY_PIPES);
      w.heightsDirty = true;
      w.tilesDirty = true;
      sim.dirty.land = true;
      sim.dirty.power = true;
      sim.events.emit('sound', 'terraform');
    },
    reason,
  );
  plan.corners = changed.map(([k]) => k);
  return plan;
}

export function applyPlan(plan: Plan): boolean {
  if (!plan.ok) return false;
  plan.apply();
  return true;
}
