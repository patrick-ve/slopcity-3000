/** Health and education models: clinics, hospitals, schools, college, library and museum. */
import type { ModelFn } from '../types';
import {
  ASPHALT,
  bench,
  bush,
  car,
  columns,
  COPPER,
  deck,
  dome,
  flag,
  GOLD,
  GRASS,
  type P2,
  PATH,
  redCross,
  STONE,
  STONE_DARK,
  tree,
  truck,
  WHITE,
} from './shared';
import { FLOOR, shade, WIN } from '../../geom';
import { PAL } from '../../palette';

// --------------------------------------------------------- health & education

export const clinic: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.08, 0.72, 0.92, 0.95, 0.012, ASPHALT);
  const wall = r.pick([0xf4f4ef, 0xeef2f0, 0xf2ece4]);
  g.color(wall).win(WIN.CIVIC, 0.11, FLOOR);
  g.box(0.15, 0, 0.16, 0.85, FLOOR * 2, 0.68, { top: PAL.flatRoof });
  g.noWin()
    .color(0x2bb3a3)
    .box(0.14, FLOOR * 2, 0.15, 0.86, FLOOR * 2 + 0.03, 0.69, { top: PAL.flatRoof });
  redCross(g, 0.66, 0.19, 0.68, 0.1);
  g.color(0x2bb3a3).box(0.3, 0.11, 0.68, 0.52, 0.125, 0.8);
  g.color(PAL.steelDark).box(0.31, 0, 0.78, 0.325, 0.11, 0.795, { noTop: true });
  g.box(0.495, 0, 0.78, 0.51, 0.11, 0.795, { noTop: true });
  truck(g, 0.72, 0.84, WHITE, WHITE, true, 0.26, 0.085);
  g.color(PAL.red).box(0.6, 0.05, 0.783, 0.84, 0.062, 0.897);
  tree(g, r, 0.12, 0.88, 0.7);
};

export const hospital: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.1, 2.35, 1.3, 2.95, 0.012, ASPHALT);
  for (let i = 0; i < 4; i++) car(g, 0.25 + i * 0.28, 2.65, r.pick(PAL.cars), false);
  const wall = r.pick([0xf4f4ef, 0xeef2f0]);
  // tower
  g.color(wall).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.5, 0, 0.32, 2.5, FLOOR * 6, 1.4, { top: PAL.flatRoof });
  // front wing
  g.color(shade(wall, 0.96)).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.25, 0, 1.4, 2.75, FLOOR * 2.5, 2.3, { top: PAL.flatRoof });
  g.noWin()
    .color(0x2bb3a3)
    .box(0.24, FLOOR * 2.5, 1.39, 2.76, FLOOR * 2.5 + 0.03, 2.31, { top: PAL.flatRoof });
  // helipad
  const ty = FLOOR * 6;
  deck(g, 1.15, 0.5, 1.85, 1.2, ty + 0.012, 0x4a4d52);
  deck(g, 1.35, 0.68, 1.4, 1.02, ty + 0.014, WHITE);
  deck(g, 1.6, 0.68, 1.65, 1.02, ty + 0.014, WHITE);
  deck(g, 1.4, 0.825, 1.6, 0.875, ty + 0.014, WHITE);
  redCross(g, 2.15, 0.62, 1.4, 0.16);
  redCross(g, 1.5, 0.24, 2.3, 0.1);
  // entrance canopy
  g.color(WHITE).box(1.2, 0.14, 2.3, 1.8, 0.16, 2.58);
  g.color(PAL.steelDark);
  g.box(1.22, 0, 2.55, 1.24, 0.14, 2.57, { noTop: true });
  g.box(1.76, 0, 2.55, 1.78, 0.14, 2.57, { noTop: true });
  // ambulances
  for (const x of [2.1, 2.45]) {
    truck(g, x, 2.6, WHITE, WHITE, false, 0.26, 0.085);
    g.color(PAL.red).box(x - 0.057, 0.05, 2.47, x + 0.057, 0.062, 2.7);
  }
  g.color(0xb8bec4).box(0.8, FLOOR * 6, 0.5, 1.0, FLOOR * 6 + 0.07, 0.7);
  tree(g, r, 2.85, 1.0, 0.9);
  tree(g, r, 0.15, 0.6, 0.9);
};

