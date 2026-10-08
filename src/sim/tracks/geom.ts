/**
 * Plane geometry for track networks (roads, rails, highways): quadratic
 * Bézier curves, sampled polylines and convex polygon tests. Coordinates are
 * map units (one tile = 1) with x to the east and y to the south, the same as
 * tile coordinates. A tile (x, y) covers [x, x + 1] × [y, y + 1].
 */

/** A quadratic Bézier from a to b with control point c. Straight curves keep c in the middle. */
export interface Curve {
  ax: number;
  ay: number;
  cx: number;
  cy: number;
  bx: number;
  by: number;
  straight: boolean;
}

export function makeCurve(ax: number, ay: number, bx: number, by: number, c: [number, number] | null): Curve {
  if (!c) return { ax, ay, cx: (ax + bx) / 2, cy: (ay + by) / 2, bx, by, straight: true };
  return { ax, ay, cx: c[0], cy: c[1], bx, by, straight: false };
}

export function curvePoint(q: Curve, t: number): [number, number] {
  const u = 1 - t;
  return [u * u * q.ax + 2 * u * t * q.cx + t * t * q.bx, u * u * q.ay + 2 * u * t * q.cy + t * t * q.by];
}

export function curveDeriv(q: Curve, t: number): [number, number] {
  const u = 1 - t;
  return [2 * u * (q.cx - q.ax) + 2 * t * (q.bx - q.cx), 2 * u * (q.cy - q.ay) + 2 * t * (q.by - q.cy)];
}

/** Unit tangent at t (a straight fallback for degenerate curves). */
export function curveTangent(q: Curve, t: number): [number, number] {
  let [dx, dy] = curveDeriv(q, t);
  let l = Math.hypot(dx, dy);
  if (l < 1e-9) {
    dx = q.bx - q.ax;
    dy = q.by - q.ay;
    l = Math.hypot(dx, dy) || 1;
  }
  return [dx / l, dy / l];
}

/** The part of a curve between parameters t0 and t1 (by blossoming). */
export function subCurve(q: Curve, t0: number, t1: number): Curve {
  const bl = (u: number, v: number): [number, number] => {
    const k0 = (1 - u) * (1 - v);
    const k1 = (1 - u) * v + u * (1 - v);
    const k2 = u * v;
    return [k0 * q.ax + k1 * q.cx + k2 * q.bx, k0 * q.ay + k1 * q.cy + k2 * q.by];
  };
  const a = bl(t0, t0);
  const c = bl(t0, t1);
  const b = bl(t1, t1);
  return { ax: a[0], ay: a[1], cx: c[0], cy: c[1], bx: b[0], by: b[1], straight: q.straight };
}

/** Rough length (control polygon). */
export function roughLength(q: Curve): number {
  if (q.straight) return Math.hypot(q.bx - q.ax, q.by - q.ay);
  return Math.hypot(q.cx - q.ax, q.cy - q.ay) + Math.hypot(q.bx - q.cx, q.by - q.cy);
}

/** A curve sampled at even parameter steps, with the arc length at each sample. */
export interface Polyline {
  n: number;
  x: Float64Array;
  y: Float64Array;
  t: Float64Array;
  /** Arc length from the start to each sample. */
  s: Float64Array;
  len: number;
}

export function sampleCurve(q: Curve, step = 0.2): Polyline {
  const n = q.straight ? 2 : Math.max(3, Math.ceil(roughLength(q) / step) + 1);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const t = new Float64Array(n);
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ti = i / (n - 1);
    const p = curvePoint(q, ti);
    x[i] = p[0];
    y[i] = p[1];
    t[i] = ti;
    if (i > 0) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  }
  return { n, x, y, t, s, len: s[n - 1] };
}

/** Curve parameter at arc length s (clamped). */
export function paramAt(p: Polyline, s: number): number {
  if (s <= 0) return 0;
  if (s >= p.len) return 1;
  let lo = 0;
  let hi = p.n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p.s[mid] <= s) lo = mid;
    else hi = mid;
  }
  const f = (s - p.s[lo]) / Math.max(1e-12, p.s[hi] - p.s[lo]);
  return p.t[lo] + (p.t[hi] - p.t[lo]) * f;
}

