import { NET } from '../sim/types';
import { CHUNK, DIR_E, DIR_N, DIR_S, DIR_W, LEVEL_H, type World } from '../sim/world';
import { GroundBuf } from './buffers';
import { mixHex, shade } from './geom';
import { PAL } from './palette';
import { hashf } from '../util/rng';

/** Height offsets above the terrain for road layers (world units). */
const ROAD_Y = 0.016;
const MARK_Y = 0.024;
const WALK_Y = 0.03;
const RAIL_BED_Y = 0.02;
const TIE_Y = 0.028;
const RAIL_Y = 0.05;
/** Lane offset from the road centre line. */
export const LANE = 0.16;

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

function terrainColor(world: World, x: number, y: number, avg: number, slope: number, beach: boolean, forest: number): number {
  const sea = world.seaLevel;
  const rel = avg - sea;
  const n = hashf(x, y, 17);
  let c: number;
  if (rel < 0) {
    const depth = Math.min(1, -rel / 4);
    c = mixHex(PAL.sandWet, 0x5f6f5a, depth);
  } else if (beach) {
    c = PAL.sand;
  } else if (rel > 18) {
    c = PAL.snow;
  } else if (rel > 13) {
    c = mixHex(PAL.rock, PAL.rockDark, n * 0.5);
  } else {
    const t = Math.min(1, rel / 12);
    c = t < 0.5 ? mixHex(PAL.grassLight, PAL.grass, t * 2) : mixHex(PAL.grass, PAL.grassDark, (t - 0.5) * 2);
    if (rel > 9) c = mixHex(c, PAL.rock, (rel - 9) / 5);
  }
  if (slope >= 2 && rel >= 0) c = mixHex(c, PAL.rock, 0.35);
  if (forest > 0 && rel >= 0 && !beach) c = mixHex(c, PAL.forest, 0.25 + forest * 0.1);
  return shade(c, 0.95 + n * 0.1);
}

function isBeach(world: World, x: number, y: number): boolean {
  if (world.isWater(x, y)) return false;
  if (world.tileMax(x, y) > world.seaLevel + 1) return false;
  for (let k = 0; k < 4; k++) {
    const nx = x + [0, 1, 0, -1][k];
    const ny = y + [-1, 0, 1, 0][k];
    if (world.inBounds(nx, ny) && world.isWater(nx, ny)) return true;
  }
  return false;
}

/** Build terrain + roads + rails for one chunk. */
export function buildGround(world: World, cx: number, cy: number): GroundBuf {
  const buf = new GroundBuf();
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const x1 = Math.min(world.w, x0 + CHUNK);
  const y1 = Math.min(world.h, y0 + CHUNK);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      terrainTile(world, buf, x, y);
      const n = world.net[world.idx(x, y)];
      if (n & NET.ROAD) roadTile(world, buf, x, y);
      if (n & NET.RAIL) railTile(world, buf, x, y);
    }
  }
  return buf;
}

function terrainTile(world: World, buf: GroundBuf, x: number, y: number): void {
  const [h00, h10, h11, h01] = world.tileCorners(x, y);
  const L = LEVEL_H;
  const p00 = [x, h00 * L, y];
  const p10 = [x + 1, h10 * L, y];
  const p11 = [x + 1, h11 * L, y + 1];
  const p01 = [x, h01 * L, y + 1];
  const beach = isBeach(world, x, y);
  const forest = world.tree[world.idx(x, y)];
  const slope = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
  const tri = (a: number[], b: number[], c: number[], ha: number, hb: number, hc: number, k: number) => {
    const avg = (ha + hb + hc) / 3;
    const col = terrainColor(world, x * 2 + k, y, avg, slope, beach, forest);
    buf.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col);
  };
  if (world.splitsMain(x, y)) {
    tri(p00, p11, p10, h00, h11, h10, 0);
    tri(p00, p01, p11, h00, h01, h11, 1);
  } else {
    tri(p00, p01, p10, h00, h01, h10, 0);
    tri(p10, p01, p11, h10, h01, h11, 1);
  }
}

/** Flat rectangle draped on the terrain (or at a fixed height). */
function drape(
  world: World,
  buf: GroundBuf,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  off: number,
  hex: number,
  fixedY?: number,
): void {
  const y = (px: number, pz: number) => (fixedY !== undefined ? fixedY + off : world.surfaceY(px, pz) + off);
  buf.quad([ax, y(ax, az), az], [ax, y(ax, bz), bz], [bx, y(bx, bz), bz], [bx, y(bx, az), az], hex);
}

