import { NET, type Building, type ZoneKind } from './types';
import { getDef, growablesFor, type BuildingDef } from './catalog';
import type { Sim } from './sim';
import { DIRTY_OBJECTS } from './world';
import { ROAD_REACH } from './networks';
import { jobAccess, MAX_COMMUTE_COST, resAccess } from './traffic';
import { needsWater } from './util';

const BLOCKING = NET.ROAD | NET.RAIL | NET.POWER | NET.HIGHWAY;

/** Demand value for a zone kind. */
export function zoneDemand(sim: Sim, zone: number): number {
  const d = sim.city.demand;
  return zone === 1 ? d.r : zone === 2 ? d.c : zone === 3 ? d.i : 0;
}

/** How attractive tile i is for a zone kind (-1..1). */
export function desirability(sim: Sim, zone: number, i: number): number {
  const w = sim.world;
  const lv = w.landValue[i];
  const pol = w.pollution[i];
  const cr = w.crime[i];
  const r = w.nearestRoad[i];
  const tr = r >= 0 ? Math.min(1.2, w.traffic[r]) : 0;
  const cv = w.cover;
  let d: number;
  if (zone === 1) {
    d = -0.12 + lv * 1.1 - pol * 1.25 - cr * 0.7 - tr * 0.22;
    d += cv.parks[i] * 0.15 + cv.health[i] * 0.07 + cv.education[i] * 0.07 + cv.police[i] * 0.04;
    if (!jobAccess(sim, i)) d -= 0.35;
  } else if (zone === 2) {
    const near = r >= 0 ? Math.max(0, 1 - sim.access.resDist[r] / MAX_COMMUTE_COST) : 0;
    d = -0.12 + lv * 0.75 + tr * 0.1 - cr * 0.55 - pol * 0.4 + near * 0.3;
    if (!resAccess(sim, i)) d -= 0.3;
  } else {
    d = 0.32 - lv * 0.18 - cr * 0.2;
    if (!resAccess(sim, i)) d -= 0.3;
    const x = i % w.w;
    const y = (i / w.w) | 0;
    for (let k = 0; k < 4; k++) {
      if (w.hasNet(x + [0, 1, 0, -1][k] * 2, y + [-1, 0, 1, 0][k] * 2, NET.RAIL)) {
        d += 0.08;
        break;
      }
    }
  }
  return Math.max(-1, Math.min(1, d));
}

/** Rotation (0..3) that makes a footprint's front face the nearest road. */
export function faceRoad(sim: Sim, x: number, y: number, w: number, h: number, fallback = 0): number {
  const wd = sim.world;
  let best = 255;
  let bx = -1;
  let by = -1;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = wd.idx(xx, yy);
      if (wd.roadDist[i] < best && wd.nearestRoad[i] >= 0) {
        best = wd.roadDist[i];
        bx = wd.nearestRoad[i] % wd.w;
        by = (wd.nearestRoad[i] / wd.w) | 0;
      }
    }
  }
  if (bx < 0) return fallback;
  const dx = bx + 0.5 - (x + w / 2);
  const dy = by + 0.5 - (y + h / 2);
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? 0 : 2;
  return dx > 0 ? 3 : 1;
}

function pickWealth(sim: Sim, zone: number, i: number): number {
  const rng = sim.rng;
  if (zone === 3) {
    const eq = sim.city.eq;
    const lv = sim.world.landValue[i];
    if (eq > 95 && lv > 0.28 && rng.next() < 0.15 + (eq - 95) / 45) return 2;
    if (eq > 55 && rng.next() < 0.55) return 1;
    return 0;
  }
  const lv = sim.world.landValue[i] + (rng.next() - 0.5) * 0.1;
  return lv < 0.3 ? 0 : lv < 0.52 ? 1 : 2;
}

interface Lot {
  ax: number;
  ay: number;
  replaced: Building[];
}

