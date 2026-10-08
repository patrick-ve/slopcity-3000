import { NET } from './types';
import { getDef } from './catalog';
import type { Sim } from './sim';
import type { Building } from './types';
import { isActive } from './util';

/** Max commute (road tiles) before a trip counts as "unreachable". */
export const MAX_COMMUTE = 45;
/** Commute cost of one road tile. Highways and subways are cheaper per tile. */
export const COMMUTE_STEP = 4;
/** Max commute as a cost. */
export const MAX_COMMUTE_COST = MAX_COMMUTE * COMMUTE_STEP;

/** Edge costs of the commute graph. */
const COST = {
  road: COMMUTE_STEP,
  /** Highways are four times as fast as streets. */
  highway: 1,
  /** Subway trains are fast too, but riders wait at the station. */
  subway: 1,
  ramp: COMMUTE_STEP,
  station: COMMUTE_STEP * 2,
  /** Neighbour cities as distant job / worker pools. */
  edgeRoad: COMMUTE_STEP * 10,
  edgeHighway: COMMUTE_STEP * 5,
} as const;
const INF = 65535;
const LIMIT = (MAX_COMMUTE + 20) * COMMUTE_STEP;
/** Share of road trips left for commuters who ride the subway (they walk or take a feeder bus). */
const SUBWAY_FEEDER = 0.35;
/** Highway lanes carry this many times a street's traffic. */
const HIGHWAY_CAPACITY = 3.5;

/** Graph layers: node = tile index + layer × world size. */
const LAYER_FLAGS = [NET.ROAD, NET.HIGHWAY, NET.SUBWAY];
const LAYER_COSTS = [COST.road, COST.highway, COST.subway];

export interface AccessData {
  /** Commute cost (COMMUTE_STEP per road tile) from each road tile to the nearest job site. */
  jobDist: Uint16Array;
  /** Commute cost from each road tile to the nearest residential site. */
  resDist: Uint16Array;
}

export function emptyAccess(size: number): AccessData {
  return { jobDist: new Uint16Array(size).fill(INF), resDist: new Uint16Array(size).fill(INF) };
}

/** Road tiles giving access to a building (nearest road of each footprint tile). */
function accessRoads(sim: Sim, b: Building, out: Set<number>): void {
  const w = sim.world;
  out.clear();
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      const r = w.nearestRoad[w.idx(x, y)];
      if (r >= 0) out.add(r);
    }
  }
}

/** Extra edges between layers: on-ramps (road ↔ highway) and linked subway stations (road ↔ subway). */
function buildLinks(sim: Sim): Map<number, [number, number][]> {
  const w = sim.world;
  const size = w.size;
  const links = new Map<number, [number, number][]>();
  const link = (a: number, b: number, cost: number) => {
    let la = links.get(a);
    if (!la) links.set(a, (la = []));
    la.push([b, cost]);
    let lb = links.get(b);
    if (!lb) links.set(b, (lb = []));
    lb.push([a, cost]);
  };
  for (const b of w.buildings.values()) {
    if (!isActive(b)) continue;
    if (b.def === 'onramp') {
      const roads: number[] = [];
      const highways: number[] = [];
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const x = b.x + dx;
        const y = b.y + dy;
        if (w.hasNet(x, y, NET.ROAD)) roads.push(w.idx(x, y));
        if (w.hasNet(x, y, NET.HIGHWAY)) highways.push(w.idx(x, y));
      }
      for (const r of roads) for (const hw of highways) link(r, hw + size, COST.ramp);
    } else if (b.def === 'subway_station' && sim.subwayLinked.has(b.id)) {
      const i = w.idx(b.x, b.y);
      const r = w.nearestRoad[i];
      if (r >= 0 && w.net[i] & NET.SUBWAY) link(r, i + size * 2, COST.station);
    }
  }
  return links;
}

/** Multi-source shortest paths (bucket queue) over the layered commute graph. */
function commuteSearch(
  sim: Sim,
  links: Map<number, [number, number][]>,
  sources: Map<number, number>,
  dist: Uint16Array,
  parent: Int32Array,
): void {
  const w = sim.world;
  const size = w.size;
  const W = w.w;
  dist.fill(INF);
  parent.fill(-1);
  const buckets: number[][] = [];
  for (const [n, d0] of sources) {
    if (d0 < dist[n]) {
      dist[n] = d0;
      (buckets[d0] ??= []).push(n);
    }
  }
  const relax = (from: number, to: number, nd: number) => {
    if (nd < dist[to] && nd <= LIMIT) {
      dist[to] = nd;
      parent[to] = from;
      (buckets[nd] ??= []).push(to);
    }
  };
  for (let d = 0; d < buckets.length; d++) {
    const list = buckets[d];
    if (!list) continue;
    for (let k = 0; k < list.length; k++) {
      const n = list[k];
      if (dist[n] !== d) continue;
      const layer = (n / size) | 0;
      const i = n - layer * size;
      const flag = LAYER_FLAGS[layer];
      const step = d + LAYER_COSTS[layer];
      const x = i % W;
      const y = (i / W) | 0;
      const base = layer * size;
      if (x > 0 && w.net[i - 1] & flag) relax(n, base + i - 1, step);
      if (x < W - 1 && w.net[i + 1] & flag) relax(n, base + i + 1, step);
      if (y > 0 && w.net[i - W] & flag) relax(n, base + i - W, step);
      if (y < w.h - 1 && w.net[i + W] & flag) relax(n, base + i + W, step);
      const extra = links.get(n);
      if (extra) for (const [m, c] of extra) relax(n, m, d + c);
    }
  }
}

