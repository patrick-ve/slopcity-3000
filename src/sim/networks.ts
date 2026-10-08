import { NET, type Building } from './types';
import { getDef } from './catalog';
import type { Sim } from './sim';
import { powerUseOf, waterUseOf } from './util';

/** Max distance (tiles) at which a road gives a lot "transport access". */
export const ROAD_REACH = 3;
/** Radius (Chebyshev) watered around each connected pipe tile. */
export const PIPE_REACH = 4;

/** Distances to the nearest road plus neighbour connections at the map edge. */
export function updateRoadAccess(sim: Sim): void {
  const w = sim.world;
  const { roadDist, nearestRoad } = w;
  roadDist.fill(255);
  nearestRoad.fill(-1);
  const queue = new Int32Array(w.size);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < w.size; i++) {
    if (w.net[i] & NET.ROAD) {
      roadDist[i] = 0;
      nearestRoad[i] = i;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = roadDist[i];
    if (d >= ROAD_REACH + 1) continue;
    const x = i % w.w;
    const y = (i / w.w) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < w.w - 1 ? i + 1 : -1, y > 0 ? i - w.w : -1, y < w.h - 1 ? i + w.w : -1];
    for (const j of nb) {
      if (j < 0 || roadDist[j] !== 255) continue;
      roadDist[j] = d + 1;
      nearestRoad[j] = nearestRoad[i];
      queue[tail++] = j;
    }
  }
  // neighbour connections
  const c = sim.stats.connections;
  c.road = 0;
  c.rail = 0;
  c.power = 0;
  c.pipe = 0;
  const edge = (x: number, y: number) => {
    const n = w.net[w.idx(x, y)];
    if (n & NET.ROAD) c.road++;
    if (n & NET.RAIL) c.rail++;
    if (n & NET.POWER) c.power++;
    if (n & NET.PIPE) c.pipe++;
  };
  for (let x = 0; x < w.w; x++) {
    edge(x, 0);
    edge(x, w.h - 1);
  }
  for (let y = 1; y < w.h - 1; y++) {
    edge(0, y);
    edge(w.w - 1, y);
  }
}

function neighbours(i: number, W: number, H: number, out: number[]): number {
  const x = i % W;
  const y = (i / W) | 0;
  let n = 0;
  if (x > 0) out[n++] = i - 1;
  if (x < W - 1) out[n++] = i + 1;
  if (y > 0) out[n++] = i - W;
  if (y < H - 1) out[n++] = i + W;
  return n;
}

/** Power output (MW) of a plant, including wind elevation bonus. */
export function plantOutput(sim: Sim, b: Building): number {
  const def = getDef(b.def);
  if (!def.power || b.build > 0 || b.fire > 0) return 0;
  if (def.id === 'wind_turbine') {
    const elev = sim.world.tileMax(b.x, b.y) - sim.world.seaLevel;
    return def.power * Math.min(2.5, 0.8 + Math.max(0, elev) * 0.12);
  }
  return def.power;
}