/** Find an s×s lot containing (x,y) (and `must` building footprint if given). */
function findLot(sim: Sim, x: number, y: number, s: number, zone: number, density: number, must?: Building): Lot | null {
  const w = sim.world;
  const anchors: [number, number][] = [];
  const minX = must ? Math.max(0, must.x + must.w - s) : x - s + 1;
  const maxX = must ? must.x : x;
  const minY = must ? Math.max(0, must.y + must.h - s) : y - s + 1;
  const maxY = must ? must.y : y;
  for (let ay = minY; ay <= maxY; ay++) for (let ax = minX; ax <= maxX; ax++) anchors.push([ax, ay]);
  sim.rng.shuffle(anchors);
  const seen = new Set<number>();
  outer: for (const [ax, ay] of anchors) {
    if (ax < 0 || ay < 0 || ax + s > w.w || ay + s > w.h) continue;
    seen.clear();
    const replaced: Building[] = [];
    let access = false;
    for (let yy = ay; yy < ay + s; yy++) {
      for (let xx = ax; xx < ax + s; xx++) {
        const i = w.idx(xx, yy);
        if (w.zone[i] !== zone || w.density[i] !== density) continue outer;
        if (w.net[i] & BLOCKING) continue outer;
        if (w.isWater(xx, yy)) continue outer;
        if (w.roadDist[i] <= ROAD_REACH) access = true;
        const id = w.bld[i];
        if (id && !seen.has(id)) {
          seen.add(id);
          const b = w.buildings.get(id)!;
          const def = getDef(b.def);
          if (!def.growable || b.fire > 0 || b.build > 0) continue outer;
          if (b.x < ax || b.y < ay || b.x + b.w > ax + s || b.y + b.h > ay + s) continue outer;
          replaced.push(b);
        }
      }
    }
    if (!access) continue;
    if (w.footprintMax(ax, ay, s, s) - w.footprintMin(ax, ay, s, s) > 2) continue;
    return { ax, ay, replaced };
  }
  return null;
}

function chooseTemplate(sim: Sim, zone: ZoneKind, density: number, wealth: number, size: number, minCap: number): BuildingDef | null {
  for (const wl of [wealth, 1, 0, 2]) {
    const c = growablesFor(zone, density, wl, size).filter((d) => (d.cap ?? 0) > minCap);
    if (c.length) return sim.rng.pick(c);
  }
  return null;
}

/** Remaining development budget (residents/jobs) for a zone. */
function budgetOf(sim: Sim, zone: number): number {
  return sim.growthBudget[zone] ?? 0;
}

function placeGrowable(sim: Sim, def: BuildingDef, lot: Lot): Building {
  const w = sim.world;
  let replacedCap = 0;
  for (const b of lot.replaced) replacedCap += getDef(b.def).cap ?? 0;
  sim.growthBudget[def.zone ?? 0] -= Math.max(0, (def.cap ?? 0) - replacedCap);
  let inherit = 0;
  for (const b of lot.replaced) {
    inherit += b.pop;
    w.removeBuilding(b.id);
    sim.events.emit('building', { type: 'remove', b });
  }
  const s = def.w;
  const rot = faceRoad(sim, lot.ax, lot.ay, s, s, sim.rng.int(0, 3));
  const b = w.addBuilding({
    def: def.id,
    x: lot.ax,
    y: lot.ay,
    w: s,
    h: s,
    rot,
    variant: sim.rng.int(0, 7),
    seed: sim.rng.int(0, 255),
    pop: Math.min(def.cap ?? 0, inherit),
    build: 6 + s * 7 + (def.density ?? 1) * 4 + sim.rng.int(0, 5),
    powered: true,
    watered: true,
    abandoned: false,
    fire: 0,
    age: 0,
    unhappy: 0,
  });
  sim.dirty.power = true;
  sim.events.emit('building', { type: 'add', b });
  return b;
}

const SIZE_WEIGHTS: Record<number, number[]> = {
  1: [1, 0, 0],
  2: [1.1, 1.0, 0.45],
  3: [0.45, 1.0, 0.85],
};

