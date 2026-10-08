import { h, clear } from '../util/dom';
import { int } from '../util/format';
import { randomSeed } from '../util/rng';
import type { MapOptions, TerrainKind, TreeKind, WaterKind } from '../sim/mapgen';
import type { Difficulty } from '../sim/types';
import { listSaves } from '../sim/save';
import type { Game } from '../game/game';
import { icon } from './icons';

export interface NewGameOptions {
  name: string;
  mayor: string;
  startYear: number;
  difficulty: Difficulty;
  /** Unlimited money and every building unlocked. */
  sandbox?: boolean;
  map: MapOptions;
}

const CITY_NAMES = [
  'Llamaville',
  'Polygon Park',
  'New Slopsville',
  'Triangle Falls',
  'Vertex Bay',
  'Low Poly Heights',
  'Cheetah Springs',
  'Port Facet',
  'Mesh Harbor',
  'Flatshade City',
  'Normalton',
  'Sim Valley',
  'Gridford',
  'Turtle Creek',
  'Bevel Hills',
];

/** Title screen, new-city setup and load list. */
export class Menu {
  readonly el: HTMLDivElement;
  private opts: NewGameOptions;

  constructor(
    private game: Game,
    container: HTMLElement,
  ) {
    this.el = h('div', { class: 'menu' });
    container.appendChild(this.el);
    this.opts = {
      name: CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)],
      mayor: 'Mayor',
      startYear: 1950,
      difficulty: 'medium',
      map: { size: 96, seed: randomSeed(), terrain: 'rolling', water: 'river', trees: 'normal' },
    };
  }

  get visible(): boolean {
    return this.el.style.display !== 'none';
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  showMain(): void {
    this.el.style.display = '';
    clear(this.el);
    const saves = listSaves();
    const auto = saves.find((s) => s.slot === 'autosave');
    const buttons = h('div', { class: 'buttons' });
    if (auto) {
      buttons.appendChild(
        h(
          'button',
          {
            class: 'btn primary',
            onclick: () => this.game.loadSlot('autosave'),
          },
          `Continue ${auto.name} (${int(auto.population)} residents)`,
        ),
      );
    }
    buttons.appendChild(
      h('button', { class: `btn ${auto ? '' : 'primary'}`, html: `${icon('building', 18)}New city`, onclick: () => this.showNew() }),
    );
    if (saves.some((s) => s.slot !== 'autosave'))
      buttons.appendChild(h('button', { class: 'btn', html: `${icon('load', 18)}Load city`, onclick: () => this.showLoad() }));
    buttons.appendChild(
      h('button', { class: 'btn', html: `${icon('help', 18)}How to play`, onclick: () => this.game.ui.openWindow('help') }),
    );
    const card = h(
      'div',
      { class: 'card glass' },
      h('h1', { class: 'title' }, 'SlopCity', h('span', {}, '3000')),
      h('p', { class: 'tagline' }, 'Build the low-poly metropolis of your dreams.'),
      buttons,
      h('div', { class: 'foot' }, 'A low-poly homage to SimCity 3000 · TypeScript + WebGL'),
    );
    this.el.appendChild(card);
  }

  private showLoad(): void {
    clear(this.el);
    const list = h('div', { class: 'slots' });
    for (const s of listSaves()) {
      list.appendChild(
        h(
          'div',
          { class: 'slot' },
          h(
            'div',
            { class: 'info' },
            h('div', { class: 'nm' }, s.slot === 'autosave' ? `${s.name} (autosave)` : s.slot),
            h('div', { class: 'meta' }, `${int(s.population)} residents · ${s.date}`),
          ),
          h('button', { class: 'btn small primary', onclick: () => this.game.loadSlot(s.slot) }, 'Load'),
        ),
      );
    }
    const file = h('input', {
      type: 'file',
      accept: '.json,.slopcity',
      style: 'display:none',
      onchange: async (e: Event) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) await this.game.importCity(f);
      },
    }) as HTMLInputElement;
    this.el.appendChild(
      h(
        'div',
        { class: 'newcity glass' },
        h('h2', {}, 'Load a city'),
        list,
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', onclick: () => this.showMain() }, 'Back'),
          h('button', { class: 'btn', onclick: () => file.click() }, 'Import file…'),
          file,
        ),
      ),
    );
  }

  showNew(): void {
    this.el.style.display = '';
    clear(this.el);
    const o = this.opts;
    const name = h('input', {
      type: 'text',
      value: o.name,
      maxLength: 28,
      oninput: (e: Event) => (o.name = (e.target as HTMLInputElement).value),
    });
    const mayor = h('input', {
      type: 'text',
      value: o.mayor,
      maxLength: 28,
      oninput: (e: Event) => (o.mayor = (e.target as HTMLInputElement).value),
    });
    const seed = h('input', {
      type: 'number',
      value: String(o.map.seed),
      onchange: (e: Event) => {
        o.map.seed = Math.abs(Math.floor(Number((e.target as HTMLInputElement).value))) || 1;
        this.preview();
      },
    }) as HTMLInputElement;
    const seg = <T extends string | number>(opts: [T, string][], get: () => T, set: (v: T) => void, regen: boolean) => {
      const box = h('div', { class: 'seg' });
      const draw = () => {
        clear(box);
        for (const [v, label] of opts) {
          box.appendChild(
            h(
              'button',
              {
                class: get() === v ? 'on' : '',
                onclick: () => {
                  set(v);
                  draw();
                  this.game.sfx.play('click');
                  if (regen) this.preview();
                },
              },
              label,
            ),
          );
        }
      };
      draw();
      return box;
    };
    const form = h(
      'div',
      { class: 'form' },
      h('label', {}, 'City name'),
      name,
      h('label', {}, 'Mayor'),
      mayor,
      h('label', {}, 'Map size'),
      seg<number>(
        [
          [64, 'Small'],
          [96, 'Medium'],
          [128, 'Large'],
          [256, 'Huge'],
        ],
        () => o.map.size,
        (v) => (o.map.size = v),
        true,
      ),
      h('label', {}, 'Terrain'),
      seg<TerrainKind>(
        [
          ['flat', 'Flat'],
          ['rolling', 'Rolling'],
          ['hilly', 'Hilly'],
          ['mountains', 'Mountains'],
        ],
        () => o.map.terrain,
        (v) => (o.map.terrain = v),
        true,
      ),
      h('label', {}, 'Water'),
      seg<WaterKind>(
        [
          ['none', 'None'],
          ['lakes', 'Lakes'],
          ['river', 'River'],
          ['coast', 'Coast'],
          ['island', 'Island'],
        ],
        () => o.map.water,
        (v) => (o.map.water = v),
        true,
      ),
      h('label', {}, 'Trees'),
      seg<TreeKind>(
        [
          ['few', 'Few'],
          ['normal', 'Normal'],
          ['many', 'Many'],
        ],
        () => o.map.trees,
        (v) => (o.map.trees = v),
        true,
      ),
      h('label', {}, 'Start year'),
      seg<number>(
        [
          [1900, '1900'],
          [1950, '1950'],
          [2000, '2000'],
        ],
        () => o.startYear,
        (v) => (o.startYear = v),
        false,
      ),
      h('label', {}, 'Difficulty'),
      seg<Difficulty | 'sandbox'>(
        [
          ['easy', 'Easy §50k'],
          ['medium', 'Medium §20k'],
          ['hard', 'Hard §10k'],
          ['sandbox', 'Sandbox ∞'],
        ],
        () => (o.sandbox ? 'sandbox' : o.difficulty),
        (v) => {
          o.sandbox = v === 'sandbox';
          o.difficulty = v === 'sandbox' ? 'easy' : v;
        },
        false,
      ),
      h('label', {}, 'Map seed'),
      h(
        'div',
        { class: 'row', style: 'padding:0' },
        seed,
        h(
          'button',
          {
            class: 'btn',
            title: 'Random map',
            onclick: () => {
              o.map.seed = randomSeed();
              seed.value = String(o.map.seed);
              this.preview();
            },
          },
          '🎲',
        ),
      ),
    );
    this.el.appendChild(
      h(
        'div',
        { class: 'newcity glass' },
        h('h2', {}, 'Found a new city'),
        form,
        h('div', { class: 'note', style: 'margin-top:12px' }, 'The map behind this window is a live preview of your land.'),
        h(
          'div',
          { class: 'actions' },
          h(
            'button',
            {
              class: 'btn',
              onclick: () => {
                this.game.showDemo();
                this.showMain();
              },
            },
            'Back',
          ),
          h(
            'button',
            {
              class: 'btn primary',
              onclick: () => {
                o.name = o.name.trim() || 'SlopCity';
                this.game.newCity({ ...o, map: { ...o.map } });
              },
            },
            'Start building →',
          ),
        ),
      ),
    );
    this.preview();
  }

  private preview(): void {
    this.game.previewMap({ ...this.opts.map });
  }
}
