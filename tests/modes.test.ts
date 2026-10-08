import { describe, expect, it } from 'vitest';
import { applyPlan, isAvailable, linePath, planLine, planPlace } from '../src/sim/actions';
import { getDef } from '../src/sim/catalog';
import { flatSim, runDays } from './helpers';

describe('sandbox mode', () => {
  it('builds anything without money', () => {
    const sim = flatSim();
    sim.city.sandbox = true;
    sim.city.funds = 0;
    // a fusion plant needs the year 2050 and §40,000 in a normal game
    const plan = planPlace(sim, 'fusion_plant', 10, 10, 0);
    expect(plan.ok).toBe(true);
    expect(applyPlan(plan)).toBe(true);
    expect(sim.city.funds).toBe(0);
    expect(applyPlan(planLine(sim, 'highway', linePath(2, 30, 40, 30)))).toBe(true);
  });

  it('unlocks rewards and allows more than one', () => {
    const sim = flatSim();
    expect(isAvailable(sim, getDef('landmark_tower')).ok).toBe(false);
    sim.city.sandbox = true;
    expect(isAvailable(sim, getDef('landmark_tower')).ok).toBe(true);
    applyPlan(planPlace(sim, 'landmark_tower', 5, 5, 0));
    expect(isAvailable(sim, getDef('landmark_tower')).ok).toBe(true);
  });

  it('keeps the treasury unchanged and refuses bonds', () => {
    const sim = flatSim();
    sim.city.sandbox = true;
    applyPlan(planPlace(sim, 'police_station', 10, 10, 0));
    const funds = sim.city.funds;
    runDays(sim, 95);
    expect(sim.city.funds).toBe(funds);
    expect(sim.city.lastReport).not.toBeNull();
    expect(sim.takeLoan(10000)).toBeNull();
  });
});
