import { NET } from '../../sim/types';
import type { TrackNet } from '../../sim/tracks/net';
import { PAL } from '../palette';
import { deckY, offsetLine, ROAD_Y, sections } from './common';
import { drape, drapeBand, drapeFan, inChunk, type DrapeStyle, type Target } from './drape';
import { bridge } from './roads';
import { groundBox } from './solid';

const BED_Y = 0.02;
const TIE_Y = 0.028;
const RAIL_Y = 0.05;
/** Half widths: gravel bed, sleepers, rail centres from the middle, rail. */
const BED = 0.2;
const TIE = 0.17;
const GAUGE = 0.09;
const RAIL_W = 0.012;
/** Bridge deck half width. */
const DECK_HW = 0.32;

/** Railway track: gravel bed, sleepers and rails (on top of roads at level crossings). */
export function buildRails(t: Target): void {
  const net = t.world.tracks.rail;
  const near = net.query(t.x0 - 1, t.y0 - 1, t.x1 + 1, t.y1 + 1);
  for (const id of near.edges) railEdge(t, net, id);
  for (const id of near.nodes) railNode(t, net, id);
}

function styles(t: Target) {
  const deck = deckY(t.world);
  return {
    bed: { hex: PAL.gravel, land: BED_Y, water: deck + 0.004, flag: NET.ROAD } as DrapeStyle,
    tie: { hex: PAL.railTie, land: TIE_Y, water: deck + 0.01, flag: NET.ROAD, onFlag: ROAD_Y + 0.008 } as DrapeStyle,
    rail: { hex: PAL.steel, land: RAIL_Y, water: deck + 0.03, flag: NET.ROAD, onFlag: ROAD_Y + 0.02 } as DrapeStyle,
  };
}

/** Bed, sleepers and rails along a run of track between two arc lengths. */
function track(t: Target, net: TrackNet, id: number, s0: number, s1: number): void {
  const st = styles(t);
  const secs = sections(net, id, s0, s1, 0.5);
  drapeBand(t, offsetLine(secs, -BED), offsetLine(secs, BED), st.bed);
  for (const g of [-GAUGE, GAUGE]) drapeBand(t, offsetLine(secs, g - RAIL_W), offsetLine(secs, g + RAIL_W), st.rail);
  // sleepers every quarter tile
  for (let s = Math.ceil((s0 - 0.125) / 0.25) * 0.25 + 0.125; s < s1; s += 0.25) {
    const a = Math.max(s0, s - 0.03);
    const b = Math.min(s1, s + 0.03);
    if (b - a < 0.01) continue;
    const c = sections(net, id, a, b, 1);
    drapeBand(t, offsetLine(c, -TIE), offsetLine(c, TIE), st.tie);
  }
}

function railEdge(t: Target, net: TrackNet, id: number): void {
  const len = net.length(id);
  track(t, net, id, 0, len);
  const deck = deckY(t.world);
  const secs = sections(net, id, 0, len, 0.5);
  drapeBand(t, offsetLine(secs, -DECK_HW), offsetLine(secs, DECK_HW), { hex: 0x8d8a85, water: deck });
  bridge(t, secs, DECK_HW, deck);
}

function railNode(t: Target, net: TrackNet, id: number): void {
  const node = net.nodes.get(id)!;
  const deg = net.degree(id);
  const st = styles(t);
  if (deg >= 2) {
    // fill the gravel between the arms
    drapeFan(t, node.x, node.y, net.outline(id, BED), st.bed);
    return;
  }
  // a lone piece runs east–west; a dead end runs on to the end of its tile, with a buffer stop
  const [dx, dy] = deg === 1 ? [-net.arms(id)[0].dx, -net.arms(id)[0].dy] : [1, 0];
  const from = deg === 1 ? 0 : -0.5;
  const to = net.profile.cap;
  const P = (u: number, v: number) => [node.x + dx * u - dy * v, node.y + dy * u + dx * v];
  const quad = (u0: number, v0: number, u1: number, v1: number) => [...P(u0, v0), ...P(u1, v0), ...P(u1, v1), ...P(u0, v1)];
  drape(t, quad(from, -BED, to, BED), st.bed);
  for (const g of [-GAUGE, GAUGE]) drape(t, quad(from, g - RAIL_W, to - 0.08, g + RAIL_W), st.rail);
  for (let u = from + 0.125; u < to - 0.05; u += 0.25) drape(t, quad(u - 0.03, -TIE, u + 0.03, TIE), st.tie);
  if (deg === 1 && inChunk(t, node.x, node.y)) {
    const [x, z] = P(to - 0.06, 0);
    const y = t.world.surfaceY(x, z);
    groundBox(t.buf, x - 0.05, y, z - 0.05, x + 0.05, y + 0.09, z + 0.05, PAL.red, PAL.white);
  }
}
