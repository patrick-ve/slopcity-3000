/**
 * Track networks: roads, rails and highways as graphs of nodes and curved
 * edges (quadratic Béziers). Tracks can run at any angle; the simulation still
 * works on tiles, so every network keeps a per-tile coverage count of its
 * footprint and the World derives its NET bits from it (see World.syncTracks).
 */
import { NET } from '../types';
import {
  bezierPoints,
  convexHitsRect,
  curvePoint,
  curveTangent,
  lineIntersect,
  paramAt,
  sampleCurve,
  stripParams,
  type Curve,
  type Polyline,
} from './geom';

export type TrackKind = 'road' | 'rail' | 'highway';
export const TRACK_KINDS: readonly TrackKind[] = ['road', 'rail', 'highway'];

export interface TrackProfile {
  /** Half width of the footprint (sidewalks and barriers included). */
  hw: number;
  /** Length of the square end past a dead end. */
  cap: number;
  /** Bit in World.net. */
  flag: number;
  /** Smallest angle between two tracks meeting at a junction (radians). */
  minAngle: number;
  /** Tightest curve radius. */
  minRadius: number;
  /** Word for messages ("Too close to another road"). */
  noun: string;
}

const DEG = Math.PI / 180;

export const PROFILES: Record<TrackKind, TrackProfile> = {
  road: { hw: 0.5, cap: 0.5, flag: NET.ROAD, minAngle: 30 * DEG, minRadius: 1.25, noun: 'road' },
  rail: { hw: 0.3, cap: 0.5, flag: NET.RAIL, minAngle: 30 * DEG, minRadius: 1.5, noun: 'track' },
  highway: { hw: 0.45, cap: 0.5, flag: NET.HIGHWAY, minAngle: 30 * DEG, minRadius: 1.5, noun: 'highway' },
};

/** Tiles shrink by this margin before they are tested against a footprint (so touching is not covering). */
export const TILE_MARGIN = 0.06;
const BUCKET = 8;
/** Reach of a junction shape around its node (bucket padding). */
const PAD = 3;

export interface TrackNode {
  id: number;
  x: number;
  y: number;
}

export interface TrackEdge {
  id: number;
  a: number;
  b: number;
  /** Bézier control point (the midpoint for straight edges). */
  cx: number;
  cy: number;
  curved: boolean;
}

/** One edge leaving a node. */
export interface Arm {
  edge: number;
  /** 0: the edge starts at this node, 1: it ends here. */
  end: 0 | 1;
  /** Unit direction away from the node. */
  dx: number;
  dy: number;
  angle: number;
  /** Distance along the edge where the junction area ends. */
  cut: number;
  /** Cut the junction needs (before limiting it to the edge length). */
  need: number;
}

/** Position and unit tangent (pointing away from the node) where an arm leaves the junction. */
export interface ArmFrame {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

type Op = { k: 'n+'; id: number } | { k: 'n-'; node: TrackNode } | { k: 'e+'; id: number } | { k: 'e-'; edge: TrackEdge };

/** Changes made since TrackNet.begin(), enough to revert them. */
export interface TrackLog {
  ops: Op[];
  nextNode: number;
  nextEdge: number;
}

/** Compact save data: nodes [id, x, y]…, edges [id, a, b, curved, cx, cy]…. */
export interface TrackData {
  nodes: number[];
  edges: number[];
  next: [number, number];
}

export class TrackNet {
  readonly profile: TrackProfile;
  readonly nodes = new Map<number, TrackNode>();
  readonly edges = new Map<number, TrackEdge>();
  nextNode = 1;
  nextEdge = 1;
  /** Number of footprints covering each tile. */
  readonly cover: Uint16Array;
  /** Bumped on every change (renderer, vehicles). */
  version = 0;
  /**
   * Tiles whose coverage may have switched on or off, with whether they were
   * covered before (consumed by World.syncTracks; see changes()).
   */
  flips = new Map<number, boolean>();
  /** Tiles whose track geometry changed (redraw). */
  touched = new Set<number>();

