/** Garbage models: incinerator, waste-to-energy and recycling. */
import type { ModelFn } from '../types';
import { shade, WIN } from '../../geom';
import { PAL } from '../../palette';
import { chimney, pylon, truck } from './shared';

// ----------------------------------------------------------------- garbage

export const incinerator: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0x8f9399, 0x9a958c, 0x7f868c]);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(0.15, 0, 0.25, 1.35, 0.48, 1.45, { top: PAL.flatRoofDark });
  g.color(shade(wall, 0.92)).win(WIN.IND, 0.2, 0.2);
  g.box(1.35, 0, 0.75, 1.85, 0.22, 1.45, { noTop: true });
  g.noWin().color(PAL.roofs.slate).shed(1.35, 0.75, 1.85, 1.45, 0.22, 0.08);
  g.color(0xe8873a).box(0.5, 0.06, 1.45, 0.95, 0.2, 1.46);
  chimney(g, 1.6, 0.4, 0.12, 0.09, 1.3, 0x9a958c, PAL.red);
  truck(g, 0.6, 1.72, 0x4caf50, PAL.white, true, 0.32);
  g.color(0x7a6a52).pyramid(1.55, 1.7, 0.4, 0.36, 0, 0.12);
  g.color(0x5f6b52).pyramid(1.75, 1.55, 0.25, 0.25, 0, 0.08);
};

export const waste_to_energy: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0x8fa39a, 0x9aa8b0, 0xa7a29a]);
  g.color(wall).win(WIN.IND, 0.22, 0.22);
  g.box(0.25, 0, 0.25, 2.0, 0.62, 2.05, { noTop: true });
  g.noWin().color(PAL.roofs.charcoal).shed(0.25, 0.25, 2.0, 2.05, 0.62, 0.22);
  g.color(shade(wall, 0.9)).win(WIN.IND, 0.2, 0.2);
  g.box(0.5, 0, 0.45, 1.2, 1.05, 1.05, { top: PAL.flatRoofDark });
  g.color(0xdfe6ea).win(WIN.GLASS, 0.12, 0.14);
  g.box(2.1, 0, 1.2, 2.8, 0.36, 2.65, { top: PAL.flatRoof });
  g.noWin();
  chimney(g, 2.45, 0.55, 0.14, 0.1, 1.55, 0xc8ccd0, 0x4caf50);
  truck(g, 0.8, 2.45, 0x4caf50, PAL.white, true, 0.32);
  truck(g, 1.5, 2.6, 0x4caf50, PAL.white, true, 0.32);
  pylon(g, 2.75, 2.85, 0.7);
};

export const recycling_center: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xb8c9a8, 0xc9d6c3, 0xa7b89a]);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(0.15, 0, 0.15, 1.3, 0.4, 1.1, { noTop: true });
  g.noWin().color(0x4f8a46).shed(0.15, 0.15, 1.3, 1.1, 0.4, 0.14);
  const bins = [0x3f7fd6, 0x4caf50, 0xf2c94c, 0x8a9096];
  for (let i = 0; i < 4; i++) {
    g.color(bins[i]).box(0.2 + i * 0.27, 0, 1.3, 0.42 + i * 0.27, 0.12, 1.5, { top: shade(bins[i], 0.8) });
  }
  const piles = [0xa8845a, 0x5fae6a, 0x9aa0a6, 0xd8c050];
  for (let i = 0; i < 4; i++) {
    g.color(piles[i]).pyramid(1.5 + (i % 2) * 0.3, 0.4 + Math.floor(i / 2) * 0.45, 0.3, 0.3, 0, 0.12 + (i % 2) * 0.03);
  }
  g.color(PAL.steel).beam([1.5, 0.1, 1.4], [1.3, 0.35, 0.8], 0.05);
  truck(g, 1.5, 1.75, 0x3f7fd6, PAL.white, true, 0.32);
};
