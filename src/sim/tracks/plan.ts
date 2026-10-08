/**
 * Plans for building and removing track (roads, rails, highways): the edit
 * is tried on the network, checked against the map, priced, and undone; the
 * plan's apply() runs it for real.
 */
import { COSTS, LINE_YEARS } from '../catalog';
import { finishPlan, type Plan, type PlanTile } from '../plan';
import type { Sim } from '../sim';
import { convexOverlap, curveIntersections, curvePoint, curveTangent, minRadius, type Curve } from './geom';
import { addCurve, addGridPath, cutRect, newEditInfo, tidy, type EditInfo } from './edit';
import { TRACK_KINDS, type TrackKind, type TrackNet } from './net';

/** How new track is drawn: a tile path from the classic drag tool, or a free line or curve. */
export type TrackShape =
  { type: 'grid'; path: [number, number][] } | { type: 'free'; ax: number; ay: number; bx: number; by: number; c: [number, number] | null };

/** Price per newly covered tile: [on land, over water]. */
const PRICE: Record<TrackKind, [number, number]> = {
  road: [COSTS.road, COSTS.bridge],
  rail: [COSTS.rail, COSTS.railBridge],
  highway: [COSTS.highway, COSTS.highwayBridge],
};

const PLURAL: Record<TrackKind, string> = { road: 'Roads', rail: 'Tracks', highway: 'Highways' };
/** Road and rail must cross at least this steeply. */
const MIN_CROSSING_SIN = Math.sin((40 * Math.PI) / 180);

function runEdit(net: TrackNet, shape: TrackShape, info: EditInfo): void {
  if (shape.type === 'grid') addGridPath(net, shape.path, info);
  else addCurve(net, shape.ax, shape.ay, shape.bx, shape.by, shape.c, info);
  tidy(net, info);
}

export function planTrack(sim: Sim, kind: TrackKind, shape: TrackShape): Plan {
  const w = sim.world;
  const net = w.tracks[kind];
  const year = LINE_YEARS[kind];
  const tooEarly = !sim.city.sandbox && year !== undefined && sim.year < year;
  const info = newEditInfo();
  const res = net.trial(
    () => runEdit(net, shape, info),
    () => inspect(sim, net, info, shape),
  );
  let reason = res.reason;
  if (tooEarly) {
    reason = `Available in ${year}`;
    for (const t of res.tiles) t.ok = false;
  }
  const plan = finishPlan(
    sim,
    kind,
    res.tiles,
    res.cost,
    () => {
      if (!sim.spend(res.cost)) return;
      runEdit(net, shape, newEditInfo());
      net.refresh();
      w.syncTracks();
      // the commute graph uses roads and highways
      if (kind !== 'rail') sim.dirty.roads = true;
      sim.dirty.power = true;
      sim.dirty.water = true;
      sim.events.emit('sound', 'build');
    },
    reason,
  );
  plan.track = { kind, curves: res.curves };
  return plan;
}

interface Inspection {
  tiles: PlanTile[];
  cost: number;
  reason?: string;
  curves: Curve[];
}

