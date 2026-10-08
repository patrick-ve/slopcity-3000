import { describe, expect, it } from 'vitest';
import { applyPlan, linePath, planLine, planPlace } from '../src/sim/actions';
import { computeBudget, DEAL_COSTS } from '../src/sim/budget';
import { MAINTENANCE } from '../src/sim/catalog';
import { updateDemand } from '../src/sim/demand';
import { flatSim, runDays, starterCity } from './helpers';

describe('budget', () => {
  it('raises more tax at higher rates', () => {
    const sim = flatSim();
    starterCity(sim);
    runDays(sim, 400);
    sim.city.tax = { R: 5, C: 5, I: 5 };
    const low = computeBudget(sim).income;
    sim.city.tax = { R: 10, C: 10, I: 10 };
    const high = computeBudget(sim).income;
    expect(low.resTax).toBeGreaterThan(0);
    expect(high.resTax).toBeCloseTo(low.resTax * 2, 5);
    expect(high.comTax).toBeCloseTo(low.comTax * 2, 5);
    expect(high.indTax).toBeCloseTo(low.indTax * 2, 5);
  });

  it('charges upkeep for services by funding level, and maintenance for networks', () => {
    const sim = flatSim();
    applyPlan(planPlace(sim, 'police_station', 10, 10, 0));
    sim.recompute(false);
    const full = computeBudget(sim).expense.departments.police;
    expect(full).toBe(60);
    sim.city.funding.police = 0.5;
    expect(computeBudget(sim).expense.departments.police).toBe(30);
    // 50 road tiles and 40 subway tiles
    applyPlan(planLine(sim, 'road', linePath(2, 30, 51, 30)));
    applyPlan(planLine(sim, 'subway', linePath(2, 40, 41, 40)));
    sim.recompute(false);
    const rep = computeBudget(sim);
    expect(rep.expense.departments.roads).toBeCloseTo(50 * MAINTENANCE.road, 5);
    expect(rep.expense.departments.transit).toBeCloseTo(40 * MAINTENANCE.subway, 5);
  });

  it('applies the monthly report to the treasury and tracks debt', () => {
    const sim = flatSim();
    applyPlan(planPlace(sim, 'hospital', 10, 10, 0));
    sim.city.funds = 100;
    runDays(sim, 31);
    expect(sim.city.lastReport).not.toBeNull();
    expect(sim.city.funds).toBeLessThan(100);
    runDays(sim, 31);
    expect(sim.city.funds).toBeLessThan(0);
    expect(sim.city.debtMonths).toBeGreaterThan(0);
  });

  it('pays neighbour deals every month', () => {
    const sim = flatSim();
    sim.city.deals.power = true;
    expect(computeBudget(sim).expense.deals).toBe(DEAL_COSTS.power);
  });

  it('repays bonds in monthly payments', () => {
    const sim = flatSim();
    const before = sim.city.funds;
    const loan = sim.takeLoan(10000)!;
    expect(sim.city.funds).toBe(before + 10000);
    expect(loan.payment * 120).toBeGreaterThan(10000);
    const owed = loan.remaining;
    runDays(sim, 62);
    expect(sim.city.loans[0].remaining).toBeCloseTo(owed - loan.payment * 2, 5);
    expect(sim.repayLoan(loan.id)).toBe(true);
    expect(sim.city.loans).toHaveLength(0);
    // at most five bonds at a time
    for (let k = 0; k < 5; k++) expect(sim.takeLoan(1000)).not.toBeNull();
    expect(sim.takeLoan(1000)).toBeNull();
  });

  it('lowers demand when taxes are high', () => {
    const sim = flatSim();
    starterCity(sim);
    runDays(sim, 200);
    sim.city.tax = { R: 3, C: 3, I: 3 };
    updateDemand(sim, 1);
    const low = { ...sim.stats.demandTarget };
    sim.city.tax = { R: 15, C: 15, I: 15 };
    updateDemand(sim, 1);
    const high = sim.stats.demandTarget;
    expect(high.r).toBeLessThan(low.r);
    expect(high.c).toBeLessThan(low.c);
    expect(high.i).toBeLessThan(low.i);
  });
});

describe('disasters', () => {
  it('fires burn buildings down unless firefighters save them', () => {
    const sim = flatSim();
    starterCity(sim);
    runDays(sim, 300);
    const target = [...sim.world.buildings.values()].find((b) => b.def.startsWith('R') && b.build === 0)!;
    expect(sim.disasters.ignite(target)).toBe(true);
    expect(target.fire).toBeGreaterThan(0);
    runDays(sim, 40);
    const still = sim.world.buildings.get(target.id);
    // either destroyed (rubble) or put out
    if (still) expect(still.fire).toBe(0);
    else expect(sim.world.rubble[sim.world.idx(target.x, target.y)]).toBe(1);
  });

  it('fireproof buildings do not catch fire', () => {
    const sim = flatSim();
    applyPlan(planPlace(sim, 'fire_station', 10, 10, 0));
    const station = sim.world.buildingAt(10, 10)!;
    expect(sim.disasters.ignite(station)).toBe(false);
  });

  it('earthquakes destroy buildings near the epicentre, more when stronger', () => {
    const count = (strength: number) => {
      const sim = flatSim();
      starterCity(sim);
      runDays(sim, 600);
      const before = sim.world.buildings.size;
      sim.disasters.trigger('earthquake', 25, 25, strength);
      return before - sim.world.buildings.size;
    };
    const weak = count(0.5);
    const strong = count(2);
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeGreaterThan(5);
  });

  it('a tornado tears up its path', () => {
    const sim = flatSim();
    starterCity(sim);
    runDays(sim, 600);
    const before = sim.world.buildings.size;
    sim.disasters.trigger('tornado', 25, 25);
    for (let t = 0; t < 30 && sim.disasters.tornado; t += 0.1) sim.disasters.update(0.1);
    expect(sim.disasters.tornado).toBeNull();
    expect(sim.world.buildings.size).toBeLessThan(before);
  });

  it('a meteor leaves a crater', () => {
    const sim = flatSim();
    starterCity(sim);
    runDays(sim, 600);
    const before = sim.world.buildings.size;
    sim.disasters.trigger('meteor', 20, 15);
    for (let t = 0; t < 5; t += 0.1) sim.disasters.update(0.1);
    expect(sim.disasters.meteors).toHaveLength(0);
    expect(sim.world.buildings.size).toBeLessThan(before);
  });

  it('no random disasters strike while they are switched off', () => {
    const sim = flatSim();
    starterCity(sim);
    sim.city.disastersEnabled = false;
    let destroyed = 0;
    sim.events.on('building', (e) => {
      if (e.type === 'destroyed') destroyed++;
    });
    runDays(sim, 365 * 5);
    expect(destroyed).toBe(0);
    expect(sim.stats.burning).toBe(0);
  });
});
