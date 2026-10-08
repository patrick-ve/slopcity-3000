import { Emitter } from '../util/events';
import { Rng } from '../util/rng';
import { dayToDate, MONTH_DAYS } from '../util/format';
import { World } from './world';
import {
  DAY_MS,
  DEPARTMENTS,
  START_FUNDS,
  type Building,
  type Department,
  type Difficulty,
  type HistoryPoint,
  type Loan,
  type MonthlyReport,
  type ScenarioState,
  type Speed,
  type Tax,
} from './types';
import { PLOPPABLES } from './catalog';
import { updatePower, updateRoadAccess, updateTransitLinks, updateWater } from './networks';
import { emptyAccess, updateTraffic, type AccessData } from './traffic';
import { updateCoverage, updateCrime, updateLandValue, updatePollution, updateStaticLand } from './fields';
import { emptyStats, updateDemand, updateStats, type CityStats } from './demand';
import { constructionDay, growthDay, occupancyMonth } from './growth';
import { runMonthlyBudget } from './budget';
import { updateGarbage } from './garbage';
import { Disasters } from './disasters';
import { NewsDesk } from './news';

export interface CityState {
  name: string;
  mayor: string;
  startYear: number;
  difficulty: Difficulty;
  /** Days since Jan 1 of startYear. */
  day: number;
  funds: number;
  tax: Tax;
  /** Funding level per department (0..1.2, 1 = 100%). */
  funding: Record<Department, number>;
  ordinances: Record<string, boolean>;
  loans: Loan[];
  nextLoanId: number;
  deals: { power: boolean; water: boolean; garbage: boolean };
  history: HistoryPoint[];
  lastReport: MonthlyReport | null;
  /** Reward/deal building ids unlocked so far. */
  unlocked: string[];
  /** Population milestones already announced. */
  milestones: number[];
  /** Smoothed demand -1..1. */
  demand: { r: number; c: number; i: number };
  /** City-wide education quotient (0..150) and life expectancy (years). */
  eq: number;
  le: number;
  garbageBacklog: number;
  disastersEnabled: boolean;
  /** Months the treasury has been negative. */
  debtMonths: number;
  /** Random seed for the map (kept for saves). */
  seed: number;
  /** Sandbox mode: unlimited money and every building unlocked. */
  sandbox: boolean;
  /** The scenario being played, or null in a free game. */
  scenario: ScenarioState | null;
}

export interface SimMessage {
  title: string;
  text: string;
  kind: 'info' | 'good' | 'warn' | 'bad';
  x?: number;
  y?: number;
}

export interface SimEvents extends Record<string, unknown> {
  news: { text: string; kind?: 'info' | 'good' | 'bad' };
  message: SimMessage;
  month: void;
  day: void;
  funds: number;
  building: { type: 'add' | 'remove' | 'complete' | 'destroyed'; b: Building };
  sound: string;
  shake: number;
  unlock: string;
}

export interface NewCityOptions {
  name: string;
  mayor: string;
  startYear: number;
  difficulty: Difficulty;
  seed: number;
}

export class Sim {
  world: World;
  city: CityState;
  stats: CityStats = emptyStats();
  rng: Rng;
  events = new Emitter<SimEvents>();
  speed: Speed = 0;
  disasters: Disasters;
  news: NewsDesk;
  /** Flags requesting recomputation of derived data. */
  dirty = { roads: true, power: true, water: true, coverage: true, land: true };
  private acc = 0;
  /** Real-time seconds of game time elapsed (drives disasters, animation). */
  gameTime = 0;
  /** Road-network commute distances (see traffic.ts). */
  access: AccessData;
  /** Tons of garbage exported to neighbours last month. */
  garbageExported = 0;
  /** Development budget per zone kind (residents/jobs that may still be added). */
  growthBudget = [0, 0, 0, 0, 0];
  /** Ids of subway stations that share a line with another station. */
  subwayLinked = new Set<number>();
  /** 1 for subway tiles on a line with two or more stations. */
  subwayLive = new Uint8Array(0);

