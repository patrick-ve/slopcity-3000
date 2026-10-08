import * as THREE from 'three';
import type { ModelMesh } from './geom';
import { hexToRgb } from './geom';

/** Growable typed array. */
class Grow<T extends Float32Array | Int8Array | Uint8Array> {
  arr: T;
  len = 0;
  constructor(private ctor: new (n: number) => T, cap: number) {
    this.arr = new ctor(cap);
  }
  reserve(n: number): void {
    if (this.len + n <= this.arr.length) return;
    let cap = this.arr.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new this.ctor(cap);
    next.set(this.arr.subarray(0, this.len));
    this.arr = next;
  }
}

/** Ground buffer: position + normal + colour (sRGB). */
export class GroundBuf {
  private P = new Grow(Float32Array, 4096 * 3);
  private N = new Grow(Int8Array, 4096 * 3);
  private C = new Grow(Uint8Array, 4096 * 3);
  count = 0;

  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, hex: number): void {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx = Math.round((nx / l) * 127);
    ny = Math.round((ny / l) * 127);
    nz = Math.round((nz / l) * 127);
    const [r, g, b] = hexToRgb(hex);
    this.P.reserve(9);
    this.N.reserve(9);
    this.C.reserve(9);
    const p = this.P.arr;
    let o = this.P.len;
    p[o++] = ax;
    p[o++] = ay;
    p[o++] = az;
    p[o++] = bx;
    p[o++] = by;
    p[o++] = bz;
    p[o++] = cx;
    p[o++] = cy;
    p[o++] = cz;
    this.P.len = o;
    const n = this.N.arr;
    const c = this.C.arr;
    for (let k = 0; k < 3; k++) {
      n[this.N.len++] = nx;
      n[this.N.len++] = ny;
      n[this.N.len++] = nz;
      c[this.C.len++] = r;
      c[this.C.len++] = g;
      c[this.C.len++] = b;
    }
    this.count += 3;
  }

  /** Quad a-b-c-d (counter-clockwise from above / the front). */
  quad(a: number[], b: number[], c: number[], d: number[], hex: number): void {
    this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], hex);
    this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], hex);
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.P.arr.slice(0, this.P.len), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.N.arr.slice(0, this.N.len), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(this.C.arr.slice(0, this.C.len), 3, true));
    g.computeBoundingSphere();
    return g;
  }
}

export interface Placement {
  /** 2x2 rotation/scale for x,z: x' = a*x + b*z + tx, z' = c*x + d*z + tz. */
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  tz: number;
  /** y' = sy*y + ty */
  sy: number;
  ty: number;
}

/** Placement for a footprint model rotated by k*90° (footprint dims dw×dh unrotated). */
export function rotPlacement(k: number, dw: number, dh: number, x: number, y: number, z: number): Placement {
  switch (k & 3) {
    case 1:
      return { a: 0, b: -1, c: 1, d: 0, tx: x + dh, tz: z, sy: 1, ty: y };
    case 2:
      return { a: -1, b: 0, c: 0, d: -1, tx: x + dw, tz: z + dh, sy: 1, ty: y };
    case 3:
      return { a: 0, b: 1, c: -1, d: 0, tx: x, tz: z + dw, sy: 1, ty: y };
    default:
      return { a: 1, b: 0, c: 0, d: 1, tx: x, tz: z, sy: 1, ty: y };
  }
}

/** Placement for a free object with yaw and uniform scale. */
export function yawPlacement(yaw: number, s: number, x: number, y: number, z: number): Placement {
  const c = Math.cos(yaw) * s;
  const sn = Math.sin(yaw) * s;
  return { a: c, b: sn, c: -sn, d: c, tx: x, tz: z, sy: s, ty: y };
}

export function placePoint(p: Placement, x: number, y: number, z: number): [number, number, number] {
  return [p.a * x + p.b * z + p.tx, p.sy * y + p.ty, p.c * x + p.d * z + p.tz];
}

export interface ModelInstanceOpts {
  seed: number;
  /** Multiply colours (abandoned/burnt look). */
  colorMul?: number;
  /** Desaturate 0..1. */
  desat?: number;
  /** Windows stay dark at night. */
  dark?: boolean;
}

/** Object buffer: position, normal, colour, window coords and info (style, seed). */
export class ObjectBuf {
  private P = new Grow(Float32Array, 8192 * 3);
  private N = new Grow(Int8Array, 8192 * 3);
  private C = new Grow(Uint8Array, 8192 * 3);
  private W = new Grow(Float32Array, 8192 * 2);
  private I = new Grow(Uint8Array, 8192 * 2);
  count = 0;

