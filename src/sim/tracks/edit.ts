/**
 * Topology edits on a track network: add straight or curved track (joining
 * the network where it meets or crosses it), add grid paths from the classic
 * drag tool, and cut track out of a rectangle (bulldozer).
 */
import {
  closestParam,
  convexHitsRect,
  curveIntersections,
  curvePoint,
  curveTangent,
  makeCurve,
  paramAt,
  sampleCurve,
  subCurve,
  type Curve,
} from './geom';
import { TILE_MARGIN, type TrackNet } from './net';

/** Points closer than this are the same point. */
export const SNAP = 0.02;
/** Pieces shorter than this are dropped when track is cut. */
const MIN_PIECE = 0.25;

/** What an edit did. */
export interface EditInfo {
  /** Edges of new track. */
  added: number[];
  /** Nodes whose junction changed (or that were created). */
  nodes: Set<number>;
  /** The track curves that were asked for (for previews). */
  curves: Curve[];
}

export function newEditInfo(): EditInfo {
  return { added: [], nodes: new Set(), curves: [] };
}

/** A node at (x, y), if there is one. */
export function nodeAt(net: TrackNet, x: number, y: number, tol = SNAP): number {
  let best = 0;
  let bd = tol;
  for (const id of net.query(x - tol, y - tol, x + tol, y + tol).nodes) {
    const n = net.nodes.get(id)!;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

/** The edge passing through (x, y) and the curve parameter there, if any. */
export function edgeAt(net: TrackNet, x: number, y: number, tol = SNAP): [number, number] | null {
  let best: [number, number] | null = null;
  let bd = tol;
  for (const id of net.query(x - tol, y - tol, x + tol, y + tol).edges) {
    const [t, d] = closestParam(net.curve(net.edges.get(id)!), x, y);
    if (d <= bd) {
      bd = d;
      best = [id, t];
    }
  }
  return best;
}

/** True if the network's centre line passes through (x, y). */
export function onNetwork(net: TrackNet, x: number, y: number): boolean {
  return nodeAt(net, x, y) > 0 || edgeAt(net, x, y) !== null;
}

/** Split an edge at curve parameters (ascending); returns the new nodes. */
export function splitEdge(net: TrackNet, id: number, ts: number[], info: EditInfo): number[] {
  const e = net.edges.get(id)!;
  const q = net.curve(e);
  const made: number[] = [];
  const ids = [e.a];
  for (const t of ts) {
    const [x, y] = curvePoint(q, t);
    const n = net.addNode(x, y);
    made.push(n);
    ids.push(n);
    info.nodes.add(n);
  }
  ids.push(e.b);
  const params = [0, ...ts, 1];
  net.removeEdge(id);
  for (let i = 0; i + 1 < ids.length; i++) {
    const sub = subCurve(q, params[i], params[i + 1]);
    net.addEdge(ids[i], ids[i + 1], e.curved ? [sub.cx, sub.cy] : null);
  }
  info.nodes.add(e.a);
  info.nodes.add(e.b);
  return made;
}

/** The node at a point: an existing node, a new node splitting the edge there, or a new free node. */
function pointNode(net: TrackNet, x: number, y: number, info: EditInfo): number {
  const n = nodeAt(net, x, y);
  if (n) return n;
  const hit = edgeAt(net, x, y);
  if (hit) {
    const e = net.edges.get(hit[0])!;
    const len = net.length(hit[0]);
    if (hit[1] * len < SNAP) return e.a;
    if ((1 - hit[1]) * len < SNAP) return e.b;
    return splitEdge(net, hit[0], [hit[1]], info)[0];
  }
  const id = net.addNode(x, y);
  info.nodes.add(id);
  return id;
}

function straightEdgeBetween(net: TrackNet, a: number, b: number): boolean {
  for (const id of net.edgesAt(a)) {
    const e = net.edges.get(id)!;
    if (!e.curved && net.other(e, a) === b) return true;
  }
  return false;
}

/**
 * Add track from a to b (a curve through control point c, or straight). It
 * joins the network at its ends and wherever it crosses or touches it.
 */
export function addCurve(net: TrackNet, ax: number, ay: number, bx: number, by: number, c: [number, number] | null, info: EditInfo): void {
  const A = pointNode(net, ax, ay, info);
  const B = pointNode(net, bx, by, info);
  info.nodes.add(A);
  info.nodes.add(B);
  if (A === B) return;
  const na = net.nodes.get(A)!;
  const nb = net.nodes.get(B)!;
  const q = makeCurve(na.x, na.y, nb.x, nb.y, c);
  info.curves.push(q);
  const len = sampleCurve(q, 0.2).len;
  if (len < SNAP) return;
  const stops: [number, number][] = [
    [0, A],
    [1, B],
  ];
  const x0 = Math.min(q.ax, q.bx, q.cx) - 0.1;
  const y0 = Math.min(q.ay, q.by, q.cy) - 0.1;
  const x1 = Math.max(q.ax, q.bx, q.cx) + 0.1;
  const y1 = Math.max(q.ay, q.by, q.cy) + 0.1;
  const near = net.query(x0, y0, x1, y1);
  // nodes the new track runs through
  for (const id of near.nodes) {
    if (id === A || id === B) continue;
    const n = net.nodes.get(id)!;
    const [t, d] = closestParam(q, n.x, n.y);
    if (d <= SNAP && t * len >= SNAP && (1 - t) * len >= SNAP) stops.push([t, id]);
  }
  // crossings with edges: split every crossed edge once, at all its crossings
  const cuts = new Map<number, [number, number][]>();
  for (const id of near.edges) {
    const e = net.edges.get(id);
    if (!e) continue;
    const le = net.length(id);
    for (const [t, u] of curveIntersections(q, net.curve(e))) {
      if (t * len < SNAP || (1 - t) * len < SNAP || u * le < SNAP || (1 - u) * le < SNAP) continue;
      let list = cuts.get(id);
      if (!list) cuts.set(id, (list = []));
      list.push([u, t]);
    }
  }
  for (const [id, list] of cuts) {
    list.sort((p, r) => p[0] - r[0]);
    const made = splitEdge(
      net,
      id,
      list.map(([u]) => u),
      info,
    );
    list.forEach(([, t], k) => stops.push([t, made[k]]));
  }
  stops.sort((p, r) => p[0] - r[0]);
  for (let i = 0; i + 1 < stops.length; i++) {
    const [t0, n0] = stops[i];
    const [t1, n1] = stops[i + 1];
    info.nodes.add(n0);
    if (n0 === n1 || (t1 - t0) * len < SNAP) continue;
    if (!c && straightEdgeBetween(net, n0, n1)) continue;
    const sub = subCurve(q, t0, t1);
    info.added.push(net.addEdge(n0, n1, c ? [sub.cx, sub.cy] : null));
  }
}

/**
 * Join straight, collinear track pieces at the given nodes into single edges
 * (keeps the graph small and the junction shapes clean).
 */
export function tidy(net: TrackNet, info: EditInfo): void {
  for (const n of [...info.nodes]) {
    if (!net.nodes.has(n) || net.degree(n) !== 2) continue;
    const [e1, e2] = net.edgesAt(n).map((id) => net.edges.get(id)!);
    if (e1.curved || e2.curved) continue;
    const p = net.other(e1, n);
    const r = net.other(e2, n);
    if (p === r) continue;
    const P = net.nodes.get(p)!;
    const N = net.nodes.get(n)!;
    const R = net.nodes.get(r)!;
    const ux = N.x - P.x;
    const uy = N.y - P.y;
    const vx = R.x - N.x;
    const vy = R.y - N.y;
    const cross = ux * vy - uy * vx;
    if (Math.abs(cross) > 1e-9 * Math.hypot(ux, uy) * Math.hypot(vx, vy) || ux * vx + uy * vy <= 0) continue;
    if (straightEdgeBetween(net, p, r)) continue;
    const wasNew = info.added.includes(e1.id) || info.added.includes(e2.id);
    net.removeEdge(e1.id);
    net.removeEdge(e2.id);
    net.removeNode(n);
    info.nodes.delete(n);
    const id = net.addEdge(p, r, null);
    info.added = info.added.filter((k) => k !== e1.id && k !== e2.id);
    if (wasNew) info.added.push(id);
    info.nodes.add(p);
    info.nodes.add(r);
  }
}

// ----------------------------------------------------------- grid paths

const DIRS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Where a grid run ending at tile centre (x, y), heading (dx, dy), should
 * stop: where its line meets the network inside the end tile, or inside the
 * next tile when that tile already has track (neighbouring grid tiles connect).
 */
function gridEnd(net: TrackNet, x: number, y: number, dx: number, dy: number): [number, number] {
  if (onNetwork(net, x, y)) return [x, y];
  const tx = Math.floor(x + dx);
  const ty = Math.floor(y + dy);
  const nextCovered = tx >= 0 && ty >= 0 && tx < net.w && ty < net.h && net.cover[ty * net.w + tx] > 0;
  const reach = nextCovered ? 1.5 : 0.5;
  const line = makeCurve(x - dx * 0.5, y - dy * 0.5, x + dx * reach, y + dy * reach, null);
  const span = 0.5 + reach;
  // closest meeting point to the tile centre
  let best: [number, number] | null = null;
  let bd = Infinity;
  const consider = (t: number) => {
    const d = Math.abs(t * span - 0.5);
    if (d < bd) {
      bd = d;
      best = curvePoint(line, t);
    }
  };
  const near = net.query(
    Math.min(line.ax, line.bx) - 0.1,
    Math.min(line.ay, line.by) - 0.1,
    Math.max(line.ax, line.bx) + 0.1,
    Math.max(line.ay, line.by) + 0.1,
  );
  for (const id of near.nodes) {
    const n = net.nodes.get(id)!;
    const [t, d] = closestParam(line, n.x, n.y);
    if (d <= SNAP) consider(t);
  }
  for (const id of near.edges) for (const [t] of curveIntersections(line, net.curve(net.edges.get(id)!))) consider(t);
  return best ?? [x, y];
}

/** A single tile of track (classic tool click): a small square, joined to track centred in the tiles around it. */
function addTile(net: TrackNet, x: number, y: number, info: EditInfo): void {
  const cx = x + 0.5;
  const cy = y + 0.5;
  if (onNetwork(net, cx, cy) || net.cover[y * net.w + x] > 0) return;
  const n = net.addNode(cx, cy);
  info.nodes.add(n);
  for (const [dx, dy] of DIRS) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx > 0 && ny > 0 && nx < net.w && ny < net.h && onNetwork(net, nx, ny)) addCurve(net, cx, cy, nx, ny, null, info);
  }
}

