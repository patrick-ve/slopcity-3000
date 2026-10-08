/**
 * City planner: lays out a working city on any terrain (road grid, zones,
 * power, water, services, transit). Used for starter cities, scenarios,
 * the title-screen city and balance tests. All changes go through the
 * normal player actions, so the result obeys the same rules as the player.
 */
import { applyPlan, linePath, planLine, planPlace, planZone, type LineKind } from './actions';
import { getDef } from './catalog';
import { Rng } from '../util/rng';
import type { Sim } from './sim';
import { NET, type ZoneKind } from './types';

export interface CityPlan {
  /** Planned area (inclusive tile rectangle). Defaults to the whole map minus a margin. */
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  /** City centre (defaults to the middle of the area). */
  cx?: number;
  cy?: number;
  /** Tiles between parallel roads (blocks are block × block). */
  block?: number;
  /** Highest zone density, used downtown (1–3). */
  density?: 1 | 2 | 3;
  /** Direction of the industrial district from the centre (radians, 0 = east). */
  industryAngle?: number;
  /** Basic services, or the full set (hospital, college, museum, stadium …). */
  services?: 'basic' | 'full';
  /** Power plant to build (several are built when the city needs them). */
  power?: string;
  /** Elevated highway across the city with on-ramps. */
  highway?: boolean;
  /** Subway lines through the centre. */
  subway?: boolean;
  /** Rail line with stations through the city. */
  rail?: boolean;
  /** Seed for small random choices (park types, mixed blocks). */
  seed?: number;
}

export interface PlannedCity {
  cx: number;
  cy: number;
  blocks: number;
  /** Rough capacity estimates used to size utilities. */
  residentsCap: number;
  powerNeed: number;
  waterNeed: number;
}

interface Block {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Distance from the centre, 0..1. */
  r: number;
  angle: number;
  kind: 'res' | 'com' | 'ind' | 'park' | 'none';
  density: number;
}

