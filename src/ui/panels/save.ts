import type { Panel } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';
import { deleteSlot, listSaves, type SaveSlot } from '../../sim/save';
import { icon } from '../icons';
import { int } from '../../util/format';

// ================================================================ save / load

export class SavePanel implements Panel {
  win: UIWindow;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
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
          h(
            'button',
            {
              class: 'btn primary',
              onclick: () => {
                const slot = name.value.trim() || sim.city.name;
                if (this.game.saveSlot(slot)) this.game.ui.toast({ title: 'City saved', text: `Saved as “${slot}”.`, kind: 'good' }, 2500);
                this.refresh();
              },
            },
            'Save',
          ),
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
      h(
        'div',
        { class: 'info' },
        h('div', { class: 'nm' }, s.slot === 'autosave' ? `${s.name} (autosave)` : s.slot),
        h('div', { class: 'meta' }, `${int(s.population)} residents · ${s.date} · saved ${new Date(s.savedAt).toLocaleString('en-US')}`),
      ),
      h(
        'button',
        {
          class: 'btn small primary',
          onclick: () => {
            if (this.game.loadSlot(s.slot)) this.win.close();
          },
        },
        'Load',
      ),
      h(
        'button',
        {
          class: 'btn small danger',
          title: 'Delete',
          onclick: () => {
            if (confirm(`Delete the saved city “${s.slot}”?`)) {
              deleteSlot(s.slot);
              this.refresh();
            }
          },
        },
        'Delete',
      ),
    );
  }
}
