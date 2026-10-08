/** Parks and recreation models. */
import type { ModelFn } from '../types';
import {
  anyTree,
  ASPHALT,
  bench,
  blob,
  boat,
  bush,
  car,
  deck,
  dome,
  fence,
  flag,
  lamp,
  type P2,
  PATH,
  STONE,
  STONE_DARK,
  tree,
  WATER,
  WHITE,
} from './shared';
import { PAL } from '../../palette';
import { FLOOR, shade, WIN } from '../../geom';

// ------------------------------------------------------------------- parks

export const small_park: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.45, 0.0, 0.55, 1.0, 0.013, PATH);
  deck(g, 0.0, 0.45, 1.0, 0.55, 0.0135, PATH);
  g.noWin().color(0x6a4a32).cylinder(0.5, 0.5, 0.11, 0, 0.03, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const fx = 0.5 + Math.cos(a) * 0.06;
    const fz = 0.5 + Math.sin(a) * 0.06;
    deck(g, fx - 0.022, fz - 0.022, fx + 0.022, fz + 0.022, 0.034, r.pick(PAL.flower));
  }
  for (const [x, z] of [
    [0.22, 0.22],
    [0.78, 0.22],
    [0.22, 0.78],
    [0.78, 0.78],
  ] as P2[]) {
    anyTree(g, r, x + (r.next() - 0.5) * 0.12, z + (r.next() - 0.5) * 0.12, 0.9 + r.next() * 0.4);
  }
  bench(g, 0.38, 0.3, false);
  bench(g, 0.62, 0.7, false);
  lamp(g, 0.39, 0.61, 0.2);
};

export const plaza: ModelFn = (g, c) => {
  const r = c.rng;
  const tileHex = shade(r.pick([0xd9d2c2, 0xcfc8b8, 0xe0d6c0]), 0.9);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) if ((i + j) % 2) deck(g, i * 0.25, j * 0.25, (i + 1) * 0.25, (j + 1) * 0.25, 0.013, tileHex);
  g.noWin().color(STONE).cylinder(0.5, 0.5, 0.2, 0, 0.05, 8, WATER);
  g.color(STONE_DARK).cylinder(0.5, 0.5, 0.035, 0.05, 0.16, 5);
  g.color(STONE).frustum(0.5, 0.5, 0.04, 0.09, 0.16, 0.19, 6);
  g.color(0xbfe6f5).cone(0.5, 0.5, 0.03, 0.19, 0.29, 5);
  tree(g, r, 0.13, 0.13, 0.9);
  tree(g, r, 0.87, 0.87, 0.9);
  lamp(g, 0.87, 0.13, 0.22);
  lamp(g, 0.13, 0.87, 0.22);
  bench(g, 0.5, 0.18);
  bench(g, 0.5, 0.82);
};

export const playground: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.08, 0.08, 0.92, 0.92, 0.013, PAL.sand);
  // swings
  const frame = r.pick([PAL.red, PAL.blue, PAL.green]);
  g.noWin().color(frame);
  for (const x of [0.15, 0.55]) {
    g.beam([x, 0, 0.2], [x, 0.22, 0.3], 0.015);
    g.beam([x, 0, 0.4], [x, 0.22, 0.3], 0.015);
  }
  g.beam([0.15, 0.22, 0.3], [0.55, 0.22, 0.3], 0.015);
  g.color(PAL.steelDark);
  for (const x of [0.27, 0.43]) {
    g.beam([x, 0.22, 0.3], [x, 0.06, 0.3], 0.006);
    g.color(PAL.yellow).box(x - 0.03, 0.05, 0.28, x + 0.03, 0.06, 0.32);
    g.color(PAL.steelDark);
  }
  // slide tower
  g.color(r.pick([PAL.yellow, PAL.orange])).box(0.64, 0, 0.5, 0.8, 0.2, 0.66, { top: PAL.wood });
  g.color(PAL.red).pyramid(0.72, 0.58, 0.2, 0.2, 0.2, 0.1);
  g.color(PAL.blue).panel([0.69, 0.015, 0.92], [0.75, 0.015, 0.92], [0.75, 0.16, 0.66], [0.69, 0.16, 0.66]);
  // seesaw + sandbox
  g.color(PAL.green).beam([0.2, 0.03, 0.75], [0.48, 0.09, 0.75], 0.025);
  g.color(PAL.wood).box(0.6, 0, 0.75, 0.88, 0.03, 0.88, { top: 0xf0dca0 });
  fence(g, 0.03, 0.03, 0.97, 0.97, 0.05, PAL.wood, 0.01, [0.42, 0.58]);
  tree(g, r, 0.88, 0.15, 0.9);
};

