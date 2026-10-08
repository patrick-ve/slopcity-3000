/** Reward and business deal models. */
import type { ModelFn } from '../types';
import { PAL } from '../../palette';
import {
  blob,
  bush,
  columns,
  COPPER,
  deck,
  dome,
  fence,
  flag,
  GLASS_TINT,
  GOLD,
  lamp,
  type P2,
  palm,
  PATH,
  pine,
  STONE,
  STONE_DARK,
  tree,
  WATER,
  WHITE,
} from './shared';
import { FLOOR, shade, WIN } from '../../geom';

// ----------------------------------------------------------------- rewards

export const mayor_house: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xf4ede0, 0xf2f2ee, 0xe8dcc8]);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.charcoal]);
  deck(g, 0.94, 1.1, 1.06, 2.0, 0.013, PATH);
  // main block + wings
  g.color(wall).win(WIN.RES, 0.12, FLOOR);
  g.box(0.5, 0, 0.32, 1.5, FLOOR * 2.2, 0.98, { noTop: true });
  g.box(0.2, 0, 0.42, 0.5, FLOOR * 1.6, 0.92, { noTop: true });
  g.box(1.5, 0, 0.42, 1.8, FLOOR * 1.6, 0.92, { noTop: true });
  g.noWin().color(roof);
  g.hip(0.5, 0.32, 1.5, 0.98, FLOOR * 2.2, 0.18, 0.035);
  g.hip(0.2, 0.42, 0.5, 0.92, FLOOR * 1.6, 0.12, 0.03);
  g.hip(1.5, 0.42, 1.8, 0.92, FLOOR * 1.6, 0.12, 0.03);
  g.color(shade(wall, 0.85));
  g.box(0.7, FLOOR * 2.2 + 0.05, 0.6, 0.76, FLOOR * 2.2 + 0.2, 0.68);
  g.box(1.24, FLOOR * 2.2 + 0.05, 0.6, 1.3, FLOOR * 2.2 + 0.2, 0.68);
  // portico
  columns(g, 0.82, 1.18, 1.07, 0, 0.24, 4, 0.02, WHITE);
  g.color(WHITE).box(0.78, 0.24, 0.96, 1.22, 0.27, 1.12);
  g.color(roof).gable(0.78, 0.96, 1.22, 1.12, 0.27, 0.08, 'z', 0.01, WHITE);
  // garden: fountain, hedges, flowers, trees
  g.color(STONE).cylinder(1.0, 1.5, 0.13, 0, 0.04, 10, WATER);
  g.color(STONE_DARK).cylinder(1.0, 1.5, 0.025, 0.04, 0.12, 6);
  g.color(PAL.hedge);
  g.box(0.25, 0, 1.22, 0.86, 0.05, 1.27);
  g.box(1.14, 0, 1.22, 1.75, 0.05, 1.27);
  g.box(0.25, 0, 1.75, 0.86, 0.05, 1.8);
  g.box(1.14, 0, 1.75, 1.75, 0.05, 1.8);
  for (let i = 0; i < 6; i++) bush(g, r, 0.35 + i * 0.25 + (i >= 3 ? 0.1 : 0), 1.52, 0.7, r.pick(PAL.flower));
  pine(g, r, 0.12, 0.15, 1.1);
  tree(g, r, 1.88, 0.2, 1.1);
  tree(g, r, 0.12, 1.88, 1);
  tree(g, r, 1.88, 1.88, 1);
  g.color(STONE_DARK);
  g.box(0.84, 0, 1.9, 0.9, 0.12, 1.96);
  g.box(1.1, 0, 1.9, 1.16, 0.12, 1.96);
  flag(g, 1.4, 1.1, 0.5, r.pick([PAL.blue, PAL.red, PAL.green]));
};

