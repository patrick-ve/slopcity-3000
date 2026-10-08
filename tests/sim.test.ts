import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { generateMap, relaxSlopes } from '../src/sim/mapgen';
import { NET } from '../src/sim/types';
import { applyPlan, linePath, planBulldoze, planLine, planPlace, planZone } from '../src/sim/actions';
import { flatSim, runDays, starterCity } from './helpers';

describe('map generation', () => {
  it('keeps neighbouring corners within one level', () => {
    for (const terrain of ['rolling', 'hilly', 'mountains'] as const) {
      const w = new World(64, 64);
      generateMap(w, { size: 64, seed: 7, terrain, water: 'river', trees: 'normal' });
      const W = 65;
      for (let y = 0; y < W; y++) {
        for (let x = 0; x < W; x++) {
          const h = w.heights[y * W + x];
          if (x + 1 < W) expect(Math.abs(h - w.heights[y * W + x + 1])).toBeLessThanOrEqual(1);
          if (y + 1 < W) expect(Math.abs(h - w.heights[(y + 1) * W + x])).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('relaxSlopes produces a 1-Lipschitz field', () => {
    const h = new Int32Array([0, 9, 0, 9, 0, 9, 0, 9, 0]);
    relaxSlopes(h, 3, 3);
    expect([...h]).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0]);
  });

  it('generates water for river maps', () => {
    const w = new World(64, 64);
    generateMap(w, { size: 64, seed: 3, terrain: 'rolling', water: 'river', trees: 'few' });
    let water = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (w.isWater(x, y)) water++;
    expect(water).toBeGreaterThan(50);
  });

  it('heightAt matches corner heights', () => {
    const w = new World(8, 8);
    generateMap(w, { size: 8, seed: 5, terrain: 'hilly', water: 'none', trees: 'few' });
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(w.heightAt(x, y)).toBeCloseTo(w.corner(x, y));
        expect(w.heightAt(x + 0.999, y + 0.999)).toBeCloseTo(w.corner(x + 1, y + 1), 1);
      }
    }
  });
});

describe('actions', () => {
  it('builds roads and charges money', () => {
    const sim = flatSim();
    const before = sim.city.funds;
    const plan = planLine(sim, 'road', linePath(2, 2, 10, 2));
    expect(plan.ok).toBe(true);
    expect(plan.cost).toBe(90);
    applyPlan(plan);
    expect(sim.city.funds).toBe(before - 90);
    expect(sim.world.net[sim.world.idx(5, 2)] & NET.ROAD).toBeTruthy();
  });

  it('does not zone over roads and does not double-charge', () => {
    const sim = flatSim();
    applyPlan(planLine(sim, 'road', linePath(2, 5, 10, 5)));
    const plan = planZone(sim, 2, 4, 10, 6, 1, 1);
    const changing = plan.tiles.filter((t) => t.change).length;
    expect(changing).toBe(18);
    applyPlan(plan);
    expect(planZone(sim, 2, 4, 10, 6, 1, 1).ok).toBe(false);
  });

  it('places and bulldozes buildings', () => {
    const sim = flatSim();
    const p = planPlace(sim, 'police_station', 10, 10, 0);
    expect(p.ok).toBe(true);
    applyPlan(p);
    expect(sim.world.buildingAt(11, 11)?.def).toBe('police_station');
    expect(planPlace(sim, 'fire_station', 11, 11, 0).ok).toBe(false);
    applyPlan(planBulldoze(sim, 11, 11, 11, 11));
    expect(sim.world.buildingAt(11, 11)).toBeUndefined();
  });
});

describe('simulation', () => {
  it('powers zones connected to a plant', () => {
    const sim = flatSim();
    starterCity(sim);
    sim.recompute(false);
    const w = sim.world;
    expect(w.powered[w.idx(30, 25)]).toBe(1); // industrial zone next to the plant
    expect(w.powered[w.idx(6, 12)]).toBe(1); // reached through zones and road-crossing power lines
    expect(w.powered[w.idx(50, 12)]).toBe(0); // unzoned land does not conduct
  });

  it('grows a starter city over a few years', () => {
    const sim = flatSim();
    starterCity(sim);
    const log: string[] = [];
    for (let year = 1; year <= 10; year++) {
      runDays(sim, 365);
      const s = sim.stats;
      log.push(
        `y${year} pop=${s.residents} com=${s.comJobs} ind=${s.indJobs} funds=${Math.round(sim.city.funds)} ` +
          `bld=${s.buildings} aband=${s.abandoned} dem=${sim.city.demand.r.toFixed(2)}/${sim.city.demand.c.toFixed(2)}/${sim.city.demand.i.toFixed(2)} ` +
          `power=${Math.round(s.powerDemand)}/${s.powerSupply} water=${Math.round(s.waterDemand)}/${s.waterSupply} traffic=${s.avgTraffic.toFixed(2)} ` +
          `lv=${s.avgLandValue.toFixed(2)} pol=${s.avgPollution.toFixed(2)} crime=${s.avgCrime.toFixed(2)} eq=${sim.city.eq.toFixed(0)} le=${sim.city.le.toFixed(0)}`,
      );
    }
    console.log(log.join('\n'));
    expect(sim.stats.residents).toBeGreaterThan(1500);
    expect(sim.stats.indJobs + sim.stats.comJobs).toBeGreaterThan(300);
  });
});

describe('save / load', () => {
  it('round-trips a grown city', async () => {
    const { serialize, deserialize } = await import('../src/sim/save');
    const sim = flatSim();
    starterCity(sim);
    runDays(sim, 400);
    const json = serialize(sim);
    const copy = deserialize(json);
    expect(copy.world.buildings.size).toBe(sim.world.buildings.size);
    expect(copy.city.funds).toBeCloseTo(sim.city.funds);
    expect([...copy.world.net]).toEqual([...sim.world.net]);
    expect([...copy.world.zone]).toEqual([...sim.world.zone]);
    expect(copy.stats.residents).toBe(sim.stats.residents);
    // the copy keeps simulating
    runDays(copy, 60);
    expect(copy.stats.residents).toBeGreaterThan(0);
  });
});

describe('terraform and bridges', () => {
  it('raises a tile and keeps neighbouring corners within one level', async () => {
    const { planTerraform } = await import('../src/sim/actions');
    const sim = flatSim(32, 9);
    const w = sim.world;
    const before = w.corner(10, 10);
    for (let k = 0; k < 4; k++) applyPlan(planTerraform(sim, 'raise', 10, 10, 10, 10));
    expect(w.corner(10, 10)).toBe(before + 4);
    const W = w.w + 1;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        if (x + 1 < W) expect(Math.abs(w.corner(x, y) - w.corner(x + 1, y))).toBeLessThanOrEqual(1);
        if (y + 1 < W) expect(Math.abs(w.corner(x, y) - w.corner(x, y + 1))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('refuses to reshape land under roads', async () => {
    const { planTerraform } = await import('../src/sim/actions');
    const sim = flatSim(32, 9);
    applyPlan(planLine(sim, 'road', linePath(5, 5, 15, 5)));
    const plan = planTerraform(sim, 'raise', 9, 6, 9, 6);
    expect(plan.ok).toBe(false);
  });

  it('levels an area to the start height', async () => {
    const { planTerraform } = await import('../src/sim/actions');
    const sim = flatSim(32, 9);
    applyPlan(planTerraform(sim, 'raise', 12, 12, 13, 13));
    applyPlan(planTerraform(sim, 'level', 4, 4, 16, 16));
    const w = sim.world;
    const h = w.corner(4, 4);
    for (let y = 4; y <= 17; y++) for (let x = 4; x <= 17; x++) expect(w.corner(x, y)).toBe(h);
  });

  it('builds straight bridges across water but not bent ones', async () => {
    const world = new World(40, 40);
    generateMap(world, { size: 40, seed: 3, terrain: 'flat', water: 'none', trees: 'few' });
    // dig a 4-wide channel across the map
    for (let y = 0; y <= 40; y++) for (let x = 18; x <= 22; x++) world.setCorner(x, y, world.seaLevel - 2);
    const hs = Int32Array.from(world.heights);
    relaxSlopes(hs, 41, 41);
    world.heights.set(hs);
    const { Sim } = await import('../src/sim/sim');
    const sim = new Sim(world, { name: 'B', mayor: 'B', startYear: 1950, difficulty: 'easy', seed: 1 });
    expect(world.isWater(20, 10)).toBe(true);
    const straight = planLine(sim, 'road', linePath(12, 10, 28, 10));
    expect(straight.reason).toBeUndefined();
    expect(straight.ok).toBe(true);
    const bent = planLine(sim, 'road', linePath(14, 12, 20, 18));
    expect(bent.ok).toBe(false);
    const endsInWater = planLine(sim, 'road', linePath(14, 14, 20, 14));
    expect(endsInWater.ok).toBe(false);
  });
});