/** Flood-fill the power grid and decide which buildings get power. */
export function updatePower(sim: Sim): void {
  const w = sim.world;
  const W = w.w;
  const conducts = (i: number) => (w.net[i] & NET.POWER) !== 0 || w.bld[i] !== 0 || w.zone[i] !== 0;
  w.powered.fill(0);
  const comp = new Int32Array(w.size).fill(-1);
  const order: number[] = [];
  const nb: number[] = [0, 0, 0, 0];
  const conservation = sim.city.ordinances.power_conservation ? 0.8 : 1;
  let supplyTotal = 0;
  let demandTotal = 0;
  const seen = new Set<number>();

  for (const b of w.buildings.values()) b.powered = false;

  // buildings with power output seed the components; a power deal seeds from an edge power line
  const seeds: number[] = [];
  for (const b of w.buildings.values()) if ((getDef(b.def).power ?? 0) > 0) seeds.push(w.idx(b.x, b.y));
  if (sim.city.deals.power) {
    for (let i = 0; i < w.size; i++) {
      const x = i % W;
      const y = (i / W) | 0;
      if ((x === 0 || y === 0 || x === W - 1 || y === w.h - 1) && w.net[i] & NET.POWER) {
        seeds.push(i);
        break;
      }
    }
  }
  let compId = 0;
  const edgeDealUsed = { used: false };
  for (const start of seeds) {
    if (comp[start] >= 0) continue;
    // BFS over conductors
    order.length = 0;
    const q: number[] = [start];
    comp[start] = compId;
    let touchesEdge = false;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      order.push(i);
      const x = i % W;
      const y = (i / W) | 0;
      if ((x === 0 || y === 0 || x === W - 1 || y === w.h - 1) && w.net[i] & NET.POWER) touchesEdge = true;
      const n = neighbours(i, W, w.h, nb);
      for (let k = 0; k < n; k++) {
        const j = nb[k];
        if (comp[j] >= 0 || !conducts(j)) continue;
        comp[j] = compId;
        q.push(j);
      }
    }
    // supply of this component
    let supply = 0;
    const plantsHere = new Set<number>();
    for (const i of order) {
      const id = w.bld[i];
      if (!id || plantsHere.has(id)) continue;
      const b = w.buildings.get(id)!;
      if ((getDef(b.def).power ?? 0) > 0) {
        plantsHere.add(id);
        supply += plantOutput(sim, b);
      }
    }
    if (sim.city.deals.power && touchesEdge && !edgeDealUsed.used) {
      supply += 1000;
      edgeDealUsed.used = true;
    }
    supplyTotal += supply;
    // allocate in BFS order
    let remaining = supply;
    seen.clear();
    for (const i of order) {
      const id = w.bld[i];
      if (id) {
        const b = w.buildings.get(id)!;
        if (!seen.has(id)) {
          seen.add(id);
          const def = getDef(b.def);
          if (def.power) {
            b.powered = true;
          } else {
            const use = powerUseOf(b, def) * conservation;
            demandTotal += use;
            if (use <= remaining + 1e-6) {
              remaining -= use;
              b.powered = true;
            }
          }
        }
        if (b.powered) w.powered[i] = 1;
      } else if (remaining > 0) {
        w.powered[i] = 1;
      }
    }
    compId++;
  }
  // unconnected demand still counts
  for (const b of w.buildings.values()) {
    const i = w.idx(b.x, b.y);
    if (comp[i] < 0) {
      const def = getDef(b.def);
      demandTotal += powerUseOf(b, def) * conservation;
      if (!def.powerUse && !def.growable && !def.residents) b.powered = true; // parks etc. need no power
    }
  }
  sim.stats.powerSupply = supplyTotal;
  sim.stats.powerDemand = demandTotal;
}

