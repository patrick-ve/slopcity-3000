import type { Sim } from './sim';
import { computeBudget } from './budget';

export type AdvisorId = 'finance' | 'utilities' | 'safety' | 'health' | 'transport' | 'environment' | 'planning';

export interface Advisor {
  id: AdvisorId;
  name: string;
  title: string;
  face: string;
  color: string;
}

export const ADVISORS: Advisor[] = [
  { id: 'finance', name: 'Penny Pincher', title: 'Finance', face: '💰', color: '#e0b84c' },
  { id: 'utilities', name: 'Watt Volton', title: 'Utilities', face: '⚡', color: '#f2c94c' },
  { id: 'safety', name: 'Chief Sirena', title: 'Public Safety', face: '🚒', color: '#e05a4c' },
  { id: 'health', name: 'Dr. Ada Learnwell', title: 'Health & Education', face: '🎓', color: '#7fc98f' },
  { id: 'transport', name: 'Miles Lane', title: 'Transportation', face: '🚌', color: '#6fb7ff' },
  { id: 'environment', name: 'Fern Greenleaf', title: 'Environment', face: '🌳', color: '#5fb25f' },
  { id: 'planning', name: 'Grid Squareman', title: 'City Planning', face: '📐', color: '#b38cf2' },
];

export interface Advice {
  advisor: AdvisorId;
  severity: 0 | 1 | 2; // 0 ok, 1 warning, 2 urgent
  text: string;
}

