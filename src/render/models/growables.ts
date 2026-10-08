import { FLOOR, WIN, mixHex, shade, type Emitter, type GeometryBuilder } from '../geom';
import { PAL } from '../palette';
import type { ModelCtx, ModelFn } from './types';

type G = GeometryBuilder;
const F = FLOOR;

const GLASS_WALLS = [PAL.glassBlue, PAL.glassTeal, PAL.glassDark, PAL.glassGreen];
const GLASS_ROOF = 0x8e959c;
const POOL = 0x4fc3e8;
const DECK = 0xe8e0d0;
const ROOF_GREEN = 0x8fbf5a;
const DOOR = 0x3b2f28;
const FENCE = 0x8a8f94;

// =================================================================== helpers

/** Perceived brightness 0..255 of an sRGB hex colour. */
function lum(hex: number): number {
  return ((hex >> 16) & 255) * 0.3 + ((hex >> 8) & 255) * 0.59 + (hex & 255) * 0.11;
}

/** Small round tree used as lot decoration. */
function lotTree(g: G, c: ModelCtx, x: number, z: number, s = 1): void {
  g.noWin().color(PAL.trunk);
  g.box(x - 0.014 * s, 0, z - 0.014 * s, x + 0.014 * s, 0.08 * s, z + 0.014 * s, { noTop: true });
  g.color(c.rng.pick(PAL.leaf));
  g.sphere(x, 0.14 * s, z, 0.075 * s, 0, 1.15);
}

/** Conifer used as lot decoration. */
function pine(g: G, c: ModelCtx, x: number, z: number, s = 1): void {
  g.noWin().color(PAL.trunk);
  g.box(x - 0.012 * s, 0, z - 0.012 * s, x + 0.012 * s, 0.05 * s, z + 0.012 * s, { noTop: true });
  g.color(c.rng.pick(PAL.conifer));
  g.cone(x, z, 0.075 * s, 0.04 * s, 0.24 * s, 6);
  g.cone(x, z, 0.055 * s, 0.14 * s, 0.33 * s, 6);
}

/** Tree standing on a raised surface (roof garden, podium). */
function roofTree(g: G, c: ModelCtx, x: number, z: number, y: number, s = 0.65): void {
  g.push().translate(0, y, 0);
  lotTree(g, c, x, z, s);
  g.pop();
}

/** Vertical quad on a +z facing facade (doors, garage doors, signs). */
function frontQuad(g: G, x0: number, x1: number, y0: number, y1: number, z: number, hex: number): void {
  g.noWin().color(hex);
  g.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]);
}

/** Darker inset on a flat roof that reads as a parapet. */
function roofRim(g: G, x0: number, z0: number, x1: number, z1: number, y: number, roof: number): void {
  const i = Math.min(0.035, (x1 - x0) * 0.12, (z1 - z0) * 0.12);
  g.rect(x0 + i, z0 + i, x1 - i, z1 - i, y + 0.003, shade(roof, 0.84));
}

/** Windowed box with a flat roof (+ parapet inset). */
function block(
  g: G,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  y1: number,
  wall: number,
  roof: number,
  style: number,
  cellW = 0.14,
  cellH = F,
): void {
  g.color(wall).win(style, cellW, cellH);
  g.box(x0, y0, z0, x1, y1, z1, { top: roof });
  g.noWin();
  roofRim(g, x0, z0, x1, z1, y1, roof);
}

function acUnit(g: G, x: number, z: number, y: number, s = 1): void {
  g.noWin().color(0xc4c8cc);
  g.box(x - 0.04 * s, y, z - 0.03 * s, x + 0.04 * s, y + 0.035 * s, z + 0.03 * s, { top: 0xa4a8ac });
}

function roofUnits(g: G, c: ModelCtx, x0: number, z0: number, x1: number, z1: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.08 + c.rng.next() * Math.max(0, x1 - x0 - 0.16);
    const z = z0 + 0.08 + c.rng.next() * Math.max(0, z1 - z0 - 0.16);
    acUnit(g, x, z, y, 0.8 + c.rng.next() * 0.6);
  }
}

/** Classic wooden rooftop water tank. */
function waterTank(g: G, x: number, z: number, y: number, s = 1): void {
  g.noWin().color(0x5c4a3a);
  g.box(x - 0.04 * s, y, z - 0.04 * s, x + 0.04 * s, y + 0.05 * s, z + 0.04 * s, { noTop: true });
  g.color(0x8a6a4a);
  g.lathe(
    x,
    z,
    [
      [0.05 * s, y + 0.05 * s],
      [0.05 * s, y + 0.13 * s],
      [0, y + 0.17 * s],
    ],
    6,
  );
}

function car(g: G, x: number, z: number, alongX: boolean, hex: number): void {
  g.noWin();
  const hl = 0.055;
  const hw = 0.028;
  const ax = alongX ? hl : hw;
  const az = alongX ? hw : hl;
  g.color(hex).box(x - ax, 0.012, z - az, x + ax, 0.038, z + az);
  const cx = alongX ? hl * 0.55 : hw * 0.85;
  const cz = alongX ? hw * 0.85 : hl * 0.55;
  g.color(0x34404c).box(x - cx, 0.038, z - cz, x + cx, 0.062, z + cz, { top: hex });
}

/** Truck with trailer; the cab points toward +x (alongX) or +z. */
function truck(g: G, x: number, z: number, alongX: boolean, cab: number, trailer = 0xe8e8e4): void {
  g.noWin();
  if (alongX) {
    g.color(trailer).box(x - 0.14, 0.02, z - 0.038, x + 0.06, 0.11, z + 0.038);
    g.color(cab).box(x + 0.065, 0.012, z - 0.036, x + 0.13, 0.085, z + 0.036);
  } else {
    g.color(trailer).box(x - 0.038, 0.02, z - 0.14, x + 0.038, 0.11, z + 0.06);
    g.color(cab).box(x - 0.036, 0.012, z + 0.065, x + 0.036, 0.085, z + 0.13);
  }
}

/** Asphalt lot with painted stalls and parked cars. */
function parking(g: G, c: ModelCtx, x0: number, z0: number, x1: number, z1: number, cars: number, lines = true): void {
  g.rect(x0, z0, x1, z1, 0.012, PAL.asphalt);
  const alongX = x1 - x0 >= z1 - z0;
  const len = alongX ? x1 - x0 : z1 - z0;
  const depth = alongX ? z1 - z0 : x1 - x0;
  const stall = 0.1;
  const n = Math.max(1, Math.floor((len - 0.04) / stall));
  const rows = depth > 0.42 ? 2 : 1;
  const sl = Math.min(0.13, depth * 0.4);
  const start = (alongX ? x0 : z0) + (len - n * stall) / 2;
  const slots: [number, number][] = [];
  for (let row = 0; row < rows; row++) {
    const a = row === 0 ? (alongX ? z0 : x0) + 0.02 : (alongX ? z1 : x1) - 0.02 - sl;
    for (let i = 0; i <= n; i++) {
      const u = start + i * stall;
      if (lines) {
        if (alongX) g.rect(u - 0.004, a, u + 0.004, a + sl, 0.015, PAL.laneWhite);
        else g.rect(a, u - 0.004, a + sl, u + 0.004, 0.015, PAL.laneWhite);
      }
      if (i < n) slots.push(alongX ? [u + stall / 2, a + sl / 2] : [a + sl / 2, u + stall / 2]);
    }
  }
  c.rng.shuffle(slots);
  for (let i = 0; i < Math.min(cars, slots.length); i++) car(g, slots[i][0], slots[i][1], !alongX, c.rng.pick(PAL.cars));
}

/** Sloped awning sticking out of a +z facade. */
function awning(g: G, x0: number, x1: number, z: number, y: number, depth: number, hex: number): void {
  g.noWin().color(hex);
  g.face(
    [
      [x0, y, z],
      [x0, y - 0.04, z + depth],
      [x1, y - 0.04, z + depth],
      [x1, y, z],
    ],
    [0, 1, 0.6],
  );
  g.color(shade(hex, 0.8));
  g.face(
    [
      [x0, y - 0.04, z + depth],
      [x1, y - 0.04, z + depth],
      [x1, y - 0.065, z + depth],
      [x0, y - 0.065, z + depth],
    ],
    [0, 0, 1],
  );
}

/** Thin double-sided fence around a rectangle (front side optional). */
function fence(g: G, x0: number, z0: number, x1: number, z1: number, h: number, hex: number, front = true): void {
  g.noWin().color(hex);
  g.panel([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]);
  g.panel([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]);
  g.panel([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]);
  if (front) g.panel([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]);
}

function hedge(g: G, x0: number, z0: number, x1: number, z1: number, h = 0.05): void {
  g.noWin()
    .color(PAL.hedge)
    .box(x0, 0, z0, x1, h, z1, { top: shade(PAL.hedge, 1.15) });
}

/** Tapered chimney with optional red band and smoke emitter. */
function chimney(
  g: G,
  x: number,
  z: number,
  y0: number,
  h: number,
  r: number,
  hex: number,
  emit: Emitter['kind'] | null = 'smoke',
  stripes = false,
): void {
  g.noWin().color(hex);
  g.frustum(x, z, r, r * 0.78, y0, y0 + h, 6);
  if (stripes) {
    const ra = r * (1 - 0.22 * 0.82) + 0.005;
    g.color(PAL.red).frustum(x, z, ra, ra * 0.98, y0 + h * 0.78, y0 + h * 0.88, 6);
  }
  if (emit) g.emitter(x, y0 + h + 0.02, z, emit);
}

/** Cylindrical storage tank with a shallow conical roof. */
function tank(g: G, x: number, z: number, r: number, h: number, hex: number, y0 = 0, segs = 8): void {
  g.noWin().color(hex);
  g.lathe(
    x,
    z,
    [
      [r, y0],
      [r, y0 + h],
      [0, y0 + h + r * 0.28],
    ],
    segs,
  );
}

/** Saw-tooth factory roof; the glazed faces look toward +z. */
function sawtooth(g: G, x0: number, z0: number, x1: number, z1: number, y: number, teeth: number, ht: number, roof: number): void {
  const dz = (z1 - z0) / teeth;
  for (let i = 0; i < teeth; i++) {
    const za = z0 + i * dz;
    const zb = za + dz;
    g.noWin().color(roof);
    g.face(
      [
        [x0, y, za],
        [x1, y, za],
        [x1, y + ht, zb],
        [x0, y + ht, zb],
      ],
      [0, 1, -1],
    );
    g.face(
      [
        [x1, y, za],
        [x1, y, zb],
        [x1, y + ht, zb],
      ],
      [1, 0, 0],
    );
    g.face(
      [
        [x0, y, za],
        [x0, y, zb],
        [x0, y + ht, zb],
      ],
      [-1, 0, 0],
    );
    g.color(0xc8ccd0);
    g.wallQuad([x0, y, zb], [x1, y, zb], [x1, y + ht, zb], [x0, y + ht, zb], WIN.GLASS, 0.1, ht);
  }
}

/**
 * Horizontal slabs (balconies, cornices) protruding from a facade.
 * side: 0 = +z, 1 = -z, 2 = +x, 3 = -x; a0..a1 is the span along the facade,
 * p the facade plane coordinate.
 */
function bands(
  g: G,
  side: number,
  a0: number,
  a1: number,
  p: number,
  y0: number,
  count: number,
  step: number,
  hex: number,
  depth = 0.035,
  thick = 0.014,
): void {
  g.noWin().color(hex);
  for (let i = 0; i < count; i++) {
    const y = y0 + i * step;
    if (side === 0) g.box(a0, y, p, a1, y + thick, p + depth);
    else if (side === 1) g.box(a0, y, p - depth, a1, y + thick, p);
    else if (side === 2) g.box(p, y, a0, p + depth, y + thick, a1);
    else g.box(p - depth, y, a0, p, y + thick, a1);
  }
}

function crates(g: G, c: ModelCtx, x0: number, z0: number, x1: number, z1: number, n: number): void {
  g.noWin();
  for (let i = 0; i < n; i++) {
    const x = x0 + c.rng.next() * (x1 - x0);
    const z = z0 + c.rng.next() * (z1 - z0);
    const s = 0.022 + c.rng.next() * 0.02;
    g.color(c.rng.pick([0x9a7a52, 0x8a6a42, 0x6f8a9a, 0xa05a3a, 0x5f7f5a])).box(x - s, 0, z - s, x + s, s * 1.6, z + s);
  }
}

function barrels(g: G, c: ModelCtx, x: number, z: number, n: number): void {
  g.noWin();
  for (let i = 0; i < n; i++) {
    g.color(c.rng.pick([0x3f7fd6, 0xd6453d, 0x4caf50, 0xe8b33a])).cylinder(x + i * 0.035, z + (i % 2) * 0.03, 0.015, 0, 0.045, 6);
  }
}

function antenna(g: G, x: number, z: number, y: number, h: number): void {
  g.noWin()
    .color(0x9aa0a6)
    .beam([x, y, z], [x, y + h, z], 0.014);
}

function spire(g: G, x: number, z: number, y: number, h: number, r = 0.04, hex = 0xc8ccd0): void {
  g.noWin()
    .color(hex)
    .cone(x, z, r, y, y + h, 4, Math.PI / 4);
}

