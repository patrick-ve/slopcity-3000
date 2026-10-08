import { DEPARTMENTS, type Department, type MonthlyReport } from './types';
import { getDef, MAINTENANCE } from './catalog';
import { ORDINANCES, ordinanceMonthly } from './ordinances';
import type { Sim } from './sim';

const RES_WEALTH = [0.8, 1.0, 1.4];
const COM_WEALTH = [0.85, 1.0, 1.3];
const IND_WEALTH = [1.0, 1.1, 1.35];
const RES_K = 0.0175;
const JOB_K = 0.026;

export const DEAL_COSTS = { power: 350, water: 250, garbagePerTon: 0.6 };

/** Compute this month's income and expenses (does not apply them). */
export function computeBudget(sim: Sim): MonthlyReport {
  const w = sim.world;
  const c = sim.city;
  const s = sim.stats;
  const departments = {} as Record<Department, number>;
  for (const d of DEPARTMENTS) departments[d] = 0;
  let resTax = 0;
  let comTax = 0;
  let indTax = 0;
  let utilities = 0;
  let dealIncome = 0;

  for (const b of w.buildings.values()) {
    const def = getDef(b.def);
    if (def.growable) {
      if (b.pop <= 0) continue;
      const lv = w.landValue[w.idx(b.x, b.y)];
      const wl = def.wealth ?? 0;
      if (def.zone === 1) resTax += b.pop * RES_WEALTH[wl] * c.tax.R * RES_K * (0.75 + lv * 0.5);
      else if (def.zone === 2) comTax += b.pop * COM_WEALTH[wl] * c.tax.C * JOB_K * (0.75 + lv * 0.5);
      else indTax += b.pop * IND_WEALTH[wl] * c.tax.I * JOB_K;
      continue;
    }
    if (def.residents) resTax += b.pop * c.tax.R * RES_K * 1.2;
    const up = def.upkeep ?? 0;
    if (up < 0) {
      if (b.build <= 0) dealIncome += -up;
      continue;
    }
    if (def.dept) departments[def.dept] += up * c.funding[def.dept];
    else utilities += up;
  }
  departments.roads +=
    (s.roadTiles * MAINTENANCE.road + s.railTiles * MAINTENANCE.rail + s.highwayTiles * MAINTENANCE.highway) * c.funding.roads;
  departments.transit += s.subwayTiles * MAINTENANCE.subway * c.funding.transit;
  utilities += s.powerLineTiles * MAINTENANCE.powerLine + s.pipeTiles * MAINTENANCE.pipe;

  let ordIncome = 0;
  let ordCost = 0;
  for (const o of ORDINANCES) {
    if (!c.ordinances[o.id]) continue;
    const v = ordinanceMonthly(o, s.residents);
    if (v < 0) ordIncome += -v;
    else ordCost += v;
  }
  let dealCost = 0;
  if (c.deals.power) dealCost += DEAL_COSTS.power;
  if (c.deals.water) dealCost += DEAL_COSTS.water;
  dealCost += sim.garbageExported * DEAL_COSTS.garbagePerTon;
  const loans = c.loans.reduce((a, l) => a + Math.min(l.payment, l.remaining), 0);

  const income = { resTax, comTax, indTax, ordinances: ordIncome, deals: dealIncome };
  const expense = { departments, utilities, ordinances: ordCost, loans, deals: dealCost };
  const total =
    resTax +
    comTax +
    indTax +
    ordIncome +
    dealIncome -
    (Object.values(departments).reduce((a, b) => a + b, 0) + utilities + ordCost + loans + dealCost);
  return { income, expense, total };
}

/** Apply the monthly budget, service loans and warn about debt. */
export function runMonthlyBudget(sim: Sim): void {
  const c = sim.city;
  const rep = computeBudget(sim);
  c.lastReport = rep;
  if (c.sandbox) return;
  c.funds += rep.total;
  for (const l of c.loans) l.remaining -= Math.min(l.payment, l.remaining);
  const paid = c.loans.filter((l) => l.remaining <= 0.5);
  if (paid.length) {
    c.loans = c.loans.filter((l) => l.remaining > 0.5);
    sim.message({ title: 'Bond repaid', text: 'A city bond has been fully repaid.', kind: 'good' });
  }
  if (c.funds < 0) {
    c.debtMonths++;
    if (c.debtMonths === 1 || c.debtMonths % 6 === 0) {
      sim.message({
        title: 'Treasury in the red',
        text: 'The city is out of money. Raise taxes, cut spending or issue a bond in the Budget window.',
        kind: 'bad',
      });
      sim.events.emit('news', { text: `${c.name} treasury runs dry — services at risk`, kind: 'bad' });
    }
  } else {
    c.debtMonths = 0;
  }
  sim.events.emit('funds', c.funds);
}