export const city_hall: ModelFn = (g, c) => {
  const r = c.rng;
  const stone = r.pick([STONE, 0xeee6d4, 0xe2d9c4]);
  deck(g, 0.6, 2.3, 2.4, 2.96, 0.013, PATH);
  g.color(stone).win(WIN.CIVIC, 0.14, 0.14);
  g.box(0.25, 0, 0.3, 2.75, 0.42, 1.95, { top: PAL.flatRoof });
  g.noWin().color(shade(stone, 0.92)).box(0.24, 0.42, 0.29, 2.76, 0.46, 1.96, { top: PAL.flatRoof });
  // portico
  columns(g, 1.02, 1.98, 2.18, 0, 0.42, 6, 0.035, stone);
  g.color(shade(stone, 0.95)).box(0.95, 0.42, 1.92, 2.05, 0.48, 2.3);
  g.color(PAL.roofs.slate).gable(0.95, 1.92, 2.05, 2.3, 0.48, 0.17, 'z', 0.015, stone);
  g.color(STONE_DARK).box(1.0, 0, 2.3, 2.0, 0.02, 2.42);
  // drum + dome + lantern
  g.color(stone).cylinder(1.5, 1.1, 0.5, 0.46, 0.72, 12);
  g.color(shade(stone, 0.9)).cylinder(1.5, 1.1, 0.52, 0.72, 0.75, 12);
  dome(g, 1.5, 1.1, 0.48, 0.75, r.pick([COPPER, GOLD, 0x8a9aa8]), 12, 0.85);
  g.color(stone).cylinder(1.5, 1.1, 0.07, 1.15, 1.26, 6);
  g.color(COPPER).cone(1.5, 1.1, 0.09, 1.26, 1.38, 6);
  g.push().translate(0, 1.36, 0);
  flag(g, 1.5, 1.1, 0.22, PAL.blue);
  g.pop();
  for (const x of [0.75, 2.25]) flag(g, x, 2.55, 0.45, r.pick([PAL.red, PAL.blue, PAL.green]));
  tree(g, r, 0.3, 2.6, 1.1);
  tree(g, r, 2.7, 2.6, 1.1);
  lamp(g, 1.0, 2.8, 0.22);
  lamp(g, 2.0, 2.8, 0.22);
};

export const statue: ModelFn = (g, c) => {
  const r = c.rng;
  const bronze = r.pick([0x5f8f7a, 0x8a6a3a, 0x6f9a8a]);
  g.noWin().color(STONE_DARK).box(0.24, 0, 0.24, 0.76, 0.04, 0.76);
  g.color(STONE).box(0.36, 0.04, 0.36, 0.64, 0.26, 0.64);
  g.color(STONE_DARK).box(0.34, 0.26, 0.34, 0.66, 0.29, 0.66);
  g.color(bronze);
  g.frustum(0.5, 0.5, 0.07, 0.05, 0.29, 0.47, 6);
  g.sphere(0.5, 0.51, 0.5, 0.036, 0);
  g.cylinder(0.5, 0.5, 0.03, 0.535, 0.56, 6);
  g.beam([0.54, 0.44, 0.5], [0.6, 0.6, 0.5], 0.025);
  g.beam([0.46, 0.44, 0.5], [0.42, 0.33, 0.52], 0.025);
  g.color(GOLD).box(0.585, 0.59, 0.485, 0.615, 0.64, 0.515);
  for (const [x, z] of [
    [0.12, 0.12],
    [0.88, 0.12],
    [0.12, 0.88],
    [0.88, 0.88],
  ] as P2[]) {
    g.color(PAL.hedge).box(x - 0.06, 0, z - 0.06, x + 0.06, 0.06, z + 0.06);
  }
  lamp(g, 0.5, 0.92, 0.2);
};

export const landmark_tower: ModelFn = (g, c) => {
  const r = c.rng;
  const main = r.pick([0xf2f2ee, 0xe2e8ec, 0xe8e2d8]);
  const accent = r.pick([PAL.red, 0x2bb3a3, GOLD, PAL.orange]);
  deck(g, 0.08, 0.08, 1.92, 1.92, 0.012, PATH);
  // tripod legs
  g.noWin().color(main);
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + (k * Math.PI * 2) / 3;
    g.beam([1 + Math.cos(a) * 0.78, 0, 1 + Math.sin(a) * 0.78], [1 + Math.cos(a) * 0.1, 2.3, 1 + Math.sin(a) * 0.1], 0.08);
  }
  // shaft
  g.frustum(1, 1, 0.16, 0.1, 0, 4.2, 8);
  // base pavilion
  g.color(0xdfe8ee).win(WIN.GLASS, 0.12, 0.14);
  g.box(0.62, 0, 0.62, 1.38, 0.16, 1.38, { top: main });
  g.noWin();
  // observation pod
  g.color(main);
  g.lathe(
    1,
    1,
    [
      [0.1, 4.05],
      [0.42, 4.22],
    ],
    12,
    0,
    false,
  );
  g.color(GLASS_TINT);
  g.lathe(
    1,
    1,
    [
      [0.42, 4.22],
      [0.48, 4.36],
    ],
    12,
    0,
    false,
  );
  g.color(accent);
  g.lathe(
    1,
    1,
    [
      [0.48, 4.36],
      [0.4, 4.48],
      [0.16, 4.58],
      [0.08, 4.6],
    ],
    12,
  );
  // spire
  g.color(main).cone(1, 1, 0.07, 4.6, 5.9, 6);
  g.color(accent).sphere(1, 5.25, 1, 0.05, 0);
};