/** Stack of centred tiers (setback tower). Returns the top height. */
function tiers(
  g: G,
  cx: number,
  cz: number,
  y0: number,
  specs: [halfW: number, halfD: number, top: number][],
  wall: number,
  roof: number,
  style: number,
  cellW: number,
): number {
  let y = y0;
  for (const [hw, hd, top] of specs) {
    block(g, cx - hw, cz - hd, cx + hw, cz + hd, y, top, wall, roof, style, cellW);
    y = top;
  }
  return y;
}

function pond(g: G, x0: number, z0: number, x1: number, z1: number): void {
  g.rect(x0 - 0.03, z0 - 0.03, x1 + 0.03, z1 + 0.03, 0.013, 0xcfc6a8);
  g.rect(x0, z0, x1, z1, 0.015, 0x4fa9d8);
}

function fountain(g: G, x: number, z: number, r = 0.075): void {
  g.noWin().color(0xd8d4cc).cylinder(x, z, r, 0, 0.03, 8, 0x6fc3e8);
  g.color(0xd8d4cc).cylinder(x, z, r * 0.24, 0.03, 0.09, 6);
}

// =============================================================== residential

/** Detached house (bungalow / family house / villa by wealth). */
const house: ModelFn = (g, c) => {
  const r = c.rng;
  const wall =
    c.wealth === 0 ? r.pick(PAL.walls.low) : c.wealth === 1 ? r.pick([...PAL.walls.mid, ...PAL.walls.pastel]) : r.pick(PAL.walls.high);
  const roof = r.pick(PAL.roofList);
  const floors = c.wealth === 0 ? 1 : c.wealth === 1 ? r.int(1, 2) : 2;
  const hw = c.wealth === 2 ? 0.34 : 0.27 + r.next() * 0.04; // half width
  const hd = c.wealth === 2 ? 0.24 : 0.2 + r.next() * 0.03;
  const cx = 0.5 + (r.next() - 0.5) * 0.06;
  const cz = 0.42;
  const top = floors * F;

  // driveway / path to the front (+z)
  g.rect(cx - 0.05, cz + hd, cx + 0.05, 0.98, 0.012, PAL.sidewalk);

  g.color(wall).win(WIN.RES, 0.13, F);
  g.box(cx - hw, 0, cz - hd, cx + hw, top, cz + hd, { noTop: true });

  g.noWin().color(roof);
  if (c.wealth === 2 && r.chance(0.5)) g.hip(cx - hw, cz - hd, cx + hw, cz + hd, top, 0.16, 0.035);
  else g.gable(cx - hw, cz - hd, cx + hw, cz + hd, top, 0.15 + r.next() * 0.04, 'x', 0.035, wall);

  if (r.chance(0.6)) {
    g.color(shade(wall, 0.75));
    const chx = cx + hw * 0.55;
    g.box(chx - 0.025, top, cz - 0.05, chx + 0.025, top + 0.17, cz);
  }

  // door (+ porch roof for bungalows)
  frontQuad(g, cx - 0.035, cx + 0.035, 0, 0.09, cz + hd + 0.002, shade(roof, 0.8));
  if (c.wealth === 0 && r.chance(0.5)) {
    g.color(shade(wall, 0.9)).box(cx - 0.1, 0.085, cz + hd, cx + 0.1, 0.1, cz + hd + 0.08);
  }

  if (c.wealth >= 1 && r.chance(0.6)) {
    // attached garage on the side
    const gx0 = cx + hw;
    const gx1 = Math.min(0.95, gx0 + 0.16);
    g.color(shade(wall, 0.92));
    g.box(gx0, 0, cz - 0.1, gx1, F * 0.85, cz + hd);
    frontQuad(g, gx0 + 0.02, gx1 - 0.02, 0, 0.08, cz + hd + 0.002, PAL.white);
    g.rect(gx0 + 0.02, cz + hd, gx1 - 0.02, 0.98, 0.012, PAL.sidewalk);
  }
  if (c.wealth === 2) {
    // pool behind the villa, hedges along the street
    g.rect(0.18, 0.04, 0.55, 0.16, 0.014, POOL);
    hedge(g, 0.04, 0.9, 0.3, 0.96);
    hedge(g, 0.7, 0.9, 0.96, 0.96);
  } else if (c.wealth === 1 && r.chance(0.5)) {
    fence(g, 0.04, 0.04, 0.96, 0.4, 0.04, PAL.white, false);
  }
  lotTree(g, c, 0.14 + r.next() * 0.06, 0.8 + r.next() * 0.1, 0.9 + r.next() * 0.4);
  if (r.chance(0.5)) lotTree(g, c, 0.86, 0.12 + r.next() * 0.2, 0.8 + r.next() * 0.5);
};

/** 2x2 estate: main block, wings, portico, pool and gardens. */
const mansion: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick(PAL.walls.high);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.charcoal, PAL.roofs.terracotta, PAL.roofs.blue, PAL.roofs.green, PAL.roofs.red]);
  const floors = r.int(2, 3);
  const top = floors * F;
  // grounds
  g.rect(0.93, 1.13, 1.07, 1.97, 0.012, PAL.sidewalk);
  g.rect(0.6, 1.4, 1.4, 1.64, 0.013, PAL.sidewalk);
  const px = 0.62 + r.next() * 0.3;
  g.rect(px - 0.06, 0.08, px + 0.58, 0.47, 0.012, DECK);
  g.rect(px, 0.13, px + 0.52, 0.42, 0.014, POOL);
  // main block
  const mx0 = 0.55;
  const mx1 = 1.45;
  const mz0 = 0.55;
  const mz1 = 1.05;
  g.color(wall).win(WIN.RES, 0.12, F);
  g.box(mx0, 0, mz0, mx1, top, mz1, { noTop: true });
  g.noWin().color(roof).hip(mx0, mz0, mx1, mz1, top, 0.2, 0.04);
  // wings
  const wingMode = r.int(0, 2);
  const wingTop = Math.max(1, floors - 1) * F;
  const wings: [number, number][] = [];
  if (wingMode !== 1) wings.push([0.2, 0.6]);
  if (wingMode !== 0) wings.push([1.4, 1.8]);
  for (const [wx0, wx1] of wings) {
    g.color(wall).win(WIN.RES, 0.12, F);
    g.box(wx0, 0, 0.42, wx1, wingTop, 1.28, { noTop: true });
    g.noWin().color(roof).hip(wx0, 0.42, wx1, 1.28, wingTop, 0.15, 0.035);
  }
  // portico with columns and a pediment
  const colTop = Math.min(top, 2 * F) - 0.01;
  g.color(PAL.white);
  for (const x of [0.8, 0.92, 1.08, 1.2]) g.box(x - 0.014, 0, 1.1, x + 0.014, colTop, 1.128, { noTop: true });
  g.box(0.74, colTop, 1.05, 1.26, colTop + 0.03, 1.15, { top: shade(PAL.white, 0.95) });
  g.color(roof).gable(0.74, 1.05, 1.26, 1.15, colTop + 0.03, 0.08, 'z', 0.01, PAL.white);
  frontQuad(g, 0.96, 1.04, 0, 0.1, mz1 + 0.002, 0x5a3a28);
  // chimneys
  g.color(shade(wall, 0.8));
  g.box(mx0 + 0.1, top - 0.05, mz0 + 0.08, mx0 + 0.17, top + 0.24, mz0 + 0.15);
  g.box(mx1 - 0.17, top - 0.05, mz0 + 0.08, mx1 - 0.1, top + 0.24, mz0 + 0.15);
  fountain(g, 1.0, 1.52);
  hedge(g, 0.06, 1.86, 0.86, 1.93);
  hedge(g, 1.14, 1.86, 1.94, 1.93);
  lotTree(g, c, 0.18, 0.2, 1.2);
  lotTree(g, c, 1.82, 0.2, 1.1);
  pine(g, c, 0.2, 1.62, 1.2);
  pine(g, c, 1.8, 1.62, 1.3);
  if (r.chance(0.6)) lotTree(g, c, 0.4, 1.72, 0.9);
};

/** 1x1 row of narrow attached houses. */
const townhouse: ModelFn = (g, c) => {
  const r = c.rng;
  const n = c.wealth === 2 ? 3 : r.int(3, 4);
  const x0 = 0.05;
  const x1 = 0.95;
  const zb = 0.18;
  const zf = 0.72;
  const uw = (x1 - x0) / n;
  const base = c.wealth === 0 ? 2 : c.wealth === 1 ? r.int(2, 3) : 3;
  const palette =
    c.wealth === 0
      ? [...PAL.walls.brick, ...PAL.walls.low]
      : c.wealth === 1
        ? PAL.walls.pastel
        : [0x8e5c44, 0x7f4f3a, 0xd8c9a8, 0xa65a3f, 0xc9b49a, 0x9a6a52];
  g.rect(x0, zf, x1, 0.95, 0.012, c.wealth === 1 ? shade(PAL.grass, 1.1) : PAL.sidewalk);
  let prev = -1;
  for (let i = 0; i < n; i++) {
    const ux0 = x0 + i * uw;
    const ux1 = ux0 + uw;
    const floors = base + (c.wealth !== 2 && r.chance(0.3) ? 1 : 0);
    const top = floors * F + (c.wealth !== 1 ? r.int(0, 2) * 0.014 : 0);
    let wall = r.pick(palette);
    if (wall === prev) wall = r.pick(palette);
    prev = wall;
    const light = lum(wall) > 150;
    g.color(wall).win(WIN.RES, 0.1, F);
    if (c.wealth === 1) {
      g.box(ux0, 0, zb, ux1, top, zf, { noTop: true });
      g.noWin()
        .color(r.pick(PAL.roofList))
        .gable(ux0, zb, ux1, zf, top, 0.12 + r.next() * 0.05, 'z', 0.008, wall);
    } else {
      g.box(ux0, 0, zb, ux1, top, zf, { top: r.pick([PAL.flatRoof, PAL.flatRoofDark, 0x7a746c]) });
      g.noWin()
        .color(light ? shade(wall, 0.7) : 0xe8e0d0)
        .box(ux0, top - 0.02, zf, ux1, top + 0.012, zf + 0.025);
    }
    const dx = ux0 + uw * (i % 2 === 0 ? 0.3 : 0.7);
    if (c.wealth === 2) {
      // stoop, raised door and a bay window next to it
      g.color(shade(wall, 0.8)).box(dx - 0.035, 0, zf, dx + 0.035, 0.035, zf + 0.08);
      frontQuad(g, dx - 0.025, dx + 0.025, 0.035, 0.12, zf + 0.002, 0x2b2420);
      const bx0 = i % 2 === 0 ? dx + 0.05 : ux0 + 0.025;
      const bx1 = i % 2 === 0 ? ux1 - 0.025 : dx - 0.05;
      g.color(shade(wall, 1.06)).win(WIN.RES, 0.06, F);
      g.box(bx0, 0.035, zf, bx1, top - F * 0.6, zf + 0.045, { top: shade(wall, 0.75) });
    } else {
      frontQuad(g, dx - 0.025, dx + 0.025, 0, 0.09, zf + 0.002, 0x4a3a30);
    }
  }
  if (c.wealth !== 2 && (n === 3 || r.chance(0.5))) lotTree(g, c, 0.2 + r.next() * 0.6, 0.09, 0.8);
};

