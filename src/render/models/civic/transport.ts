/** Transport models: bus stop, train station, seaport and airport. */
import type { ModelFn } from '../types';
import { FLOOR, shade, WIN } from '../../geom';
import { airplane, ASPHALT, bench, car, deck, type G, GLASS_TINT, lamp, type P2, PATH, prism, tree, WHITE } from './shared';
import { PAL } from '../../palette';

// --------------------------------------------------------------- transport

export const bus_stop: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.05, 0.86, 0.95, 0.94, 0.013, PAL.laneYellow);
  const frame = r.pick([0x3f7fd6, 0x2bb3a3, 0x6b7280, 0xd6453d]);
  g.noWin().color(frame);
  for (const [px, pz] of [
    [0.31, 0.63],
    [0.69, 0.63],
    [0.31, 0.77],
    [0.69, 0.77],
  ] as P2[]) {
    g.box(px - 0.01, 0, pz - 0.01, px + 0.01, 0.17, pz + 0.01, { noTop: true });
  }
  g.box(0.28, 0.17, 0.6, 0.72, 0.19, 0.8);
  g.color(0xa9d3e3);
  g.panel([0.31, 0.02, 0.63], [0.69, 0.02, 0.63], [0.69, 0.15, 0.63], [0.31, 0.15, 0.63]);
  g.panel([0.31, 0.02, 0.63], [0.31, 0.02, 0.76], [0.31, 0.15, 0.76], [0.31, 0.15, 0.63]);
  g.color(PAL.wood).box(0.36, 0.035, 0.645, 0.64, 0.05, 0.69);
  // ad panel (lit at night)
  g.color(r.pick(PAL.awnings)).box(0.69, 0.03, 0.645, 0.705, 0.15, 0.76, { win: WIN.SHOP, cellW: 0.11, cellH: 0.12 });
  // bus stop sign
  g.color(PAL.steelDark).box(0.875, 0, 0.82, 0.89, 0.25, 0.835, { noTop: true });
  g.color(0x2f6fd6).box(0.85, 0.2, 0.822, 0.915, 0.27, 0.833);
  tree(g, r, 0.14, 0.25, 0.95);
  tree(g, r, 0.82, 0.22, 0.85);
  bench(g, 0.5, 0.32);
  lamp(g, 0.1, 0.62, 0.22);
};

export const train_station: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick([0xd9c7a7, 0xc9a882, 0xa65a3f, 0xb5654a]);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.green, PAL.roofs.red]);
  // forecourt at the back (road side)
  deck(g, 0.1, 0.02, 1.9, 0.18, 0.012, PATH);
  // station hall
  g.color(wall).win(WIN.CIVIC, 0.12, FLOOR * 1.25);
  g.box(0.15, 0, 0.18, 1.85, 0.32, 1.0, { noTop: true });
  g.noWin().color(roof);
  g.gable(0.15, 0.18, 1.85, 1.0, 0.32, 0.2, 'x', 0.04, wall);
  // clock tower
  g.color(shade(wall, 1.06)).win(WIN.CIVIC, 0.09, 0.14);
  g.box(0.86, 0, 0.45, 1.14, 0.8, 0.73, { noTop: true });
  g.noWin().color(roof).pyramid(1.0, 0.59, 0.36, 0.36, 0.8, 0.24);
  g.color(WHITE);
  g.box(0.94, 0.62, 0.73, 1.06, 0.74, 0.742);
  g.box(0.94, 0.62, 0.438, 1.06, 0.74, 0.45);
  g.color(PAL.black).box(0.995, 0.66, 0.742, 1.005, 0.72, 0.746);
  // platform
  g.color(0xcfcac0).box(0.04, 0, 1.18, 1.96, 0.055, 1.97, { top: 0xbdb8ae });
  deck(g, 0.04, 1.89, 1.96, 1.93, 0.058, PAL.laneYellow);
  // canopy on posts
  g.color(PAL.steelDark);
  for (let i = 0; i < 5; i++) {
    const x = 0.2 + i * 0.4;
    g.box(x - 0.012, 0.055, 1.44, x + 0.012, 0.26, 1.464, { noTop: true });
  }
  g.color(0xd8d4cc).box(0.12, 0.26, 1.26, 1.88, 0.275, 1.66, { top: 0xc4c0b8 });
  bench(g, 0.6, 1.42);
  bench(g, 1.4, 1.42);
  lamp(g, 0.1, 1.3, 0.24);
  lamp(g, 1.9, 1.3, 0.24);
};