  constructor(world: World, opts: NewCityOptions) {
    this.world = world;
    this.access = emptyAccess(world.size);
    this.rng = new Rng(opts.seed ^ 0xa5a5a5a5);
    const funding = {} as Record<Department, number>;
    for (const d of DEPARTMENTS) funding[d] = 1;
    this.city = {
      name: opts.name,
      mayor: opts.mayor,
      startYear: opts.startYear,
      difficulty: opts.difficulty,
      day: 0,
      funds: START_FUNDS[opts.difficulty],
      tax: { R: 7, C: 7, I: 7 },
      funding,
      ordinances: {},
      loans: [],
      nextLoanId: 1,
      deals: { power: false, water: false, garbage: false },
      history: [],
      lastReport: null,
      unlocked: [],
      milestones: [],
      demand: { r: 0.6, c: 0.2, i: 0.5 },
      eq: 60,
      le: 62,
      garbageBacklog: 0,
      disastersEnabled: true,
      debtMonths: 0,
      seed: opts.seed,
      sandbox: false,
      scenario: null,
    };
    this.disasters = new Disasters(this);
    this.news = new NewsDesk(this);
    updateStaticLand(this);
    this.recompute(true);
  }

  // ------------------------------------------------------------------ time

  get year(): number {
    return this.city.startYear + Math.floor(this.city.day / 365);
  }

  get date() {
    return dayToDate(this.city.day, this.city.startYear);
  }

  get monthIndex(): number {
    return Math.floor(this.city.day / 365) * 12 + this.date.month;
  }

  setSpeed(s: Speed): void {
    this.speed = s;
  }

  /** Advance the simulation by real elapsed milliseconds. */
  update(dtMs: number): void {
    // Keep derived data fresh even while paused (immediate feedback for tools).
    this.recompute(false);
    if (this.speed === 0) return;
    const dayMs = DAY_MS[this.speed];
    this.gameTime += dtMs / 1000;
    this.disasters.update(dtMs / 1000);
    this.acc += dtMs;
    let steps = 0;
    while (this.acc >= dayMs && steps < 8) {
      this.acc -= dayMs;
      this.stepDay();
      steps++;
    }
    if (steps >= 8) this.acc = 0;
  }

  /** Recompute dirty derived data (roads, networks, coverage). */
  recompute(force: boolean): void {
    const d = this.dirty;
    const any = d.roads || d.power || d.water || d.coverage || d.land;
    if (force || d.roads) {
      updateRoadAccess(this);
      updateTransitLinks(this);
      d.roads = false;
      d.coverage = true;
      d.power = true;
      d.water = true;
    }
    if (force || d.power) {
      updatePower(this);
      d.power = false;
      d.water = true;
    }
    if (force || d.water) {
      updateWater(this);
      d.water = false;
    }
    if (force || d.coverage) {
      updateCoverage(this);
      d.coverage = false;
    }
    if (force || d.land) {
      updateStaticLand(this);
      d.land = false;
    }
    if (force) {
      updateStats(this);
      updatePollution(this);
      updateLandValue(this);
      updateCrime(this);
    } else if (any) {
      updateStats(this);
    }
  }

  stepDay(): void {
    const prev = this.date;
    this.city.day++;
    const now = this.date;
    constructionDay(this);
    growthDay(this);
    this.disasters.day();
    updateStats(this);
    updateDemand(this, 0.06);
    if (now.month !== prev.month) this.stepMonth();
    this.events.emit('day', undefined);
  }

  private stepMonth(): void {
    // refresh networks every month (fires and disasters change them too)
    this.dirty.roads = true;
    this.dirty.power = true;
    this.dirty.water = true;
    this.recompute(false);
    updateTraffic(this);
    updatePollution(this);
    updateLandValue(this);
    updateCrime(this);
    occupancyMonth(this);
    updateGarbage(this);
    updateStats(this);
    this.updateEducationHealth();
    runMonthlyBudget(this);
    this.recordHistory();
    this.checkMilestones();
    this.disasters.month();
    this.news.month();
    if (this.date.month === 0) this.news.year();
    this.events.emit('month', undefined);
  }

  // ------------------------------------------------------------- finances

  canAfford(cost: number): boolean {
    return this.city.sandbox || cost <= 0 || this.city.funds >= cost;
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    // sandbox mode: money is unlimited
    if (this.city.sandbox) return true;
    this.city.funds -= cost;
    this.events.emit('funds', this.city.funds);
    return true;
  }

