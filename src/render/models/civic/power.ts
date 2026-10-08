/** Power plant models (and the wind turbine rotor). */
import type { ModelFn } from '../types';
import { mixHex, shade, type V3, WIN } from '../../geom';
import { PAL } from '../../palette';
import { chimney, deck, dome, fence, type G, type P2, pylon, tank } from './shared';

// ------------------------------------------------------------------- power

export const rotor_blades: ModelFn = (g) => {
  g.noWin().color(0xf2f2ee);
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + (k * Math.PI * 2) / 3;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const vx = -uy;
    const vy = ux;
    const p = (r: number, w: number): V3 => [ux * r + vx * w, uy * r + vy * w, 0.01];
    g.panel(p(0.07, -0.05), p(1.0, -0.012), p(1.0, 0.016), p(0.07, 0.04));
  }
  g.color(0xd8dadc);
  g.box(-0.07, -0.07, -0.06, 0.07, 0.07, 0.07, { bottom: true });
};

export const coal_plant: ModelFn = (g, c) => {
  const r = c.rng;
  const brick = r.pick([0x8f5a46, 0x7f6a5a, 0x9a8a78]);
  // boiler house
  g.color(brick).win(WIN.IND, 0.2, 0.22);
  g.box(0.3, 0, 0.45, 2.3, 1.0, 2.2, { top: PAL.flatRoofDark });
  g.noWin().color(shade(brick, 0.85)).box(0.6, 1.0, 0.8, 2.0, 1.16, 1.9, { top: PAL.flatRoofDark });
  // turbine hall
  const hall = mixHex(brick, 0xc0b8a8, 0.5);
  g.color(hall).win(WIN.IND, 0.2, 0.2);
  g.box(0.3, 0, 2.3, 3.0, 0.55, 3.65, { noTop: true });
  g.noWin().color(PAL.roofs.slate).gable(0.3, 2.3, 3.0, 3.65, 0.55, 0.18, 'x', 0.03, hall);
  // chimneys
  chimney(g, 2.85, 0.55, 0.17, 0.12, 1.95, 0xb8b0a4, PAL.red);
  chimney(g, 3.45, 0.55, 0.17, 0.12, 1.95, 0xb8b0a4, PAL.red);
  // coal piles + conveyor
  g.color(0x4a4540).pyramid(3.05, 1.55, 0.75, 0.6, 0, 0.32);
  g.color(0x54504a).pyramid(3.55, 2.05, 0.5, 0.5, 0, 0.22);
  g.color(PAL.steel).beam([2.95, 0.28, 1.55], [2.3, 0.9, 1.45], 0.06);
  // transformer yard
  g.color(0x7d848a);
  for (let i = 0; i < 3; i++) g.box(3.2 + i * 0.22, 0, 2.55, 3.35 + i * 0.22, 0.14, 2.75, { top: 0x6a7076 });
  pylon(g, 3.55, 3.45, 0.75);
  fence(g, 3.1, 2.4, 3.95, 3.95, 0.05, PAL.steel, 0.01);
};

export const oil_plant: ModelFn = (g, c) => {
  const r = c.rng;
  // tank farm with bund walls
  g.noWin().color(0xb9b4aa);
  g.box(0.15, 0, 0.15, 1.95, 0.05, 1.95, { top: 0x9d988e });
  for (const [x, z] of [
    [0.6, 0.6],
    [1.45, 0.6],
    [0.6, 1.45],
    [1.45, 1.45],
  ] as P2[]) {
    tank(g, x, z, 0.33, 0.42, r.pick([0xf2f2ee, 0xe6e2d8]));
    g.color(PAL.orange).cylinder(x, z, 0.335, 0.3, 0.34, 10);
  }
  // main building
  const wall = r.pick(PAL.industrial);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(1.0, 0, 2.2, 3.7, 0.6, 3.6, { top: PAL.flatRoofDark });
  g.noWin().color(shade(wall, 0.85)).box(1.3, 0.6, 2.5, 2.4, 0.78, 3.3, { top: PAL.flatRoof });
  // chimneys
  chimney(g, 2.75, 0.75, 0.13, 0.1, 1.6, 0xa9aeb2, PAL.orange);
  chimney(g, 3.3, 0.75, 0.13, 0.1, 1.6, 0xa9aeb2, PAL.orange);
  // pipes from tanks to plant
  g.color(PAL.steel);
  g.beam([1.45, 0.2, 1.8], [1.45, 0.2, 2.2], 0.04);
  g.beam([1.9, 0.2, 0.6], [2.6, 0.2, 0.6], 0.04);
  g.beam([2.6, 0.2, 0.6], [2.6, 0.2, 2.2], 0.04);
  pylon(g, 3.6, 1.6, 0.75);
  g.color(0x7d848a).box(0.3, 0, 2.4, 0.8, 0.16, 2.9, { top: 0x6a7076 });
};

