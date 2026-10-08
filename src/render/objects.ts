import { NET, type Building } from '../sim/types';
import { getDef } from '../sim/catalog';
import { CHUNK, DIR_E, DIR_N, DIR_S, DIR_W, LEVEL_H, type World } from '../sim/world';
import { landfillLevel } from '../sim/garbage';
import { hashf } from '../util/rng';
import { ObjectBuf, placePoint, rotPlacement, yawPlacement } from './buffers';
import { getModel, modelForDef } from './models';
import { mixHex } from './geom';
import { PAL } from './palette';

export interface EmitterInst {
  x: number;
  y: number;
  z: number;
  kind: 'smoke' | 'steam' | 'dark' | 'fire';
  /** Size multiplier. */
  s: number;
}

export interface RotorInst {
  x: number;
  y: number;
  z: number;
  r: number;
  yaw: number;
}

export interface IconInst {
  x: number;
  y: number;
  z: number;
  icon: number;
}

export interface ObjectChunk {
  buf: ObjectBuf;
  /** Trees and other vegetation (shadows switched off when zoomed far out). */
  trees: ObjectBuf;
  emitters: EmitterInst[];
  rotors: RotorInst[];
  /** Highest point (for icons). */
  tops: Map<number, number>;
}

const ROT_YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
const FOUNDATION = 0xa39d92;

/** Lot ground colour for foundations. */
export function lotColor(b: Building): number | undefined {
  const def = getDef(b.def);
  if (def.ground !== undefined) return def.ground;
  if (def.growable) {
    if (def.zone === 1) return 0x8fbf5a;
    if (def.zone === 2) return 0xc2beb4;
    return 0xb0a898;
  }
  return undefined;
}

function addBuilding(world: World, out: ObjectChunk, b: Building): void {
  const def = getDef(b.def);
  const buf = out.buf;
  const maxL = world.footprintMax(b.x, b.y, b.w, b.h);
  const minL = world.footprintMin(b.x, b.y, b.w, b.h);
  const baseY = maxL * LEVEL_H + 0.004;
  if (minL < maxL) {
    const top = lotColor(b) ?? 0xb8b2a6;
    const x0 = b.x + 0.01;
    const z0 = b.y + 0.01;
    const x1 = b.x + b.w - 0.01;
    const z1 = b.y + b.h - 0.01;
    const y0 = minL * LEVEL_H - 0.05;
    const y1 = baseY - 0.002;
    buf.tri([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], top);
    buf.tri([x0, y1, z0], [x1, y1, z1], [x1, y1, z0], top);
    buf.tri([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], FOUNDATION);
    buf.tri([x0, y0, z1], [x1, y1, z1], [x0, y1, z1], FOUNDATION);
    buf.tri([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], FOUNDATION);
    buf.tri([x1, y0, z0], [x0, y1, z0], [x1, y1, z0], FOUNDATION);
    buf.tri([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], 0x958f84);
    buf.tri([x1, y0, z1], [x1, y1, z0], [x1, y1, z1], 0x958f84);
    buf.tri([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], 0x958f84);
    buf.tri([x0, y0, z0], [x0, y1, z1], [x0, y1, z0], 0x958f84);
  }
  const constructing = b.build > 0;
  const mesh = constructing
    ? getModel({ model: 'construction', w: def.w, h: def.h, variant: b.seed & 7 })
    : modelForDef(def, b.variant);
  const pl = rotPlacement(b.rot, def.w, def.h, b.x, baseY, b.y);
  const burning = b.fire > 0;
  buf.addModel(mesh, pl, {
    seed: b.seed,
    colorMul: b.abandoned ? 0.62 : burning ? 0.72 : 1,
    desat: b.abandoned ? 0.55 : burning ? 0.3 : 0,
    dark: b.abandoned || (!b.powered && !def.power) || constructing,
  });
  const key = b.id;
  out.tops.set(key, baseY + mesh.height);
  if (constructing) return;
  const active = !b.abandoned && (!def.growable || b.pop > 0) && (def.power ? true : b.powered || !def.powerUse);
  if (active) {
    for (const e of mesh.emitters) {
      const p = placePoint(pl, e.x, e.y, e.z);
      out.emitters.push({ x: p[0], y: p[1], z: p[2], kind: e.kind, s: def.w >= 3 ? 1.3 : 1 });
    }
  }
  for (const r of mesh.rotors) {
    const p = placePoint(pl, r.x, r.y, r.z);
    out.rotors.push({ x: p[0], y: p[1], z: p[2], r: r.r, yaw: r.yaw + ROT_YAW[b.rot & 3] });
  }
  if (burning) {
    const top = baseY + Math.min(mesh.height, 2.2) * 0.85;
    const n = Math.min(6, b.w * b.h + 1);
    for (let k = 0; k < n; k++) {
      out.emitters.push({
        x: b.x + 0.2 + hashf(b.id, k, 1) * (b.w - 0.4),
        y: top * (0.6 + hashf(b.id, k, 2) * 0.4),
        z: b.y + 0.2 + hashf(b.id, k, 3) * (b.h - 0.4),
        kind: 'fire',
        s: 1,
      });
    }
  }
}