/** 2x2 apartment buildings: brick walk-up, L-shaped stucco, or terraced condos. */
const apartments: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.wealth === 0) {
    const wall = r.pick(PAL.walls.brick);
    const floors = r.int(4, 5);
    const top = floors * F;
    const x0 = 0.15;
    const x1 = 1.85;
    const z0 = 0.2;
    const z1 = 1.15;
    block(g, x0, z0, x1, z1, 0, top, wall, PAL.flatRoofDark, WIN.RES, 0.12);
    g.noWin()
      .color(shade(wall, 0.72))
      .box(x0 - 0.012, top - 0.025, z1, x1 + 0.012, top + 0.012, z1 + 0.025);
    // fire escapes
    for (const fx of [0.5, 1.5]) {
      g.color(0x34363a);
      for (let f = 1; f < floors; f++) g.box(fx - 0.1, f * F - 0.006, z1, fx + 0.1, f * F + 0.006, z1 + 0.05);
    }
    frontQuad(g, 0.95, 1.05, 0, 0.1, z1 + 0.002, DOOR);
    g.color(0x5a5a58).box(0.92, 0.1, z1, 1.08, 0.115, z1 + 0.06);
    waterTank(g, 0.45, 0.5, top);
    g.color(0x8f8a84).box(1.3, top, 0.4, 1.5, top + 0.09, 0.62);
    g.rect(0.95, z1, 1.05, 1.97, 0.012, PAL.sidewalk);
    for (const tx of [0.3, 0.7, 1.3, 1.7]) lotTree(g, c, tx, 1.8, 0.9 + r.next() * 0.3);
    car(g, 0.35, 1.5, true, r.pick(PAL.cars));
  } else if (c.wealth === 1) {
    const wall = r.pick([...PAL.walls.mid, ...PAL.walls.pastel]);
    const roof = r.pick([PAL.roofs.terracotta, PAL.roofs.red, PAL.roofs.slate, PAL.roofs.brown]);
    const floors = r.int(4, 6);
    const top = floors * F;
    const left = r.chance(0.5);
    g.color(wall).win(WIN.RES, 0.12, F);
    g.box(0.15, 0, 0.15, 1.85, top, 0.75, { noTop: true });
    g.noWin().color(roof).hip(0.15, 0.15, 1.85, 0.75, top, 0.2, 0.03);
    const wx0 = left ? 0.15 : 1.25;
    const wx1 = left ? 0.75 : 1.85;
    g.color(wall).win(WIN.RES, 0.12, F);
    g.box(wx0, 0, 0.75, wx1, top, 1.8, { noTop: true });
    g.noWin().color(roof).hip(wx0, 0.45, wx1, 1.8, top, 0.2, 0.03);
    // balconies on the faces around the courtyard
    const rail = r.pick([PAL.white, 0xd8d4cc, 0xe8dcc4]);
    bands(g, 0, left ? 0.85 : 0.25, left ? 1.75 : 1.15, 0.75, F - 0.006, floors - 1, F, rail);
    bands(g, left ? 2 : 3, 0.85, 1.7, left ? 0.75 : 1.25, F - 0.006, floors - 1, F, rail);
    // courtyard
    const cx0 = left ? 0.75 : 0.15;
    const cx1 = left ? 1.85 : 1.25;
    g.rect(cx0 + 0.08, 1.12, cx1 - 0.08, 1.22, 0.012, PAL.sidewalk);
    lotTree(g, c, (cx0 + cx1) / 2 - 0.3, 0.95, 1.1);
    lotTree(g, c, (cx0 + cx1) / 2 + 0.3, 1.45, 1.0);
    pine(g, c, (cx0 + cx1) / 2 + 0.25, 0.92, 1.1);
    const dcx = (wx0 + wx1) / 2;
    frontQuad(g, dcx - 0.04, dcx + 0.04, 0, 0.1, 1.802, DOOR);
    g.rect(dcx - 0.05, 1.8, dcx + 0.05, 1.97, 0.012, PAL.sidewalk);
  } else {
    const wall = r.pick(PAL.walls.high);
    const roof = 0xd8d4cc;
    const rail = 0x9fc8d8;
    const y1 = 2 * F;
    const y2 = y1 + r.int(2, 3) * F;
    const y3 = y2 + r.int(1, 2) * F;
    block(g, 0.2, 0.2, 1.8, 1.45, 0, y1, wall, roof, WIN.GLASS, 0.16);
    block(g, 0.2, 0.2, 1.8, 1.1, y1, y2, wall, roof, WIN.GLASS, 0.16);
    block(g, 0.4, 0.2, 1.6, 0.8, y2, y3, wall, roof, WIN.GLASS, 0.16);
    // terraces: roof gardens and glass railings
    g.rect(0.26, 1.14, 1.74, 1.4, y1 + 0.006, ROOF_GREEN);
    g.rect(0.46, 0.84, 1.54, 1.05, y2 + 0.006, ROOF_GREEN);
    g.noWin().color(rail);
    g.panel([0.2, y1, 1.45], [1.8, y1, 1.45], [1.8, y1 + 0.04, 1.45], [0.2, y1 + 0.04, 1.45]);
    g.panel([0.2, y2, 1.1], [1.8, y2, 1.1], [1.8, y2 + 0.04, 1.1], [0.2, y2 + 0.04, 1.1]);
    roofTree(g, c, 0.45, 1.27, y1, 0.6);
    roofTree(g, c, 1.55, 1.27, y1, 0.6);
    // pool in the front garden
    g.rect(0.3, 1.58, 1.42, 1.9, 0.012, DECK);
    g.rect(0.38, 1.63, 1.34, 1.85, 0.014, POOL);
    lotTree(g, c, 1.7, 1.75, 1.1);
    lotTree(g, c, 0.12, 1.75, 0.9);
  }
};

/** 3x3 housing: concrete slabs, courtyard block, or terraced garden residences. */
const aptComplex: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.wealth === 0) {
    const wall = r.pick([0xc9c4ba, 0xbdb6a8, 0xd2c8b4, 0xb8b2a6, 0xd8c8a8]);
    const accent = r.pick(PAL.walls.pastel);
    const floors = r.int(5, 7);
    const top = floors * F;
    for (const [z0, z1] of [
      [0.2, 0.75],
      [1.2, 1.75],
    ] as const) {
      block(g, 0.2, z0, 2.8, z1, 0, top, wall, PAL.flatRoofDark, WIN.RES, 0.11);
      for (const sx of [0.85, 2.15]) {
        g.noWin()
          .color(accent)
          .box(sx - 0.08, 0, z1, sx + 0.08, top + 0.06, z1 + 0.06, { top: shade(accent, 0.85) });
        frontQuad(g, sx - 0.035, sx + 0.035, 0, 0.1, z1 + 0.062, DOOR);
      }
    }
    parking(g, c, 0.2, 2.05, 1.7, 2.85, 5);
    // playground
    g.rect(1.9, 2.05, 2.8, 2.85, 0.013, 0xd8c8a0);
    g.noWin().color(PAL.red).box(2.05, 0, 2.25, 2.15, 0.09, 2.35);
    g.color(PAL.yellow).face(
      [
        [2.15, 0.09, 2.25],
        [2.15, 0.09, 2.35],
        [2.4, 0.015, 2.35],
        [2.4, 0.015, 2.25],
      ],
      [0.4, 1, 0],
    );
    g.color(0x3f7fd6);
    g.beam([2.3, 0, 2.55], [2.3, 0.12, 2.55], 0.012);
    g.beam([2.6, 0, 2.55], [2.6, 0.12, 2.55], 0.012);
    g.beam([2.3, 0.12, 2.55], [2.6, 0.12, 2.55], 0.012);
    lotTree(g, c, 0.5, 1.0, 1.1);
    lotTree(g, c, 1.5, 0.98, 1.0);
    pine(g, c, 2.5, 1.0, 1.2);
    lotTree(g, c, 2.65, 1.95, 1.0);
  } else if (c.wealth === 1) {
    const wall = r.pick([...PAL.walls.brick, ...PAL.walls.mid]);
    const roof = r.pick([PAL.flatRoofDark, 0x7a7068, 0x6a7078]);
    const towerRoof = r.pick([PAL.roofs.slate, PAL.roofs.terracotta, PAL.roofs.charcoal, PAL.roofs.green]);
    const floors = r.int(5, 6);
    const top = floors * F;
    const t = 0.55;
    const bars: [number, number, number, number][] = [
      [0.2, 0.2, 2.8, 0.2 + t],
      [0.2, 0.2 + t, 0.2 + t, 2.8],
      [2.8 - t, 0.2 + t, 2.8, 2.8],
      [0.2 + t, 2.8 - t, 1.3, 2.8],
      [1.7, 2.8 - t, 2.8 - t, 2.8],
    ];
    for (const [x0, z0, x1, z1] of bars) block(g, x0, z0, x1, z1, 0, top, wall, roof, WIN.RES, 0.12);
    // corner towers
    for (const [tx, tz] of [
      [0.2, 0.2],
      [2.45, 0.2],
      [0.2, 2.45],
      [2.45, 2.45],
    ]) {
      g.color(shade(wall, 0.92)).win(WIN.RES, 0.12, F);
      g.box(tx, 0, tz, tx + 0.35, top + F, tz + 0.35, { noTop: true });
      g.noWin()
        .color(towerRoof)
        .pyramid(tx + 0.175, tz + 0.175, 0.39, 0.39, top + F, 0.2);
    }
    // courtyard garden
    g.rect(0.75, 0.75, 2.25, 2.25, 0.012, shade(PAL.grass, 1.12));
    g.rect(1.45, 0.75, 1.55, 2.95, 0.013, PAL.sidewalk);
    g.rect(0.75, 1.45, 2.25, 1.55, 0.013, PAL.sidewalk);
    fountain(g, 1.5, 1.5, 0.09);
    lotTree(g, c, 1.05, 1.05, 1.2);
    lotTree(g, c, 1.95, 1.05, 1.1);
    lotTree(g, c, 1.05, 1.95, 1.0);
    lotTree(g, c, 1.95, 1.95, 1.2);
  } else {
    const wall = r.pick(PAL.walls.high);
    const roof = 0xd8d4cc;
    for (const [x0, x1] of [
      [0.2, 1.25],
      [1.75, 2.8],
    ] as const) {
      const f1 = r.int(5, 6);
      block(g, x0, 0.2, x1, 1.0, 0, f1 * F, wall, roof, WIN.GLASS, 0.16);
      block(g, x0, 1.0, x1, 1.6, 0, (f1 - 2) * F, wall, roof, WIN.GLASS, 0.16);
      block(g, x0, 1.6, x1, 2.1, 0, (f1 - 4) * F, wall, roof, WIN.GLASS, 0.16);
      g.rect(x0 + 0.05, 1.05, x1 - 0.05, 1.55, (f1 - 2) * F + 0.006, ROOF_GREEN);
      g.rect(x0 + 0.05, 1.65, x1 - 0.05, 2.05, (f1 - 4) * F + 0.006, ROOF_GREEN);
      roofTree(g, c, (x0 + x1) / 2, 1.3, (f1 - 2) * F, 0.6);
      roofTree(g, c, x0 + 0.25, 1.85, (f1 - 4) * F, 0.6);
    }
    block(g, 1.25, 0.2, 1.75, 0.7, 0, 4 * F, wall, roof, WIN.GLASS, 0.16);
    g.rect(1.3, 1.0, 1.7, 2.3, 0.012, DECK);
    g.rect(1.36, 1.1, 1.64, 2.2, 0.014, POOL);
    g.rect(0.2, 2.45, 2.8, 2.55, 0.012, PAL.sidewalk);
    for (const tx of [0.35, 0.95, 2.05, 2.65]) lotTree(g, c, tx, 2.75, 1.0 + r.next() * 0.3);
  }
};

/** 1x1 tower: residential (R) or office (C) depending on zone. */
const slimTower: ModelFn = (g, c) => {
  const r = c.rng;
  const isC = c.zone === 2;
  g.rect(0.04, 0.04, 0.96, 0.96, 0.012, isC ? PAL.concrete : 0xcfcabe);
  let top: number;
  if (!isC) {
    if (c.wealth === 0) {
      const wall = r.pick([...PAL.walls.brick, 0xb8b0a0, 0xa8a090]);
      top = r.int(8, 11) * F;
      block(g, 0.2, 0.2, 0.8, 0.8, 0, top, wall, PAL.flatRoofDark, WIN.RES, 0.11);
      g.noWin()
        .color(shade(wall, 0.7))
        .box(0.19, top - 0.025, 0.19, 0.81, top + 0.012, 0.81, { noTop: true });
      waterTank(g, 0.36, 0.36, top);
      g.color(0x8f8a84).box(0.52, top, 0.5, 0.7, top + 0.08, 0.7);
    } else if (c.wealth === 1) {
      const wall = r.pick(PAL.walls.mid);
      const floors = r.int(9, 12);
      top = floors * F;
      block(g, 0.22, 0.22, 0.78, 0.78, 0, top, wall, PAL.flatRoof, WIN.RES, 0.11);
      bands(g, 0, 0.26, 0.74, 0.78, F - 0.006, floors - 1, F, r.pick([PAL.white, 0xd8d4cc]), 0.04);
      g.color(0x9a968e).box(0.35, top, 0.3, 0.6, top + 0.07, 0.55);
    } else {
      const wall = r.pick(PAL.walls.high);
      top = r.int(10, 13) * F;
      const crown = top - 2 * F;
      g.color(shade(wall, 0.85)).win(WIN.SHOP, 0.18, F);
      g.box(0.27, 0, 0.27, 0.73, F, 0.73, { noTop: true });
      block(g, 0.22, 0.22, 0.78, 0.78, F, crown, wall, 0xd8d4cc, WIN.GLASS, 0.12);
      g.rect(0.25, 0.25, 0.75, 0.75, crown + 0.006, ROOF_GREEN);
      block(g, 0.32, 0.32, 0.68, 0.68, crown, top, wall, 0xd8d4cc, WIN.GLASS, 0.12);
      antenna(g, 0.5, 0.5, top, 0.25);
      lotTree(g, c, 0.1, 0.9, 0.7);
      lotTree(g, c, 0.9, 0.9, 0.7);
    }
    frontQuad(g, 0.44, 0.56, 0, 0.1, 0.802, DOOR);
    g.noWin().color(0x6a6e72).box(0.4, 0.1, 0.78, 0.6, 0.115, 0.86);
  } else {
    if (c.wealth === 0) {
      const wall = r.pick(PAL.officeWalls);
      top = r.int(9, 12) * F;
      block(g, 0.14, 0.14, 0.86, 0.86, 0, F * 1.3, shade(wall, 0.85), PAL.flatRoof, WIN.SHOP, 0.2, F * 1.3);
      block(g, 0.22, 0.22, 0.78, 0.78, F * 1.3, top, wall, PAL.flatRoof, WIN.OFFICE, 0.14);
      roofUnits(g, c, 0.22, 0.22, 0.78, 0.78, top, 2);
    } else if (c.wealth === 1) {
      const wall = r.pick([0x5a6068, 0x6a6058, 0x4f5862, 0x7a7068]);
      top = r.int(10, 13) * F;
      block(g, 0.22, 0.22, 0.78, 0.78, 0, top, wall, PAL.flatRoofDark, WIN.OFFICE, 0.12);
      g.noWin()
        .color(shade(wall, 1.3))
        .box(0.2, top - F * 0.6, 0.2, 0.8, top + 0.04, 0.8, { top: shade(wall, 0.9) });
      antenna(g, 0.5, 0.5, top + 0.04, 0.35);
    } else {
      const wall = r.pick(GLASS_WALLS);
      top = r.int(11, 14) * F;
      block(g, 0.15, 0.15, 0.85, 0.85, 0, F * 1.3, PAL.concreteDark, PAL.flatRoof, WIN.SHOP, 0.2, F * 1.3);
      block(g, 0.22, 0.22, 0.78, 0.78, F * 1.3, top, wall, GLASS_ROOF, WIN.GLASS, 0.12);
      g.noWin()
        .color(PAL.white)
        .box(0.2, F * 1.3, 0.75, 0.25, top + 0.05, 0.8, { top: PAL.white });
      g.color(shade(wall, 0.85)).shed(0.22, 0.22, 0.78, 0.78, top, 0.22, false);
    }
    g.noWin()
      .color(0x6a6e72)
      .box(0.36, F * 0.75, 0.78, 0.64, F * 0.82, 0.9);
  }
};