/**
 * Add track along a tile path from the classic drag tool (an L-shaped list of
 * tiles). Runs go from tile centre to tile centre, so the track covers exactly
 * the path's tiles. Like grid track always did, the path joins track in the
 * tiles next to its ends, and dead ends beside it join the path.
 */
export function addGridPath(net: TrackNet, path: [number, number][], info: EditInfo): void {
  const tiles = path.filter(([x, y]) => x >= 0 && y >= 0 && x < net.w && y < net.h);
  if (!tiles.length) return;
  if (tiles.length === 1) {
    addTile(net, tiles[0][0], tiles[0][1], info);
    return;
  }
  const runs: [number, number][][] = [];
  let start = 0;
  for (let i = 1; i < tiles.length; i++) {
    const last = i === tiles.length - 1;
    const turn =
      !last &&
      (tiles[i + 1][0] - tiles[i][0] !== tiles[i][0] - tiles[i - 1][0] || tiles[i + 1][1] - tiles[i][1] !== tiles[i][1] - tiles[i - 1][1]);
    if (last || turn) {
      runs.push(tiles.slice(start, i + 1));
      start = i;
    }
  }
  runs.forEach((run, k) => {
    const [fx, fy] = run[0];
    const [lx, ly] = run[run.length - 1];
    const dx = Math.sign(lx - fx);
    const dy = Math.sign(ly - fy);
    // the bend between two runs is their shared tile centre; only the outer ends look for neighbours
    const [ax, ay] = k === 0 ? gridEnd(net, fx + 0.5, fy + 0.5, -dx, -dy) : [fx + 0.5, fy + 0.5];
    const [bx, by] = k === runs.length - 1 ? gridEnd(net, lx + 0.5, ly + 0.5, dx, dy) : [lx + 0.5, ly + 0.5];
    addCurve(net, ax, ay, bx, by, null, info);
  });
  // dead ends and single tiles pointing at the path join it
  for (const [x, y] of tiles) {
    for (const [dx, dy] of DIRS) {
      const n = nodeAt(net, x + dx + 0.5, y + dy + 0.5);
      if (!n || !onNetwork(net, x + 0.5, y + 0.5)) continue;
      const deg = net.degree(n);
      if (deg > 1) continue;
      if (deg === 1) {
        const arm = net.arms(n)[0];
        // the dead end's track leaves away from the path, so its open end faces the path
        if (Math.abs(arm.dx - dx) > 1e-6 || Math.abs(arm.dy - dy) > 1e-6) continue;
      }
      addCurve(net, x + dx + 0.5, y + dy + 0.5, x + 0.5, y + 0.5, null, info);
    }
  }
}