  private adj = new Map<number, number[]>();
  private foot = new Map<number, Int32Array>();
  private dirty = new Set<number>();
  private polyCache = new Map<number, Polyline>();
  private armCache = new Map<number, Arm[]>();
  private buckets = new Map<number, Set<number>>();
  private bucketsOf = new Map<number, number[]>();
  private readonly bw: number;
  private readonly bh: number;
  /** Open recordings (innermost last); committed inner recordings join the outer one. */
  private logs: TrackLog[] = [];

  constructor(
    readonly kind: TrackKind,
    readonly w: number,
    readonly h: number,
  ) {
    this.profile = PROFILES[kind];
    this.cover = new Uint16Array(w * h);
    this.bw = Math.ceil(w / BUCKET);
    this.bh = Math.ceil(h / BUCKET);
  }

  // ------------------------------------------------------------- queries

  /** Edge ids at a node. */
  edgesAt(n: number): readonly number[] {
    return this.adj.get(n) ?? [];
  }

  degree(n: number): number {
    return this.adj.get(n)?.length ?? 0;
  }

  /** The other end of an edge. */
  other(e: TrackEdge, n: number): number {
    return e.a === n ? e.b : e.a;
  }

  curve(e: TrackEdge): Curve {
    const a = this.nodes.get(e.a)!;
    const b = this.nodes.get(e.b)!;
    return { ax: a.x, ay: a.y, cx: e.cx, cy: e.cy, bx: b.x, by: b.y, straight: !e.curved };
  }

  /** Sampled shape of an edge (cached). */
  poly(id: number): Polyline {
    let p = this.polyCache.get(id);
    if (!p) {
      p = sampleCurve(this.curve(this.edges.get(id)!), 0.2);
      this.polyCache.set(id, p);
    }
    return p;
  }

  length(id: number): number {
    return this.poly(id).len;
  }

