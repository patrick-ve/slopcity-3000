import { LEVEL_H, type World } from '../../sim/world';
import type { TrackNet } from '../../sim/tracks/net';
import { PAL } from '../palette';
import { pointAt, rampAt, sections, trackBelow, type Section } from './common';
import { inChunk, type Target } from './drape';
import { pillar, quadOut, slab, triOut, wall } from './solid';

/** Height of the highway deck above the highest corner of the ground below. */
export const HIGHWAY_CLEAR = 0.7;
/** Half width of the deck. */
const DECK_HW = 0.42;
const THICK = 0.08;
const SIDE = 0xb9b4aa;
const BARRIER = 0xd8d4cc;
const PILLAR = 0xa8a296;

// ---------------------------------------------------------------- heights

interface Profile {
  /** Arc lengths and deck heights; the deck runs straight between them. */
  s: number[];
  y: number[];
}

const profiles = new WeakMap<TrackNet, { version: number; byEdge: Map<number, Profile> }>();

/** Deck height above a point: clear of the ground (or water) of its tile. */
function clearance(world: World, x: number, z: number): number {
  const tx = Math.min(world.w - 1, Math.max(0, Math.floor(x)));
  const tz = Math.min(world.h - 1, Math.max(0, Math.floor(z)));
  return Math.max(world.tileMax(tx, tz), world.seaLevel) * LEVEL_H + HIGHWAY_CLEAR;
}

/** Deck height of a highway junction or end. */
export function nodeDeck(world: World, net: TrackNet, id: number): number {
  const n = net.nodes.get(id)!;
  return clearance(world, n.x, n.y);
}

function profile(world: World, net: TrackNet, id: number): Profile {
  let cache = profiles.get(net);
  if (!cache || cache.version !== net.version) {
    cache = { version: net.version, byEdge: new Map() };
    profiles.set(net, cache);
  }
  let p = cache.byEdge.get(id);
  if (p) return p;
  const e = net.edges.get(id)!;
  const len = net.length(id);
  const [s0, s1] = net.span(id);
  const ya = nodeDeck(world, net, e.a);
  const yb = nodeDeck(world, net, e.b);
  p = { s: [0, s0], y: [ya, ya] };
  // one height per tile length along the open stretch (tile centres on grid highways); flat inside junctions
  for (let k = Math.floor(s0) + 1; k < s1 - 0.25; k++) {
    if (k <= s0 + 0.25) continue;
    const [x, z] = pointAt(net, id, k);
    p.s.push(k);
    p.y.push(clearance(world, x, z));
  }
  p.s.push(s1, len);
  p.y.push(yb, yb);
  cache.byEdge.set(id, p);
  return p;
}

/** Height of a highway deck at arc length s along an edge (a smooth curve through the profile). */
export function deckAt(world: World, net: TrackNet, id: number, s: number): number {
  const p = profile(world, net, id);
  const n = p.s.length;
  // flat inside junctions and at the ends
  if (s <= p.s[1]) return p.y[0];
  if (s >= p.s[n - 2]) return p.y[n - 1];
  let i = 2;
  while (i < n - 1 && s > p.s[i]) i++;
  const span = p.s[i] - p.s[i - 1];
  if (span < 1e-9) return p.y[i];
  const t = (s - p.s[i - 1]) / span;
  // Catmull–Rom through the neighbouring heights
  const y0 = p.y[Math.max(0, i - 2)];
  const y1 = p.y[i - 1];
  const y2 = p.y[i];
  const y3 = p.y[Math.min(n - 1, i + 1)];
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3);
}

// ---------------------------------------------------------------- meshes

/** Elevated highways: decks, barriers, lane markings and pillars in one chunk. */
export function buildHighways(t: Target): void {
  const net = t.world.tracks.highway;
  const near = net.query(t.x0 - 1, t.y0 - 1, t.x1 + 1, t.y1 + 1);
  for (const id of near.edges) highwayEdge(t, net, id);
  for (const id of near.nodes) highwayNode(t, net, id);
}

const at = (c: Section, o: number, y: number) => [c.x + c.nx * o, y, c.z + c.nz * o];