/** Arc length at parameter t. */
export function lengthAt(p: Polyline, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return p.len;
  const f = t * (p.n - 1);
  const i = Math.min(p.n - 2, Math.floor(f));
  return p.s[i] + (p.s[i + 1] - p.s[i]) * (f - i);
}

/**
 * Parameters for a strip between arc lengths s0 and s1: both ends plus the
 * samples in between. Long straight pieces are split into steps of at most `maxStep`.
 */
export function stripParams(q: Curve, p: Polyline, s0: number, s1: number, maxStep = 1): number[] {
  const t0 = paramAt(p, s0);
  const t1 = paramAt(p, s1);
  if (t1 <= t0) return [];
  const out = [t0];
  if (q.straight) {
    const k = Math.max(1, Math.ceil((s1 - s0) / maxStep));
    for (let i = 1; i < k; i++) out.push(t0 + ((t1 - t0) * i) / k);
  } else {
    for (let i = 0; i < p.n; i++) if (p.t[i] > t0 + 1e-9 && p.t[i] < t1 - 1e-9) out.push(p.t[i]);
  }
  out.push(t1);
  return out;
}

/** Smallest radius of curvature of a curve (Infinity for straight ones). */
export function minRadius(q: Curve): number {
  if (q.straight) return Infinity;
  const ddx = 2 * (q.ax - 2 * q.cx + q.bx);
  const ddy = 2 * (q.ay - 2 * q.cy + q.by);
  let best = Infinity;
  for (let i = 0; i <= 32; i++) {
    const [dx, dy] = curveDeriv(q, i / 32);
    const cross = Math.abs(dx * ddy - dy * ddx);
    if (cross < 1e-12) continue;
    best = Math.min(best, Math.pow(Math.hypot(dx, dy), 3) / cross);
  }
  return best;
}

/** Closest point on a curve: [t, distance]. */
export function closestParam(q: Curve, px: number, py: number): [number, number] {
  if (q.straight) {
    const dx = q.bx - q.ax;
    const dy = q.by - q.ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - q.ax) * dx + (py - q.ay) * dy) / l2)) : 0;
    return [t, Math.hypot(q.ax + dx * t - px, q.ay + dy * t - py)];
  }
  const n = Math.max(8, Math.ceil(roughLength(q) / 0.25));
  let bt = 0;
  let bd = Infinity;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = curvePoint(q, t);
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bd) {
      bd = d;
      bt = t;
    }
  }
  // Newton steps on (Q(t) − P) · Q'(t) = 0
  let t = bt;
  const ddx = 2 * (q.ax - 2 * q.cx + q.bx);
  const ddy = 2 * (q.ay - 2 * q.cy + q.by);
  for (let k = 0; k < 6; k++) {
    const [x, y] = curvePoint(q, t);
    const [dx, dy] = curveDeriv(q, t);
    const f = (x - px) * dx + (y - py) * dy;
    const df = dx * dx + dy * dy + (x - px) * ddx + (y - py) * ddy;
    if (Math.abs(df) < 1e-12) break;
    const next = Math.max(0, Math.min(1, t - f / df));
    if (Math.abs(next - t) < 1e-12) break;
    t = next;
  }
  const [x, y] = curvePoint(q, t);
  return [t, Math.hypot(x - px, y - py)];
}

/** Intersection of segments p0→p1 and q0→q1 as parameters [t, u], or null when parallel. */
export function segIntersect(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  q0x: number,
  q0y: number,
  q1x: number,
  q1y: number,
): [number, number] | null {
  const rx = p1x - p0x;
  const ry = p1y - p0y;
  const sx = q1x - q0x;
  const sy = q1y - q0y;
  const den = rx * sy - ry * sx;
  const scale = Math.hypot(rx, ry) * Math.hypot(sx, sy);
  if (scale < 1e-18 || Math.abs(den) < 1e-9 * scale) return null;
  const qx = q0x - p0x;
  const qy = q0y - p0y;
  return [(qx * sy - qy * sx) / den, (qx * ry - qy * rx) / den];
}