export const school: ModelFn = (g, c) => {
  const r = c.rng;
  const brick = r.pick(PAL.walls.brick);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.charcoal, PAL.roofs.brown]);
  g.color(brick).win(WIN.CIVIC, 0.11, FLOOR);
  g.box(0.12, 0, 0.12, 1.88, FLOOR * 2, 0.68, { noTop: true });
  g.box(0.12, 0, 0.68, 0.68, FLOOR * 2, 1.48, { noTop: true });
  g.noWin().color(roof);
  g.hip(0.12, 0.12, 1.88, 0.68, FLOOR * 2, 0.15, 0.03);
  g.hip(0.12, 0.6, 0.68, 1.48, FLOOR * 2, 0.15, 0.03);
  // entrance canopy
  g.color(STONE).box(1.05, 0.15, 0.68, 1.4, 0.17, 0.84);
  g.color(PAL.steelDark);
  g.box(1.06, 0, 0.82, 1.08, 0.15, 0.84, { noTop: true });
  g.box(1.37, 0, 0.82, 1.39, 0.15, 0.84, { noTop: true });
  // sports field
  deck(g, 0.85, 0.98, 1.88, 1.88, 0.013, 0x6fae44);
  deck(g, 0.9, 1.02, 1.83, 1.04, 0.015, WHITE);
  deck(g, 0.9, 1.82, 1.83, 1.84, 0.015, WHITE);
  deck(g, 0.9, 1.02, 0.92, 1.84, 0.015, WHITE);
  deck(g, 1.81, 1.02, 1.83, 1.84, 0.015, WHITE);
  deck(g, 0.9, 1.42, 1.83, 1.44, 0.015, WHITE);
  g.color(WHITE);
  for (const z of [1.08, 1.78]) {
    g.beam([1.28, 0, z], [1.28, 0.07, z], 0.012);
    g.beam([1.45, 0, z], [1.45, 0.07, z], 0.012);
    g.beam([1.28, 0.07, z], [1.45, 0.07, z], 0.012);
  }
  flag(g, 0.82, 0.86, 0.42, r.pick([PAL.blue, PAL.red, PAL.green]));
  truck(g, 0.4, 1.85, 0xf2b81e, 0xf2b81e, true, 0.36, 0.1);
  g.color(PAL.black).box(0.22, 0.045, 1.792, 0.58, 0.055, 1.908);
  tree(g, r, 0.3, 1.6, 0.9);
};

export const college: ModelFn = (g, c) => {
  const r = c.rng;
  const brick = r.pick(PAL.walls.brick);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.charcoal, PAL.roofs.green]);
  // quad
  deck(g, 0.82, 0.92, 2.18, 2.7, 0.013, GRASS);
  deck(g, 1.44, 0.85, 1.56, 2.96, 0.015, PATH);
  deck(g, 0.75, 1.76, 2.25, 1.88, 0.015, PATH);
  // back hall
  g.color(brick).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.2, 0, 0.12, 2.8, FLOOR * 2.8, 0.72, { noTop: true });
  g.noWin()
    .color(roof)
    .gable(0.2, 0.12, 2.8, 0.72, FLOOR * 2.8, 0.18, 'x', 0.03, brick);
  // side halls
  const b2 = shade(brick, 1.08);
  g.color(b2).win(WIN.CIVIC, 0.12, FLOOR);
  g.box(0.12, 0, 0.92, 0.68, FLOOR * 2.3, 2.45, { noTop: true });
  g.box(2.32, 0, 0.92, 2.88, FLOOR * 2.3, 2.45, { noTop: true });
  g.noWin().color(roof);
  g.gable(0.12, 0.92, 0.68, 2.45, FLOOR * 2.3, 0.15, 'z', 0.03, b2);
  g.gable(2.32, 0.92, 2.88, 2.45, FLOOR * 2.3, 0.15, 'z', 0.03, b2);
  // clock tower
  g.color(shade(brick, 1.15)).win(WIN.CIVIC, 0.09, 0.15);
  g.box(1.35, 0, 0.5, 1.65, 1.2, 0.8, { noTop: true });
  g.noWin().color(roof).pyramid(1.5, 0.65, 0.36, 0.36, 1.2, 0.32);
  g.color(WHITE);
  g.box(1.43, 1.0, 0.8, 1.57, 1.13, 0.812);
  g.box(1.65, 1.0, 0.58, 1.662, 1.13, 0.72);
  g.box(1.338, 1.0, 0.58, 1.35, 1.13, 0.72);
  g.color(GOLD).beam([1.5, 1.52, 0.65], [1.5, 1.65, 0.65], 0.02);
  for (const [x, z] of [
    [1.05, 1.2],
    [1.95, 1.2],
    [1.05, 2.4],
    [1.95, 2.4],
    [1.2, 2.75],
    [1.8, 2.75],
  ] as P2[]) {
    tree(g, r, x + (r.next() - 0.5) * 0.08, z, 1.1);
  }
  bench(g, 1.35, 1.6, false);
  bench(g, 1.65, 2.1, false);
};