/** Road surface split exactly like the terrain tile (so it never intersects it). */
function tileSurface(world: World, buf: GroundBuf, x: number, y: number, off: number, hex: number): void {
  const [h00, h10, h11, h01] = world.tileCorners(x, y);
  const L = LEVEL_H;
  const p00 = [x, h00 * L + off, y];
  const p10 = [x + 1, h10 * L + off, y];
  const p11 = [x + 1, h11 * L + off, y + 1];
  const p01 = [x, h01 * L + off, y + 1];
  if (world.splitsMain(x, y)) {
    buf.tri(p00[0], p00[1], p00[2], p11[0], p11[1], p11[2], p10[0], p10[1], p10[2], hex);
    buf.tri(p00[0], p00[1], p00[2], p01[0], p01[1], p01[2], p11[0], p11[1], p11[2], hex);
  } else {
    buf.tri(p00[0], p00[1], p00[2], p01[0], p01[1], p01[2], p10[0], p10[1], p10[2], hex);
    buf.tri(p10[0], p10[1], p10[2], p01[0], p01[1], p01[2], p11[0], p11[1], p11[2], hex);
  }
}

/** Solid box (deck, pillar, railing) in world space. */
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
  const side = hex;
  const t = top ?? hex;
  buf.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], t);
  buf.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], shade(side, 0.92));
  buf.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], shade(side, 0.92));
  buf.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], shade(side, 0.85));
  buf.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], shade(side, 0.85));
}

function bridgeDeck(world: World, buf: GroundBuf, x: number, y: number, mask: number, hex: number): number {
  const dy = deckY(world);
  const ns = (mask & (DIR_N | DIR_S)) !== 0;
  // deck slab
  groundBox(buf, x, dy - 0.07, y, x + 1, dy, y + 1, 0x8d8a85, hex);
  // railings on the open sides
  const rail = 0xd8d4cc;
  if (ns) {
    groundBox(buf, x, dy, y, x + 0.05, dy + 0.06, y + 1, rail);
    groundBox(buf, x + 0.95, dy, y, x + 1, dy + 0.06, y + 1, rail);
  } else {
    groundBox(buf, x, dy, y, x + 1, dy + 0.06, y + 0.05, rail);
    groundBox(buf, x, dy, y + 0.95, x + 1, dy + 0.06, y + 1, rail);
  }
  // pillar down to the water bed every other tile
  if ((x + y) % 2 === 0) {
    const bed = world.tileMin(x, y) * LEVEL_H;
    groundBox(buf, x + 0.4, bed, y + 0.4, x + 0.6, dy - 0.07, y + 0.6, 0x9a968e);
  }
  return dy;
}