/** 2x2 residential tower: projects, slab with balconies, or luxury condo tower. */
const resTower: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.wealth === 0) {
    const wall = r.pick([...PAL.walls.brick, 0xb5a48e]);
    const floors = r.int(11, 15);
    const top = floors * F;
    block(g, 0.62, 0.3, 1.38, 1.7, 0, top, wall, PAL.flatRoofDark, WIN.RES, 0.11);
    block(g, 0.3, 0.62, 1.7, 1.38, 0, top - F, wall, PAL.flatRoofDark, WIN.RES, 0.11);
    g.noWin()
      .color(0x8f8a84)
      .box(0.85, top, 0.85, 1.15, top + 0.1, 1.15);
    frontQuad(g, 0.94, 1.06, 0, 0.1, 1.702, DOOR);
    g.rect(0.95, 1.7, 1.05, 1.97, 0.012, PAL.sidewalk);
    // basketball court
    g.rect(1.42, 1.5, 1.94, 1.94, 0.013, 0xc8643c);
    g.rect(1.67, 1.5, 1.69, 1.94, 0.015, PAL.laneWhite);
    lotTree(g, c, 0.2, 0.2, 1.1);
    lotTree(g, c, 1.8, 0.25, 1.0);
    lotTree(g, c, 0.25, 1.78, 1.1);
  } else if (c.wealth === 1) {
    const wall = r.pick(PAL.walls.mid);
    const floors = r.int(12, 16);
    const ph = F * 1.4;
    const top = ph + floors * F;
    block(g, 0.15, 0.3, 1.85, 1.7, 0, ph, PAL.concrete, PAL.flatRoof, WIN.SHOP, 0.22, ph);
    g.rect(0.2, 1.35, 1.8, 1.65, ph + 0.006, ROOF_GREEN);
    block(g, 0.4, 0.6, 1.6, 1.3, ph, top, wall, PAL.flatRoofDark, WIN.RES, 0.12);
    const rail = r.pick([PAL.white, 0xd8d4cc, 0xe8dcc4]);
    bands(g, 0, 0.45, 1.55, 1.3, ph + F - 0.006, floors - 1, F, rail);
    bands(g, 1, 0.45, 1.55, 0.6, ph + 2 * F - 0.006, Math.floor((floors - 1) / 2), 2 * F, rail);
    g.noWin()
      .color(0x8f8a84)
      .box(0.8, top, 0.8, 1.2, top + 0.1, 1.1);
    antenna(g, 1.4, 0.75, top, 0.3);
    roofTree(g, c, 0.4, 1.5, ph, 0.6);
    roofTree(g, c, 1.6, 1.5, ph, 0.6);
    g.noWin()
      .color(0x6a6e72)
      .box(0.85, ph * 0.62, 1.7, 1.15, ph * 0.68, 1.85);
    g.rect(0.9, 1.7, 1.1, 1.97, 0.012, PAL.sidewalk);
  } else {
    const wall = r.pick(PAL.walls.high);
    const roof = 0xd8d4cc;
    const floors = r.int(14, 18);
    const top = floors * F;
    const mid = top - 3 * F;
    g.rect(0.06, 0.06, 1.94, 1.94, 0.012, 0xd8d2c4);
    g.color(shade(wall, 0.85)).win(WIN.SHOP, 0.2, F);
    g.box(0.6, 0, 0.6, 1.4, F, 1.4, { noTop: true });
    block(g, 0.55, 0.55, 1.45, 1.45, F, mid, wall, roof, WIN.GLASS, 0.13);
    block(g, 0.65, 0.65, 1.35, 1.35, mid, top, wall, roof, WIN.GLASS, 0.13);
    g.rect(0.75, 0.75, 1.25, 1.1, top + 0.007, POOL);
    g.noWin()
      .color(shade(wall, 0.95))
      .box(0.64, top, 1.25, 1.36, top + 0.1, 1.36, { top: roof });
    fountain(g, 1.0, 1.72, 0.08);
    for (const [tx, tz] of [
      [0.25, 0.25],
      [1.75, 0.25],
      [0.25, 1.75],
      [1.75, 1.75],
    ])
      lotTree(g, c, tx, tz, 1.0 + r.next() * 0.3);
  }
};

/** 3x3 residential giants: mega block, twin towers, sky residences. */
const resMegatower: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.wealth === 0) {
    const wall = r.pick([0xc9c4ba, 0xbdb6a8, 0xd8cdb8, 0xa9a49a]);
    const floors = r.int(18, 22);
    const top = floors * F;
    g.noWin().color(0x5a5856).box(0.4, 0, 0.95, 2.6, F, 2.05, { noTop: true });
    block(g, 0.25, 0.85, 2.75, 2.15, F, top, wall, PAL.flatRoofDark, WIN.RES, 0.11);
    // polychrome loggia stripes on the long facades
    for (let i = 0; i < 5; i++) {
      const sx = 0.4 + i * 0.48 + r.next() * 0.1;
      const y0 = F + r.int(1, 6) * F;
      const y1 = Math.min(top - F, y0 + r.int(4, 10) * F);
      g.noWin()
        .color(r.pick(PAL.walls.pastel))
        .box(sx, y0, 2.15, sx + 0.12, y1, 2.17);
    }
    g.color(0x8f8a84).box(0.6, top, 1.3, 0.95, top + 0.14, 1.7);
    g.color(0x8f8a84).box(2.0, top, 1.3, 2.35, top + 0.14, 1.7);
    chimney(g, 1.5, 1.5, top, 0.25, 0.08, 0xa8a49c, null);
    parking(g, c, 0.2, 2.35, 2.8, 2.9, 6, false);
    parking(g, c, 0.25, 0.12, 2.75, 0.6, 4, false);
    lotTree(g, c, 0.12, 1.5, 1.1);
    lotTree(g, c, 2.88, 1.5, 1.0);
  } else if (c.wealth === 1) {
    const wall = r.pick(PAL.walls.mid);
    const ph = F * 1.2;
    block(g, 0.15, 0.15, 2.85, 2.85, 0, ph, PAL.concrete, PAL.flatRoof, WIN.SHOP, 0.24, ph);
    g.rect(0.25, 1.6, 1.4, 2.75, ph + 0.006, ROOF_GREEN);
    g.rect(1.6, 0.25, 2.75, 1.4, ph + 0.006, ROOF_GREEN);
    const rail = r.pick([PAL.white, 0xd8d4cc, 0xe8dcc4]);
    const base = r.int(22, 26);
    for (const [x0, z0, extra] of [
      [0.3, 0.3, 0],
      [1.7, 1.7, r.int(-3, 3)],
    ] as const) {
      const floors = base + extra;
      const top = ph + floors * F;
      block(g, x0, z0, x0 + 1.0, z0 + 1.0, ph, top, wall, PAL.flatRoofDark, WIN.RES, 0.12);
      bands(g, 0, x0 + 0.05, x0 + 0.95, z0 + 1.0, ph + 2 * F - 0.006, Math.floor(floors / 2), 2 * F, rail);
      bands(g, 2, z0 + 0.05, z0 + 0.95, x0 + 1.0, ph + 2 * F - 0.006, Math.floor(floors / 2), 2 * F, rail);
      block(g, x0 + 0.2, z0 + 0.2, x0 + 0.8, z0 + 0.8, top, top + F, shade(wall, 0.9), PAL.flatRoofDark, WIN.RES, 0.12);
      antenna(g, x0 + 0.5, z0 + 0.5, top + F, 0.35);
    }
    roofTree(g, c, 0.6, 2.2, ph, 0.7);
    roofTree(g, c, 1.0, 2.5, ph, 0.6);
    roofTree(g, c, 2.2, 0.6, ph, 0.7);
  } else {
    const wall = r.pick(PAL.walls.high);
    const roof = 0xd8d4cc;
    const floors = r.int(26, 30);
    const top = floors * F;
    g.rect(0.06, 0.06, 2.94, 2.94, 0.012, 0xd8d2c4);
    g.color(shade(wall, 0.85)).win(WIN.SHOP, 0.22, F * 1.2);
    g.box(0.9, 0, 0.9, 2.1, F * 1.2, 2.1, { noTop: true });
    const y = tiers(
      g,
      1.5,
      1.5,
      F * 1.2,
      [
        [0.75, 0.75, top * 0.6],
        [0.62, 0.62, top * 0.85],
        [0.48, 0.48, top],
      ],
      wall,
      roof,
      WIN.GLASS,
      0.13,
    );
    g.rect(0.8, 0.8, 2.2, 0.86, top * 0.6 + 0.006, ROOF_GREEN);
    roofTree(g, c, 0.85, 0.85, top * 0.6, 0.55);
    roofTree(g, c, 2.15, 2.15, top * 0.6, 0.55);
    spire(g, 1.5, 1.5, y, 0.7, 0.05);
    g.rect(0.35, 2.3, 1.2, 2.75, 0.013, DECK);
    g.rect(0.42, 2.38, 1.13, 2.67, 0.015, POOL);
    for (const [tx, tz] of [
      [0.3, 0.3],
      [2.7, 0.3],
      [2.7, 2.7],
      [1.6, 2.7],
      [0.3, 1.5],
    ])
      lotTree(g, c, tx, tz, 1.1 + r.next() * 0.3);
  }
};

// ================================================================ commercial

/** 1x1 shops: corner shop, diner, boutique. */
const shop: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.78, 0.96, 0.97, 0.012, PAL.sidewalk);
  if (c.wealth === 0) {
    const wall = r.pick([...PAL.walls.low, ...PAL.walls.brick]);
    const two = r.chance(0.6);
    const gh = F * 1.15;
    // single-storey shops are smaller and get a side lot
    const x1 = two ? 0.88 : 0.66;
    const z0 = two ? 0.2 : 0.34;
    g.color(wall).win(WIN.SHOP, 0.2, gh);
    g.box(0.12, 0, z0, x1, gh, 0.78, { noTop: two, top: PAL.flatRoof });
    let top = gh;
    if (two) {
      g.win(WIN.RES, 0.12, F);
      g.box(0.12, gh, z0, x1, gh + F, 0.78, { top: PAL.flatRoof });
      top = gh + F;
    } else {
      g.rect(0.7, 0.3, 0.96, 0.77, 0.012, PAL.asphalt);
      car(g, 0.83, 0.5, false, r.pick(PAL.cars));
    }
    g.noWin();
    roofRim(g, 0.12, z0, x1, 0.78, top, PAL.flatRoof);
    const col = r.pick(PAL.awnings);
    awning(g, 0.16, x1 - 0.04, 0.78, gh - 0.015, 0.11, col);
    g.color(r.pick(PAL.awnings)).box(0.2, top, 0.72, x1 - 0.08, top + 0.07, 0.76, { top: PAL.white });
    g.color(0x3f6f4a).box(0.04, 0, 0.24, 0.11, 0.05, 0.36);
  } else if (c.wealth === 1) {
    const body = r.pick([0xd8dde2, 0xe8e2d0, 0xf2e8c8]);
    const stripe = r.pick([PAL.red, PAL.blue, 0x2bb3a3, PAL.orange]);
    g.color(body).win(WIN.SHOP, 0.12, F * 0.9);
    g.box(0.12, 0, 0.18, 0.88, F * 0.9, 0.5, { noTop: true });
    g.noWin()
      .color(stripe)
      .box(0.115, F * 0.74, 0.175, 0.885, F * 0.92, 0.505, { top: 0xb8bcc0 });
    g.color(0x9aa0a6).beam([0.8, F * 0.92, 0.25], [0.8, 0.44, 0.25], 0.016);
    g.color(stripe).box(0.64, 0.36, 0.23, 0.96, 0.46, 0.27, { top: PAL.white });
    g.rect(0.04, 0.52, 0.96, 0.78, 0.012, PAL.asphalt);
    for (const lx of [0.3, 0.5, 0.7]) g.rect(lx - 0.004, 0.55, lx + 0.004, 0.68, 0.015, PAL.laneWhite);
    car(g, 0.4, 0.615, false, r.pick(PAL.cars));
    if (r.chance(0.6)) car(g, 0.6, 0.615, false, r.pick(PAL.cars));
  } else {
    const wall = r.pick([0xf4ede0, 0xece4d4, 0xf6f0e6, 0xe8dcc8]);
    const aw = r.pick([0x2b2d30, 0x2a3f5f, 0x5f2a3a, 0x2f4f3f]);
    g.color(wall).win(WIN.SHOP, 0.2, F * 1.1);
    g.box(0.15, 0, 0.22, 0.85, F * 1.1, 0.76, { noTop: true });
    g.win(WIN.CIVIC, 0.13, F);
    g.box(0.15, F * 1.1, 0.22, 0.85, F * 2.1, 0.76, { noTop: true });
    g.noWin()
      .color(PAL.roofs.slate)
      .hip(0.15, 0.22, 0.85, 0.76, F * 2.1, 0.12, 0.02);
    awning(g, 0.18, 0.82, 0.76, F * 1.1 - 0.01, 0.09, aw);
    lotTree(g, c, 0.1, 0.88, 0.6);
    lotTree(g, c, 0.9, 0.88, 0.6);
  }
};

