import { describe, expect, it } from 'vitest';
import { deserialize, migrate, SAVE_VERSION, serialize } from '../src/sim/save';
import { flatSim, runDays } from './helpers';
import V1 from './fixtures/save-v1.json?raw';

describe('save migrations', () => {
  it('loads a version 1 save file', () => {
    expect(JSON.parse(V1).version).toBe(1);
    const sim = deserialize(V1);
    expect(sim.city.name).toBe('Fixtureville');
    expect(sim.city.sandbox).toBe(false);
    expect(sim.city.scenario).toBeNull();
    expect(sim.world.buildings.size).toBeGreaterThan(20);
    expect(sim.stats.residents).toBeGreaterThan(0);
    // the old city keeps running and saves in the current format
    runDays(sim, 90);
    expect(sim.stats.residents).toBeGreaterThan(0);
    expect(JSON.parse(serialize(sim)).version).toBe(SAVE_VERSION);
  });

  it('upgrades step by step to the current version', () => {
    const file = migrate(JSON.parse(V1));
    expect(file.version).toBe(SAVE_VERSION);
    expect(file.city.sandbox).toBe(false);
  });

  it('refuses files from a newer version or another app', () => {
    const newer = { ...JSON.parse(V1), version: SAVE_VERSION + 1 };
    expect(() => migrate(newer)).toThrow(/newer version/);
    expect(() => migrate({ app: 'other', version: 1 })).toThrow(/Not a SlopCity save/);
    expect(() => deserialize('{"app":"slopcity","version":0}')).toThrow(/version/);
  });

  it('round-trips sandbox and scenario state', () => {
    const sim = flatSim(32);
    sim.city.sandbox = true;
    sim.city.scenario = { id: 'boomtown', start: 0, deadline: 3650, status: 'active' };
    runDays(sim, 30);
    const copy = deserialize(serialize(sim));
    expect(copy.city.sandbox).toBe(true);
    expect(copy.city.scenario).toEqual(sim.city.scenario);
  });

  it('keeps huge maps small by run-length encoding the layers', async () => {
    const { applyPlan, linePath, planLine, planZone } = await import('../src/sim/actions');
    const sim = flatSim(256);
    applyPlan(planLine(sim, 'road', linePath(10, 10, 240, 10)));
    applyPlan(planZone(sim, 10, 11, 240, 13, 1, 2));
    sim.world.landfill[500] = 123.5;
    const json = serialize(sim);
    expect(json.length).toBeLessThan(120_000);
    const copy = deserialize(json);
    expect([...copy.world.zone]).toEqual([...sim.world.zone]);
    expect([...copy.world.net]).toEqual([...sim.world.net]);
    expect([...copy.world.heights]).toEqual([...sim.world.heights]);
    expect(copy.world.landfill[500]).toBeCloseTo(123.5);
  });
});
