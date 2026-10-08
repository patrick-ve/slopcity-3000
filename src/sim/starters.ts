/**
 * Starter cities: ready-made cities to take over. Each one is built from a
 * map seed and the city planner, then simulated for some years, so the
 * result is the same every time and needs no save file in the bundle.
 */
import { applyPlan, planPlace } from './actions';
import { generateMap, type MapOptions } from './mapgen';
import { layoutCity, type CityPlan } from './planner';
import { Sim } from './sim';
import type { Difficulty } from './types';
import { World } from './world';

export interface StarterCity {
  id: string;
  name: string;
  /** One sentence for the menu. */
  tagline: string;
  map: MapOptions;
  startYear: number;
  difficulty: Difficulty;
  /** Share of the map (0..1) the planned city covers, around the best building site. */
  area: number;
  plan: CityPlan;
  /** Years the city grows before the player takes over. */
  years: number;
  /** Treasury when the player takes over. */
  funds: number;
  /** About how many residents live there when the player takes over (shown in the menu). */
  population: number;
  /** Extra buildings and policies after the layout. */
  extras?: (sim: Sim) => void;
}

/** Try every position near (cx, cy), nearest first, until the building fits. */
export function placeAround(sim: Sim, def: string, cx: number, cy: number, radius = 24): boolean {
  const spots: [number, number, number][] = [];
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) spots.push([x, y, Math.hypot(x - cx, y - cy)]);
  }
  spots.sort((a, b) => a[2] - b[2]);
  for (const [x, y] of spots) {
    if (!sim.world.inBounds(x, y)) continue;
    const p = planPlace(sim, def, x, y, 'auto');
    if (p.ok && applyPlan(p)) return true;
  }
  return false;
}

/** Centre of the flattest dry area of the given size (keeps cities off water and cliffs). */
export function findSite(world: World, span: number): { x: number; y: number } {
  let best = { x: world.w >> 1, y: world.h >> 1, score: -Infinity };
  const half = span >> 1;
  const step = Math.max(2, span >> 3);
  for (let cy = half; cy <= world.h - half; cy += step) {
    for (let cx = half; cx <= world.w - half; cx += step) {
      let water = 0;
      let rough = 0;
      for (let y = cy - half; y < cy + half; y += 3) {
        for (let x = cx - half; x < cx + half; x += 3) {
          if (!world.inBounds(x, y)) continue;
          if (world.isWater(x, y)) water++;
          rough += world.tileMax(x, y) - world.tileMin(x, y);
        }
      }
      const score = -water * 4 - rough - Math.hypot(cx - world.w / 2, cy - world.h / 2) * 0.4;
      if (score > best.score) best = { x: cx, y: cy, score };
    }
  }
  return { x: best.x, y: best.y };
}