/** 1x1 gas station: canopy, pumps, kiosk, price sign. */
const gasStation: ModelFn = (g, c) => {
  const r = c.rng;
  const brand = r.pick([PAL.red, PAL.blue, PAL.green, 0xf2a93b, 0x2bb3a3]);
  g.rect(0.03, 0.03, 0.97, 0.97, 0.012, PAL.asphalt);
  const cx0 = 0.12;
  const cx1 = 0.68;
  const cz0 = 0.42;
  const cz1 = 0.9;
  const ch = 0.17;
  g.noWin().color(PAL.steel);
  for (const [px, pz] of [
    [cx0 + 0.08, cz0 + 0.1],
    [cx1 - 0.08, cz0 + 0.1],
    [cx0 + 0.08, cz1 - 0.1],
    [cx1 - 0.08, cz1 - 0.1],
  ])
    g.box(px - 0.012, 0, pz - 0.012, px + 0.012, ch, pz + 0.012, { noTop: true });
  g.color(brand).box(cx0, ch, cz0, cx1, ch + 0.035, cz1, { top: PAL.white });
  for (const pz of [0.56, 0.76]) {
    g.color(0xd0d0cc).box(0.28, 0, pz - 0.02, 0.52, 0.015, pz + 0.02);
    g.color(brand).box(0.37, 0.015, pz - 0.014, 0.43, 0.075, pz + 0.014);
  }
  g.color(PAL.white).win(WIN.SHOP, 0.15, F * 0.85);
  g.box(0.62, 0, 0.08, 0.92, F * 0.85, 0.36, { top: PAL.flatRoof });
  g.noWin()
    .color(brand)
    .box(0.615, F * 0.85 - 0.02, 0.075, 0.925, F * 0.85 + 0.015, 0.365, { noTop: true });
  g.color(PAL.steel).beam([0.9, 0, 0.9], [0.9, 0.38, 0.9], 0.02);
  g.color(brand).box(0.84, 0.3, 0.88, 0.96, 0.42, 0.92, { top: PAL.white });
  car(g, 0.4, 0.66, true, r.pick(PAL.cars));
};

/** 2x2 strip mall, supermarket or garden market. */
const stripMall: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.name === 'Supermarket') {
    const wall = r.pick([0xe8e2d4, 0xd8d0c0, 0xece6da]);
    const brand = r.pick([PAL.red, PAL.green, PAL.blue, PAL.orange]);
    const h = F * 1.6;
    g.noWin().color(wall).box(0.12, 0, 0.12, 1.88, h, 0.95, { top: PAL.flatRoof });
    roofRim(g, 0.12, 0.12, 1.88, 0.95, h, PAL.flatRoof);
    g.color(shade(wall, 0.85)).box(0.11, 0, 0.94, 1.89, 0.03, 0.96);
    g.color(PAL.glassBlue).win(WIN.GLASS, 0.1, F).box(0.75, 0, 0.95, 1.25, F, 1.05, { top: brand });
    g.noWin()
      .color(brand)
      .box(0.55, h - 0.02, 0.92, 1.45, h + 0.1, 0.97, { top: PAL.white });
    roofUnits(g, c, 0.12, 0.12, 1.88, 0.95, h, 3);
    parking(g, c, 0.1, 1.15, 1.9, 1.95, 6);
    g.color(PAL.steel).box(1.55, 0, 1.06, 1.75, 0.05, 1.1);
  } else if (c.name === 'Garden Market') {
    const wall = r.pick(PAL.walls.mid);
    g.color(wall).win(WIN.SHOP, 0.2, F * 1.1);
    g.box(0.12, 0, 0.15, 0.95, F * 1.1, 0.8, { noTop: true });
    g.noWin()
      .color(PAL.wood)
      .gable(0.12, 0.15, 0.95, 0.8, F * 1.1, 0.12, 'x', 0.03, wall);
    awning(g, 0.18, 0.9, 0.8, F * 1.1 - 0.01, 0.1, r.pick(PAL.awnings));
    // greenhouse
    g.color(0xdfe8ea).win(WIN.GLASS, 0.1, F);
    g.box(1.05, 0, 0.15, 1.88, F, 0.95, { noTop: true });
    g.noWin().color(0xa8ccd8).gable(1.05, 0.15, 1.88, 0.95, F, 0.16, 'z', 0.01, 0xc8dde4);
    // plant rows
    for (let i = 0; i < 4; i++) {
      const z = 1.05 + i * 0.1;
      g.color(r.pick(PAL.leaf)).box(0.2, 0, z, 1.0, 0.035, z + 0.05);
      g.color(r.pick(PAL.flower)).box(1.1, 0, z, 1.8, 0.03, z + 0.05);
    }
    parking(g, c, 0.1, 1.5, 1.9, 1.95, 4);
  } else {
    const wall = r.pick([0xd8cbb0, 0xe0d4bc, 0xc9bca4, 0xe8dcc4]);
    const h = F * 1.25;
    g.color(wall).win(WIN.SHOP, 0.2, h);
    g.box(0.1, 0, 0.15, 1.9, h, 0.75, { top: PAL.flatRoof });
    g.noWin();
    roofRim(g, 0.1, 0.15, 1.9, 0.75, h, PAL.flatRoof);
    const n = r.int(3, 5);
    const sw = 1.8 / n;
    for (let i = 0; i < n; i++) {
      const sx0 = 0.1 + i * sw;
      const col = r.pick(PAL.awnings);
      awning(g, sx0 + 0.03, sx0 + sw - 0.03, 0.75, h * 0.74, 0.09, col);
      g.color(col).box(sx0 + 0.08, h, 0.71, sx0 + sw - 0.08, h + 0.06, 0.75, { top: PAL.white });
    }
    parking(g, c, 0.1, 0.95, 1.9, 1.92, r.int(3, 6));
    g.color(PAL.steel).beam([1.85, 0, 1.85], [1.85, 0.45, 1.85], 0.025);
    g.color(r.pick(PAL.awnings)).box(1.76, 0.38, 1.82, 1.94, 0.5, 1.88, { top: PAL.white });
  }
};

/** 1x1 small office building or bank. */
const smallOffice: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.8, 0.96, 0.97, 0.012, PAL.sidewalk);
  if (c.name === 'Bank') {
    const stone = r.pick([0xeee6d6, 0xe6dcc6, 0xf2ecdf, 0xdcd4c4]);
    const top = r.int(2, 3) * F;
    block(g, 0.15, 0.15, 0.85, 0.66, 0, top, stone, PAL.flatRoof, WIN.CIVIC, 0.12);
    g.noWin().color(shade(stone, 0.9)).box(0.18, 0, 0.66, 0.82, 0.03, 0.84);
    g.color(stone);
    for (const x of [0.24, 0.39, 0.61, 0.76]) g.box(x - 0.02, 0.03, 0.75, x + 0.02, top - 0.04, 0.79, { noTop: true });
    g.box(0.17, top - 0.04, 0.66, 0.83, top, 0.82, { top: shade(stone, 0.95) });
    g.color(shade(stone, 0.85)).gable(0.17, 0.66, 0.83, 0.82, top, 0.09, 'z', 0.01, stone);
    frontQuad(g, 0.45, 0.55, 0.03, 0.14, 0.662, 0x4a3a2a);
  } else {
    const brick = c.name === 'Professional Building';
    const wall = brick ? r.pick(PAL.walls.brick) : r.pick(PAL.officeWalls);
    const top = (brick ? r.int(4, 5) : r.int(3, 4)) * F;
    g.color(shade(wall, 0.9)).win(WIN.SHOP, 0.2, F);
    g.box(0.15, 0, 0.18, 0.85, F, 0.8, { noTop: true });
    block(g, 0.15, 0.18, 0.85, 0.8, F, top, wall, PAL.flatRoof, WIN.OFFICE, brick ? 0.11 : 0.16);
    if (brick)
      g.noWin()
        .color(shade(wall, 0.72))
        .box(0.14, top - 0.02, 0.17, 0.86, top + 0.012, 0.81, { noTop: true });
    roofUnits(g, c, 0.15, 0.18, 0.85, 0.8, top, 2);
    g.noWin()
      .color(0x5a5e62)
      .box(0.4, F * 0.75, 0.8, 0.6, F * 0.82, 0.9);
    lotTree(g, c, 0.08, 0.9, 0.7);
  }
};

/** 2x2 offices: office block, hotel, glass offices. */
const office: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.name === 'Hotel') {
    const wall = r.pick([...PAL.walls.mid, 0xf0e6d2]);
    const floors = r.int(8, 11);
    const ph = F * 1.4;
    const top = ph + floors * F;
    g.rect(0.1, 1.55, 1.9, 1.96, 0.012, 0xd8d2c4);
    block(g, 0.15, 0.3, 1.85, 1.55, 0, ph, shade(wall, 0.9), PAL.flatRoof, WIN.SHOP, 0.22, ph);
    block(g, 0.3, 0.45, 1.7, 1.0, ph, top, wall, PAL.flatRoofDark, WIN.RES, 0.1);
    g.rect(1.0, 1.1, 1.6, 1.45, ph + 0.007, POOL);
    g.rect(0.95, 1.05, 1.65, 1.5, ph + 0.005, DECK);
    const sign = r.pick([PAL.red, 0xd4a017, 0x2a3f5f, 0x8e5bd6]);
    g.noWin()
      .color(sign)
      .box(0.55, top, 0.92, 1.45, top + 0.14, 0.97, { top: shade(sign, 0.8) });
    g.color(0x6a6e72).box(0.8, ph * 0.6, 1.55, 1.2, ph * 0.66, 1.78);
    g.color(PAL.steel);
    g.beam([0.83, 0, 1.75], [0.83, ph * 0.6, 1.75], 0.012);
    g.beam([1.17, 0, 1.75], [1.17, ph * 0.6, 1.75], 0.012);
    car(g, 1.45, 1.75, true, PAL.yellow);
    lotTree(g, c, 0.2, 1.8, 0.9);
  } else if (c.name === 'Glass Offices') {
    const a = r.pick(GLASS_WALLS);
    const b = r.pick(GLASS_WALLS);
    const t1 = r.int(7, 10) * F;
    const t2 = r.int(4, 6) * F;
    g.rect(0.06, 0.06, 1.94, 1.94, 0.012, 0xd8d2c4);
    block(g, 0.2, 0.2, 1.15, 1.15, 0, t1, a, GLASS_ROOF, WIN.GLASS, 0.12);
    block(g, 0.95, 0.95, 1.8, 1.8, 0, t2, b, GLASS_ROOF, WIN.GLASS, 0.12);
    roofUnits(g, c, 0.2, 0.2, 1.15, 1.15, t1, 2);
    g.rect(1.0, 1.0, 1.75, 1.75, t2 + 0.006, ROOF_GREEN);
    lotTree(g, c, 0.3, 1.6, 1.1);
    lotTree(g, c, 0.6, 1.75, 0.9);
    lotTree(g, c, 1.65, 0.35, 1.0);
  } else {
    const wall = r.pick(PAL.officeWalls);
    const top = r.int(5, 8) * F;
    block(g, 0.25, 0.2, 1.75, 1.35, 0, top, wall, PAL.flatRoof, WIN.OFFICE, 0.17);
    g.noWin()
      .color(shade(wall, 0.8))
      .box(0.7, top, 0.5, 1.3, top + 0.1, 0.95, { top: PAL.flatRoofDark });
    roofUnits(g, c, 0.25, 0.95, 1.75, 1.35, top, 2);
    g.color(0x5a5e62).box(0.85, F * 0.78, 1.35, 1.15, F * 0.85, 1.48);
    parking(g, c, 0.1, 1.55, 1.9, 1.96, 5);
    lotTree(g, c, 0.12, 0.25, 1.0);
  }
};

