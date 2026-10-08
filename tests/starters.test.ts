import { describe, expect, it } from 'vitest';
import { buildStarterNow, getStarter, STARTERS } from '../src/sim/starters';

describe('starter cities', () => {
  for (const def of STARTERS) {
    it(`${def.name} is a working city of about ${def.population.toLocaleString('en-US')} residents`, () => {
      const sim = buildStarterNow(def);
      const s = sim.stats;
      expect(sim.city.name).toBe(def.name);
      expect(sim.year).toBe(def.startYear + def.years);
      expect(s.residents).toBeGreaterThan(def.population * 0.75);
      expect(s.residents).toBeLessThan(def.population * 1.3);
      expect(sim.city.funds).toBe(def.funds);
      expect(sim.city.disastersEnabled).toBe(true);
      // it pays its way and nothing is broken
      expect(sim.city.lastReport!.total).toBeGreaterThan(0);
      expect(s.powerSupply).toBeGreaterThan(s.powerDemand);
      expect(s.waterSupply).toBeGreaterThan(s.waterDemand);
      expect(s.unpowered).toBeLessThan(s.buildings * 0.01 + 3);
      expect(sim.city.garbageBacklog).toBeLessThan(200);
      expect(s.abandoned).toBeLessThan(s.buildings * 0.02 + 2);
    }, 30000);
  }

  it('builds the same city every time', () => {
    const a = buildStarterNow(getStarter('riverside'));
    const b = buildStarterNow(getStarter('riverside'));
    expect(b.stats.residents).toBe(a.stats.residents);
    expect(b.world.buildings.size).toBe(a.world.buildings.size);
    expect([...b.world.zone]).toEqual([...a.world.zone]);
  });
});