function roadTile(world: World, buf: GroundBuf, x: number, y: number): void {
  const mask = world.netMask(x, y, NET.ROAD);
  const water = world.isWater(x, y);
  const n = (mask & DIR_N) !== 0;
  const e = (mask & DIR_E) !== 0;
  const s = (mask & DIR_S) !== 0;
  const wv = (mask & DIR_W) !== 0;
  const count = +n + +e + +s + +wv;
  let fixed: number | undefined;
  if (water) {
    fixed = bridgeDeck(world, buf, x, y, mask, PAL.asphalt);
  } else {
    tileSurface(world, buf, x, y, ROAD_Y, PAL.asphalt);
  }
  const markY = fixed !== undefined ? 0.006 : MARK_Y;
  const walkY = fixed !== undefined ? 0.01 : WALK_Y;
  const W = 0.1; // sidewalk width
  if (fixed === undefined) {
    if (!n) drape(world, buf, x, y, x + 1, y + W, walkY, PAL.sidewalk);
    if (!s) drape(world, buf, x, y + 1 - W, x + 1, y + 1, walkY, PAL.sidewalk);
    if (!wv) drape(world, buf, x, y + (n ? 0 : W), x + W, y + 1 - (s ? 0 : W), walkY, PAL.sidewalk);
    if (!e) drape(world, buf, x + 1 - W, y + (n ? 0 : W), x + 1, y + 1 - (s ? 0 : W), walkY, PAL.sidewalk);
    // corner pieces for intersections / bends
    if (n && wv) drape(world, buf, x, y, x + W, y + W, walkY, PAL.sidewalk);
    if (n && e) drape(world, buf, x + 1 - W, y, x + 1, y + W, walkY, PAL.sidewalk);
    if (s && wv) drape(world, buf, x, y + 1 - W, x + W, y + 1, walkY, PAL.sidewalk);
    if (s && e) drape(world, buf, x + 1 - W, y + 1 - W, x + 1, y + 1, walkY, PAL.sidewalk);
  }
  // markings
  const straightNS = n && s && !e && !wv;
  const straightEW = e && wv && !n && !s;
  const dash = 0.03;
  if (straightNS || (count === 1 && (n || s))) {
    for (const z of [0.1, 0.6]) drape(world, buf, x + 0.5 - dash / 2, y + z, x + 0.5 + dash / 2, y + z + 0.3, markY, PAL.laneYellow, fixed);
  } else if (straightEW || (count === 1 && (e || wv))) {
    for (const xx of [0.1, 0.6])
      drape(world, buf, x + xx, y + 0.5 - dash / 2, x + xx + 0.3, y + 0.5 + dash / 2, markY, PAL.laneYellow, fixed);
  } else if (count >= 3) {
    // stop bars on the incoming lanes
    const bar = 0.035;
    if (n) drape(world, buf, x + 0.12, y + 0.12, x + 0.5, y + 0.12 + bar, markY, PAL.laneWhite, fixed);
    if (s) drape(world, buf, x + 0.5, y + 0.88 - bar, x + 0.88, y + 0.88, markY, PAL.laneWhite, fixed);
    if (wv) drape(world, buf, x + 0.12, y + 0.5, x + 0.12 + bar, y + 0.88, markY, PAL.laneWhite, fixed);
    if (e) drape(world, buf, x + 0.88 - bar, y + 0.12, x + 0.88, y + 0.5, markY, PAL.laneWhite, fixed);
  } else if (count === 2) {
    // bend: dashed centre arc approximated by two short dashes toward each connection
    const arms: [number, number][] = [];
    if (n) arms.push([0, -1]);
    if (s) arms.push([0, 1]);
    if (e) arms.push([1, 0]);
    if (wv) arms.push([-1, 0]);
    for (const [dx, dz] of arms) {
      const cx = x + 0.5 + dx * 0.32;
      const cz = y + 0.5 + dz * 0.32;
      const hx = dx ? 0.12 : dash / 2;
      const hz = dz ? 0.12 : dash / 2;
      drape(world, buf, cx - hx, cz - hz, cx + hx, cz + hz, markY, PAL.laneYellow, fixed);
    }
  }
}

