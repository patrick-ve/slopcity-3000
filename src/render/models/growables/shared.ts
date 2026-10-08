/** Shared helpers, colours and props for the growable (zone-developed) building models. */
import { type Emitter, FLOOR, type GeometryBuilder, shade, WIN } from '../../geom';
import { PAL } from '../../palette';
import type { ModelCtx } from '../types';

type G = GeometryBuilder;
export const F = FLOOR;

export const GLASS_WALLS = [PAL.glassBlue, PAL.glassTeal, PAL.glassDark, PAL.glassGreen];
export const GLASS_ROOF = 0x8e959c;
export const POOL = 0x4fc3e8;
export const DECK = 0xe8e0d0;
export const ROOF_GREEN = 0x8fbf5a;
export const DOOR = 0x3b2f28;
export const FENCE = 0x8a8f94;

// =================================================================== helpers

/** Perceived brightness 0..255 of an sRGB hex colour. */
export function lum(hex: number): number {
  return ((hex >> 16) & 255) * 0.3 + ((hex >> 8) & 255) * 0.59 + (hex & 255) * 0.11;
}

/** Small round tree used as lot decoration. */
export function lotTree(g: G, c: ModelCtx, x: number, z: number, s = 1): void {
  g.noWin().color(PAL.trunk);
  g.box(x - 0.014 * s, 0, z - 0.014 * s, x + 0.014 * s, 0.08 * s, z + 0.014 * s, { noTop: true });
  g.color(c.rng.pick(PAL.leaf));
  g.sphere(x, 0.14 * s, z, 0.075 * s, 0, 1.15);
}

/** Conifer used as lot decoration. */
export function pine(g: G, c: ModelCtx, x: number, z: number, s = 1): void {
  g.noWin().color(PAL.trunk);
  g.box(x - 0.012 * s, 0, z - 0.012 * s, x + 0.012 * s, 0.05 * s, z + 0.012 * s, { noTop: true });
  g.color(c.rng.pick(PAL.conifer));
  g.cone(x, z, 0.075 * s, 0.04 * s, 0.24 * s, 6);
  g.cone(x, z, 0.055 * s, 0.14 * s, 0.33 * s, 6);
}

/** Tree standing on a raised surface (roof garden, podium). */
export function roofTree(g: G, c: ModelCtx, x: number, z: number, y: number, s = 0.65): void {
  g.push().translate(0, y, 0);
  lotTree(g, c, x, z, s);
  g.pop();
}

/** Vertical quad on a +z facing facade (doors, garage doors, signs). */
export function frontQuad(g: G, x0: number, x1: number, y0: number, y1: number, z: number, hex: number): void {
  g.noWin().color(hex);
  g.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]);
}

/** Darker inset on a flat roof that reads as a parapet. */
export function roofRim(g: G, x0: number, z0: number, x1: number, z1: number, y: number, roof: number): void {
  const i = Math.min(0.035, (x1 - x0) * 0.12, (z1 - z0) * 0.12);
  g.rect(x0 + i, z0 + i, x1 - i, z1 - i, y + 0.003, shade(roof, 0.84));
}

/** Windowed box with a flat roof (+ parapet inset). */
export function block(
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

export function acUnit(g: G, x: number, z: number, y: number, s = 1): void {
  g.noWin().color(0xc4c8cc);
  g.box(x - 0.04 * s, y, z - 0.03 * s, x + 0.04 * s, y + 0.035 * s, z + 0.03 * s, { top: 0xa4a8ac });
}

export function roofUnits(g: G, c: ModelCtx, x0: number, z0: number, x1: number, z1: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.08 + c.rng.next() * Math.max(0, x1 - x0 - 0.16);
    const z = z0 + 0.08 + c.rng.next() * Math.max(0, z1 - z0 - 0.16);
    acUnit(g, x, z, y, 0.8 + c.rng.next() * 0.6);
  }
}

/** Classic wooden rooftop water tank. */
export function waterTank(g: G, x: number, z: number, y: number, s = 1): void {
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

export function car(g: G, x: number, z: number, alongX: boolean, hex: number): void {
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
export function truck(g: G, x: number, z: number, alongX: boolean, cab: number, trailer = 0xe8e8e4): void {
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
export function parking(g: G, c: ModelCtx, x0: number, z0: number, x1: number, z1: number, cars: number, lines = true): void {
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
export function awning(g: G, x0: number, x1: number, z: number, y: number, depth: number, hex: number): void {
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
export function fence(g: G, x0: number, z0: number, x1: number, z1: number, h: number, hex: number, front = true): void {
  g.noWin().color(hex);
  g.panel([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]);
  g.panel([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]);
  g.panel([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]);
  if (front) g.panel([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]);
}

export function hedge(g: G, x0: number, z0: number, x1: number, z1: number, h = 0.05): void {
  g.noWin()
    .color(PAL.hedge)
    .box(x0, 0, z0, x1, h, z1, { top: shade(PAL.hedge, 1.15) });
}

/** Tapered chimney with optional red band and smoke emitter. */
export function chimney(
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
export function tank(g: G, x: number, z: number, r: number, h: number, hex: number, y0 = 0, segs = 8): void {
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
export function sawtooth(g: G, x0: number, z0: number, x1: number, z1: number, y: number, teeth: number, ht: number, roof: number): void {
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
export function bands(
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

export function crates(g: G, c: ModelCtx, x0: number, z0: number, x1: number, z1: number, n: number): void {
  g.noWin();
  for (let i = 0; i < n; i++) {
    const x = x0 + c.rng.next() * (x1 - x0);
    const z = z0 + c.rng.next() * (z1 - z0);
    const s = 0.022 + c.rng.next() * 0.02;
    g.color(c.rng.pick([0x9a7a52, 0x8a6a42, 0x6f8a9a, 0xa05a3a, 0x5f7f5a])).box(x - s, 0, z - s, x + s, s * 1.6, z + s);
  }
}

export function barrels(g: G, c: ModelCtx, x: number, z: number, n: number): void {
  g.noWin();
  for (let i = 0; i < n; i++) {
    g.color(c.rng.pick([0x3f7fd6, 0xd6453d, 0x4caf50, 0xe8b33a])).cylinder(x + i * 0.035, z + (i % 2) * 0.03, 0.015, 0, 0.045, 6);
  }
}

export function antenna(g: G, x: number, z: number, y: number, h: number): void {
  g.noWin()
    .color(0x9aa0a6)
    .beam([x, y, z], [x, y + h, z], 0.014);
}

export function spire(g: G, x: number, z: number, y: number, h: number, r = 0.04, hex = 0xc8ccd0): void {
  g.noWin()
    .color(hex)
    .cone(x, z, r, y, y + h, 4, Math.PI / 4);
}

/** Stack of centred tiers (setback tower). Returns the top height. */
export function tiers(
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

export function pond(g: G, x0: number, z0: number, x1: number, z1: number): void {
  g.rect(x0 - 0.03, z0 - 0.03, x1 + 0.03, z1 + 0.03, 0.013, 0xcfc6a8);
  g.rect(x0, z0, x1, z1, 0.015, 0x4fa9d8);
}

export function fountain(g: G, x: number, z: number, r = 0.075): void {
  g.noWin().color(0xd8d4cc).cylinder(x, z, r, 0, 0.03, 8, 0x6fc3e8);
  g.color(0xd8d4cc).cylinder(x, z, r * 0.24, 0.03, 0.09, 6);
}