export const sports_field: ModelFn = (g, c) => {
  const r = c.rng;
  for (let i = 0; i < 6; i++) deck(g, 0.1, 0.12 + i * 0.29, 1.58, 0.12 + (i + 1) * 0.29, 0.013, i % 2 ? 0x6fae44 : 0x79b94c);
  const W = WHITE;
  deck(g, 0.16, 0.18, 1.52, 0.2, 0.015, W);
  deck(g, 0.16, 1.66, 1.52, 1.68, 0.015, W);
  deck(g, 0.16, 0.18, 0.18, 1.68, 0.015, W);
  deck(g, 1.5, 0.18, 1.52, 1.68, 0.015, W);
  deck(g, 0.16, 0.92, 1.52, 0.94, 0.015, W);
  deck(g, 0.6, 0.2, 0.62, 0.42, 0.015, W);
  deck(g, 1.06, 0.2, 1.08, 0.42, 0.015, W);
  deck(g, 0.6, 0.4, 1.08, 0.42, 0.015, W);
  deck(g, 0.6, 1.44, 0.62, 1.66, 0.015, W);
  deck(g, 1.06, 1.44, 1.08, 1.66, 0.015, W);
  deck(g, 0.6, 1.44, 1.08, 1.46, 0.015, W);
  g.noWin().color(W);
  for (const z of [0.19, 1.67]) {
    g.beam([0.74, 0, z], [0.74, 0.08, z], 0.014);
    g.beam([0.94, 0, z], [0.94, 0.08, z], 0.014);
    g.beam([0.74, 0.08, z], [0.94, 0.08, z], 0.014);
  }
  // bleachers
  const seat = r.pick([PAL.blue, PAL.red, 0x8a9096]);
  for (let s = 0; s < 3; s++) {
    g.color(s % 2 ? seat : shade(seat, 0.85));
    g.box(1.64 + s * 0.1, 0, 0.3, 1.96, 0.04 + s * 0.04, 1.56);
  }
  // floodlights
  for (const z of [0.08, 1.92]) {
    g.color(PAL.steel).beam([1.62, 0, z], [1.62, 0.55, z], 0.025);
    g.color(0xfff0c0).box(1.56, 0.55, z - 0.04, 1.68, 0.6, z + 0.04, { win: WIN.SHOP, cellW: 0.06, cellH: 0.05 });
  }
};

export const large_park: ModelFn = (g, c) => {
  const r = c.rng;
  // pond with sandy shore
  blob(g, r, 1.95, 0.95, 0.66, 0.48, 0.0125, PAL.sand, 12, 0.1);
  blob(g, r, 1.95, 0.95, 0.58, 0.4, 0.016, WATER, 12, 0.12);
  // paths
  deck(g, 0.0, 1.92, 3.0, 2.06, 0.013, PATH);
  deck(g, 0.98, 0.0, 1.12, 3.0, 0.0135, PATH);
  deck(g, 1.12, 1.45, 2.4, 1.55, 0.013, PATH);
  // gazebo
  g.noWin().color(WHITE).cylinder(0.5, 2.55, 0.17, 0, 0.035, 8);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = 0.5 + Math.cos(a) * 0.13;
    const z = 2.55 + Math.sin(a) * 0.13;
    g.box(x - 0.008, 0.035, z - 0.008, x + 0.008, 0.17, z + 0.008, { noTop: true });
  }
  g.color(r.pick([PAL.roofs.green, PAL.roofs.red, PAL.roofs.slate])).cone(0.5, 2.55, 0.21, 0.17, 0.3, 8);
  // flower beds
  blob(g, r, 2.5, 2.5, 0.22, 0.15, 0.014, 0x6a4a32, 8, 0.2);
  for (let i = 0; i < 6; i++) bush(g, r, 2.36 + (i % 3) * 0.13, 2.45 + Math.floor(i / 3) * 0.1, 0.7, r.pick(PAL.flower));
  // trees, avoiding pond/paths/gazebo
  let placed = 0;
  for (let tries = 0; tries < 80 && placed < 16; tries++) {
    const x = 0.12 + r.next() * 2.76;
    const z = 0.12 + r.next() * 2.76;
    if (Math.abs(z - 1.99) < 0.16 || Math.abs(x - 1.05) < 0.16) continue;
    if (((x - 1.95) / 0.78) ** 2 + ((z - 0.95) / 0.58) ** 2 < 1) continue;
    if (Math.hypot(x - 0.5, z - 2.55) < 0.32) continue;
    if (Math.hypot(x - 2.5, z - 2.5) < 0.3) continue;
    if (Math.abs(z - 1.5) < 0.12 && x > 1.1 && x < 2.45) continue;
    anyTree(g, r, x, z, 0.9 + r.next() * 0.5);
    placed++;
  }
  bench(g, 0.6, 1.84);
  bench(g, 2.2, 2.14);
  bench(g, 0.9, 1.0, false);
  lamp(g, 1.2, 1.84, 0.22);
  lamp(g, 0.9, 2.3, 0.22);
};

