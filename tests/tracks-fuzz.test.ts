import { describe, expect, it } from 'vitest';
import { linePath, planBulldoze, planLine } from '../src/sim/actions';
import { planTrack } from '../src/sim/tracks/plan';
import { TRACK_KINDS, type TrackKind } from '../src/sim/tracks/net';
import { UndoStack } from '../src/sim/undo';
import { deserialize, serialize } from '../src/sim/save';
import { Rng } from '../src/util/rng';
import type { Sim } from '../src/sim/sim';
import { flatSim } from './helpers';

/** Every tile's NET bits match the coverage of its network, and the graphs hold together. */
function checkConsistent(sim: Sim): void {
  const w = sim.world;
  for (const kind of TRACK_KINDS) {
    const net = w.tracks[kind];
    const flag = net.profile.flag;
    for (let i = 0; i < w.size; i++) {
      if (((w.net[i] & flag) !== 0) !== net.cover[i] > 0) throw new Error(`${kind} tile ${i % w.w},${(i / w.w) | 0} out of sync`);
    }
    for (const e of net.edges.values()) {
      if (!net.nodes.has(e.a) || !net.nodes.has(e.b) || e.a === e.b) throw new Error(`${kind} edge ${e.id} is broken`);
      if (!net.edgesAt(e.a).includes(e.id) || !net.edgesAt(e.b).includes(e.id)) throw new Error(`${kind} edge ${e.id} not linked`);
    }
    let links = 0;
    for (const n of net.nodes.keys()) links += net.degree(n);
    if (links !== net.edges.size * 2) throw new Error(`${kind} adjacency mismatch`);
  }
}

describe('track editing under random use', () => {
  it('keeps graphs and tiles consistent through building, bulldozing, undo and saving', () => {
    const sim = flatSim(64, 7);
    sim.city.startYear = 1960;
    sim.city.funds = 1e9;
    const rng = new Rng(2024);
    const undo = new UndoStack(400);
    const kinds: TrackKind[] = ['road', 'road', 'road', 'rail', 'highway'];
    const p = () => rng.int(2, 61) + rng.pick([0.5, 0.5, rng.next()]);
    let built = 0;
    let refused = 0;
    for (let step = 0; step < 260; step++) {
      const kind = rng.pick(kinds);
      const r = rng.next();
      let plan;
      if (r < 0.35) {
        const [x0, y0, x1, y1] = [rng.int(1, 62), rng.int(1, 62), rng.int(1, 62), rng.int(1, 62)];
        plan = planLine(sim, kind, linePath(x0, y0, x1, y1, rng.chance(0.5)));
      } else if (r < 0.65) {
        plan = planTrack(sim, kind, { type: 'free', ax: p(), ay: p(), bx: p(), by: p(), c: null });
      } else if (r < 0.88) {
        plan = planTrack(sim, kind, { type: 'free', ax: p(), ay: p(), bx: p(), by: p(), c: [p(), p()] });
      } else {
        const x = rng.int(0, 60);
        const y = rng.int(0, 60);
        plan = planBulldoze(sim, x, y, x + rng.int(0, 4), y + rng.int(0, 4));
      }
      if (undo.apply(sim, plan, plan.kind)) built++;
      else refused++;
      checkConsistent(sim);
    }
    expect(built).toBeGreaterThan(40);
    expect(refused).toBeGreaterThan(20);
    // saving keeps everything
    const copy = deserialize(serialize(sim));
    checkConsistent(copy);
    for (const kind of TRACK_KINDS) expect(copy.world.tracks[kind].toData()).toEqual(sim.world.tracks[kind].toData());
    // undoing everything leaves an empty map
    while (undo.undo(sim)) checkConsistent(sim);
    for (const kind of TRACK_KINDS) {
      expect(sim.world.tracks[kind].edges.size).toBe(0);
      expect(sim.world.tracks[kind].nodes.size).toBe(0);
    }
    expect(sim.world.net.every((v) => v === 0)).toBe(true);
  });
});
