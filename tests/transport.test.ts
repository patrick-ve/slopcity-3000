import { describe, expect, it } from 'vitest';
import { applyPlan, linePath, planBulldoze, planLine, planPlace } from '../src/sim/actions';
import { MAX_COMMUTE_COST, updateTraffic } from '../src/sim/traffic';
import { NET } from '../src/sim/types';
import type { Sim } from '../src/sim/sim';
import { flatSim } from './helpers';

function build(sim: Sim, kind: Parameters<typeof planLine>[1], x0: number, y0: number, x1: number, y1: number): void {
  const plan = planLine(sim, kind, linePath(x0, y0, x1, y1));
  if (!applyPlan(plan)) throw new Error(`${kind} failed: ${plan.reason}`);
}

function grow(sim: Sim, def: string, x: number, y: number, pop: number): void {
  sim.world.addBuilding({
    def,
    x,
    y,
    w: 1,
    h: 1,
    rot: 0,
    variant: 0,
    seed: 0,
    pop,
    build: 0,
    powered: true,
    watered: true,
    abandoned: false,
    fire: 0,
    age: 0,
    unhappy: 0,
  });
}

/** A house at the west end and a workshop at the east end of a long road on a large map. */
function longCommute(): Sim {
  const sim = flatSim(128);
  sim.city.funds = 1e7;
  sim.city.startYear = 1960;
  build(sim, 'road', 2, 10, 120, 10);
  grow(sim, 'R101_house', 3, 11, 10);
  grow(sim, 'I101_workshop', 118, 11, 20);
  sim.recompute(true);
  return sim;
}

describe('highways', () => {
  it('run above roads but not through buildings', () => {
    const sim = flatSim();
    sim.city.startYear = 1960;
    build(sim, 'road', 2, 10, 20, 10);
    build(sim, 'highway', 10, 2, 10, 20);
    const w = sim.world;
    expect(w.net[w.idx(10, 10)] & (NET.ROAD | NET.HIGHWAY)).toBe(NET.ROAD | NET.HIGHWAY);
    applyPlan(planPlace(sim, 'police_station', 14, 14, 0));
    const blocked = planLine(sim, 'highway', linePath(12, 15, 18, 15));
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('Blocked by a building');
    // no zoning or buildings on highway tiles
    expect(planPlace(sim, 'clinic', 10, 4, 0).ok).toBe(false);
  });

  it('are only available from 1940', () => {
    const sim = flatSim();
    sim.city.startYear = 1900;
    const plan = planLine(sim, 'highway', linePath(2, 2, 8, 2));
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe('Available in 1940');
  });

  it('need on-ramps between a road and the highway', () => {
    const sim = flatSim();
    sim.city.startYear = 1960;
    build(sim, 'road', 2, 10, 30, 10);
    build(sim, 'highway', 2, 12, 30, 12);
    const ok = planPlace(sim, 'onramp', 5, 11, 'auto');
    expect(ok.ok).toBe(true);
    expect(ok.rot).toBe(2); // front faces the road (−z), back faces the highway
    expect(planPlace(sim, 'onramp', 5, 5, 'auto').reason).toBe('Place it in a line between a road and a highway');
  });

  it('bring far jobs within commuting range', () => {
    const sim = longCommute();
    const w = sim.world;
    updateTraffic(sim);
    const home = w.idx(3, 10);
    expect(sim.access.jobDist[home]).toBeGreaterThan(MAX_COMMUTE_COST);
    build(sim, 'highway', 3, 12, 119, 12);
    applyPlan(planPlace(sim, 'onramp', 5, 11, 'auto'));
    applyPlan(planPlace(sim, 'onramp', 116, 11, 'auto'));
    sim.recompute(false);
    updateTraffic(sim);
    expect(sim.access.jobDist[home]).toBeLessThanOrEqual(MAX_COMMUTE_COST);
    expect(w.hwyTraffic[w.idx(60, 12)]).toBeGreaterThan(0);
  });
});

describe('subways', () => {
  it('need two stations on a line to run', () => {
    const sim = flatSim();
    build(sim, 'subway', 5, 5, 25, 5);
    expect(planPlace(sim, 'subway_station', 10, 9, 0).reason).toBe('Must be built on a subway line');
    applyPlan(planPlace(sim, 'subway_station', 5, 5, 0));
    sim.recompute(false);
    const w = sim.world;
    expect(sim.subwayLinked.size).toBe(0);
    expect(w.cover.transit[w.idx(5, 5)]).toBe(0);
    applyPlan(planPlace(sim, 'subway_station', 25, 5, 0));
    sim.recompute(false);
    expect(sim.subwayLinked.size).toBe(2);
    expect(sim.subwayLive[w.idx(15, 5)]).toBe(1);
    expect(w.cover.transit[w.idx(5, 5)]).toBeGreaterThan(0);
  });

  it('carry commuters between far stations', () => {
    const sim = longCommute();
    build(sim, 'subway', 4, 11, 117, 11);
    applyPlan(planPlace(sim, 'subway_station', 4, 11, 0));
    applyPlan(planPlace(sim, 'subway_station', 117, 11, 0));
    sim.recompute(false);
    updateTraffic(sim);
    expect(sim.access.jobDist[sim.world.idx(3, 10)]).toBeLessThanOrEqual(MAX_COMMUTE_COST);
    expect(sim.stats.subwayRiders).toBeGreaterThan(0);
  });

  it('survive the surface bulldozer', () => {
    const sim = flatSim();
    sim.city.startYear = 1960;
    build(sim, 'subway', 5, 8, 15, 8);
    build(sim, 'pipe', 5, 8, 15, 8);
    build(sim, 'highway', 5, 8, 15, 8);
    const w = sim.world;
    const i = w.idx(10, 8);
    applyPlan(planBulldoze(sim, 10, 8, 10, 8));
    expect(w.net[i]).toBe(NET.SUBWAY | NET.PIPE);
    applyPlan(planBulldoze(sim, 10, 8, 10, 8, true));
    expect(w.net[i]).toBe(0);
  });
});
