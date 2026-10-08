import type { Panel } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';
import { icon } from '../icons';

// ================================================================= disasters

export class DisastersPanel implements Panel {
  win: UIWindow;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
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
        h(
          'div',
          {},
          h('div', { class: 't' }, 'Random disasters'),
          h('div', { class: 'd' }, 'Fires and rare catastrophes happen on their own.'),
        ),
      ),
    );
  }
}
