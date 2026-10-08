/**
 * Procedural low-poly models for player-placed ("ploppable") buildings:
 * transport, utilities, civic services, parks and rewards.
 *
 * Conventions: footprint x∈[0,w], z∈[0,h], ground at y=0, front faces +z.
 * Shore buildings (seaport, marina, desalination) put their water side on +z.
 */
import { FLOOR, WIN, mixHex, shade, type GeometryBuilder, type V3 } from '../geom';
import { PAL } from '../palette';
import type { Rng } from '../../util/rng';
import type { ModelFn } from './types';

type G = GeometryBuilder;
type P2 = [number, number];

const STONE = 0xe8e0cc;
const STONE_DARK = 0xc8bea8;
const COPPER = 0x6fae9a;
const GOLD = 0xd9b44a;
const WATER = 0x4aa8d0;
const GRASS = 0x86bd52;
const PATH = 0xd9cfb4;
const WHITE = 0xf4f4ef;
const ASPHALT = PAL.asphalt;
const GLASS_TINT = 0x5f8fb0;

// ------------------------------------------------------------------ helpers

/** Flat decal that tolerates swapped corners. */
function deck(g: G, x0: number, z0: number, x1: number, z1: number, y: number, hex: number): void {
  g.rect(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y, hex);
}

/** Extruded convex polygon given as an outline in the xz plane. */
function prism(g: G, pts: P2[], y0: number, y1: number, topHex?: number): void {
  const n = pts.length;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of pts) {
    cx += x;
    cz += z;
  }
  cx /= n;
  cz /= n;
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % n];
    g.face(
      [
        [ax, y0, az],
        [bx, y0, bz],
        [bx, y1, bz],
        [ax, y1, az],
      ],
      [(ax + bx) / 2 - cx, 0, (az + bz) / 2 - cz],
    );
  }
  g.push();
  if (topHex !== undefined) g.color(topHex);
  g.face(
    pts.map(([x, z]) => [x, y1, z] as V3),
    [0, 1, 0],
  );
  g.pop();
}

/** Organic flat blob (pond, lawn, pool) as a triangle fan from its centre. */
function blob(g: G, r: Rng, cx: number, cz: number, rx: number, rz: number, y: number, hex: number, n = 10, jitter = 0.18): void {
  g.push().noWin().color(hex);
  const pts: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - jitter / 2 + r.next() * jitter;
    pts.push([cx + Math.cos(a) * rx * k, y, cz + Math.sin(a) * rz * k]);
  }
  for (let i = 0; i < n; i++) g.face([[cx, y, cz], pts[i], pts[(i + 1) % n]], [0, 1, 0]);
  g.pop();
}

function tree(g: G, r: Rng, x: number, z: number, s = 1): void {
  g.noWin().color(PAL.trunk);
  g.box(x - 0.016 * s, 0, z - 0.016 * s, x + 0.016 * s, 0.09 * s, z + 0.016 * s, { noTop: true });
  g.color(r.pick(PAL.leaf));
  g.sphere(x, 0.155 * s, z, 0.085 * s, 0, 1.05);
}

function pine(g: G, r: Rng, x: number, z: number, s = 1): void {
  g.noWin().color(PAL.trunk);
  g.box(x - 0.014 * s, 0, z - 0.014 * s, x + 0.014 * s, 0.06 * s, z + 0.014 * s, { noTop: true });
  g.color(r.pick(PAL.conifer));
  g.cone(x, z, 0.085 * s, 0.05 * s, 0.22 * s, 6, r.next() * 3);
  g.cone(x, z, 0.06 * s, 0.15 * s, 0.32 * s, 6, r.next() * 3);
}

/** Random round or conifer tree. */
function anyTree(g: G, r: Rng, x: number, z: number, s = 1): void {
  if (r.chance(0.7)) tree(g, r, x, z, s);
  else pine(g, r, x, z, s);
}

function bush(g: G, r: Rng, x: number, z: number, s = 1, hex?: number): void {
  g.noWin().color(hex ?? r.pick(PAL.leaf));
  g.sphere(x, 0.022 * s, z, 0.045 * s, 0, 0.7);
}

function palm(g: G, r: Rng, x: number, z: number, s = 1): void {
  g.noWin().color(0x8a6a48);
  g.beam([x, 0, z], [x + 0.03 * s, 0.28 * s, z], 0.025 * s);
  g.color(r.pick([0x4f9a3c, 0x5fae45, 0x3f8a36]));
  g.lathe(x + 0.03 * s, z, [
    [0.15 * s, 0.24 * s],
    [0, 0.31 * s],
  ], 6, r.next() * 3);
}

function car(g: G, x: number, z: number, hex: number, alongX = true, len = 0.2): void {
  g.noWin();
  const hl = len / 2;
  const hw = len * 0.23;
  const hx = alongX ? hl : hw;
  const hz = alongX ? hw : hl;
  g.color(hex).box(x - hx, 0.012, z - hz, x + hx, 0.052, z + hz);
  const cx = alongX ? hl * 0.55 : hw * 0.85;
  const cz = alongX ? hw * 0.85 : hl * 0.55;
  g.color(0x2e3a48).box(x - cx, 0.052, z - cz, x + cx, 0.08, z + cz, { top: hex });
}

function policeCar(g: G, x: number, z: number, alongX = true): void {
  car(g, x, z, 0xf4f4f4, alongX);
  g.color(PAL.red).box(x - 0.022, 0.08, z - 0.012, x, 0.092, z + 0.012);
  g.color(PAL.blue).box(x, 0.08, z - 0.012, x + 0.022, 0.092, z + 0.012);
}

/** Truck/bus: body + cab at the "forward" (+axis) end. */
function truck(g: G, x: number, z: number, body: number, cab: number, alongX = true, len = 0.3, h = 0.09): void {
  g.noWin();
  const hl = len / 2;
  const hw = 0.055;
  if (alongX) {
    g.color(body).box(x - hl, 0.015, z - hw, x + hl * 0.45, h, z + hw);
    g.color(cab).box(x + hl * 0.45, 0.015, z - hw, x + hl, h * 0.82, z + hw, { top: cab });
  } else {
    g.color(body).box(x - hw, 0.015, z - hl, x + hw, h, z + hl * 0.45);
    g.color(cab).box(x - hw, 0.015, z + hl * 0.45, x + hw, h * 0.82, z + hl, { top: cab });
  }
}

function bench(g: G, x: number, z: number, alongX = true): void {
  g.noWin().color(PAL.wood);
  if (alongX) g.box(x - 0.05, 0.016, z - 0.012, x + 0.05, 0.028, z + 0.012);
  else g.box(x - 0.012, 0.016, z - 0.05, x + 0.012, 0.028, z + 0.05);
}

/** Street lamp; the head uses a window style so it glows at night. */
function lamp(g: G, x: number, z: number, h = 0.2): void {
  g.noWin().color(PAL.steelDark);
  g.box(x - 0.007, 0, z - 0.007, x + 0.007, h, z + 0.007, { noTop: true });
  g.color(0xfff0c0);
  g.box(x - 0.018, h, z - 0.018, x + 0.018, h + 0.024, z + 0.018, { win: WIN.SHOP, cellW: 0.036, cellH: 0.024 });
}

function flag(g: G, x: number, z: number, h: number, hex: number): void {
  g.noWin().color(0xd8d8d8);
  g.box(x - 0.006, 0, z - 0.006, x + 0.006, h, z + 0.006, { noTop: true });
  g.color(hex);
  g.panel([x + 0.006, h - 0.075, z], [x + 0.11, h - 0.075, z], [x + 0.11, h - 0.006, z], [x + 0.006, h - 0.006, z]);
}

/** Rectangular fence; optional gap in the front (+z) side. */
function fence(g: G, x0: number, z0: number, x1: number, z1: number, h: number, hex: number, t = 0.012, gap?: P2): void {
  g.noWin().color(hex);
  g.box(x0, 0, z0, x1, h, z0 + t);
  g.box(x0, 0, z0, x0 + t, h, z1);
  g.box(x1 - t, 0, z0, x1, h, z1);
  if (gap) {
    if (gap[0] > x0) g.box(x0, 0, z1 - t, gap[0], h, z1);
    if (gap[1] < x1) g.box(gap[1], 0, z1 - t, x1, h, z1);
  } else g.box(x0, 0, z1 - t, x1, h, z1);
}

function columns(g: G, x0: number, x1: number, z: number, y0: number, y1: number, n: number, r: number, hex: number): void {
  g.noWin().color(hex);
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
    g.cylinder(x, z, r, y0, y1, 6);
  }
}

/** Red cross on a wall facing +z at depth zf. */
function redCross(g: G, cx: number, cy: number, zf: number, s: number): void {
  g.noWin().color(PAL.red);
  g.box(cx - s * 0.17, cy - s * 0.5, zf, cx + s * 0.17, cy + s * 0.5, zf + 0.012);
  g.box(cx - s * 0.5, cy - s * 0.17, zf, cx + s * 0.5, cy + s * 0.17, zf + 0.012);
}

/** Banded factory chimney with a smoke emitter on top. */
function chimney(g: G, x: number, z: number, r0: number, r1: number, h: number, hex: number, band: number, kind: 'smoke' | 'steam' | 'dark' = 'smoke'): void {
  const rAt = (t: number) => r0 + (r1 - r0) * t;
  g.noWin().color(hex);
  g.frustum(x, z, r0, rAt(0.8), 0, h * 0.8, 8);
  g.color(band);
  g.frustum(x, z, rAt(0.8), rAt(0.9), h * 0.8, h * 0.9, 8);
  g.color(hex);
  g.frustum(x, z, rAt(0.9), r1, h * 0.9, h, 8);
  g.color(0x2a2a2a);
  g.cylinder(x, z, r1 * 0.7, h, h + 0.004, 8);
  g.emitter(x, h + 0.03, z, kind);
}

function tank(g: G, x: number, z: number, r: number, h: number, hex: number, segs = 10): void {
  g.noWin().color(hex);
  g.lathe(x, z, [
    [r, 0],
    [r, h],
    [r * 0.75, h + r * 0.12],
    [0, h + r * 0.16],
  ], segs);
}

/** Lattice transmission tower. */
function pylon(g: G, x: number, z: number, h: number): void {
  g.noWin().color(PAL.steel);
  const b = 0.07;
  const t = 0.012;
  g.beam([x - b, 0, z - b], [x, h, z], t);
  g.beam([x + b, 0, z - b], [x, h, z], t);
  g.beam([x - b, 0, z + b], [x, h, z], t);
  g.beam([x + b, 0, z + b], [x, h, z], t);
  g.beam([x - 0.12, h * 0.85, z], [x + 0.12, h * 0.85, z], t);
}

function boat(g: G, r: Rng, x: number, z0: number, len: number, w: number, sail: boolean): void {
  const hull = r.pick([0xf4f4ef, 0xe8e4dc, 0x3f6fb0, 0xd6453d]);
  g.noWin().color(hull);
  prism(g, [
    [x - w / 2, z0],
    [x + w / 2, z0],
    [x + w / 2, z0 + len * 0.7],
    [x, z0 + len],
    [x - w / 2, z0 + len * 0.7],
  ], -0.1, -0.02, 0xd9cfb4);
  if (sail) {
    g.color(PAL.steelDark).box(x - 0.006, -0.02, z0 + len * 0.45 - 0.006, x + 0.006, 0.38, z0 + len * 0.45 + 0.006, { noTop: true });
    g.color(WHITE);
    const mz = z0 + len * 0.45;
    const tri: V3[] = [
      [x, 0.0, mz - 0.01],
      [x, 0.34, mz - 0.01],
      [x, 0.0, z0 + 0.04],
    ];
    g.face(tri, [1, 0, 0]);
    g.face(tri, [-1, 0, 0]);
  } else {
    g.color(WHITE).box(x - w * 0.3, -0.02, z0 + len * 0.15, x + w * 0.3, 0.04, z0 + len * 0.5, { top: 0xbfc6cc });
  }
}