// -------------------------------------------------------------- cutting

/** True if a segment overlaps a rectangle (Liang–Barsky clipping). */
function segHitsRect(ax: number, ay: number, bx: number, by: number, x0: number, y0: number, x1: number, y1: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dy, ay - y0) && clip(dy, y1 - ay) && t1 - t0 > 1e-9;
}

/**
 * Remove track from a tile rectangle (inclusive). Edges are cut back far
 * enough that their new dead ends stay out of the rectangle; on grid track
 * the new ends sit at tile centres, like the old tile-by-tile bulldozer.
 */
export function cutRect(net: TrackNet, rx0: number, ry0: number, rx1: number, ry1: number, info: EditInfo): void {
  const m = TILE_MARGIN;
  const R: [number, number, number, number] = [rx0 + m, ry0 + m, rx1 + 1 - m, ry1 + 1 - m];
  const near = net.query(rx0 - 1, ry0 - 1, rx1 + 2, ry1 + 2);
  for (const id of near.nodes) {
    if (net.degree(id) !== 0) continue;
    const n = net.nodes.get(id)!;
    const hw = net.profile.hw;
    if (convexHitsRect([n.x - hw, n.y - hw, n.x + hw, n.y - hw, n.x + hw, n.y + hw, n.x - hw, n.y + hw], ...R)) net.removeNode(id);
  }
  const ends = new Set<number>();
  for (const id of near.edges) if (net.edges.has(id)) cutEdge(net, id, R, info, ends);
  // nodes left with no track at all go too (they were part of the removed track)
  for (const n of ends) {
    if (net.nodes.has(n) && net.degree(n) === 0) {
      net.removeNode(n);
      info.nodes.delete(n);
    }
  }
}