/** Rough residents / jobs per zoned tile by density (for sizing utilities). */
const RES_PER_TILE = [0, 9, 40, 140];
const JOBS_PER_TILE = [0, 10, 40, 160];

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function layoutCity(sim: Sim, plan: CityPlan = {}): PlannedCity {
  const w = sim.world;
  const rng = new Rng(plan.seed ?? 1234);
  const margin = 3;
  const x0 = Math.max(1, plan.x0 ?? margin);
  const y0 = Math.max(1, plan.y0 ?? margin);
  const x1 = Math.min(w.w - 2, plan.x1 ?? w.w - 1 - margin);
  const y1 = Math.min(w.h - 2, plan.y1 ?? w.h - 1 - margin);
  const cx = plan.cx ?? Math.round((x0 + x1) / 2);
  const cy = plan.cy ?? Math.round((y0 + y1) / 2);
  const B = plan.block ?? 8;
  const S = B + 1;
  const density = plan.density ?? 2;
  const indAngle = plan.industryAngle ?? 0;
  const funds = sim.city.funds;
  sim.city.funds = 1e9;

  const okLand = (x: number, y: number) => w.inBounds(x, y) && !w.isWater(x, y) && w.tileMax(x, y) - w.tileMin(x, y) <= 2;
  const line = (kind: LineKind, xa: number, ya: number, xb: number, yb: number) => applyPlan(planLine(sim, kind, linePath(xa, ya, xb, yb)));

  // ---- road grid aligned on the centre, built in runs over buildable land
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = cx - Math.floor((cx - x0) / S) * S; x <= x1; x += S) xs.push(x);
  for (let y = cy - Math.floor((cy - y0) / S) * S; y <= y1; y += S) ys.push(y);
  const runs: [number, number, number, number][] = [];
  const buildRuns = (vertical: boolean, k: number, from: number, to: number) => {
    let start = -1;
    for (let t = from; t <= to + 1; t++) {
      const x = vertical ? k : t;
      const y = vertical ? t : k;
      const ok = t <= to && okLand(x, y) && !w.bld[w.idx(x, y)];
      if (ok && start < 0) start = t;
      if (!ok && start >= 0) {
        if (t - 1 - start >= 1) runs.push(vertical ? [k, start, k, t - 1] : [start, k, t - 1, k]);
        start = -1;
      }
    }
  };
  for (const x of xs) buildRuns(true, x, ys[0], ys[ys.length - 1]);
  for (const y of ys) buildRuns(false, y, xs[0], xs[xs.length - 1]);
  for (const [ax, ay, bx, by] of runs) line('road', ax, ay, bx, by);
  // bridge the main avenues over rivers and lakes where possible
  for (const [vertical, k] of [
    [true, cx],
    [false, cy],
  ] as const) {
    const from = vertical ? ys[0] : xs[0];
    const to = vertical ? ys[ys.length - 1] : xs[xs.length - 1];
    if (vertical) line('road', k, from, k, to);
    else line('road', from, k, to, k);
  }

  // ---- blocks and zoning
  const maxR = Math.max(cx - x0, x1 - cx, cy - y0, y1 - cy, 1);
  const blocks: Block[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < ys.length; j++) {
      const b: Block = { x0: xs[i] + 1, y0: ys[j] + 1, x1: xs[i + 1] - 1, y1: ys[j + 1] - 1, r: 0, angle: 0, kind: 'none', density: 1 };
      const bx = (b.x0 + b.x1) / 2;
      const by = (b.y0 + b.y1) / 2;
      b.r = Math.hypot(bx - cx, by - cy) / maxR;
      b.angle = Math.atan2(by - cy, bx - cx);
      let good = 0;
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (okLand(x, y)) good++;
      if (good < B * B * 0.45) continue;
      if (b.r > 0.32 && angleDiff(b.angle, indAngle) < 0.62) {
        b.kind = 'ind';
        b.density = Math.min(2, density);
      } else if (b.r < 0.2) {
        b.kind = 'com';
        b.density = density;
      } else {
        b.kind = rng.next() < (b.r < 0.6 ? 0.22 : 0.1) ? 'com' : 'res';
        b.density = b.r < 0.42 ? density : b.r < 0.72 ? Math.max(1, density - 1) : 1;
        if (b.kind === 'com') b.density = Math.min(b.density, 2);
      }
      if (b.kind === 'res' && rng.next() < 0.06) b.kind = 'park';
      blocks.push(b);
    }
  }
  const zoneOf = { res: 1, com: 2, ind: 3 } as const;
  for (const b of blocks) {
    if (b.kind === 'res' || b.kind === 'com' || b.kind === 'ind') {
      applyPlan(planZone(sim, b.x0, b.y0, b.x1, b.y1, zoneOf[b.kind] as ZoneKind, b.density));
    }
  }
  const byDistance = (px: number, py: number, kinds: Block['kind'][]) =>
    blocks
      .filter((b) => kinds.includes(b.kind))
      .sort(
        (a, b) => Math.hypot((a.x0 + a.x1) / 2 - px, (a.y0 + a.y1) / 2 - py) - Math.hypot((b.x0 + b.x1) / 2 - px, (b.y0 + b.y1) / 2 - py),
      );
  /** Place a building somewhere in the first block (of the given kinds) near (px, py) where it fits. */
  const placeNear = (def: string, px: number, py: number, kinds: Block['kind'][] = ['res', 'com', 'park']): boolean => {
    const d = getDef(def);
    for (const b of byDistance(px, py, kinds).slice(0, 6)) {
      for (let y = b.y0; y + d.h - 1 <= b.y1; y++) {
        for (let x = b.x0; x + d.w - 1 <= b.x1; x++) {
          const p = planPlace(sim, def, x, y, 'auto');
          if (p.ok && applyPlan(p)) return true;
        }
      }
    }
    return false;
  };
  /** Place copies of a building on a lattice so coverage spreads over the city. */
  const spread = (def: string, spacing: number, phase = 0) => {
    for (let y = y0 + spacing / 2 + phase; y <= y1; y += spacing) {
      for (let x = x0 + spacing / 2 + phase; x <= x1; x += spacing) {
        if (byDistance(x, y, ['res', 'com'])[0]) placeNear(def, x, y);
      }
    }
  };

  // ---- capacity estimates
  let resCap = 0;
  let jobs = 0;
  for (const b of blocks) {
    const tiles = (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
    if (b.kind === 'res') resCap += tiles * RES_PER_TILE[b.density];
    if (b.kind === 'com' || b.kind === 'ind') jobs += tiles * JOBS_PER_TILE[b.density];
  }
  const water = resCap * 0.14 + jobs * 0.12;
  const powerNeed = resCap * 0.016 + jobs * 0.045;

  // ---- transit (before services, so stations get the good spots)
  if (plan.highway && sim.year >= 1940) {
    // the highway runs two tiles south of the main avenue; ramps sit in the row between them
    const hy = cy + 2;
    if (line('highway', 0, hy, w.w - 1, hy) || line('highway', x0, hy, x1, hy)) {
      for (let i = 0; i + 1 < xs.length; i += 2) applyPlan(planPlace(sim, 'onramp', xs[i] + 2, cy + 1, 'auto'));
    }
  }
  if (plan.subway) {
    const lines: [number, number, number, number][] = [
      [cx + 1, ys[0] + 1, cx + 1, ys[ys.length - 1] - 1],
      [xs[0] + 1, cy - 1, xs[xs.length - 1] - 1, cy - 1],
    ];
    for (const [ax, ay, bx, by] of lines) {
      if (!line('subway', ax, ay, bx, by)) continue;
      const len = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let t = 0; t <= len; t += 9) {
        const sx = ax === bx ? ax : ax + t;
        const sy = ax === bx ? ay + t : ay;
        applyPlan(planPlace(sim, 'subway_station', sx, sy, 'auto'));
      }
    }
  }
  if (plan.rail) {
    const ry = cy - S;
    if (line('rail', 0, ry - 1, w.w - 1, ry - 1)) {
      placeNear('train_station', cx - S, ry);
      placeNear('train_station', cx + S * 2, ry);
    }
  }

  // ---- power: plants in the industrial district, lines across every road between blocks
  const plantId = plan.power ?? (sim.year >= 1955 && powerNeed > 1800 ? 'nuclear_plant' : 'coal_plant');
  const plantOut = getDef(plantId).power ?? 600;
  const ix = cx + Math.cos(indAngle) * maxR * 0.7;
  const iy = cy + Math.sin(indAngle) * maxR * 0.7;
  const plants = Math.max(1, Math.ceil((powerNeed * 1.25) / plantOut));
  for (let k = 0; k < plants; k++) placeNear(plantId, ix, iy, ['ind', 'res', 'com', 'park']);
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j + 1 < ys.length; j++) {
      const my = Math.floor((ys[j] + ys[j + 1]) / 2);
      if (w.hasNet(xs[i], my, NET.ROAD)) applyPlan(planLine(sim, 'power', [[xs[i], my]]));
    }
  }
  for (let j = 0; j < ys.length; j++) {
    for (let i = 0; i + 1 < xs.length; i++) {
      const mx = Math.floor((xs[i] + xs[i + 1]) / 2);
      if (w.hasNet(mx, ys[j], NET.ROAD)) applyPlan(planLine(sim, 'power', [[mx, ys[j]]]));
    }
  }

  // ---- water: pumps among the factories, pipes under every road
  const pumps = Math.max(2, Math.ceil((water * 1.3) / 900));
  for (let k = 0; k < pumps; k++) placeNear('water_pump', ix, iy, ['ind', 'res', 'com']);
  for (const [ax, ay, bx, by] of runs) line('pipe', ax, ay, bx, by);
  line('pipe', cx, ys[0], cx, ys[ys.length - 1]);
  line('pipe', xs[0], cy, xs[xs.length - 1], cy);

  // ---- services
  spread('police_station', 26);
  spread('fire_station', 26, 8);
  spread('school', 26, 4);
  if (plan.services === 'full') {
    spread('hospital', 36, 10);
    placeNear('college', cx + S, cy + S);
    placeNear('library', cx - S, cy);
    placeNear('museum', cx, cy - S);
    if (resCap > 15000) placeNear('stadium', cx - S * 2, cy + S * 2);
    placeNear('water_treatment', ix, iy, ['ind', 'res']);
  } else {
    spread('clinic', 22, 6);
  }
  // garbage: neighbours take 1,500 t a month; burn the rest
  const garbage = resCap * 0.75 * 0.01 + jobs * 0.75 * 0.015;
  const burner = sim.year >= 1975 ? 'waste_to_energy' : 'incinerator';
  const burners = Math.ceil(Math.max(0, garbage - 1200) / (getDef(burner).burn ?? 400));
  for (let k = 0; k < burners; k++) placeNear(burner, ix, iy, ['ind']);
  // a park in most residential blocks, bigger parks here and there
  for (const b of blocks) {
    if (b.kind === 'park') {
      applyPlan(planPlace(sim, 'large_park', b.x0 + 1, b.y0 + 1, 'auto'));
      applyPlan(planPlace(sim, 'playground', b.x0 + 5, b.y0 + 5, 'auto'));
      continue;
    }
    if (b.kind !== 'res' || rng.next() < 0.35) continue;
    const def = rng.pick(['small_park', 'small_park', 'playground', 'plaza']);
    const x = rng.next() < 0.5 ? b.x0 : b.x1;
    const y = rng.next() < 0.5 ? b.y0 : b.y1;
    applyPlan(planPlace(sim, def, x, y, 'auto'));
  }

  connectPower(sim);

  // ---- neighbour links: the main avenues continue to the map edges
  line('road', cx, ys[0], cx, 0);
  line('road', cx, ys[ys.length - 1], cx, w.h - 1);
  line('road', xs[0], cy, 0, cy);
  line('road', xs[xs.length - 1], cy, w.w - 1, cy);

  // ---- a sensible budget for a growing city
  sim.city.deals.garbage = true;
  if (resCap > 6000) sim.city.ordinances.recycling = true;
  sim.city.ordinances.pro_reading = true;
  sim.city.funds = funds;
  sim.recompute(true);
  return {
    cx,
    cy,
    blocks: blocks.length,
    residentsCap: Math.round(resCap),
    powerNeed: Math.round(powerNeed),
    waterNeed: Math.round(water),
  };
}