function airplane(g: G, x: number, z: number, len: number, yaw: number, tail: number): void {
  g.push().noWin();
  g.translate(x, 0, z).rotateY(yaw);
  const y = 0.075;
  const rr = len * 0.06;
  g.color(0xf2f2f0);
  g.cylinderX(-len * 0.45, len * 0.42, y, 0, rr, 6);
  g.sphere(len * 0.42, y, 0, rr, 0, 1);
  // swept wings
  prism(g, [
    [len * 0.08, 0],
    [-len * 0.14, -len * 0.48],
    [-len * 0.22, -len * 0.48],
    [-len * 0.12, 0],
  ], y - 0.008, y + 0.004);
  prism(g, [
    [len * 0.08, 0],
    [-len * 0.12, 0],
    [-len * 0.22, len * 0.48],
    [-len * 0.14, len * 0.48],
  ], y - 0.008, y + 0.004);
  // engines
  g.color(0xb8bec4);
  g.cylinderX(-len * 0.06, len * 0.06, y - 0.03, -len * 0.2, len * 0.03, 5);
  g.cylinderX(-len * 0.06, len * 0.06, y - 0.03, len * 0.2, len * 0.03, 5);
  // stabilisers
  g.color(0xf2f2f0);
  prism(g, [
    [-len * 0.36, 0],
    [-len * 0.46, -len * 0.16],
    [-len * 0.5, -len * 0.16],
    [-len * 0.45, 0],
  ], y, y + 0.006);
  prism(g, [
    [-len * 0.36, 0],
    [-len * 0.45, 0],
    [-len * 0.5, len * 0.16],
    [-len * 0.46, len * 0.16],
  ], y, y + 0.006);
  // tail fin (double sided)
  g.color(tail);
  const fin: V3[] = [
    [-len * 0.32, y + rr * 0.6, 0],
    [-len * 0.45, y + rr * 0.6, 0],
    [-len * 0.49, y + len * 0.2, 0],
    [-len * 0.42, y + len * 0.2, 0],
  ];
  g.face(fin, [0, 0, 1]);
  g.face(fin, [0, 0, -1]);
  g.pop();
}

/** Hemispherical dome via lathe. */
function dome(g: G, x: number, z: number, r: number, y: number, hex: number, segs = 12, squash = 1): void {
  g.noWin().color(hex);
  const pts: [number, number][] = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push([Math.cos(a) * r, y + Math.sin(a) * r * squash]);
  }
  pts[steps][0] = 0;
  g.lathe(x, z, pts, segs);
}

// --------------------------------------------------------------- transport

const rotor_blades: ModelFn = (g) => {
  g.noWin().color(0xf2f2ee);
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + (k * Math.PI * 2) / 3;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const vx = -uy;
    const vy = ux;
    const p = (r: number, w: number): V3 => [ux * r + vx * w, uy * r + vy * w, 0.01];
    g.panel(p(0.07, -0.05), p(1.0, -0.012), p(1.0, 0.016), p(0.07, 0.04));
  }
  g.color(0xd8dadc);
  g.box(-0.07, -0.07, -0.06, 0.07, 0.07, 0.07, { bottom: true });
};

const bus_stop: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.05, 0.86, 0.95, 0.94, 0.013, PAL.laneYellow);
  const frame = r.pick([0x3f7fd6, 0x2bb3a3, 0x6b7280, 0xd6453d]);
  g.noWin().color(frame);
  for (const [px, pz] of [
    [0.31, 0.63],
    [0.69, 0.63],
    [0.31, 0.77],
    [0.69, 0.77],
  ] as P2[]) {
    g.box(px - 0.01, 0, pz - 0.01, px + 0.01, 0.17, pz + 0.01, { noTop: true });
  }
  g.box(0.28, 0.17, 0.6, 0.72, 0.19, 0.8);
  g.color(0xa9d3e3);
  g.panel([0.31, 0.02, 0.63], [0.69, 0.02, 0.63], [0.69, 0.15, 0.63], [0.31, 0.15, 0.63]);
  g.panel([0.31, 0.02, 0.63], [0.31, 0.02, 0.76], [0.31, 0.15, 0.76], [0.31, 0.15, 0.63]);
  g.color(PAL.wood).box(0.36, 0.035, 0.645, 0.64, 0.05, 0.69);
  // ad panel (lit at night)
  g.color(r.pick(PAL.awnings)).box(0.69, 0.03, 0.645, 0.705, 0.15, 0.76, { win: WIN.SHOP, cellW: 0.11, cellH: 0.12 });
  // bus stop sign
  g.color(PAL.steelDark).box(0.875, 0, 0.82, 0.89, 0.25, 0.835, { noTop: true });
  g.color(0x2f6fd6).box(0.85, 0.2, 0.822, 0.915, 0.27, 0.833);
  tree(g, r, 0.14, 0.25, 0.95);
  tree(g, r, 0.82, 0.22, 0.85);
  bench(g, 0.5, 0.32);
  lamp(g, 0.1, 0.62, 0.22);
};

const train_station: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xd9c7a7, 0xc9a882, 0xa65a3f, 0xb5654a]);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.green, PAL.roofs.red]);
  // forecourt at the back (road side)
  deck(g, 0.1, 0.02, 1.9, 0.18, 0.012, PATH);
  // station hall
  g.color(wall).win(WIN.CIVIC, 0.12, FLOOR * 1.25);
  g.box(0.15, 0, 0.18, 1.85, 0.32, 1.0, { noTop: true });
  g.noWin().color(roof);
  g.gable(0.15, 0.18, 1.85, 1.0, 0.32, 0.2, 'x', 0.04, wall);
  // clock tower
  g.color(shade(wall, 1.06)).win(WIN.CIVIC, 0.09, 0.14);
  g.box(0.86, 0, 0.45, 1.14, 0.8, 0.73, { noTop: true });
  g.noWin().color(roof).pyramid(1.0, 0.59, 0.36, 0.36, 0.8, 0.24);
  g.color(WHITE);
  g.box(0.94, 0.62, 0.73, 1.06, 0.74, 0.742);
  g.box(0.94, 0.62, 0.438, 1.06, 0.74, 0.45);
  g.color(PAL.black).box(0.995, 0.66, 0.742, 1.005, 0.72, 0.746);
  // platform
  g.color(0xcfcac0).box(0.04, 0, 1.18, 1.96, 0.055, 1.97, { top: 0xbdb8ae });
  deck(g, 0.04, 1.89, 1.96, 1.93, 0.058, PAL.laneYellow);
  // canopy on posts
  g.color(PAL.steelDark);
  for (let i = 0; i < 5; i++) {
    const x = 0.2 + i * 0.4;
    g.box(x - 0.012, 0.055, 1.44, x + 0.012, 0.26, 1.464, { noTop: true });
  }
  g.color(0xd8d4cc).box(0.12, 0.26, 1.26, 1.88, 0.275, 1.66, { top: 0xc4c0b8 });
  bench(g, 0.6, 1.42);
  bench(g, 1.4, 1.42);
  lamp(g, 0.1, 1.3, 0.24);
  lamp(g, 1.9, 1.3, 0.24);
};

const seaport: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.04, 0.04, 3.96, 3.55, 0.012, 0x8f8b84);
  // quay wall + apron reaching over the water
  g.noWin().color(0xbab5ab).box(0, -0.4, 3.5, 4, 0.03, 4.08, { top: 0xa9a49a });
  deck(g, 0.1, 4.0, 3.9, 4.03, 0.032, PAL.laneYellow);
  g.color(0x333333);
  for (let i = 0; i < 4; i++) g.box(0.4 + i - 0.02, 0.03, 4.0, 0.4 + i + 0.02, 0.06, 4.04);
  // warehouses along the back
  for (let k = 0; k < 2; k++) {
    const x0 = 0.2 + k * 1.95;
    const x1 = x0 + 1.65;
    const wc = r.pick(PAL.industrial);
    g.color(wc).win(WIN.IND, 0.22, 0.3);
    g.box(x0, 0, 0.2, x1, 0.32, 1.1, { noTop: true });
    g.noWin().color(r.pick(PAL.industrialRoof)).gable(x0, 0.2, x1, 1.1, 0.32, 0.14, 'x', 0.03, wc);
    g.color(0x5c6268);
    for (let d = 0; d < 3; d++) g.box(x0 + 0.18 + d * 0.5, 0, 1.1, x0 + 0.38 + d * 0.5, 0.18, 1.11);
  }
  // container stacks
  for (let row = 0; row < 3; row++) {
    const z = 1.45 + row * 0.42;
    for (let i = 0; i < 6; i++) {
      if (r.chance(0.12)) continue;
      const x = 0.25 + i * 0.36;
      const levels = r.int(1, 2);
      for (let l = 0; l < levels; l++) {
        g.color(r.pick(PAL.awnings));
        g.box(x, l * 0.11, z, x + 0.32, (l + 1) * 0.11 - 0.005, z + 0.14);
      }
    }
  }
  // ship-to-shore gantry cranes at the quay
  for (const cx of [2.7, 3.45]) {
    const col = r.pick([0xe8873a, 0x3f7fd6, 0xd6453d]);
    g.color(col);
    for (const dx of [-0.16, 0.16]) {
      g.beam([cx + dx, 0, 3.15], [cx + dx, 0.9, 3.15], 0.04);
      g.beam([cx + dx, 0, 3.75], [cx + dx, 0.9, 3.75], 0.04);
      g.box(cx + dx - 0.02, 0.86, 3.13, cx + dx + 0.02, 0.92, 3.77);
    }
    g.box(cx - 0.18, 0.86, 3.13, cx + 0.18, 0.92, 3.17);
    g.box(cx - 0.18, 0.86, 3.73, cx + 0.18, 0.92, 3.77);
    g.box(cx - 0.05, 0.92, 2.85, cx + 0.05, 0.98, 4.4);
    g.beam([cx - 0.1, 0.92, 3.45], [cx, 1.38, 3.45], 0.03);
    g.beam([cx + 0.1, 0.92, 3.45], [cx, 1.38, 3.45], 0.03);
    g.beam([cx, 1.38, 3.45], [cx, 0.98, 4.36], 0.018);
    g.beam([cx, 1.38, 3.45], [cx, 0.98, 2.9], 0.018);
    g.color(0xf2f2f0).box(cx - 0.06, 0.82, 4.05, cx + 0.06, 0.92, 4.18);
    g.color(PAL.steelDark).beam([cx, 0.82, 4.11], [cx, 0.45, 4.11], 0.008);
  }
  // docked cargo ship
  const hull = r.pick([0x8f2f2f, 0x2f3f6f, 0x2f5f4f]);
  g.color(hull);
  prism(g, [
    [0.35, 4.12],
    [2.95, 4.12],
    [3.4, 4.28],
    [2.95, 4.44],
    [0.35, 4.44],
  ], -0.3, 0.02, 0x9a958c);
  for (let i = 0; i < 5; i++) {
    g.color(r.pick(PAL.awnings));
    g.box(1.0 + i * 0.36, 0.02, 4.16, 1.32 + i * 0.36, 0.13, 4.4);
  }
  g.color(WHITE).win(WIN.OFFICE, 0.1, 0.1);
  g.box(0.42, 0.02, 4.17, 0.78, 0.32, 4.39, { top: 0xd8d8d8 });
  g.noWin();
  chimneyStub(g, 0.6, 4.28);
  lamp(g, 1.95, 3.4, 0.4);
  lamp(g, 0.1, 1.3, 0.3);
};

function chimneyStub(g: G, x: number, z: number): void {
  g.color(PAL.black).box(x - 0.04, 0.32, z - 0.04, x + 0.04, 0.42, z + 0.04);
}

