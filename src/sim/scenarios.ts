/**
 * Scenarios: a starting city, goals and a deadline. The goals are checked
 * every month; when all of them are met the scenario is won, when the
 * deadline passes first it is lost. Either way the city can be played on.
 */
import { generateMap, type MapOptions } from './mapgen';
import { growCity, layoutCity, type CityPlan } from './planner';
import { Sim } from './sim';
import { buildStarter, findSite, getStarter } from './starters';
import { DEPARTMENTS, type Difficulty } from './types';
import { World } from './world';

export type GoalKind = 'population' | 'funds' | 'cashflow' | 'traffic' | 'pollution' | 'bonds' | 'lifeExpectancy' | 'unemployment';

export interface Goal {
  kind: GoalKind;
  /** A number, or a rule that sets it from the starting city. */
  target: number | ((sim: Sim) => number);
  /** Menu text for a target that depends on the starting city. */
  hint?: string;
}

export interface ScenarioDef {
  id: string;
  name: string;
  /** One sentence for the menu. */
  brief: string;
  /** What happened and what the mayor must do (shown when the scenario starts). */
  story: string;
  level: 'Easy' | 'Medium' | 'Hard';
  /** Time limit in years. */
  years: number;
  goals: Goal[];
  /** Build the starting city; yields progress 0..1. */
  setup: () => Generator<number, Sim>;
  /** Runs once when the player takes over (for example a disaster). */
  onStart?: (sim: Sim) => void;
}

interface GoalInfo {
  value: (sim: Sim) => number;
  /** 'more': reach at least the target; 'less': get down to at most the target. */
  better: 'more' | 'less';
  label: (t: number) => string;
  format: (v: number) => string;
}

