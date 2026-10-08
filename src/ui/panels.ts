import { h, clear } from '../util/dom';
import { money, int } from '../util/format';
import { DEPARTMENTS, DEPARTMENT_NAMES, DENSITY_NAMES, NET, WEALTH_NAMES, ZONE_NAMES, type Department } from '../sim/types';
import { getDef } from '../sim/catalog';
import { computeBudget, DEAL_COSTS } from '../sim/budget';
import { ORDINANCES, ORDINANCE_CATEGORY_NAMES, ordinanceMonthly, type OrdinanceCategory } from '../sim/ordinances';
import { ADVISORS, getAdvice } from '../sim/advisors';
import { desirability } from '../sim/growth';
import { EXPORT_LIMIT, LANDFILL_CAPACITY } from '../sim/garbage';
import { powerUseOf, waterUseOf, needsWater, needsPower } from '../sim/util';
import { plantOutput } from '../sim/networks';
import { listSaves, deleteSlot, type SaveSlot } from '../sim/save';
import type { HistoryPoint } from '../sim/types';
import type { Game } from '../game/game';
import { UIWindow } from './window';
import { icon } from './icons';

export interface Panel {
  win: UIWindow;
  refresh(): void;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${money(n)}`;
}

// ===================================================================== budget

export class BudgetPanel implements Panel {
  win: UIWindow;
  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'budget', 'Budget', 'budget', 600);
  }

  refresh(): void {
    const sim = this.game.sim;
    if (!sim || !this.win.open) return;
    const c = sim.city;
    const rep = computeBudget(sim);
    const b = this.win.body;
    const scroll = b.scrollTop;
    clear(b);
    const head = h(
      'div',
      { class: 'kv', style: 'margin-bottom:6px' },
      h('div', { class: 'k' }, 'Treasury'),
      h('div', { class: `v ${c.funds < 0 ? 'neg' : ''}` }, money(c.funds)),
      h('div', { class: 'k' }, 'Monthly cash flow'),
      h('div', { class: 'v', style: `color:${rep.total >= 0 ? 'var(--good)' : 'var(--bad)'}` }, signed(rep.total)),
      h('div', { class: 'k' }, 'Projected for the year'),
      h('div', { class: 'v' }, signed(rep.total * 12)),
    );
    b.appendChild(head);

    b.appendChild(h('div', { class: 'section-title' }, 'Income'));
    const taxRow = (key: 'R' | 'C' | 'I', label: string, color: string, revenue: number) => {
      const val = h('span', { class: 'v num', style: 'width:42px;text-align:right' }, `${c.tax[key]}%`);
      const slider = h('input', {
        type: 'range',
        min: 0,
        max: 20,
        step: 1,
        value: String(c.tax[key]),
        oninput: (e: Event) => {
          c.tax[key] = Number((e.target as HTMLInputElement).value);
          val.textContent = `${c.tax[key]}%`;
        },
        onchange: () => this.refresh(),
      });
      return h(
        'div',
        { class: 'row' },
        h('span', { style: `width:10px;height:10px;border-radius:3px;background:${color}` }),
        h('span', { class: 'k', style: 'flex:0 0 150px' }, label),
        slider,
        val,
        h('span', { class: 'v num pos', style: 'width:80px;text-align:right' }, money(revenue)),
      );
    };
    b.appendChild(taxRow('R', 'Residential tax', 'var(--r)', rep.income.resTax));
    b.appendChild(taxRow('C', 'Commercial tax', 'var(--c)', rep.income.comTax));
    b.appendChild(taxRow('I', 'Industrial tax', 'var(--i)', rep.income.indTax));
    if (rep.income.ordinances) b.appendChild(this.line('Ordinances', rep.income.ordinances, true));
    if (rep.income.deals) b.appendChild(this.line('Business deals', rep.income.deals, true));

    b.appendChild(h('div', { class: 'section-title' }, 'Expenses'));
    for (const d of DEPARTMENTS) b.appendChild(this.fundRow(d, rep.expense.departments[d]));
    b.appendChild(this.line('Utilities (plants, pumps, garbage)', -rep.expense.utilities));
    if (rep.expense.ordinances) b.appendChild(this.line('Ordinances', -rep.expense.ordinances));
    if (rep.expense.deals) b.appendChild(this.line('Neighbour deals', -rep.expense.deals));
    if (rep.expense.loans) b.appendChild(this.line('Bond payments', -rep.expense.loans));

    b.appendChild(h('div', { class: 'section-title' }, 'Bonds'));
    if (!c.loans.length) b.appendChild(h('div', { class: 'note' }, 'No outstanding bonds. Bonds give you cash now and are repaid over 10 years with interest.'));
    for (const l of c.loans) {
      b.appendChild(
        h(
          'div',
          { class: 'row' },
          h('span', { class: 'k' }, `${money(l.principal)} at ${(l.rate * 100).toFixed(1)}% — ${money(l.payment)}/mo, ${money(l.remaining)} left`),
          h('button', {
            class: 'btn small',
            disabled: c.funds < l.remaining,
            onclick: () => {
              if (sim.repayLoan(l.id)) this.game.sfx.play('cash');
              this.refresh();
            },
          }, 'Repay'),
        ),
      );
    }
    const issue = h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' });
    for (const amt of [5000, 10000, 25000]) {
      issue.appendChild(
        h('button', {
          class: 'btn small',
          disabled: c.loans.length >= 5,
          onclick: () => {
            if (sim.takeLoan(amt)) this.game.sfx.play('cash');
            this.refresh();
          },
        }, `Issue ${money(amt)} bond`),
      );
    }
    b.appendChild(issue);
    b.scrollTop = scroll;
  }

  private line(label: string, amount: number, income = false): HTMLElement {
    return h(
      'div',
      { class: 'row' },
      h('span', { class: 'k' }, label),
      h('span', { class: `v num ${income ? 'pos' : amount < 0 ? 'neg' : ''}` }, income ? money(amount) : signed(amount)),
    );
  }

  private fundRow(d: Department, cost: number): HTMLElement {
    const c = this.game.sim!.city;
    const val = h('span', { class: 'v num', style: 'width:42px;text-align:right' }, pct(c.funding[d]));
    const slider = h('input', {
      type: 'range',
      min: 0,
      max: 120,
      step: 5,
      value: String(Math.round(c.funding[d] * 100)),
      oninput: (e: Event) => {
        c.funding[d] = Number((e.target as HTMLInputElement).value) / 100;
        val.textContent = pct(c.funding[d]);
        this.game.sim!.dirty.coverage = true;
      },
      onchange: () => this.refresh(),
    });
    return h(
      'div',
      { class: 'row' },
      h('span', { class: 'k', style: 'flex:0 0 160px' }, DEPARTMENT_NAMES[d]),
      slider,
      val,
      h('span', { class: 'v num neg', style: 'width:80px;text-align:right' }, money(-cost)),
    );
  }
}

// ================================================================ ordinances

export class OrdinancesPanel implements Panel {
  win: UIWindow;
  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'ordinances', 'Ordinances', 'ordinances', 540);
  }

  refresh(): void {
    const sim = this.game.sim;
    if (!sim || !this.win.open) return;
    const b = this.win.body;
    const scroll = b.scrollTop;
    clear(b);
    const pop = sim.stats.residents;
    let total = 0;
    for (const o of ORDINANCES) if (sim.city.ordinances[o.id]) total -= ordinanceMonthly(o, pop);
    b.appendChild(
      h('div', { class: 'row' }, h('span', { class: 'k' }, 'Net monthly effect of active ordinances'), h('span', { class: `v num ${total >= 0 ? 'pos' : 'neg'}` }, signed(total))),
    );
    const cats = [...new Set(ORDINANCES.map((o) => o.category))] as OrdinanceCategory[];
    for (const cat of cats) {
      b.appendChild(h('div', { class: 'section-title' }, ORDINANCE_CATEGORY_NAMES[cat]));
      for (const o of ORDINANCES.filter((x) => x.category === cat)) {
        const locked = (o.minPop ?? 0) > pop;
        const amt = -ordinanceMonthly(o, pop);
        const cb = h('input', {
          type: 'checkbox',
          checked: !!sim.city.ordinances[o.id],
          disabled: locked,
          onchange: (e: Event) => {
            sim.city.ordinances[o.id] = (e.target as HTMLInputElement).checked;
            sim.dirty.power = true;
            sim.dirty.coverage = true;
            this.game.sfx.play('click');
            this.refresh();
          },
        });
        b.appendChild(
          h(
            'label',
            { class: `check ${locked ? 'locked' : ''}` },
            cb,
            h('div', {}, h('div', { class: 't' }, o.name), h('div', { class: 'd' }, locked ? `Available at ${int(o.minPop ?? 0)} residents` : o.desc)),
            h('div', { class: 'amt', style: `color:${amt >= 0 ? 'var(--good)' : 'var(--muted)'}` }, `${signed(amt)}/mo`),
          ),
        );
      }
    }
    b.scrollTop = scroll;
  }
}

// ==================================================================== graphs

interface Series {
  key: string;
  name: string;
  color: string;
  get: (p: HistoryPoint) => number;
  fmt?: (v: number) => string;
}

const SERIES: Series[] = [
  { key: 'pop', name: 'Population', color: '#f2f4f7', get: (p) => p.pop },
  { key: 'res', name: 'Residents', color: '#63d471', get: (p) => p.res },
  { key: 'com', name: 'Commercial jobs', color: '#5aa9ff', get: (p) => p.com },
  { key: 'ind', name: 'Industrial jobs', color: '#ffc94d', get: (p) => p.ind },
  { key: 'funds', name: 'Treasury', color: '#5fd38d', get: (p) => p.funds, fmt: money },
  { key: 'cash', name: 'Monthly cash flow', color: '#e86a92', get: (p) => p.income - p.expense, fmt: money },
  { key: 'pollution', name: 'Pollution', color: '#c08a3e', get: (p) => p.pollution * 100, fmt: (v) => `${v.toFixed(0)}%` },
  { key: 'crime', name: 'Crime', color: '#e05a4c', get: (p) => p.crime * 100, fmt: (v) => `${v.toFixed(0)}%` },
  { key: 'landValue', name: 'Land value', color: '#27ae60', get: (p) => p.landValue * 100, fmt: (v) => `${v.toFixed(0)}%` },
  { key: 'traffic', name: 'Traffic', color: '#9b59b6', get: (p) => p.traffic * 100, fmt: (v) => `${v.toFixed(0)}%` },
  { key: 'eq', name: 'Education (EQ)', color: '#b38cf2', get: (p) => p.eq, fmt: (v) => v.toFixed(0) },
  { key: 'le', name: 'Life expectancy', color: '#ff9ab0', get: (p) => p.le, fmt: (v) => v.toFixed(0) },
  { key: 'power', name: 'Power use', color: '#fde047', get: (p) => p.power, fmt: (v) => `${v.toFixed(0)} MW` },
  { key: 'water', name: 'Water use', color: '#38bdf8', get: (p) => p.water, fmt: (v) => `${v.toFixed(0)} kL` },
];

export class GraphsPanel implements Panel {
  win: UIWindow;
  private selected = new Set(['pop', 'com', 'ind']);
  private range = 120;
  private canvas: HTMLCanvasElement;

  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'graphs', 'City Statistics', 'graphs', 660);
    this.canvas = h('canvas', { class: 'graph-canvas' }) as HTMLCanvasElement;
  }

  refresh(): void {
    const sim = this.game.sim;
    if (!sim || !this.win.open) return;
    const b = this.win.body;
    clear(b);
    const s = sim.stats;
    const c = sim.city;
    const kv = h('div', { class: 'kv', style: 'grid-template-columns: 1fr auto 1fr auto; margin-bottom: 10px' });
    const add = (k: string, v: string) => kv.append(h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
    add('Population', int(s.residents));
    add('Jobs', int(s.comJobs + s.indJobs));
    add('Unemployment', pct(s.unemployment));
    add('Education (EQ)', c.eq.toFixed(0));
    add('Life expectancy', `${c.le.toFixed(0)} yrs`);
    add('Avg. land value', pct(s.avgLandValue));
    add('Power', `${int(s.powerDemand)} / ${int(s.powerSupply)} MW`);
    add('Water', `${int(s.waterDemand)} / ${int(s.waterSupply)} kL`);
    add('Garbage', `${int(s.garbageHandled)} / ${int(s.garbageProduced + c.garbageBacklog)} t`);
    add('Buildings', `${int(s.buildings)} (${s.abandoned} abandoned)`);
    b.appendChild(kv);
    const tabs = h('div', { class: 'tabs' });
    for (const [label, months] of [
      ['1 year', 12],
      ['10 years', 120],
      ['50 years', 600],
      ['All', 100000],
    ] as [string, number][]) {
      tabs.appendChild(
        h('button', {
          class: `tab ${this.range === months ? 'on' : ''}`,
          onclick: () => {
            this.range = months;
            this.refresh();
          },
        }, label),
      );
    }
    b.appendChild(tabs);
    b.appendChild(this.canvas);
    const ser = h('div', { class: 'series' });
    for (const sr of SERIES) {
      ser.appendChild(
        h('button', {
          class: `tab ${this.selected.has(sr.key) ? 'on' : ''}`,
          onclick: () => {
            if (this.selected.has(sr.key)) this.selected.delete(sr.key);
            else this.selected.add(sr.key);
            this.refresh();
          },
        }, h('span', { class: 'dot', style: `background:${sr.color}` }), sr.name),
      );
    }
    b.appendChild(ser);
    requestAnimationFrame(() => this.draw());
  }

  private draw(): void {
    const sim = this.game.sim;
    if (!sim) return;
    const cv = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 600;
    const H = cv.clientHeight || 240;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const g = cv.getContext('2d')!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    const hist = sim.city.history.slice(-this.range);
    const pad = { l: 12, r: 12, t: 14, b: 22 };
    g.font = '11px system-ui, sans-serif';
    if (hist.length < 2) {
      g.fillStyle = '#98a4b4';
      g.fillText('Graphs appear after the first two months.', pad.l + 4, H / 2);
      return;
    }
    const n = hist.length;
    const xOf = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
    // grid + year labels
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const y = pad.t + (k / 4) * (H - pad.t - pad.b);
      g.beginPath();
      g.moveTo(pad.l, y);
      g.lineTo(W - pad.r, y);
      g.stroke();
    }
    g.fillStyle = '#6c7889';
    const step = Math.max(1, Math.ceil(n / 8 / 12)) * 12;
    for (let i = 0; i < n; i++) {
      const m = hist[i].m;
      if (m % step === 0) {
        const year = sim.city.startYear + Math.floor(m / 12);
        g.fillText(String(year), xOf(i) - 12, H - 6);
      }
    }
    // each series normalised to its own range
    let labelY = pad.t + 2;
    for (const sr of SERIES) {
      if (!this.selected.has(sr.key)) continue;
      const vals = hist.map(sr.get);
      let lo = Math.min(...vals);
      let hi = Math.max(...vals);
      if (lo > 0 && sr.key !== 'funds' && sr.key !== 'cash') lo = 0;
      if (hi - lo < 1e-6) hi = lo + 1;
      const yOf = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
      g.strokeStyle = sr.color;
      g.lineWidth = 2;
      g.beginPath();
      vals.forEach((v, i) => (i ? g.lineTo(xOf(i), yOf(v)) : g.moveTo(xOf(i), yOf(v))));
      g.stroke();
      const last = vals[vals.length - 1];
      g.fillStyle = sr.color;
      const txt = `${sr.name}: ${(sr.fmt ?? int)(last)}`;
      g.fillText(txt, W - pad.r - g.measureText(txt).width, labelY + 10);
      labelY += 14;
    }
  }
}

// ================================================================== advisors

export class AdvisorsPanel implements Panel {
  win: UIWindow;
  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'advisors', 'Advisors', 'advisors', 680);
  }

  refresh(): void {
    const sim = this.game.sim;
    if (!sim || !this.win.open) return;
    const b = this.win.body;
    clear(b);
    const advice = getAdvice(sim);
    const grid = h('div', { class: 'advisors' });
    for (const a of ADVISORS) {
      const mine = advice.filter((x) => x.advisor === a.id).slice(0, 3);
      grid.appendChild(
        h(
          'div',
          { class: 'advisor' },
          h(
            'div',
            { class: 'who' },
            h('div', { class: 'face', style: `background:${a.color}33;border:1px solid ${a.color}88` }, a.face),
            h('div', {}, h('div', { class: 'nm' }, a.name), h('div', { class: 'ti' }, a.title)),
          ),
          ...mine.map((m) => h('div', { class: `msg s${m.severity}` }, m.text)),
        ),
      );
    }
    b.appendChild(grid);
  }
}

// ================================================================= neighbours

export class NeighborsPanel implements Panel {
  win: UIWindow;
  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'neighbors', 'Neighbours', 'neighbors', 460);
  }

  refresh(): void {
    const sim = this.game.sim;
    if (!sim || !this.win.open) return;
    const b = this.win.body;
    clear(b);
    const con = sim.stats.connections;
    b.appendChild(h('div', { class: 'section-title' }, 'Connections at the map edge'));
    const kv = h('div', { class: 'kv' });
    for (const [k, v] of [
      ['Roads', con.road],
      ['Rail lines', con.rail],
      ['Power lines', con.power],
      ['Water pipes', con.pipe],
    ] as [string, number][]) {
      kv.append(h('div', { class: 'k' }, k), h('div', { class: 'v' }, v ? h('span', { class: 'pill good' }, `${v} connected`) : h('span', { class: 'pill' }, 'none')));
    }
    b.appendChild(kv);
    b.appendChild(h('div', { class: 'note', style: 'margin-top:8px' }, 'Road and rail connections bring commuters and trade, and raise demand.'));
    b.appendChild(h('div', { class: 'section-title' }, 'Deals'));
    const deals = sim.city.deals;
    const deal = (key: 'power' | 'water' | 'garbage', title: string, desc: string, cost: string, needs: boolean, why: string) => {
      const cb = h('input', {
        type: 'checkbox',
        checked: deals[key],
        disabled: !needs && !deals[key],
        onchange: (e: Event) => {
          deals[key] = (e.target as HTMLInputElement).checked;
          sim.dirty.power = true;
          sim.dirty.water = true;
          this.game.sfx.play('cash');
          this.refresh();
        },
      });
      b.appendChild(
        h('label', { class: `check ${!needs && !deals[key] ? 'locked' : ''}` }, cb, h('div', {}, h('div', { class: 't' }, title), h('div', { class: 'd' }, needs ? desc : why)), h('div', { class: 'amt' }, cost)),
      );
    };
    deal('power', 'Buy power', 'A neighbour supplies 1,000 MW through a power line at the map edge.', `${money(-DEAL_COSTS.power)}/mo`, con.power > 0, 'Needs a power line to the map edge.');
    deal('water', 'Buy water', 'A neighbour supplies 4,000 kL through a pipe at the map edge.', `${money(-DEAL_COSTS.water)}/mo`, con.pipe > 0, 'Needs a water pipe to the map edge.');
    deal('garbage', 'Export garbage', `Ship up to ${int(EXPORT_LIMIT)} tons a month to a neighbour by road.`, `§${DEAL_COSTS.garbagePerTon}/ton`, con.road > 0, 'Needs a road to the map edge.');
  }
}

// ================================================================= disasters

export class DisastersPanel implements Panel {
  win: UIWindow;
  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'disasters', 'Disasters', 'disasters', 360);
  }

  refresh(): void {
    const sim = this.game.sim;
    if (!sim || !this.win.open) return;
    const b = this.win.body;
    clear(b);
    b.appendChild(h('div', { class: 'note', style: 'margin-bottom:10px' }, 'Unleash disaster on your city. For science.'));
    const grid = h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' });
    for (const [kind, label, ic] of [
      ['fire', 'Fire', 'fire'],
      ['tornado', 'Tornado', 'tornado'],
      ['earthquake', 'Earthquake', 'quake'],
      ['meteor', 'Meteor', 'meteor'],
    ] as const) {
      grid.appendChild(
        h('button', {
          class: 'btn',
          html: `${icon(ic, 16)}<span>${label}</span>`,
          onclick: () => {
            const t = this.game.renderer.cam.target;
            sim.disasters.trigger(kind, Math.floor(t.x), Math.floor(t.z));
            this.win.close();
          },
        }),
      );
    }
    b.appendChild(grid);
    b.appendChild(h('div', { class: 'note', style: 'margin:10px 0 4px' }, 'Disasters strike near the centre of the view.'));
    b.appendChild(
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: sim.city.disastersEnabled,
          onchange: (e: Event) => (sim.city.disastersEnabled = (e.target as HTMLInputElement).checked),
        }),
        h('div', {}, h('div', { class: 't' }, 'Random disasters'), h('div', { class: 'd' }, 'Fires and rare catastrophes happen on their own.')),
      ),
    );
  }
}

// ===================================================================== query

export class QueryPanel implements Panel {
  win: UIWindow;
  tx = 0;
  ty = 0;
  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'query', 'Query', 'query', 340);
  }

  at(tx: number, ty: number, sx?: number, sy?: number): void {
    this.tx = tx;
    this.ty = ty;
    const fresh = this.win.show();
    this.refresh();
    if (fresh) {
      if (sx !== undefined && sy !== undefined) this.win.placeNear(sx, sy);
      else this.win.place();
    }
  }

  refresh(): void {
    const sim = this.game.sim;
    if (!sim || !this.win.open) return;
    const w = sim.world;
    const { tx, ty } = this;
    if (!w.inBounds(tx, ty)) return;
    const i = w.idx(tx, ty);
    const b = this.win.body;
    clear(b);
    const kv = h('div', { class: 'kv' });
    const add = (k: string, v: string | HTMLElement) => kv.append(h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
    const bld = w.buildingAt(tx, ty);
    if (bld) {
      const def = getDef(bld.def);
      this.win.setTitle(def.name);
      const status: HTMLElement[] = [];
      if (bld.build > 0) status.push(h('span', { class: 'pill warn' }, `Under construction (${bld.build} days)`));
      if (bld.abandoned) status.push(h('span', { class: 'pill bad' }, 'Abandoned'));
      if (bld.fire > 0) status.push(h('span', { class: 'pill bad' }, 'On fire!'));
      if (needsPower(def) && bld.build <= 0) status.push(h('span', { class: `pill ${bld.powered ? 'good' : 'bad'}` }, bld.powered ? 'Powered' : 'No power'));
      if (needsWater(def) && bld.build <= 0) status.push(h('span', { class: `pill ${bld.watered ? 'good' : 'bad'}` }, bld.watered ? 'Water' : 'No water'));
      b.appendChild(h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px' }, ...status));
      if (def.desc) b.appendChild(h('div', { class: 'note', style: 'margin-bottom:8px' }, def.desc));
      if (def.growable) {
        add('Zone', `${DENSITY_NAMES[def.density ?? 1]} ${ZONE_NAMES[def.zone ?? 0]}`);
        add('Wealth', def.zone === 3 ? ['Heavy industry', 'Manufacturing', 'High-tech'][def.wealth ?? 0] : WEALTH_NAMES[def.wealth ?? 0]);
        add(def.zone === 1 ? 'Residents' : 'Jobs', `${int(bld.pop)} / ${int(def.cap ?? 0)}`);
        add('Desirability', pct((desirability(sim, def.zone ?? 1, i) + 1) / 2));
      } else {
        if (def.residents) add('Residents', `${int(bld.pop)} / ${int(def.residents)}`);
        if (def.power) add('Power output', `${int(plantOutput(sim, bld))} MW`);
        if (def.water) add('Water output', `${int(def.water)} kL`);
        if (def.burn) add('Burns garbage', `${int(def.burn)} t/month`);
        if (def.service) add('Coverage radius', `${def.service.radius} tiles`);
        if (def.upkeep) add(def.upkeep < 0 ? 'Income' : 'Upkeep', `${money(Math.abs(def.upkeep))}/month`);
      }
      const pu = powerUseOf(bld, def);
      if (pu > 0) add('Power use', `${pu.toFixed(1)} MW`);
      const wu = waterUseOf(bld, def);
      if (wu > 0) add('Water use', `${wu.toFixed(0)} kL`);
      add('Age', bld.age >= 12 ? `${Math.floor(bld.age / 12)} years` : `${bld.age} months`);
    } else {
      const z = w.zone[i];
      const n = w.net[i];
      const parts: string[] = [];
      if (n & NET.ROAD) parts.push(w.isWater(tx, ty) ? 'Bridge' : 'Road');
      if (n & NET.RAIL) parts.push('Rail');
      if (n & NET.POWER) parts.push('Power line');
      if (n & NET.PIPE) parts.push('Water pipe');
      this.win.setTitle(parts.length ? parts.join(' + ') : z ? `${DENSITY_NAMES[w.density[i]] ?? ''} ${ZONE_NAMES[z]}`.trim() : w.isWater(tx, ty) ? 'Water' : 'Open land');
      if (z) add('Zone', z === 4 ? 'Landfill' : `${DENSITY_NAMES[w.density[i]]} ${ZONE_NAMES[z]}`);
      if (z === 4) add('Landfill', `${int(w.landfill[i])} / ${int(LANDFILL_CAPACITY)} t`);
      if (z >= 1 && z <= 3) {
        add('Desirability', pct((desirability(sim, z, i) + 1) / 2));
        add('Powered', w.powered[i] ? 'Yes' : 'No');
        add('Road access', w.roadDist[i] <= 3 ? 'Yes' : 'No (needs a road within 3 tiles)');
      }
      if (n & NET.ROAD) add('Traffic', pct(Math.min(1.5, w.traffic[i])));
      if (w.tree[i]) add('Trees', ['', 'Some', 'Many', 'Forest'][w.tree[i]]);
      if (w.rubble[i]) add('Rubble', 'Bulldoze to clear');
    }
    add('Land value', pct(w.landValue[i]));
    add('Pollution', pct(w.pollution[i]));
    add('Crime', pct(w.crime[i]));
    add('Elevation', `${Math.max(0, w.tileMax(tx, ty) - w.seaLevel) * 4} m`);
    add('Coverage', `Police ${pct(w.cover.police[i])} · Fire ${pct(w.cover.fire[i])}`);
    add('', `Health ${pct(w.cover.health[i])} · School ${pct(w.cover.education[i])}`);
    b.appendChild(kv);
    b.appendChild(h('div', { class: 'note', style: 'margin-top:8px' }, `Tile ${tx}, ${ty}`));
  }
}

// ================================================================ save / load

export class SavePanel implements Panel {
  win: UIWindow;
  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'save', 'Save & Load', 'save', 480);
  }

  refresh(): void {
    if (!this.win.open) return;
    const sim = this.game.sim;
    const b = this.win.body;
    clear(b);
    if (sim) {
      const name = h('input', { type: 'text', value: sim.city.name, maxLength: 32 }) as HTMLInputElement;
      b.appendChild(h('div', { class: 'section-title' }, 'Save current city'));
      b.appendChild(
        h(
          'div',
          { class: 'row' },
          name,
          h('button', {
            class: 'btn primary',
            onclick: () => {
              const slot = name.value.trim() || sim.city.name;
              if (this.game.saveSlot(slot)) this.game.ui.toast({ title: 'City saved', text: `Saved as “${slot}”.`, kind: 'good' }, 2500);
              this.refresh();
            },
          }, 'Save'),
        ),
      );
    }
    b.appendChild(h('div', { class: 'section-title' }, 'Saved cities'));
    const slots = listSaves();
    const list = h('div', { class: 'slots' });
    if (!slots.length) list.appendChild(h('div', { class: 'note' }, 'No saved cities yet.'));
    for (const s of slots) list.appendChild(this.slotRow(s));
    b.appendChild(list);
    b.appendChild(h('div', { class: 'section-title' }, 'Files'));
    const file = h('input', {
      type: 'file',
      accept: '.json,.slopcity',
      style: 'display:none',
      onchange: async (e: Event) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f && (await this.game.importCity(f))) this.win.close();
      },
    }) as HTMLInputElement;
    b.appendChild(
      h(
        'div',
        { class: 'row', style: 'gap:8px' },
        sim ? h('button', { class: 'btn', html: `${icon('save', 16)}Export to file`, onclick: () => this.game.exportCity() }) : null,
        h('button', { class: 'btn', html: `${icon('load', 16)}Import file`, onclick: () => file.click() }),
        file,
      ),
    );
  }

  private slotRow(s: SaveSlot): HTMLElement {
    return h(
      'div',
      { class: 'slot' },
      h('div', { class: 'info' }, h('div', { class: 'nm' }, s.slot === 'autosave' ? `${s.name} (autosave)` : s.slot), h('div', { class: 'meta' }, `${int(s.population)} residents · ${s.date} · saved ${new Date(s.savedAt).toLocaleString('en-US')}`)),
      h('button', {
        class: 'btn small primary',
        onclick: () => {
          if (this.game.loadSlot(s.slot)) this.win.close();
        },
      }, 'Load'),
      h('button', {
        class: 'btn small danger',
        title: 'Delete',
        onclick: () => {
          if (confirm(`Delete the saved city “${s.slot}”?`)) {
            deleteSlot(s.slot);
            this.refresh();
          }
        },
      }, 'Delete'),
    );
  }
}

// =================================================================== options

export class OptionsPanel implements Panel {
  win: UIWindow;
  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'options', 'Options', 'options', 420);
  }

  refresh(): void {
    if (!this.win.open) return;
    const g = this.game;
    const st = g.settings;
    const b = this.win.body;
    clear(b);
    const seg = <T extends string>(label: string, value: T, opts: [T, string][], set: (v: T) => void) => {
      const box = h('div', { class: 'seg' });
      for (const [v, l] of opts) {
        box.appendChild(
          h('button', {
            class: value === v ? 'on' : '',
            onclick: () => {
              set(v);
              g.applySettings();
              this.refresh();
            },
          }, l),
        );
      }
      return h('div', { class: 'row' }, h('span', { class: 'k' }, label), box);
    };
    const toggle = (label: string, desc: string, value: boolean, set: (v: boolean) => void) =>
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: value,
          onchange: (e: Event) => {
            set((e.target as HTMLInputElement).checked);
            g.applySettings();
          },
        }),
        h('div', {}, h('div', { class: 't' }, label), h('div', { class: 'd' }, desc)),
      );
    b.appendChild(h('div', { class: 'section-title' }, 'Graphics'));
    b.appendChild(seg('Shadows', st.shadows, [['off', 'Off'], ['low', 'Low'], ['high', 'High']], (v) => (st.shadows = v)));
    b.appendChild(toggle('Day / night cycle', 'Watch the city light up at night.', st.dayNight, (v) => (st.dayNight = v)));
    b.appendChild(toggle('Show grid', 'Draw tile lines on the ground (G).', st.grid, (v) => (st.grid = v)));
    b.appendChild(h('div', { class: 'section-title' }, 'Sound'));
    const vol = h('input', {
      type: 'range',
      min: 0,
      max: 100,
      value: String(Math.round(st.volume * 100)),
      oninput: (e: Event) => {
        st.volume = Number((e.target as HTMLInputElement).value) / 100;
        g.applySettings();
      },
    });
    b.appendChild(h('div', { class: 'row' }, h('span', { class: 'k', style: 'flex:0 0 90px' }, 'Volume'), vol));
    b.appendChild(toggle('Mute', 'Silence all sound effects (M).', st.muted, (v) => (st.muted = v)));
    b.appendChild(h('div', { class: 'section-title' }, 'Gameplay'));
    b.appendChild(toggle('Edge scrolling', 'Move the view when the mouse touches the screen edge.', st.edgeScroll, (v) => (st.edgeScroll = v)));
    b.appendChild(toggle('Autosave', 'Save the city every 3 minutes.', st.autosave, (v) => (st.autosave = v)));
    b.appendChild(
      h(
        'div',
        { class: 'row', style: 'margin-top:12px;gap:8px' },
        h('button', { class: 'btn', onclick: () => g.ui.openWindow('help') }, 'How to play'),
        h('button', {
          class: 'btn danger',
          onclick: () => {
            if (confirm('Quit to the main menu? Unsaved progress is kept in the autosave.')) {
              this.win.close();
              g.toMenu();
            }
          },
        }, 'Main menu'),
      ),
    );
  }
}

// ====================================================================== help

export class HelpPanel implements Panel {
  win: UIWindow;
  constructor(_game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'help', 'How to play', 'help', 560);
  }

  refresh(): void {
    if (!this.win.open) return;
    const b = this.win.body;
    clear(b);
    b.appendChild(h('div', { class: 'section-title' }, 'Getting started'));
    const steps = [
      'Build a road (R). Zones only grow within 3 tiles of a road.',
      'Zone residential (green) and industrial (yellow) land along it. Add some commercial (blue) later.',
      'Build a power plant. Zoned land and buildings carry power, but power lines must cross roads.',
      'Lay water pipes (U) from a water pump to let medium and dense zones grow.',
      'Watch the RCI meter (bottom left): bars above the line mean demand. Zone what people want.',
      'Add police, fire stations, schools, hospitals and parks as the city grows. Check the Advisors.',
      'Connect a road to the map edge to trade with your neighbours.',
    ];
    b.appendChild(h('ol', { class: 'note', style: 'padding-left:18px;margin:0' }, ...steps.map((s) => h('li', { style: 'margin:3px 0' }, s))));
    b.appendChild(h('div', { class: 'section-title' }, 'Controls'));
    const keys: [string, string][] = [
      ['Left drag', 'Use the current tool (zones, roads, bulldoze …)'],
      ['Right drag', 'Pan the view'],
      ['Middle drag', 'Rotate and tilt the view'],
      ['Wheel', 'Zoom in and out'],
      ['W A S D / arrows', 'Pan'],
      ['Q / E', 'Rotate the view 90°'],
      ['Shift (while dragging)', 'Bend lines the other way'],
      ['X', 'Rotate the building you are placing'],
      ['Space', 'Pause / resume'],
      ['1 2 3', 'Turtle, Llama, Cheetah speed'],
      ['B R P U Z', 'Bulldoze, roads, power, pipes, zones'],
      ['G', 'Toggle grid'],
      ['Esc', 'Cancel / query tool'],
      ['Ctrl+S', 'Quick save'],
    ];
    b.appendChild(h('div', { class: 'help-grid' }, ...keys.flatMap(([k, v]) => [h('span', { class: 'kbd' }, k), h('span', {}, v)])));
  }
}

// ====================================================================== news

export class NewsPanel implements Panel {
  win: UIWindow;
  constructor(private game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'news', 'SlopCity Times', 'news', 500);
  }

  refresh(): void {
    if (!this.win.open) return;
    const b = this.win.body;
    clear(b);
    const items = this.game.ui.newsLog.slice().reverse();
    if (!items.length) b.appendChild(h('div', { class: 'note' }, 'No news yet. Slow day in the city.'));
    for (const n of items) {
      b.appendChild(
        h(
          'div',
          { class: 'row', style: 'align-items:flex-start;border-bottom:1px solid var(--line)' },
          h('span', { class: 'pill', style: 'flex:none' }, n.date),
          h('span', { style: `color:${n.kind === 'bad' ? '#ffb1a8' : n.kind === 'good' ? '#a6f0c3' : 'var(--text)'}` }, n.text),
        ),
      );
    }
  }
}