const airport: ModelFn = (g, c) => {
  const r = c.rng;
  const tail = r.pick([PAL.blue, PAL.red, 0x2bb3a3, PAL.orange]);
  // runway
  deck(g, 0.12, 2.85, 5.88, 3.65, 0.013, ASPHALT);
  for (let i = 0; i < 9; i++) deck(g, 0.62 + i * 0.55, 3.235, 0.9 + i * 0.55, 3.265, 0.015, WHITE);
  for (let i = 0; i < 4; i++) {
    deck(g, 0.2, 2.95 + i * 0.18, 0.4, 2.99 + i * 0.18, 0.015, WHITE);
    deck(g, 5.6, 2.95 + i * 0.18, 5.8, 2.99 + i * 0.18, 0.015, WHITE);
  }
  // taxiway + connectors
  deck(g, 0.5, 2.48, 5.5, 2.72, 0.013, 0x55585d);
  deck(g, 0.6, 2.72, 0.84, 2.85, 0.013, 0x55585d);
  deck(g, 5.16, 2.72, 5.4, 2.85, 0.013, 0x55585d);
  deck(g, 0.5, 2.59, 5.5, 2.61, 0.015, PAL.laneYellow);
  // apron
  deck(g, 0.25, 1.15, 4.35, 2.48, 0.013, 0xa8a49b);
  // terminal
  g.color(0xe8ecef).win(WIN.GLASS, 0.12, 0.16);
  g.box(0.4, 0, 0.3, 3.0, 0.32, 1.05, { noTop: true });
  g.noWin().color(0xc9ced2).box(0.32, 0.32, 0.22, 3.08, 0.36, 1.14, { top: 0xd8dde0 });
  g.color(0xb8bec4);
  for (const jx of [1.0, 2.2]) g.box(jx - 0.04, 0.09, 1.05, jx + 0.04, 0.16, 1.5);
  // control tower
  g.color(0xe0e2e4).cylinder(3.5, 0.6, 0.09, 0, 1.05, 8);
  g.color(GLASS_TINT).frustum(3.5, 0.6, 0.14, 0.2, 1.05, 1.22, 8);
  g.color(0xd8dadc).cylinder(3.5, 0.6, 0.21, 1.22, 1.26, 8);
  g.color(PAL.steelDark).beam([3.5, 1.26, 0.6], [3.5, 1.46, 0.6], 0.015);
  // hangar (half barrel)
  g.color(0xb9c0c6);
  g.cylinderZ(0.2, 1.3, 5.15, 0, 0.5, 10);
  g.color(0x6b7280).box(4.8, 0, 1.3, 5.5, 0.34, 1.312);
  // planes
  airplane(g, 1.0, 1.85, 0.8, Math.PI / 2, tail);
  airplane(g, 2.2, 1.85, 0.8, Math.PI / 2, r.pick([PAL.red, PAL.green, PAL.blue]));
  airplane(g, 4.4, 3.25, 0.9, 0, tail);
  // car park behind the terminal side
  deck(g, 3.2, 1.2, 4.3, 0.15, 0.013, ASPHALT);
  for (let i = 0; i < 4; i++) car(g, 3.35 + i * 0.25, 0.35, r.pick(PAL.cars), false);
  lamp(g, 4.4, 1.1, 0.3);
};

// ------------------------------------------------------------------- power

const coal_plant: ModelFn = (g, c) => {
  const r = c.rng;
  const brick = r.pick([0x8f5a46, 0x7f6a5a, 0x9a8a78]);
  // boiler house
  g.color(brick).win(WIN.IND, 0.2, 0.22);
  g.box(0.3, 0, 0.45, 2.3, 1.0, 2.2, { top: PAL.flatRoofDark });
  g.noWin().color(shade(brick, 0.85)).box(0.6, 1.0, 0.8, 2.0, 1.16, 1.9, { top: PAL.flatRoofDark });
  // turbine hall
  const hall = mixHex(brick, 0xc0b8a8, 0.5);
  g.color(hall).win(WIN.IND, 0.2, 0.2);
  g.box(0.3, 0, 2.3, 3.0, 0.55, 3.65, { noTop: true });
  g.noWin().color(PAL.roofs.slate).gable(0.3, 2.3, 3.0, 3.65, 0.55, 0.18, 'x', 0.03, hall);
  // chimneys
  chimney(g, 2.85, 0.55, 0.17, 0.12, 1.95, 0xb8b0a4, PAL.red);
  chimney(g, 3.45, 0.55, 0.17, 0.12, 1.95, 0xb8b0a4, PAL.red);
  // coal piles + conveyor
  g.color(0x4a4540).pyramid(3.05, 1.55, 0.75, 0.6, 0, 0.32);
  g.color(0x54504a).pyramid(3.55, 2.05, 0.5, 0.5, 0, 0.22);
  g.color(PAL.steel).beam([2.95, 0.28, 1.55], [2.3, 0.9, 1.45], 0.06);
  // transformer yard
  g.color(0x7d848a);
  for (let i = 0; i < 3; i++) g.box(3.2 + i * 0.22, 0, 2.55, 3.35 + i * 0.22, 0.14, 2.75, { top: 0x6a7076 });
  pylon(g, 3.55, 3.45, 0.75);
  fence(g, 3.1, 2.4, 3.95, 3.95, 0.05, PAL.steel, 0.01);
};

const oil_plant: ModelFn = (g, c) => {
  const r = c.rng;
  // tank farm with bund walls
  g.noWin().color(0xb9b4aa);
  g.box(0.15, 0, 0.15, 1.95, 0.05, 1.95, { top: 0x9d988e });
  for (const [x, z] of [
    [0.6, 0.6],
    [1.45, 0.6],
    [0.6, 1.45],
    [1.45, 1.45],
  ] as P2[]) {
    tank(g, x, z, 0.33, 0.42, r.pick([0xf2f2ee, 0xe6e2d8]));
    g.color(PAL.orange).cylinder(x, z, 0.335, 0.3, 0.34, 10);
  }
  // main building
  const wall = r.pick(PAL.industrial);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(1.0, 0, 2.2, 3.7, 0.6, 3.6, { top: PAL.flatRoofDark });
  g.noWin().color(shade(wall, 0.85)).box(1.3, 0.6, 2.5, 2.4, 0.78, 3.3, { top: PAL.flatRoof });
  // chimneys
  chimney(g, 2.75, 0.75, 0.13, 0.1, 1.6, 0xa9aeb2, PAL.orange);
  chimney(g, 3.3, 0.75, 0.13, 0.1, 1.6, 0xa9aeb2, PAL.orange);
  // pipes from tanks to plant
  g.color(PAL.steel);
  g.beam([1.45, 0.2, 1.8], [1.45, 0.2, 2.2], 0.04);
  g.beam([1.9, 0.2, 0.6], [2.6, 0.2, 0.6], 0.04);
  g.beam([2.6, 0.2, 0.6], [2.6, 0.2, 2.2], 0.04);
  pylon(g, 3.6, 1.6, 0.75);
  g.color(0x7d848a).box(0.3, 0, 2.4, 0.8, 0.16, 2.9, { top: 0x6a7076 });
};

const gas_plant: ModelFn = (g, c) => {
  const r = c.rng;
  // spherical gas holders on legs
  for (const [x, z] of [
    [0.6, 0.62],
    [1.42, 0.62],
  ] as P2[]) {
    g.noWin().color(PAL.steel);
    for (const [dx, dz] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2],
    ] as P2[]) {
      g.beam([x + dx, 0, z + dz], [x + dx * 0.6, 0.38, z + dz * 0.6], 0.03);
    }
    g.color(r.pick([0xf2f2ee, 0xdfe6ea]));
    g.sphere(x, 0.48, z, 0.32, 1);
  }
  const wall = r.pick([0xc9d2d8, 0xd9dde2, 0xb9c6cf]);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(0.25, 0, 1.3, 2.75, 0.45, 2.7, { top: PAL.flatRoof });
  g.noWin().color(0x3f7fd6).box(0.24, 0.36, 1.29, 2.76, 0.4, 2.71, { top: PAL.flatRoof });
  g.color(shade(wall, 0.9)).box(0.6, 0.45, 1.6, 1.6, 0.62, 2.3, { top: PAL.flatRoofDark });
  chimney(g, 2.3, 0.62, 0.1, 0.08, 1.25, 0xd0d4d8, 0x3f7fd6);
  g.color(PAL.steel).beam([1.75, 0.25, 0.62], [2.2, 0.25, 0.62], 0.04);
  g.beam([2.2, 0.25, 0.62], [2.2, 0.25, 1.3], 0.04);
  pylon(g, 2.6, 2.85, 0.6);
};

function coolingTower(g: G, x: number, z: number, s: number): void {
  g.noWin().color(0xdcd8d0);
  g.lathe(x, z, [
    [0.55 * s, 0],
    [0.43 * s, 0.55 * s],
    [0.37 * s, 0.95 * s],
    [0.41 * s, 1.35 * s],
  ], 12, 0, false);
  g.color(0x9f9b94);
  g.lathe(x, z, [
    [0.41 * s, 1.35 * s],
    [0.37 * s, 1.35 * s],
    [0.33 * s, 1.0 * s],
  ], 12, 0, true);
  g.emitter(x, 1.4 * s, z, 'steam');
}

const nuclear_plant: ModelFn = (g, c) => {
  const r = c.rng;
  coolingTower(g, 0.95, 1.05, 1);
  coolingTower(g, 2.35, 0.95, 0.95);
  // reactor containment
  g.noWin().color(0xe6e2da).cylinder(3.05, 2.85, 0.48, 0, 0.55, 12);
  dome(g, 3.05, 2.85, 0.48, 0.55, 0xd8d4cc, 12, 0.85);
  g.color(PAL.red).cylinder(3.05, 2.85, 0.485, 0.42, 0.46, 12);
  // turbine hall
  const wall = r.pick([0xc9cfd4, 0xd9d4c8]);
  g.color(wall).win(WIN.IND, 0.2, 0.22);
  g.box(0.25, 0, 2.25, 2.4, 0.5, 3.65, { noTop: true });
  g.noWin().color(PAL.roofs.slate).shed(0.25, 2.25, 2.4, 3.65, 0.5, 0.12);
  g.color(shade(wall, 0.92)).win(WIN.IND, 0.2, 0.2);
  g.box(3.3, 0, 0.4, 3.85, 0.35, 1.8, { top: PAL.flatRoof });
  g.noWin();
  // hazard stripes on the apron
  for (let i = 0; i < 5; i++) deck(g, 2.55 + i * 0.12, 3.75, 2.61 + i * 0.12, 3.9, 0.014, PAL.yellow);
  fence(g, 2.45, 2.2, 3.9, 3.95, 0.05, PAL.steel, 0.01, [2.5, 3.85]);
  pylon(g, 3.6, 2.0, 0.7);
};

const wind_turbine: ModelFn = (g) => {
  deck(g, 0.36, 0.36, 0.64, 0.64, 0.012, PAL.concrete);
  g.noWin().color(0xf0f0ec);
  g.frustum(0.5, 0.5, 0.065, 0.032, 0, 1.06, 8);
  g.color(0xe6e6e2).box(0.45, 1.02, 0.4, 0.55, 1.12, 0.62);
  g.color(0x8a9096).box(0.47, 0, 0.555, 0.53, 0.07, 0.568);
  g.color(0xb8bec4).box(0.25, 0, 0.3, 0.35, 0.08, 0.38);
  g.rotor(0.5, 1.07, 0.64, 0.42, 0);
};

const solar_plant: ModelFn = (g, c) => {
  const r = c.rng;
  const panel = r.pick([0x2c4a7a, 0x23406e, 0x2f5288]);
  // control hut
  g.color(0xe2ddd2).win(WIN.CIVIC, 0.12, 0.12);
  g.box(0.12, 0, 0.12, 0.62, 0.16, 0.48, { top: PAL.flatRoof });
  g.noWin();
  for (let row = 0; row < 6; row++) {
    const z = 0.62 + row * 0.38;
    g.color(PAL.steelDark);
    g.box(0.2, 0, z + 0.1, 0.23, 0.11, z + 0.13, { noTop: true });
    g.box(2.77, 0, z + 0.1, 2.8, 0.11, z + 0.13, { noTop: true });
    for (let k = 0; k < 6; k++) {
      const x0 = 0.18 + k * 0.44;
      const x1 = x0 + 0.42;
      g.color(k % 2 ? panel : shade(panel, 1.12));
      g.panel([x0, 0.06, z + 0.26], [x1, 0.06, z + 0.26], [x1, 0.17, z], [x0, 0.17, z]);
    }
  }
  fence(g, 0.04, 0.04, 2.96, 2.96, 0.05, PAL.steel, 0.01, [0.2, 0.6]);
  g.color(0x7d848a).box(0.7, 0, 0.15, 0.9, 0.12, 0.35, { top: 0x6a7076 });
};

