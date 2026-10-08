import type { GroundBuf } from '../buffers';
import { shade } from '../geom';

/** Quad with its front face turned toward `out`. */
export function quadOut(buf: GroundBuf, a: number[], b: number[], c: number[], d: number[], out: number[], hex: number): void {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) buf.quad(a, b, c, d, hex);
  else buf.quad(d, c, b, a, hex);
}

/** Triangle with its front face turned toward `out`. */
export function triOut(buf: GroundBuf, a: number[], b: number[], c: number[], out: number[], hex: number): void {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) < 1e-12) return;
  if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) buf.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], hex);
  else buf.tri(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2], hex);
}

/** Solid axis-aligned box in world space. */
export function groundBox(
  buf: GroundBuf,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  hex: number,
  top?: number,
): void {
  const t = top ?? hex;
  buf.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], t);
  buf.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], shade(hex, 0.92));
  buf.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], shade(hex, 0.92));
  buf.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], shade(hex, 0.85));
  buf.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], shade(hex, 0.85));
}

/**
 * Sloped box along a horizontal line: from (sx, sz) with its top at sy to
 * (ex, ez) with its top at ey, `hw` wide on each side and `th` thick.
 */
export function slab(
  buf: GroundBuf,
  sx: number,
  sz: number,
  sy: number,
  ex: number,
  ez: number,
  ey: number,
  hw: number,
  th: number,
  top: number,
  side: number,
  ends = false,
): void {
  const len = Math.hypot(ex - sx, ez - sz) || 1;
  const lx = (-(ez - sz) / len) * hw;
  const lz = ((ex - sx) / len) * hw;
  const sL = [sx - lx, sy, sz - lz];
  const sR = [sx + lx, sy, sz + lz];
  const eL = [ex - lx, ey, ez - lz];
  const eR = [ex + lx, ey, ez + lz];
  const sLb = [sL[0], sy - th, sL[2]];
  const sRb = [sR[0], sy - th, sR[2]];
  const eLb = [eL[0], ey - th, eL[2]];
  const eRb = [eR[0], ey - th, eR[2]];
  quadOut(buf, sL, sR, eR, eL, [0, 1, 0], top);
  quadOut(buf, sRb, eRb, eR, sR, [lx, 0, lz], shade(side, 0.9));
  quadOut(buf, eLb, sLb, sL, eL, [-lx, 0, -lz], shade(side, 0.9));
  quadOut(buf, sLb, eLb, eRb, sRb, [0, -1, 0], shade(side, 0.7));
  if (ends) {
    const dx = ex - sx;
    const dz = ez - sz;
    quadOut(buf, eLb, eRb, eR, eL, [dx, 0, dz], shade(side, 0.82));
    quadOut(buf, sRb, sLb, sL, sR, [-dx, 0, -dz], shade(side, 0.82));
  }
}

/**
 * Vertical wall between two ground points, from `bottom` to `top` heights at
 * each end, facing `out` (x, z).
 */
export function wall(
  buf: GroundBuf,
  ax: number,
  az: number,
  aTop: number,
  aBottom: number,
  bx: number,
  bz: number,
  bTop: number,
  bBottom: number,
  outX: number,
  outZ: number,
  hex: number,
): void {
  if (Math.hypot(bx - ax, bz - az) < 1e-6) return;
  quadOut(buf, [ax, aBottom, az], [bx, bBottom, bz], [bx, bTop, bz], [ax, aTop, az], [outX, 0, outZ], hex);
}

/** Square pillar from the ground to a deck, with a cap beam across the deck direction (dx, dz). */
export function pillar(
  buf: GroundBuf,
  x: number,
  z: number,
  ground: number,
  top: number,
  dx: number,
  dz: number,
  hex: number,
  half = 0.07,
): void {
  if (top - ground < 0.02) return;
  groundBox(buf, x - half, ground, z - half, x + half, top, z + half, hex);
  const l = Math.hypot(dx, dz) || 1;
  const nx = -dz / l;
  const nz = dx / l;
  slab(buf, x - nx * 0.26, z - nz * 0.26, top, x + nx * 0.26, z + nz * 0.26, top, 0.08, 0.07, hex, hex, true);
}