  addModel(m: ModelMesh, pl: Placement, o: ModelInstanceOpts): void {
    const n = m.count;
    this.P.reserve(n * 3);
    this.N.reserve(n * 3);
    this.C.reserve(n * 3);
    this.W.reserve(n * 2);
    this.I.reserve(n * 2);
    const P = this.P.arr;
    const N = this.N.arr;
    const C = this.C.arr;
    const W = this.W.arr;
    const I = this.I.arr;
    let po = this.P.len;
    let no = this.N.len;
    let co = this.C.len;
    let wo = this.W.len;
    let io = this.I.len;
    const mul = o.colorMul ?? 1;
    const desat = o.desat ?? 0;
    const dark = o.dark ? 128 : 0;
    const sc = Math.hypot(pl.a, pl.c) || 1;
    for (let v = 0; v < n; v++) {
      const x = m.position[v * 3];
      const y = m.position[v * 3 + 1];
      const z = m.position[v * 3 + 2];
      P[po++] = pl.a * x + pl.b * z + pl.tx;
      P[po++] = pl.sy * y + pl.ty;
      P[po++] = pl.c * x + pl.d * z + pl.tz;
      const nx = m.normal[v * 3];
      const ny = m.normal[v * 3 + 1];
      const nz = m.normal[v * 3 + 2];
      N[no++] = Math.round((pl.a * nx + pl.b * nz) / sc);
      N[no++] = ny;
      N[no++] = Math.round((pl.c * nx + pl.d * nz) / sc);
      let r = m.color[v * 3];
      let g = m.color[v * 3 + 1];
      let b = m.color[v * 3 + 2];
      if (desat > 0) {
        const l = r * 0.3 + g * 0.59 + b * 0.11;
        r += (l - r) * desat;
        g += (l - g) * desat;
        b += (l - b) * desat;
      }
      C[co++] = Math.min(255, r * mul);
      C[co++] = Math.min(255, g * mul);
      C[co++] = Math.min(255, b * mul);
      W[wo++] = m.wall[v * 2];
      W[wo++] = m.wall[v * 2 + 1];
      const s = m.win[v];
      I[io++] = s ? s + dark : 0;
      I[io++] = o.seed;
    }
    this.P.len = po;
    this.N.len = no;
    this.C.len = co;
    this.W.len = wo;
    this.I.len = io;
    this.count += n;
  }

  /** Plain triangle (no windows). */
  tri(a: number[], b: number[], c: number[], hex: number): void {
    const [r, g, bl] = hexToRgb(hex);
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx = Math.round((nx / l) * 127);
    ny = Math.round((ny / l) * 127);
    nz = Math.round((nz / l) * 127);
    this.P.reserve(9);
    this.N.reserve(9);
    this.C.reserve(9);
    this.W.reserve(6);
    this.I.reserve(6);
    for (const p of [a, b, c]) {
      this.P.arr[this.P.len++] = p[0];
      this.P.arr[this.P.len++] = p[1];
      this.P.arr[this.P.len++] = p[2];
      this.N.arr[this.N.len++] = nx;
      this.N.arr[this.N.len++] = ny;
      this.N.arr[this.N.len++] = nz;
      this.C.arr[this.C.len++] = r;
      this.C.arr[this.C.len++] = g;
      this.C.arr[this.C.len++] = bl;
      this.W.arr[this.W.len++] = 0;
      this.W.arr[this.W.len++] = 0;
      this.I.arr[this.I.len++] = 0;
      this.I.arr[this.I.len++] = 0;
    }
    this.count += 3;
  }

  /** Box between two points with square cross-section (wires, pipes). */
  beam(a: number[], b: number[], t: number, hex: number): void {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return;
    const ux = dx / len;
    const uy = dy / len;
    const uz = dz / len;
    let px = -uz;
    let py = 0;
    let pz = ux;
    let pl = Math.hypot(px, py, pz);
    if (pl < 1e-3) {
      px = 1;
      pz = 0;
      pl = 1;
    }
    px /= pl;
    py /= pl;
    pz /= pl;
    const qx = uy * pz - uz * py;
    const qy = uz * px - ux * pz;
    const qz = ux * py - uy * px;
    const h = t / 2;
    const off = [
      [px * h + qx * h, py * h + qy * h, pz * h + qz * h],
      [-px * h + qx * h, -py * h + qy * h, -pz * h + qz * h],
      [-px * h - qx * h, -py * h - qy * h, -pz * h - qz * h],
      [px * h - qx * h, py * h - qy * h, pz * h - qz * h],
    ];
    for (let k = 0; k < 4; k++) {
      const o0 = off[k];
      const o1 = off[(k + 1) % 4];
      const a0 = [a[0] + o0[0], a[1] + o0[1], a[2] + o0[2]];
      const b0 = [b[0] + o0[0], b[1] + o0[1], b[2] + o0[2]];
      const b1 = [b[0] + o1[0], b[1] + o1[1], b[2] + o1[2]];
      const a1 = [a[0] + o1[0], a[1] + o1[1], a[2] + o1[2]];
      // orientation: outward = (o0+o1)
      const ox = o0[0] + o1[0];
      const oy = o0[1] + o1[1];
      const oz = o0[2] + o1[2];
      const ex = b0[0] - a0[0];
      const ey = b0[1] - a0[1];
      const ez = b0[2] - a0[2];
      const fx = b1[0] - a0[0];
      const fy = b1[1] - a0[1];
      const fz = b1[2] - a0[2];
      const nx = ey * fz - ez * fy;
      const ny = ez * fx - ex * fz;
      const nz = ex * fy - ey * fx;
      if (nx * ox + ny * oy + nz * oz >= 0) {
        this.tri(a0, b0, b1, hex);
        this.tri(a0, b1, a1, hex);
      } else {
        this.tri(a0, b1, b0, hex);
        this.tri(a0, a1, b1, hex);
      }
    }
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.P.arr.slice(0, this.P.len), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.N.arr.slice(0, this.N.len), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(this.C.arr.slice(0, this.C.len), 3, true));
    g.setAttribute('aWall', new THREE.BufferAttribute(this.W.arr.slice(0, this.W.len), 2));
    g.setAttribute('aInfo', new THREE.BufferAttribute(this.I.arr.slice(0, this.I.len), 2));
    g.computeBoundingSphere();
    return g;
  }
}
