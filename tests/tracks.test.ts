import { describe, expect, it } from 'vitest';
import { applyPlan, linePath, planBulldoze, planLine } from '../src/sim/actions';
import { planTrack, type TrackShape } from '../src/sim/tracks/plan';
import { nodeAt } from '../src/sim/tracks/edit';
import type { TrackKind } from '../src/sim/tracks/net';
import { UndoStack } from '../src/sim/undo';
import { deserialize, serialize } from '../src/sim/save';
import { NET } from '../src/sim/types';
import { World } from '../src/sim/world';
import { generateMap } from '../src/sim/mapgen';
import { Sim } from '../src/sim/sim';
import { flatSim, road } from './helpers';

const free = (ax: number, ay: number, bx: number, by: number, c: [number, number] | null = null): TrackShape => ({
  type: 'free',
  ax,
  ay,
  bx,
  by,
  c,
});

function build(sim: Sim, kind: TrackKind, shape: TrackShape): void {
  const plan = planTrack(sim, kind, shape);
  if (!applyPlan(plan)) throw new Error(`${kind} failed: ${plan.reason}`);
}

function tilesWith(sim: Sim, flag: number): Set<string> {
  const w = sim.world;
  const out = new Set<string>();
  for (let i = 0; i < w.size; i++) if (w.net[i] & flag) out.add(`${i % w.w},${(i / w.w) | 0}`);
  return out;
}

/** True if the tiles are joined through their edges (4-neighbours). */
function connected(tiles: Set<string>): boolean {
  const list = [...tiles];
  if (!list.length) return true;
  const seen = new Set([list[0]]);
  const queue = [list[0]];
  while (queue.length) {
    const [x, y] = queue.pop()!.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = `${x + dx},${y + dy}`;
      if (tiles.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(k);
      }
    }
  }
  return seen.size === tiles.size;
}

/** A map with a 4-tile-wide channel of water running north to south at x = 18..21. */
function channelSim(): Sim {
  const world = new World(40, 40);
  generateMap(world, { size: 40, seed: 3, terrain: 'flat', water: 'none', trees: 'few' });
  for (let y = 0; y <= 40; y++) for (let x = 18; x <= 22; x++) world.setCorner(x, y, world.seaLevel - 1);
  for (let y = 0; y <= 40; y++) {
    world.setCorner(17, y, Math.max(world.seaLevel - 0, world.corner(17, y)));
    world.setCorner(23, y, Math.max(world.seaLevel - 0, world.corner(23, y)));
  }
  const sim = new Sim(world, { name: 'C', mayor: 'C', startYear: 1960, difficulty: 'easy', seed: 1 });
  sim.city.funds = 1e7;
  return sim;
}

describe('grid roads as track', () => {
  it('cover exactly the dragged tiles and form one straight edge', () => {
    const sim = flatSim();
    road(sim, 2, 2, 12, 2);
    const net = sim.world.tracks.road;
    expect(tilesWith(sim, NET.ROAD).size).toBe(11);
    expect(net.edges.size).toBe(1);
    expect(net.nodes.size).toBe(2);
    // extending the dead end keeps a single straight edge
    road(sim, 12, 2, 20, 2);
    expect(net.edges.size).toBe(1);
    expect(tilesWith(sim, NET.ROAD).size).toBe(19);
  });

  it('turn corners and cross each other at junctions', () => {
    const sim = flatSim();
    road(sim, 5, 5, 15, 12); // L-shaped: east, then south
    const net = sim.world.tracks.road;
    expect(net.edges.size).toBe(2);
    expect(net.degree(nodeAt(net, 15.5, 5.5))).toBe(2);
    road(sim, 10, 2, 10, 9); // crosses the first run
    expect(net.degree(nodeAt(net, 10.5, 5.5))).toBe(4);
    expect(tilesWith(sim, NET.ROAD).size).toBe(11 + 7 + 7);
  });

  it('join a road in the next tile, like grid roads always did', () => {
    const sim = flatSim();
    road(sim, 2, 10, 20, 10);
    road(sim, 8, 2, 8, 9); // stops one tile short of the road
    const net = sim.world.tracks.road;
    expect(net.degree(nodeAt(net, 8.5, 10.5))).toBe(3);
    expect(tilesWith(sim, NET.ROAD).size).toBe(19 + 8);
  });

  it('cost the same per tile as before', () => {
    const sim = flatSim();
    const plan = planLine(sim, 'road', linePath(2, 2, 12, 2));
    expect(plan.cost).toBe(110);
    // joining a road splits it, but only the new tiles cost money
    road(sim, 2, 10, 20, 10);
    expect(planLine(sim, 'road', linePath(8, 2, 8, 9)).cost).toBe(80);
  });
});

