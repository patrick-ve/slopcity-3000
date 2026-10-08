import { LEVEL_H, type World } from '../../sim/world';
import { clipHalf, clipRect, polyArea } from '../../sim/tracks/geom';
import type { GroundBuf } from '../buffers';

/** Where track geometry goes: a ground buffer and the chunk's tile range (x1, y1 exclusive). */
export interface Target {
  world: World;
  buf: GroundBuf;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface DrapeStyle {
  hex: number;
  /** Height above the terrain on land tiles; undefined skips land. */
  land?: number;
  /** Fixed height over water tiles (bridge decks); undefined skips water. */
  water?: number;
  /** Land tiles with any of these NET bits use `onFlag` instead (rails over roads). */
  flag?: number;
  /** Height above the terrain on `flag` tiles; undefined skips those tiles. */
  onFlag?: number;
}

/** True if a map point lies in the target chunk. */
export function inChunk(t: Target, x: number, y: number): boolean {
  return x >= t.x0 && y >= t.y0 && x < t.x1 && y < t.y1;
}

/**
 * Lay a convex polygon (flat x, z list) on the terrain: it is cut along tile
 * edges and terrain triangle diagonals so every piece lies exactly on one
 * terrain triangle (no gaps, no clipping into slopes).
 */
export function drape(t: Target, poly: number[], style: DrapeStyle): void {
  const n = poly.length >> 1;
  if (n < 3) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, poly[i * 2]);
    maxX = Math.max(maxX, poly[i * 2]);
    minY = Math.min(minY, poly[i * 2 + 1]);
    maxY = Math.max(maxY, poly[i * 2 + 1]);
  }
  const w = t.world;
  const tx0 = Math.max(t.x0, Math.floor(minX));
  const ty0 = Math.max(t.y0, Math.floor(minY));
  const tx1 = Math.min(t.x1 - 1, Math.ceil(maxX) - 1);
  const ty1 = Math.min(t.y1 - 1, Math.ceil(maxY) - 1);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const piece = clipRect(poly, tx, ty, tx + 1, ty + 1);
      if (piece.length < 6 || Math.abs(polyArea(piece)) < 1e-8) continue;
      if (w.isWater(tx, ty)) {
        if (style.water === undefined) continue;
        emit(t.buf, piece, () => style.water!, style.hex);
        continue;
      }
      let off = style.land;
      if (style.flag && w.net[w.idx(tx, ty)] & style.flag) off = style.onFlag;
      if (off === undefined) continue;
      const lift = off;
      const height = (x: number, z: number) => w.heightAt(x, z) * LEVEL_H + lift;
      if (w.isFlat(tx, ty)) {
        emit(t.buf, piece, height, style.hex);
      } else if (w.splitsMain(tx, ty)) {
        // terrain triangles either side of the (0,0)-(1,1) diagonal: u − v ≥ 0 and u − v ≤ 0
        const d = tx - ty;
        emit(t.buf, clipHalf(piece, -1, 1, -d), height, style.hex);
        emit(t.buf, clipHalf(piece, 1, -1, d), height, style.hex);
      } else {
        // either side of the (1,0)-(0,1) diagonal: u + v ≤ 1 and u + v ≥ 1
        const d = tx + ty + 1;
        emit(t.buf, clipHalf(piece, 1, 1, d), height, style.hex);
        emit(t.buf, clipHalf(piece, -1, -1, -d), height, style.hex);
      }
    }
  }
}

/** Fan-triangulate a convex polygon with heights from `y`, facing up. */
function emit(buf: GroundBuf, p: number[], y: (x: number, z: number) => number, hex: number): void {
  const n = p.length >> 1;
  if (n < 3) return;
  const area = polyArea(p);
  if (Math.abs(area) < 1e-8) return;
  // GroundBuf faces up when the (x, z) winding is clockwise in x-right, z-up axes (negative area)
  const order = area < 0 ? (i: number) => i : (i: number) => n - 1 - i;
  const ax = p[order(0) * 2];
  const az = p[order(0) * 2 + 1];
  const ay = y(ax, az);
  for (let k = 1; k + 1 < n; k++) {
    const bx = p[order(k) * 2];
    const bz = p[order(k) * 2 + 1];
    const cx = p[order(k + 1) * 2];
    const cz = p[order(k + 1) * 2 + 1];
    buf.tri(ax, ay, az, bx, y(bx, bz), bz, cx, y(cx, cz), cz, hex);
  }
}

/** Fan-triangulate a star-shaped polygon around (cx, cz) into convex triangles and drape each. */
export function drapeFan(t: Target, cx: number, cz: number, ring: number[], style: DrapeStyle): void {
  const n = ring.length >> 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    drape(t, [cx, cz, ring[i * 2], ring[i * 2 + 1], ring[j * 2], ring[j * 2 + 1]], style);
  }
}

/** Drape the band between two parallel point lists (flat x, z) as a row of quads. */
export function drapeBand(t: Target, a: number[], b: number[], style: DrapeStyle): void {
  for (let i = 0; i + 3 < a.length && i + 3 < b.length; i += 2) {
    const q = [a[i], a[i + 1], a[i + 2], a[i + 3], b[i + 2], b[i + 3], b[i], b[i + 1]];
    if (Math.abs(polyArea(q)) < 1e-8) continue;
    if (isConvex(q)) drape(t, q, style);
    else {
      drape(t, [q[0], q[1], q[2], q[3], q[4], q[5]], style);
      drape(t, [q[0], q[1], q[4], q[5], q[6], q[7]], style);
    }
  }
}

function isConvex(q: number[]): boolean {
  const n = q.length >> 1;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    const c = ((i + 2) % n) * 2;
    const cross = (q[b] - q[a]) * (q[c + 1] - q[b + 1]) - (q[b + 1] - q[a + 1]) * (q[c] - q[b]);
    if (Math.abs(cross) < 1e-12) continue;
    const s = Math.sign(cross);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}
