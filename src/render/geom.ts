/**
 * GeometryBuilder: emits flat-shaded, vertex-coloured triangles for the
 * procedural low-poly models. Coordinates are in tile units (1 = one tile),
 * y up. Models are authored in a local footprint space x∈[0,w], z∈[0,h] with
 * the "front" of the building facing +z.
 *
 * Every vertex also carries:
 *   - wall (u,v): window-cell coordinates (integer cells per wall), used by
 *     the building shader to draw window grids procedurally.
 *   - win: window style (see WIN), 0 = plain surface.
 */
export type V3 = [number, number, number];

export const WIN = {
  NONE: 0,
  RES: 1, // small, separated residential windows
  OFFICE: 2, // wide office windows in horizontal bands
  GLASS: 3, // glass curtain wall
  IND: 4, // high strip windows (industrial)
  SHOP: 5, // big ground-floor shop windows
  CIVIC: 6, // tall narrow windows
} as const;

/** Standard floor height in tile units. */
export const FLOOR = 0.13;

export interface Emitter {
  x: number;
  y: number;
  z: number;
  kind: 'smoke' | 'steam' | 'dark';
}

export interface Rotor {
  x: number;
  y: number;
  z: number;
  r: number;
  /** Yaw (radians) of the rotor axis; 0 means the blades face +z. */
  yaw: number;
}

export interface ModelMesh {
  count: number;
  position: Float32Array;
  normal: Int8Array;
  color: Uint8Array;
  wall: Float32Array;
  win: Uint8Array;
  height: number;
  emitters: Emitter[];
  rotors: Rotor[];
}

export interface BoxOpts {
  /** Colour of the top face (defaults to current colour). */
  top?: number;
  /** Skip the top face. */
  noTop?: boolean;
  /** Emit the bottom face (normally hidden). */
  bottom?: boolean;
  /** Window style override for the side faces. */
  win?: number;
  /** Per-side window cell size override. */
  cellW?: number;
  cellH?: number;
}

export function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