/** Check a tried edit against the map (the network is in its edited state). */
function inspect(sim: Sim, net: TrackNet, info: EditInfo, shape: TrackShape): Inspection {
  const w = sim.world;
  const kind = net.kind;
  const prof = net.profile;
  let reason: string | undefined;
  const fail = (r: string) => {
    reason ??= r;
  };
  const added = info.added.filter((id) => net.edges.has(id));
  const nodes = [...info.nodes].filter((id) => net.nodes.has(id));
  const surface = kind !== 'highway';

  // ---- tiles: newly covered ones cost money, freed ones and track over old tiles are changes too
  const tiles: PlanTile[] = [];
  const seen = new Set<number>();
  let cost = 0;
  const [base, bridge] = PRICE[kind];
  const { on: fresh, off: freed } = net.changes();
  for (const i of freed) {
    seen.add(i);
    tiles.push({ x: i % w.w, y: (i / w.w) | 0, ok: true, change: true });
  }
  for (const i of fresh) {
    const x = i % w.w;
    const y = (i / w.w) | 0;
    seen.add(i);
    let ok = true;
    const water = w.isWater(x, y);
    if (w.bld[i]) {
      ok = false;
      fail('Blocked by a building');
    } else if (surface && !water && w.tileMax(x, y) - w.tileMin(x, y) > 2) {
      ok = false;
      fail('Too steep');
    }
    if (ok) cost += water ? bridge : base;
    tiles.push({ x, y, ok, change: true });
  }
  for (const id of added) {
    for (const i of net.tilesOf(-id)) {
      if (seen.has(i)) continue;
      seen.add(i);
      tiles.push({ x: i % w.w, y: (i / w.w) | 0, ok: true, change: true });
    }
  }
  if (shape.type === 'grid') {
    for (const [x, y] of shape.path) {
      if (!w.inBounds(x, y) || seen.has(w.idx(x, y))) continue;
      seen.add(w.idx(x, y));
      tiles.push({ x, y, ok: true, change: false });
    }
  }

  // ---- the map
  for (const id of nodes) {
    const n = net.nodes.get(id)!;
    if (n.x < 0 || n.y < 0 || n.x > w.w || n.y > w.h) fail('Outside the map');
  }
  for (const id of added) {
    const p = net.poly(id);
    for (let k = 0; k < p.n; k++) if (p.x[k] < 0 || p.y[k] < 0 || p.x[k] > w.w || p.y[k] > w.h) fail('Outside the map');
  }
  // bridges (and elevated highways over water) end on land
  for (const id of nodes) {
    const n = net.nodes.get(id)!;
    const tx = Math.floor(n.x);
    const ty = Math.floor(n.y);
    if (w.inBounds(tx, ty) && w.isWater(tx, ty)) fail('Bridges must end on land');
  }
  if (surface) {
    // bridges are straight, over water that is not too deep
    const bridges = new Set<number>();
    for (const id of added) {
      const e = net.edges.get(id)!;
      const q = net.curve(e);
      const len = net.length(id);
      let wet = false;
      for (let s = 0; s <= len; s += 0.2) {
        const [x, y] = curvePoint(q, s / len);
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        if (!w.inBounds(tx, ty) || !w.isWater(tx, ty)) continue;
        wet = true;
        if (w.tileMin(tx, ty) < w.seaLevel - 3) fail('The water is too deep for a bridge');
      }
      if (wet && e.curved) fail('Bridges must be straight');
      if (!e.curved) for (const i of net.tilesOf(-id)) bridges.add(i);
    }
    for (const i of fresh) if (w.isWaterIdx(i) && !bridges.has(i)) fail('Too close to the water');
  }

  // ---- junction shapes and curves
  for (const id of nodes) {
    const arms = net.arms(id);
    const k = arms.length;
    if (k < 2) continue;
    for (let i = 0; i < k; i++) {
      let gap = arms[(i + 1) % k].angle - arms[i].angle;
      if (gap <= 1e-9) gap += Math.PI * 2;
      if (gap < prof.minAngle - 1e-6) fail(`${PLURAL[kind]} must meet at a wider angle`);
    }
    for (const a of arms) {
      const e = net.edges.get(a.edge)!;
      const far = net.arms(net.other(e, id)).find((b) => b.edge === a.edge && b.end !== a.end);
      if (a.need + (far?.need ?? 0) > net.length(a.edge) + 0.02) fail('Junctions are too close together');
    }
  }
  for (const id of added) {
    const e = net.edges.get(id)!;
    if (e.curved && minRadius(net.curve(e)) < prof.minRadius - 1e-9) fail('This curve is too tight');
  }

  // ---- overlaps with the same network (track may only meet at junctions)
  const subjects = new Set<number>([...added.map((id) => -id), ...nodes]);
  const trisCache = new Map<number, number[][]>();
  const tris = (n: TrackNet, k: number) => {
    if (n !== net) return n.triangles(k);
    let t = trisCache.get(k);
    if (!t) trisCache.set(k, (t = n.triangles(k)));
    return t;
  };
  for (const k of subjects) {
    const mine = tris(net, k);
    if (!mine.length) continue;
    const related = new Set<number>([k]);
    if (k > 0) for (const e of net.edgesAt(k)) related.add(-e);
    else {
      const e = net.edges.get(-k)!;
      related.add(e.a).add(e.b);
    }
    const [x0, y0, x1, y1] = triBounds(mine);
    const near = net.query(x0, y0, x1, y1);
    for (const k2 of [...near.nodes, ...near.edges.map((id) => -id)]) {
      if (related.has(k2)) continue;
      if (anyOverlap(mine, tris(net, k2), 0.03)) {
        fail(`Too close to another ${prof.noun}`);
        break;
      }
    }
  }

  // ---- road and rail cross each other only at wide angles, away from junctions
  if (surface) {
    const other = w.tracks[kind === 'road' ? 'rail' : 'road'];
    const blocked = kind === 'road' ? 'Blocked by rail tracks' : 'Blocked by a road';
    const crossings: { x: number; y: number; r: number }[] = [];
    for (const id of added) {
      const q = net.curve(net.edges.get(id)!);
      const len = net.length(id);
      const near = other.query(
        Math.min(q.ax, q.bx, q.cx),
        Math.min(q.ay, q.by, q.cy),
        Math.max(q.ax, q.bx, q.cx),
        Math.max(q.ay, q.by, q.cy),
      );
      for (const oid of near.edges) {
        const oq = other.curve(other.edges.get(oid)!);
        const olen = other.length(oid);
        for (const [t, u] of curveIntersections(q, oq)) {
          const [x, y] = curvePoint(q, t);
          const [tx, ty] = curveTangent(q, t);
          const [ux, uy] = curveTangent(oq, u);
          const sin = Math.abs(tx * uy - ty * ux);
          if (sin < MIN_CROSSING_SIN) {
            fail('Road and rail must cross at a wide angle');
            continue;
          }
          const mineFree = Math.min(t * len - net.cutAt(id, 0), (1 - t) * len - net.cutAt(id, 1));
          const otherFree = Math.min(u * olen - other.cutAt(oid, 0), (1 - u) * olen - other.cutAt(oid, 1));
          if (mineFree < other.profile.hw / sin || otherFree < prof.hw / sin) fail('Road and rail cannot cross at a junction');
          crossings.push({ x, y, r: (prof.hw + other.profile.hw) / sin + 0.25 });
        }
      }
    }
    const nearCrossing = (t: number[]) => {
      const cx = (t[0] + t[2] + t[4]) / 3;
      const cy = (t[1] + t[3] + t[5]) / 3;
      return crossings.some((c) => Math.hypot(cx - c.x, cy - c.y) < c.r);
    };
    outer: for (const k of subjects) {
      const mine = tris(net, k);
      if (!mine.length) continue;
      const [x0, y0, x1, y1] = triBounds(mine);
      const near = other.query(x0, y0, x1, y1);
      for (const k2 of [...near.nodes, ...near.edges.map((id) => -id)]) {
        for (const a of mine) {
          for (const b of tris(other, k2)) {
            if (!convexOverlap(a, b, 0.02)) continue;
            if (k2 > 0 || !nearCrossing(a) || !nearCrossing(b)) {
              fail(blocked);
              break outer;
            }
          }
        }
      }
    }
  }
  return { tiles, cost, reason, curves: info.curves };
}