/** Water: sources → pipe networks → coverage → allocation. */
export function updateWater(sim: Sim): void {
  const w = sim.world;
  const W = w.w;
  const H = w.h;
  w.watered.fill(0);
  for (const b of w.buildings.values()) b.watered = false;
  const conservation = sim.city.ordinances.water_conservation ? 0.8 : 1;
  const netOf = new Int32Array(w.size).fill(-1);
  const coverOf = new Int32Array(w.size).fill(-1);
  const supplies: number[] = [];
  const nb: number[] = [0, 0, 0, 0];
  let supplyTotal = 0;
  let demandTotal = 0;
  let dealUsed = false;

  const sources = [...w.buildings.values()].filter((b) => (getDef(b.def).water ?? 0) > 0 && b.build <= 0);
  for (const src of sources) {
    const start = w.idx(src.x, src.y);
    if (netOf[start] >= 0) continue;
    const id = supplies.length;
    // network nodes: source footprints (any water building) + pipes
    const q: number[] = [];
    const isNode = (j: number) => {
      if (w.net[j] & NET.PIPE) return true;
      const bid = w.bld[j];
      if (!bid) return false;
      const b = w.buildings.get(bid)!;
      return (getDef(b.def).water ?? 0) > 0 && b.build <= 0;
    };
    for (let y = src.y; y < src.y + src.h; y++) {
      for (let x = src.x; x < src.x + src.w; x++) {
        const i = w.idx(x, y);
        if (netOf[i] < 0) {
          netOf[i] = id;
          q.push(i);
        }
      }
    }
    let touchesEdge = false;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      const x = i % W;
      const y = (i / W) | 0;
      if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && w.net[i] & NET.PIPE) touchesEdge = true;
      const n = neighbours(i, W, H, nb);
      for (let k = 0; k < n; k++) {
        const j = nb[k];
        if (netOf[j] >= 0 || !isNode(j)) continue;
        // pull in the whole footprint of a source building
        const bid = w.bld[j];
        if (bid && !(w.net[j] & NET.PIPE)) {
          const b = w.buildings.get(bid)!;
          for (let yy = b.y; yy < b.y + b.h; yy++) {
            for (let xx = b.x; xx < b.x + b.w; xx++) {
              const t = w.idx(xx, yy);
              if (netOf[t] < 0) {
                netOf[t] = id;
                q.push(t);
              }
            }
          }
        } else {
          netOf[j] = id;
          q.push(j);
        }
      }
    }
    // supply
    let supply = 0;
    const counted = new Set<number>();
    for (const i of q) {
      const bid = w.bld[i];
      if (!bid || counted.has(bid)) continue;
      counted.add(bid);
      const b = w.buildings.get(bid)!;
      const def = getDef(b.def);
      if (!def.water) continue;
      if ((def.powerUse ?? 0) > 0 && !b.powered) continue;
      let out = def.water;
      if (def.id === 'water_pump' && w.touchesWater(b.x, b.y, 1, 1)) out *= 1.5;
      supply += out;
    }
    if (sim.city.deals.water && touchesEdge && !dealUsed) {
      supply += 4000;
      dealUsed = true;
    }
    supplies.push(supply);
    supplyTotal += supply;
    if (supply <= 0) continue;
    // coverage stamp around each node
    for (const i of q) {
      const x = i % W;
      const y = (i / W) | 0;
      for (let yy = Math.max(0, y - PIPE_REACH); yy <= Math.min(H - 1, y + PIPE_REACH); yy++) {
        for (let xx = Math.max(0, x - PIPE_REACH); xx <= Math.min(W - 1, x + PIPE_REACH); xx++) {
          const t = yy * W + xx;
          if (coverOf[t] < 0) coverOf[t] = id;
        }
      }
    }
  }

  // allocate to buildings per network
  const demandBy = new Map<number, Building[]>();
  for (const b of w.buildings.values()) {
    const def = getDef(b.def);
    const use = waterUseOf(b, def) * conservation;
    demandTotal += use;
    if (def.water) {
      b.watered = true;
      continue;
    }
    if (use <= 0) {
      b.watered = coverOf[w.idx(b.x, b.y)] >= 0;
      continue;
    }
    let net = -1;
    for (let y = b.y; y < b.y + b.h && net < 0; y++) for (let x = b.x; x < b.x + b.w && net < 0; x++) net = coverOf[w.idx(x, y)];
    if (net < 0) continue;
    let list = demandBy.get(net);
    if (!list) demandBy.set(net, (list = []));
    list.push(b);
  }
  for (const [net, list] of demandBy) {
    let remaining = supplies[net];
    list.sort((a, b) => a.id - b.id);
    for (const b of list) {
      const use = waterUseOf(b, getDef(b.def)) * conservation;
      if (use <= remaining) {
        remaining -= use;
        b.watered = true;
      }
    }
  }
  for (let i = 0; i < w.size; i++) if (coverOf[i] >= 0) w.watered[i] = 1;
  sim.stats.waterSupply = supplyTotal;
  sim.stats.waterDemand = demandTotal;
}