function railTile(world: World, buf: GroundBuf, x: number, y: number): void {
  const mask = world.netMask(x, y, NET.RAIL);
  const water = world.isWater(x, y);
  let fixed: number | undefined;
  if (water) fixed = bridgeDeck(world, buf, x, y, mask, PAL.gravel);
  const road = (world.net[world.idx(x, y)] & NET.ROAD) !== 0;
  const arms: [number, number][] = [];
  if (mask & DIR_N) arms.push([0, -1]);
  if (mask & DIR_S) arms.push([0, 1]);
  if (mask & DIR_E) arms.push([1, 0]);
  if (mask & DIR_W) arms.push([-1, 0]);
  if (arms.length === 0) arms.push([1, 0], [-1, 0]);
  if (arms.length === 1) arms.push([-arms[0][0], -arms[0][1]]);
  const straight = arms.length === 2 && arms[0][0] === -arms[1][0] && arms[0][1] === -arms[1][1];
  const bedY = fixed !== undefined ? 0.004 : road ? ROAD_Y + 0.004 : RAIL_BED_Y;
  const tieY = fixed !== undefined ? 0.01 : road ? ROAD_Y + 0.008 : TIE_Y;
  const railY = fixed !== undefined ? 0.03 : road ? ROAD_Y + 0.02 : RAIL_Y;
  const half = 0.2;
  // bed: centre square + arms
  if (!road) drape(world, buf, x + 0.5 - half, y + 0.5 - half, x + 0.5 + half, y + 0.5 + half, bedY, PAL.gravel, fixed);
  for (const [dx, dz] of arms) {
    const ax = dx === 0 ? x + 0.5 - half : dx > 0 ? x + 0.5 : x;
    const bx = dx === 0 ? x + 0.5 + half : dx > 0 ? x + 1 : x + 0.5;
    const az = dz === 0 ? y + 0.5 - half : dz > 0 ? y + 0.5 : y;
    const bz = dz === 0 ? y + 0.5 + half : dz > 0 ? y + 1 : y + 0.5;
    if (!road) drape(world, buf, ax, az, bx, bz, bedY, PAL.gravel, fixed);
    // ties
    for (const t of [0.12, 0.37]) {
      const px = x + 0.5 + dx * t;
      const pz = y + 0.5 + dz * t;
      const hx = dx ? 0.03 : 0.17;
      const hz = dz ? 0.03 : 0.17;
      drape(world, buf, px - hx, pz - hz, px + hx, pz + hz, tieY, PAL.railTie, fixed);
    }
    // rails (two thin strips per arm, extended across the centre for straight pieces)
    for (const side of [-0.09, 0.09]) {
      const len0 = straight ? 0 : -0.09;
      const sx = dx === 0 ? x + 0.5 + side : x + 0.5 + dx * len0;
      const sz = dz === 0 ? y + 0.5 + side : y + 0.5 + dz * len0;
      const ex = dx === 0 ? sx : x + 0.5 + dx * 0.5;
      const ez = dz === 0 ? sz : y + 0.5 + dz * 0.5;
      const t = 0.012;
      drape(
        world,
        buf,
        Math.min(sx, ex) - (dx === 0 ? t : 0),
        Math.min(sz, ez) - (dz === 0 ? t : 0),
        Math.max(sx, ex) + (dx === 0 ? t : 0),
        Math.max(sz, ez) + (dz === 0 ? t : 0),
        railY,
        PAL.steel,
        fixed,
      );
    }
  }
}

/** Map edge "diorama" walls: soil strata under the terrain border. */
export function buildSkirt(world: World): GroundBuf {
  const buf = new GroundBuf();
  const L = LEVEL_H;
  const base = -1.6;
  const strata = PAL.soil;
  const bands = [0, 0.35, 0.8, 1.3];
  const edge = (ax: number, az: number, ha: number, bx: number, bz: number, hb: number, outward: [number, number]) => {
    // vertical quad from terrain edge down to base, split in strata bands
    const topA = ha * L;
    const topB = hb * L;
    for (let k = 0; k < strata.length; k++) {
      const yA0 = k === 0 ? topA : Math.min(topA, Math.max(base, topA - bands[k] - 0.15));
      const yB0 = k === 0 ? topB : Math.min(topB, Math.max(base, topB - bands[k] - 0.15));
      const yA1 = k === strata.length - 1 ? base : Math.max(base, topA - bands[k + 1] - 0.15);
      const yB1 = k === strata.length - 1 ? base : Math.max(base, topB - bands[k + 1] - 0.15);
      if (yA0 <= yA1 && yB0 <= yB1) continue;
      const a0 = [ax, yA0, az];
      const b0 = [bx, yB0, bz];
      const b1 = [bx, yB1, bz];
      const a1 = [ax, yA1, az];
      // choose winding so the face points outward
      const ux = bx - ax;
      const uz = bz - az;
      // normal of quad (a1,b1,b0,a0) = cross(b1-a1, b0-a1) ~ (uz, 0, -ux)*sign
      const nx = -uz;
      const nz = ux;
      if (nx * outward[0] + nz * outward[1] > 0) buf.quad(a1, b1, b0, a0, strata[k]);
      else buf.quad(b1, a1, a0, b0, strata[k]);
    }
  };
  for (let x = 0; x < world.w; x++) {
    edge(x, 0, world.corner(x, 0), x + 1, 0, world.corner(x + 1, 0), [0, -1]);
    edge(x, world.h, world.corner(x, world.h), x + 1, world.h, world.corner(x + 1, world.h), [0, 1]);
  }
  for (let y = 0; y < world.h; y++) {
    edge(0, y, world.corner(0, y), 0, y + 1, world.corner(0, y + 1), [-1, 0]);
    edge(world.w, y, world.corner(world.w, y), world.w, y + 1, world.corner(world.w, y + 1), [1, 0]);
  }
  // bottom plate
  buf.quad([0, base, 0], [world.w, base, 0], [world.w, base, world.h], [0, base, world.h], strata[3]);
  return buf;
}