function cutEdge(net: TrackNet, id: number, R: [number, number, number, number], info: EditInfo, ends: Set<number>): void {
  const e = net.edges.get(id)!;
  const q = net.curve(e);
  const p = net.poly(id);
  const len = p.len;
  const { hw, cap } = net.profile;
  const frame = (s: number) => {
    const t = paramAt(p, s);
    const [x, y] = curvePoint(q, t);
    const [tx, ty] = curveTangent(q, t);
    return { x, y, tx, ty, t };
  };
  /** The track's cross-section at s touches the rectangle. */
  const hits = (s: number) => {
    const f = frame(s);
    return segHitsRect(f.x + f.ty * hw, f.y - f.tx * hw, f.x - f.ty * hw, f.y + f.tx * hw, ...R);
  };
  /** A dead end at s, with its cap pointing along `dir` (+1 forward), stays clear of the rectangle. */
  const clear = (s: number, dir: number) => {
    if (hits(s)) return false;
    const f = frame(s);
    const [dx, dy] = [f.tx * dir * cap, f.ty * dir * cap];
    const [nx, ny] = [-f.ty * hw, f.tx * hw];
    return !convexHitsRect([f.x - nx, f.y - ny, f.x + nx, f.y + ny, f.x + nx + dx, f.y + ny + dy, f.x - nx + dx, f.y - ny + dy], ...R);
  };
  const step = 0.05;
  const n = Math.max(2, Math.ceil(len / step) + 1);
  const hit: boolean[] = [];
  for (let i = 0; i < n; i++) hit.push(hits((len * i) / (n - 1)));
  if (!hit.includes(true)) return;
  // kept ranges [from, to] of arc length
  const keep: [number, number][] = [];
  let from = 0;
  let i = 0;
  while (i < n) {
    if (!hit[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < n && hit[j + 1]) j++;
    const sIn = (len * i) / (n - 1);
    const sOut = (len * j) / (n - 1);
    let a = sIn - step;
    while (a > from && !clear(a, 1)) a -= step;
    let b = sOut + step;
    while (b < len && !clear(b, -1)) b += step;
    if (a > from) keep.push([from, a]);
    from = b;
    i = j + 1;
  }
  if (from < len) keep.push([from, len]);
  // grid track: new ends at tile centres
  const a = net.nodes.get(e.a)!;
  const gridAligned = !e.curved && isCentre(a.x) && isCentre(a.y) && (Math.abs(q.bx - q.ax) < 1e-9 || Math.abs(q.by - q.ay) < 1e-9);
  const pieces = keep
    .map(([s0, s1]): [number, number] => {
      if (!gridAligned) return [s0, s1];
      return [s0 > 0 ? Math.ceil(s0 - 1e-6) : 0, s1 < len ? Math.floor(s1 + 1e-6) : len];
    })
    .filter(([s0, s1]) => s1 - s0 >= MIN_PIECE || (s0 === 0 && s1 === len));
  net.removeEdge(id);
  ends.add(e.a);
  ends.add(e.b);
  info.nodes.add(e.a);
  info.nodes.add(e.b);
  for (const [s0, s1] of pieces) {
    const t0 = s0 <= 0 ? 0 : paramAt(p, s0);
    const t1 = s1 >= len ? 1 : paramAt(p, s1);
    const nodeAtS = (t: number, end: number) => {
      if (end >= 0) return end;
      const [x, y] = curvePoint(q, t);
      const made = net.addNode(x, y);
      info.nodes.add(made);
      ends.add(made);
      return made;
    };
    const n0 = nodeAtS(t0, t0 === 0 ? e.a : -1);
    const n1 = nodeAtS(t1, t1 === 1 ? e.b : -1);
    const sub = subCurve(q, t0, t1);
    net.addEdge(n0, n1, e.curved ? [sub.cx, sub.cy] : null);
  }
}

function isCentre(v: number): boolean {
  return Math.abs(v - Math.floor(v) - 0.5) < 1e-9;
}

/**
 * Build a network from a tile layer (saves from before free-angle track):
 * a node in every tile, edges between neighbouring tiles, straight runs
 * merged. The result covers exactly the same tiles.
 */
export function importTiles(net: TrackNet, layer: Uint8Array): void {
  net.clear();
  const { w, h } = net;
  const flag = net.profile.flag;
  const ids = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) if (layer[i] & flag) ids[i] = net.addNode((i % w) + 0.5, Math.floor(i / w) + 0.5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!ids[i]) continue;
      if (x + 1 < w && ids[i + 1]) net.addEdge(ids[i], ids[i + 1], null);
      if (y + 1 < h && ids[i + w]) net.addEdge(ids[i], ids[i + w], null);
    }
  }
  const info = newEditInfo();
  for (const id of net.nodes.keys()) info.nodes.add(id);
  tidy(net, info);
  net.refresh();
}