export const marina: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.08, 0.12, 0.9, 0.95, 0.012, ASPHALT);
  for (let i = 0; i < 3; i++) car(g, 0.25 + i * 0.27, 0.5, r.pick(PAL.cars), false);
  // clubhouse
  const wall = r.pick([WHITE, 0xeef2f0, 0xf2ece4]);
  g.color(wall).win(WIN.RES, 0.12, FLOOR);
  g.box(1.08, 0, 0.18, 1.86, FLOOR * 1.6, 0.85, { noTop: true });
  g.noWin()
    .color(r.pick([PAL.roofs.blue, PAL.roofs.slate, PAL.roofs.green]))
    .hip(1.08, 0.18, 1.86, 0.85, FLOOR * 1.6, 0.12, 0.03);
  flag(g, 1.0, 1.0, 0.45, r.pick([PAL.blue, PAL.red]));
  // boardwalk + piers over the water
  g.color(PAL.wood).box(0, -0.25, 1.35, 2, 0.03, 1.62, { top: 0xa47e58 });
  for (const x of [0.3, 0.95, 1.6]) {
    g.color(PAL.wood).box(x, -0.25, 1.62, x + 0.09, 0.025, 2.38, { top: 0xa47e58 });
  }
  boat(g, r, 0.52, 1.72, 0.42, 0.13, true);
  boat(g, r, 1.17, 1.75, 0.38, 0.12, r.chance(0.5));
  boat(g, r, 1.82, 1.7, 0.42, 0.13, true);
  boat(g, r, 0.16, 1.9, 0.34, 0.11, false);
  lamp(g, 0.05, 1.45, 0.2);
  lamp(g, 1.95, 1.45, 0.2);
};

export const zoo: ModelFn = (g, c) => {
  const r = c.rng;
  // paths
  deck(g, 1.42, 1.55, 1.58, 3.0, 0.013, PATH);
  deck(g, 0.2, 1.48, 2.8, 1.62, 0.0135, PATH);
  // gate
  g.noWin().color(STONE_DARK);
  g.box(1.18, 0, 2.84, 1.3, 0.3, 2.96);
  g.box(1.7, 0, 2.84, 1.82, 0.3, 2.96);
  g.color(0x4f8a36).box(1.16, 0.3, 2.84, 1.84, 0.38, 2.96);
  // savanna enclosure
  deck(g, 0.18, 0.15, 1.35, 1.38, 0.013, 0xd9c38a);
  fence(g, 0.15, 0.12, 1.38, 1.4, 0.05, PAL.wood, 0.012);
  // giraffe
  g.color(0xe8b84a);
  g.box(0.5, 0.12, 0.55, 0.68, 0.19, 0.62);
  g.box(0.51, 0, 0.56, 0.53, 0.12, 0.61, { noTop: true });
  g.box(0.65, 0, 0.56, 0.67, 0.12, 0.61, { noTop: true });
  g.beam([0.66, 0.17, 0.585], [0.73, 0.36, 0.585], 0.025);
  g.box(0.71, 0.35, 0.57, 0.78, 0.39, 0.6);
  // elephant
  g.color(0x8a8f94);
  g.box(0.88, 0.05, 0.85, 1.1, 0.17, 0.97);
  g.box(0.9, 0, 0.86, 1.08, 0.05, 0.96, { noTop: true });
  g.sphere(1.13, 0.15, 0.91, 0.055, 0);
  g.beam([1.17, 0.13, 0.91], [1.2, 0.03, 0.91], 0.02);
  // acacia trees
  for (const [x, z] of [
    [0.35, 1.1],
    [1.15, 0.35],
  ] as P2[]) {
    g.color(PAL.trunk).beam([x, 0, z], [x, 0.18, z], 0.02);
    g.color(0x6f9a3c).sphere(x, 0.2, z, 0.13, 0, 0.35);
  }
  // penguin pool
  fence(g, 1.62, 0.12, 2.85, 1.4, 0.05, PAL.steel, 0.01);
  blob(g, r, 2.25, 0.7, 0.45, 0.38, 0.016, WATER, 10, 0.15);
  g.color(0x9a958c).pyramid(1.85, 1.15, 0.25, 0.2, 0, 0.12);
  g.color(0xa8a49c).pyramid(2.65, 0.3, 0.2, 0.25, 0, 0.1);
  for (let i = 0; i < 5; i++) {
    const x = 1.8 + r.next() * 0.25;
    const z = 0.3 + r.next() * 0.25;
    g.color(PAL.black).cone(x, z, 0.022, 0, 0.07, 4, 0.4);
    g.color(WHITE).sphere(x + 0.006, 0.045, z + 0.006, 0.012, 0);
  }
  // lion enclosure
  deck(g, 0.2, 1.75, 1.3, 2.75, 0.013, 0xb8c46a);
  fence(g, 0.18, 1.72, 1.32, 2.78, 0.05, PAL.wood, 0.012);
  g.color(0x9a958c).pyramid(0.55, 2.2, 0.4, 0.35, 0, 0.15);
  g.color(0xd99a3a);
  g.sphere(0.95, 0.05, 2.3, 0.05, 0, 0.8);
  g.sphere(0.85, 0.045, 2.5, 0.045, 0, 0.8);
  // aviary dome
  dome(g, 2.3, 2.25, 0.38, 0, 0xcfd8dc, 10, 0.9);
  tree(g, r, 1.95, 2.75, 0.9);
  tree(g, r, 2.75, 2.8, 1.1);
  tree(g, r, 2.85, 1.75, 0.8);
};