function dish(g: G, x: number, z: number, s: number): void {
  g.noWin().color(0xb8bec4).cylinder(x, z, 0.1 * s, 0, 0.36 * s, 8);
  g.color(0xcfd4d8);
  g.lathe(x, z, [
    [0.12 * s, 0.36 * s],
    [0.5 * s, 0.53 * s],
    [0.7 * s, 0.76 * s],
  ], 14, 0, false);
  g.color(0xf0f4f6);
  g.lathe(x, z, [
    [0.7 * s, 0.76 * s],
    [0.66 * s, 0.76 * s],
    [0.46 * s, 0.56 * s],
    [0.1 * s, 0.43 * s],
  ], 14, 0, true);
  g.color(PAL.steel);
  g.beam([x, 0.43 * s, z], [x, 1.05 * s, z], 0.03);
  g.beam([x + 0.66 * s, 0.76 * s, z], [x, 1.05 * s, z], 0.015);
  g.beam([x - 0.33 * s, 0.76 * s, z + 0.57 * s], [x, 1.05 * s, z], 0.015);
  g.beam([x - 0.33 * s, 0.76 * s, z - 0.57 * s], [x, 1.05 * s, z], 0.015);
  g.color(0xe8873a).box(x - 0.05 * s, 1.03 * s, z - 0.05 * s, x + 0.05 * s, 1.12 * s, z + 0.05 * s);
}

const microwave_plant: ModelFn = (g, c) => {
  const r = c.rng;
  dish(g, 0.95, 0.95, 1);
  dish(g, 2.75, 0.95, 1);
  dish(g, 0.95, 2.85, 1);
  const wall = r.pick([0xe6ecef, 0xdfe8ee]);
  g.color(wall).win(WIN.GLASS, 0.12, 0.14);
  g.box(2.2, 0, 2.35, 3.8, 0.4, 3.6, { top: PAL.flatRoof });
  g.noWin().color(0x3f7fd6).box(2.19, 0.4, 2.34, 3.81, 0.44, 3.61, { top: 0xd8dde0 });
  g.color(PAL.steel).beam([3.0, 0.44, 3.0], [3.0, 0.95, 3.0], 0.03);
  g.color(0xf2f2ee).sphere(3.0, 1.0, 3.0, 0.08, 0);
  pylon(g, 2.0, 3.7, 0.6);
};

const fusion_plant: ModelFn = (g, c) => {
  const r = c.rng;
  const cx = 2;
  const cz = 2;
  // supports
  g.noWin().color(0x8a9096);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = cx + Math.cos(a) * 1.05;
    const z = cz + Math.sin(a) * 1.05;
    g.box(x - 0.07, 0, z - 0.07, x + 0.07, 0.35, z + 0.07);
  }
  // torus (tokamak ring)
  const R = 1.05;
  const a0 = 0.26;
  const yc = 0.55;
  const prof: [number, number][] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (i / n) * Math.PI * 2;
    prof.push([R + a0 * Math.cos(t), yc + a0 * Math.sin(t)]);
  }
  g.color(0xc4ccd4);
  g.lathe(cx, cz, prof, 16, 0, false);
  g.color(0x2bb3a3);
  g.lathe(cx, cz, [
    [R + a0 + 0.01, yc - 0.04],
    [R + a0 + 0.01, yc + 0.04],
  ], 16, 0, false);
  // core
  g.color(0xe8ecef).cylinder(cx, cz, 0.42, 0, 0.5, 12);
  dome(g, cx, cz, 0.42, 0.5, 0x7fd6cf, 12, 0.9);
  // side domes + labs
  dome(g, 0.45, 3.5, 0.32, 0, 0xe8ecef, 10, 1);
  dome(g, 3.55, 0.5, 0.32, 0, 0xe8ecef, 10, 1);
  g.color(r.pick([0xe6ecef, 0xf2f4f6])).win(WIN.GLASS, 0.12, 0.14);
  g.box(2.9, 0, 3.0, 3.85, 0.36, 3.85, { top: PAL.flatRoof });
  g.noWin();
  tank(g, 0.45, 0.5, 0.18, 0.4, 0xdfe6ea, 8);
  tank(g, 0.85, 0.4, 0.14, 0.32, 0xdfe6ea, 8);
};

// ------------------------------------------------------------------- water

const water_pump: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.12, 0.12, 0.88, 0.88, 0.012, 0xb5b0a6);
  const wall = r.pick([0xb5654a, 0xa65a3f, 0xc9b49a]);
  g.color(wall).win(WIN.IND, 0.14, 0.12);
  g.box(0.2, 0, 0.25, 0.62, 0.2, 0.62, { noTop: true });
  g.noWin().color(PAL.roofs.slate).gable(0.2, 0.25, 0.62, 0.62, 0.2, 0.1, 'x', 0.025, wall);
  g.color(0x3f5f8f).box(0.36, 0, 0.62, 0.46, 0.12, 0.628);
  g.color(0x2f7fc8);
  g.cylinderX(0.62, 0.82, 0.07, 0.42, 0.045, 6);
  g.cylinder(0.82, 0.42, 0.05, 0, 0.12, 6);
  g.color(PAL.red).cylinder(0.72, 0.42, 0.03, 0.115, 0.135, 6);
  g.color(0xd8dde2).cylinder(0.74, 0.76, 0.09, 0, 0.18, 8, 0xb8c0c8);
};

const water_tower: ModelFn = (g, c) => {
  const r = c.rng;
  const body = r.pick([0xe8eef2, 0xa9d3e3, 0xf2f2ee, 0x8fc0d8]);
  if (c.variant % 2 === 0) {
    g.noWin().color(PAL.steelDark);
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as P2[]) {
      g.beam([0.5 + dx * 0.22, 0, 0.5 + dz * 0.22], [0.5 + dx * 0.14, 0.62, 0.5 + dz * 0.14], 0.03);
    }
    g.beam([0.3, 0.3, 0.3], [0.7, 0.3, 0.7], 0.015);
    g.beam([0.7, 0.3, 0.3], [0.3, 0.3, 0.7], 0.015);
    g.color(body).cylinder(0.5, 0.5, 0.23, 0.6, 0.88, 10);
    g.color(shade(body, 0.85)).cone(0.5, 0.5, 0.25, 0.88, 1.0, 10);
    g.color(PAL.steelDark).cylinder(0.5, 0.5, 0.235, 0.6, 0.63, 10);
  } else {
    g.noWin().color(shade(body, 0.92)).cylinder(0.5, 0.5, 0.07, 0, 0.56, 8);
    g.color(body);
    g.lathe(0.5, 0.5, [
      [0.06, 0.5],
      [0.22, 0.62],
      [0.28, 0.76],
      [0.21, 0.9],
      [0, 0.95],
    ], 10);
  }
  g.color(PAL.concrete).box(0.38, 0, 0.75, 0.62, 0.08, 0.9, { top: PAL.flatRoof });
};

const water_treatment: ModelFn = (g, c) => {
  const r = c.rng;
  for (const [x, z] of [
    [0.48, 0.5],
    [1.45, 0.5],
  ] as P2[]) {
    g.noWin().color(PAL.concrete).cylinder(x, z, 0.36, 0, 0.07, 12, WATER);
    g.color(PAL.concreteDark).cylinder(x, z, 0.06, 0.07, 0.1, 6);
    g.color(PAL.steel).beam([x, 0.1, z], [x + 0.34, 0.1, z], 0.025);
  }
  // rectangular filter basins
  g.color(PAL.concrete).box(0.12, 0, 1.0, 0.95, 0.06, 1.85, { top: PAL.concreteDark });
  deck(g, 0.17, 1.05, 0.9, 1.4, 0.062, 0x5fb3d8);
  deck(g, 0.17, 1.45, 0.9, 1.8, 0.062, 0x4aa8d0);
  // control building
  const wall = r.pick([0xf2f2ee, 0xe6e2d8]);
  g.color(wall).win(WIN.CIVIC, 0.12, 0.12);
  g.box(1.1, 0, 1.05, 1.88, 0.24, 1.82, { top: PAL.flatRoof });
  g.noWin().color(0x3f7fd6).box(1.09, 0.17, 1.04, 1.89, 0.2, 1.83, { top: PAL.flatRoof });
  g.color(0x2f7fc8).beam([0.95, 0.04, 1.4], [1.1, 0.04, 1.4], 0.04);
  g.beam([0.48, 0.04, 0.86], [0.48, 0.04, 1.0], 0.04);
};

const desalination: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xf2f2ee, 0xe2e8ec]);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(0.12, 0, 0.12, 1.88, 0.34, 0.85, { top: PAL.flatRoof });
  g.noWin().color(0x2f7fc8).box(0.11, 0.24, 0.11, 1.89, 0.28, 0.86, { top: PAL.flatRoof });
  tank(g, 0.42, 1.15, 0.2, 0.3, 0xdfe6ea, 10);
  tank(g, 0.92, 1.15, 0.2, 0.3, 0xdfe6ea, 10);
  g.color(0xc9d2d8).cylinder(1.42, 1.08, 0.07, 0, 0.62, 8);
  g.cylinder(1.66, 1.08, 0.07, 0, 0.62, 8);
  // pier with intake pipes over the water
  g.color(0xbab5ab).box(1.18, -0.35, 1.45, 1.42, 0.03, 2.38, { top: 0xa9a49a });
  g.color(0x2f7fc8);
  g.cylinderZ(1.3, 2.35, 1.55, 0.03, 0.04, 6);
  g.cylinderZ(1.3, 2.25, 0.7, 0.0, 0.04, 6);
  g.color(PAL.steelDark).box(1.2, 0.03, 2.2, 1.4, 0.12, 2.36);
  g.color(PAL.steel).beam([1.42, 0.25, 1.08], [1.42, 0.25, 0.85], 0.03);
};

// ----------------------------------------------------------------- garbage

const incinerator: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0x8f9399, 0x9a958c, 0x7f868c]);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(0.15, 0, 0.25, 1.35, 0.48, 1.45, { top: PAL.flatRoofDark });
  g.color(shade(wall, 0.92)).win(WIN.IND, 0.2, 0.2);
  g.box(1.35, 0, 0.75, 1.85, 0.22, 1.45, { noTop: true });
  g.noWin().color(PAL.roofs.slate).shed(1.35, 0.75, 1.85, 1.45, 0.22, 0.08);
  g.color(0xe8873a).box(0.5, 0.06, 1.45, 0.95, 0.2, 1.46);
  chimney(g, 1.6, 0.4, 0.12, 0.09, 1.3, 0x9a958c, PAL.red);
  truck(g, 0.6, 1.72, 0x4caf50, PAL.white, true, 0.32);
  g.color(0x7a6a52).pyramid(1.55, 1.7, 0.4, 0.36, 0, 0.12);
  g.color(0x5f6b52).pyramid(1.75, 1.55, 0.25, 0.25, 0, 0.08);
};

const waste_to_energy: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0x8fa39a, 0x9aa8b0, 0xa7a29a]);
  g.color(wall).win(WIN.IND, 0.22, 0.22);
  g.box(0.25, 0, 0.25, 2.0, 0.62, 2.05, { noTop: true });
  g.noWin().color(PAL.roofs.charcoal).shed(0.25, 0.25, 2.0, 2.05, 0.62, 0.22);
  g.color(shade(wall, 0.9)).win(WIN.IND, 0.2, 0.2);
  g.box(0.5, 0, 0.45, 1.2, 1.05, 1.05, { top: PAL.flatRoofDark });
  g.color(0xdfe6ea).win(WIN.GLASS, 0.12, 0.14);
  g.box(2.1, 0, 1.2, 2.8, 0.36, 2.65, { top: PAL.flatRoof });
  g.noWin();
  chimney(g, 2.45, 0.55, 0.14, 0.1, 1.55, 0xc8ccd0, 0x4caf50);
  truck(g, 0.8, 2.45, 0x4caf50, PAL.white, true, 0.32);
  truck(g, 1.5, 2.6, 0x4caf50, PAL.white, true, 0.32);
  pylon(g, 2.75, 2.85, 0.7);
};

const recycling_center: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xb8c9a8, 0xc9d6c3, 0xa7b89a]);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(0.15, 0, 0.15, 1.3, 0.4, 1.1, { noTop: true });
  g.noWin().color(0x4f8a46).shed(0.15, 0.15, 1.3, 1.1, 0.4, 0.14);
  const bins = [0x3f7fd6, 0x4caf50, 0xf2c94c, 0x8a9096];
  for (let i = 0; i < 4; i++) {
    g.color(bins[i]).box(0.2 + i * 0.27, 0, 1.3, 0.42 + i * 0.27, 0.12, 1.5, { top: shade(bins[i], 0.8) });
  }
  const piles = [0xa8845a, 0x5fae6a, 0x9aa0a6, 0xd8c050];
  for (let i = 0; i < 4; i++) {
    g.color(piles[i]).pyramid(1.5 + (i % 2) * 0.3, 0.4 + Math.floor(i / 2) * 0.45, 0.3, 0.3, 0, 0.12 + (i % 2) * 0.03);
  }
  g.color(PAL.steel).beam([1.5, 0.1, 1.4], [1.3, 0.35, 0.8], 0.05);
  truck(g, 1.5, 1.75, 0x3f7fd6, PAL.white, true, 0.32);
};