/** 3x3 shopping mall, department store, office park. */
const mall: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.name === 'Department Store') {
    const stone = r.pick([0xe6dcc6, 0xd8c9a8, 0xeee6d6, 0xc9b49a]);
    const brand = r.pick([PAL.red, 0x2a3f5f, 0x8e5bd6, 0xd4a017]);
    const top = F * 3.4;
    g.color(stone).win(WIN.SHOP, 0.22, F * 1.3);
    g.box(0.2, 0, 0.2, 1.85, F * 1.3, 1.5, { noTop: true });
    block(g, 0.2, 0.2, 1.85, 1.5, F * 1.3, top, stone, PAL.flatRoof, WIN.CIVIC, 0.14);
    g.noWin()
      .color(shade(stone, 0.75))
      .box(0.18, top - 0.02, 0.18, 1.87, top + 0.015, 1.52, { noTop: true });
    for (const ax of [0.3, 0.85, 1.4]) awning(g, ax, ax + 0.35, 1.5, F * 1.2, 0.09, brand);
    g.color(brand).box(0.7, top, 1.42, 1.35, top + 0.13, 1.48, { top: PAL.white });
    // parking garage with cars on the top deck
    const gh = F * 2.4;
    block(g, 2.0, 0.2, 2.85, 2.25, 0, gh, PAL.concrete, 0x8a8a86, WIN.OFFICE, 0.28, F * 0.8);
    g.push().translate(0, gh, 0);
    car(g, 2.2, 0.6, false, r.pick(PAL.cars));
    car(g, 2.4, 1.0, false, r.pick(PAL.cars));
    car(g, 2.65, 1.6, false, r.pick(PAL.cars));
    g.pop();
    // plaza
    g.rect(0.2, 1.6, 1.85, 2.9, 0.012, 0xd8d2c4);
    fountain(g, 1.0, 2.25, 0.1);
    lotTree(g, c, 0.4, 2.7, 1.0);
    lotTree(g, c, 1.65, 2.7, 1.0);
    lotTree(g, c, 1.65, 1.8, 0.9);
  } else if (c.name === 'Office Park') {
    const a = r.pick(GLASS_WALLS);
    const wall = r.pick(PAL.techWalls);
    block(g, 0.25, 0.25, 1.25, 1.0, 0, 3 * F, a, GLASS_ROOF, WIN.GLASS, 0.13);
    block(g, 1.6, 0.25, 2.75, 0.95, 0, 2 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.13);
    block(g, 1.75, 1.35, 2.75, 2.15, 0, 3 * F, wall, PAL.flatRoof, WIN.OFFICE, 0.15);
    pond(g, 0.45, 1.45, 1.4, 2.05);
    g.rect(1.4, 1.0, 1.5, 2.3, 0.012, PAL.sidewalk);
    g.rect(0.3, 1.15, 2.7, 1.25, 0.012, PAL.sidewalk);
    for (const [tx, tz] of [
      [0.3, 1.4],
      [1.55, 1.6],
      [1.6, 2.1],
      [0.5, 2.15],
      [2.85, 1.2],
      [1.4, 0.3],
    ])
      lotTree(g, c, tx, tz, 0.9 + r.next() * 0.4);
    parking(g, c, 0.2, 2.35, 2.8, 2.9, 6);
  } else {
    const wall = r.pick([0xe0d4bc, 0xd8cbb0, 0xe8e2d4, 0xcfc6b0]);
    const h = F * 1.5;
    g.noWin().color(wall).box(0.8, 0, 0.25, 2.2, h, 1.35, { top: PAL.flatRoof });
    roofRim(g, 0.8, 0.25, 2.2, 1.35, h, PAL.flatRoof);
    g.color(0x9cc4dc).gable(1.05, 0.45, 1.95, 1.1, h, 0.16, 'x', 0.01, 0xb8d4e4);
    for (const [ax0, ax1] of [
      [0.2, 0.8],
      [2.2, 2.8],
    ] as const) {
      const brand = r.pick(PAL.awnings);
      g.noWin()
        .color(shade(wall, 0.92))
        .box(ax0, 0, 0.15, ax1, F * 2.1, 1.45, { top: PAL.flatRoofDark });
      g.color(brand).box(ax0 + 0.1, F * 2.1 - 0.03, 1.42, ax1 - 0.1, F * 2.1 + 0.08, 1.47, { top: PAL.white });
    }
    g.color(PAL.glassBlue).win(WIN.GLASS, 0.1, F).box(1.3, 0, 1.35, 1.7, F, 1.45, { top: 0x6a6e72 });
    roofUnits(g, c, 0.8, 0.25, 2.2, 1.35, h, 2);
    parking(g, c, 0.15, 1.6, 2.85, 2.9, 9);
  }
};

/** 2x2 skyscraper: classic setback, art deco, glass. */
const skyscraper: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.04, 1.96, 1.96, 0.012, PAL.concrete);
  if (c.wealth === 1) {
    const stone = r.pick([0xd8c9a8, 0xe0d4bc, 0xcfc0a0, 0xc9b9a0]);
    const n = r.int(20, 28) * F;
    const top = tiers(
      g,
      1,
      1,
      0,
      [
        [0.72, 0.72, F * 2],
        [0.62, 0.62, n * 0.58],
        [0.5, 0.5, n * 0.78],
        [0.38, 0.38, n * 0.9],
        [0.27, 0.27, n],
      ],
      stone,
      PAL.flatRoof,
      WIN.OFFICE,
      0.09,
    );
    g.noWin().color(0xc0c4c8).pyramid(1, 1, 0.54, 0.54, top, 0.32);
    spire(g, 1, 1, top + 0.3, 0.5, 0.025);
    lotTree(g, c, 0.15, 0.15, 0.9);
    lotTree(g, c, 1.85, 1.85, 0.9);
  } else if (c.wealth === 2) {
    const a = r.pick(GLASS_WALLS);
    const b = r.pick(GLASS_WALLS);
    const n = r.int(22, 30) * F;
    block(g, 1.15, 1.15, 1.85, 1.85, 0, n * 0.4, b, GLASS_ROOF, WIN.GLASS, 0.12);
    block(g, 0.3, 0.35, 1.5, 1.55, 0, n, a, GLASS_ROOF, WIN.GLASS, 0.12);
    g.noWin().color(shade(a, 0.85)).shed(0.3, 0.35, 1.5, 1.55, n, 0.36, false);
    g.rect(1.2, 1.2, 1.8, 1.8, n * 0.4 + 0.006, ROOF_GREEN);
    g.color(0x6a6e72).box(0.7, F * 0.8, 1.55, 1.1, F * 0.87, 1.7);
    lotTree(g, c, 0.2, 1.8, 1.0);
    lotTree(g, c, 1.8, 0.2, 1.0);
  } else {
    const wall = r.pick(PAL.officeWalls);
    const n = r.int(18, 26) * F;
    const top = tiers(
      g,
      1,
      1,
      0,
      [
        [0.85, 0.85, F * 2],
        [0.65, 0.65, n * 0.7],
        [0.5, 0.5, n * 0.9],
        [0.35, 0.35, n],
      ],
      wall,
      PAL.flatRoof,
      WIN.OFFICE,
      0.15,
    );
    roofUnits(g, c, 0.35, 0.35, 1.65, 1.65, n * 0.7, 2);
    antenna(g, 1, 1, top, 0.55);
  }
};

/** 3x3 megatower: corporate, twin towers, spire tower. */
const megatower: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.04, 2.96, 2.96, 0.012, 0xd0cbc0);
  if (c.wealth === 1) {
    const wall = r.pick([0xc8ccd0, 0xd8d4cc, 0xb8bcc0]);
    const n = r.int(34, 40) * F;
    block(g, 0.3, 0.9, 2.7, 2.1, 0, 3 * F, shade(wall, 0.85), PAL.flatRoof, WIN.SHOP, 0.22, F * 1.5);
    for (const cx of [0.95, 2.05]) {
      const top = tiers(
        g,
        cx,
        1.5,
        3 * F,
        [
          [0.42, 0.42, n * 0.6],
          [0.34, 0.34, n * 0.82],
          [0.26, 0.26, n * 0.94],
          [0.17, 0.17, n],
        ],
        wall,
        0x9a9ea2,
        WIN.OFFICE,
        0.1,
      );
      spire(g, cx, 1.5, top, 0.9, 0.09, 0xd8dce0);
    }
    g.noWin()
      .color(0x8a8e92)
      .box(1.37, n * 0.42, 1.44, 1.63, n * 0.45, 1.56, { top: 0x9a9ea2 });
    g.beam([1.37, n * 0.33, 1.5], [1.5, n * 0.42, 1.5], 0.02);
    g.beam([1.63, n * 0.33, 1.5], [1.5, n * 0.42, 1.5], 0.02);
    lotTree(g, c, 0.25, 0.3, 1.1);
    lotTree(g, c, 2.75, 0.3, 1.1);
    lotTree(g, c, 0.25, 2.7, 1.1);
    lotTree(g, c, 2.75, 2.7, 1.1);
  } else if (c.wealth === 2) {
    const a = r.pick(GLASS_WALLS);
    const n = r.int(38, 45) * F;
    const top = tiers(
      g,
      1.5,
      1.5,
      0,
      [
        [0.78, 0.78, n * 0.35],
        [0.64, 0.64, n * 0.6],
        [0.52, 0.52, n * 0.8],
        [0.4, 0.4, n * 0.92],
        [0.28, 0.28, n],
      ],
      a,
      GLASS_ROOF,
      WIN.GLASS,
      0.12,
    );
    spire(g, 1.5, 1.5, top, 1.3, 0.06, 0xd8dce0);
    pond(g, 0.3, 2.3, 1.1, 2.7);
    for (const [tx, tz] of [
      [0.25, 0.25],
      [2.75, 0.25],
      [2.75, 2.75],
      [1.9, 2.75],
      [0.25, 1.5],
    ])
      lotTree(g, c, tx, tz, 1.1);
  } else {
    const wall = r.pick(PAL.officeWalls);
    const n = r.int(30, 36) * F;
    const top = tiers(
      g,
      1.5,
      1.5,
      0,
      [
        [1.35, 1.35, 3 * F],
        [1.05, 1.05, n * 0.6],
        [0.85, 0.85, n * 0.85],
        [0.65, 0.65, n],
      ],
      wall,
      PAL.flatRoof,
      WIN.OFFICE,
      0.15,
    );
    g.noWin()
      .color(0x4a5048)
      .cylinder(1.5, 1.5, 0.42, top, top + 0.025, 8, 0x5a6058);
    g.rect(1.36, 1.47, 1.64, 1.53, top + 0.03, PAL.white);
    g.rect(1.3, 1.3, 1.36, 1.7, top + 0.03, PAL.white);
    g.rect(1.64, 1.3, 1.7, 1.7, top + 0.03, PAL.white);
    antenna(g, 0.95, 0.95, top, 0.6);
    antenna(g, 2.05, 2.05, top, 0.45);
    roofUnits(g, c, 0.45, 0.45, 2.55, 2.55, n * 0.6, 3);
  }
};

// ================================================================ industrial

/** 1x1 workshop / small warehouse / machine shop. */
const workshop: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick(PAL.industrial);
  const roof = r.pick(PAL.industrialRoof);
  g.rect(0.04, 0.04, 0.96, 0.96, 0.012, PAL.gravel);
  if (c.wealth === 0) {
    const h = F * 1.3;
    g.color(wall).win(WIN.IND, 0.14, h);
    g.box(0.12, 0, 0.15, 0.68, h, 0.62, { noTop: true });
    g.noWin().color(roof).gable(0.12, 0.15, 0.68, 0.62, h, 0.07, 'x', 0.02, wall);
    frontQuad(g, 0.28, 0.5, 0, F * 0.95, 0.622, 0x6a6e72);
    if (r.chance(0.6)) chimney(g, 0.2, 0.25, h, 0.22, 0.025, 0x6a5a4a, 'smoke');
    crates(g, c, 0.72, 0.2, 0.9, 0.6, 3);
    barrels(g, c, 0.75, 0.72, 2);
    fence(g, 0.05, 0.05, 0.95, 0.95, 0.045, FENCE, false);
    car(g, 0.4, 0.82, true, r.pick(PAL.cars));
  } else {
    const h = F * 1.5;
    block(g, 0.1, 0.12, 0.9, 0.6, 0, h, wall, roof, WIN.IND, 0.18, h);
    frontQuad(g, 0.2, 0.42, 0, F, 0.602, 0x5a5e62);
    frontQuad(g, 0.55, 0.77, 0, F, 0.602, 0x5a5e62);
    g.noWin()
      .color(shade(roof, 0.9))
      .box(0.15, F * 1.05, 0.6, 0.85, F * 1.1, 0.68);
    truck(g, 0.31, 0.78, false, r.pick(PAL.cars));
    crates(g, c, 0.65, 0.72, 0.9, 0.92, 2);
  }
};