export const arcology: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.04, 0.04, 3.96, 3.96, 0.012, PATH);
  const tiers = 6;
  const th = 0.72;
  const step = 0.26;
  for (let k = 0; k < tiers; k++) {
    const inset = 0.12 + k * step;
    const y0 = k * th;
    const y1 = y0 + th;
    g.color(k % 2 ? 0xe2eaef : 0xd2dde5).win(WIN.GLASS, 0.12, FLOOR);
    g.box(inset, y0, inset, 4 - inset, y1, 4 - inset, { top: 0x7fae5a });
    if (k < tiers - 1) {
      g.noWin();
      const m = inset + step * 0.5;
      const pts: P2[] = [
        [m, m],
        [4 - m, m],
        [m, 4 - m],
        [4 - m, 4 - m],
        [2, m],
        [2, 4 - m],
        [m, 2],
        [4 - m, 2],
      ];
      for (const [x, z] of pts) {
        g.color(r.pick(PAL.leaf)).cone(x, z, 0.1, y1, y1 + 0.24, 6, r.next() * 3);
      }
    }
  }
  const topY = tiers * th;
  dome(g, 2, 2, 0.5, topY, 0x9fd0e0, 12, 0.7);
  g.color(0xe8ecef).cone(2, 2, 0.08, topY + 0.3, topY + 1.4, 6);
  g.color(PAL.red).sphere(2, topY + 1.42, 2, 0.04, 0);
};

export const casino: ModelFn = (g, c) => {
  const r = c.rng;
  const body = r.pick([0x9b2335, 0x6a2c8f, 0x1f3f8f]);
  deck(g, 0.08, 1.4, 1.92, 1.95, 0.012, 0x8a2b3a);
  g.color(body).win(WIN.SHOP, 0.2, 0.26);
  g.box(0.15, 0, 0.35, 1.85, 0.26, 1.35, { top: PAL.flatRoofDark });
  g.noWin().color(GOLD).box(0.14, 0.26, 0.34, 1.86, 0.3, 1.36, { top: PAL.flatRoof });
  // hotel tower
  g.color(GOLD).win(WIN.GLASS, 0.1, FLOOR);
  g.box(0.22, 0, 0.4, 0.82, 1.3, 0.95, { noTop: true });
  g.noWin().color(shade(GOLD, 0.85)).pyramid(0.52, 0.675, 0.6, 0.55, 1.3, 0.25);
  // entrance canopy
  g.color(GOLD).box(0.95, 0.16, 1.35, 1.55, 0.19, 1.62);
  g.color(PAL.steelDark);
  g.box(0.97, 0, 1.58, 0.99, 0.16, 1.6, { noTop: true });
  g.box(1.51, 0, 1.58, 1.53, 0.16, 1.6, { noTop: true });
  // big sign (lit at night)
  g.color(PAL.black).box(1.64, 0, 1.55, 1.71, 0.5, 1.62, { noTop: true });
  g.color(r.pick([0xe86a92, PAL.yellow, 0xf2a93b])).box(1.5, 0.5, 1.56, 1.86, 0.8, 1.62, { win: WIN.SHOP, cellW: 0.09, cellH: 0.075 });
  g.noWin().color(PAL.yellow).sphere(1.68, 0.86, 1.59, 0.05, 0);
  // fountain + palms
  g.color(STONE).cylinder(0.5, 1.68, 0.18, 0, 0.04, 10, WATER);
  g.color(0xbfe6f5).cone(0.5, 1.68, 0.03, 0.04, 0.2, 6);
  palm(g, r, 0.15, 1.5, 1.1);
  palm(g, r, 0.85, 1.85, 1.0);
  palm(g, r, 1.9, 0.2, 1.1);
};