describe('free-angle track', () => {
  it('runs diagonally over a joined staircase of tiles', () => {
    const sim = flatSim();
    build(sim, 'road', free(10.5, 10.5, 30.5, 30.5));
    const tiles = tilesWith(sim, NET.ROAD);
    expect(connected(tiles)).toBe(true);
    expect(tiles.size).toBeGreaterThan(40);
    expect(tiles.size).toBeLessThan(70);
    expect(sim.world.tracks.road.edges.size).toBe(1);
  });

  it('makes a junction where it crosses a grid road', () => {
    const sim = flatSim();
    road(sim, 2, 20, 40, 20);
    build(sim, 'road', free(10.5, 10.5, 30.5, 30.5));
    const net = sim.world.tracks.road;
    const x = nodeAt(net, 20.5, 20.5);
    expect(x).toBeGreaterThan(0);
    expect(net.degree(x)).toBe(4);
    expect(connected(tilesWith(sim, NET.ROAD))).toBe(true);
  });

  it('builds smooth curves but not too tight ones', () => {
    const sim = flatSim();
    build(sim, 'road', free(10.5, 30.5, 30.5, 30.5, [20.5, 15.5]));
    const net = sim.world.tracks.road;
    expect(net.edges.size).toBe(1);
    expect([...net.edges.values()][0].curved).toBe(true);
    expect(connected(tilesWith(sim, NET.ROAD))).toBe(true);
    const tight = planTrack(sim, 'road', free(40.5, 40.5, 42.5, 40.5, [41.5, 30.5]));
    expect(tight.ok).toBe(false);
    expect(tight.reason).toBe('This curve is too tight');
  });

  it('keeps junctions wide and track apart', () => {
    const sim = flatSim();
    road(sim, 2, 20, 50, 20);
    const shallow = planTrack(sim, 'road', free(10.5, 20.5, 40.5, 25.5));
    expect(shallow.ok).toBe(false);
    expect(shallow.reason).toBe('Roads must meet at a wider angle');
    const alongside = planTrack(sim, 'road', free(10.5, 21.2, 40.5, 21.2));
    expect(alongside.ok).toBe(false);
    expect(alongside.reason).toBe('Too close to another road');
    // one full tile beside it is fine
    expect(planTrack(sim, 'road', free(10.5, 22.5, 40.5, 22.5)).ok).toBe(true);
  });

  it('lets rail cross roads at wide angles only', () => {
    const sim = flatSim();
    road(sim, 2, 20, 50, 20);
    expect(planTrack(sim, 'rail', free(10.5, 10.5, 30.5, 30.5)).ok).toBe(true);
    const flat = planTrack(sim, 'rail', free(10.5, 15.5, 40.5, 25.5));
    expect(flat.ok).toBe(false);
    expect(flat.reason).toBe('Road and rail must cross at a wide angle');
    const along = planTrack(sim, 'rail', free(10.5, 20.9, 30.5, 20.9));
    expect(along.ok).toBe(false);
  });

  it('runs highways over roads at any angle', () => {
    const sim = flatSim();
    sim.city.startYear = 1960;
    road(sim, 2, 20, 50, 20);
    build(sim, 'highway', free(10.5, 10.5, 40.5, 30.5));
    const w = sim.world;
    expect(w.tracks.road.edges.size).toBe(1);
    const both = [...tilesWith(sim, NET.HIGHWAY)].filter((k) => tilesWith(sim, NET.ROAD).has(k));
    expect(both.length).toBeGreaterThan(0);
  });

  it('bridges water in straight lines that end on land', () => {
    const sim = channelSim();
    expect(sim.world.isWater(20, 10)).toBe(true);
    expect(planTrack(sim, 'road', free(10.5, 5.5, 30.5, 15.5)).ok).toBe(true);
    expect(planTrack(sim, 'road', free(10.5, 25.5, 30.5, 25.5, [20.5, 32.5])).reason).toBe('Bridges must be straight');
    expect(planTrack(sim, 'road', free(10.5, 5.5, 20.5, 5.5)).reason).toBe('Bridges must end on land');
  });
});