/** 1x1 clean tech: startup, software house, server farm. */
const techSmall: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.name === 'Server Farm') {
    g.rect(0.04, 0.04, 0.96, 0.96, 0.012, PAL.concrete);
    g.noWin().color(0xe6eaee);
    g.box(0.1, 0, 0.1, 0.9, F * 0.9, 0.42, { top: 0xc8ccd0 });
    g.box(0.1, 0, 0.5, 0.65, F * 0.9, 0.85, { top: 0xc8ccd0 });
    for (const [x, z] of [
      [0.25, 0.26],
      [0.5, 0.26],
      [0.75, 0.26],
      [0.3, 0.68],
    ])
      acUnit(g, x, z, F * 0.9, 1);
    block(g, 0.7, 0.55, 0.9, 0.85, 0, F, PAL.glassBlue, PAL.flatRoof, WIN.GLASS, 0.1);
    fence(g, 0.05, 0.05, 0.95, 0.95, 0.05, FENCE, false);
  } else {
    const floors = c.name === 'Software House' ? 3 : 2;
    const wall = r.pick(PAL.techWalls);
    const accent = r.pick([PAL.orange, PAL.green, PAL.blue, 0x2bb3a3, 0xe86a92]);
    const top = floors * F;
    g.rect(0.45, 0.7, 0.55, 0.97, 0.012, PAL.sidewalk);
    block(g, 0.15, 0.15, 0.85, 0.7, 0, top, wall, 0xd8dcdf, WIN.GLASS, 0.12);
    g.noWin()
      .color(accent)
      .box(0.13, 0, 0.6, 0.3, top + 0.02, 0.72, { top: shade(accent, 0.85) });
    g.rect(0.2, 0.2, 0.5, 0.45, top + 0.008, 0x2a3f6f);
    g.rect(0.55, 0.2, 0.8, 0.45, top + 0.008, ROOF_GREEN);
    lotTree(g, c, 0.85, 0.85, 0.8);
    car(g, 0.25, 0.85, true, r.pick(PAL.cars));
  }
};

/** 2x2 small factory or warehouse. */
const factorySmall: ModelFn = (g, c) => {
  const r = c.rng;
  const roof = r.pick(PAL.industrialRoof);
  if (c.wealth === 0) {
    const wall = r.pick(PAL.walls.brick);
    const h = F * 1.6;
    g.rect(0.05, 0.05, 1.95, 1.95, 0.012, PAL.gravel);
    g.color(wall).win(WIN.IND, 0.16, h);
    g.box(0.2, 0, 0.2, 1.35, h, 1.3, { noTop: true });
    sawtooth(g, 0.2, 0.2, 1.35, 1.3, h, 3, 0.16, roof);
    chimney(g, 1.6, 0.4, 0, 1.0, 0.07, shade(wall, 0.85), 'smoke');
    block(g, 1.45, 0.9, 1.85, 1.55, 0, 2 * F, r.pick(PAL.walls.low), PAL.flatRoof, WIN.OFFICE, 0.12);
    frontQuad(g, 0.5, 0.8, 0, F, 1.302, 0x5a5e62);
    crates(g, c, 0.25, 1.45, 1.25, 1.85, 5);
    barrels(g, c, 1.5, 1.7, 3);
    truck(g, 0.95, 1.68, true, r.pick(PAL.cars));
    fence(g, 0.06, 0.06, 1.94, 1.94, 0.05, FENCE, false);
  } else {
    const wall = r.pick(PAL.industrial);
    const h = F * 1.8;
    g.rect(0.05, 1.1, 1.95, 1.95, 0.012, PAL.asphalt);
    g.color(wall).win(WIN.IND, 0.2, h);
    g.box(0.15, 0, 0.15, 1.85, h, 1.1, { noTop: true });
    g.noWin().color(roof).gable(0.15, 0.15, 1.85, 1.1, h, 0.09, 'x', 0.02, wall);
    for (const dx of [0.35, 0.75, 1.15, 1.55]) frontQuad(g, dx - 0.12, dx + 0.12, 0, F * 0.9, 1.102, 0x4a4e52);
    g.color(shade(roof, 0.9)).box(0.2, F * 0.95, 1.1, 1.8, F, 1.2);
    truck(g, 0.35, 1.38, false, r.pick(PAL.cars));
    truck(g, 1.15, 1.38, false, r.pick(PAL.cars), r.pick([0xe8e8e4, 0x3f7fd6, 0xd6453d]));
    g.color(r.pick(PAL.awnings)).box(0.7, h - 0.12, 1.1, 1.3, h - 0.02, 1.12);
  }
};

/** 2x2 clean industry: research lab, electronics plant, biotech plant. */
const techLab: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick(PAL.techWalls);
  if (c.name === 'Electronics Plant') {
    block(g, 0.15, 0.2, 1.85, 1.15, 0, 2 * F, wall, 0xd8dcdf, WIN.IND, 0.18);
    g.noWin()
      .color(PAL.glassBlue)
      .box(0.14, F * 1.2, 0.19, 1.86, F * 1.45, 1.16, { noTop: true });
    block(g, 0.5, 1.15, 1.5, 1.5, 0, 3 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.12);
    roofUnits(g, c, 0.15, 0.2, 1.85, 1.15, 2 * F, 4);
    parking(g, c, 0.1, 1.62, 1.9, 1.95, 5);
    lotTree(g, c, 0.25, 1.35, 1.0);
    lotTree(g, c, 1.75, 1.35, 1.0);
  } else if (c.name === 'Biotech Plant') {
    block(g, 0.15, 0.15, 1.2, 1.1, 0, 3 * F, wall, 0xd8dcdf, WIN.GLASS, 0.13);
    for (const [tx, tz] of [
      [1.45, 0.35],
      [1.72, 0.35],
      [1.58, 0.66],
    ])
      tank(g, tx, tz, 0.11, 0.32, 0xf2f4f6);
    g.color(PAL.steel).beam([1.2, 0.2, 0.5], [1.58, 0.2, 0.5], 0.02);
    block(g, 1.3, 0.95, 1.85, 1.5, 0, F * 1.2, PAL.glassGreen, 0xb8d8c8, WIN.GLASS, 0.1);
    g.rect(0.2, 1.2, 1.2, 1.9, 0.012, shade(PAL.grass, 1.1));
    lotTree(g, c, 0.4, 1.5, 1.1);
    lotTree(g, c, 0.9, 1.7, 1.0);
    parking(g, c, 1.3, 1.6, 1.9, 1.95, 2, false);
  } else {
    block(g, 0.2, 0.25, 1.25, 0.95, 0, 2 * F, wall, 0xd8dcdf, WIN.GLASS, 0.13);
    block(g, 0.95, 0.85, 1.8, 1.55, 0, 3 * F, wall, 0xd8dcdf, WIN.OFFICE, 0.15);
    g.noWin()
      .color(PAL.steel)
      .beam([0.5, 2 * F, 0.5], [0.5, 2 * F + 0.12, 0.5], 0.02);
    g.color(PAL.white).cylinder(0.5, 0.5, 0.1, 2 * F + 0.12, 2 * F + 0.14, 8, 0xe8ecef);
    g.rect(0.3, 1.1, 0.9, 1.9, 0.012, shade(PAL.grass, 1.12));
    g.rect(1.3, 1.55, 1.4, 1.97, 0.012, PAL.sidewalk);
    lotTree(g, c, 0.45, 1.35, 1.1);
    lotTree(g, c, 0.75, 1.7, 1.0);
    pine(g, c, 1.75, 0.3, 1.1);
    parking(g, c, 1.45, 1.65, 1.9, 1.95, 2, false);
  }
};

/** 1x1 storage tanks, tank farm, grain silos. */
const tanks: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.04, 0.96, 0.96, 0.012, PAL.concrete);
  if (c.name === 'Grain Silo') {
    const col = r.pick([0xe8e4dc, 0xd8d0c0, 0xc8ccd0]);
    for (const [x, z] of [
      [0.28, 0.3],
      [0.52, 0.3],
      [0.28, 0.56],
      [0.52, 0.56],
    ]) {
      g.noWin()
        .color(col)
        .lathe(
          x,
          z,
          [
            [0.11, 0],
            [0.11, 0.52],
            [0, 0.6],
          ],
          8,
        );
    }
    g.color(shade(col, 0.85)).box(0.72, 0, 0.22, 0.88, 0.75, 0.42, { top: PAL.flatRoofDark });
    g.color(PAL.steel).beam([0.72, 0.7, 0.32], [0.4, 0.62, 0.43], 0.025);
    truck(g, 0.3, 0.82, true, r.pick(PAL.cars), 0xb89a5a);
  } else if (c.name === 'Tank Farm') {
    const col = r.pick([0xf2f2ee, 0xd8dce0, 0xe8e0c8]);
    tank(g, 0.4, 0.4, 0.3, 0.2, col, 0, 10);
    tank(g, 0.82, 0.22, 0.1, 0.18, shade(col, 0.95));
    tank(g, 0.82, 0.55, 0.1, 0.18, shade(col, 0.95));
    g.color(PAL.steel).beam([0.4, 0.04, 0.75], [0.85, 0.04, 0.75], 0.02);
    g.beam([0.82, 0.04, 0.32], [0.82, 0.04, 0.75], 0.02);
    g.noWin().color(0x9a958c).box(0.15, 0, 0.78, 0.35, 0.08, 0.92);
  } else {
    const col = r.pick([0xf2f2ee, 0xd8dce0, 0xe8e0c8, 0xc8d0d8]);
    tank(g, 0.3, 0.3, 0.17, 0.3, col);
    tank(g, 0.7, 0.3, 0.13, 0.24, shade(col, 0.94));
    tank(g, 0.45, 0.72, 0.15, 0.28, shade(col, 0.97));
    g.color(PAL.steel).beam([0.3, 0.05, 0.3], [0.7, 0.05, 0.3], 0.018);
    g.beam([0.45, 0.05, 0.72], [0.3, 0.05, 0.3], 0.018);
    g.noWin().color(0x9a958c).box(0.72, 0, 0.62, 0.9, 0.09, 0.85, { top: PAL.flatRoofDark });
  }
};

/** 2x2 factory (saw-tooth + striped chimney) or assembly plant. */
const factory: ModelFn = (g, c) => {
  const r = c.rng;
  const roof = r.pick(PAL.industrialRoof);
  g.rect(0.05, 0.05, 1.95, 1.95, 0.012, PAL.gravel);
  if (c.wealth === 0) {
    const wall = r.pick(PAL.walls.brick);
    const h = F * 1.8;
    g.color(wall).win(WIN.IND, 0.16, h);
    g.box(0.15, 0, 0.2, 1.45, h, 1.4, { noTop: true });
    sawtooth(g, 0.15, 0.2, 1.45, 1.4, h, 4, 0.15, roof);
    chimney(g, 1.68, 0.42, 0, 1.25, 0.08, 0xc8c0b8, 'dark', true);
    block(g, 1.5, 0.9, 1.9, 1.5, 0, F * 2, shade(wall, 0.9), PAL.flatRoofDark, WIN.IND, 0.14);
    frontQuad(g, 0.55, 0.9, 0, F * 1.1, 1.402, 0x5a5e62);
    g.noWin().color(0x4a4a4a).pyramid(0.35, 1.7, 0.3, 0.3, 0, 0.12);
    g.color(0x8a8070).pyramid(0.7, 1.72, 0.28, 0.26, 0, 0.1);
    crates(g, c, 1.0, 1.55, 1.4, 1.85, 3);
    truck(g, 1.55, 1.75, true, r.pick(PAL.cars));
  } else {
    const wall = r.pick(PAL.industrial);
    const h = F * 1.6;
    block(g, 0.15, 0.15, 1.85, 1.25, 0, h, wall, roof, WIN.IND, 0.2, h);
    for (const sx of [0.4, 0.9, 1.4]) g.rect(sx, 0.3, sx + 0.25, 1.1, h + 0.006, 0x9cc4dc);
    roofUnits(g, c, 0.15, 0.15, 1.85, 1.25, h, 2);
    g.emitter(1.7, h + 0.05, 0.3, 'steam');
    g.noWin()
      .color(PAL.steel)
      .cylinder(1.7, 0.3, 0.03, h, h + 0.08, 6);
    block(g, 0.25, 1.25, 0.95, 1.6, 0, 2 * F, r.pick(PAL.officeWalls), PAL.flatRoof, WIN.OFFICE, 0.15);
    for (const dx of [1.2, 1.55]) frontQuad(g, dx - 0.12, dx + 0.12, 0, F * 0.9, 1.252, 0x4a4e52);
    truck(g, 1.2, 1.52, false, r.pick(PAL.cars));
    truck(g, 1.55, 1.52, false, r.pick(PAL.cars));
  }
};