function addTrees(world: World, out: ObjectChunk, x: number, y: number, density: number): void {
  const n = density === 1 ? 1 : density === 2 ? 2 : 3;
  const elev = world.tileMax(x, y) - world.seaLevel;
  for (let k = 0; k < n; k++) {
    const h1 = hashf(x, y, k * 7 + 1);
    const h2 = hashf(x, y, k * 7 + 2);
    const h3 = hashf(x, y, k * 7 + 3);
    const h4 = hashf(x, y, k * 7 + 4);
    const px = x + 0.16 + h1 * 0.68;
    const pz = y + 0.16 + h2 * 0.68;
    const coniferBias = Math.min(0.85, 0.2 + Math.max(0, elev - 4) * 0.08);
    const kind = h3 < coniferBias ? 'tree_cone' : h3 < coniferBias + 0.15 ? 'tree_tall' : 'tree_round';
    const mesh = getModel({ model: kind, w: 1, h: 1, variant: Math.floor(h4 * 8) });
    const s = (0.7 + h4 * 0.55) * (density === 3 ? 1.08 : 1);
    out.trees.addModel(mesh, yawPlacement(h1 * Math.PI * 2, s, px, world.surfaceY(px, pz) - 0.01, pz), { seed: 0 });
  }
}

function polePosition(world: World, x: number, y: number): [number, number, number] {
  const i = world.idx(x, y);
  const n = world.net[i];
  let px = x + 0.5;
  let pz = y + 0.5;
  if (n & (NET.ROAD | NET.RAIL)) {
    const flag = n & NET.ROAD ? NET.ROAD : NET.RAIL;
    const m = world.netMask(x, y, flag);
    const ns = (m & (DIR_N | DIR_S)) !== 0;
    const ew = (m & (DIR_E | DIR_W)) !== 0;
    if (ns && !ew) px = x + 0.9;
    else if (ew && !ns) pz = y + 0.9;
    else {
      px = x + 0.9;
      pz = y + 0.9;
    }
  }
  return [px, world.surfaceY(px, pz), pz];
}

const POLE_TOP = 0.5;
const WIRE = 0x2f3236;