/** Build the current list of advice for every advisor. */
export function getAdvice(sim: Sim): Advice[] {
  const s = sim.stats;
  const c = sim.city;
  const out: Advice[] = [];
  const add = (advisor: AdvisorId, severity: 0 | 1 | 2, text: string) => out.push({ advisor, severity, text });
  const budget = computeBudget(sim);

  // finance
  if (c.funds < 0) add('finance', 2, 'We are broke! Raise taxes, cut department funding or issue a bond right away.');
  else if (budget.total < 0 && c.funds < -budget.total * 12)
    add('finance', 2, `We lose §${Math.round(-budget.total).toLocaleString('en-US')} a month and will be broke within a year.`);
  else if (budget.total < 0)
    add('finance', 1, `The budget runs a monthly deficit of §${Math.round(-budget.total).toLocaleString('en-US')}.`);
  if (c.tax.R > 10 || c.tax.C > 10 || c.tax.I > 10) add('finance', 1, 'Taxes above 10% scare away residents and businesses.');
  if (c.tax.R < 5 && c.tax.C < 5 && c.tax.I < 5 && c.funds < 5000)
    add('finance', 1, 'Our taxes are low. A small raise would help the treasury.');
  if (budget.total > 0 && c.funds > 20000) add('finance', 0, 'The treasury is healthy. A good time to invest in services.');

  // utilities
  if (s.buildings > 0 && s.powerSupply === 0)
    add('utilities', 2, 'There is no power at all! Build a power plant and connect it with power lines.');
  else if (s.powerDemand > s.powerSupply)
    add(
      'utilities',
      2,
      `Power demand (${Math.round(s.powerDemand)} MW) exceeds supply (${Math.round(s.powerSupply)} MW). Build another plant.`,
    );
  else if (s.powerDemand > s.powerSupply * 0.85) add('utilities', 1, 'Our power plants are near capacity. Plan a new plant soon.');
  if (s.unpoweredZones > 0 && s.powerSupply > 0)
    add(
      'utilities',
      2,
      `${s.unpoweredZones} zoned tiles have no power and cannot grow. Zones carry power to each other, but you need power lines to cross roads and empty land.`,
    );
  else if (s.unpoweredZones > 0) add('utilities', 2, 'Zones need power before anything is built. Build a power plant next to your zones.');
  if (s.unpowered > 3)
    add('utilities', 1, `${s.unpowered} buildings have no power. Check the power grid for gaps — power lines must cross roads.`);
  if (s.residents > 400 && s.waterSupply === 0)
    add('utilities', 2, 'We have no water supply. Build water pumps and lay pipes in the underground view.');
  else if (s.waterDemand > s.waterSupply) add('utilities', 1, 'Water demand exceeds supply. Build more pumps or a water tower.');
  if (s.unwatered > 5) add('utilities', 1, `${s.unwatered} buildings have no water. Medium and dense zones need pipes to grow.`);
  if (c.garbageBacklog > 100) add('utilities', 2, 'Garbage is piling up! Zone a landfill near a road, build an incinerator or export it.');
  else if (s.residents > 1500 && s.landfillCapacity < s.garbageProduced * 6 && s.garbageHandled < s.garbageProduced)
    add('utilities', 1, 'Our landfills are nearly full. Plan new garbage capacity.');

  // safety
  if (s.residents > 1500 && s.avgCrime > 0.3) add('safety', 2, 'Crime is high. Build police stations near dense neighbourhoods.');
  else if (s.residents > 800 && s.avgCrime > 0.15) add('safety', 1, 'Crime is rising. A police station would help.');
  if (s.burning > 0) add('safety', 2, `${s.burning} buildings are on fire! Fire stations nearby put fires out faster.`);
  if (s.residents > 1000 && !hasBuilding(sim, 'fire_station'))
    add('safety', 1, 'We have no fire station. One fire could spread through the whole city.');

  // health & education
  if (s.residents > 2000 && s.eduCover < 0.3)
    add('health', 1, 'Too few children can reach a school. Build elementary schools in residential areas.');
  if (s.residents > 8000 && !hasBuilding(sim, 'college'))
    add('health', 1, 'A college would raise education and attract high-tech industry.');
  if (s.residents > 2000 && s.healthCover < 0.3) add('health', 1, 'Health care is poor. Build clinics or a hospital.');
  if (c.le < 55 && s.residents > 1000) add('health', 2, `Life expectancy has dropped to ${Math.round(c.le)} years.`);
  if (c.eq > 110) add('health', 0, `Our citizens are well educated (EQ ${Math.round(c.eq)}). High-tech industry will move in.`);

  // transport
  if (s.avgTraffic > 0.9) add('transport', 2, 'Traffic is gridlocked. Build subways, highways with on-ramps, or more roads.');
  else if (s.avgTraffic > 0.55) add('transport', 1, 'Traffic is getting heavy. A subway line or a highway would help.');
  if (s.subwayRiders > 0) add('transport', 0, `${Math.round(s.subwayRiders).toLocaleString('en-US')} commuters ride the subway every day.`);
  if (s.connections.road === 0 && s.residents > 300)
    add('transport', 1, 'Connect a road to the map edge to link us to our neighbours. It boosts demand.');
  if (s.indJobs > 3000 && !s.hasSeaport) add('transport', 1, 'Industry wants a seaport to reach world markets.');
  if (s.comJobs > 4000 && !s.hasAirport) add('transport', 1, 'Businesses want an airport.');

  // environment
  if (s.resPollution > 0.4) add('environment', 2, 'Residents breathe dirty air. Keep industry and power plants away from homes.');
  else if (s.avgPollution > 0.25) add('environment', 1, 'Pollution is rising. Plant trees, use cleaner power, or pass the Clean Air Act.');
  if (s.residents > 3000 && s.parksCover < 0.2) add('environment', 1, 'Residents want parks. Parks raise land value too.');

  // planning
  const d = c.demand;
  if (s.buildings === 0 && s.zoneTiles[1] === 0)
    add('planning', 1, 'Start with a road, then zone residential and industrial land next to it, and build a power plant.');
  if (d.r > 0.4 && s.emptyZoneTiles[1] < 10) add('planning', 1, 'People want to move here. Zone more residential land.');
  if (d.c > 0.4 && s.emptyZoneTiles[2] < 10) add('planning', 1, 'Businesses want space. Zone more commercial land.');
  if (d.i > 0.4 && s.emptyZoneTiles[3] < 10) add('planning', 1, 'Industry wants to expand. Zone more industrial land.');
  if (d.r < -0.3) add('planning', 1, 'Residential demand is negative: we need more jobs or a better quality of life.');
  if (s.abandoned > 10) add('planning', 1, `${s.abandoned} buildings are abandoned. Check power, water, pollution and crime nearby.`);
  if (s.unemployment > 0.15 && s.residents > 1000)
    add('planning', 1, `Unemployment is ${(s.unemployment * 100).toFixed(0)}%. Zone more commercial and industrial land.`);

  for (const a of ADVISORS) if (!out.some((o) => o.advisor === a.id)) add(a.id, 0, quiet(a.id));
  return out.sort((a, b) => b.severity - a.severity);
}

function hasBuilding(sim: Sim, def: string): boolean {
  for (const b of sim.world.buildings.values()) if (b.def === def) return true;
  return false;
}

function quiet(id: AdvisorId): string {
  return {
    finance: 'The books are balanced. Nothing to report.',
    utilities: 'Power and water are flowing nicely.',
    safety: 'The streets are calm and safe.',
    health: 'Our citizens are healthy and learning.',
    transport: 'Traffic is moving smoothly.',
    environment: 'The air is clean and the trees are green.',
    planning: 'The city is growing in good order.',
  }[id];
}
