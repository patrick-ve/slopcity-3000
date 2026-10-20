import type { Panel } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';

// =================================================================== options

export class OptionsPanel implements Panel {
  win: UIWindow;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
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
          h(
            'button',
            {
              class: value === v ? 'on' : '',
              onclick: () => {
                set(v);
                g.applySettings();
                this.refresh();
              },
            },
            l,
          ),
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
    b.appendChild(
      seg(
        'Shadows',
        st.shadows,
        [
          ['off', 'Off'],
          ['low', 'Low'],
          ['high', 'High'],
        ],
        (v) => (st.shadows = v),
      ),
    );
    b.appendChild(
      seg(
        'Smooth edges',
        st.edges,
        [
          ['auto', 'Auto'],
          ['on', 'On'],
          ['off', 'Off'],
        ],
        (v) => (st.edges = v),
      ),
    );
    b.appendChild(
      h(
        'div',
        { class: 'note', style: 'margin:-2px 0 8px' },
        `Smoothing needs a lot of graphics memory on sharp (Retina) screens, so Auto leaves it off there. Now: ${g.renderer.smoothing ? 'on' : 'off'}.`,
      ),
    );
    b.appendChild(toggle('Day / night cycle', 'Watch the city light up at night.', st.dayNight, (v) => (st.dayNight = v)));
    b.appendChild(toggle('Show grid', 'Draw tile lines on the ground (G).', st.grid, (v) => (st.grid = v)));
    b.appendChild(h('div', { class: 'section-title' }, 'Sound'));
    const slider = (label: string, value: number, set: (v: number) => void) =>
      h(
        'div',
        { class: 'row' },
        h('span', { class: 'k', style: 'flex:0 0 112px' }, label),
        h('input', {
          type: 'range',
          min: 0,
          max: 100,
          value: String(Math.round(value * 100)),
          oninput: (e: Event) => {
            set(Number((e.target as HTMLInputElement).value) / 100);
            g.applySettings();
          },
        }),
      );
    b.appendChild(slider('Effects volume', st.volume, (v) => (st.volume = v)));
    const song = g.music.title;
    b.appendChild(
      toggle(
        'Music',
        song ? `Smooth procedural jazz. Now playing: “${song}”.` : 'Smooth procedural jazz.',
        st.music,
        (v) => (st.music = v),
      ),
    );
    b.appendChild(slider('Music volume', st.musicVolume, (v) => (st.musicVolume = v)));
    b.appendChild(toggle('Mute', 'Silence all sound effects and music (M).', st.muted, (v) => (st.muted = v)));
    b.appendChild(h('div', { class: 'section-title' }, 'Gameplay'));
    b.appendChild(
      toggle('Edge scrolling', 'Move the view when the mouse touches the screen edge.', st.edgeScroll, (v) => (st.edgeScroll = v)),
    );
    b.appendChild(toggle('Autosave', 'Save the city every 3 minutes.', st.autosave, (v) => (st.autosave = v)));
    b.appendChild(
      h(
        'div',
        { class: 'row', style: 'margin-top:12px;gap:8px' },
        h('button', { class: 'btn', onclick: () => g.ui.openWindow('help') }, 'How to play'),
        h(
          'button',
          {
            class: 'btn danger',
            onclick: () => {
              if (confirm('Quit to the main menu? Unsaved progress is kept in the autosave.')) {
                this.win.close();
                g.toMenu();
              }
            },
          },
          'Main menu',
        ),
      ),
    );
  }
}
