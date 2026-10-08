import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Sim } from '../src/sim/sim';
import { generateMap, type MapOptions } from '../src/sim/mapgen';
import { growCity, layoutCity, type CityPlan } from '../src/sim/planner';

function plannedCity(map: Partial<MapOptions>, plan: CityPlan, startYear = 1960): Sim {
  const size = map.size ?? 128;
  const world = new World(size, size);
  generateMap(world, { size, seed: 77, terrain: 'flat', water: 'none', trees: 'few', ...map });
  const sim = new Sim(world, { name: 'Balance', mayor: 'B', startYear, difficulty: 'medium', seed: 77 });
  sim.city.disastersEnabled = false;
  layoutCity(sim, plan);
  return sim;
}

describe('growth balance', () => {
  it('a well-planned dense city grows past 50,000 residents and pays its way', () => {
    const sim = plannedCity({}, { density: 3, services: 'full', subway: true, highway: true, rail: true });
    growCity(sim, 365 * 6);
    const at6 = sim.stats.residents;
    expect(at6).toBeGreaterThan(50000);
    growCity(sim, 365 * 4);
    expect(sim.stats.residents).toBeGreaterThan(at6 * 1.5);
    expect(sim.city.funds).toBeGreaterThan(0);
    expect(sim.city.garbageBacklog).toBeLessThan(500);
    expect(sim.stats.abandoned).toBeLessThan(sim.stats.buildings * 0.02);
  }, 60000);

  it('a medium-density river town settles with a healthy budget', () => {
    const sim = plannedCity({ size: 96, terrain: 'rolling', water: 'river' }, { density: 2, services: 'basic' });
    growCity(sim, 365 * 12);
    expect(sim.stats.residents).toBeGreaterThan(20000);
    expect(sim.city.funds).toBeGreaterThan(0);
    // residents still want more homes: the player should zone or densify next
    expect(sim.city.demand.r).toBeGreaterThan(0.2);
  }, 60000);

  it('buildings keep upgrading after the city fills its zones', () => {
    const sim = plannedCity({ size: 64 }, { density: 3, services: 'basic' });
    growCity(sim, 365 * 4);
    const cap4 = sim.stats.resCap;
    growCity(sim, 365 * 4);
    expect(sim.stats.resCap).toBeGreaterThan(cap4);
  }, 60000);
});