  /** Nodes and edges whose bounding boxes (padded) touch a rectangle. */
  query(x0: number, y0: number, x1: number, y1: number): { nodes: number[]; edges: number[] } {
    const nodes: number[] = [];
    const edges: number[] = [];
    const seen = new Set<number>();
    const bx0 = Math.max(0, Math.floor(x0 / BUCKET));
    const by0 = Math.max(0, Math.floor(y0 / BUCKET));
    const bx1 = Math.min(this.bw - 1, Math.floor(x1 / BUCKET));
    const by1 = Math.min(this.bh - 1, Math.floor(y1 / BUCKET));
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const set = this.buckets.get(by * this.bw + bx);
        if (!set) continue;
        for (const k of set) {
          if (seen.has(k)) continue;
          seen.add(k);
          const [ax0, ay0, ax1, ay1] = this.bbox(k);
          if (ax1 < x0 || ax0 > x1 || ay1 < y0 || ay0 > y1) continue;
          if (k > 0) nodes.push(k);
          else edges.push(-k);
        }
      }
    }
    return { nodes, edges };
  }

  /** Padded bounding box of an element (key: node id, or −edge id). */
  private bbox(k: number): [number, number, number, number] {
    if (k > 0) {
      const n = this.nodes.get(k)!;
      return [n.x - PAD, n.y - PAD, n.x + PAD, n.y + PAD];
    }
    const e = this.edges.get(-k)!;
    const a = this.nodes.get(e.a)!;
    const b = this.nodes.get(e.b)!;
    return [Math.min(a.x, b.x, e.cx) - PAD, Math.min(a.y, b.y, e.cy) - PAD, Math.max(a.x, b.x, e.cx) + PAD, Math.max(a.y, b.y, e.cy) + PAD];
  }

  private index(k: number): void {
    const [x0, y0, x1, y1] = this.bbox(k);
    const list: number[] = [];
    for (let by = Math.max(0, Math.floor(y0 / BUCKET)); by <= Math.min(this.bh - 1, Math.floor(y1 / BUCKET)); by++) {
      for (let bx = Math.max(0, Math.floor(x0 / BUCKET)); bx <= Math.min(this.bw - 1, Math.floor(x1 / BUCKET)); bx++) {
        const b = by * this.bw + bx;
        let set = this.buckets.get(b);
        if (!set) this.buckets.set(b, (set = new Set()));
        set.add(k);
        list.push(b);
      }
    }
    this.bucketsOf.set(k, list);
  }

  private unindex(k: number): void {
    for (const b of this.bucketsOf.get(k) ?? []) this.buckets.get(b)?.delete(k);
    this.bucketsOf.delete(k);
  }

  // ------------------------------------------------------------- editing

  addNode(x: number, y: number): number {
    const id = this.nextNode++;
    this.putNode({ id, x, y });
    this.record({ k: 'n+', id });
    return id;
  }

  removeNode(id: number): void {
    const n = this.nodes.get(id);
    if (!n) return;
    if (this.degree(id)) throw new Error('track node still has edges');
    this.dropNode(id);
    this.record({ k: 'n-', node: n });
  }

  addEdge(a: number, b: number, c: [number, number] | null): number {
    if (a === b) throw new Error('track edge must join two nodes');
    const na = this.nodes.get(a)!;
    const nb = this.nodes.get(b)!;
    const id = this.nextEdge++;
    this.putEdge({ id, a, b, cx: c ? c[0] : (na.x + nb.x) / 2, cy: c ? c[1] : (na.y + nb.y) / 2, curved: !!c });
    this.record({ k: 'e+', id });
    return id;
  }

  removeEdge(id: number): void {
    const e = this.edges.get(id);
    if (!e) return;
    this.dropEdge(id);
    this.record({ k: 'e-', edge: e });
  }

  private putNode(n: TrackNode): void {
    this.nodes.set(n.id, n);
    this.adj.set(n.id, []);
    this.index(n.id);
    this.armCache.delete(n.id);
    this.dirty.add(n.id);
    this.version++;
  }

  private dropNode(id: number): void {
    this.unindex(id);
    this.nodes.delete(id);
    this.adj.delete(id);
    this.armCache.delete(id);
    this.dirty.add(id);
    this.version++;
  }

  private putEdge(e: TrackEdge): void {
    this.edges.set(e.id, { ...e });
    this.adj.get(e.a)!.push(e.id);
    this.adj.get(e.b)!.push(e.id);
    this.polyCache.delete(e.id);
    this.index(-e.id);
    this.dirty.add(-e.id);
    this.touchNode(e.a);
    this.touchNode(e.b);
    this.version++;
  }

  private dropEdge(id: number): void {
    const e = this.edges.get(id)!;
    this.unindex(-id);
    this.edges.delete(id);
    for (const n of [e.a, e.b]) {
      const list = this.adj.get(n);
      const at = list ? list.indexOf(id) : -1;
      if (at >= 0) list!.splice(at, 1);
    }
    this.polyCache.delete(id);
    this.dirty.add(-id);
    this.touchNode(e.a);
    this.touchNode(e.b);
    this.version++;
  }

  /** A node's junction changed: its shape and the ends of its edges need a refresh. */
  private touchNode(n: number): void {
    this.armCache.delete(n);
    this.dirty.add(n);
    for (const e of this.adj.get(n) ?? []) this.dirty.add(-e);
  }

  private record(op: Op): void {
    this.logs[this.logs.length - 1]?.ops.push(op);
  }

  /** Start recording changes (for a trial edit or an undo entry). Recordings nest. */
  begin(): void {
    this.logs.push({ ops: [], nextNode: this.nextNode, nextEdge: this.nextEdge });
  }

  /** Stop the innermost recording and return its changes (an outer recording keeps them too). */
  commit(): TrackLog {
    const log = this.logs.pop();
    if (!log) throw new Error('no track recording to commit');
    const outer = this.logs[this.logs.length - 1];
    if (outer) for (const op of log.ops) outer.ops.push(op);
    return log;
  }

  /** Undo the changes since the innermost begin(). */
  rollback(): void {
    const log = this.logs.pop();
    if (!log) throw new Error('no track recording to roll back');
    this.revert(log);
  }

  /** Undo recorded changes (newest first) and refresh the coverage. */
  revert(log: TrackLog): void {
    for (let i = log.ops.length - 1; i >= 0; i--) {
      const op = log.ops[i];
      if (op.k === 'n+') this.dropNode(op.id);
      else if (op.k === 'n-') this.putNode(op.node);
      else if (op.k === 'e+') this.dropEdge(op.id);
      else this.putEdge(op.edge);
    }
    this.nextNode = log.nextNode;
    this.nextEdge = log.nextEdge;
    this.refresh();
  }

  /**
   * Run an edit, look at the result, then undo it. Coverage changes made by
   * the edit are visible in `flips`/`touched` inside `inspect` only.
   */
  trial<T>(edit: () => void, inspect: () => T): T {
    const flips = this.flips;
    const touched = this.touched;
    this.flips = new Map();
    this.touched = new Set();
    this.begin();
    try {
      edit();
      this.refresh();
      return inspect();
    } finally {
      this.rollback();
      this.flips = flips;
      this.touched = touched;
    }
  }

  // ------------------------------------------------------------ junctions

  /** Edges leaving a node, sorted by angle, with their junction cuts (cached). */
  arms(n: number): Arm[] {
    let arms = this.armCache.get(n);
    if (arms) return arms;
    const hw = this.profile.hw;
    arms = this.edgesAt(n).map((id) => {
      const e = this.edges.get(id)!;
      const q = this.curve(e);
      const end: 0 | 1 = e.a === n ? 0 : 1;
      let [dx, dy] = curveTangent(q, end);
      if (end === 1) {
        dx = -dx;
        dy = -dy;
      }
      return { edge: id, end, dx, dy, angle: Math.atan2(dy, dx), cut: 0, need: 0 };
    });
    arms.sort((p, q) => p.angle - q.angle || p.edge - q.edge);
    const k = arms.length;
    if (k >= 2) {
      const gap = (i: number) => {
        let g = arms![(i + 1) % k].angle - arms![i].angle;
        if (g <= 1e-9) g += Math.PI * 2;
        return g;
      };
      const need = (g: number) => (g < Math.PI - 1e-6 ? hw / Math.tan(g / 2) : 0);
      for (let i = 0; i < k; i++) {
        const a = arms[i];
        a.need = Math.max(need(gap(i)), need(gap((i + k - 1) % k)));
        a.cut = Math.min(a.need, this.length(a.edge) * 0.49);
      }
    }
    this.armCache.set(n, arms);
    return arms;
  }

  /** The junction cut at one end of an edge. */
  cutAt(edgeId: number, end: 0 | 1): number {
    const e = this.edges.get(edgeId)!;
    const arm = this.arms(end === 0 ? e.a : e.b).find((a) => a.edge === edgeId && a.end === end);
    return arm?.cut ?? 0;
  }

  /** Where an arm leaves its junction (or any distance along it from the node). */
  armFrame(arm: Arm, dist = arm.cut): ArmFrame {
    const e = this.edges.get(arm.edge)!;
    const q = this.curve(e);
    const p = this.poly(arm.edge);
    const t = paramAt(p, arm.end === 0 ? dist : p.len - dist);
    const [x, y] = curvePoint(q, t);
    let [tx, ty] = curveTangent(q, t);
    if (arm.end === 1) {
      tx = -tx;
      ty = -ty;
    }
    return { x, y, tx, ty };
  }

  /**
   * Curb between arm i and the next arm (by angle) of a junction, at a
   * lateral offset: `segments + 1` points from arm i's left corner to the
   * next arm's right corner (repeated points where the two corners meet).
   */
  curb(n: number, i: number, offset: number, segments = 6): number[] {
    const arms = this.arms(n);
    const f = this.armFrame(arms[i]);
    const g = this.armFrame(arms[(i + 1) % arms.length]);
    const [lx, ly] = [f.x - f.ty * offset, f.y + f.tx * offset];
    const [rx, ry] = [g.x + g.ty * offset, g.y - g.tx * offset];
    const c = curbControl(lx, ly, f.tx, f.ty, rx, ry, g.tx, g.ty) ?? [(lx + rx) / 2, (ly + ry) / 2];
    return bezierPoints(lx, ly, c[0], c[1], rx, ry, segments);
  }

  /**
   * Outline of a junction (two or more arms) at a lateral offset from the
   * centre lines: across each arm's cut, then along the curb to the next arm.
   */
  outline(n: number, offset: number, segments = 6): number[] {
    const k = this.degree(n);
    const out: number[] = [];
    const push = (x: number, y: number) => {
      const m = out.length;
      if (m >= 2 && Math.abs(out[m - 2] - x) < 1e-9 && Math.abs(out[m - 1] - y) < 1e-9) return;
      out.push(x, y);
    };
    for (let i = 0; i < k; i++) {
      const pts = this.curb(n, i, offset, segments);
      for (let j = 0; j < pts.length; j += 2) push(pts[j], pts[j + 1]);
    }
    if (out.length >= 4 && Math.abs(out[0] - out[out.length - 2]) < 1e-9 && Math.abs(out[1] - out[out.length - 1]) < 1e-9) out.length -= 2;
    return out;
  }

  /** Square end past a dead end, `offset` wide on each side and `len` long. */
  capQuad(n: number, offset: number, len: number): number[] {
    const node = this.nodes.get(n)!;
    const a = this.arms(n)[0];
    const [dx, dy] = [a.dx, a.dy];
    const [nx, ny] = [-dy * offset, dx * offset];
    return [
      node.x - nx,
      node.y - ny,
      node.x + nx,
      node.y + ny,
      node.x + nx - dx * len,
      node.y + ny - dy * len,
      node.x - nx - dx * len,
      node.y - ny - dy * len,
    ];
  }

  /** Points along an edge between two distances from its start, offset to the left (+) or right (−). */
  side(edgeId: number, s0: number, s1: number, offset: number, maxStep = 1): number[] {
    const e = this.edges.get(edgeId)!;
    const q = this.curve(e);
    const ts = stripParams(q, this.poly(edgeId), s0, s1, maxStep);
    const out: number[] = [];
    for (const t of ts) {
      const [x, y] = curvePoint(q, t);
      const [tx, ty] = curveTangent(q, t);
      out.push(x - ty * offset, y + tx * offset);
    }
    return out;
  }

  /** Arc-length range of an edge outside its junctions: [start, end]. */
  span(edgeId: number): [number, number] {
    const len = this.length(edgeId);
    const s0 = this.cutAt(edgeId, 0);
    const s1 = len - this.cutAt(edgeId, 1);
    return [s0, Math.max(s0, s1)];
  }

  // ----------------------------------------------------------- footprints

  /** Footprint of an element as triangles (flat x, y lists of 6 numbers). */
  triangles(k: number): number[][] {
    const hw = this.profile.hw;
    const tris: number[][] = [];
    if (k > 0) {
      const node = this.nodes.get(k)!;
      const deg = this.degree(k);
      if (deg === 0) {
        quadTris(tris, [node.x - hw, node.y - hw, node.x + hw, node.y - hw, node.x + hw, node.y + hw, node.x - hw, node.y + hw]);
      } else if (deg === 1) {
        quadTris(tris, this.capQuad(k, hw, this.profile.cap));
      } else {
        const o = this.outline(k, hw);
        for (let i = 0; i < o.length >> 1; i++) {
          const j = (i + 1) % (o.length >> 1);
          tris.push([node.x, node.y, o[i * 2], o[i * 2 + 1], o[j * 2], o[j * 2 + 1]]);
        }
      }
      return tris;
    }
    const id = -k;
    const [s0, s1] = this.span(id);
    if (s1 - s0 < 1e-6) return tris;
    const l = this.side(id, s0, s1, hw);
    const r = this.side(id, s0, s1, -hw);
    for (let i = 0; i + 1 < l.length >> 1; i++) {
      quadTris(tris, [r[i * 2], r[i * 2 + 1], r[i * 2 + 2], r[i * 2 + 3], l[i * 2 + 2], l[i * 2 + 3], l[i * 2], l[i * 2 + 1]]);
    }
    return tris;
  }

  /** Tiles a footprint covers (sorted tile indices). */
  private footprint(k: number): Int32Array {
    const tiles = new Set<number>();
    const m = TILE_MARGIN;
    for (const t of this.triangles(k)) {
      const tx0 = Math.max(0, Math.floor(Math.min(t[0], t[2], t[4])));
      const ty0 = Math.max(0, Math.floor(Math.min(t[1], t[3], t[5])));
      const tx1 = Math.min(this.w - 1, Math.floor(Math.max(t[0], t[2], t[4])));
      const ty1 = Math.min(this.h - 1, Math.floor(Math.max(t[1], t[3], t[5])));
      for (let y = ty0; y <= ty1; y++) {
        for (let x = tx0; x <= tx1; x++) {
          const i = y * this.w + x;
          if (tiles.has(i)) continue;
          if (convexHitsRect(t, x + m, y + m, x + 1 - m, y + 1 - m)) tiles.add(i);
        }
      }
    }
    return Int32Array.from(tiles).sort();
  }

  /** Tiles that track newly covers (`on`) or no longer covers (`off`) since the flips were last cleared. */
  changes(): { on: number[]; off: number[] } {
    const on: number[] = [];
    const off: number[] = [];
    for (const [t, before] of this.flips) {
      const now = this.cover[t] > 0;
      if (now && !before) on.push(t);
      else if (!now && before) off.push(t);
    }
    return { on, off };
  }

  /** Tiles an element covers right now. */
  tilesOf(k: number): Int32Array {
    return this.foot.get(k) ?? new Int32Array(0);
  }

  /** Recompute the footprints of changed elements and the coverage counts. */
  refresh(): void {
    // edges first look up their junctions, so drop stale junction data before anything is measured
    for (const k of this.dirty) if (k > 0) this.armCache.delete(k);
    for (const k of this.dirty) {
      const old = this.foot.get(k);
      if (old) {
        for (const t of old) {
          if (--this.cover[t] === 0 && !this.flips.has(t)) this.flips.set(t, true);
          this.touched.add(t);
        }
      }
      const alive = k > 0 ? this.nodes.has(k) : this.edges.has(-k);
      if (alive) {
        const tiles = this.footprint(k);
        for (const t of tiles) {
          if (this.cover[t]++ === 0 && !this.flips.has(t)) this.flips.set(t, false);
          this.touched.add(t);
        }
        this.foot.set(k, tiles);
      } else {
        this.foot.delete(k);
      }
    }
    this.dirty.clear();
  }

  // -------------------------------------------------------------- saving

  toData(): TrackData {
    const nodes: number[] = [];
    const edges: number[] = [];
    for (const n of this.nodes.values()) nodes.push(n.id, n.x, n.y);
    for (const e of this.edges.values()) edges.push(e.id, e.a, e.b, e.curved ? 1 : 0, e.cx, e.cy);
    return { nodes, edges, next: [this.nextNode, this.nextEdge] };
  }

  /** Replace everything with saved data. */
  load(data: TrackData): void {
    this.clear();
    for (let i = 0; i + 2 < data.nodes.length; i += 3) this.putNode({ id: data.nodes[i], x: data.nodes[i + 1], y: data.nodes[i + 2] });
    for (let i = 0; i + 5 < data.edges.length; i += 6) {
      const [id, a, b, curved, cx, cy] = data.edges.slice(i, i + 6);
      if (!this.nodes.has(a) || !this.nodes.has(b) || a === b) continue;
      this.putEdge({ id, a, b, curved: curved === 1, cx, cy });
    }
    this.nextNode = Math.max(1, data.next[0]);
    this.nextEdge = Math.max(1, data.next[1]);
    for (const k of this.nodes.keys()) this.nextNode = Math.max(this.nextNode, k + 1);
    for (const k of this.edges.keys()) this.nextEdge = Math.max(this.nextEdge, k + 1);
    this.refresh();
  }

  clear(): void {
    for (const id of [...this.edges.keys()]) this.dropEdge(id);
    for (const id of [...this.nodes.keys()]) this.dropNode(id);
    this.refresh();
    this.nextNode = 1;
    this.nextEdge = 1;
  }
}

/** Control point for a curb between two facing corners, or null for a straight curb. */
function curbControl(
  ax: number,
  ay: number,
  atx: number,
  aty: number,
  bx: number,
  by: number,
  btx: number,
  bty: number,
): [number, number] | null {
  if (Math.hypot(bx - ax, by - ay) < 1e-6) return null;
  const r = lineIntersect(ax, ay, atx, aty, bx, by, btx, bty);
  if (!r || Math.abs(r[0]) > 4 || Math.abs(r[1]) > 4) return null;
  return [ax + atx * r[0], ay + aty * r[0]];
}

function quadTris(out: number[][], q: number[]): void {
  out.push([q[0], q[1], q[2], q[3], q[4], q[5]], [q[0], q[1], q[4], q[5], q[6], q[7]]);
}
