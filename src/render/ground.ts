import { CHUNK, LEVEL_H, type World } from '../sim/world';
import { GroundBuf } from './buffers';
import { buildTracks } from './tracks';
import { mixHex, shade } from './geom';
import { PAL } from './palette';
import { hashf } from '../util/rng';

export { deckY, roadSurfaceY, waterY } from './tracks';

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

// Reused by every chunk build: turn a result into geometry before the next build.
const GROUND = new GroundBuf();

/** Build terrain + roads + rails for one chunk. The buffer is reused by the next call. */
export function buildGround(world: World, cx: number, cy: number): GroundBuf {
  const buf = GROUND;
  buf.reset();
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const x1 = Math.min(world.w, x0 + CHUNK);
  const y1 = Math.min(world.h, y0 + CHUNK);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) terrainTile(world, buf, x, y);
  buildTracks(world, buf, x0, y0, x1, y1);
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
