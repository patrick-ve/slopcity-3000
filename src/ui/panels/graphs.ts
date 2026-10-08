import type { HistoryPoint } from '../../sim/types';
import { int, money } from '../../util/format';
import { type Panel, pct } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';

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

  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
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
        h(
          'button',
          {
            class: `tab ${this.range === months ? 'on' : ''}`,
            onclick: () => {
              this.range = months;
              this.refresh();
            },
          },
          label,
        ),
      );
    }
    b.appendChild(tabs);
    b.appendChild(this.canvas);
    const ser = h('div', { class: 'series' });
    for (const sr of SERIES) {
      ser.appendChild(
        h(
          'button',
          {
            class: `tab ${this.selected.has(sr.key) ? 'on' : ''}`,
            onclick: () => {
              if (this.selected.has(sr.key)) this.selected.delete(sr.key);
              else this.selected.add(sr.key);
              this.refresh();
            },
          },
          h('span', { class: 'dot', style: `background:${sr.color}` }),
          sr.name,
        ),
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
