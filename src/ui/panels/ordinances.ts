import { type Panel, signed } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';
import { ORDINANCE_CATEGORY_NAMES, type OrdinanceCategory, ordinanceMonthly, ORDINANCES } from '../../sim/ordinances';
import { int } from '../../util/format';

// ================================================================ ordinances

export class OrdinancesPanel implements Panel {
  win: UIWindow;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
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
      h(
        'div',
        { class: 'row' },
        h('span', { class: 'k' }, 'Net monthly effect of active ordinances'),
        h('span', { class: `v num ${total >= 0 ? 'pos' : 'neg'}` }, signed(total)),
      ),
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
            h(
              'div',
              {},
              h('div', { class: 't' }, o.name),
              h('div', { class: 'd' }, locked ? `Available at ${int(o.minPop ?? 0)} residents` : o.desc),
            ),
            h('div', { class: 'amt', style: `color:${amt >= 0 ? 'var(--good)' : 'var(--muted)'}` }, `${signed(amt)}/mo`),
          ),
        );
      }
    }
    b.scrollTop = scroll;
  }
}