describe('bulldozing track', () => {
  it('cuts a grid road tile by tile', () => {
    const sim = flatSim();
    road(sim, 2, 5, 20, 5);
    applyPlan(planBulldoze(sim, 10, 5, 11, 5));
    const tiles = tilesWith(sim, NET.ROAD);
    expect(tiles.size).toBe(17);
    expect(tiles.has('9,5')).toBe(true);
    expect(tiles.has('10,5')).toBe(false);
    expect(tiles.has('12,5')).toBe(true);
    const net = sim.world.tracks.road;
    expect(net.edges.size).toBe(2);
    expect(nodeAt(net, 9.5, 5.5)).toBeGreaterThan(0);
    expect(nodeAt(net, 12.5, 5.5)).toBeGreaterThan(0);
  });

  it('removes a junction and shortens its arms', () => {
    const sim = flatSim();
    road(sim, 2, 10, 20, 10);
    road(sim, 10, 2, 10, 20);
    applyPlan(planBulldoze(sim, 10, 10, 10, 10));
    const net = sim.world.tracks.road;
    expect(net.edges.size).toBe(4);
    expect(tilesWith(sim, NET.ROAD).size).toBe(19 + 19 - 2);
    for (const n of net.nodes.keys()) expect(net.degree(n)).toBe(1);
  });

  it('frees every bulldozed tile under a diagonal road', () => {
    const sim = flatSim();
    build(sim, 'road', free(10.5, 10.5, 40.5, 40.5));
    applyPlan(planBulldoze(sim, 20, 20, 24, 24));
    const tiles = tilesWith(sim, NET.ROAD);
    for (let y = 20; y <= 24; y++) for (let x = 20; x <= 24; x++) expect(tiles.has(`${x},${y}`)).toBe(false);
    expect(sim.world.tracks.road.edges.size).toBe(2);
  });
});

describe('track undo and saves', () => {
  it('undoes a curved road and its junctions', () => {
    const sim = flatSim();
    road(sim, 2, 20, 50, 20);
    const undo = new UndoStack();
    const funds = sim.city.funds;
    const tiles = tilesWith(sim, NET.ROAD);
    const plan = planTrack(sim, 'road', free(10.5, 10.5, 30.5, 30.5, [25.5, 12.5]));
    expect(undo.apply(sim, plan, 'Road')).toBe(true);
    expect(sim.world.tracks.road.edges.size).toBeGreaterThan(1);
    undo.undo(sim);
    expect(sim.city.funds).toBe(funds);
    expect(tilesWith(sim, NET.ROAD)).toEqual(tiles);
    const net = sim.world.tracks.road;
    expect(net.edges.size).toBe(1);
    expect(net.nodes.size).toBe(2);
  });

  it('undoes the bulldozer on track', () => {
    const sim = flatSim();
    build(sim, 'rail', free(10.5, 10.5, 40.5, 30.5));
    const before = tilesWith(sim, NET.RAIL);
    const undo = new UndoStack();
    undo.apply(sim, planBulldoze(sim, 20, 15, 24, 19), 'Bulldoze');
    expect(tilesWith(sim, NET.RAIL).size).toBeLessThan(before.size);
    undo.undo(sim);
    expect(tilesWith(sim, NET.RAIL)).toEqual(before);
    expect(sim.world.tracks.rail.edges.size).toBe(1);
  });

  it('saves curves and loads the same network', () => {
    const sim = flatSim();
    sim.city.startYear = 1960;
    road(sim, 2, 20, 50, 20);
    build(sim, 'road', free(10.5, 10.5, 30.5, 30.5, [25.5, 12.5]));
    build(sim, 'rail', free(5.5, 40.5, 50.5, 50.5));
    build(sim, 'highway', free(5.5, 5.5, 55.5, 35.5, [40.5, 5.5]));
    const copy = deserialize(serialize(sim));
    for (const kind of ['road', 'rail', 'highway'] as const) {
      expect(copy.world.tracks[kind].toData()).toEqual(sim.world.tracks[kind].toData());
    }
    expect([...copy.world.net]).toEqual([...sim.world.net]);
  });
});
