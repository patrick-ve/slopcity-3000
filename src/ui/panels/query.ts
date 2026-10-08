import { type Panel, pct } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';
import { getDef } from '../../sim/catalog';
import { needsPower, needsWater, powerUseOf, waterUseOf } from '../../sim/util';
import { DENSITY_NAMES, NET, WEALTH_NAMES, ZONE_NAMES } from '../../sim/types';
import { int, money } from '../../util/format';
import { desirability } from '../../sim/growth';
import { plantOutput } from '../../sim/networks';
import { LANDFILL_CAPACITY } from '../../sim/garbage';

// ===================================================================== query

export class QueryPanel implements Panel {
  win: UIWindow;
  tx = 0;
  ty = 0;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
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
      if (needsPower(def) && bld.build <= 0)
        status.push(h('span', { class: `pill ${bld.powered ? 'good' : 'bad'}` }, bld.powered ? 'Powered' : 'No power'));
      if (needsWater(def) && bld.build <= 0)
        status.push(h('span', { class: `pill ${bld.watered ? 'good' : 'bad'}` }, bld.watered ? 'Water' : 'No water'));
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
        if (def.needsSubway) {
          const linked = sim.subwayLinked.has(bld.id);
          add('Subway line', linked ? 'Running' : 'Needs a second station on this line');
          if (linked) add('Riders (city)', `${int(sim.stats.subwayRiders)} a day`);
        }
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
      if (n & NET.HIGHWAY) parts.push(w.isWater(tx, ty) ? 'Highway bridge' : 'Highway');
      if (n & NET.PIPE) parts.push('Water pipe');
      if (n & NET.SUBWAY) parts.push('Subway');
      this.win.setTitle(
        parts.length
          ? parts.join(' + ')
          : z
            ? `${DENSITY_NAMES[w.density[i]] ?? ''} ${ZONE_NAMES[z]}`.trim()
            : w.isWater(tx, ty)
              ? 'Water'
              : 'Open land',
      );
      if (z) add('Zone', z === 4 ? 'Landfill' : `${DENSITY_NAMES[w.density[i]]} ${ZONE_NAMES[z]}`);
      if (z === 4) add('Landfill', `${int(w.landfill[i])} / ${int(LANDFILL_CAPACITY)} t`);
      if (z >= 1 && z <= 3) {
        add('Desirability', pct((desirability(sim, z, i) + 1) / 2));
        add('Powered', w.powered[i] ? 'Yes' : 'No');
        add('Road access', w.roadDist[i] <= 3 ? 'Yes' : 'No (needs a road within 3 tiles)');
      }
      if (n & NET.ROAD) add('Traffic', pct(Math.min(1.5, w.traffic[i])));
      if (n & NET.HIGHWAY) add('Highway traffic', pct(Math.min(1.5, w.hwyTraffic[i])));
      if (n & NET.SUBWAY) add('Subway line', sim.subwayLive[i] ? 'Running' : 'Needs two stations');
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
