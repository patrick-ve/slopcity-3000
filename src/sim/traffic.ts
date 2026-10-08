import { NET, type Building } from './types';
import { getDef } from './catalog';
import type { Sim } from './sim';
import { isActive } from './util';

/** Max commute (road tiles) before a trip counts as "unreachable". */
export const MAX_COMMUTE = 45;
const INF = 65535;

export interface AccessData {
  /** Road distance from each road tile to the nearest job site. */
  jobDist: Uint16Array;
  /** Road distance from each road tile to the nearest residential site. */
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

/** Multi-source BFS over the road network. Returns distances and parent pointers. */
function roadBfs(sim: Sim, sources: Map<number, number>, dist: Uint16Array, parent: Int32Array): void {
  const w = sim.world;
  dist.fill(INF);
  parent.fill(-1);
  // bucketed queue (small integer start offsets)
  const buckets: number[][] = [];
  for (const [i, d0] of sources) {
    if (d0 < dist[i]) {
      dist[i] = d0;
      (buckets[d0] ??= []).push(i);
    }
  }
  const W = w.w;
  for (let d = 0; d < buckets.length; d++) {
    const list = buckets[d];
    if (!list) continue;
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (dist[i] !== d) continue;
      const x = i % W;
      const y = (i / W) | 0;
      const nbs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < w.h - 1 ? i + W : -1];
      for (const j of nbs) {
        if (j < 0 || !(w.net[j] & NET.ROAD)) continue;
        const nd = d + 1;
        if (nd < dist[j] && nd <= MAX_COMMUTE + 20) {
          dist[j] = nd;
          parent[j] = i;
          (buckets[nd] ??= []).push(j);
        }
      }
    }
  }
}

/** Commute access + traffic load on every road tile. */
export function updateTraffic(sim: Sim): void {
  const w = sim.world;
  const acc = sim.access;
  const parentJob = new Int32Array(w.size);
  const parentRes = new Int32Array(w.size);
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
  // neighbour connections act as distant job/resident pools (commuters)
  const edgePenalty = 10;
  for (let i = 0; i < w.size; i++) {
    if (!(w.net[i] & NET.ROAD)) continue;
    const x = i % w.w;
    const y = (i / w.w) | 0;
    if (x === 0 || y === 0 || x === w.w - 1 || y === w.h - 1) {
      if (!jobSources.has(i)) jobSources.set(i, edgePenalty);
      if (!resSources.has(i)) resSources.set(i, edgePenalty);
    }
  }
  roadBfs(sim, jobSources, acc.jobDist, parentJob);
  roadBfs(sim, resSources, acc.resDist, parentRes);

  // load commuter trips along the shortest paths
  const trips = w.trips;
  trips.fill(0);
  const ord = sim.city.ordinances;
  const ordFactor = (ord.carpool ? 0.9 : 1) * (ord.commuter_shuttle ? 0.85 : 1);
  const transit = w.cover.transit;
  for (const b of w.buildings.values()) {
    if (!isActive(b) || b.pop <= 0) continue;
    const def = getDef(b.def);
    const isRes = def.growable ? def.zone === 1 : !!def.residents;
    if (!isRes) continue;
    accessRoads(sim, b, roads);
    let start = -1;
    let best = INF;
    for (const r of roads) {
      if (acc.jobDist[r] < best) {
        best = acc.jobDist[r];
        start = r;
      }
    }
    if (start < 0 || best > MAX_COMMUTE + 10) continue;
    const share = Math.max(0.25, 1 - transit[w.idx(b.x, b.y)] * 0.7) * ordFactor;
    const load = b.pop * 0.5 * share * 1.25;
    let i = start;
    let guard = 0;
    while (i >= 0 && guard++ < 400) {
      trips[i] += load;
      i = parentJob[i];
    }
  }
  // congestion
  const fund = sim.fundingEffect('roads');
  const capacity = 420 * (0.65 + 0.35 * Math.min(1, fund));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < w.size; i++) {
    if (w.net[i] & NET.ROAD) {
      const t = trips[i] / capacity;
      w.traffic[i] = t;
      sum += Math.min(t, 2);
      n++;
    } else {
      w.traffic[i] = 0;
    }
  }
  sim.stats.avgTraffic = n ? sum / n : 0;
  w.roadVersion++;
}

/** True if a tile (via its nearest road) can reach jobs. */
export function jobAccess(sim: Sim, i: number): boolean {
  if (sim.stats.comJobs + sim.stats.indJobs < 120) return true;
  const r = sim.world.nearestRoad[i];
  return r >= 0 && sim.access.jobDist[r] <= MAX_COMMUTE;
}

/** True if a tile (via its nearest road) can reach residents (workers/customers). */
export function resAccess(sim: Sim, i: number): boolean {
  if (sim.stats.residents < 300) return true;
  const r = sim.world.nearestRoad[i];
  return r >= 0 && sim.access.resDist[r] <= MAX_COMMUTE;
}
