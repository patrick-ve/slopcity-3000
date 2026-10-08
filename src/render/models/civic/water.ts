/** Water utility models: pumps, towers, treatment and desalination. */
import type { ModelFn } from '../types';
import { deck, type P2, tank, WATER } from './shared';
import { shade, WIN } from '../../geom';
import { PAL } from '../../palette';

// ------------------------------------------------------------------- water

export const water_pump: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.12, 0.12, 0.88, 0.88, 0.012, 0xb5b0a6);
  const wall = r.pick([0xb5654a, 0xa65a3f, 0xc9b49a]);
  g.color(wall).win(WIN.IND, 0.14, 0.12);
  g.box(0.2, 0, 0.25, 0.62, 0.2, 0.62, { noTop: true });
  g.noWin().color(PAL.roofs.slate).gable(0.2, 0.25, 0.62, 0.62, 0.2, 0.1, 'x', 0.025, wall);
  g.color(0x3f5f8f).box(0.36, 0, 0.62, 0.46, 0.12, 0.628);
  g.color(0x2f7fc8);
  g.cylinderX(0.62, 0.82, 0.07, 0.42, 0.045, 6);
  g.cylinder(0.82, 0.42, 0.05, 0, 0.12, 6);
  g.color(PAL.red).cylinder(0.72, 0.42, 0.03, 0.115, 0.135, 6);
  g.color(0xd8dde2).cylinder(0.74, 0.76, 0.09, 0, 0.18, 8, 0xb8c0c8);
};

export const water_tower: ModelFn = (g, c) => {
  const r = c.rng;
  const body = r.pick([0xe8eef2, 0xa9d3e3, 0xf2f2ee, 0x8fc0d8]);
  if (c.variant % 2 === 0) {
    g.noWin().color(PAL.steelDark);
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as P2[]) {
      g.beam([0.5 + dx * 0.22, 0, 0.5 + dz * 0.22], [0.5 + dx * 0.14, 0.62, 0.5 + dz * 0.14], 0.03);
    }
    g.beam([0.3, 0.3, 0.3], [0.7, 0.3, 0.7], 0.015);
    g.beam([0.7, 0.3, 0.3], [0.3, 0.3, 0.7], 0.015);
    g.color(body).cylinder(0.5, 0.5, 0.23, 0.6, 0.88, 10);
    g.color(shade(body, 0.85)).cone(0.5, 0.5, 0.25, 0.88, 1.0, 10);
    g.color(PAL.steelDark).cylinder(0.5, 0.5, 0.235, 0.6, 0.63, 10);
  } else {
    g.noWin().color(shade(body, 0.92)).cylinder(0.5, 0.5, 0.07, 0, 0.56, 8);
    g.color(body);
    g.lathe(
      0.5,
      0.5,
      [
        [0.06, 0.5],
        [0.22, 0.62],
        [0.28, 0.76],
        [0.21, 0.9],
        [0, 0.95],
      ],
      10,
    );
  }
  g.color(PAL.concrete).box(0.38, 0, 0.75, 0.62, 0.08, 0.9, { top: PAL.flatRoof });
};

export const water_treatment: ModelFn = (g, c) => {
  const r = c.rng;
  for (const [x, z] of [
    [0.48, 0.5],
    [1.45, 0.5],
  ] as P2[]) {
    g.noWin().color(PAL.concrete).cylinder(x, z, 0.36, 0, 0.07, 12, WATER);
    g.color(PAL.concreteDark).cylinder(x, z, 0.06, 0.07, 0.1, 6);
    g.color(PAL.steel).beam([x, 0.1, z], [x + 0.34, 0.1, z], 0.025);
  }
  // rectangular filter basins
  g.color(PAL.concrete).box(0.12, 0, 1.0, 0.95, 0.06, 1.85, { top: PAL.concreteDark });
  deck(g, 0.17, 1.05, 0.9, 1.4, 0.062, 0x5fb3d8);
  deck(g, 0.17, 1.45, 0.9, 1.8, 0.062, 0x4aa8d0);
  // control building
  const wall = r.pick([0xf2f2ee, 0xe6e2d8]);
  g.color(wall).win(WIN.CIVIC, 0.12, 0.12);
  g.box(1.1, 0, 1.05, 1.88, 0.24, 1.82, { top: PAL.flatRoof });
  g.noWin().color(0x3f7fd6).box(1.09, 0.17, 1.04, 1.89, 0.2, 1.83, { top: PAL.flatRoof });
  g.color(0x2f7fc8).beam([0.95, 0.04, 1.4], [1.1, 0.04, 1.4], 0.04);
  g.beam([0.48, 0.04, 0.86], [0.48, 0.04, 1.0], 0.04);
};

export const desalination: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xf2f2ee, 0xe2e8ec]);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(0.12, 0, 0.12, 1.88, 0.34, 0.85, { top: PAL.flatRoof });
  g.noWin().color(0x2f7fc8).box(0.11, 0.24, 0.11, 1.89, 0.28, 0.86, { top: PAL.flatRoof });
  tank(g, 0.42, 1.15, 0.2, 0.3, 0xdfe6ea, 10);
  tank(g, 0.92, 1.15, 0.2, 0.3, 0xdfe6ea, 10);
  g.color(0xc9d2d8).cylinder(1.42, 1.08, 0.07, 0, 0.62, 8);
  g.cylinder(1.66, 1.08, 0.07, 0, 0.62, 8);
  // pier with intake pipes over the water
  g.color(0xbab5ab).box(1.18, -0.35, 1.45, 1.42, 0.03, 2.38, { top: 0xa9a49a });
  g.color(0x2f7fc8);
  g.cylinderZ(1.3, 2.35, 1.55, 0.03, 0.04, 6);
  g.cylinderZ(1.3, 2.25, 0.7, 0.0, 0.04, 6);
  g.color(PAL.steelDark).box(1.2, 0.03, 2.2, 1.4, 0.12, 2.36);
  g.color(PAL.steel).beam([1.42, 0.25, 1.08], [1.42, 0.25, 0.85], 0.03);
};