function develop(sim: Sim, i: number): void {
  const w = sim.world;
  const x = i % w.w;
  const y = (i / w.w) | 0;
  const zone = w.zone[i] as ZoneKind;
  const density = w.density[i];
  if (!w.powered[i] || w.roadDist[i] > ROAD_REACH || w.isWater(x, y)) return;
  if (w.net[i] & BLOCKING) return;
  const dem = zoneDemand(sim, zone);
  if (dem < 0.03 || budgetOf(sim, zone) <= 0) return;
  const D = desirability(sim, zone, i);
  const p = Math.max(0, Math.min(1, dem * 0.6 + D * 0.5 + 0.05)) * 0.5;
  if (sim.rng.next() > p) return;
  const wealth = pickWealth(sim, zone, i);
  const weights = SIZE_WEIGHTS[density].map((v, k) => (k === 0 ? v : v * (0.5 + dem)));
  if (density === 1 && wealth === 2 && zone === 1) weights[1] = 0.25;
  let size = sim.rng.weighted([1, 2, 3], weights);
  if (density >= 2 && !w.watered[i]) size = 1;
  for (let s = size; s >= 1; s--) {
    const def = chooseTemplate(sim, zone, density, wealth, s, 0);
    if (!def) continue;
    const lot = findLot(sim, x, y, s, zone, density);
    if (!lot) continue;
    placeGrowable(sim, def, lot);
    return;
  }
}

function upgrade(sim: Sim, b: Building): void {
  const w = sim.world;
  if (b.build > 0 || b.abandoned || b.fire > 0) return;
  const def = getDef(b.def);
  const zone = def.zone as ZoneKind;
  const i = w.idx(b.x, b.y);
  const density = w.density[i];
  if (w.zone[i] !== zone || !density) return;
  const outdated = def.density !== density;
  // settled buildings sit near 70% occupancy; above 62% they count as full enough to grow
  const full = b.pop >= (def.cap ?? 0) * 0.62;
  if (!outdated && !full) return;
  const dem = zoneDemand(sim, zone);
  const D = desirability(sim, zone, i);
  if (!outdated && (dem < 0.12 || D < 0.05 || budgetOf(sim, zone) <= 0)) return;
  if (outdated && dem < -0.1) return;
  const p = outdated ? 0.12 : 0.05 + dem * 0.15;
  if (sim.rng.next() > p) return;
  const maxSize = density === 1 ? (zone === 1 && w.landValue[i] > 0.5 ? 2 : 1) : 3;
  const sizes = outdated ? [Math.max(def.w, Math.min(maxSize, def.w + 1)), def.w] : [Math.min(maxSize, def.w + 1), def.w];
  const wealth = pickWealth(sim, zone, i);
  for (const s of sizes) {
    if (s < def.w) continue;
    if (s > 1 && density >= 2 && !w.watered[i]) continue;
    const tpl = chooseTemplate(sim, zone, density, wealth, s, outdated ? 0 : (def.cap ?? 0));
    if (!tpl || tpl.id === def.id) continue;
    const lot = findLot(sim, b.x, b.y, s, zone, density, b);
    if (!lot) continue;
    placeGrowable(sim, tpl, lot);
    return;
  }
}

/** Advance construction sites. */
export function constructionDay(sim: Sim): void {
  const w = sim.world;
  for (const b of w.buildings.values()) {
    if (b.build <= 0) continue;
    b.build--;
    if (b.build <= 0) {
      const def = getDef(b.def);
      if (def.growable && b.pop < (def.cap ?? 0) * 0.2) b.pop = Math.round((def.cap ?? 0) * 0.2);
      w.markDirty(b.x, b.y, DIRTY_OBJECTS);
      w.buildVersion++;
      sim.dirty.power = true;
      sim.events.emit('building', { type: 'complete', b });
    }
  }
}

const queues = new WeakMap<Sim, { list: number[]; pos: number }>();

/**
 * Daily accrual of the development budget: new capacity per month grows with
 * demand and with the size of the city (S-curve growth instead of instant fill).
 */