export const stadium: ModelFn = (g, c) => {
  const r = c.rng;
  const cx = 2;
  const cz = 2;
  const outer = 1.86;
  const top = 0.56;
  deck(g, 0.05, 0.05, 3.95, 3.95, 0.012, 0xb9b4aa);
  g.noWin().color(0xd9d4c8);
  g.lathe(
    cx,
    cz,
    [
      [outer, 0],
      [outer, top],
    ],
    20,
    0,
    false,
  );
  g.color(0xbfb9ad);
  g.lathe(
    cx,
    cz,
    [
      [outer, top],
      [outer - 0.1, top],
    ],
    20,
    0,
    false,
  );
  const seatA = r.pick([0x3f7fd6, 0xd6453d, 0x4caf50, 0xe8873a]);
  g.color(seatA);
  g.lathe(
    cx,
    cz,
    [
      [outer - 0.1, top],
      [1.38, 0.3],
    ],
    20,
    0,
    false,
  );
  g.color(shade(seatA, 0.75));
  g.lathe(
    cx,
    cz,
    [
      [1.38, 0.3],
      [1.1, 0.1],
    ],
    20,
    0,
    false,
  );
  g.color(0x6a6a6a);
  g.lathe(
    cx,
    cz,
    [
      [1.1, 0.1],
      [1.08, 0.02],
    ],
    20,
    0,
    false,
  );
  // pitch
  blob(g, r, cx, cz, 1.09, 1.09, 0.02, 0x5f9a3c, 20, 0);
  deck(g, 1.35, 1.48, 2.65, 2.52, 0.022, 0x79b94c);
  deck(g, 1.35, 1.48, 2.65, 1.5, 0.024, WHITE);
  deck(g, 1.35, 2.5, 2.65, 2.52, 0.024, WHITE);
  deck(g, 1.35, 1.48, 1.37, 2.52, 0.024, WHITE);
  deck(g, 2.63, 1.48, 2.65, 2.52, 0.024, WHITE);
  deck(g, 1.99, 1.48, 2.01, 2.52, 0.024, WHITE);
  // scoreboard
  g.color(PAL.black).box(1.7, top + 0.05, 0.12, 2.3, top + 0.3, 0.18, { win: WIN.SHOP, cellW: 0.15, cellH: 0.12 });
  g.color(PAL.steelDark).box(1.95, top, 0.13, 2.05, top + 0.05, 0.17);
  // floodlights in the corners
  for (const [x, z] of [
    [0.32, 0.32],
    [3.68, 0.32],
    [0.32, 3.68],
    [3.68, 3.68],
  ] as P2[]) {
    g.color(PAL.steel).beam([x, 0, z], [x, 1.05, z], 0.05);
    g.color(0xfff0c0).box(x - 0.1, 1.05, z - 0.1, x + 0.1, 1.14, z + 0.1, { win: WIN.SHOP, cellW: 0.1, cellH: 0.09 });
  }
};
