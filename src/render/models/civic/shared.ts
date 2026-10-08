/**
 * Shared helpers and colours for the ploppable (player-placed) building models.
 *
 * Conventions: footprint x∈[0,w], z∈[0,h], ground at y=0, front faces +z.
 * Shore buildings (seaport, marina, desalination) put their water side on +z.
 */
import { type GeometryBuilder, type V3, WIN } from '../../geom';
import { PAL } from '../../palette';
import type { Rng } from '../../../util/rng';

export type G = GeometryBuilder;
export type P2 = [number, number];

export const STONE = 0xe8e0cc;
export const STONE_DARK = 0xc8bea8;
export const COPPER = 0x6fae9a;
export const GOLD = 0xd9b44a;
export const WATER = 0x4aa8d0;
export const GRASS = 0x86bd52;
export const PATH = 0xd9cfb4;
export const WHITE = 0xf4f4ef;
export const ASPHALT = PAL.asphalt;
export const GLASS_TINT = 0x5f8fb0;

// ------------------------------------------------------------------ helpers

/** Flat decal that tolerates swapped corners. */
export function deck(g: G, x0: number, z0: number, x1: number, z1: number, y: number, hex: number): void {
  g.rect(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y, hex);
}

/** Extruded convex polygon given as an outline in the xz plane. */
export function prism(g: G, pts: P2[], y0: number, y1: number, topHex?: number): void {
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
export function blob(g: G, r: Rng, cx: number, cz: number, rx: number, rz: number, y: number, hex: number, n = 10, jitter = 0.18): void {
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

export function tree(g: G, r: Rng, x: number, z: number, s = 1): void {
  g.noWin().color(PAL.trunk);
  g.box(x - 0.016 * s, 0, z - 0.016 * s, x + 0.016 * s, 0.09 * s, z + 0.016 * s, { noTop: true });
  g.color(r.pick(PAL.leaf));
  g.sphere(x, 0.155 * s, z, 0.085 * s, 0, 1.05);
}

export function pine(g: G, r: Rng, x: number, z: number, s = 1): void {
  g.noWin().color(PAL.trunk);
  g.box(x - 0.014 * s, 0, z - 0.014 * s, x + 0.014 * s, 0.06 * s, z + 0.014 * s, { noTop: true });
  g.color(r.pick(PAL.conifer));
  g.cone(x, z, 0.085 * s, 0.05 * s, 0.22 * s, 6, r.next() * 3);
  g.cone(x, z, 0.06 * s, 0.15 * s, 0.32 * s, 6, r.next() * 3);
}

/** Random round or conifer tree. */
export function anyTree(g: G, r: Rng, x: number, z: number, s = 1): void {
  if (r.chance(0.7)) tree(g, r, x, z, s);
  else pine(g, r, x, z, s);
}

export function bush(g: G, r: Rng, x: number, z: number, s = 1, hex?: number): void {
  g.noWin().color(hex ?? r.pick(PAL.leaf));
  g.sphere(x, 0.022 * s, z, 0.045 * s, 0, 0.7);
}

export function palm(g: G, r: Rng, x: number, z: number, s = 1): void {
  g.noWin().color(0x8a6a48);
  g.beam([x, 0, z], [x + 0.03 * s, 0.28 * s, z], 0.025 * s);
  g.color(r.pick([0x4f9a3c, 0x5fae45, 0x3f8a36]));
  g.lathe(
    x + 0.03 * s,
    z,
    [
      [0.15 * s, 0.24 * s],
      [0, 0.31 * s],
    ],
    6,
    r.next() * 3,
  );
}

export function car(g: G, x: number, z: number, hex: number, alongX = true, len = 0.2): void {
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

export function policeCar(g: G, x: number, z: number, alongX = true): void {
  car(g, x, z, 0xf4f4f4, alongX);
  g.color(PAL.red).box(x - 0.022, 0.08, z - 0.012, x, 0.092, z + 0.012);
  g.color(PAL.blue).box(x, 0.08, z - 0.012, x + 0.022, 0.092, z + 0.012);
}

/** Truck/bus: body + cab at the "forward" (+axis) end. */
export function truck(g: G, x: number, z: number, body: number, cab: number, alongX = true, len = 0.3, h = 0.09): void {
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

export function bench(g: G, x: number, z: number, alongX = true): void {
  g.noWin().color(PAL.wood);
  if (alongX) g.box(x - 0.05, 0.016, z - 0.012, x + 0.05, 0.028, z + 0.012);
  else g.box(x - 0.012, 0.016, z - 0.05, x + 0.012, 0.028, z + 0.05);
}

/** Street lamp; the head uses a window style so it glows at night. */
export function lamp(g: G, x: number, z: number, h = 0.2): void {
  g.noWin().color(PAL.steelDark);
  g.box(x - 0.007, 0, z - 0.007, x + 0.007, h, z + 0.007, { noTop: true });
  g.color(0xfff0c0);
  g.box(x - 0.018, h, z - 0.018, x + 0.018, h + 0.024, z + 0.018, { win: WIN.SHOP, cellW: 0.036, cellH: 0.024 });
}

export function flag(g: G, x: number, z: number, h: number, hex: number): void {
  g.noWin().color(0xd8d8d8);
  g.box(x - 0.006, 0, z - 0.006, x + 0.006, h, z + 0.006, { noTop: true });
  g.color(hex);
  g.panel([x + 0.006, h - 0.075, z], [x + 0.11, h - 0.075, z], [x + 0.11, h - 0.006, z], [x + 0.006, h - 0.006, z]);
}

/** Rectangular fence; optional gap in the front (+z) side. */
export function fence(g: G, x0: number, z0: number, x1: number, z1: number, h: number, hex: number, t = 0.012, gap?: P2): void {
  g.noWin().color(hex);
  g.box(x0, 0, z0, x1, h, z0 + t);
  g.box(x0, 0, z0, x0 + t, h, z1);
  g.box(x1 - t, 0, z0, x1, h, z1);
  if (gap) {
    if (gap[0] > x0) g.box(x0, 0, z1 - t, gap[0], h, z1);
    if (gap[1] < x1) g.box(gap[1], 0, z1 - t, x1, h, z1);
  } else g.box(x0, 0, z1 - t, x1, h, z1);
}

export function columns(g: G, x0: number, x1: number, z: number, y0: number, y1: number, n: number, r: number, hex: number): void {
  g.noWin().color(hex);
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
    g.cylinder(x, z, r, y0, y1, 6);
  }
}

/** Red cross on a wall facing +z at depth zf. */
export function redCross(g: G, cx: number, cy: number, zf: number, s: number): void {
  g.noWin().color(PAL.red);
  g.box(cx - s * 0.17, cy - s * 0.5, zf, cx + s * 0.17, cy + s * 0.5, zf + 0.012);
  g.box(cx - s * 0.5, cy - s * 0.17, zf, cx + s * 0.5, cy + s * 0.17, zf + 0.012);
}

/** Banded factory chimney with a smoke emitter on top. */
export function chimney(
  g: G,
  x: number,
  z: number,
  r0: number,
  r1: number,
  h: number,
  hex: number,
  band: number,
  kind: 'smoke' | 'steam' | 'dark' = 'smoke',
): void {
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

export function tank(g: G, x: number, z: number, r: number, h: number, hex: number, segs = 10): void {
  g.noWin().color(hex);
  g.lathe(
    x,
    z,
    [
      [r, 0],
      [r, h],
      [r * 0.75, h + r * 0.12],
      [0, h + r * 0.16],
    ],
    segs,
  );
}

/** Lattice transmission tower. */
export function pylon(g: G, x: number, z: number, h: number): void {
  g.noWin().color(PAL.steel);
  const b = 0.07;
  const t = 0.012;
  g.beam([x - b, 0, z - b], [x, h, z], t);
  g.beam([x + b, 0, z - b], [x, h, z], t);
  g.beam([x - b, 0, z + b], [x, h, z], t);
  g.beam([x + b, 0, z + b], [x, h, z], t);
  g.beam([x - 0.12, h * 0.85, z], [x + 0.12, h * 0.85, z], t);
}

export function boat(g: G, r: Rng, x: number, z0: number, len: number, w: number, sail: boolean): void {
  const hull = r.pick([0xf4f4ef, 0xe8e4dc, 0x3f6fb0, 0xd6453d]);
  g.noWin().color(hull);
  prism(
    g,
    [
      [x - w / 2, z0],
      [x + w / 2, z0],
      [x + w / 2, z0 + len * 0.7],
      [x, z0 + len],
      [x - w / 2, z0 + len * 0.7],
    ],
    -0.1,
    -0.02,
    0xd9cfb4,
  );
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

export function airplane(g: G, x: number, z: number, len: number, yaw: number, tail: number): void {
  g.push().noWin();
  g.translate(x, 0, z).rotateY(yaw);
  const y = 0.075;
  const rr = len * 0.06;
  g.color(0xf2f2f0);
  g.cylinderX(-len * 0.45, len * 0.42, y, 0, rr, 6);
  g.sphere(len * 0.42, y, 0, rr, 0, 1);
  // swept wings
  prism(
    g,
    [
      [len * 0.08, 0],
      [-len * 0.14, -len * 0.48],
      [-len * 0.22, -len * 0.48],
      [-len * 0.12, 0],
    ],
    y - 0.008,
    y + 0.004,
  );
  prism(
    g,
    [
      [len * 0.08, 0],
      [-len * 0.12, 0],
      [-len * 0.22, len * 0.48],
      [-len * 0.14, len * 0.48],
    ],
    y - 0.008,
    y + 0.004,
  );
  // engines
  g.color(0xb8bec4);
  g.cylinderX(-len * 0.06, len * 0.06, y - 0.03, -len * 0.2, len * 0.03, 5);
  g.cylinderX(-len * 0.06, len * 0.06, y - 0.03, len * 0.2, len * 0.03, 5);
  // stabilisers
  g.color(0xf2f2f0);
  prism(
    g,
    [
      [-len * 0.36, 0],
      [-len * 0.46, -len * 0.16],
      [-len * 0.5, -len * 0.16],
      [-len * 0.45, 0],
    ],
    y,
    y + 0.006,
  );
  prism(
    g,
    [
      [-len * 0.36, 0],
      [-len * 0.45, 0],
      [-len * 0.5, len * 0.16],
      [-len * 0.46, len * 0.16],
    ],
    y,
    y + 0.006,
  );
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
export function dome(g: G, x: number, z: number, r: number, y: number, hex: number, segs = 12, squash = 1): void {
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