export function accrueGrowthBudget(sim: Sim): void {
  const s = sim.stats;
  const d = sim.city.demand;
  const monthly = [
    0,
    Math.max(0, d.r) * (300 + s.residents * 0.065),
    // shops and factories grow with the town around them, not only with their own size
    Math.max(0, d.c) * (90 + s.residents * 0.014 + s.comJobs * 0.04),
    Math.max(0, d.i) * (140 + s.residents * 0.016 + s.indJobs * 0.045),
  ];
  for (let z = 1; z <= 3; z++) {
    const b = sim.growthBudget[z] + monthly[z] / 30;
    sim.growthBudget[z] = Math.min(b, monthly[z] * 1.5 + 30);
  }
}

/** Evaluate a slice of zone tiles for development / redevelopment. */
export function growthDay(sim: Sim): void {
  const w = sim.world;
  accrueGrowthBudget(sim);
  let q = queues.get(sim);
  if (!q) queues.set(sim, (q = { list: [], pos: 0 }));
  if (q.pos >= q.list.length) {
    q.list = [];
    for (let i = 0; i < w.size; i++) {
      const z = w.zone[i];
      if (z >= 1 && z <= 3) q.list.push(i);
    }
    sim.rng.shuffle(q.list);
    q.pos = 0;
  }
  const n = Math.ceil(q.list.length / 12);
  const end = Math.min(q.list.length, q.pos + n);
  for (; q.pos < end; q.pos++) {
    const i = q.list[q.pos];
    const z = w.zone[i];
    if (z < 1 || z > 3) continue;
    const id = w.bld[i];
    if (!id) {
      develop(sim, i);
      continue;
    }
    const b = w.buildings.get(id);
    if (b && b.x === i % w.w && b.y === ((i / w.w) | 0) && getDef(b.def).growable) upgrade(sim, b);
  }
}

/** Monthly occupancy, abandonment and recovery of growables (and arcologies). */
export function occupancyMonth(sim: Sim): void {
  const w = sim.world;
  const toRemove: Building[] = [];
  for (const b of w.buildings.values()) {
    if (b.build > 0) continue;
    b.age++;
    const def = getDef(b.def);
    const isGrow = !!def.growable;
    if (!isGrow && !def.residents) continue;
    const zone = isGrow ? (def.zone as number) : 1;
    const cap = def.cap ?? def.residents ?? 0;
    const i = w.idx(b.x, b.y);
    const dem = zoneDemand(sim, zone);
    const D = desirability(sim, zone, i);
    // a little month-to-month movement keeps a built-out city alive
    let f = 0.55 + dem * 0.45 + D * 0.45 + (sim.rng.next() - 0.5) * 0.05;
    if (!b.powered) f *= 0.15;
    if (needsWater(def) && !b.watered) f *= 0.55;
    let rd = 255;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) rd = Math.min(rd, w.roadDist[w.idx(x, y)]);
    if (rd > ROAD_REACH) f *= 0.3;
    f = Math.max(0, Math.min(1, f));
    if (b.abandoned) {
      if (f > 0.55 && sim.rng.next() < 0.3) {
        b.abandoned = false;
        b.unhappy = 0;
        w.markDirty(b.x, b.y, DIRTY_OBJECTS);
        w.buildVersion++;
      } else {
        b.unhappy++;
        if (b.unhappy > 20 && isGrow && sim.rng.next() < 0.25) toRemove.push(b);
      }
      continue;
    }
    const target = cap * f;
    b.pop = Math.max(0, Math.round(b.pop + (target - b.pop) * 0.35));
    if (f < 0.3) b.unhappy++;
    else if (f > 0.5) b.unhappy = Math.max(0, b.unhappy - 2);
    if (isGrow && b.unhappy >= 5 && sim.rng.next() < 0.25) {
      b.abandoned = true;
      b.pop = 0;
      w.markDirty(b.x, b.y, DIRTY_OBJECTS);
      w.buildVersion++;
      sim.dirty.power = true;
    }
  }
  for (const b of toRemove) {
    w.removeBuilding(b.id);
    sim.events.emit('building', { type: 'remove', b });
  }
  if (toRemove.length) sim.dirty.power = true;
}
