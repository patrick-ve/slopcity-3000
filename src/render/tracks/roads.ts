import { LEVEL_H } from '../../sim/world';
import type { TrackNet } from '../../sim/tracks/net';
import { PAL } from '../palette';
import { deckY, MARK_Y, offsetLine, piece, ROAD_Y, sections, WALK_Y } from './common';
import { drape, drapeBand, drapeFan, inChunk, type Target } from './drape';
import { pillar, quadOut, slab, wall } from './solid';

/** Half width of the carriageway; sidewalks fill the rest of the footprint. */
const HA = 0.4;
const DECK = 0x8d8a85;
const RAILING = 0xd8d4cc;
const PILLAR = 0x9a968e;

/** Streets: asphalt, sidewalks, centre lines, junctions and bridges in one chunk. */
export function buildRoads(t: Target): void {
  const net = t.world.tracks.road;
  const near = net.query(t.x0 - 1, t.y0 - 1, t.x1 + 1, t.y1 + 1);
  for (const id of near.edges) roadEdge(t, net, id);
  for (const id of near.nodes) roadNode(t, net, id);
}

function roadEdge(t: Target, net: TrackNet, id: number): void {
  const [s0, s1] = net.span(id);
  if (s1 - s0 < 1e-6) return;
  const hw = net.profile.hw;
  const deck = deckY(t.world);
  const secs = sections(net, id, s0, s1, 0.5);
  const L = offsetLine(secs, hw);
  const La = offsetLine(secs, HA);
  const Ra = offsetLine(secs, -HA);
  const R = offsetLine(secs, -hw);
  drapeBand(t, Ra, La, { hex: PAL.asphalt, land: ROAD_Y });
  drapeBand(t, La, L, { hex: PAL.sidewalk, land: WALK_Y });
  drapeBand(t, R, Ra, { hex: PAL.sidewalk, land: WALK_Y });
  // bridge deck: asphalt from railing to railing
  drapeBand(t, R, L, { hex: PAL.asphalt, water: deck });
  // dashed centre line, two dashes per tile
  for (let k = Math.ceil((s0 - 0.4) / 0.5); k * 0.5 + 0.1 < s1; k++) {
    const a = Math.max(s0, k * 0.5 + 0.1);
    const b = Math.min(s1, k * 0.5 + 0.4);
    if (b - a < 0.04) continue;
    const [l, r] = piece(net, id, a, b, -0.015, 0.015);
    drapeBand(t, l, r, { hex: PAL.laneYellow, land: MARK_Y, water: deck + 0.006 });
  }
  bridge(t, secs, hw, deck);
}

/** Deck slab, railings and pillars for the parts of a road or rail over water. */
export function bridge(t: Target, secs: ReturnType<typeof sections>, hw: number, deck: number): void {
  const w = t.world;
  const buf = t.buf;
  for (let k = 0; k + 1 < secs.length; k++) {
    const a = secs[k];
    const b = secs[k + 1];
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    if (!inChunk(t, mx, mz) || !w.isWater(Math.floor(mx), Math.floor(mz))) continue;
    for (const side of [-1, 1]) {
      const o = hw * side;
      wall(
        buf,
        a.x + a.nx * o,
        a.z + a.nz * o,
        deck,
        deck - 0.07,
        b.x + b.nx * o,
        b.z + b.nz * o,
        deck,
        deck - 0.07,
        a.nx * side,
        a.nz * side,
        DECK,
      );
      const r = (hw - 0.025) * side;
      slab(buf, a.x + a.nx * r, a.z + a.nz * r, deck + 0.06, b.x + b.nx * r, b.z + b.nz * r, deck + 0.06, 0.025, 0.06, RAILING, RAILING);
    }
    // underside
    const q = (c: typeof a, o: number) => [c.x + c.nx * o, deck - 0.07, c.z + c.nz * o];
    quadOut(buf, q(a, hw), q(b, hw), q(b, -hw), q(a, -hw), [0, -1, 0], 0x77736c);
    // a pillar down to the water bed every other tile
    const pk = Math.floor(b.s / 2);
    if (pk !== Math.floor(a.s / 2)) {
      const f = (pk * 2 - a.s) / Math.max(1e-6, b.s - a.s);
      const x = a.x + (b.x - a.x) * f;
      const z = a.z + (b.z - a.z) * f;
      const bed = w.tileMin(Math.floor(x), Math.floor(z)) * LEVEL_H;
      pillar(buf, x, z, bed, deck - 0.07, b.x - a.x, b.z - a.z, PILLAR, 0.1);
    }
  }
}

function roadNode(t: Target, net: TrackNet, id: number): void {
  const node = net.nodes.get(id)!;
  const deg = net.degree(id);
  const hw = net.profile.hw;
  const walk = { hex: PAL.sidewalk, land: WALK_Y };
  if (deg === 0) {
    // a lone square of road
    const sq = (o: number) => [node.x - o, node.y - o, node.x + o, node.y - o, node.x + o, node.y + o, node.x - o, node.y + o];
    drape(t, sq(HA), { hex: PAL.asphalt, land: ROAD_Y });
    const outer = sq(hw);
    const inner = sq(HA);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      drape(
        t,
        [outer[i * 2], outer[i * 2 + 1], outer[j * 2], outer[j * 2 + 1], inner[j * 2], inner[j * 2 + 1], inner[i * 2], inner[i * 2 + 1]],
        walk,
      );
    }
    return;
  }
  if (deg === 1) {
    // square dead end: carriageway, sidewalks on three sides
    const arm = net.arms(id)[0];
    const cap = net.profile.cap;
    const end = cap - (hw - HA);
    const P = (u: number, v: number) => [node.x - arm.dx * u - arm.dy * v, node.y - arm.dy * u + arm.dx * v];
    const quad = (u0: number, v0: number, u1: number, v1: number) => [...P(u0, v0), ...P(u1, v0), ...P(u1, v1), ...P(u0, v1)];
    drape(t, quad(0, -HA, end, HA), { hex: PAL.asphalt, land: ROAD_Y });
    drape(t, quad(0, HA, cap, hw), walk);
    drape(t, quad(0, -hw, cap, -HA), walk);
    drape(t, quad(end, -HA, cap, HA), walk);
    return;
  }
  // junction: carriageway inside the curbs, curved sidewalk corners
  drapeFan(t, node.x, node.y, net.outline(id, HA), { hex: PAL.asphalt, land: ROAD_Y });
  for (let i = 0; i < deg; i++) drapeBand(t, net.curb(id, i, HA), net.curb(id, i, hw), walk);
  if (deg < 3) return;
  // stop lines across the lanes coming in
  for (const arm of net.arms(id)) {
    const f = net.armFrame(arm);
    const [nx, ny] = [-f.ty, f.tx];
    const P = (u: number, v: number) => [f.x + f.tx * u + nx * v, f.y + f.ty * u + ny * v];
    drape(t, [...P(0.03, -HA + 0.03), ...P(0.08, -HA + 0.03), ...P(0.08, -0.03), ...P(0.03, -0.03)], { hex: PAL.laneWhite, land: MARK_Y });
  }
}
