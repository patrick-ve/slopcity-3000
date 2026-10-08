import * as THREE from 'three';
import { LEVEL_H, type World } from '../sim/world';

export interface PickResult {
  /** Tile coordinates. */
  tx: number;
  ty: number;
  /** Exact hit point. */
  x: number;
  y: number;
  z: number;
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function rayTri(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): number {
  const e1x = bx - ax;
  const e1y = by - ay;
  const e1z = bz - az;
  const e2x = cx - ax;
  const e2y = cy - ay;
  const e2z = cz - az;
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-9) return -1;
  const inv = 1 / det;
  const tx = ox - ax;
  const ty = oy - ay;
  const tz = oz - az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < -1e-6 || u > 1 + 1e-6) return -1;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < -1e-6 || u + v > 1 + 1e-6) return -1;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t >= 0 ? t : -1;
}

function tileHit(world: World, tx: number, ty: number, o: THREE.Vector3, d: THREE.Vector3): number {
  const [h00, h10, h11, h01] = world.tileCorners(tx, ty);
  const L = LEVEL_H;
  const x0 = tx;
  const x1 = tx + 1;
  const z0 = ty;
  const z1 = ty + 1;
  let best = -1;
  const test = (t: number) => {
    if (t >= 0 && (best < 0 || t < best)) best = t;
  };
  if (world.splitsMain(tx, ty)) {
    test(rayTri(o.x, o.y, o.z, d.x, d.y, d.z, x0, h00 * L, z0, x1, h11 * L, z1, x1, h10 * L, z0));
    test(rayTri(o.x, o.y, o.z, d.x, d.y, d.z, x0, h00 * L, z0, x0, h01 * L, z1, x1, h11 * L, z1));
  } else {
    test(rayTri(o.x, o.y, o.z, d.x, d.y, d.z, x0, h00 * L, z0, x0, h01 * L, z1, x1, h10 * L, z0));
    test(rayTri(o.x, o.y, o.z, d.x, d.y, d.z, x1, h10 * L, z0, x0, h01 * L, z1, x1, h11 * L, z1));
  }
  return best;
}

/** Ray/heightfield intersection using a 2D DDA over tiles. */
export function pickTerrain(world: World, camera: THREE.Camera, sx: number, sy: number, width: number, height: number): PickResult | null {
  ndc.set((sx / width) * 2 - 1, -(sy / height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin;
  const d = ray.ray.direction;
  // clip against the map box
  const maxY = 64 * LEVEL_H;
  let t0 = 0;
  let t1 = 1e9;
  const slab = (orig: number, dir: number, lo: number, hi: number) => {
    if (Math.abs(dir) < 1e-12) return orig >= lo && orig <= hi;
    let a = (lo - orig) / dir;
    let b = (hi - orig) / dir;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  if (!slab(o.x, d.x, 0, world.w) || !slab(o.z, d.z, 0, world.h) || !slab(o.y, d.y, -1, maxY)) return planeFallback(world, o, d);
  const sxp = o.x + d.x * t0;
  const szp = o.z + d.z * t0;
  let tx = Math.min(world.w - 1, Math.max(0, Math.floor(sxp)));
  let ty = Math.min(world.h - 1, Math.max(0, Math.floor(szp)));
  const stepX = d.x > 0 ? 1 : -1;
  const stepZ = d.z > 0 ? 1 : -1;
  const tDeltaX = Math.abs(d.x) > 1e-12 ? Math.abs(1 / d.x) : Infinity;
  const tDeltaZ = Math.abs(d.z) > 1e-12 ? Math.abs(1 / d.z) : Infinity;
  let tMaxX = Math.abs(d.x) > 1e-12 ? t0 + (d.x > 0 ? tx + 1 - sxp : sxp - tx) * tDeltaX : Infinity;
  let tMaxZ = Math.abs(d.z) > 1e-12 ? t0 + (d.z > 0 ? ty + 1 - szp : szp - ty) * tDeltaZ : Infinity;
  for (let iter = 0; iter < (world.w + world.h) * 2 + 4; iter++) {
    const t = tileHit(world, tx, ty, o, d);
    if (t >= 0) {
      return { tx, ty, x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
    }
    if (tMaxX < tMaxZ) {
      tx += stepX;
      tMaxX += tDeltaX;
    } else {
      ty += stepZ;
      tMaxZ += tDeltaZ;
    }
    if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) break;
    if (Math.min(tMaxX, tMaxZ) > t1 + 2) break;
  }
  return planeFallback(world, o, d);
}

function planeFallback(world: World, o: THREE.Vector3, d: THREE.Vector3): PickResult | null {
  const y = world.seaLevel * LEVEL_H;
  if (Math.abs(d.y) < 1e-9) return null;
  const t = (y - o.y) / d.y;
  if (t < 0) return null;
  const x = o.x + d.x * t;
  const z = o.z + d.z * t;
  if (x < 0 || z < 0 || x >= world.w || z >= world.h) return null;
  return { tx: Math.floor(x), ty: Math.floor(z), x, y, z };
}