/** Reused per world size (the search runs every month). */
interface Scratch {
  size: number;
  jobDist: Uint16Array;
  resDist: Uint16Array;
  parentJob: Int32Array;
  parentRes: Int32Array;
  trips: Float32Array;
}
const scratch = new WeakMap<Sim, Scratch>();

function scratchFor(sim: Sim): Scratch {
  const n = sim.world.size * 3;
  let s = scratch.get(sim);
  if (!s || s.size !== n) {
    s = {
      size: n,
      jobDist: new Uint16Array(n),
      resDist: new Uint16Array(n),
      parentJob: new Int32Array(n),
      parentRes: new Int32Array(n),
      trips: new Float32Array(n),
    };
    scratch.set(sim, s);
  }
  return s;
}

/** Commute access + traffic load on every road and highway tile, and subway ridership. */
export function updateTraffic(sim: Sim): void {
  const w = sim.world;
  const size = w.size;
  const acc = sim.access;
  const sc = scratchFor(sim);
  const jobSources = new Map<number, number>();
  const resSources = new Map<number, number>();
  const roads = new Set<number>();
  for (const b of w.buildings.values()) {
    if (!isActive(b)) continue;
    const def = getDef(b.def);
    const isJob = def.growable ? def.zone === 2 || def.zone === 3 : false;
    const isRes = def.growable ? def.zone === 1 : !!def.residents;
    if (!isJob && !isRes) continue;
    accessRoads(sim, b, roads);
    for (const r of roads) {
      if (isJob) jobSources.set(r, 0);
      if (isRes) resSources.set(r, 0);
    }
  }
  // neighbour connections act as distant job/resident pools (commuters); highways reach them faster
  for (let i = 0; i < size; i++) {
    const x = i % w.w;
    const y = (i / w.w) | 0;
    if (x !== 0 && y !== 0 && x !== w.w - 1 && y !== w.h - 1) continue;
    const n = w.net[i];
    if (n & NET.ROAD) {
      if (!jobSources.has(i)) jobSources.set(i, COST.edgeRoad);
      if (!resSources.has(i)) resSources.set(i, COST.edgeRoad);
    }
    if (n & NET.HIGHWAY) {
      jobSources.set(i + size, COST.edgeHighway);
      resSources.set(i + size, COST.edgeHighway);
    }
  }
  const links = buildLinks(sim);
  commuteSearch(sim, links, jobSources, sc.jobDist, sc.parentJob);
  commuteSearch(sim, links, resSources, sc.resDist, sc.parentRes);
  acc.jobDist.set(sc.jobDist.subarray(0, size));
  acc.resDist.set(sc.resDist.subarray(0, size));

  // load commuter trips along the shortest paths
  const trips = sc.trips;
  trips.fill(0);
  const ord = sim.city.ordinances;
  const ordFactor = (ord.carpool ? 0.9 : 1) * (ord.commuter_shuttle ? 0.85 : 1);
  const transit = w.cover.transit;
  const parent = sc.parentJob;
  let riders = 0;
  for (const b of w.buildings.values()) {
    if (!isActive(b) || b.pop <= 0) continue;
    const def = getDef(b.def);
    const isRes = def.growable ? def.zone === 1 : !!def.residents;
    if (!isRes) continue;
    accessRoads(sim, b, roads);
    let start = -1;
    let best = INF;
    for (const r of roads) {
      if (sc.jobDist[r] < best) {
        best = sc.jobDist[r];
        start = r;
      }
    }
    if (start < 0 || best > (MAX_COMMUTE + 10) * COMMUTE_STEP) continue;
    const share = Math.max(0.25, 1 - transit[w.idx(b.x, b.y)] * 0.7) * ordFactor;
    let load = b.pop * 0.5 * share * 1.25;
    // subway riders leave their cars at home: the street part of their trip is light
    let usesSubway = false;
    for (let n = start, guard = 0; n >= 0 && guard < 2000; n = parent[n], guard++) {
      if (n >= size * 2) {
        usesSubway = true;
        break;
      }
    }
    if (usesSubway) {
      riders += b.pop * 0.5 * share;
      load *= SUBWAY_FEEDER;
    }
    for (let n = start, guard = 0; n >= 0 && guard < 2000; n = parent[n], guard++) {
      if (n < size * 2) trips[n] += load;
    }
  }
  // congestion
  const fund = sim.fundingEffect('roads');
  const capacity = 420 * (0.65 + 0.35 * Math.min(1, fund));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < size; i++) {
    const net = w.net[i];
    w.trips[i] = trips[i];
    if (net & NET.ROAD) {
      const t = trips[i] / capacity;
      w.traffic[i] = t;
      sum += Math.min(t, 2);
      n++;
    } else {
      w.traffic[i] = 0;
    }
    if (net & NET.HIGHWAY) {
      const t = trips[i + size] / (capacity * HIGHWAY_CAPACITY);
      w.hwyTraffic[i] = t;
      sum += Math.min(t, 2);
      n++;
    } else {
      w.hwyTraffic[i] = 0;
    }
  }
  sim.stats.avgTraffic = n ? sum / n : 0;
  sim.stats.subwayRiders = Math.round(riders);
  w.roadVersion++;
}

/** True if a tile (via its nearest road) can reach jobs. */
export function jobAccess(sim: Sim, i: number): boolean {
  if (sim.stats.comJobs + sim.stats.indJobs < 120) return true;
  const r = sim.world.nearestRoad[i];
  return r >= 0 && sim.access.jobDist[r] <= MAX_COMMUTE_COST;
}

/** True if a tile (via its nearest road) can reach residents (workers/customers). */
export function resAccess(sim: Sim, i: number): boolean {
  if (sim.stats.residents < 300) return true;
  const r = sim.world.nearestRoad[i];
  return r >= 0 && sim.access.resDist[r] <= MAX_COMMUTE_COST;
}