/**
 * Proper crossings of two curves as parameter pairs [t on a, u on b]. Parallel
 * overlaps are not reported (shared nodes take care of those).
 */
export function curveIntersections(a: Curve, b: Curve): [number, number][] {
  if (a.straight && b.straight) {
    const r = segIntersect(a.ax, a.ay, a.bx, a.by, b.ax, b.ay, b.bx, b.by);
    if (!r) return [];
    const e = 1e-9;
    return r[0] >= -e && r[0] <= 1 + e && r[1] >= -e && r[1] <= 1 + e ? [[clamp01(r[0]), clamp01(r[1])]] : [];
  }
  const pa = sampleCurve(a, 0.1);
  const pb = sampleCurve(b, 0.1);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < pa.n; i++) {
    const ax0 = Math.min(pa.x[i], pa.x[i + 1]);
    const ax1 = Math.max(pa.x[i], pa.x[i + 1]);
    const ay0 = Math.min(pa.y[i], pa.y[i + 1]);
    const ay1 = Math.max(pa.y[i], pa.y[i + 1]);
    for (let j = 0; j + 1 < pb.n; j++) {
      if (Math.max(pb.x[j], pb.x[j + 1]) < ax0 - 1e-9 || Math.min(pb.x[j], pb.x[j + 1]) > ax1 + 1e-9) continue;
      if (Math.max(pb.y[j], pb.y[j + 1]) < ay0 - 1e-9 || Math.min(pb.y[j], pb.y[j + 1]) > ay1 + 1e-9) continue;
      const r = segIntersect(pa.x[i], pa.y[i], pa.x[i + 1], pa.y[i + 1], pb.x[j], pb.y[j], pb.x[j + 1], pb.y[j + 1]);
      if (!r || r[0] < -1e-9 || r[0] > 1 + 1e-9 || r[1] < -1e-9 || r[1] > 1 + 1e-9) continue;
      let t = pa.t[i] + (pa.t[i + 1] - pa.t[i]) * r[0];
      let u = pb.t[j] + (pb.t[j + 1] - pb.t[j]) * r[1];
      [t, u] = refineCrossing(a, b, t, u);
      if (out.some(([t2, u2]) => Math.abs(t2 - t) < 1e-6 && Math.abs(u2 - u) < 1e-6)) continue;
      out.push([t, u]);
    }
  }
  return out;
}

/** Newton steps for a(t) = b(u). */
function refineCrossing(a: Curve, b: Curve, t: number, u: number): [number, number] {
  for (let k = 0; k < 8; k++) {
    const [ax, ay] = curvePoint(a, t);
    const [bx, by] = curvePoint(b, u);
    const fx = ax - bx;
    const fy = ay - by;
    if (Math.hypot(fx, fy) < 1e-12) break;
    const [dax, day] = curveDeriv(a, t);
    const [dbx, dby] = curveDeriv(b, u);
    // [dax −dbx; day −dby] [dt; du] = −[fx; fy]
    const det = dax * -dby - -dbx * day;
    if (Math.abs(det) < 1e-12) break;
    const dt = (-fx * -dby - -dbx * -fy) / det;
    const du = (dax * -fy - day * -fx) / det;
    t = clamp01(t + dt);
    u = clamp01(u + du);
  }
  return [t, u];
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------- polygons

/**
 * True if a convex polygon (flat x, y list) and an axis-aligned rectangle
 * overlap by more than `tol` (separating axis test; touching does not count).
 */
export function convexHitsRect(p: ArrayLike<number>, x0: number, y0: number, x1: number, y1: number, tol = 1e-7): boolean {
  const n = p.length >> 1;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = p[i * 2];
    const y = p[i * 2 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (Math.min(maxX, x1) - Math.max(minX, x0) <= tol || Math.min(maxY, y1) - Math.max(minY, y0) <= tol) return false;
  const rx = [x0, x1, x1, x0];
  const ry = [y0, y0, y1, y1];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let nx = p[j * 2 + 1] - p[i * 2 + 1];
    let ny = p[i * 2] - p[j * 2];
    const l = Math.hypot(nx, ny);
    if (l < 1e-12) continue;
    nx /= l;
    ny /= l;
    let pmin = Infinity;
    let pmax = -Infinity;
    for (let k = 0; k < n; k++) {
      const d = p[k * 2] * nx + p[k * 2 + 1] * ny;
      if (d < pmin) pmin = d;
      if (d > pmax) pmax = d;
    }
    let rmin = Infinity;
    let rmax = -Infinity;
    for (let k = 0; k < 4; k++) {
      const d = rx[k] * nx + ry[k] * ny;
      if (d < rmin) rmin = d;
      if (d > rmax) rmax = d;
    }
    if (Math.min(pmax, rmax) - Math.max(pmin, rmin) <= tol) return false;
  }
  return true;
}

/** True if two convex polygons overlap by more than `tol` (separating axis test). */
export function convexOverlap(a: ArrayLike<number>, b: ArrayLike<number>, tol = 1e-7): boolean {
  for (const [p, q] of [
    [a, b],
    [b, a],
  ] as const) {
    const n = p.length >> 1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      let nx = p[j * 2 + 1] - p[i * 2 + 1];
      let ny = p[i * 2] - p[j * 2];
      const l = Math.hypot(nx, ny);
      if (l < 1e-12) continue;
      nx /= l;
      ny /= l;
      let pmin = Infinity;
      let pmax = -Infinity;
      for (let k = 0; k < n; k++) {
        const d = p[k * 2] * nx + p[k * 2 + 1] * ny;
        if (d < pmin) pmin = d;
        if (d > pmax) pmax = d;
      }
      let qmin = Infinity;
      let qmax = -Infinity;
      for (let k = 0; k < q.length >> 1; k++) {
        const d = q[k * 2] * nx + q[k * 2 + 1] * ny;
        if (d < qmin) qmin = d;
        if (d > qmax) qmax = d;
      }
      if (Math.min(pmax, qmax) - Math.max(pmin, qmin) <= tol) return false;
    }
  }
  return true;
}