/** Multiply an sRGB hex colour by a factor (simple shade/tint). */
export function shade(hex: number, f: number): number {
  const [r, g, b] = hexToRgb(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

/** Linear mix between two sRGB hex colours. */
export function mixHex(a: number, b: number, t: number): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return (m(r1, r2) << 16) | (m(g1, g2) << 8) | m(b1, b2);
}

export class GeometryBuilder {
  private P: number[] = [];
  private N: number[] = [];
  private C: number[] = [];
  private W: number[] = [];
  private S: number[] = [];
  private col: [number, number, number] = [200, 200, 200];
  private winStyle = 0;
  private cellW = 0.14;
  private cellH = FLOOR;
  // Affine transform: 3x3 (row-major) + translation.
  private m: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  private stack: { m: number[]; col: [number, number, number]; win: number; cw: number; ch: number }[] = [];
  emitters: Emitter[] = [];
  rotors: Rotor[] = [];
  maxY = 0;

  // ---------------------------------------------------------------- state

  color(hex: number): this {
    this.col = hexToRgb(hex);
    return this;
  }

  /** Set the window style for subsequent walls (box sides, wallQuad). */
  win(style: number, cellW = 0.14, cellH = FLOOR): this {
    this.winStyle = style;
    this.cellW = cellW;
    this.cellH = cellH;
    return this;
  }

  noWin(): this {
    this.winStyle = 0;
    return this;
  }

  push(): this {
    this.stack.push({ m: this.m.slice(), col: [...this.col], win: this.winStyle, cw: this.cellW, ch: this.cellH });
    return this;
  }

  pop(): this {
    const s = this.stack.pop();
    if (s) {
      this.m = s.m;
      this.col = s.col;
      this.winStyle = s.win;
      this.cellW = s.cw;
      this.cellH = s.ch;
    }
    return this;
  }

  translate(x: number, y: number, z: number): this {
    const m = this.m;
    m[9] += m[0] * x + m[1] * y + m[2] * z;
    m[10] += m[3] * x + m[4] * y + m[5] * z;
    m[11] += m[6] * x + m[7] * y + m[8] * z;
    return this;
  }

  /** Rotate subsequent geometry around the local Y axis. */
  rotateY(rad: number): this {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const m = this.m;
    // M = M * R, R = [c 0 s; 0 1 0; -s 0 c]
    const r0 = m[0] * c - m[2] * s;
    const r2 = m[0] * s + m[2] * c;
    const r3 = m[3] * c - m[5] * s;
    const r5 = m[3] * s + m[5] * c;
    const r6 = m[6] * c - m[8] * s;
    const r8 = m[6] * s + m[8] * c;
    m[0] = r0;
    m[2] = r2;
    m[3] = r3;
    m[5] = r5;
    m[6] = r6;
    m[8] = r8;
    return this;
  }

  scale(sx: number, sy = sx, sz = sx): this {
    const m = this.m;
    m[0] *= sx;
    m[3] *= sx;
    m[6] *= sx;
    m[1] *= sy;
    m[4] *= sy;
    m[7] *= sy;
    m[2] *= sz;
    m[5] *= sz;
    m[8] *= sz;
    return this;
  }

  private tx(p: V3): V3 {
    const m = this.m;
    return [
      m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[9],
      m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + m[10],
      m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + m[11],
    ];
  }

  // ------------------------------------------------------------ emission

  private emitTri(a: V3, b: V3, c: V3, style: number, wa?: number[], wb?: number[], wc?: number[]): void {
    const A = this.tx(a);
    const B = this.tx(b);
    const Cc = this.tx(c);
    const ux = B[0] - A[0];
    const uy = B[1] - A[1];
    const uz = B[2] - A[2];
    const vx = Cc[0] - A[0];
    const vy = Cc[1] - A[1];
    const vz = Cc[2] - A[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) return; // degenerate
    nx /= len;
    ny /= len;
    nz /= len;
    const n0 = Math.round(nx * 127);
    const n1 = Math.round(ny * 127);
    const n2 = Math.round(nz * 127);
    for (const [p, w] of [
      [A, wa],
      [B, wb],
      [Cc, wc],
    ] as [V3, number[] | undefined][]) {
      this.P.push(p[0], p[1], p[2]);
      this.N.push(n0, n1, n2);
      this.C.push(this.col[0], this.col[1], this.col[2]);
      if (w && style) {
        this.W.push(w[0], w[1]);
        this.S.push(style);
      } else {
        this.W.push(0, 0);
        this.S.push(0);
      }
      if (p[1] > this.maxY) this.maxY = p[1];
    }
  }

  /** Raw triangle; vertices must be counter-clockwise seen from the front. */
  tri(a: V3, b: V3, c: V3): this {
    this.emitTri(a, b, c, 0);
    return this;
  }

  /** Raw quad a-b-c-d, counter-clockwise seen from the front. */
  quad(a: V3, b: V3, c: V3, d: V3): this {
    this.emitTri(a, b, c, 0);
    this.emitTri(a, c, d, 0);
    return this;
  }

  /**
   * Wall quad with window coordinates: a=bottom-left, b=bottom-right,
   * c=top-right, d=top-left seen from outside. Uses the current window style.
   */
  wallQuad(a: V3, b: V3, c: V3, d: V3, style = this.winStyle, cellW = this.cellW, cellH = this.cellH): this {
    if (!style) return this.quad(a, b, c, d);
    const width = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const height = Math.abs(d[1] - a[1]);
    // ledges, kerbs and parapets are too low to hold a window
    if (height < cellH * 0.55 || width < cellW * 0.45) return this.quad(a, b, c, d);
    const nx = Math.max(1, Math.round(width / cellW));
    const ny = Math.max(1, Math.round(height / cellH));
    const w0 = [0, 0];
    const w1 = [nx, 0];
    const w2 = [nx, ny];
    const w3 = [0, ny];
    this.emitTri(a, b, c, style, w0, w1, w2);
    this.emitTri(a, c, d, style, w0, w2, w3);
    return this;
  }

  /**
   * Convex planar polygon, automatically oriented so that its normal points
   * along `hint` (an approximate outward direction).
   */
  face(pts: V3[], hint: V3): this {
    if (pts.length < 3) return this;
    // Compute polygon normal (Newell) in local space.
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      nx += (p[1] - q[1]) * (p[2] + q[2]);
      ny += (p[2] - q[2]) * (p[0] + q[0]);
      nz += (p[0] - q[0]) * (p[1] + q[1]);
    }
    const flip = nx * hint[0] + ny * hint[1] + nz * hint[2] < 0;
    const list = flip ? pts.slice().reverse() : pts;
    for (let i = 1; i < list.length - 1; i++) this.emitTri(list[0], list[i], list[i + 1], 0);
    return this;
  }

  /** Double-sided thin panel (signs, solar panels, fences). */
  panel(a: V3, b: V3, c: V3, d: V3): this {
    this.quad(a, b, c, d);
    this.quad(d, c, b, a);
    return this;
  }

  // ----------------------------------------------------------- primitives

  /** Axis-aligned box. Side faces get window coordinates when a window style is active. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o: BoxOpts = {}): this {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    const style = o.win ?? this.winStyle;
    const cw = o.cellW ?? this.cellW;
    const ch = o.cellH ?? this.cellH;
    // front (+z)
    this.wallQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], style, cw, ch);
    // back (-z)
    this.wallQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], style, cw, ch);
    // right (+x)
    this.wallQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], style, cw, ch);
    // left (-x)
    this.wallQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], style, cw, ch);
    if (!o.noTop) {
      const saved = this.col;
      if (o.top !== undefined) this.col = hexToRgb(o.top);
      this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
      this.col = saved;
    }
    if (o.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    return this;
  }

  /** Box given by centre (x,z), size (w,d) and vertical span. */
  boxC(cx: number, cz: number, w: number, d: number, y0: number, y1: number, o: BoxOpts = {}): this {
    return this.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y1, cz + d / 2, o);
  }

  /** Flat horizontal rectangle (ground decal, roof patch) facing up. */
  rect(x0: number, z0: number, x1: number, z1: number, y: number, hex?: number): this {
    const saved = this.col;
    if (hex !== undefined) this.col = hexToRgb(hex);
    this.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
    this.col = saved;
    return this;
  }

  /**
   * Gable roof over [x0,x1]×[z0,z1] starting at height y with ridge height h.
   * axis = 'x': ridge runs along x. Overhang extends the eaves.
   */
  gable(x0: number, z0: number, x1: number, z1: number, y: number, h: number, axis: 'x' | 'z' = 'x', overhang = 0.03, gableHex?: number): this {
    const o = overhang;
    const top = y + h;
    const gcol = gableHex;
    if (axis === 'x') {
      const zm = (z0 + z1) / 2;
      // slopes
      this.face([[x0 - o, y, z1 + o], [x1 + o, y, z1 + o], [x1 + o, top, zm], [x0 - o, top, zm]], [0, 1, 1]);
      this.face([[x1 + o, y, z0 - o], [x0 - o, y, z0 - o], [x0 - o, top, zm], [x1 + o, top, zm]], [0, 1, -1]);
      const saved = this.col;
      if (gcol !== undefined) this.col = hexToRgb(gcol);
      this.face([[x1, y, z1], [x1, y, z0], [x1, top, zm]], [1, 0, 0]);
      this.face([[x0, y, z0], [x0, y, z1], [x0, top, zm]], [-1, 0, 0]);
      this.col = saved;
    } else {
      const xm = (x0 + x1) / 2;
      this.face([[x1 + o, y, z0 - o], [x1 + o, y, z1 + o], [xm, top, z1 + o], [xm, top, z0 - o]], [1, 1, 0]);
      this.face([[x0 - o, y, z1 + o], [x0 - o, y, z0 - o], [xm, top, z0 - o], [xm, top, z1 + o]], [-1, 1, 0]);
      const saved = this.col;
      if (gcol !== undefined) this.col = hexToRgb(gcol);
      this.face([[x0, y, z1], [x1, y, z1], [xm, top, z1]], [0, 0, 1]);
      this.face([[x1, y, z0], [x0, y, z0], [xm, top, z0]], [0, 0, -1]);
      this.col = saved;
    }
    return this;
  }

  /** Hip roof: four sloped faces meeting at a ridge (or a point if square). */
  hip(x0: number, z0: number, x1: number, z1: number, y: number, h: number, overhang = 0.03): this {
    const o = overhang;
    x0 -= o;
    z0 -= o;
    x1 += o;
    z1 += o;
    const w = x1 - x0;
    const d = z1 - z0;
    const top = y + h;
    if (Math.abs(w - d) < 1e-6) {
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      this.face([[x0, y, z1], [x1, y, z1], [cx, top, cz]], [0, 1, 1]);
      this.face([[x1, y, z1], [x1, y, z0], [cx, top, cz]], [1, 1, 0]);
      this.face([[x1, y, z0], [x0, y, z0], [cx, top, cz]], [0, 1, -1]);
      this.face([[x0, y, z0], [x0, y, z1], [cx, top, cz]], [-1, 1, 0]);
    } else if (w > d) {
      const zm = (z0 + z1) / 2;
      const inset = d / 2;
      const rx0 = x0 + inset;
      const rx1 = x1 - inset;
      this.face([[x0, y, z1], [x1, y, z1], [rx1, top, zm], [rx0, top, zm]], [0, 1, 1]);
      this.face([[x1, y, z0], [x0, y, z0], [rx0, top, zm], [rx1, top, zm]], [0, 1, -1]);
      this.face([[x1, y, z1], [x1, y, z0], [rx1, top, zm]], [1, 1, 0]);
      this.face([[x0, y, z0], [x0, y, z1], [rx0, top, zm]], [-1, 1, 0]);
    } else {
      const xm = (x0 + x1) / 2;
      const inset = w / 2;
      const rz0 = z0 + inset;
      const rz1 = z1 - inset;
      this.face([[x1, y, z0], [x1, y, z1], [xm, top, rz1], [xm, top, rz0]], [1, 1, 0]);
      this.face([[x0, y, z1], [x0, y, z0], [xm, top, rz0], [xm, top, rz1]], [-1, 1, 0]);
      this.face([[x0, y, z1], [x1, y, z1], [xm, top, rz1]], [0, 1, 1]);
      this.face([[x1, y, z0], [x0, y, z0], [xm, top, rz0]], [0, 1, -1]);
    }
    return this;
  }

  /** Single-slope (shed) roof rising toward -z (or +z if `towardFront`). */
  shed(x0: number, z0: number, x1: number, z1: number, y: number, h: number, towardFront = false): this {
    const yb = towardFront ? y : y + h;
    const yf = towardFront ? y + h : y;
    this.face([[x0, yf, z1], [x1, yf, z1], [x1, yb, z0], [x0, yb, z0]], [0, 1, 0]);
    // side triangles + high wall
    this.face([[x1, y, z1], [x1, y, z0], [x1, yb, z0], [x1, yf, z1]], [1, 0, 0]);
    this.face([[x0, y, z0], [x0, y, z1], [x0, yf, z1], [x0, yb, z0]], [-1, 0, 0]);
    if (towardFront) this.face([[x0, y, z1], [x1, y, z1], [x1, yf, z1], [x0, yf, z1]], [0, 0, 1]);
    else this.face([[x1, y, z0], [x0, y, z0], [x0, yb, z0], [x1, yb, z0]], [0, 0, -1]);
    return this;
  }

  /** Square pyramid / spire. */
  pyramid(cx: number, cz: number, w: number, d: number, y: number, h: number): this {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    const t: V3 = [cx, y + h, cz];
    this.face([[x0, y, z1], [x1, y, z1], t], [0, 1, 1]);
    this.face([[x1, y, z1], [x1, y, z0], t], [1, 1, 0]);
    this.face([[x1, y, z0], [x0, y, z0], t], [0, 1, -1]);
    this.face([[x0, y, z0], [x0, y, z1], t], [-1, 1, 0]);
    return this;
  }

  /**
   * Surface of revolution. profile: [radius, y] pairs from bottom to top.
   * A radius of 0 closes the shape at that point.
   */
  lathe(cx: number, cz: number, profile: [number, number][], segs = 8, phase = 0, capTop = true): this {
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, y0] = profile[i];
      const [r1, y1] = profile[i + 1];
      const dr = r1 - r0;
      const dy = y1 - y0;
      for (let s = 0; s < segs; s++) {
        const a0 = phase + (s / segs) * Math.PI * 2;
        const a1 = phase + ((s + 1) / segs) * Math.PI * 2;
        const am = (a0 + a1) / 2;
        const c0 = Math.cos(a0);
        const s0 = Math.sin(a0);
        const c1 = Math.cos(a1);
        const s1 = Math.sin(a1);
        const hint: V3 = [Math.cos(am) * dy, -dr, Math.sin(am) * dy];
        if (Math.abs(hint[0]) + Math.abs(hint[1]) + Math.abs(hint[2]) < 1e-9) continue;
        const p00: V3 = [cx + c0 * r0, y0, cz + s0 * r0];
        const p01: V3 = [cx + c1 * r0, y0, cz + s1 * r0];
        const p10: V3 = [cx + c0 * r1, y1, cz + s0 * r1];
        const p11: V3 = [cx + c1 * r1, y1, cz + s1 * r1];
        if (r0 < 1e-6) this.face([p00, p11, p10], hint);
        else if (r1 < 1e-6) this.face([p00, p01, p10], hint);
        else this.face([p00, p01, p11, p10], hint);
      }
    }
    const [rt, yt] = profile[profile.length - 1];
    if (capTop && rt > 1e-6) {
      const pts: V3[] = [];
      for (let s = 0; s < segs; s++) {
        const a = phase + (s / segs) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rt, yt, cz + Math.sin(a) * rt]);
      }
      this.face(pts, [0, 1, 0]);
    }
    return this;
  }

  /** Vertical cylinder (prism with `segs` sides). */
  cylinder(cx: number, cz: number, r: number, y0: number, y1: number, segs = 8, topHex?: number): this {
    this.lathe(cx, cz, [
      [r, y0],
      [r, y1],
    ], segs, 0, false);
    const saved = this.col;
    if (topHex !== undefined) this.col = hexToRgb(topHex);
    const pts: V3[] = [];
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, y1, cz + Math.sin(a) * r]);
    }
    this.face(pts, [0, 1, 0]);
    this.col = saved;
    return this;
  }

  /** Cone from radius r at y0 to a point at y1. */
  cone(cx: number, cz: number, r: number, y0: number, y1: number, segs = 6, phase = 0): this {
    return this.lathe(cx, cz, [
      [r, y0],
      [0, y1],
    ], segs, phase);
  }

  /** Truncated cone (frustum) with a top cap. */
  frustum(cx: number, cz: number, r0: number, r1: number, y0: number, y1: number, segs = 8): this {
    return this.lathe(cx, cz, [
      [r0, y0],
      [r1, y1],
    ], segs);
  }

  /** Horizontal cylinder along the x axis (pipes, tanks lying down). */
  cylinderX(x0: number, x1: number, cy: number, cz: number, r: number, segs = 6): this {
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p = (x: number, a: number): V3 => [x, cy + Math.sin(a) * r, cz + Math.cos(a) * r];
      this.face([p(x0, a0), p(x1, a0), p(x1, a1), p(x0, a1)], [0, Math.sin(am), Math.cos(am)]);
    }
    const capA: V3[] = [];
    const capB: V3[] = [];
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      capA.push([x0, cy + Math.sin(a) * r, cz + Math.cos(a) * r]);
      capB.push([x1, cy + Math.sin(a) * r, cz + Math.cos(a) * r]);
    }
    this.face(capA, [-1, 0, 0]);
    this.face(capB, [1, 0, 0]);
    return this;
  }

  /** Horizontal cylinder along the z axis. */
  cylinderZ(z0: number, z1: number, cx: number, cy: number, r: number, segs = 6): this {
    this.push();
    // rotate x->z around (cx, ., z0)
    this.translate(cx, 0, z0).rotateY(-Math.PI / 2).translate(0, 0, 0);
    this.cylinderX(0, z1 - z0, cy, 0, r, segs);
    this.pop();
    return this;
  }

  /** Low-poly sphere (icosahedron, detail 0 or 1), optionally squashed. */
  sphere(cx: number, cy: number, cz: number, r: number, detail = 0, sy = 1): this {
    const t = (1 + Math.sqrt(5)) / 2;
    let verts: V3[] = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ].map((v) => {
      const l = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / l, v[1] / l, v[2] / l] as V3;
    });
    let faces: [number, number, number][] = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];
    for (let d = 0; d < detail; d++) {
      const nf: [number, number, number][] = [];
      const cache = new Map<string, number>();
      const mid = (a: number, b: number) => {
        const k = a < b ? `${a}_${b}` : `${b}_${a}`;
        let i = cache.get(k);
        if (i === undefined) {
          const va = verts[a];
          const vb = verts[b];
          const m: V3 = [(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2];
          const l = Math.hypot(m[0], m[1], m[2]);
          verts = [...verts, [m[0] / l, m[1] / l, m[2] / l]];
          i = verts.length - 1;
          cache.set(k, i);
        }
        return i;
      };
      for (const [a, b, c] of faces) {
        const ab = mid(a, b);
        const bc = mid(b, c);
        const ca = mid(c, a);
        nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      }
      faces = nf;
    }
    for (const [a, b, c] of faces) {
      const pa = verts[a];
      const pb = verts[b];
      const pc = verts[c];
      const P = (v: V3): V3 => [cx + v[0] * r, cy + v[1] * r * sy, cz + v[2] * r];
      const centroid: V3 = [(pa[0] + pb[0] + pc[0]) / 3, (pa[1] + pb[1] + pc[1]) / 3, (pa[2] + pb[2] + pc[2]) / 3];
      this.face([P(pa), P(pb), P(pc)], centroid);
    }
    return this;
  }

  /** Thin straight "beam" between two points (wires, pipes, crane arms). */
  beam(a: V3, b: V3, thickness = 0.015): this {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return this;
    // pick a perpendicular basis
    const ux = dx / len;
    const uy = dy / len;
    const uz = dz / len;
    let px = -uz;
    let py = 0;
    let pz = ux;
    let pl = Math.hypot(px, py, pz);
    if (pl < 1e-3) {
      px = 1;
      py = 0;
      pz = 0;
      pl = 1;
    }
    px /= pl;
    pz /= pl;
    py /= pl;
    // q = u x p
    const qx = uy * pz - uz * py;
    const qy = uz * px - ux * pz;
    const qz = ux * py - uy * px;
    const t = thickness / 2;
    const corners = [
      [px * t + qx * t, py * t + qy * t, pz * t + qz * t],
      [-px * t + qx * t, -py * t + qy * t, -pz * t + qz * t],
      [-px * t - qx * t, -py * t - qy * t, -pz * t - qz * t],
      [px * t - qx * t, py * t - qy * t, pz * t - qz * t],
    ];
    for (let i = 0; i < 4; i++) {
      const c0 = corners[i];
      const c1 = corners[(i + 1) % 4];
      const hint: V3 = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2];
      this.face(
        [
          [a[0] + c0[0], a[1] + c0[1], a[2] + c0[2]],
          [b[0] + c0[0], b[1] + c0[1], b[2] + c0[2]],
          [b[0] + c1[0], b[1] + c1[1], b[2] + c1[2]],
          [a[0] + c1[0], a[1] + c1[1], a[2] + c1[2]],
        ],
        hint,
      );
    }
    return this;
  }

  /** Register a particle emitter (local coordinates, transformed). */
  emitter(x: number, y: number, z: number, kind: Emitter['kind'] = 'smoke'): this {
    const p = this.tx([x, y, z]);
    this.emitters.push({ x: p[0], y: p[1], z: p[2], kind });
    return this;
  }

  /** Register an animated wind-turbine rotor hub. */
  rotor(x: number, y: number, z: number, r: number, yaw = 0): this {
    const p = this.tx([x, y, z]);
    this.rotors.push({ x: p[0], y: p[1], z: p[2], r, yaw });
    return this;
  }

  get vertexCount(): number {
    return this.P.length / 3;
  }

  build(): ModelMesh {
    const count = this.P.length / 3;
    return {
      count,
      position: new Float32Array(this.P),
      normal: new Int8Array(this.N),
      color: new Uint8Array(this.C),
      wall: new Float32Array(this.W),
      win: new Uint8Array(this.S),
      height: this.maxY,
      emitters: this.emitters,
      rotors: this.rotors,
    };
  }
}