function highwayEdge(t: Target, net: TrackNet, id: number): void {
  const w = t.world;
  const buf = t.buf;
  const [s0, s1] = net.span(id);
  if (s1 - s0 < 1e-6) return;
  const secs = sections(net, id, s0, s1, 0.5);
  const y = secs.map((c) => deckAt(w, net, id, c.s));
  for (let k = 0; k + 1 < secs.length; k++) {
    const a = secs[k];
    const b = secs[k + 1];
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    if (!inChunk(t, mx, mz)) continue;
    const ya = y[k];
    const yb = y[k + 1];
    quadOut(buf, at(a, -DECK_HW, ya), at(b, -DECK_HW, yb), at(b, DECK_HW, yb), at(a, DECK_HW, ya), [0, 1, 0], PAL.asphalt);
    quadOut(
      buf,
      at(a, -DECK_HW, ya - THICK),
      at(b, -DECK_HW, yb - THICK),
      at(b, DECK_HW, yb - THICK),
      at(a, DECK_HW, ya - THICK),
      [0, -1, 0],
      0x8f8a80,
    );
    for (const side of [-1, 1]) {
      const o = DECK_HW * side;
      const [ax, , az] = at(a, o, 0);
      const [bx, , bz] = at(b, o, 0);
      wall(buf, ax, az, ya, ya - THICK, bx, bz, yb, yb - THICK, a.nx * side, a.nz * side, SIDE);
      // barrier, open where an on-ramp joins
      if (rampAt(w, mx + a.nx * side * 0.65, mz + a.nz * side * 0.65)) continue;
      const r = (DECK_HW - 0.025) * side;
      const [rx0, , rz0] = at(a, r, 0);
      const [rx1, , rz1] = at(b, r, 0);
      slab(buf, rx0, rz0, ya + 0.06, rx1, rz1, yb + 0.06, 0.025, 0.06, BARRIER, BARRIER);
    }
    // markings: a solid yellow centre line and dashed white lane lines
    stripe(buf, a, b, ya, yb, 0, 0.009, PAL.laneYellow);
    const dashOn = Math.floor((a.s + b.s) / 2 / 0.5) % 2 === 0;
    if (dashOn) for (const lat of [-0.21, 0.21]) stripe(buf, a, b, ya, yb, lat, 0.006, PAL.laneWhite);
  }
  // pillars every two tiles along the open stretch
  for (let s = s0 + 1; s < s1 - 0.4; s += 2) {
    const [c] = sections(net, id, s, Math.min(s1, s + 0.01), 1);
    if (!c || !inChunk(t, c.x, c.z)) continue;
    pillars(t, c.x, c.z, -c.nz, c.nx, deckAt(w, net, id, s) - THICK);
  }
}

function stripe(buf: Target['buf'], a: Section, b: Section, ya: number, yb: number, lat: number, half: number, hex: number): void {
  quadOut(
    buf,
    at(a, lat - half, ya + 0.004),
    at(b, lat - half, yb + 0.004),
    at(b, lat + half, yb + 0.004),
    at(a, lat + half, ya + 0.004),
    [0, 1, 0],
    hex,
  );
}

/** A pillar under the deck at (x, z), or one on each side when a road or rail runs below. */
function pillars(t: Target, x: number, z: number, dx: number, dz: number, top: number): void {
  const w = t.world;
  const ground = (px: number, pz: number) =>
    w.tileMin(Math.min(w.w - 1, Math.floor(px)), Math.min(w.h - 1, Math.floor(pz))) * LEVEL_H - 0.05;
  if (!trackBelow(w, x, z)) {
    pillar(t.buf, x, z, ground(x, z), top, dx, dz, PILLAR);
    return;
  }
  const l = Math.hypot(dx, dz) || 1;
  const [nx, nz] = [-dz / l, dx / l];
  const sides = [-0.36, 0.36].map((o) => [x + nx * o, z + nz * o]);
  if (sides.some(([px, pz]) => trackBelow(w, px, pz))) return;
  for (const [px, pz] of sides) pillar(t.buf, px, pz, ground(px, pz), top, dx, dz, PILLAR, 0.06);
}

