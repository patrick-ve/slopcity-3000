import type { Panel } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';
import { ADVISORS, getAdvice } from '../../sim/advisors';

// ================================================================== advisors

export class AdvisorsPanel implements Panel {
  win: UIWindow;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
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