function triBounds(tris: number[][]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const t of tris) {
    for (let i = 0; i < 6; i += 2) {
      x0 = Math.min(x0, t[i]);
      x1 = Math.max(x1, t[i]);
      y0 = Math.min(y0, t[i + 1]);
      y1 = Math.max(y1, t[i + 1]);
    }
  }
  return [x0, y0, x1, y1];
}

function anyOverlap(a: number[][], b: number[][], tol: number): boolean {
  for (const p of a) for (const q of b) if (convexOverlap(p, q, tol)) return true;
  return false;
}

/**
 * Track removal for the bulldozer: which tiles outside the rectangle it frees
 * as well (a cut road's new dead end may cover less), and the edit itself.
 */
export function trackCut(sim: Sim, x0: number, y0: number, x1: number, y1: number): { freed: number[]; apply: () => void } {
  const w = sim.world;
  const ax = Math.min(x0, x1);
  const bx = Math.max(x0, x1);
  const ay = Math.min(y0, y1);
  const by = Math.max(y0, y1);
  const kinds = TRACK_KINDS.filter((k) => {
    const flag = w.tracks[k].profile.flag;
    for (let y = Math.max(0, ay); y <= Math.min(w.h - 1, by); y++)
      for (let x = Math.max(0, ax); x <= Math.min(w.w - 1, bx); x++) if (w.net[w.idx(x, y)] & flag) return true;
    return false;
  });
  const cut = (net: TrackNet) => {
    const info = newEditInfo();
    cutRect(net, ax, ay, bx, by, info);
    tidy(net, info);
  };
  const freed = new Set<number>();
  for (const k of kinds) {
    const net = w.tracks[k];
    net.trial(
      () => cut(net),
      () => {
        for (const t of net.changes().off) freed.add(t);
      },
    );
  }
  return {
    freed: [...freed],
    apply: () => {
      for (const k of kinds) {
        cut(w.tracks[k]);
        w.tracks[k].refresh();
      }
      w.syncTracks();
    },
  };
}
