import { World } from '../src/sim/world';
import { Sim } from '../src/sim/sim';
import { generateMap } from '../src/sim/mapgen';
import { applyPlan, linePath, planLine, planPlace, planZone } from '../src/sim/actions';
import type { ZoneKind } from '../src/sim/types';

export function flatSim(size = 64, seed = 42): Sim {
  const world = new World(size, size);
  generateMap(world, { size, seed, terrain: 'flat', water: 'none', trees: 'few' });
  const sim = new Sim(world, { name: 'Testville', mayor: 'Tester', startYear: 1950, difficulty: 'easy', seed });
  sim.city.disastersEnabled = false;
  return sim;
}

export function road(sim: Sim, x0: number, y0: number, x1: number, y1: number): void {
  const plan = planLine(sim, 'road', linePath(x0, y0, x1, y1));
  if (!applyPlan(plan)) throw new Error(`road failed: ${plan.reason}`);
}

export function line(sim: Sim, kind: 'power' | 'pipe' | 'rail', x0: number, y0: number, x1: number, y1: number): void {
  const plan = planLine(sim, kind, linePath(x0, y0, x1, y1));
  if (!applyPlan(plan)) throw new Error(`${kind} failed: ${plan.reason}`);
}

export function zone(sim: Sim, x0: number, y0: number, x1: number, y1: number, z: ZoneKind, d: number): void {
  const plan = planZone(sim, x0, y0, x1, y1, z, d);
  if (!applyPlan(plan)) throw new Error(`zone failed: ${plan.reason}`);
}

export function place(sim: Sim, def: string, x: number, y: number): void {
  const plan = planPlace(sim, def, x, y, 0);
  if (!applyPlan(plan)) throw new Error(`place ${def} failed: ${plan.reason}`);
}

/** A small starter city: road grid, R/C/I zones, coal plant, pumps and pipes. */
export function starterCity(sim: Sim): void {
  // road grid
  for (const y of [10, 20, 30, 40]) road(sim, 4, y, 56, y);
  for (const x of [4, 15, 26, 37, 48]) road(sim, x, 10, x, 40);
  road(sim, 0, 20, 4, 20); // neighbour connection
  // zones
  zone(sim, 5, 11, 14, 19, 1, 1);
  zone(sim, 16, 11, 25, 19, 1, 2);
  zone(sim, 27, 11, 36, 19, 1, 1);
  zone(sim, 5, 21, 14, 29, 2, 1);
  zone(sim, 16, 21, 25, 29, 2, 2);
  zone(sim, 27, 21, 36, 29, 3, 1);
  zone(sim, 38, 21, 47, 29, 3, 2);
  zone(sim, 5, 31, 14, 39, 1, 2);
  zone(sim, 16, 31, 25, 39, 1, 1);
  // power: coal plant below the industrial zone; power lines cross the roads between blocks
  place(sim, 'coal_plant', 38, 31);
  for (const [x, y] of [
    [39, 30],
    [15, 25], [26, 25], [37, 25],
    [10, 20], [20, 20], [30, 20],
    [10, 30], [20, 30],
    [15, 15], [26, 15], [15, 35],
  ]) line(sim, 'power', x, y, x, y);
  // water: pumps next to the plant (they need power) and pipes
  place(sim, 'water_pump', 42, 31);
  place(sim, 'water_pump', 42, 33);
  place(sim, 'water_pump', 42, 29 - 4);
  line(sim, 'pipe', 43, 32, 5, 32);
  line(sim, 'pipe', 10, 12, 10, 38);
  line(sim, 'pipe', 30, 12, 30, 38);
  line(sim, 'pipe', 20, 12, 20, 38);
  line(sim, 'pipe', 42, 22, 42, 32);
}

export function runDays(sim: Sim, days: number): void {
  for (let d = 0; d < days; d++) sim.stepDay();
}