function addPowerLine(world: World, out: ObjectChunk, x: number, y: number): void {
  const mask = world.netMask(x, y, NET.POWER);
  const ew = (mask & (DIR_E | DIR_W)) !== 0 && (mask & (DIR_N | DIR_S)) === 0;
  const [px, py, pz] = polePosition(world, x, y);
  const pole = getModel({ model: 'power_pole', w: 1, h: 1, variant: 0 });
  out.buf.addModel(pole, rotPlacement(ew ? 1 : 0, 1, 1, px - 0.5, py, pz - 0.5), { seed: 0 });
  // wires to east and south neighbours
  for (const [dx, dy, bit] of [
    [1, 0, DIR_E],
    [0, 1, DIR_S],
  ] as const) {
    if (!(mask & bit)) continue;
    const [qx, qy, qz] = polePosition(world, x + dx, y + dy);
    for (const side of [-0.1, 0.1]) {
      const ox = dy ? side : 0;
      const oz = dx ? side : 0;
      const a = [px + ox, py + POLE_TOP, pz + oz];
      const b = [qx + ox, qy + POLE_TOP, qz + oz];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.06, (a[2] + b[2]) / 2];
      out.buf.beam(a, m, 0.012, WIRE);
      out.buf.beam(m, b, 0.012, WIRE);
    }
  }
}

/** Build buildings, trees, props and power lines for one chunk. */
export function buildObjects(world: World, cx: number, cy: number): ObjectChunk {
  const out: ObjectChunk = { buf: new ObjectBuf(), trees: new ObjectBuf(), emitters: [], rotors: [], tops: new Map() };
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const x1 = Math.min(world.w, x0 + CHUNK);
  const y1 = Math.min(world.h, y0 + CHUNK);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = world.idx(x, y);
      const id = world.bld[i];
      if (id) {
        const b = world.buildings.get(id);
        if (b && b.x === x && b.y === y) addBuilding(world, out, b);
        continue;
      }
      const n = world.net[i];
      if (n & NET.POWER) addPowerLine(world, out, x, y);
      if (n & (NET.ROAD | NET.RAIL)) continue;
      if (world.isWater(x, y)) continue;
      if (world.rubble[i]) {
        const mesh = getModel({ model: 'rubble', w: 1, h: 1, variant: (x * 7 + y * 3) & 7 });
        out.buf.addModel(mesh, rotPlacement((x + y) & 3, 1, 1, x, world.tileMax(x, y) * LEVEL_H, y), { seed: 0 });
        continue;
      }
      if (world.zone[i] === 4) {
        const level = landfillLevel(world.landfill[i]);
        const mesh = getModel({ model: 'landfill', w: 1, h: 1, variant: level });
        out.buf.addModel(mesh, rotPlacement((x * 3 + y) & 3, 1, 1, x, world.tileMax(x, y) * LEVEL_H, y), { seed: 0 });
        continue;
      }
      const t = world.tree[i];
      if (t && !(n & NET.POWER)) addTrees(world, out, x, y, t);
    }
  }
  return out;
}

/** Underground pipes for one chunk (shown in the underground view). */
export function buildPipes(world: World, cx: number, cy: number): ObjectBuf {
  const buf = new ObjectBuf();
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const x1 = Math.min(world.w, x0 + CHUNK);
  const y1 = Math.min(world.h, y0 + CHUNK);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = world.idx(x, y);
      if (!(world.net[i] & NET.PIPE)) continue;
      const watered = world.watered[i] === 1;
      const col = watered ? 0x3fa9f5 : 0x8a96a3;
      const cy0 = world.surfaceY(x + 0.5, y + 0.5) + 0.06;
      const mask = world.netMask(x, y, NET.PIPE);
      const c = [x + 0.5, cy0, y + 0.5];
      let arms = 0;
      for (const [dx, dz, bit] of [
        [0, -1, DIR_N],
        [1, 0, DIR_E],
        [0, 1, DIR_S],
        [-1, 0, DIR_W],
      ] as const) {
        if (!(mask & bit)) continue;
        arms++;
        const ex = x + 0.5 + dx * 0.5;
        const ez = y + 0.5 + dz * 0.5;
        buf.beam(c, [ex, world.surfaceY(ex, ez) + 0.06, ez], 0.09, col);
      }
      if (arms !== 2) buf.beam([c[0], c[1] - 0.06, c[2]], [c[0], c[1] + 0.07, c[2]], 0.14, mixHex(col, PAL.white, 0.25));
    }
  }
  return buf;
}
