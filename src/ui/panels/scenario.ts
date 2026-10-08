import type { Panel } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { getScenario, scenarioProgress } from '../../sim/scenarios';
import { clear, h } from '../../util/dom';
import { formatDate } from '../../util/format';

// ================================================================== scenario

/** Goals, progress and time left of the scenario being played. */
export class ScenarioPanel implements Panel {
  win: UIWindow;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
    this.win = new UIWindow(host, 'scenario', 'Scenario', 'flag', 440);
  }

  refresh(): void {
    const sim = this.game.sim;
    if (!this.win.open || !sim) return;
    const st = sim.city.scenario;
    const b = this.win.body;
    clear(b);
    if (!st) {
      b.appendChild(h('div', { class: 'note' }, 'This city has no scenario. Start one from the main menu.'));
      return;
    }
    const def = getScenario(st.id);
    this.win.setTitle(def.name);
    const days = Math.max(0, st.deadline - sim.city.day);
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30.4);
    const left = years ? `${years} year${years === 1 ? '' : 's'}, ${months} month${months === 1 ? '' : 's'} left` : `${months} months left`;
    const banner =
      st.status === 'won'
        ? h('div', { class: 'pill good', style: 'display:block;padding:8px 10px' }, 'Scenario complete! Keep playing as long as you like.')
        : st.status === 'lost'
          ? h('div', { class: 'pill bad', style: 'display:block;padding:8px 10px' }, 'Time is up. You can keep playing to finish the job.')
          : h(
              'div',
              { class: 'pill warn', style: 'display:block;padding:8px 10px' },
              `${left} · deadline ${formatDate(st.deadline, sim.city.startYear)}`,
            );
    b.appendChild(banner);
    b.appendChild(h('p', { class: 'note', style: 'margin:10px 0' }, def.story));
    b.appendChild(h('div', { class: 'section-title' }, `Goals · ${def.level}`));
    for (const g of scenarioProgress(sim)) {
      b.appendChild(
        h(
          'div',
          { class: 'row goal' },
          h('span', { class: `check ${g.met ? 'met' : ''}` }, g.met ? '✓' : ''),
          h('span', { style: 'flex:1' }, g.label),
          h('span', { class: 'v num' }, g.value),
        ),
      );
    }
  }
}