  takeLoan(amount: number): Loan | null {
    if (this.city.sandbox || this.city.loans.length >= 5) return null;
    const rate = 0.05 + this.city.loans.length * 0.01;
    const months = 120;
    const mr = rate / 12;
    const payment = (amount * mr) / (1 - Math.pow(1 + mr, -months));
    const loan: Loan = { id: this.city.nextLoanId++, principal: amount, remaining: payment * months, payment, rate };
    this.city.loans.push(loan);
    this.city.funds += amount;
    this.events.emit('funds', this.city.funds);
    this.events.emit('message', {
      title: 'Bond issued',
      text: `You borrowed §${amount.toLocaleString('en-US')} at ${(rate * 100).toFixed(1)}% interest.`,
      kind: 'info',
    });
    return loan;
  }

  repayLoan(id: number): boolean {
    const loan = this.city.loans.find((l) => l.id === id);
    if (!loan) return false;
    if (!this.spend(Math.ceil(loan.remaining))) return false;
    this.city.loans = this.city.loans.filter((l) => l.id !== id);
    return true;
  }

  // ------------------------------------------------------- city progress

  private updateEducationHealth(): void {
    const s = this.stats;
    const ord = this.city.ordinances;
    const eqTarget = 35 + s.eduCover * 95 + (ord.pro_reading ? 12 : 0);
    this.city.eq += (eqTarget - this.city.eq) * 0.04;
    const pollPenalty = s.resPollution * 18;
    const garbagePenalty = Math.min(8, this.city.garbageBacklog / 400);
    const leTarget = 55 + s.healthCover * 28 + (ord.free_clinics ? 4 : 0) + (ord.smoking_ban ? 2 : 0) - pollPenalty - garbagePenalty;
    this.city.le += (leTarget - this.city.le) * 0.05;
  }

  private recordHistory(): void {
    const s = this.stats;
    const rep = this.city.lastReport;
    const income = rep ? Object.values(rep.income).reduce((a, b) => a + b, 0) : 0;
    const p: HistoryPoint = {
      m: this.monthIndex,
      pop: s.residents,
      res: s.residents,
      com: s.comJobs,
      ind: s.indJobs,
      funds: this.city.funds,
      income,
      expense: rep ? income - rep.total : 0,
      pollution: s.avgPollution,
      crime: s.avgCrime,
      landValue: s.avgLandValue,
      traffic: s.avgTraffic,
      eq: this.city.eq,
      le: this.city.le,
      power: s.powerDemand,
      powerCap: s.powerSupply,
      water: s.waterDemand,
      waterCap: s.waterSupply,
    };
    this.city.history.push(p);
    if (this.city.history.length > 12 * 200) this.city.history.shift();
  }

  private checkMilestones(): void {
    const pop = this.stats.residents;
    const steps: [number, string][] = [
      [500, 'Your settlement has grown into a village!'],
      [2000, 'Your village is now a town!'],
      [10000, 'Congratulations — your town has become a city!'],
      [50000, 'Your city is now a capital!'],
      [100000, 'A metropolis! The whole region is watching.'],
      [250000, 'Megalopolis! Your name will go down in history.'],
    ];
    for (const [threshold, text] of steps) {
      if (pop >= threshold && !this.city.milestones.includes(threshold)) {
        this.city.milestones.push(threshold);
        this.events.emit('message', { title: 'Milestone', text: `${text} Population ${pop.toLocaleString('en-US')}.`, kind: 'good' });
        this.events.emit('news', { text: `${this.city.name} passes ${threshold.toLocaleString('en-US')} residents!`, kind: 'good' });
        this.events.emit('sound', 'fanfare');
      }
    }
    for (const def of PLOPPABLES) {
      if (def.reward && pop >= def.reward && !this.city.unlocked.includes(def.id) && (!def.year || this.year >= def.year)) {
        this.city.unlocked.push(def.id);
        const deal = (def.upkeep ?? 0) < 0;
        this.events.emit('message', {
          title: deal ? 'Business proposal' : 'Reward unlocked',
          text: deal
            ? `A company offers to build a ${def.name} in ${this.city.name}. ${def.desc ?? ''} Find it under Rewards & Deals.`
            : `Your citizens offer to build a ${def.name}! Find it under Rewards & Deals.`,
          kind: 'good',
        });
        this.events.emit('unlock', def.id);
      }
    }
  }

  // --------------------------------------------------------------- helpers

  /** Days in the current month. */
  get monthDays(): number {
    return MONTH_DAYS[this.date.month];
  }

  /** Effective funding multiplier for a department (diminishing above 100%). */
  fundingEffect(dept: Department): number {
    const f = this.city.funding[dept];
    return f <= 1 ? f : 1 + (f - 1) * 0.5;
  }

  message(m: SimMessage): void {
    this.events.emit('message', m);
  }
}
