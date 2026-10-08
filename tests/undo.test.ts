import { describe, expect, it } from 'vitest';
import { applyPlan, linePath, planBulldoze, planLine, planPlace, planTerraform, planTrees, planZone } from '../src/sim/actions';
import { UndoStack } from '../src/sim/undo';
import { NET } from '../src/sim/types';
import { flatSim, runDays, starterCity } from './helpers';

const roadCount = (net: Uint8Array) => net.reduce((n, v) => n + (v & NET.ROAD ? 1 : 0), 0);

describe('undo', () => {
  it('removes a road and refunds it', () => {
    const sim = flatSim();
    const undo = new UndoStack();
    const funds = sim.city.funds;
    expect(undo.apply(sim, planLine(sim, 'road', linePath(2, 2, 12, 2)), 'Road')).toBe(true);
    expect(roadCount(sim.world.net)).toBe(11);
    expect(sim.city.funds).toBeLessThan(funds);
    const e = undo.undo(sim);
    expect(e?.label).toBe('Road');
    expect(roadCount(sim.world.net)).toBe(0);
    expect(sim.city.funds).toBe(funds);
    expect(undo.undo(sim)).toBeNull();
  });

  it('brings back a bulldozed building with its id and residents', () => {
    const sim = flatSim();
    const undo = new UndoStack();
    undo.apply(sim, planPlace(sim, 'police_station', 10, 10, 0), 'Police Station');
    const station = sim.world.buildingAt(10, 10)!;
    station.pop = 7;
    const funds = sim.city.funds;
    // drag over one tile only: the whole 2×2 building goes
    undo.apply(sim, planBulldoze(sim, 11, 11, 11, 11), 'Bulldoze');
    expect(sim.world.buildingAt(10, 10)).toBeUndefined();
    undo.undo(sim);
    const back = sim.world.buildingAt(11, 10);
    expect(back?.id).toBe(station.id);
    expect(back?.def).toBe('police_station');
    expect(back?.pop).toBe(7);
    expect(sim.city.funds).toBe(funds);
    // undoing the placement removes it again and refunds the price
    const before = sim.city.funds;
    undo.undo(sim);
    expect(sim.world.buildingAt(10, 10)).toBeUndefined();
    expect(sim.city.funds).toBeGreaterThan(before);
  });

  it('restores terrain heights exactly', () => {
    const sim = flatSim(32, 9);
    const undo = new UndoStack();
    const heights = Uint8Array.from(sim.world.heights);
    for (let k = 0; k < 3; k++) undo.apply(sim, planTerraform(sim, 'raise', 10, 10, 11, 11), 'Raise Terrain');
    expect([...sim.world.heights]).not.toEqual([...heights]);
    while (undo.undo(sim));
    expect([...sim.world.heights]).toEqual([...heights]);
  });

  it('undoes zoning, including the buildings that grew there', () => {
    const sim = flatSim();
    starterCity(sim);
    const undo = new UndoStack();
    const zoneBefore = Uint8Array.from(sim.world.zone);
    // a new residential block below the road at y = 40; a power line carries power across that road
    applyPlan(planLine(sim, 'power', [[10, 40]]));
    undo.apply(sim, planZone(sim, 5, 41, 14, 43, 1, 1), 'Light Residential');
    runDays(sim, 365);
    let grown = 0;
    for (let y = 41; y <= 43; y++) for (let x = 5; x <= 14; x++) if (sim.world.buildingAt(x, y)) grown++;
    expect(grown).toBeGreaterThan(0);
    undo.undo(sim);
    for (let y = 41; y <= 43; y++) for (let x = 5; x <= 14; x++) expect(sim.world.buildingAt(x, y)).toBeUndefined();
    expect([...sim.world.zone]).toEqual([...zoneBefore]);
  });

  it('keeps only the most recent actions', () => {
    const sim = flatSim();
    const undo = new UndoStack(3);
    for (let k = 0; k < 5; k++) undo.apply(sim, planTrees(sim, k, 0, k, 0), 'Plant Trees');
    expect(undo.size).toBe(3);
    while (undo.undo(sim));
    // the two oldest plantings stay
    expect(sim.world.tree[sim.world.idx(0, 0)]).toBeGreaterThan(0);
    expect(sim.world.tree[sim.world.idx(1, 0)]).toBeGreaterThan(0);
    expect(sim.world.tree[sim.world.idx(2, 0)]).toBe(0);
  });

  it('does not record plans that cannot be applied', () => {
    const sim = flatSim();
    const undo = new UndoStack();
    sim.city.funds = 0;
    expect(undo.apply(sim, planLine(sim, 'road', linePath(2, 2, 12, 2)), 'Road')).toBe(false);
    expect(undo.size).toBe(0);
  });
});