export const gas_plant: ModelFn = (g, c) => {
  const r = c.rng;
  // spherical gas holders on legs
  for (const [x, z] of [
    [0.6, 0.62],
    [1.42, 0.62],
  ] as P2[]) {
    g.noWin().color(PAL.steel);
    for (const [dx, dz] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2],
    ] as P2[]) {
      g.beam([x + dx, 0, z + dz], [x + dx * 0.6, 0.38, z + dz * 0.6], 0.03);
    }
    g.color(r.pick([0xf2f2ee, 0xdfe6ea]));
    g.sphere(x, 0.48, z, 0.32, 1);
  }
  const wall = r.pick([0xc9d2d8, 0xd9dde2, 0xb9c6cf]);
  g.color(wall).win(WIN.IND, 0.2, 0.2);
  g.box(0.25, 0, 1.3, 2.75, 0.45, 2.7, { top: PAL.flatRoof });
  g.noWin().color(0x3f7fd6).box(0.24, 0.36, 1.29, 2.76, 0.4, 2.71, { top: PAL.flatRoof });
  g.color(shade(wall, 0.9)).box(0.6, 0.45, 1.6, 1.6, 0.62, 2.3, { top: PAL.flatRoofDark });
  chimney(g, 2.3, 0.62, 0.1, 0.08, 1.25, 0xd0d4d8, 0x3f7fd6);
  g.color(PAL.steel).beam([1.75, 0.25, 0.62], [2.2, 0.25, 0.62], 0.04);
  g.beam([2.2, 0.25, 0.62], [2.2, 0.25, 1.3], 0.04);
  pylon(g, 2.6, 2.85, 0.6);
};

function coolingTower(g: G, x: number, z: number, s: number): void {
  g.noWin().color(0xdcd8d0);
  g.lathe(
    x,
    z,
    [
      [0.55 * s, 0],
      [0.43 * s, 0.55 * s],
      [0.37 * s, 0.95 * s],
      [0.41 * s, 1.35 * s],
    ],
    12,
    0,
    false,
  );
  g.color(0x9f9b94);
  g.lathe(
    x,
    z,
    [
      [0.41 * s, 1.35 * s],
      [0.37 * s, 1.35 * s],
      [0.33 * s, 1.0 * s],
    ],
    12,
    0,
    true,
  );
  g.emitter(x, 1.4 * s, z, 'steam');
}

export const nuclear_plant: ModelFn = (g, c) => {
  const r = c.rng;
  coolingTower(g, 0.95, 1.05, 1);
  coolingTower(g, 2.35, 0.95, 0.95);
  // reactor containment
  g.noWin().color(0xe6e2da).cylinder(3.05, 2.85, 0.48, 0, 0.55, 12);
  dome(g, 3.05, 2.85, 0.48, 0.55, 0xd8d4cc, 12, 0.85);
  g.color(PAL.red).cylinder(3.05, 2.85, 0.485, 0.42, 0.46, 12);
  // turbine hall
  const wall = r.pick([0xc9cfd4, 0xd9d4c8]);
  g.color(wall).win(WIN.IND, 0.2, 0.22);
  g.box(0.25, 0, 2.25, 2.4, 0.5, 3.65, { noTop: true });
  g.noWin().color(PAL.roofs.slate).shed(0.25, 2.25, 2.4, 3.65, 0.5, 0.12);
  g.color(shade(wall, 0.92)).win(WIN.IND, 0.2, 0.2);
  g.box(3.3, 0, 0.4, 3.85, 0.35, 1.8, { top: PAL.flatRoof });
  g.noWin();
  // hazard stripes on the apron
  for (let i = 0; i < 5; i++) deck(g, 2.55 + i * 0.12, 3.75, 2.61 + i * 0.12, 3.9, 0.014, PAL.yellow);
  fence(g, 2.45, 2.2, 3.9, 3.95, 0.05, PAL.steel, 0.01, [2.5, 3.85]);
  pylon(g, 3.6, 2.0, 0.7);
};

export const wind_turbine: ModelFn = (g) => {
  deck(g, 0.36, 0.36, 0.64, 0.64, 0.012, PAL.concrete);
  g.noWin().color(0xf0f0ec);
  g.frustum(0.5, 0.5, 0.065, 0.032, 0, 1.06, 8);
  g.color(0xe6e6e2).box(0.45, 1.02, 0.4, 0.55, 1.12, 0.62);
  g.color(0x8a9096).box(0.47, 0, 0.555, 0.53, 0.07, 0.568);
  g.color(0xb8bec4).box(0.25, 0, 0.3, 0.35, 0.08, 0.38);
  g.rotor(0.5, 1.07, 0.64, 0.42, 0);
};