/**
 * Make sure every zone can get power: find conductors (zones, buildings, power
 * lines) that no power plant reaches and lay the shortest power line to them.
 */
export function connectPower(sim: Sim, maxLinks = 80): number {
  const w = sim.world;
  const W = w.w;
  const conducts = (i: number) => (w.net[i] & NET.POWER) !== 0 || w.bld[i] !== 0 || w.zone[i] !== 0;
  let links = 0;
  for (; links < maxLinks; links++) {
    // conductors reached from the power plants
    const reached = new Uint8Array(w.size);
    const q: number[] = [];
    for (const b of w.buildings.values()) {
      if (!(getDef(b.def).power ?? 0)) continue;
      const i = w.idx(b.x, b.y);
      if (!reached[i]) {
        reached[i] = 1;
        q.push(i);
      }
    }
    if (!q.length) return links;
    const nb = (i: number) => {
      const x = i % W;
      const y = (i / W) | 0;
      return [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < w.h - 1 ? i + W : -1];
    };
    for (let k = 0; k < q.length; k++) {
      for (const j of nb(q[k])) {
        if (j < 0 || reached[j] || !conducts(j)) continue;
        reached[j] = 1;
        q.push(j);
      }
    }
    // shortest gap (through anything but buildings) from the powered network to an unreached zone
    const prev = new Int32Array(w.size).fill(-2);
    const frontier: number[] = [];
    for (const i of q) {
      prev[i] = -1;
      frontier.push(i);
    }
    let target = -1;
    for (let k = 0; k < frontier.length && target < 0; k++) {
      for (const j of nb(frontier[k])) {
        if (j < 0 || prev[j] !== -2 || w.bld[j]) continue;
        prev[j] = frontier[k];
        if (conducts(j)) {
          target = j;
          break;
        }
        frontier.push(j);
      }
    }
    if (target < 0) return links;
    for (let i = prev[target]; i >= 0 && !reached[i]; i = prev[i]) applyPlan(planLine(sim, 'power', [[i % W, (i / W) | 0]]));
  }
  return links;
}

/** Run the simulation for a number of days without disasters (for prebuilt cities). */
export function growCity(sim: Sim, days: number): void {
  const disasters = sim.city.disastersEnabled;
  sim.city.disastersEnabled = false;
  for (let d = 0; d < days; d++) sim.stepDay();
  sim.city.disastersEnabled = disasters;
}
