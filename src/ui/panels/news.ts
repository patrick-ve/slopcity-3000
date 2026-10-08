import type { Panel } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';

// ====================================================================== news

export class NewsPanel implements Panel {
  win: UIWindow;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
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