// ------------------------------------------------------------------ safety

const police_station: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.08, 1.45, 1.92, 1.95, 0.012, ASPHALT);
  for (let i = 0; i < 4; i++) deck(g, 1.02 + i * 0.22, 1.5, 1.04 + i * 0.22, 1.78, 0.014, PAL.laneWhite);
  const wall = r.pick([0xe8e4dc, 0xd9dde2, 0xf0ebe0]);
  g.color(wall).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.15, 0, 0.2, 1.85, FLOOR * 2, 1.32, { top: PAL.flatRoof });
  g.noWin().color(0x2f5fb8);
  g.box(0.14, FLOOR * 0.94, 0.19, 1.86, FLOOR * 1.12, 1.33, { top: 0x2f5fb8 });
  g.box(0.14, FLOOR * 2, 0.19, 1.86, FLOOR * 2 + 0.03, 1.33, { top: PAL.flatRoof });
  // entrance canopy
  g.color(0x2f5fb8).box(0.7, 0.15, 1.32, 1.2, 0.17, 1.48);
  g.color(PAL.steelDark);
  g.box(0.72, 0, 1.45, 0.74, 0.15, 1.47, { noTop: true });
  g.box(1.16, 0, 1.45, 1.18, 0.15, 1.47, { noTop: true });
  // roof: AC units + radio mast
  g.color(0xb8bec4).box(0.4, FLOOR * 2 + 0.03, 0.45, 0.65, FLOOR * 2 + 0.1, 0.65);
  g.color(PAL.steel).beam([1.6, FLOOR * 2 + 0.03, 0.5], [1.6, FLOOR * 2 + 0.5, 0.5], 0.015);
  policeCar(g, 1.14, 1.66, false);
  policeCar(g, 1.58, 1.66, false);
  policeCar(g, 0.4, 1.75, true);
  flag(g, 0.6, 1.4, 0.42, 0x3f7fd6);
};

const fire_station: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.12, 1.15, 1.88, 1.96, 0.012, 0xb9b4aa);
  const brick = r.pick(PAL.walls.brick);
  g.color(brick).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.15, 0, 0.2, 1.85, 0.32, 1.15, { top: PAL.flatRoof });
  g.noWin().color(STONE).box(0.14, 0.3, 0.19, 1.86, 0.34, 1.16, { top: PAL.flatRoof });
  // garage doors
  for (let i = 0; i < 3; i++) {
    const x = 0.3 + i * 0.47;
    g.color(PAL.red).box(x, 0, 1.15, x + 0.36, 0.2, 1.16);
    g.color(WHITE).box(x - 0.01, 0.2, 1.15, x + 0.37, 0.215, 1.162);
  }
  // hose tower
  g.color(shade(brick, 0.92)).win(WIN.CIVIC, 0.08, 0.16);
  g.box(1.52, 0, 0.24, 1.8, 0.72, 0.52, { noTop: true });
  g.noWin().color(PAL.roofs.slate).pyramid(1.66, 0.38, 0.32, 0.32, 0.72, 0.14);
  // fire trucks
  for (const x of [0.48, 0.95]) {
    truck(g, x, 1.52, PAL.red, PAL.red, false, 0.34, 0.1);
    g.color(WHITE).beam([x, 0.105, 1.38], [x, 0.105, 1.62], 0.025);
    g.color(PAL.blue).box(x - 0.02, 0.083, 1.66, x + 0.02, 0.094, 1.68);
  }
  g.color(PAL.red).cylinder(1.7, 1.85, 0.02, 0, 0.05, 6);
  flag(g, 1.45, 1.85, 0.4, PAL.red);
};

// --------------------------------------------------------- health & education

const clinic: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.08, 0.72, 0.92, 0.95, 0.012, ASPHALT);
  const wall = r.pick([0xf4f4ef, 0xeef2f0, 0xf2ece4]);
  g.color(wall).win(WIN.CIVIC, 0.11, FLOOR);
  g.box(0.15, 0, 0.16, 0.85, FLOOR * 2, 0.68, { top: PAL.flatRoof });
  g.noWin().color(0x2bb3a3).box(0.14, FLOOR * 2, 0.15, 0.86, FLOOR * 2 + 0.03, 0.69, { top: PAL.flatRoof });
  redCross(g, 0.66, 0.19, 0.68, 0.1);
  g.color(0x2bb3a3).box(0.3, 0.11, 0.68, 0.52, 0.125, 0.8);
  g.color(PAL.steelDark).box(0.31, 0, 0.78, 0.325, 0.11, 0.795, { noTop: true });
  g.box(0.495, 0, 0.78, 0.51, 0.11, 0.795, { noTop: true });
  truck(g, 0.72, 0.84, WHITE, WHITE, true, 0.26, 0.085);
  g.color(PAL.red).box(0.6, 0.05, 0.783, 0.84, 0.062, 0.897);
  tree(g, r, 0.12, 0.88, 0.7);
};

const hospital: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.1, 2.35, 1.3, 2.95, 0.012, ASPHALT);
  for (let i = 0; i < 4; i++) car(g, 0.25 + i * 0.28, 2.65, r.pick(PAL.cars), false);
  const wall = r.pick([0xf4f4ef, 0xeef2f0]);
  // tower
  g.color(wall).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.5, 0, 0.32, 2.5, FLOOR * 6, 1.4, { top: PAL.flatRoof });
  // front wing
  g.color(shade(wall, 0.96)).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.25, 0, 1.4, 2.75, FLOOR * 2.5, 2.3, { top: PAL.flatRoof });
  g.noWin().color(0x2bb3a3).box(0.24, FLOOR * 2.5, 1.39, 2.76, FLOOR * 2.5 + 0.03, 2.31, { top: PAL.flatRoof });
  // helipad
  const ty = FLOOR * 6;
  deck(g, 1.15, 0.5, 1.85, 1.2, ty + 0.012, 0x4a4d52);
  deck(g, 1.35, 0.68, 1.4, 1.02, ty + 0.014, WHITE);
  deck(g, 1.6, 0.68, 1.65, 1.02, ty + 0.014, WHITE);
  deck(g, 1.4, 0.825, 1.6, 0.875, ty + 0.014, WHITE);
  redCross(g, 2.15, 0.62, 1.4, 0.16);
  redCross(g, 1.5, 0.24, 2.3, 0.1);
  // entrance canopy
  g.color(WHITE).box(1.2, 0.14, 2.3, 1.8, 0.16, 2.58);
  g.color(PAL.steelDark);
  g.box(1.22, 0, 2.55, 1.24, 0.14, 2.57, { noTop: true });
  g.box(1.76, 0, 2.55, 1.78, 0.14, 2.57, { noTop: true });
  // ambulances
  for (const x of [2.1, 2.45]) {
    truck(g, x, 2.6, WHITE, WHITE, false, 0.26, 0.085);
    g.color(PAL.red).box(x - 0.057, 0.05, 2.47, x + 0.057, 0.062, 2.7);
  }
  g.color(0xb8bec4).box(0.8, FLOOR * 6, 0.5, 1.0, FLOOR * 6 + 0.07, 0.7);
  tree(g, r, 2.85, 1.0, 0.9);
  tree(g, r, 0.15, 0.6, 0.9);
};

const school: ModelFn = (g, c) => {
  const r = c.rng;
  const brick = r.pick(PAL.walls.brick);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.charcoal, PAL.roofs.brown]);
  g.color(brick).win(WIN.CIVIC, 0.11, FLOOR);
  g.box(0.12, 0, 0.12, 1.88, FLOOR * 2, 0.68, { noTop: true });
  g.box(0.12, 0, 0.68, 0.68, FLOOR * 2, 1.48, { noTop: true });
  g.noWin().color(roof);
  g.hip(0.12, 0.12, 1.88, 0.68, FLOOR * 2, 0.15, 0.03);
  g.hip(0.12, 0.6, 0.68, 1.48, FLOOR * 2, 0.15, 0.03);
  // entrance canopy
  g.color(STONE).box(1.05, 0.15, 0.68, 1.4, 0.17, 0.84);
  g.color(PAL.steelDark);
  g.box(1.06, 0, 0.82, 1.08, 0.15, 0.84, { noTop: true });
  g.box(1.37, 0, 0.82, 1.39, 0.15, 0.84, { noTop: true });
  // sports field
  deck(g, 0.85, 0.98, 1.88, 1.88, 0.013, 0x6fae44);
  deck(g, 0.9, 1.02, 1.83, 1.04, 0.015, WHITE);
  deck(g, 0.9, 1.82, 1.83, 1.84, 0.015, WHITE);
  deck(g, 0.9, 1.02, 0.92, 1.84, 0.015, WHITE);
  deck(g, 1.81, 1.02, 1.83, 1.84, 0.015, WHITE);
  deck(g, 0.9, 1.42, 1.83, 1.44, 0.015, WHITE);
  g.color(WHITE);
  for (const z of [1.08, 1.78]) {
    g.beam([1.28, 0, z], [1.28, 0.07, z], 0.012);
    g.beam([1.45, 0, z], [1.45, 0.07, z], 0.012);
    g.beam([1.28, 0.07, z], [1.45, 0.07, z], 0.012);
  }
  flag(g, 0.82, 0.86, 0.42, r.pick([PAL.blue, PAL.red, PAL.green]));
  truck(g, 0.4, 1.85, 0xf2b81e, 0xf2b81e, true, 0.36, 0.1);
  g.color(PAL.black).box(0.22, 0.045, 1.792, 0.58, 0.055, 1.908);
  tree(g, r, 0.3, 1.6, 0.9);
};

const college: ModelFn = (g, c) => {
  const r = c.rng;
  const brick = r.pick(PAL.walls.brick);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.charcoal, PAL.roofs.green]);
  // quad
  deck(g, 0.82, 0.92, 2.18, 2.7, 0.013, GRASS);
  deck(g, 1.44, 0.85, 1.56, 2.96, 0.015, PATH);
  deck(g, 0.75, 1.76, 2.25, 1.88, 0.015, PATH);
  // back hall
  g.color(brick).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.2, 0, 0.12, 2.8, FLOOR * 2.8, 0.72, { noTop: true });
  g.noWin().color(roof).gable(0.2, 0.12, 2.8, 0.72, FLOOR * 2.8, 0.18, 'x', 0.03, brick);
  // side halls
  const b2 = shade(brick, 1.08);
  g.color(b2).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.12, 0, 0.92, 0.68, FLOOR * 2.3, 2.45, { noTop: true });
  g.box(2.32, 0, 0.92, 2.88, FLOOR * 2.3, 2.45, { noTop: true });
  g.noWin().color(roof);
  g.gable(0.12, 0.92, 0.68, 2.45, FLOOR * 2.3, 0.15, 'z', 0.03, b2);
  g.gable(2.32, 0.92, 2.88, 2.45, FLOOR * 2.3, 0.15, 'z', 0.03, b2);
  // clock tower
  g.color(shade(brick, 1.15)).win(WIN.CIVIC, 0.09, 0.15);
  g.box(1.35, 0, 0.5, 1.65, 1.2, 0.8, { noTop: true });
  g.noWin().color(roof).pyramid(1.5, 0.65, 0.36, 0.36, 1.2, 0.32);
  g.color(WHITE);
  g.box(1.43, 1.0, 0.8, 1.57, 1.13, 0.812);
  g.box(1.65, 1.0, 0.58, 1.662, 1.13, 0.72);
  g.box(1.338, 1.0, 0.58, 1.35, 1.13, 0.72);
  g.color(GOLD).beam([1.5, 1.52, 0.65], [1.5, 1.65, 0.65], 0.02);
  for (const [x, z] of [
    [1.05, 1.2],
    [1.95, 1.2],
    [1.05, 2.4],
    [1.95, 2.4],
    [1.2, 2.75],
    [1.8, 2.75],
  ] as P2[]) {
    tree(g, r, x + (r.next() - 0.5) * 0.08, z, 1.1);
  }
  bench(g, 1.35, 1.6, false);
  bench(g, 1.65, 2.1, false);
};

