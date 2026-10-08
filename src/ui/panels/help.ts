import type { Panel } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { clear, h } from '../../util/dom';

// ====================================================================== help

export class HelpPanel implements Panel {
  win: UIWindow;
  constructor(_game: Game, host: HTMLElement) {
    this.win = new UIWindow(host, 'help', 'How to play', 'help', 560);
  }

  refresh(): void {
    if (!this.win.open) return;
    const b = this.win.body;
    clear(b);
    b.appendChild(h('div', { class: 'section-title' }, 'Getting started'));
    const steps = [
      'Build a road (R). Zones only grow within 3 tiles of a road.',
      'Zone residential (green) and industrial (yellow) land along it. Add some commercial (blue) later.',
      'Build a power plant. Zoned land and buildings carry power, but power lines must cross roads.',
      'Lay water pipes (U) from a water pump to let medium and dense zones grow.',
      'Watch the RCI meter (bottom left): bars above the line mean demand. Zone what people want.',
      'Add police, fire stations, schools, hospitals and parks as the city grows. Check the Advisors.',
      'Connect a road to the map edge to trade with your neighbours.',
    ];
    b.appendChild(
      h('ol', { class: 'note', style: 'padding-left:18px;margin:0' }, ...steps.map((s) => h('li', { style: 'margin:3px 0' }, s))),
    );
    const grid = (title: string, rows: [string, string][]) => {
      b.appendChild(h('div', { class: 'section-title' }, title));
      b.appendChild(h('div', { class: 'help-grid' }, ...rows.flatMap(([k, v]) => [h('span', { class: 'kbd' }, k), h('span', {}, v)])));
    };
    grid('Mouse', [
      ['Left drag', 'Use the current tool (zones, roads, bulldoze …)'],
      ['Right drag', 'Pan the view'],
      ['Middle drag', 'Rotate and tilt the view'],
      ['Option/Alt + left drag', 'Rotate and tilt (no middle button needed)'],
      ['Wheel', 'Zoom in and out'],
      ['Shift + wheel', 'Rotate the view'],
    ]);
    grid('Trackpad', [
      ['Two-finger swipe up/down', 'Zoom in and out'],
      ['Two-finger swipe sideways', 'Rotate the view'],
      ['Pinch', 'Zoom in and out'],
      ['Option/Alt + drag', 'Rotate and tilt the view'],
    ]);
    grid('Touch screen', [
      ['One finger', 'Use the current tool. With the query tool: drag to pan, tap to inspect.'],
      ['Two fingers', 'Drag to pan, pinch to zoom, twist to rotate'],
      ['Three fingers', 'Drag up or down to tilt the view'],
    ]);
    grid('Keyboard', [
      ['W A S D / arrows', 'Pan'],
      ['Q / E', 'Rotate the view 90°'],
      ['+ / −', 'Zoom in and out'],
      ['Shift (while dragging)', 'Bend lines the other way'],
      ['X / Tab', 'Rotate the building you are placing'],
      ['Space', 'Pause / resume'],
      ['1 2 3', 'Turtle, Llama, Cheetah speed'],
      ['B R P U Z', 'Bulldoze, roads, power, pipes, zones'],
      ['G / M / H', 'Grid, mute, help'],
      ['Esc', 'Cancel / query tool'],
      ['Ctrl/Cmd + S', 'Quick save'],
    ]);
  }
}