/** Keep the part of a convex polygon where nx·x + ny·y ≤ d (Sutherland–Hodgman step). */
export function clipHalf(p: number[], nx: number, ny: number, d: number): number[] {
  const n = p.length >> 1;
  if (!n) return p;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = p[i * 2];
    const ay = p[i * 2 + 1];
    const bx = p[j * 2];
    const by = p[j * 2 + 1];
    const da = ax * nx + ay * ny - d;
    const db = bx * nx + by * ny - d;
    if (da <= 0) out.push(ax, ay);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const f = da / (da - db);
      out.push(ax + (bx - ax) * f, ay + (by - ay) * f);
    }
  }
  return out;
}

/** Clip a convex polygon to an axis-aligned rectangle. */
export function clipRect(p: number[], x0: number, y0: number, x1: number, y1: number): number[] {
  let r = clipHalf(p, -1, 0, -x0);
  r = clipHalf(r, 1, 0, x1);
  r = clipHalf(r, 0, -1, -y0);
  return clipHalf(r, 0, 1, y1);
}

/** Signed area of a polygon (positive when counter-clockwise in x-right, y-up axes). */
export function polyArea(p: ArrayLike<number>): number {
  const n = p.length >> 1;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
  }
  return a / 2;
}

/** Distance from a point to an axis-aligned rectangle (0 inside). */
export function pointRectDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.max(x0 - px, 0, px - x1);
  const dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

/** Intersection of the lines p + s·u and q + t·v: [s, t], or null when parallel. */
export function lineIntersect(
  px: number,
  py: number,
  ux: number,
  uy: number,
  qx: number,
  qy: number,
  vx: number,
  vy: number,
): [number, number] | null {
  const den = ux * vy - uy * vx;
  if (Math.abs(den) < 1e-9) return null;
  const dx = qx - px;
  const dy = qy - py;
  return [(dx * vy - dy * vx) / den, (dx * uy - dy * ux) / den];
}

/** Points of a quadratic Bézier p0 → c → p1 (both ends included). */
export function bezierPoints(p0x: number, p0y: number, cx: number, cy: number, p1x: number, p1y: number, segments: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    out.push(u * u * p0x + 2 * u * t * cx + t * t * p1x, u * u * p0y + 2 * u * t * cy + t * t * p1y);
  }
  return out;
}