/** Classical front: podium, columns and pediment over a hall. */
const library: ModelFn = (g, c) => {
  const r = c.rng;
  const stone = r.pick([STONE, 0xe2d9c4, 0xd9d4c8]);
  g.noWin().color(STONE_DARK).box(0.12, 0, 0.1, 0.88, 0.035, 0.86, { top: shade(stone, 0.95) });
  g.color(stone).win(WIN.CIVIC, 0.12, 0.2);
  g.box(0.18, 0.035, 0.14, 0.82, 0.28, 0.66, { noTop: true });
  columns(g, 0.24, 0.76, 0.77, 0.035, 0.28, 4, 0.024, stone);
  g.color(shade(stone, 0.95)).box(0.17, 0.28, 0.13, 0.83, 0.32, 0.84);
  g.color(PAL.roofs.slate).gable(0.17, 0.13, 0.83, 0.84, 0.32, 0.11, 'z', 0.015, stone);
  g.color(STONE_DARK).box(0.26, 0, 0.86, 0.74, 0.018, 0.93);
  g.color(0x5a4430).box(0.45, 0.035, 0.66, 0.55, 0.17, 0.668);
  bush(g, r, 0.14, 0.92, 1);
  bush(g, r, 0.86, 0.92, 1);
};

const museum: ModelFn = (g, c) => {
  const r = c.rng;
  const stone = r.pick([STONE, 0xe2d9c4, 0xeee6d4]);
  g.noWin().color(STONE_DARK).box(0.1, 0, 0.12, 1.9, 0.05, 1.72, { top: shade(stone, 0.94) });
  g.color(stone).win(WIN.CIVIC, 0.13, 0.22);
  g.box(0.18, 0.05, 0.2, 1.82, 0.45, 1.32, { top: PAL.flatRoof });
  columns(g, 0.5, 1.5, 1.55, 0.05, 0.42, 6, 0.032, stone);
  g.color(shade(stone, 0.95)).box(0.42, 0.42, 1.28, 1.58, 0.48, 1.66);
  g.color(PAL.roofs.slate).gable(0.42, 1.28, 1.58, 1.66, 0.48, 0.16, 'z', 0.02, stone);
  // dome
  g.color(stone).cylinder(1.0, 0.72, 0.3, 0.45, 0.58, 12);
  dome(g, 1.0, 0.72, 0.3, 0.58, COPPER, 12, 0.9);
  // steps
  g.color(STONE_DARK).box(0.45, 0, 1.72, 1.55, 0.025, 1.84);
  g.color(r.pick([PAL.red, PAL.blue, 0x8e5bd6])).box(0.25, 0.25, 1.32, 0.38, 0.42, 1.335);
  g.box(1.62, 0.25, 1.32, 1.75, 0.42, 1.335);
  bush(g, r, 0.2, 1.85, 1.2);
  bush(g, r, 1.8, 1.85, 1.2);
};

// ------------------------------------------------------------------- parks

const small_park: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.45, 0.0, 0.55, 1.0, 0.013, PATH);
  deck(g, 0.0, 0.45, 1.0, 0.55, 0.0135, PATH);
  g.noWin().color(0x6a4a32).cylinder(0.5, 0.5, 0.11, 0, 0.03, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const fx = 0.5 + Math.cos(a) * 0.06;
    const fz = 0.5 + Math.sin(a) * 0.06;
    deck(g, fx - 0.022, fz - 0.022, fx + 0.022, fz + 0.022, 0.034, r.pick(PAL.flower));
  }
  for (const [x, z] of [
    [0.22, 0.22],
    [0.78, 0.22],
    [0.22, 0.78],
    [0.78, 0.78],
  ] as P2[]) {
    anyTree(g, r, x + (r.next() - 0.5) * 0.12, z + (r.next() - 0.5) * 0.12, 0.9 + r.next() * 0.4);
  }
  bench(g, 0.38, 0.3, false);
  bench(g, 0.62, 0.7, false);
  lamp(g, 0.39, 0.61, 0.2);
};

const plaza: ModelFn = (g, c) => {
  const r = c.rng;
  const tileHex = shade(r.pick([0xd9d2c2, 0xcfc8b8, 0xe0d6c0]), 0.9);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) if ((i + j) % 2) deck(g, i * 0.25, j * 0.25, (i + 1) * 0.25, (j + 1) * 0.25, 0.013, tileHex);
  g.noWin().color(STONE).cylinder(0.5, 0.5, 0.2, 0, 0.05, 8, WATER);
  g.color(STONE_DARK).cylinder(0.5, 0.5, 0.035, 0.05, 0.16, 5);
  g.color(STONE).frustum(0.5, 0.5, 0.04, 0.09, 0.16, 0.19, 6);
  g.color(0xbfe6f5).cone(0.5, 0.5, 0.03, 0.19, 0.29, 5);
  tree(g, r, 0.13, 0.13, 0.9);
  tree(g, r, 0.87, 0.87, 0.9);
  lamp(g, 0.87, 0.13, 0.22);
  lamp(g, 0.13, 0.87, 0.22);
  bench(g, 0.5, 0.18);
  bench(g, 0.5, 0.82);
};

const playground: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.08, 0.08, 0.92, 0.92, 0.013, PAL.sand);
  // swings
  const frame = r.pick([PAL.red, PAL.blue, PAL.green]);
  g.noWin().color(frame);
  for (const x of [0.15, 0.55]) {
    g.beam([x, 0, 0.2], [x, 0.22, 0.3], 0.015);
    g.beam([x, 0, 0.4], [x, 0.22, 0.3], 0.015);
  }
  g.beam([0.15, 0.22, 0.3], [0.55, 0.22, 0.3], 0.015);
  g.color(PAL.steelDark);
  for (const x of [0.27, 0.43]) {
    g.beam([x, 0.22, 0.3], [x, 0.06, 0.3], 0.006);
    g.color(PAL.yellow).box(x - 0.03, 0.05, 0.28, x + 0.03, 0.06, 0.32);
    g.color(PAL.steelDark);
  }
  // slide tower
  g.color(r.pick([PAL.yellow, PAL.orange])).box(0.64, 0, 0.5, 0.8, 0.2, 0.66, { top: PAL.wood });
  g.color(PAL.red).pyramid(0.72, 0.58, 0.2, 0.2, 0.2, 0.1);
  g.color(PAL.blue).panel([0.69, 0.015, 0.92], [0.75, 0.015, 0.92], [0.75, 0.16, 0.66], [0.69, 0.16, 0.66]);
  // seesaw + sandbox
  g.color(PAL.green).beam([0.2, 0.03, 0.75], [0.48, 0.09, 0.75], 0.025);
  g.color(PAL.wood).box(0.6, 0, 0.75, 0.88, 0.03, 0.88, { top: 0xf0dca0 });
  fence(g, 0.03, 0.03, 0.97, 0.97, 0.05, PAL.wood, 0.01, [0.42, 0.58]);
  tree(g, r, 0.88, 0.15, 0.9);
};

const sports_field: ModelFn = (g, c) => {
  const r = c.rng;
  for (let i = 0; i < 6; i++) deck(g, 0.1, 0.12 + i * 0.29, 1.58, 0.12 + (i + 1) * 0.29, 0.013, i % 2 ? 0x6fae44 : 0x79b94c);
  const W = WHITE;
  deck(g, 0.16, 0.18, 1.52, 0.2, 0.015, W);
  deck(g, 0.16, 1.66, 1.52, 1.68, 0.015, W);
  deck(g, 0.16, 0.18, 0.18, 1.68, 0.015, W);
  deck(g, 1.5, 0.18, 1.52, 1.68, 0.015, W);
  deck(g, 0.16, 0.92, 1.52, 0.94, 0.015, W);
  deck(g, 0.6, 0.2, 0.62, 0.42, 0.015, W);
  deck(g, 1.06, 0.2, 1.08, 0.42, 0.015, W);
  deck(g, 0.6, 0.4, 1.08, 0.42, 0.015, W);
  deck(g, 0.6, 1.44, 0.62, 1.66, 0.015, W);
  deck(g, 1.06, 1.44, 1.08, 1.66, 0.015, W);
  deck(g, 0.6, 1.44, 1.08, 1.46, 0.015, W);
  g.noWin().color(W);
  for (const z of [0.19, 1.67]) {
    g.beam([0.74, 0, z], [0.74, 0.08, z], 0.014);
    g.beam([0.94, 0, z], [0.94, 0.08, z], 0.014);
    g.beam([0.74, 0.08, z], [0.94, 0.08, z], 0.014);
  }
  // bleachers
  const seat = r.pick([PAL.blue, PAL.red, 0x8a9096]);
  for (let s = 0; s < 3; s++) {
    g.color(s % 2 ? seat : shade(seat, 0.85));
    g.box(1.64 + s * 0.1, 0, 0.3, 1.96, 0.04 + s * 0.04, 1.56);
  }
  // floodlights
  for (const z of [0.08, 1.92]) {
    g.color(PAL.steel).beam([1.62, 0, z], [1.62, 0.55, z], 0.025);
    g.color(0xfff0c0).box(1.56, 0.55, z - 0.04, 1.68, 0.6, z + 0.04, { win: WIN.SHOP, cellW: 0.06, cellH: 0.05 });
  }
};

const large_park: ModelFn = (g, c) => {
  const r = c.rng;
  // pond with sandy shore
  blob(g, r, 1.95, 0.95, 0.66, 0.48, 0.0125, PAL.sand, 12, 0.1);
  blob(g, r, 1.95, 0.95, 0.58, 0.4, 0.016, WATER, 12, 0.12);
  // paths
  deck(g, 0.0, 1.92, 3.0, 2.06, 0.013, PATH);
  deck(g, 0.98, 0.0, 1.12, 3.0, 0.0135, PATH);
  deck(g, 1.12, 1.45, 2.4, 1.55, 0.013, PATH);
  // gazebo
  g.noWin().color(WHITE).cylinder(0.5, 2.55, 0.17, 0, 0.035, 8);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = 0.5 + Math.cos(a) * 0.13;
    const z = 2.55 + Math.sin(a) * 0.13;
    g.box(x - 0.008, 0.035, z - 0.008, x + 0.008, 0.17, z + 0.008, { noTop: true });
  }
  g.color(r.pick([PAL.roofs.green, PAL.roofs.red, PAL.roofs.slate])).cone(0.5, 2.55, 0.21, 0.17, 0.3, 8);
  // flower beds
  blob(g, r, 2.5, 2.5, 0.22, 0.15, 0.014, 0x6a4a32, 8, 0.2);
  for (let i = 0; i < 6; i++) bush(g, r, 2.36 + (i % 3) * 0.13, 2.45 + Math.floor(i / 3) * 0.1, 0.7, r.pick(PAL.flower));
  // trees, avoiding pond/paths/gazebo
  let placed = 0;
  for (let tries = 0; tries < 80 && placed < 16; tries++) {
    const x = 0.12 + r.next() * 2.76;
    const z = 0.12 + r.next() * 2.76;
    if (Math.abs(z - 1.99) < 0.16 || Math.abs(x - 1.05) < 0.16) continue;
    if (((x - 1.95) / 0.78) ** 2 + ((z - 0.95) / 0.58) ** 2 < 1) continue;
    if (Math.hypot(x - 0.5, z - 2.55) < 0.32) continue;
    if (Math.hypot(x - 2.5, z - 2.5) < 0.3) continue;
    if (Math.abs(z - 1.5) < 0.12 && x > 1.1 && x < 2.45) continue;
    anyTree(g, r, x, z, 0.9 + r.next() * 0.5);
    placed++;
  }
  bench(g, 0.6, 1.84);
  bench(g, 2.2, 2.14);
  bench(g, 0.9, 1.0, false);
  lamp(g, 1.2, 1.84, 0.22);
  lamp(g, 0.9, 2.3, 0.22);
};

