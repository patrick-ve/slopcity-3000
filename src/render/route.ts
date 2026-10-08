/**
 * Paths for vehicles on track networks: legs along an edge (offset into a
 * lane) and turns through junctions, as quadratic curves.
 */
import type { TrackNet } from '../sim/tracks/net';
import { curvePoint, curveTangent, lineIntersect, paramAt, type Curve, type Polyline } from '../sim/tracks/geom';

export interface Leg {
  /** Edge followed (0 for a turn through a junction). */
  edge: number;
  /** +1 from the edge's start to its end, −1 back. */
  dir: 1 | -1;
  /** Arc lengths along the edge where the leg starts and ends. */
  s0: number;
  s1: number;
  q: Curve | null;
  poly: Polyline | null;
  /** A turn: quadratic from (ax, az) through (cx, cz) to (bx, bz) at a node. */
  node: number;
  ax: number;
  az: number;
  cx: number;
  cz: number;
  bx: number;
  bz: number;
  len: number;
}

/** Position and unit travel direction. */
export interface Pose {
  x: number;
  z: number;
  dx: number;
  dz: number;
  /** Arc length along the edge (edge legs). */
  s: number;
}

/**
 * The leg along an edge entered from node `from`. With `junctions`, it runs
 * between the junction cuts (cars turn through the junction on their own
 * curve); without, it runs from node to node (trains).
 */
export function edgeLeg(net: TrackNet, edge: number, from: number, junctions: boolean): Leg {
  const e = net.edges.get(edge)!;
  const len = net.length(edge);
  const [c0, c1] = junctions ? [net.cutAt(edge, 0), net.cutAt(edge, 1)] : [0, 0];
  const fwd = e.a === from;
  const s0 = fwd ? c0 : len - c1;
  const s1 = fwd ? len - c1 : c0;
  return {
    edge,
    dir: fwd ? 1 : -1,
    s0,
    s1,
    q: net.curve(e),
    poly: net.poly(edge),
    node: 0,
    ax: 0,
    az: 0,
    cx: 0,
    cz: 0,
    bx: 0,
    bz: 0,
    len: Math.max(0, fwd ? s1 - s0 : s0 - s1),
  };
}

/** Where a vehicle is on a leg after distance d, `lane` to the right of the centre line. */
export function pose(leg: Leg, d: number, lane: number, out: Pose): Pose {
  const f = leg.len > 1e-9 ? Math.min(1, Math.max(0, d / leg.len)) : 0;
  if (leg.edge) {
    const s = leg.s0 + (leg.s1 - leg.s0) * f;
    const t = paramAt(leg.poly!, s);
    const [x, z] = curvePoint(leg.q!, t);
    const [tx, tz] = curveTangent(leg.q!, t);
    out.dx = tx * leg.dir;
    out.dz = tz * leg.dir;
    out.x = x - out.dz * lane;
    out.z = z + out.dx * lane;
    out.s = s;
    return out;
  }
  const u = 1 - f;
  out.x = u * u * leg.ax + 2 * u * f * leg.cx + f * f * leg.bx;
  out.z = u * u * leg.az + 2 * u * f * leg.cz + f * f * leg.bz;
  let dx = 2 * u * (leg.cx - leg.ax) + 2 * f * (leg.bx - leg.cx);
  let dz = 2 * u * (leg.cz - leg.az) + 2 * f * (leg.bz - leg.cz);
  const l = Math.hypot(dx, dz);
  if (l > 1e-9) {
    dx /= l;
    dz /= l;
  } else {
    dx = leg.bx - leg.ax;
    dz = leg.bz - leg.az;
    const m = Math.hypot(dx, dz) || 1;
    dx /= m;
    dz /= m;
  }
  out.dx = dx;
  out.dz = dz;
  out.s = 0;
  return out;
}

const tmpA: Pose = { x: 0, z: 0, dx: 0, dz: 0, s: 0 };
const tmpB: Pose = { x: 0, z: 0, dx: 0, dz: 0, s: 0 };

/**
 * A turn through `node` from the end of leg `a` to the start of leg `b`, in
 * the lane `lane`; null when the two meet (nothing to turn). A U-turn (same
 * edge back) swings out over the dead end.
 */
export function turnLeg(a: Leg, b: Leg, node: number, lane: number, swing: number): Leg | null {
  const p = pose(a, a.len, lane, tmpA);
  const q = pose(b, 0, lane, tmpB);
  const gap = Math.hypot(q.x - p.x, q.z - p.z);
  if (gap < 1e-3) return null;
  let cx: number;
  let cz: number;
  const r = lineIntersect(p.x, p.z, p.dx, p.dz, q.x, q.z, q.dx, q.dz);
  if (r && r[0] > 0 && r[1] < 0 && r[0] < 4 && r[1] > -4) {
    cx = p.x + p.dx * r[0];
    cz = p.z + p.dz * r[0];
  } else if (p.dx * q.dx + p.dz * q.dz < -0.5) {
    // turning back: swing out ahead
    cx = (p.x + q.x) / 2 + p.dx * swing;
    cz = (p.z + q.z) / 2 + p.dz * swing;
  } else {
    cx = (p.x + q.x) / 2;
    cz = (p.z + q.z) / 2;
  }
  // length of the curve from a few chords
  let len = 0;
  let px = p.x;
  let pz = p.z;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const u = 1 - t;
    const x = u * u * p.x + 2 * u * t * cx + t * t * q.x;
    const z = u * u * p.z + 2 * u * t * cz + t * t * q.z;
    len += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  return { edge: 0, dir: 1, s0: 0, s1: 0, q: null, poly: null, node, ax: p.x, az: p.z, cx, cz, bx: q.x, bz: q.z, len };
}

/** The node a leg ends at. */
export function legEnd(net: TrackNet, leg: Leg): number {
  const e = net.edges.get(leg.edge)!;
  return leg.dir === 1 ? e.b : e.a;
}

/**
 * Pick the edge to take at a node after arriving on `edge`: straight on is
 * likelier than turning; `maxTurn` (cosine) limits how sharply (trains).
 * Returns `edge` itself when the only way is back.
 */
export function chooseExit(
  net: TrackNet,
  node: number,
  edge: number,
  inDx: number,
  inDz: number,
  straightBias: number,
  minDot = -2,
): number {
  const opts: number[] = [];
  const weights: number[] = [];
  for (const arm of net.arms(node)) {
    if (arm.edge === edge) continue;
    const dot = arm.dx * inDx + arm.dy * inDz;
    if (dot < minDot) continue;
    opts.push(arm.edge);
    weights.push(dot > 0.9 ? straightBias : 1);
  }
  if (!opts.length) return edge;
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < opts.length; k++) {
    r -= weights[k];
    if (r <= 0) return opts[k];
  }
  return opts[opts.length - 1];
}