const int = (v: number) => Math.round(v).toLocaleString('en-US');
const money = (v: number) => `${v < 0 ? '-' : ''}§${int(Math.abs(v))}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export const GOALS: Record<GoalKind, GoalInfo> = {
  population: { value: (s) => s.stats.residents, better: 'more', label: (t) => `Reach ${int(t)} residents`, format: int },
  funds: { value: (s) => s.city.funds, better: 'more', label: (t) => `Have ${money(t)} in the treasury`, format: money },
  cashflow: {
    value: (s) => s.city.lastReport?.total ?? 0,
    better: 'more',
    label: (t) => `Earn ${money(t)} or more a month`,
    format: (v) => `${money(v)}/month`,
  },
  traffic: { value: (s) => s.stats.avgTraffic, better: 'less', label: (t) => `Bring traffic down to ${pct(t)}`, format: pct },
  pollution: { value: (s) => s.stats.avgPollution, better: 'less', label: (t) => `Bring pollution down to ${pct(t)}`, format: pct },
  bonds: { value: (s) => s.city.loans.length, better: 'less', label: () => 'Pay off every bond', format: (v) => `${v} left` },
  lifeExpectancy: {
    value: (s) => s.city.le,
    better: 'more',
    label: (t) => `Raise life expectancy to ${Math.round(t)} years`,
    format: (v) => `${Math.round(v)} years`,
  },
  unemployment: { value: (s) => s.stats.unemployment, better: 'less', label: (t) => `Bring unemployment down to ${pct(t)}`, format: pct },
};

/** Build a planned city from a map and grow it (with progress). */
function* plannedCity(
  name: string,
  map: MapOptions,
  startYear: number,
  difficulty: Difficulty,
  plan: CityPlan,
  area: number,
  years: number,
): Generator<number, Sim> {
  const world = new World(map.size, map.size);
  generateMap(world, map);
  const sim = new Sim(world, { name, mayor: 'Mayor', startYear, difficulty, seed: map.seed });
  sim.city.disastersEnabled = false;
  const span = Math.round(map.size * area);
  const site = findSite(world, span);
  const half = span >> 1;
  layoutCity(sim, {
    ...plan,
    x0: site.x - half,
    y0: site.y - half,
    x1: site.x + half,
    y1: site.y + half,
    cx: site.x,
    cy: site.y,
    seed: map.seed,
  });
  yield 0.05;
  for (let m = 0; m < years * 12; m++) {
    growCity(sim, 30);
    if (m % 3 === 2) yield 0.05 + (0.95 * m) / (years * 12);
  }
  sim.city.disastersEnabled = true;
  return sim;
}

/** Run a starter city's builder with progress. */
function* starter(id: string): Generator<number, Sim> {
  const gen = buildStarter(getStarter(id));
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
    yield r.value;
  }
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'boomtown',
    name: 'Boomtown',
    brief: 'Turn an empty river valley into a real town.',
    story:
      'Settlers have their eye on this quiet valley, and the governor gives you §20,000 and fifteen years. Lay out roads, zone land, bring power and water, and grow a town of 10,000 people.',
    level: 'Easy',
    years: 15,
    goals: [{ kind: 'population', target: 10000 }],
    setup: function* () {
      const map: MapOptions = { size: 96, seed: 6061, terrain: 'rolling', water: 'river', trees: 'normal' };
      const world = new World(map.size, map.size);
      generateMap(world, map);
      yield 0.5;
      return new Sim(world, { name: 'Boomtown', mayor: 'Mayor', startYear: 1950, difficulty: 'medium', seed: map.seed });
    },
  },
  {
    id: 'gridlock',
    name: 'Gridlock Gulch',
    brief: 'A big city where nobody can move. Fix the traffic without losing people.',
    story:
      'Gridlock Gulch grew fast on streets alone, and now every commute is a crawl. Build subways with stations, or highways with on-ramps, to cut traffic. Keep the city at least as big as it is today.',
    level: 'Medium',
    years: 8,
    goals: [
      { kind: 'traffic', target: (s) => Math.floor(s.stats.avgTraffic * 0.6 * 100) / 100, hint: 'Cut traffic by 40%' },
      { kind: 'population', target: (s) => Math.floor(s.stats.residents / 1000) * 1000, hint: 'Keep the population' },
    ],
    setup: function* () {
      const sim = yield* plannedCity(
        'Gridlock Gulch',
        { size: 128, seed: 777, terrain: 'flat', water: 'lakes', trees: 'few' },
        1975,
        'medium',
        { density: 3, rings: [0.55, 0.9], services: 'full', industryAngle: Math.PI, industryWidth: 0.9 },
        0.8,
        8,
      );
      sim.city.funds = 120000;
      return sim;
    },
  },
  {
    id: 'smog_valley',
    name: 'Smog Valley',
    brief: 'Coal and heavy industry choke this valley. Clean the air and keep growing.',
    story:
      'Coal smoke hangs over Smog Valley and the residents are coughing. Cut the pollution by almost half and grow the city by 30%, all within ten years. Try cleaner power, the Clean Air Act, and schools that bring high-tech industry.',
    level: 'Medium',
    years: 10,
    goals: [
      { kind: 'pollution', target: (s) => Math.round(s.stats.avgPollution * 0.55 * 100) / 100, hint: 'Cut pollution by 45%' },
      { kind: 'population', target: (s) => Math.round((s.stats.residents * 1.3) / 500) * 500, hint: 'Grow the population by 30%' },
    ],
    setup: function* () {
      const sim = yield* plannedCity(
        'Smog Valley',
        { size: 96, seed: 4040, terrain: 'hilly', water: 'river', trees: 'few' },
        1960,
        'medium',
        { density: 2, services: 'basic', serviceSpacing: 1.3, power: 'coal_plant', industryAngle: Math.PI / 2, industryWidth: 1.25 },
        0.62,
        6,
      );
      sim.city.funds = 40000;
      return sim;
    },
  },
  {
    id: 'paradise',
    name: 'Paradise Found',
    brief: 'Grow Isla Bonita into a healthy, wealthy island resort.',
    story:
      'Isla Bonita is the jewel of the sea, and investors want more. Grow the island to 12,000 residents, raise life expectancy to 72 years and build up a §60,000 treasury.',
    level: 'Easy',
    years: 10,
    goals: [
      { kind: 'population', target: 12000 },
      { kind: 'lifeExpectancy', target: 72 },
      { kind: 'funds', target: 60000 },
    ],
    setup: () => starter('isla_bonita'),
  },
  {
    id: 'budget_crisis',
    name: 'Budget Crisis',
    brief: 'Harbor Bay is broke. Balance the books and pay off its bonds.',
    story:
      'The last mayor spent like there was no tomorrow: every department at 120%, costly ordinances, low taxes and three bonds. The treasury is empty. Pay off every bond, earn §1,000 a month and save §50,000.',
    level: 'Hard',
    years: 8,
    goals: [
      { kind: 'bonds', target: 0 },
      { kind: 'cashflow', target: 1000 },
      { kind: 'funds', target: 50000 },
    ],
    setup: function* () {
      const sim = yield* starter('harbor_bay');
      const c = sim.city;
      for (const d of DEPARTMENTS) c.funding[d] = 1.2;
      c.tax = { R: 4, C: 4, I: 4 };
      Object.assign(c.ordinances, {
        free_clinics: true,
        youth_curfew: true,
        neighborhood_watch: true,
        smoke_detectors: true,
        city_beautification: true,
      });
      c.loans = [];
      for (let k = 0; k < 3; k++) sim.takeLoan(25000);
      c.funds = -15000;
      return sim;
    },
  },
  {
    id: 'big_shake',
    name: 'The Big Shake',
    brief: 'An earthquake hits Riverside. Rebuild the town.',
    story:
      'The ground shook under Riverside, and buildings fell. Clear the rubble, put out the fires, restore power and water, and bring the population back to where it was within five years.',
    level: 'Hard',
    years: 5,
    goals: [{ kind: 'population', target: (s) => Math.ceil(s.stats.residents / 100) * 100, hint: 'Grow back to the old population' }],
    setup: () => starter('riverside'),
    onStart: (sim) => {
      // a strong quake right under the town centre
      let x = 0;
      let y = 0;
      let n = 0;
      for (const b of sim.world.buildings.values()) {
        x += b.x;
        y += b.y;
        n++;
      }
      sim.disasters.trigger('earthquake', Math.round(x / Math.max(1, n)), Math.round(y / Math.max(1, n)), 2);
    },
  },
];

export function getScenario(id: string): ScenarioDef {
  const s = SCENARIOS.find((d) => d.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
}

/** Build a scenario's starting city and attach its goals and deadline (yields progress 0..1). */
export function* buildScenario(def: ScenarioDef): Generator<number, Sim> {
  const gen = def.setup();
  let r = gen.next();
  while (!r.done) {
    yield r.value;
    r = gen.next();
  }
  const sim = r.value;
  sim.city.scenario = {
    id: def.id,
    start: sim.city.day,
    deadline: sim.city.day + def.years * 365,
    status: 'active',
    targets: def.goals.map((g) => (typeof g.target === 'function' ? g.target(sim) : g.target)),
  };
  return sim;
}

/** Build a scenario in one go (tests). */
export function buildScenarioNow(def: ScenarioDef): Sim {
  const gen = buildScenario(def);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

export interface GoalProgress {
  label: string;
  value: string;
  met: boolean;
}

/** Goals of the running scenario with their current values. */
export function scenarioProgress(sim: Sim): GoalProgress[] {
  const st = sim.city.scenario;
  if (!st) return [];
  const def = SCENARIOS.find((d) => d.id === st.id);
  if (!def) return [];
  return def.goals.map((g, k) => {
    const info = GOALS[g.kind];
    const target = st.targets?.[k] ?? (typeof g.target === 'number' ? g.target : 0);
    const v = info.value(sim);
    return { label: info.label(target), value: info.format(v), met: info.better === 'more' ? v >= target : v <= target };
  });
}

/** Check the running scenario. Returns 'won' or 'lost' when that just happened. */
export function updateScenario(sim: Sim): 'won' | 'lost' | null {
  const st = sim.city.scenario;
  if (!st || st.status !== 'active') return null;
  const goals = scenarioProgress(sim);
  if (goals.length && goals.every((g) => g.met)) {
    st.status = 'won';
    return 'won';
  }
  if (sim.city.day >= st.deadline) {
    st.status = 'lost';
    return 'lost';
  }
  return null;
}
