/** Snapping for the free track tools: to existing track, to tidy angles, along a dead end. */
import { closestParam, curvePoint } from '../sim/tracks/geom';
import type { TrackNet } from '../sim/tracks/net';

/** A point for the track tools, and what it snapped to (0 = nothing). */
export interface Snap {
  x: number;
  y: number;
  node: number;
  edge: number;
}

/** How close (tiles) the pointer must be to snap to a node or to the middle of a track. */
const NODE_SNAP = 0.6;
const EDGE_SNAP = 0.45;

/** Snap a map point to the nearest node, else the nearest track, of a network. */
export function snapToNet(net: TrackNet, x: number, y: number): Snap {
  let best: Snap = { x, y, node: 0, edge: 0 };
  let bd = NODE_SNAP;
  const near = net.query(x - 1, y - 1, x + 1, y + 1);
  for (const id of near.nodes) {
    const n = net.nodes.get(id)!;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) {
      bd = d;
      best = { x: n.x, y: n.y, node: id, edge: 0 };
    }
  }
  if (best.node) return best;
  bd = EDGE_SNAP;
  for (const id of near.edges) {
    const q = net.curve(net.edges.get(id)!);
    const [t, d] = closestParam(q, x, y);
    if (d < bd) {
      bd = d;
      const [px, py] = curvePoint(q, t);
      best = { x: px, y: py, node: 0, edge: id };
    }
  }
  return best;
}

/**
 * Turn the direction a → b to a multiple of `step` radians, keeping its
 * length, when it is within `tolerance` of one (any tolerance ≥ step / 2
 * always snaps).
 */
export function snapAngle(ax: number, ay: number, bx: number, by: number, step: number, tolerance: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [bx, by];
  const ang = Math.atan2(dy, dx);
  const snapped = Math.round(ang / step) * step;
  if (Math.abs(snapped - ang) > tolerance) return [bx, by];
  return [ax + Math.cos(snapped) * len, ay + Math.sin(snapped) * len];
}

/**
 * The way a new track continues smoothly out of a dead end at `node`
 * (unit vector), or null when the node is not a dead end.
 */
export function continuation(net: TrackNet, node: number): [number, number] | null {
  if (!node || net.degree(node) !== 1) return null;
  const arm = net.arms(node)[0];
  return [-arm.dx, -arm.dy];
}