export const solar_plant: ModelFn = (g, c) => {
  const r = c.rng;
  const panel = r.pick([0x2c4a7a, 0x23406e, 0x2f5288]);
  // control hut
  g.color(0xe2ddd2).win(WIN.CIVIC, 0.12, 0.12);
  g.box(0.12, 0, 0.12, 0.62, 0.16, 0.48, { top: PAL.flatRoof });
  g.noWin();
  for (let row = 0; row < 6; row++) {
    const z = 0.62 + row * 0.38;
    g.color(PAL.steelDark);
    g.box(0.2, 0, z + 0.1, 0.23, 0.11, z + 0.13, { noTop: true });
    g.box(2.77, 0, z + 0.1, 2.8, 0.11, z + 0.13, { noTop: true });
    for (let k = 0; k < 6; k++) {
      const x0 = 0.18 + k * 0.44;
      const x1 = x0 + 0.42;
      g.color(k % 2 ? panel : shade(panel, 1.12));
      g.panel([x0, 0.06, z + 0.26], [x1, 0.06, z + 0.26], [x1, 0.17, z], [x0, 0.17, z]);
    }
  }
  fence(g, 0.04, 0.04, 2.96, 2.96, 0.05, PAL.steel, 0.01, [0.2, 0.6]);
  g.color(0x7d848a).box(0.7, 0, 0.15, 0.9, 0.12, 0.35, { top: 0x6a7076 });
};

function dish(g: G, x: number, z: number, s: number): void {
  g.noWin()
    .color(0xb8bec4)
    .cylinder(x, z, 0.1 * s, 0, 0.36 * s, 8);
  g.color(0xcfd4d8);
  g.lathe(
    x,
    z,
    [
      [0.12 * s, 0.36 * s],
      [0.5 * s, 0.53 * s],
      [0.7 * s, 0.76 * s],
    ],
    14,
    0,
    false,
  );
  g.color(0xf0f4f6);
  g.lathe(
    x,
    z,
    [
      [0.7 * s, 0.76 * s],
      [0.66 * s, 0.76 * s],
      [0.46 * s, 0.56 * s],
      [0.1 * s, 0.43 * s],
    ],
    14,
    0,
    true,
  );
  g.color(PAL.steel);
  g.beam([x, 0.43 * s, z], [x, 1.05 * s, z], 0.03);
  g.beam([x + 0.66 * s, 0.76 * s, z], [x, 1.05 * s, z], 0.015);
  g.beam([x - 0.33 * s, 0.76 * s, z + 0.57 * s], [x, 1.05 * s, z], 0.015);
  g.beam([x - 0.33 * s, 0.76 * s, z - 0.57 * s], [x, 1.05 * s, z], 0.015);
  g.color(0xe8873a).box(x - 0.05 * s, 1.03 * s, z - 0.05 * s, x + 0.05 * s, 1.12 * s, z + 0.05 * s);
}

export const microwave_plant: ModelFn = (g, c) => {
  const r = c.rng;
  dish(g, 0.95, 0.95, 1);
  dish(g, 2.75, 0.95, 1);
  dish(g, 0.95, 2.85, 1);
  const wall = r.pick([0xe6ecef, 0xdfe8ee]);
  g.color(wall).win(WIN.GLASS, 0.12, 0.14);
  g.box(2.2, 0, 2.35, 3.8, 0.4, 3.6, { top: PAL.flatRoof });
  g.noWin().color(0x3f7fd6).box(2.19, 0.4, 2.34, 3.81, 0.44, 3.61, { top: 0xd8dde0 });
  g.color(PAL.steel).beam([3.0, 0.44, 3.0], [3.0, 0.95, 3.0], 0.03);
  g.color(0xf2f2ee).sphere(3.0, 1.0, 3.0, 0.08, 0);
  pylon(g, 2.0, 3.7, 0.6);
};

export const fusion_plant: ModelFn = (g, c) => {
  const r = c.rng;
  const cx = 2;
  const cz = 2;
  // supports
  g.noWin().color(0x8a9096);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = cx + Math.cos(a) * 1.05;
    const z = cz + Math.sin(a) * 1.05;
    g.box(x - 0.07, 0, z - 0.07, x + 0.07, 0.35, z + 0.07);
  }
  // torus (tokamak ring)
  const R = 1.05;
  const a0 = 0.26;
  const yc = 0.55;
  const prof: [number, number][] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (i / n) * Math.PI * 2;
    prof.push([R + a0 * Math.cos(t), yc + a0 * Math.sin(t)]);
  }
  g.color(0xc4ccd4);
  g.lathe(cx, cz, prof, 16, 0, false);
  g.color(0x2bb3a3);
  g.lathe(
    cx,
    cz,
    [
      [R + a0 + 0.01, yc - 0.04],
      [R + a0 + 0.01, yc + 0.04],
    ],
    16,
    0,
    false,
  );
  // core
  g.color(0xe8ecef).cylinder(cx, cz, 0.42, 0, 0.5, 12);
  dome(g, cx, cz, 0.42, 0.5, 0x7fd6cf, 12, 0.9);
  // side domes + labs
  dome(g, 0.45, 3.5, 0.32, 0, 0xe8ecef, 10, 1);
  dome(g, 3.55, 0.5, 0.32, 0, 0xe8ecef, 10, 1);
  g.color(r.pick([0xe6ecef, 0xf2f4f6])).win(WIN.GLASS, 0.12, 0.14);
  g.box(2.9, 0, 3.0, 3.85, 0.36, 3.85, { top: PAL.flatRoof });
  g.noWin();
  tank(g, 0.45, 0.5, 0.18, 0.4, 0xdfe6ea, 8);
  tank(g, 0.85, 0.4, 0.14, 0.32, 0xdfe6ea, 8);
};
