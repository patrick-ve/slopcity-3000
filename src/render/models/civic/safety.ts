/** Police and fire station models. */
import type { ModelFn } from '../types';
import { ASPHALT, deck, flag, policeCar, STONE, truck, WHITE } from './shared';
import { PAL } from '../../palette';
import { FLOOR, shade, WIN } from '../../geom';

// ------------------------------------------------------------------ safety

export const police_station: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.08, 1.45, 1.92, 1.95, 0.012, ASPHALT);
  for (let i = 0; i < 4; i++) deck(g, 1.02 + i * 0.22, 1.5, 1.04 + i * 0.22, 1.78, 0.014, PAL.laneWhite);
  const wall = r.pick([0xe8e4dc, 0xd9dde2, 0xf0ebe0]);
  g.color(wall).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.15, 0, 0.2, 1.85, FLOOR * 2, 1.32, { top: PAL.flatRoof });
  g.noWin().color(0x2f5fb8);
  g.box(0.14, FLOOR * 0.94, 0.19, 1.86, FLOOR * 1.12, 1.33, { top: 0x2f5fb8 });
  g.box(0.14, FLOOR * 2, 0.19, 1.86, FLOOR * 2 + 0.03, 1.33, { top: PAL.flatRoof });
  // entrance canopy
  g.color(0x2f5fb8).box(0.7, 0.15, 1.32, 1.2, 0.17, 1.48);
  g.color(PAL.steelDark);
  g.box(0.72, 0, 1.45, 0.74, 0.15, 1.47, { noTop: true });
  g.box(1.16, 0, 1.45, 1.18, 0.15, 1.47, { noTop: true });
  // roof: AC units + radio mast
  g.color(0xb8bec4).box(0.4, FLOOR * 2 + 0.03, 0.45, 0.65, FLOOR * 2 + 0.1, 0.65);
  g.color(PAL.steel).beam([1.6, FLOOR * 2 + 0.03, 0.5], [1.6, FLOOR * 2 + 0.5, 0.5], 0.015);
  policeCar(g, 1.14, 1.66, false);
  policeCar(g, 1.58, 1.66, false);
  policeCar(g, 0.4, 1.75, true);
  flag(g, 0.6, 1.4, 0.42, 0x3f7fd6);
};

export const fire_station: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.12, 1.15, 1.88, 1.96, 0.012, 0xb9b4aa);
  const brick = r.pick(PAL.walls.brick);
  g.color(brick).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.15, 0, 0.2, 1.85, 0.32, 1.15, { top: PAL.flatRoof });
  g.noWin().color(STONE).box(0.14, 0.3, 0.19, 1.86, 0.34, 1.16, { top: PAL.flatRoof });
  // garage doors
  for (let i = 0; i < 3; i++) {
    const x = 0.3 + i * 0.47;
    g.color(PAL.red).box(x, 0, 1.15, x + 0.36, 0.2, 1.16);
    g.color(WHITE).box(x - 0.01, 0.2, 1.15, x + 0.37, 0.215, 1.162);
  }
  // hose tower
  g.color(shade(brick, 0.92)).win(WIN.CIVIC, 0.08, 0.16);
  g.box(1.52, 0, 0.24, 1.8, 0.72, 0.52, { noTop: true });
  g.noWin().color(PAL.roofs.slate).pyramid(1.66, 0.38, 0.32, 0.32, 0.72, 0.14);
  // fire trucks
  for (const x of [0.48, 0.95]) {
    truck(g, x, 1.52, PAL.red, PAL.red, false, 0.34, 0.1);
    g.color(WHITE).beam([x, 0.105, 1.38], [x, 0.105, 1.62], 0.025);
    g.color(PAL.blue).box(x - 0.02, 0.083, 1.66, x + 0.02, 0.094, 1.68);
  }
  g.color(PAL.red).cylinder(1.7, 1.85, 0.02, 0, 0.05, 6);
  flag(g, 1.45, 1.85, 0.4, PAL.red);
};