/** Classical front: podium, columns and pediment over a hall. */
export const library: ModelFn = (g, c) => {
  const r = c.rng;
  const stone = r.pick([STONE, 0xe2d9c4, 0xd9d4c8]);
  g.noWin()
    .color(STONE_DARK)
    .box(0.12, 0, 0.1, 0.88, 0.035, 0.86, { top: shade(stone, 0.95) });
  g.color(stone).win(WIN.CIVIC, 0.12, 0.2);
  g.box(0.18, 0.035, 0.14, 0.82, 0.28, 0.66, { noTop: true });
  columns(g, 0.24, 0.76, 0.77, 0.035, 0.28, 4, 0.024, stone);
  g.color(shade(stone, 0.95)).box(0.17, 0.28, 0.13, 0.83, 0.32, 0.84);
  g.color(PAL.roofs.slate).gable(0.17, 0.13, 0.83, 0.84, 0.32, 0.11, 'z', 0.015, stone);
  g.color(STONE_DARK).box(0.26, 0, 0.86, 0.74, 0.018, 0.93);
  g.color(0x5a4430).box(0.45, 0.035, 0.66, 0.55, 0.17, 0.668);
  bush(g, r, 0.14, 0.92, 1);
  bush(g, r, 0.86, 0.92, 1);
};

export const museum: ModelFn = (g, c) => {
  const r = c.rng;
  const stone = r.pick([STONE, 0xe2d9c4, 0xeee6d4]);
  g.noWin()
    .color(STONE_DARK)
    .box(0.1, 0, 0.12, 1.9, 0.05, 1.72, { top: shade(stone, 0.94) });
  g.color(stone).win(WIN.CIVIC, 0.13, 0.22);
  g.box(0.18, 0.05, 0.2, 1.82, 0.45, 1.32, { top: PAL.flatRoof });
  columns(g, 0.5, 1.5, 1.55, 0.05, 0.42, 6, 0.032, stone);
  g.color(shade(stone, 0.95)).box(0.42, 0.42, 1.28, 1.58, 0.48, 1.66);
  g.color(PAL.roofs.slate).gable(0.42, 1.28, 1.58, 1.66, 0.48, 0.16, 'z', 0.02, stone);
  // dome
  g.color(stone).cylinder(1.0, 0.72, 0.3, 0.45, 0.58, 12);
  dome(g, 1.0, 0.72, 0.3, 0.58, COPPER, 12, 0.9);
  // steps
  g.color(STONE_DARK).box(0.45, 0, 1.72, 1.55, 0.025, 1.84);
  g.color(r.pick([PAL.red, PAL.blue, 0x8e5bd6])).box(0.25, 0.25, 1.32, 0.38, 0.42, 1.335);
  g.box(1.62, 0.25, 1.32, 1.75, 0.42, 1.335);
  bush(g, r, 0.2, 1.85, 1.2);
  bush(g, r, 1.8, 1.85, 1.2);
};