const marina: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.08, 0.12, 0.9, 0.95, 0.012, ASPHALT);
  for (let i = 0; i < 3; i++) car(g, 0.25 + i * 0.27, 0.5, r.pick(PAL.cars), false);
  // clubhouse
  const wall = r.pick([WHITE, 0xeef2f0, 0xf2ece4]);
  g.color(wall).win(WIN.RES, 0.12, FLOOR);
  g.box(1.08, 0, 0.18, 1.86, FLOOR * 1.6, 0.85, { noTop: true });
  g.noWin().color(r.pick([PAL.roofs.blue, PAL.roofs.slate, PAL.roofs.green])).hip(1.08, 0.18, 1.86, 0.85, FLOOR * 1.6, 0.12, 0.03);
  flag(g, 1.0, 1.0, 0.45, r.pick([PAL.blue, PAL.red]));
  // boardwalk + piers over the water
  g.color(PAL.wood).box(0, -0.25, 1.35, 2, 0.03, 1.62, { top: 0xa47e58 });
  for (const x of [0.3, 0.95, 1.6]) {
    g.color(PAL.wood).box(x, -0.25, 1.62, x + 0.09, 0.025, 2.38, { top: 0xa47e58 });
  }
  boat(g, r, 0.52, 1.72, 0.42, 0.13, true);
  boat(g, r, 1.17, 1.75, 0.38, 0.12, r.chance(0.5));
  boat(g, r, 1.82, 1.7, 0.42, 0.13, true);
  boat(g, r, 0.16, 1.9, 0.34, 0.11, false);
  lamp(g, 0.05, 1.45, 0.2);
  lamp(g, 1.95, 1.45, 0.2);
};

const zoo: ModelFn = (g, c) => {
  const r = c.rng;
  // paths
  deck(g, 1.42, 1.55, 1.58, 3.0, 0.013, PATH);
  deck(g, 0.2, 1.48, 2.8, 1.62, 0.0135, PATH);
  // gate
  g.noWin().color(STONE_DARK);
  g.box(1.18, 0, 2.84, 1.3, 0.3, 2.96);
  g.box(1.7, 0, 2.84, 1.82, 0.3, 2.96);
  g.color(0x4f8a36).box(1.16, 0.3, 2.84, 1.84, 0.38, 2.96);
  // savanna enclosure
  deck(g, 0.18, 0.15, 1.35, 1.38, 0.013, 0xd9c38a);
  fence(g, 0.15, 0.12, 1.38, 1.4, 0.05, PAL.wood, 0.012);
  // giraffe
  g.color(0xe8b84a);
  g.box(0.5, 0.12, 0.55, 0.68, 0.19, 0.62);
  g.box(0.51, 0, 0.56, 0.53, 0.12, 0.61, { noTop: true });
  g.box(0.65, 0, 0.56, 0.67, 0.12, 0.61, { noTop: true });
  g.beam([0.66, 0.17, 0.585], [0.73, 0.36, 0.585], 0.025);
  g.box(0.71, 0.35, 0.57, 0.78, 0.39, 0.6);
  // elephant
  g.color(0x8a8f94);
  g.box(0.88, 0.05, 0.85, 1.1, 0.17, 0.97);
  g.box(0.9, 0, 0.86, 1.08, 0.05, 0.96, { noTop: true });
  g.sphere(1.13, 0.15, 0.91, 0.055, 0);
  g.beam([1.17, 0.13, 0.91], [1.2, 0.03, 0.91], 0.02);
  // acacia trees
  for (const [x, z] of [
    [0.35, 1.1],
    [1.15, 0.35],
  ] as P2[]) {
    g.color(PAL.trunk).beam([x, 0, z], [x, 0.18, z], 0.02);
    g.color(0x6f9a3c).sphere(x, 0.2, z, 0.13, 0, 0.35);
  }
  // penguin pool
  fence(g, 1.62, 0.12, 2.85, 1.4, 0.05, PAL.steel, 0.01);
  blob(g, r, 2.25, 0.7, 0.45, 0.38, 0.016, WATER, 10, 0.15);
  g.color(0x9a958c).pyramid(1.85, 1.15, 0.25, 0.2, 0, 0.12);
  g.color(0xa8a49c).pyramid(2.65, 0.3, 0.2, 0.25, 0, 0.1);
  for (let i = 0; i < 5; i++) {
    const x = 1.8 + r.next() * 0.25;
    const z = 0.3 + r.next() * 0.25;
    g.color(PAL.black).cone(x, z, 0.022, 0, 0.07, 4, 0.4);
    g.color(WHITE).sphere(x + 0.006, 0.045, z + 0.006, 0.012, 0);
  }
  // lion enclosure
  deck(g, 0.2, 1.75, 1.3, 2.75, 0.013, 0xb8c46a);
  fence(g, 0.18, 1.72, 1.32, 2.78, 0.05, PAL.wood, 0.012);
  g.color(0x9a958c).pyramid(0.55, 2.2, 0.4, 0.35, 0, 0.15);
  g.color(0xd99a3a);
  g.sphere(0.95, 0.05, 2.3, 0.05, 0, 0.8);
  g.sphere(0.85, 0.045, 2.5, 0.045, 0, 0.8);
  // aviary dome
  dome(g, 2.3, 2.25, 0.38, 0, 0xcfd8dc, 10, 0.9);
  tree(g, r, 1.95, 2.75, 0.9);
  tree(g, r, 2.75, 2.8, 1.1);
  tree(g, r, 2.85, 1.75, 0.8);
};

const stadium: ModelFn = (g, c) => {
  const r = c.rng;
  const cx = 2;
  const cz = 2;
  const outer = 1.86;
  const top = 0.56;
  deck(g, 0.05, 0.05, 3.95, 3.95, 0.012, 0xb9b4aa);
  g.noWin().color(0xd9d4c8);
  g.lathe(cx, cz, [
    [outer, 0],
    [outer, top],
  ], 20, 0, false);
  g.color(0xbfb9ad);
  g.lathe(cx, cz, [
    [outer, top],
    [outer - 0.1, top],
  ], 20, 0, false);
  const seatA = r.pick([0x3f7fd6, 0xd6453d, 0x4caf50, 0xe8873a]);
  g.color(seatA);
  g.lathe(cx, cz, [
    [outer - 0.1, top],
    [1.38, 0.3],
  ], 20, 0, false);
  g.color(shade(seatA, 0.75));
  g.lathe(cx, cz, [
    [1.38, 0.3],
    [1.1, 0.1],
  ], 20, 0, false);
  g.color(0x6a6a6a);
  g.lathe(cx, cz, [
    [1.1, 0.1],
    [1.08, 0.02],
  ], 20, 0, false);
  // pitch
  blob(g, r, cx, cz, 1.09, 1.09, 0.02, 0x5f9a3c, 20, 0);
  deck(g, 1.35, 1.48, 2.65, 2.52, 0.022, 0x79b94c);
  deck(g, 1.35, 1.48, 2.65, 1.5, 0.024, WHITE);
  deck(g, 1.35, 2.5, 2.65, 2.52, 0.024, WHITE);
  deck(g, 1.35, 1.48, 1.37, 2.52, 0.024, WHITE);
  deck(g, 2.63, 1.48, 2.65, 2.52, 0.024, WHITE);
  deck(g, 1.99, 1.48, 2.01, 2.52, 0.024, WHITE);
  // scoreboard
  g.color(PAL.black).box(1.7, top + 0.05, 0.12, 2.3, top + 0.3, 0.18, { win: WIN.SHOP, cellW: 0.15, cellH: 0.12 });
  g.color(PAL.steelDark).box(1.95, top, 0.13, 2.05, top + 0.05, 0.17);
  // floodlights in the corners
  for (const [x, z] of [
    [0.32, 0.32],
    [3.68, 0.32],
    [0.32, 3.68],
    [3.68, 3.68],
  ] as P2[]) {
    g.color(PAL.steel).beam([x, 0, z], [x, 1.05, z], 0.05);
    g.color(0xfff0c0).box(x - 0.1, 1.05, z - 0.1, x + 0.1, 1.14, z + 0.1, { win: WIN.SHOP, cellW: 0.1, cellH: 0.09 });
  }
};

// ----------------------------------------------------------------- rewards

const mayor_house: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xf4ede0, 0xf2f2ee, 0xe8dcc8]);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.charcoal]);
  deck(g, 0.94, 1.1, 1.06, 2.0, 0.013, PATH);
  // main block + wings
  g.color(wall).win(WIN.RES, 0.12, FLOOR);
  g.box(0.5, 0, 0.32, 1.5, FLOOR * 2.2, 0.98, { noTop: true });
  g.box(0.2, 0, 0.42, 0.5, FLOOR * 1.6, 0.92, { noTop: true });
  g.box(1.5, 0, 0.42, 1.8, FLOOR * 1.6, 0.92, { noTop: true });
  g.noWin().color(roof);
  g.hip(0.5, 0.32, 1.5, 0.98, FLOOR * 2.2, 0.18, 0.035);
  g.hip(0.2, 0.42, 0.5, 0.92, FLOOR * 1.6, 0.12, 0.03);
  g.hip(1.5, 0.42, 1.8, 0.92, FLOOR * 1.6, 0.12, 0.03);
  g.color(shade(wall, 0.85));
  g.box(0.7, FLOOR * 2.2 + 0.05, 0.6, 0.76, FLOOR * 2.2 + 0.2, 0.68);
  g.box(1.24, FLOOR * 2.2 + 0.05, 0.6, 1.3, FLOOR * 2.2 + 0.2, 0.68);
  // portico
  columns(g, 0.82, 1.18, 1.07, 0, 0.24, 4, 0.02, WHITE);
  g.color(WHITE).box(0.78, 0.24, 0.96, 1.22, 0.27, 1.12);
  g.color(roof).gable(0.78, 0.96, 1.22, 1.12, 0.27, 0.08, 'z', 0.01, WHITE);
  // garden: fountain, hedges, flowers, trees
  g.color(STONE).cylinder(1.0, 1.5, 0.13, 0, 0.04, 10, WATER);
  g.color(STONE_DARK).cylinder(1.0, 1.5, 0.025, 0.04, 0.12, 6);
  g.color(PAL.hedge);
  g.box(0.25, 0, 1.22, 0.86, 0.05, 1.27);
  g.box(1.14, 0, 1.22, 1.75, 0.05, 1.27);
  g.box(0.25, 0, 1.75, 0.86, 0.05, 1.8);
  g.box(1.14, 0, 1.75, 1.75, 0.05, 1.8);
  for (let i = 0; i < 6; i++) bush(g, r, 0.35 + i * 0.25 + (i >= 3 ? 0.1 : 0), 1.52, 0.7, r.pick(PAL.flower));
  pine(g, r, 0.12, 0.15, 1.1);
  tree(g, r, 1.88, 0.2, 1.1);
  tree(g, r, 0.12, 1.88, 1);
  tree(g, r, 1.88, 1.88, 1);
  g.color(STONE_DARK);
  g.box(0.84, 0, 1.9, 0.9, 0.12, 1.96);
  g.box(1.1, 0, 1.9, 1.16, 0.12, 1.96);
  flag(g, 1.4, 1.1, 0.5, r.pick([PAL.blue, PAL.red, PAL.green]));
};

const city_hall: ModelFn = (g, c) => {
  const r = c.rng;
  const stone = r.pick([STONE, 0xeee6d4, 0xe2d9c4]);
  deck(g, 0.6, 2.3, 2.4, 2.96, 0.013, PATH);
  g.color(stone).win(WIN.CIVIC, 0.14, 0.14);
  g.box(0.25, 0, 0.3, 2.75, 0.42, 1.95, { top: PAL.flatRoof });
  g.noWin().color(shade(stone, 0.92)).box(0.24, 0.42, 0.29, 2.76, 0.46, 1.96, { top: PAL.flatRoof });
  // portico
  columns(g, 1.02, 1.98, 2.18, 0, 0.42, 6, 0.035, stone);
  g.color(shade(stone, 0.95)).box(0.95, 0.42, 1.92, 2.05, 0.48, 2.3);
  g.color(PAL.roofs.slate).gable(0.95, 1.92, 2.05, 2.3, 0.48, 0.17, 'z', 0.015, stone);
  g.color(STONE_DARK).box(1.0, 0, 2.3, 2.0, 0.02, 2.42);
  // drum + dome + lantern
  g.color(stone).cylinder(1.5, 1.1, 0.5, 0.46, 0.72, 12);
  g.color(shade(stone, 0.9)).cylinder(1.5, 1.1, 0.52, 0.72, 0.75, 12);
  dome(g, 1.5, 1.1, 0.48, 0.75, r.pick([COPPER, GOLD, 0x8a9aa8]), 12, 0.85);
  g.color(stone).cylinder(1.5, 1.1, 0.07, 1.15, 1.26, 6);
  g.color(COPPER).cone(1.5, 1.1, 0.09, 1.26, 1.38, 6);
  g.push().translate(0, 1.36, 0);
  flag(g, 1.5, 1.1, 0.22, PAL.blue);
  g.pop();
  for (const x of [0.75, 2.25]) flag(g, x, 2.55, 0.45, r.pick([PAL.red, PAL.blue, PAL.green]));
  tree(g, r, 0.3, 2.6, 1.1);
  tree(g, r, 2.7, 2.6, 1.1);
  lamp(g, 1.0, 2.8, 0.22);
  lamp(g, 2.0, 2.8, 0.22);
};

