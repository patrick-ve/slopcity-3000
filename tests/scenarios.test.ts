import { describe, expect, it } from 'vitest';
import { applyPlan, linePath, planBulldoze, planLine, planPlace } from '../src/sim/actions';
import { growCity } from '../src/sim/planner';
import { buildScenarioNow, getScenario, SCENARIOS, scenarioProgress, updateScenario } from '../src/sim/scenarios';
import { placeAround } from '../src/sim/starters';
import type { Sim } from '../src/sim/sim';

/** Play months until the scenario ends; returns the result. */
function playOut(sim: Sim, maxYears = 20): 'won' | 'lost' {
  for (let m = 0; m < maxYears * 12; m++) {
    growCity(sim, 30);
    const r = updateScenario(sim);
    if (r) return r;
  }
  throw new Error('scenario never ended');
}

function centre(sim: Sim): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const b of sim.world.buildings.values()) {
    x += b.x;
    y += b.y;
    n++;
  }
  return { x: Math.round(x / n), y: Math.round(y / n) };
}

describe('scenarios', () => {
  for (const def of SCENARIOS) {
    it(`${def.name} starts with open goals and a deadline`, () => {
      const sim = buildScenarioNow(def);
      const st = sim.city.scenario!;
      expect(st.id).toBe(def.id);
      expect(st.status).toBe('active');
      expect(st.deadline - st.start).toBe(def.years * 365);
      expect(st.targets).toHaveLength(def.goals.length);
      def.onStart?.(sim);
      sim.recompute(false);
      expect(scenarioProgress(sim).some((g) => !g.met)).toBe(true);
      expect(updateScenario(sim)).toBeNull();
    }, 30000);
  }

  it('is won when every goal is met and lost when time runs out', () => {
    const won = buildScenarioNow(getScenario('boomtown'));
    won.stats.residents = 10000;
    expect(updateScenario(won)).toBe('won');
    expect(updateScenario(won)).toBeNull();
    const lost = buildScenarioNow(getScenario('boomtown'));
    lost.city.day = lost.city.scenario!.deadline;
    expect(updateScenario(lost)).toBe('lost');
  });

  it('Gridlock Gulch can be won with a subway network', () => {
    const sim = buildScenarioNow(getScenario('gridlock'));
    const w = sim.world;
    const c = centre(sim);
    for (let off = -36; off <= 36; off += 18) {
      applyPlan(planLine(sim, 'subway', linePath(8, c.y + off, w.w - 8, c.y + off)));
      applyPlan(planLine(sim, 'subway', linePath(c.x + off, 8, c.x + off, w.h - 8)));
      for (let t = 8; t < w.w - 8; t += 5) {
        applyPlan(planPlace(sim, 'subway_station', t, c.y + off, 'auto'));
        applyPlan(planPlace(sim, 'subway_station', c.x + off, t, 'auto'));
      }
    }
    expect(playOut(sim)).toBe('won');
  }, 60000);

  it('Smog Valley meets its pollution goal with clean air and nuclear power', () => {
    const sim = buildScenarioNow(getScenario('smog_valley'));
    sim.city.ordinances.clean_air = true;
    const coal = [...sim.world.buildings.values()].filter((b) => b.def === 'coal_plant');
    for (const b of coal) applyPlan(planBulldoze(sim, b.x, b.y, b.x, b.y));
    sim.city.funds += 50000;
    expect(placeAround(sim, 'nuclear_plant', coal[0].x, coal[0].y, 20)).toBe(true);
    for (let m = 0; m < 10 * 12; m++) {
      growCity(sim, 30);
      if (scenarioProgress(sim)[0].met) break;
    }
    expect(scenarioProgress(sim)[0].met).toBe(true);
  }, 60000);

  it('The Big Shake is not won by waiting', () => {
    const def = getScenario('big_shake');
    const sim = buildScenarioNow(def);
    def.onStart!(sim);
    expect(playOut(sim)).toBe('lost');
  }, 60000);
});