export const seaport: ModelFn = (g, c) => {
  const r = c.rng;
  deck(g, 0.04, 0.04, 3.96, 3.55, 0.012, 0x8f8b84);
  // quay wall + apron reaching over the water
  g.noWin().color(0xbab5ab).box(0, -0.4, 3.5, 4, 0.03, 4.08, { top: 0xa9a49a });
  deck(g, 0.1, 4.0, 3.9, 4.03, 0.032, PAL.laneYellow);
  g.color(0x333333);
  for (let i = 0; i < 4; i++) g.box(0.4 + i - 0.02, 0.03, 4.0, 0.4 + i + 0.02, 0.06, 4.04);
  // warehouses along the back
  for (let k = 0; k < 2; k++) {
    const x0 = 0.2 + k * 1.95;
    const x1 = x0 + 1.65;
    const wc = r.pick(PAL.industrial);
    g.color(wc).win(WIN.IND, 0.22, 0.3);
    g.box(x0, 0, 0.2, x1, 0.32, 1.1, { noTop: true });
    g.noWin().color(r.pick(PAL.industrialRoof)).gable(x0, 0.2, x1, 1.1, 0.32, 0.14, 'x', 0.03, wc);
    g.color(0x5c6268);
    for (let d = 0; d < 3; d++) g.box(x0 + 0.18 + d * 0.5, 0, 1.1, x0 + 0.38 + d * 0.5, 0.18, 1.11);
  }
  // container stacks
  for (let row = 0; row < 3; row++) {
    const z = 1.45 + row * 0.42;
    for (let i = 0; i < 6; i++) {
      if (r.chance(0.12)) continue;
      const x = 0.25 + i * 0.36;
      const levels = r.int(1, 2);
      for (let l = 0; l < levels; l++) {
        g.color(r.pick(PAL.awnings));
        g.box(x, l * 0.11, z, x + 0.32, (l + 1) * 0.11 - 0.005, z + 0.14);
      }
    }
  }
  // ship-to-shore gantry cranes at the quay
  for (const cx of [2.7, 3.45]) {
    const col = r.pick([0xe8873a, 0x3f7fd6, 0xd6453d]);
    g.color(col);
    for (const dx of [-0.16, 0.16]) {
      g.beam([cx + dx, 0, 3.15], [cx + dx, 0.9, 3.15], 0.04);
      g.beam([cx + dx, 0, 3.75], [cx + dx, 0.9, 3.75], 0.04);
      g.box(cx + dx - 0.02, 0.86, 3.13, cx + dx + 0.02, 0.92, 3.77);
    }
    g.box(cx - 0.18, 0.86, 3.13, cx + 0.18, 0.92, 3.17);
    g.box(cx - 0.18, 0.86, 3.73, cx + 0.18, 0.92, 3.77);
    g.box(cx - 0.05, 0.92, 2.85, cx + 0.05, 0.98, 4.4);
    g.beam([cx - 0.1, 0.92, 3.45], [cx, 1.38, 3.45], 0.03);
    g.beam([cx + 0.1, 0.92, 3.45], [cx, 1.38, 3.45], 0.03);
    g.beam([cx, 1.38, 3.45], [cx, 0.98, 4.36], 0.018);
    g.beam([cx, 1.38, 3.45], [cx, 0.98, 2.9], 0.018);
    g.color(0xf2f2f0).box(cx - 0.06, 0.82, 4.05, cx + 0.06, 0.92, 4.18);
    g.color(PAL.steelDark).beam([cx, 0.82, 4.11], [cx, 0.45, 4.11], 0.008);
  }
  // docked cargo ship
  const hull = r.pick([0x8f2f2f, 0x2f3f6f, 0x2f5f4f]);
  g.color(hull);
  prism(
    g,
    [
      [0.35, 4.12],
      [2.95, 4.12],
      [3.4, 4.28],
      [2.95, 4.44],
      [0.35, 4.44],
    ],
    -0.3,
    0.02,
    0x9a958c,
  );
  for (let i = 0; i < 5; i++) {
    g.color(r.pick(PAL.awnings));
    g.box(1.0 + i * 0.36, 0.02, 4.16, 1.32 + i * 0.36, 0.13, 4.4);
  }
  g.color(WHITE).win(WIN.OFFICE, 0.1, 0.1);
  g.box(0.42, 0.02, 4.17, 0.78, 0.32, 4.39, { top: 0xd8d8d8 });
  g.noWin();
  chimneyStub(g, 0.6, 4.28);
  lamp(g, 1.95, 3.4, 0.4);
  lamp(g, 0.1, 1.3, 0.3);
};