const statue: ModelFn = (g, c) => {
  const r = c.rng;
  const bronze = r.pick([0x5f8f7a, 0x8a6a3a, 0x6f9a8a]);
  g.noWin().color(STONE_DARK).box(0.24, 0, 0.24, 0.76, 0.04, 0.76);
  g.color(STONE).box(0.36, 0.04, 0.36, 0.64, 0.26, 0.64);
  g.color(STONE_DARK).box(0.34, 0.26, 0.34, 0.66, 0.29, 0.66);
  g.color(bronze);
  g.frustum(0.5, 0.5, 0.07, 0.05, 0.29, 0.47, 6);
  g.sphere(0.5, 0.51, 0.5, 0.036, 0);
  g.cylinder(0.5, 0.5, 0.03, 0.535, 0.56, 6);
  g.beam([0.54, 0.44, 0.5], [0.6, 0.6, 0.5], 0.025);
  g.beam([0.46, 0.44, 0.5], [0.42, 0.33, 0.52], 0.025);
  g.color(GOLD).box(0.585, 0.59, 0.485, 0.615, 0.64, 0.515);
  for (const [x, z] of [
    [0.12, 0.12],
    [0.88, 0.12],
    [0.12, 0.88],
    [0.88, 0.88],
  ] as P2[]) {
    g.color(PAL.hedge).box(x - 0.06, 0, z - 0.06, x + 0.06, 0.06, z + 0.06);
  }
  lamp(g, 0.5, 0.92, 0.2);
};

const landmark_tower: ModelFn = (g, c) => {
  const r = c.rng;
  const main = r.pick([0xf2f2ee, 0xe2e8ec, 0xe8e2d8]);
  const accent = r.pick([PAL.red, 0x2bb3a3, GOLD, PAL.orange]);
  deck(g, 0.08, 0.08, 1.92, 1.92, 0.012, PATH);
  // tripod legs
  g.noWin().color(main);
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + (k * Math.PI * 2) / 3;
    g.beam([1 + Math.cos(a) * 0.78, 0, 1 + Math.sin(a) * 0.78], [1 + Math.cos(a) * 0.1, 2.3, 1 + Math.sin(a) * 0.1], 0.08);
  }
  // shaft
  g.frustum(1, 1, 0.16, 0.1, 0, 4.2, 8);
  // base pavilion
  g.color(0xdfe8ee).win(WIN.GLASS, 0.12, 0.14);
  g.box(0.62, 0, 0.62, 1.38, 0.16, 1.38, { top: main });
  g.noWin();
  // observation pod
  g.color(main);
  g.lathe(1, 1, [
    [0.1, 4.05],
    [0.42, 4.22],
  ], 12, 0, false);
  g.color(GLASS_TINT);
  g.lathe(1, 1, [
    [0.42, 4.22],
    [0.48, 4.36],
  ], 12, 0, false);
  g.color(accent);
  g.lathe(1, 1, [
    [0.48, 4.36],
    [0.4, 4.48],
    [0.16, 4.58],
    [0.08, 4.6],
  ], 12);
  // spire
  g.color(main).cone(1, 1, 0.07, 4.6, 5.9, 6);
  g.color(accent).sphere(1, 5.25, 1, 0.05, 0);
};

const arcology: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.04, 0.04, 3.96, 3.96, 0.012, PATH);
  const tiers = 6;
  const th = 0.72;
  const step = 0.26;
  for (let k = 0; k < tiers; k++) {
    const inset = 0.12 + k * step;
    const y0 = k * th;
    const y1 = y0 + th;
    g.color(k % 2 ? 0xe2eaef : 0xd2dde5).win(WIN.GLASS, 0.12, FLOOR);
    g.box(inset, y0, inset, 4 - inset, y1, 4 - inset, { top: 0x7fae5a });
    if (k < tiers - 1) {
      g.noWin();
      const m = inset + step * 0.5;
      const pts: P2[] = [
        [m, m],
        [4 - m, m],
        [m, 4 - m],
        [4 - m, 4 - m],
        [2, m],
        [2, 4 - m],
        [m, 2],
        [4 - m, 2],
      ];
      for (const [x, z] of pts) {
        g.color(r.pick(PAL.leaf)).cone(x, z, 0.1, y1, y1 + 0.24, 6, r.next() * 3);
      }
    }
  }
  const topY = tiers * th;
  dome(g, 2, 2, 0.5, topY, 0x9fd0e0, 12, 0.7);
  g.color(0xe8ecef).cone(2, 2, 0.08, topY + 0.3, topY + 1.4, 6);
  g.color(PAL.red).sphere(2, topY + 1.42, 2, 0.04, 0);
};

const casino: ModelFn = (g, c) => {
  const r = c.rng;
  const body = r.pick([0x9b2335, 0x6a2c8f, 0x1f3f8f]);
  deck(g, 0.08, 1.4, 1.92, 1.95, 0.012, 0x8a2b3a);
  g.color(body).win(WIN.SHOP, 0.2, 0.26);
  g.box(0.15, 0, 0.35, 1.85, 0.26, 1.35, { top: PAL.flatRoofDark });
  g.noWin().color(GOLD).box(0.14, 0.26, 0.34, 1.86, 0.3, 1.36, { top: PAL.flatRoof });
  // hotel tower
  g.color(GOLD).win(WIN.GLASS, 0.1, FLOOR);
  g.box(0.22, 0, 0.4, 0.82, 1.3, 0.95, { noTop: true });
  g.noWin().color(shade(GOLD, 0.85)).pyramid(0.52, 0.675, 0.6, 0.55, 1.3, 0.25);
  // entrance canopy
  g.color(GOLD).box(0.95, 0.16, 1.35, 1.55, 0.19, 1.62);
  g.color(PAL.steelDark);
  g.box(0.97, 0, 1.58, 0.99, 0.16, 1.6, { noTop: true });
  g.box(1.51, 0, 1.58, 1.53, 0.16, 1.6, { noTop: true });
  // big sign (lit at night)
  g.color(PAL.black).box(1.64, 0, 1.55, 1.71, 0.5, 1.62, { noTop: true });
  g.color(r.pick([0xe86a92, PAL.yellow, 0xf2a93b])).box(1.5, 0.5, 1.56, 1.86, 0.8, 1.62, { win: WIN.SHOP, cellW: 0.09, cellH: 0.075 });
  g.noWin().color(PAL.yellow).sphere(1.68, 0.86, 1.59, 0.05, 0);
  // fountain + palms
  g.color(STONE).cylinder(0.5, 1.68, 0.18, 0, 0.04, 10, WATER);
  g.color(0xbfe6f5).cone(0.5, 1.68, 0.03, 0.04, 0.2, 6);
  palm(g, r, 0.15, 1.5, 1.1);
  palm(g, r, 0.85, 1.85, 1.0);
  palm(g, r, 1.9, 0.2, 1.1);
};

const prison: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xa9a49a, 0x9a958c, 0xb5b0a6]);
  deck(g, 0.2, 0.2, 2.8, 2.8, 0.013, 0x9a9488);
  // perimeter wall with front gate
  g.noWin().color(wall);
  g.box(0.1, 0, 0.1, 2.9, 0.3, 0.18);
  g.box(0.1, 0, 0.1, 0.18, 0.3, 2.9);
  g.box(2.82, 0, 0.1, 2.9, 0.3, 2.9);
  g.box(0.1, 0, 2.82, 1.3, 0.3, 2.9);
  g.box(1.7, 0, 2.82, 2.9, 0.3, 2.9);
  g.color(0x3a3c40).box(1.3, 0, 2.84, 1.7, 0.26, 2.88);
  // guard towers
  for (const [x, z] of [
    [0.14, 0.14],
    [2.86, 0.14],
    [0.14, 2.86],
    [2.86, 2.86],
  ] as P2[]) {
    g.color(wall).box(x - 0.09, 0, z - 0.09, x + 0.09, 0.5, z + 0.09);
    g.color(0xd8d4cc).win(WIN.IND, 0.08, 0.08);
    g.box(x - 0.13, 0.5, z - 0.13, x + 0.13, 0.62, z + 0.13, { noTop: true });
    g.noWin().color(PAL.roofs.charcoal).pyramid(x, z, 0.3, 0.3, 0.62, 0.08);
  }
  // cell blocks
  g.color(shade(wall, 1.08)).win(WIN.IND, 0.1, FLOOR);
  g.box(0.45, 0, 0.42, 2.55, 0.42, 0.95, { top: PAL.flatRoof });
  g.box(0.45, 0, 1.2, 1.35, 0.32, 2.4, { top: PAL.flatRoof });
  g.noWin();
  // yard with basketball court
  deck(g, 1.6, 1.25, 2.55, 2.35, 0.015, 0x7d848a);
  deck(g, 2.06, 1.25, 2.08, 2.35, 0.017, WHITE);
  g.color(PAL.steelDark).beam([2.07, 0, 1.3], [2.07, 0.12, 1.3], 0.012);
  g.color(PAL.steelDark).beam([2.07, 0, 2.3], [2.07, 0.12, 2.3], 0.012);
};

const toxic_dump: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.1, 0.1, 2.9, 2.9, 0.013, 0x8a8a5a);
  fence(g, 0.06, 0.06, 2.94, 2.94, 0.08, PAL.steel, 0.01, [1.35, 1.65]);
  blob(g, r, 0.9, 0.85, 0.55, 0.42, 0.016, 0x9be33a, 10, 0.25);
  blob(g, r, 2.1, 2.0, 0.45, 0.4, 0.016, 0xb6e03a, 10, 0.25);
  g.emitter(0.9, 0.05, 0.85, 'dark');
  g.emitter(2.1, 0.05, 2.0, 'dark');
  g.color(0x7a6a4a).pyramid(2.2, 0.7, 0.7, 0.6, 0, 0.18);
  g.color(0x6a5a3a).pyramid(0.75, 2.2, 0.5, 0.6, 0, 0.14);
  // barrel clusters
  const barrel = [0xe8c53a, 0xd9a82a, 0x8a5a3a, 0x4f7f3f];
  for (const [bx, bz] of [
    [1.55, 0.6],
    [0.55, 1.6],
    [2.3, 1.2],
  ] as P2[]) {
    for (let i = 0; i < 7; i++) {
      const x = bx + (i % 3) * 0.085 + (r.next() - 0.5) * 0.02;
      const z = bz + Math.floor(i / 3) * 0.085 + (r.next() - 0.5) * 0.02;
      g.color(r.pick(barrel)).cylinder(x, z, 0.035, 0, 0.09, 6);
    }
  }
  // warning sign
  g.color(PAL.steelDark);
  g.box(1.2, 0, 2.86, 1.22, 0.2, 2.88, { noTop: true });
  g.box(1.32, 0, 2.86, 1.34, 0.2, 2.88, { noTop: true });
  g.color(PAL.yellow).box(1.17, 0.14, 2.88, 1.37, 0.26, 2.9);
  g.color(PAL.black).box(1.25, 0.17, 2.9, 1.29, 0.23, 2.906);
};

export const PLOP_MODELS: Record<string, ModelFn> = {
  rotor_blades,
  bus_stop,
  train_station,
  seaport,
  airport,
  coal_plant,
  oil_plant,
  gas_plant,
  nuclear_plant,
  wind_turbine,
  solar_plant,
  microwave_plant,
  fusion_plant,
  water_pump,
  water_tower,
  water_treatment,
  desalination,
  incinerator,
  waste_to_energy,
  recycling_center,
  police_station,
  fire_station,
  clinic,
  hospital,
  school,
  college,
  library,
  museum,
  small_park,
  plaza,
  playground,
  sports_field,
  large_park,
  marina,
  zoo,
  stadium,
  mayor_house,
  city_hall,
  statue,
  landmark_tower,
  arcology,
  casino,
  prison,
  toxic_dump,
};