export const STARTERS: StarterCity[] = [
  {
    id: 'riverside',
    name: 'Riverside',
    tagline: 'A friendly small town on a winding river. A good first city.',
    map: { size: 96, seed: 4207, terrain: 'rolling', water: 'river', trees: 'normal' },
    startYear: 1950,
    difficulty: 'easy',
    area: 0.55,
    plan: { density: 2, services: 'basic', serviceSpacing: 1.25, industryAngle: Math.PI },
    years: 5,
    funds: 30000,
    population: 6500,
  },
  {
    id: 'old_town',
    name: 'Old Town',
    tagline: 'A railway town in the year 1900. Grow it through a whole century.',
    map: { size: 96, seed: 1900, terrain: 'flat', water: 'lakes', trees: 'many' },
    startYear: 1900,
    difficulty: 'medium',
    area: 0.45,
    plan: { density: 1, services: 'basic', serviceSpacing: 1.5, rail: true, industryAngle: Math.PI / 2 },
    years: 4,
    funds: 15000,
    population: 3500,
  },
  {
    id: 'pinecrest',
    name: 'Pinecrest',
    tagline: 'A hillside town between lakes and pine forests, powered by gas and wind.',
    map: { size: 96, seed: 8812, terrain: 'hilly', water: 'lakes', trees: 'many' },
    startYear: 1980,
    difficulty: 'medium',
    area: 0.5,
    plan: { density: 2, services: 'basic', serviceSpacing: 1.3, power: 'gas_plant', industryAngle: -Math.PI / 2 },
    years: 6,
    funds: 25000,
    population: 6000,
    extras: (sim) => {
      for (let k = 0; k < 6; k++) placeAround(sim, 'wind_turbine', sim.world.w >> 1, sim.world.h >> 1, 40);
      sim.city.ordinances.tree_planting = true;
    },
  },
  {
    id: 'isla_bonita',
    name: 'Isla Bonita',
    tagline: 'A sunny island resort with beaches, a marina and lots of tourists.',
    map: { size: 96, seed: 5150, terrain: 'rolling', water: 'island', trees: 'normal' },
    startYear: 1990,
    difficulty: 'easy',
    area: 0.5,
    plan: { density: 2, services: 'basic', serviceSpacing: 1.3, power: 'gas_plant', industryAngle: Math.PI / 4 },
    years: 7,
    funds: 40000,
    population: 7500,
    extras: (sim) => {
      const c = { x: sim.world.w >> 1, y: sim.world.h >> 1 };
      placeAround(sim, 'marina', c.x, c.y, 45);
      placeAround(sim, 'desalination', c.x, c.y + 10, 45);
      // no road reaches a neighbour from an island: burn the garbage at home
      placeAround(sim, 'waste_to_energy', c.x + 12, c.y + 12, 40);
      sim.city.ordinances.tourism = true;
      sim.city.ordinances.city_beautification = true;
    },
  },
  {
    id: 'harbor_bay',
    name: 'Harbor Bay',
    tagline: 'A busy port city on the coast with a seaport, a rail line and a growing downtown.',
    map: { size: 128, seed: 3131, terrain: 'rolling', water: 'coast', trees: 'normal' },
    startYear: 1965,
    difficulty: 'medium',
    area: 0.62,
    plan: { density: 3, services: 'full', rail: true, industryAngle: Math.PI / 2 },
    years: 4,
    funds: 60000,
    population: 39000,
    extras: (sim) => {
      placeAround(sim, 'seaport', sim.world.w >> 1, sim.world.h >> 1, 60);
    },
  },
  {
    id: 'metro_plains',
    name: 'Metro Plains',
    tagline: 'A big city of skyscrapers, highways and subways. Can you keep it moving?',
    map: { size: 128, seed: 2024, terrain: 'flat', water: 'lakes', trees: 'few' },
    startYear: 1995,
    difficulty: 'medium',
    area: 0.82,
    plan: {
      density: 3,
      rings: [0.6, 0.9],
      services: 'full',
      highway: true,
      subway: true,
      rail: true,
      industryAngle: 0,
      industryWidth: 0.95,
    },
    years: 12,
    funds: 120000,
    population: 105000,
  },
];

export function getStarter(id: string): StarterCity {
  const s = STARTERS.find((c) => c.id === id);
  if (!s) throw new Error(`Unknown starter city ${id}`);
  return s;
}

/**
 * Build a starter city step by step. The generator yields progress (0..1)
 * so the menu can show a progress bar; it returns the finished city.
 */
export function* buildStarter(def: StarterCity, daysPerStep = 61): Generator<number, Sim> {
  const world = new World(def.map.size, def.map.size);
  generateMap(world, def.map);
  const sim = new Sim(world, { name: def.name, mayor: 'Mayor', startYear: def.startYear, difficulty: def.difficulty, seed: def.map.seed });
  sim.city.disastersEnabled = false;
  const span = Math.round(def.map.size * def.area);
  const site = findSite(world, span);
  const half = span >> 1;
  layoutCity(sim, {
    ...def.plan,
    x0: site.x - half,
    y0: site.y - half,
    x1: site.x + half,
    y1: site.y + half,
    cx: site.x,
    cy: site.y,
    seed: def.map.seed,
  });
  def.extras?.(sim);
  sim.recompute(true);
  yield 0.05;
  const total = def.years * 365;
  for (let d = 0; d < total; d += daysPerStep) {
    for (let k = 0; k < daysPerStep && d + k < total; k++) sim.stepDay();
    yield 0.05 + 0.95 * Math.min(1, (d + daysPerStep) / total);
  }
  sim.city.funds = def.funds;
  sim.city.debtMonths = 0;
  sim.city.disastersEnabled = true;
  return sim;
}

/** Build a starter city in one go (tests, tools). */
export function buildStarterNow(def: StarterCity): Sim {
  const gen = buildStarter(def, 365);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}