function chimneyStub(g: G, x: number, z: number): void {
  g.color(PAL.black).box(x - 0.04, 0.32, z - 0.04, x + 0.04, 0.42, z + 0.04);
}

export const airport: ModelFn = (g, c) => {
  const r = c.rng;
  const tail = r.pick([PAL.blue, PAL.red, 0x2bb3a3, PAL.orange]);
  // runway
  deck(g, 0.12, 2.85, 5.88, 3.65, 0.013, ASPHALT);
  for (let i = 0; i < 9; i++) deck(g, 0.62 + i * 0.55, 3.235, 0.9 + i * 0.55, 3.265, 0.015, WHITE);
  for (let i = 0; i < 4; i++) {
    deck(g, 0.2, 2.95 + i * 0.18, 0.4, 2.99 + i * 0.18, 0.015, WHITE);
    deck(g, 5.6, 2.95 + i * 0.18, 5.8, 2.99 + i * 0.18, 0.015, WHITE);
  }
  // taxiway + connectors
  deck(g, 0.5, 2.48, 5.5, 2.72, 0.013, 0x55585d);
  deck(g, 0.6, 2.72, 0.84, 2.85, 0.013, 0x55585d);
  deck(g, 5.16, 2.72, 5.4, 2.85, 0.013, 0x55585d);
  deck(g, 0.5, 2.59, 5.5, 2.61, 0.015, PAL.laneYellow);
  // apron
  deck(g, 0.25, 1.15, 4.35, 2.48, 0.013, 0xa8a49b);
  // terminal
  g.color(0xe8ecef).win(WIN.GLASS, 0.12, 0.16);
  g.box(0.4, 0, 0.3, 3.0, 0.32, 1.05, { noTop: true });
  g.noWin().color(0xc9ced2).box(0.32, 0.32, 0.22, 3.08, 0.36, 1.14, { top: 0xd8dde0 });
  g.color(0xb8bec4);
  for (const jx of [1.0, 2.2]) g.box(jx - 0.04, 0.09, 1.05, jx + 0.04, 0.16, 1.5);
  // control tower
  g.color(0xe0e2e4).cylinder(3.5, 0.6, 0.09, 0, 1.05, 8);
  g.color(GLASS_TINT).frustum(3.5, 0.6, 0.14, 0.2, 1.05, 1.22, 8);
  g.color(0xd8dadc).cylinder(3.5, 0.6, 0.21, 1.22, 1.26, 8);
  g.color(PAL.steelDark).beam([3.5, 1.26, 0.6], [3.5, 1.46, 0.6], 0.015);
  // hangar (half barrel)
  g.color(0xb9c0c6);
  g.cylinderZ(0.2, 1.3, 5.15, 0, 0.5, 10);
  g.color(0x6b7280).box(4.8, 0, 1.3, 5.5, 0.34, 1.312);
  // planes
  airplane(g, 1.0, 1.85, 0.8, Math.PI / 2, tail);
  airplane(g, 2.2, 1.85, 0.8, Math.PI / 2, r.pick([PAL.red, PAL.green, PAL.blue]));
  airplane(g, 4.4, 3.25, 0.9, 0, tail);
  // car park behind the terminal side
  deck(g, 3.2, 1.2, 4.3, 0.15, 0.013, ASPHALT);
  for (let i = 0; i < 4; i++) car(g, 3.35 + i * 0.25, 0.35, r.pick(PAL.cars), false);
  lamp(g, 4.4, 1.1, 0.3);
};