function highwayNode(t: Target, net: TrackNet, id: number): void {
  const w = t.world;
  const buf = t.buf;
  const node = net.nodes.get(id)!;
  if (!inChunk(t, node.x, node.y)) return;
  const y = nodeDeck(w, net, id);
  const deg = net.degree(id);
  if (deg <= 1) {
    // a dead end (or a lone square): the deck runs on to the end of its tile and stops at a barrier
    const [dx, dz] = deg === 1 ? [-net.arms(id)[0].dx, -net.arms(id)[0].dy] : [1, 0];
    const from = deg === 1 ? 0 : -0.5;
    const cap = net.profile.cap;
    const [nx, nz] = [-dz, dx];
    const P = (u: number, v: number) => [node.x + dx * u + nx * v, node.y + dz * u + nz * v];
    const [sx, sz] = P(from, 0);
    const [ex, ez] = P(cap, 0);
    slab(buf, sx, sz, y, ex, ez, y, DECK_HW, THICK, PAL.asphalt, SIDE, true);
    for (const side of [-1, 1]) {
      const [ax, az] = P(from, (DECK_HW - 0.025) * side);
      const [bx, bz] = P(cap - 0.025, (DECK_HW - 0.025) * side);
      if (!rampAt(w, (ax + bx) / 2 + nx * side * 0.6, (az + bz) / 2 + nz * side * 0.6))
        slab(buf, ax, az, y + 0.06, bx, bz, y + 0.06, 0.025, 0.06, BARRIER, BARRIER);
    }
    const [lx, lz] = P(cap - 0.025, -DECK_HW);
    const [rx, rz] = P(cap - 0.025, DECK_HW);
    slab(buf, lx, lz, y + 0.06, rx, rz, y + 0.06, 0.025, 0.06, BARRIER, BARRIER, true);
    if (deg === 0) {
      const [l2x, l2z] = P(from + 0.025, -DECK_HW);
      const [r2x, r2z] = P(from + 0.025, DECK_HW);
      slab(buf, l2x, l2z, y + 0.06, r2x, r2z, y + 0.06, 0.025, 0.06, BARRIER, BARRIER, true);
    }
    pillars(t, node.x, node.y, dx, dz, y - THICK);
    return;
  }
  // junction: a flat deck inside the curbs, with walls and barriers along them
  const ring = net.outline(id, DECK_HW);
  const n = ring.length >> 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = [ring[i * 2], y, ring[i * 2 + 1]];
    const b = [ring[j * 2], y, ring[j * 2 + 1]];
    triOut(buf, [node.x, y, node.y], a, b, [0, 1, 0], PAL.asphalt);
    triOut(buf, [node.x, y - THICK, node.y], [a[0], y - THICK, a[2]], [b[0], y - THICK, b[2]], [0, -1, 0], 0x8f8a80);
  }
  for (let i = 0; i < deg; i++) {
    const outer = net.curb(id, i, DECK_HW);
    const inner = net.curb(id, i, DECK_HW - 0.025);
    for (let k = 0; k + 3 < outer.length; k += 2) {
      const [ax, az, bx, bz] = [outer[k], outer[k + 1], outer[k + 2], outer[k + 3]];
      if (Math.hypot(bx - ax, bz - az) < 1e-6) continue;
      const [ox, oz] = [(ax + bx) / 2 - node.x, (az + bz) / 2 - node.y];
      wall(buf, ax, az, y, y - THICK, bx, bz, y, y - THICK, ox, oz, SIDE);
      const ol = Math.hypot(ox, oz) || 1;
      if (rampAt(w, (ax + bx) / 2 + (ox / ol) * 0.4, (az + bz) / 2 + (oz / ol) * 0.4)) continue;
      slab(buf, inner[k], inner[k + 1], y + 0.06, inner[k + 2], inner[k + 3], y + 0.06, 0.025, 0.06, BARRIER, BARRIER);
    }
  }
  const arm = net.arms(id)[0];
  pillars(t, node.x, node.y, arm.dx, arm.dy, y - THICK);
}
