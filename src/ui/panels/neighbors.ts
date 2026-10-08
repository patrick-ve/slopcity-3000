import type { Panel } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';
import { int, money } from '../../util/format';
import { DEAL_COSTS } from '../../sim/budget';
import { EXPORT_LIMIT } from '../../sim/garbage';

// ================================================================= neighbours

export class NeighborsPanel implements Panel {
  win: UIWindow;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
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
      kv.append(
        h('div', { class: 'k' }, k),
        h('div', { class: 'v' }, v ? h('span', { class: 'pill good' }, `${v} connected`) : h('span', { class: 'pill' }, 'none')),
      );
    }
    b.appendChild(kv);
    b.appendChild(
      h('div', { class: 'note', style: 'margin-top:8px' }, 'Road and rail connections bring commuters and trade, and raise demand.'),
    );
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
        h(
          'label',
          { class: `check ${!needs && !deals[key] ? 'locked' : ''}` },
          cb,
          h('div', {}, h('div', { class: 't' }, title), h('div', { class: 'd' }, needs ? desc : why)),
          h('div', { class: 'amt' }, cost),
        ),
      );
    };
    deal(
      'power',
      'Buy power',
      'A neighbour supplies 1,000 MW through a power line at the map edge.',
      `${money(-DEAL_COSTS.power)}/mo`,
      con.power > 0,
      'Needs a power line to the map edge.',
    );
    deal(
      'water',
      'Buy water',
      'A neighbour supplies 4,000 kL through a pipe at the map edge.',
      `${money(-DEAL_COSTS.water)}/mo`,
      con.pipe > 0,
      'Needs a water pipe to the map edge.',
    );
    deal(
      'garbage',
      'Export garbage',
      `Ship up to ${int(EXPORT_LIMIT)} tons a month to a neighbour by road.`,
      `§${DEAL_COSTS.garbagePerTon}/ton`,
      con.road > 0,
      'Needs a road to the map edge.',
    );
  }
}
