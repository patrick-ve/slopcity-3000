import { LEVEL_H, type World } from '../../sim/world';
import { closestParam, curvePoint, curveTangent, lengthAt, paramAt, stripParams } from '../../sim/tracks/geom';
import type { TrackNet } from '../../sim/tracks/net';

/** Height offsets above the terrain for road layers (world units). */
export const ROAD_Y = 0.016;
export const MARK_Y = 0.024;
export const WALK_Y = 0.03;

/** World height of the water surface. */
export function waterY(world: World): number {
  return world.seaLevel * LEVEL_H - 0.07;
}

/** Height of a bridge deck. */
export function deckY(world: World): number {
  return world.seaLevel * LEVEL_H + 0.03;
}

/** Height of the drivable road surface at (x, z). */
export function roadSurfaceY(world: World, x: number, z: number): number {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  if (world.inBounds(tx, tz) && world.isWater(tx, tz)) return deckY(world) + 0.01;
  return world.surfaceY(x, z) + ROAD_Y;
}

/** A cross-section of a track: centre point, unit normal (to the right of travel) and arc length. */
export interface Section {
  x: number;
  z: number;
  nx: number;
  nz: number;
  s: number;
}

/** Cross-sections of an edge between two arc lengths (curves follow their samples). */
export function sections(net: TrackNet, id: number, s0: number, s1: number, maxStep = 1): Section[] {
  const e = net.edges.get(id)!;
  const q = net.curve(e);
  const p = net.poly(id);
  return stripParams(q, p, s0, s1, maxStep).map((t) => {
    const [x, z] = curvePoint(q, t);
    const [tx, tz] = curveTangent(q, t);
    return { x, z, nx: -tz, nz: tx, s: lengthAt(p, t) };
  });
}

/** Point at arc length s along an edge. */
export function pointAt(net: TrackNet, id: number, s: number): [number, number] {
  return curvePoint(net.curve(net.edges.get(id)!), paramAt(net.poly(id), s));
}

/** The points of cross-sections shifted sideways by `o` (flat x, z list). */
export function offsetLine(secs: Section[], o: number): number[] {
  const out: number[] = [];
  for (const c of secs) out.push(c.x + c.nx * o, c.z + c.nz * o);
  return out;
}

/** A rectangle along the track from arc length a to b, between lateral offsets o0 and o1. */
export function piece(net: TrackNet, id: number, a: number, b: number, o0: number, o1: number): [number[], number[]] {
  const secs = sections(net, id, a, b, 1);
  return [offsetLine(secs, o0), offsetLine(secs, o1)];
}

/** True if a road or rail runs on the ground at (x, z) (highway pillars stand beside them). */
export function trackBelow(world: World, x: number, z: number): boolean {
  for (const net of [world.tracks.road, world.tracks.rail]) {
    const reach = net.profile.hw + 0.12;
    const near = net.query(x - 1, z - 1, x + 1, z + 1);
    for (const id of near.nodes) {
      const n = net.nodes.get(id)!;
      if (Math.hypot(n.x - x, n.y - z) < reach + (net.degree(id) > 1 ? 0.6 : 0.5)) return true;
    }
    for (const id of near.edges) if (closestParam(net.curve(net.edges.get(id)!), x, z)[1] < reach) return true;
  }
  return false;
}