export const prison: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xa9a49a, 0x9a958c, 0xb5b0a6]);
  deck(g, 0.2, 0.2, 2.8, 2.8, 0.013, 0x9a9488);
  // perimeter wall with front gate
  g.noWin().color(wall);
  g.box(0.1, 0, 0.1, 2.9, 0.3, 0.18);
  g.box(0.1, 0, 0.1, 0.18, 0.3, 2.9);
  g.box(2.82, 0, 0.1, 2.9, 0.3, 2.9);
  g.box(0.1, 0, 2.82, 1.3, 0.3, 2.9);
  g.box(1.7, 0, 2.82, 2.9, 0.3, 2.9);
  g.color(0x3a3c40).box(1.3, 0, 2.84, 1.7, 0.26, 2.88);
  // guard towers
  for (const [x, z] of [
    [0.14, 0.14],
    [2.86, 0.14],
    [0.14, 2.86],
    [2.86, 2.86],
  ] as P2[]) {
    g.color(wall).box(x - 0.09, 0, z - 0.09, x + 0.09, 0.5, z + 0.09);
    g.color(0xd8d4cc).win(WIN.IND, 0.08, 0.08);
    g.box(x - 0.13, 0.5, z - 0.13, x + 0.13, 0.62, z + 0.13, { noTop: true });
    g.noWin().color(PAL.roofs.charcoal).pyramid(x, z, 0.3, 0.3, 0.62, 0.08);
  }
  // cell blocks
  g.color(shade(wall, 1.08)).win(WIN.IND, 0.1, FLOOR);
  g.box(0.45, 0, 0.42, 2.55, 0.42, 0.95, { top: PAL.flatRoof });
  g.box(0.45, 0, 1.2, 1.35, 0.32, 2.4, { top: PAL.flatRoof });
  g.noWin();
  // yard with basketball court
  deck(g, 1.6, 1.25, 2.55, 2.35, 0.015, 0x7d848a);
  deck(g, 2.06, 1.25, 2.08, 2.35, 0.017, WHITE);
  g.color(PAL.steelDark).beam([2.07, 0, 1.3], [2.07, 0.12, 1.3], 0.012);
  g.color(PAL.steelDark).beam([2.07, 0, 2.3], [2.07, 0.12, 2.3], 0.012);
};

export const toxic_dump: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.1, 0.1, 2.9, 2.9, 0.013, 0x8a8a5a);
  fence(g, 0.06, 0.06, 2.94, 2.94, 0.08, PAL.steel, 0.01, [1.35, 1.65]);
  blob(g, r, 0.9, 0.85, 0.55, 0.42, 0.016, 0x9be33a, 10, 0.25);
  blob(g, r, 2.1, 2.0, 0.45, 0.4, 0.016, 0xb6e03a, 10, 0.25);
  g.emitter(0.9, 0.05, 0.85, 'dark');
  g.emitter(2.1, 0.05, 2.0, 'dark');
  g.color(0x7a6a4a).pyramid(2.2, 0.7, 0.7, 0.6, 0, 0.18);
  g.color(0x6a5a3a).pyramid(0.75, 2.2, 0.5, 0.6, 0, 0.14);
  // barrel clusters
  const barrel = [0xe8c53a, 0xd9a82a, 0x8a5a3a, 0x4f7f3f];
  for (const [bx, bz] of [
    [1.55, 0.6],
    [0.55, 1.6],
    [2.3, 1.2],
  ] as P2[]) {
    for (let i = 0; i < 7; i++) {
      const x = bx + (i % 3) * 0.085 + (r.next() - 0.5) * 0.02;
      const z = bz + Math.floor(i / 3) * 0.085 + (r.next() - 0.5) * 0.02;
      g.color(r.pick(barrel)).cylinder(x, z, 0.035, 0, 0.09, 6);
    }
  }
  // warning sign
  g.color(PAL.steelDark);
  g.box(1.2, 0, 2.86, 1.22, 0.2, 2.88, { noTop: true });
  g.box(1.32, 0, 2.86, 1.34, 0.2, 2.88, { noTop: true });
  g.color(PAL.yellow).box(1.17, 0.14, 2.88, 1.37, 0.26, 2.9);
  g.color(PAL.black).box(1.25, 0.17, 2.9, 1.29, 0.23, 2.906);
};