/** 3x3 heavy factory, distribution center, auto plant. */
const factoryBig: ModelFn = (g, c) => {
  const r = c.rng;
  const roof = r.pick(PAL.industrialRoof);
  if (c.name === 'Distribution Center') {
    const wall = r.pick(PAL.industrial);
    const h = F * 2.1;
    g.rect(0.05, 1.6, 2.95, 2.95, 0.012, PAL.asphalt);
    block(g, 0.15, 0.15, 2.85, 1.6, 0, h, wall, roof, WIN.IND, 0.3, h);
    for (const sx of [0.4, 1.0, 1.6, 2.2]) g.rect(sx, 0.35, sx + 0.3, 1.4, h + 0.006, 0x9cc4dc);
    for (let i = 0; i < 8; i++) frontQuad(g, 0.3 + i * 0.32, 0.5 + i * 0.32, 0, F * 0.9, 1.602, 0x3f4347);
    const colors = [0xe8e8e4, 0x3f7fd6, 0xd6453d, 0xe8e8e4, 0x4caf50];
    for (let i = 0; i < 5; i++) if (r.chance(0.8)) truck(g, 0.4 + i * 0.64, 1.88, false, r.pick(PAL.cars), colors[i]);
    for (let i = 0; i < 9; i++) g.rect(0.2 + i * 0.3, 2.25, 0.21 + i * 0.3, 2.45, 0.015, PAL.laneWhite);
    block(g, 2.35, 2.45, 2.85, 2.9, 0, 2 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.12);
    parking(g, c, 0.15, 2.55, 2.2, 2.9, 5, false);
  } else if (c.name === 'Auto Plant') {
    const wall = r.pick(PAL.industrial);
    g.rect(0.05, 0.05, 2.95, 2.95, 0.012, PAL.gravel);
    block(g, 0.15, 0.15, 1.9, 1.5, 0, F * 2, wall, roof, WIN.IND, 0.22, F * 2);
    for (const sx of [0.35, 0.85, 1.35]) g.rect(sx, 0.3, sx + 0.3, 1.35, F * 2 + 0.006, 0x9cc4dc);
    block(g, 2.0, 0.15, 2.85, 1.1, 0, F * 2.6, shade(wall, 0.92), PAL.flatRoofDark, WIN.IND, 0.2);
    chimney(g, 2.65, 0.35, F * 2.6, 0.35, 0.04, PAL.steel, 'steam');
    block(g, 2.0, 1.2, 2.85, 1.55, 0, 2 * F, r.pick(PAL.officeWalls), PAL.flatRoof, WIN.OFFICE, 0.14);
    g.rect(0.15, 1.75, 2.85, 2.85, 0.013, PAL.asphalt);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 7; i++) {
        if (r.chance(0.85)) car(g, 0.35 + i * 0.36, 1.9 + row * 0.33, true, r.pick(PAL.cars));
      }
    }
  } else {
    const wall = r.pick(PAL.walls.brick);
    const h = F * 2.2;
    g.rect(0.05, 0.05, 2.95, 2.95, 0.012, PAL.gravel);
    g.color(wall).win(WIN.IND, 0.18, h);
    g.box(0.2, 0, 0.2, 2.0, h, 1.9, { noTop: true });
    sawtooth(g, 0.2, 0.2, 2.0, 1.9, h, 5, 0.17, roof);
    block(g, 2.15, 0.2, 2.85, 1.3, 0, F * 2.8, shade(wall, 0.88), PAL.flatRoofDark, WIN.IND, 0.16);
    chimney(g, 2.3, 1.6, 0, 1.45, 0.09, 0xb8b0a8, 'dark', true);
    chimney(g, 2.65, 1.6, 0, 1.2, 0.08, 0xb8b0a8, 'smoke', true);
    if (r.chance(0.5)) chimney(g, 2.5, 1.95, 0, 1.0, 0.07, 0x8a8078, 'dark');
    g.noWin().color(0x3a3a3a).pyramid(0.45, 2.45, 0.5, 0.5, 0, 0.2);
    g.color(0x8a8070).pyramid(1.1, 2.5, 0.45, 0.4, 0, 0.16);
    g.color(PAL.steel).beam([0.6, 0.08, 2.4], [1.2, h, 1.85], 0.03);
    truck(g, 1.8, 2.3, true, r.pick(PAL.cars));
    truck(g, 2.4, 2.65, true, r.pick(PAL.cars));
    fence(g, 0.06, 0.06, 2.94, 2.94, 0.05, FENCE, false);
  }
};

/** 3x3 tech campus or headquarters. */
const techCampus: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick(PAL.techWalls);
  if (c.name === 'Tech Headquarters') {
    const a = r.pick(GLASS_WALLS);
    g.rect(0.06, 0.06, 2.94, 1.75, 0.01, 0xd8d2c4);
    const top = r.int(8, 10) * F;
    block(g, 1.0, 0.4, 2.0, 1.4, 0, top, a, GLASS_ROOF, WIN.GLASS, 0.12);
    g.noWin()
      .color(r.pick([PAL.orange, PAL.green, PAL.blue, 0xe86a92]))
      .box(1.3, top, 1.38, 1.7, top + 0.12, 1.42);
    block(g, 0.2, 0.3, 0.95, 1.6, 0, 3 * F, wall, 0xd8dcdf, WIN.OFFICE, 0.15);
    block(g, 2.05, 0.3, 2.8, 1.6, 0, 3 * F, wall, 0xd8dcdf, WIN.OFFICE, 0.15);
    g.rect(0.25, 0.35, 0.9, 1.55, 3 * F + 0.006, ROOF_GREEN);
    pond(g, 0.5, 1.95, 1.4, 2.6);
    g.rect(1.45, 1.4, 1.55, 2.95, 0.012, PAL.sidewalk);
    for (const [tx, tz] of [
      [1.8, 2.0],
      [2.3, 2.3],
      [2.7, 2.0],
      [2.0, 2.7],
      [0.3, 2.75],
      [0.35, 1.85],
    ])
      lotTree(g, c, tx, tz, 1.0 + r.next() * 0.3);
  } else {
    block(g, 0.2, 0.2, 1.3, 0.9, 0, 3 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.12);
    block(g, 1.7, 0.2, 2.8, 1.0, 0, 4 * F, wall, 0xd8dcdf, WIN.OFFICE, 0.15);
    block(g, 0.2, 1.5, 1.0, 2.6, 0, 2 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.12);
    block(g, 2.0, 1.7, 2.8, 2.7, 0, 3 * F, wall, 0xd8dcdf, WIN.GLASS, 0.14);
    g.rect(0.25, 1.55, 0.95, 2.55, 2 * F + 0.006, ROOF_GREEN);
    g.rect(1.1, 1.1, 1.9, 1.9, 0.01, shade(PAL.grass, 1.12));
    pond(g, 1.25, 1.3, 1.75, 1.7);
    g.rect(1.45, 0.9, 1.55, 2.95, 0.012, PAL.sidewalk);
    g.rect(0.2, 1.2, 2.8, 1.28, 0.012, PAL.sidewalk);
    for (const [tx, tz] of [
      [1.2, 2.2],
      [1.8, 2.3],
      [1.15, 0.3],
      [1.55, 0.6],
      [2.6, 1.35],
      [0.4, 2.8],
    ])
      lotTree(g, c, tx, tz, 1.0 + r.next() * 0.3);
    car(g, 1.75, 2.75, true, r.pick(PAL.cars));
  }
};

/** 2x2 chemical plant or steel mill. */
const heavyPlant: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.05, 0.05, 1.95, 1.95, 0.012, PAL.concrete);
  if (c.name === 'Steel Mill') {
    const rust = r.pick([0x6a4a3a, 0x5a4a42, 0x7a5040]);
    const wall = r.pick(PAL.industrial);
    const h = F * 2.4;
    g.color(wall).win(WIN.IND, 0.2, h);
    g.box(0.15, 0, 0.15, 1.15, h, 1.85, { noTop: true });
    g.noWin().color(r.pick(PAL.industrialRoof)).shed(0.15, 0.15, 1.15, 1.85, h, 0.15, false);
    g.color(rust).lathe(
      1.55,
      0.55,
      [
        [0.2, 0],
        [0.22, 0.25],
        [0.15, 0.7],
        [0.1, 0.85],
        [0.1, 1.0],
      ],
      8,
    );
    g.emitter(1.55, 1.05, 0.55, 'dark');
    for (const [sx, sz] of [
      [1.35, 1.25],
      [1.6, 1.25],
      [1.85, 1.25],
    ]) {
      g.color(0x8a8078).lathe(
        sx,
        sz,
        [
          [0.085, 0],
          [0.085, 0.7],
          [0, 0.78],
        ],
        8,
      );
    }
    g.color(PAL.steel).beam([1.55, 0.95, 0.55], [1.6, 0.7, 1.25], 0.03);
    g.beam([1.0, 0.05, 1.9], [1.45, 0.85, 0.65], 0.04);
    chimney(g, 1.85, 0.25, 0, 1.15, 0.06, 0x8a8078, 'dark');
    g.color(0x4a4a4a).pyramid(1.5, 1.72, 0.35, 0.3, 0, 0.12);
  } else {
    const white = 0xf2f2ee;
    for (const [sx, sz] of [
      [0.42, 0.42],
      [0.42, 0.95],
    ]) {
      g.noWin().color(PAL.steel);
      for (const [lx, lz] of [
        [-0.1, -0.1],
        [0.1, -0.1],
        [-0.1, 0.1],
        [0.1, 0.1],
      ])
        g.box(sx + lx - 0.012, 0, sz + lz - 0.012, sx + lx + 0.012, 0.12, sz + lz + 0.012, { noTop: true });
      g.color(white).sphere(sx, 0.27, sz, 0.17, 0);
    }
    g.color(0xd8dce0).cylinder(1.2, 0.45, 0.07, 0, 1.0, 6);
    g.color(PAL.steel).cylinder(1.2, 0.45, 0.1, 0.45, 0.47, 6);
    g.cylinder(1.2, 0.45, 0.1, 0.75, 0.77, 6);
    g.color(0xd8dce0).cylinder(1.45, 0.75, 0.055, 0, 0.75, 6);
    g.emitter(1.2, 1.03, 0.45, 'steam');
    tank(g, 1.6, 0.35, 0.12, 0.22, 0xe8e0c8);
    g.color(PAL.steel);
    g.beam([0.3, 0.16, 1.3], [1.8, 0.16, 1.3], 0.025);
    g.beam([0.3, 0.2, 1.36], [1.8, 0.2, 1.36], 0.025);
    g.beam([1.2, 0.16, 0.45], [1.2, 0.16, 1.3], 0.025);
    chimney(g, 1.82, 0.9, 0, 1.2, 0.03, 0x9a9ea2, 'dark');
    block(g, 1.3, 1.5, 1.85, 1.88, 0, 2 * F, r.pick(PAL.industrial), PAL.flatRoof, WIN.OFFICE, 0.13);
    barrels(g, c, 0.3, 1.6, 4);
    fence(g, 0.06, 0.06, 1.94, 1.94, 0.05, FENCE, false);
  }
};

/** 3x3 oil refinery: columns, tank farm, flare stack, pipe racks. */
const refinery: ModelFn = (g, c) => {
  const r = c.rng;
  const tankCol = r.pick([0xf2f2ee, 0xd8dce0, 0xe8e0c8]);
  g.rect(0.05, 0.05, 2.95, 2.95, 0.012, PAL.concrete);
  for (const [tx, tz] of [
    [0.5, 2.45],
    [1.2, 2.45],
    [0.5, 1.75],
    [1.2, 1.75],
  ])
    tank(g, tx, tz, 0.28, 0.22, tankCol, 0, 10);
  for (const [cx, cz, cr, ch] of [
    [2.0, 0.6, 0.1, 1.35],
    [2.35, 0.55, 0.08, 1.05],
    [2.6, 0.95, 0.07, 0.85],
  ] as const) {
    g.noWin().color(0xd8dce0).cylinder(cx, cz, cr, 0, ch, 6);
    g.color(PAL.steel).cylinder(cx, cz, cr + 0.03, ch * 0.45, ch * 0.45 + 0.02, 6);
    g.cylinder(cx, cz, cr + 0.03, ch * 0.75, ch * 0.75 + 0.02, 6);
    g.emitter(cx, ch + 0.03, cz, 'steam');
  }
  // process unit frame
  g.noWin().color(0xb8a088).box(1.6, 0, 1.15, 2.5, 0.22, 1.6, { top: 0x9a8a78 });
  g.color(0xd8dce0).cylinderX(1.65, 2.45, 0.32, 1.38, 0.07, 6);
  // flare stack
  chimney(g, 0.3, 0.35, 0, 1.6, 0.035, 0xc84a3a, 'dark');
  // pipe racks
  g.color(PAL.steel);
  g.beam([0.5, 0.18, 1.35], [2.6, 0.18, 1.35], 0.03);
  g.beam([0.5, 0.24, 1.42], [2.6, 0.24, 1.42], 0.03);
  g.beam([2.0, 0.18, 0.7], [2.0, 0.18, 1.35], 0.03);
  g.beam([0.85, 0.18, 1.35], [0.85, 0.18, 2.1], 0.03);
  block(g, 2.2, 2.2, 2.85, 2.8, 0, 2 * F, r.pick(PAL.industrial), PAL.flatRoof, WIN.OFFICE, 0.13);
  g.noWin().color(0x8a8f94).box(0.7, 0, 0.4, 1.3, 0.12, 0.9, { top: 0x6a6f74 });
  for (const ux of [0.85, 1.15]) g.color(0x5a6068).cylinder(ux, 0.65, 0.09, 0.12, 0.2, 8, 0x3a3f44);
  fence(g, 0.06, 0.06, 2.94, 2.94, 0.05, FENCE, false);
  truck(g, 2.3, 1.9, true, r.pick(PAL.cars), mixHex(tankCol, 0xd6453d, 0.15));
};

export const GROWABLE_MODELS: Record<string, ModelFn> = {
  house,
  mansion,
  townhouse,
  apartments,
  apt_complex: aptComplex,
  slim_tower: slimTower,
  res_tower: resTower,
  res_megatower: resMegatower,
  shop,
  gas_station: gasStation,
  strip_mall: stripMall,
  small_office: smallOffice,
  office,
  mall,
  skyscraper,
  megatower,
  workshop,
  tech_small: techSmall,
  factory_small: factorySmall,
  tech_lab: techLab,
  tanks,
  factory,
  factory_big: factoryBig,
  tech_campus: techCampus,
  heavy_plant: heavyPlant,
  refinery,
};

// Exported for reuse by other model files.
export { lotTree, pine };
