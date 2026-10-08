/** Commercial growable models: shops, offices, malls and skyscrapers. */
import type { ModelFn } from '../types';
import { PAL } from '../../palette';
import {
  antenna,
  awning,
  block,
  car,
  DECK,
  F,
  fountain,
  frontQuad,
  GLASS_ROOF,
  GLASS_WALLS,
  lotTree,
  parking,
  pond,
  POOL,
  ROOF_GREEN,
  roofRim,
  roofUnits,
  spire,
  tiers,
} from './shared';
import { shade, WIN } from '../../geom';

// ================================================================ commercial

/** 1x1 shops: corner shop, diner, boutique. */
export const shop: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.78, 0.96, 0.97, 0.012, PAL.sidewalk);
  if (c.wealth === 0) {
    const wall = r.pick([...PAL.walls.low, ...PAL.walls.brick]);
    const two = r.chance(0.6);
    const gh = F * 1.15;
    // single-storey shops are smaller and get a side lot
    const x1 = two ? 0.88 : 0.66;
    const z0 = two ? 0.2 : 0.34;
    g.color(wall).win(WIN.SHOP, 0.2, gh);
    g.box(0.12, 0, z0, x1, gh, 0.78, { noTop: two, top: PAL.flatRoof });
    let top = gh;
    if (two) {
      g.win(WIN.RES, 0.12, F);
      g.box(0.12, gh, z0, x1, gh + F, 0.78, { top: PAL.flatRoof });
      top = gh + F;
    } else {
      g.rect(0.7, 0.3, 0.96, 0.77, 0.012, PAL.asphalt);
      car(g, 0.83, 0.5, false, r.pick(PAL.cars));
    }
    g.noWin();
    roofRim(g, 0.12, z0, x1, 0.78, top, PAL.flatRoof);
    const col = r.pick(PAL.awnings);
    awning(g, 0.16, x1 - 0.04, 0.78, gh - 0.015, 0.11, col);
    g.color(r.pick(PAL.awnings)).box(0.2, top, 0.72, x1 - 0.08, top + 0.07, 0.76, { top: PAL.white });
    g.color(0x3f6f4a).box(0.04, 0, 0.24, 0.11, 0.05, 0.36);
  } else if (c.wealth === 1) {
    const body = r.pick([0xd8dde2, 0xe8e2d0, 0xf2e8c8]);
    const stripe = r.pick([PAL.red, PAL.blue, 0x2bb3a3, PAL.orange]);
    g.color(body).win(WIN.SHOP, 0.12, F * 0.9);
    g.box(0.12, 0, 0.18, 0.88, F * 0.9, 0.5, { noTop: true });
    g.noWin()
      .color(stripe)
      .box(0.115, F * 0.74, 0.175, 0.885, F * 0.92, 0.505, { top: 0xb8bcc0 });
    g.color(0x9aa0a6).beam([0.8, F * 0.92, 0.25], [0.8, 0.44, 0.25], 0.016);
    g.color(stripe).box(0.64, 0.36, 0.23, 0.96, 0.46, 0.27, { top: PAL.white });
    g.rect(0.04, 0.52, 0.96, 0.78, 0.012, PAL.asphalt);
    for (const lx of [0.3, 0.5, 0.7]) g.rect(lx - 0.004, 0.55, lx + 0.004, 0.68, 0.015, PAL.laneWhite);
    car(g, 0.4, 0.615, false, r.pick(PAL.cars));
    if (r.chance(0.6)) car(g, 0.6, 0.615, false, r.pick(PAL.cars));
  } else {
    const wall = r.pick([0xf4ede0, 0xece4d4, 0xf6f0e6, 0xe8dcc8]);
    const aw = r.pick([0x2b2d30, 0x2a3f5f, 0x5f2a3a, 0x2f4f3f]);
    g.color(wall).win(WIN.SHOP, 0.2, F * 1.1);
    g.box(0.15, 0, 0.22, 0.85, F * 1.1, 0.76, { noTop: true });
    g.win(WIN.CIVIC, 0.13, F);
    g.box(0.15, F * 1.1, 0.22, 0.85, F * 2.1, 0.76, { noTop: true });
    g.noWin()
      .color(PAL.roofs.slate)
      .hip(0.15, 0.22, 0.85, 0.76, F * 2.1, 0.12, 0.02);
    awning(g, 0.18, 0.82, 0.76, F * 1.1 - 0.01, 0.09, aw);
    lotTree(g, c, 0.1, 0.88, 0.6);
    lotTree(g, c, 0.9, 0.88, 0.6);
  }
};

/** 1x1 gas station: canopy, pumps, kiosk, price sign. */
export const gasStation: ModelFn = (g, c) => {
  const r = c.rng;
  const brand = r.pick([PAL.red, PAL.blue, PAL.green, 0xf2a93b, 0x2bb3a3]);
  g.rect(0.03, 0.03, 0.97, 0.97, 0.012, PAL.asphalt);
  const cx0 = 0.12;
  const cx1 = 0.68;
  const cz0 = 0.42;
  const cz1 = 0.9;
  const ch = 0.17;
  g.noWin().color(PAL.steel);
  for (const [px, pz] of [
    [cx0 + 0.08, cz0 + 0.1],
    [cx1 - 0.08, cz0 + 0.1],
    [cx0 + 0.08, cz1 - 0.1],
    [cx1 - 0.08, cz1 - 0.1],
  ])
    g.box(px - 0.012, 0, pz - 0.012, px + 0.012, ch, pz + 0.012, { noTop: true });
  g.color(brand).box(cx0, ch, cz0, cx1, ch + 0.035, cz1, { top: PAL.white });
  for (const pz of [0.56, 0.76]) {
    g.color(0xd0d0cc).box(0.28, 0, pz - 0.02, 0.52, 0.015, pz + 0.02);
    g.color(brand).box(0.37, 0.015, pz - 0.014, 0.43, 0.075, pz + 0.014);
  }
  g.color(PAL.white).win(WIN.SHOP, 0.15, F * 0.85);
  g.box(0.62, 0, 0.08, 0.92, F * 0.85, 0.36, { top: PAL.flatRoof });
  g.noWin()
    .color(brand)
    .box(0.615, F * 0.85 - 0.02, 0.075, 0.925, F * 0.85 + 0.015, 0.365, { noTop: true });
  g.color(PAL.steel).beam([0.9, 0, 0.9], [0.9, 0.38, 0.9], 0.02);
  g.color(brand).box(0.84, 0.3, 0.88, 0.96, 0.42, 0.92, { top: PAL.white });
  car(g, 0.4, 0.66, true, r.pick(PAL.cars));
};

/** 2x2 strip mall, supermarket or garden market. */
export const stripMall: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.name === 'Supermarket') {
    const wall = r.pick([0xe8e2d4, 0xd8d0c0, 0xece6da]);
    const brand = r.pick([PAL.red, PAL.green, PAL.blue, PAL.orange]);
    const h = F * 1.6;
    g.noWin().color(wall).box(0.12, 0, 0.12, 1.88, h, 0.95, { top: PAL.flatRoof });
    roofRim(g, 0.12, 0.12, 1.88, 0.95, h, PAL.flatRoof);
    g.color(shade(wall, 0.85)).box(0.11, 0, 0.94, 1.89, 0.03, 0.96);
    g.color(PAL.glassBlue).win(WIN.GLASS, 0.1, F).box(0.75, 0, 0.95, 1.25, F, 1.05, { top: brand });
    g.noWin()
      .color(brand)
      .box(0.55, h - 0.02, 0.92, 1.45, h + 0.1, 0.97, { top: PAL.white });
    roofUnits(g, c, 0.12, 0.12, 1.88, 0.95, h, 3);
    parking(g, c, 0.1, 1.15, 1.9, 1.95, 6);
    g.color(PAL.steel).box(1.55, 0, 1.06, 1.75, 0.05, 1.1);
  } else if (c.name === 'Garden Market') {
    const wall = r.pick(PAL.walls.mid);
    g.color(wall).win(WIN.SHOP, 0.2, F * 1.1);
    g.box(0.12, 0, 0.15, 0.95, F * 1.1, 0.8, { noTop: true });
    g.noWin()
      .color(PAL.wood)
      .gable(0.12, 0.15, 0.95, 0.8, F * 1.1, 0.12, 'x', 0.03, wall);
    awning(g, 0.18, 0.9, 0.8, F * 1.1 - 0.01, 0.1, r.pick(PAL.awnings));
    // greenhouse
    g.color(0xdfe8ea).win(WIN.GLASS, 0.1, F);
    g.box(1.05, 0, 0.15, 1.88, F, 0.95, { noTop: true });
    g.noWin().color(0xa8ccd8).gable(1.05, 0.15, 1.88, 0.95, F, 0.16, 'z', 0.01, 0xc8dde4);
    // plant rows
    for (let i = 0; i < 4; i++) {
      const z = 1.05 + i * 0.1;
      g.color(r.pick(PAL.leaf)).box(0.2, 0, z, 1.0, 0.035, z + 0.05);
      g.color(r.pick(PAL.flower)).box(1.1, 0, z, 1.8, 0.03, z + 0.05);
    }
    parking(g, c, 0.1, 1.5, 1.9, 1.95, 4);
  } else {
    const wall = r.pick([0xd8cbb0, 0xe0d4bc, 0xc9bca4, 0xe8dcc4]);
    const h = F * 1.25;
    g.color(wall).win(WIN.SHOP, 0.2, h);
    g.box(0.1, 0, 0.15, 1.9, h, 0.75, { top: PAL.flatRoof });
    g.noWin();
    roofRim(g, 0.1, 0.15, 1.9, 0.75, h, PAL.flatRoof);
    const n = r.int(3, 5);
    const sw = 1.8 / n;
    for (let i = 0; i < n; i++) {
      const sx0 = 0.1 + i * sw;
      const col = r.pick(PAL.awnings);
      awning(g, sx0 + 0.03, sx0 + sw - 0.03, 0.75, h * 0.74, 0.09, col);
      g.color(col).box(sx0 + 0.08, h, 0.71, sx0 + sw - 0.08, h + 0.06, 0.75, { top: PAL.white });
    }
    parking(g, c, 0.1, 0.95, 1.9, 1.92, r.int(3, 6));
    g.color(PAL.steel).beam([1.85, 0, 1.85], [1.85, 0.45, 1.85], 0.025);
    g.color(r.pick(PAL.awnings)).box(1.76, 0.38, 1.82, 1.94, 0.5, 1.88, { top: PAL.white });
  }
};

/** 1x1 small office building or bank. */
export const smallOffice: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.8, 0.96, 0.97, 0.012, PAL.sidewalk);
  if (c.name === 'Bank') {
    const stone = r.pick([0xeee6d6, 0xe6dcc6, 0xf2ecdf, 0xdcd4c4]);
    const top = r.int(2, 3) * F;
    block(g, 0.15, 0.15, 0.85, 0.66, 0, top, stone, PAL.flatRoof, WIN.CIVIC, 0.12);
    g.noWin().color(shade(stone, 0.9)).box(0.18, 0, 0.66, 0.82, 0.03, 0.84);
    g.color(stone);
    for (const x of [0.24, 0.39, 0.61, 0.76]) g.box(x - 0.02, 0.03, 0.75, x + 0.02, top - 0.04, 0.79, { noTop: true });
    g.box(0.17, top - 0.04, 0.66, 0.83, top, 0.82, { top: shade(stone, 0.95) });
    g.color(shade(stone, 0.85)).gable(0.17, 0.66, 0.83, 0.82, top, 0.09, 'z', 0.01, stone);
    frontQuad(g, 0.45, 0.55, 0.03, 0.14, 0.662, 0x4a3a2a);
  } else {
    const brick = c.name === 'Professional Building';
    const wall = brick ? r.pick(PAL.walls.brick) : r.pick(PAL.officeWalls);
    const top = (brick ? r.int(4, 5) : r.int(3, 4)) * F;
    g.color(shade(wall, 0.9)).win(WIN.SHOP, 0.2, F);
    g.box(0.15, 0, 0.18, 0.85, F, 0.8, { noTop: true });
    block(g, 0.15, 0.18, 0.85, 0.8, F, top, wall, PAL.flatRoof, WIN.OFFICE, brick ? 0.11 : 0.16);
    if (brick)
      g.noWin()
        .color(shade(wall, 0.72))
        .box(0.14, top - 0.02, 0.17, 0.86, top + 0.012, 0.81, { noTop: true });
    roofUnits(g, c, 0.15, 0.18, 0.85, 0.8, top, 2);
    g.noWin()
      .color(0x5a5e62)
      .box(0.4, F * 0.75, 0.8, 0.6, F * 0.82, 0.9);
    lotTree(g, c, 0.08, 0.9, 0.7);
  }
};

/** 2x2 offices: office block, hotel, glass offices. */
export const office: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.name === 'Hotel') {
    const wall = r.pick([...PAL.walls.mid, 0xf0e6d2]);
    const floors = r.int(8, 11);
    const ph = F * 1.4;
    const top = ph + floors * F;
    g.rect(0.1, 1.55, 1.9, 1.96, 0.012, 0xd8d2c4);
    block(g, 0.15, 0.3, 1.85, 1.55, 0, ph, shade(wall, 0.9), PAL.flatRoof, WIN.SHOP, 0.22, ph);
    block(g, 0.3, 0.45, 1.7, 1.0, ph, top, wall, PAL.flatRoofDark, WIN.RES, 0.1);
    g.rect(1.0, 1.1, 1.6, 1.45, ph + 0.007, POOL);
    g.rect(0.95, 1.05, 1.65, 1.5, ph + 0.005, DECK);
    const sign = r.pick([PAL.red, 0xd4a017, 0x2a3f5f, 0x8e5bd6]);
    g.noWin()
      .color(sign)
      .box(0.55, top, 0.92, 1.45, top + 0.14, 0.97, { top: shade(sign, 0.8) });
    g.color(0x6a6e72).box(0.8, ph * 0.6, 1.55, 1.2, ph * 0.66, 1.78);
    g.color(PAL.steel);
    g.beam([0.83, 0, 1.75], [0.83, ph * 0.6, 1.75], 0.012);
    g.beam([1.17, 0, 1.75], [1.17, ph * 0.6, 1.75], 0.012);
    car(g, 1.45, 1.75, true, PAL.yellow);
    lotTree(g, c, 0.2, 1.8, 0.9);
  } else if (c.name === 'Glass Offices') {
    const a = r.pick(GLASS_WALLS);
    const b = r.pick(GLASS_WALLS);
    const t1 = r.int(7, 10) * F;
    const t2 = r.int(4, 6) * F;
    g.rect(0.06, 0.06, 1.94, 1.94, 0.012, 0xd8d2c4);
    block(g, 0.2, 0.2, 1.15, 1.15, 0, t1, a, GLASS_ROOF, WIN.GLASS, 0.12);
    block(g, 0.95, 0.95, 1.8, 1.8, 0, t2, b, GLASS_ROOF, WIN.GLASS, 0.12);
    roofUnits(g, c, 0.2, 0.2, 1.15, 1.15, t1, 2);
    g.rect(1.0, 1.0, 1.75, 1.75, t2 + 0.006, ROOF_GREEN);
    lotTree(g, c, 0.3, 1.6, 1.1);
    lotTree(g, c, 0.6, 1.75, 0.9);
    lotTree(g, c, 1.65, 0.35, 1.0);
  } else {
    const wall = r.pick(PAL.officeWalls);
    const top = r.int(5, 8) * F;
    block(g, 0.25, 0.2, 1.75, 1.35, 0, top, wall, PAL.flatRoof, WIN.OFFICE, 0.17);
    g.noWin()
      .color(shade(wall, 0.8))
      .box(0.7, top, 0.5, 1.3, top + 0.1, 0.95, { top: PAL.flatRoofDark });
    roofUnits(g, c, 0.25, 0.95, 1.75, 1.35, top, 2);
    g.color(0x5a5e62).box(0.85, F * 0.78, 1.35, 1.15, F * 0.85, 1.48);
    parking(g, c, 0.1, 1.55, 1.9, 1.96, 5);
    lotTree(g, c, 0.12, 0.25, 1.0);
  }
};

/** 3x3 shopping mall, department store, office park. */
export const mall: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.name === 'Department Store') {
    const stone = r.pick([0xe6dcc6, 0xd8c9a8, 0xeee6d6, 0xc9b49a]);
    const brand = r.pick([PAL.red, 0x2a3f5f, 0x8e5bd6, 0xd4a017]);
    const top = F * 3.4;
    g.color(stone).win(WIN.SHOP, 0.22, F * 1.3);
    g.box(0.2, 0, 0.2, 1.85, F * 1.3, 1.5, { noTop: true });
    block(g, 0.2, 0.2, 1.85, 1.5, F * 1.3, top, stone, PAL.flatRoof, WIN.CIVIC, 0.14);
    g.noWin()
      .color(shade(stone, 0.75))
      .box(0.18, top - 0.02, 0.18, 1.87, top + 0.015, 1.52, { noTop: true });
    for (const ax of [0.3, 0.85, 1.4]) awning(g, ax, ax + 0.35, 1.5, F * 1.2, 0.09, brand);
    g.color(brand).box(0.7, top, 1.42, 1.35, top + 0.13, 1.48, { top: PAL.white });
    // parking garage with cars on the top deck
    const gh = F * 2.4;
    block(g, 2.0, 0.2, 2.85, 2.25, 0, gh, PAL.concrete, 0x8a8a86, WIN.OFFICE, 0.28, F * 0.8);
    g.push().translate(0, gh, 0);
    car(g, 2.2, 0.6, false, r.pick(PAL.cars));
    car(g, 2.4, 1.0, false, r.pick(PAL.cars));
    car(g, 2.65, 1.6, false, r.pick(PAL.cars));
    g.pop();
    // plaza
    g.rect(0.2, 1.6, 1.85, 2.9, 0.012, 0xd8d2c4);
    fountain(g, 1.0, 2.25, 0.1);
    lotTree(g, c, 0.4, 2.7, 1.0);
    lotTree(g, c, 1.65, 2.7, 1.0);
    lotTree(g, c, 1.65, 1.8, 0.9);
  } else if (c.name === 'Office Park') {
    const a = r.pick(GLASS_WALLS);
    const wall = r.pick(PAL.techWalls);
    block(g, 0.25, 0.25, 1.25, 1.0, 0, 3 * F, a, GLASS_ROOF, WIN.GLASS, 0.13);
    block(g, 1.6, 0.25, 2.75, 0.95, 0, 2 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.13);
    block(g, 1.75, 1.35, 2.75, 2.15, 0, 3 * F, wall, PAL.flatRoof, WIN.OFFICE, 0.15);
    pond(g, 0.45, 1.45, 1.4, 2.05);
    g.rect(1.4, 1.0, 1.5, 2.3, 0.012, PAL.sidewalk);
    g.rect(0.3, 1.15, 2.7, 1.25, 0.012, PAL.sidewalk);
    for (const [tx, tz] of [
      [0.3, 1.4],
      [1.55, 1.6],
      [1.6, 2.1],
      [0.5, 2.15],
      [2.85, 1.2],
      [1.4, 0.3],
    ])
      lotTree(g, c, tx, tz, 0.9 + r.next() * 0.4);
    parking(g, c, 0.2, 2.35, 2.8, 2.9, 6);
  } else {
    const wall = r.pick([0xe0d4bc, 0xd8cbb0, 0xe8e2d4, 0xcfc6b0]);
    const h = F * 1.5;
    g.noWin().color(wall).box(0.8, 0, 0.25, 2.2, h, 1.35, { top: PAL.flatRoof });
    roofRim(g, 0.8, 0.25, 2.2, 1.35, h, PAL.flatRoof);
    g.color(0x9cc4dc).gable(1.05, 0.45, 1.95, 1.1, h, 0.16, 'x', 0.01, 0xb8d4e4);
    for (const [ax0, ax1] of [
      [0.2, 0.8],
      [2.2, 2.8],
    ] as const) {
      const brand = r.pick(PAL.awnings);
      g.noWin()
        .color(shade(wall, 0.92))
        .box(ax0, 0, 0.15, ax1, F * 2.1, 1.45, { top: PAL.flatRoofDark });
      g.color(brand).box(ax0 + 0.1, F * 2.1 - 0.03, 1.42, ax1 - 0.1, F * 2.1 + 0.08, 1.47, { top: PAL.white });
    }
    g.color(PAL.glassBlue).win(WIN.GLASS, 0.1, F).box(1.3, 0, 1.35, 1.7, F, 1.45, { top: 0x6a6e72 });
    roofUnits(g, c, 0.8, 0.25, 2.2, 1.35, h, 2);
    parking(g, c, 0.15, 1.6, 2.85, 2.9, 9);
  }
};

/** 2x2 skyscraper: classic setback, art deco, glass. */
export const skyscraper: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.04, 1.96, 1.96, 0.012, PAL.concrete);
  if (c.wealth === 1) {
    const stone = r.pick([0xd8c9a8, 0xe0d4bc, 0xcfc0a0, 0xc9b9a0]);
    const n = r.int(20, 28) * F;
    const top = tiers(
      g,
      1,
      1,
      0,
      [
        [0.72, 0.72, F * 2],
        [0.62, 0.62, n * 0.58],
        [0.5, 0.5, n * 0.78],
        [0.38, 0.38, n * 0.9],
        [0.27, 0.27, n],
      ],
      stone,
      PAL.flatRoof,
      WIN.OFFICE,
      0.09,
    );
    g.noWin().color(0xc0c4c8).pyramid(1, 1, 0.54, 0.54, top, 0.32);
    spire(g, 1, 1, top + 0.3, 0.5, 0.025);
    lotTree(g, c, 0.15, 0.15, 0.9);
    lotTree(g, c, 1.85, 1.85, 0.9);
  } else if (c.wealth === 2) {
    const a = r.pick(GLASS_WALLS);
    const b = r.pick(GLASS_WALLS);
    const n = r.int(22, 30) * F;
    block(g, 1.15, 1.15, 1.85, 1.85, 0, n * 0.4, b, GLASS_ROOF, WIN.GLASS, 0.12);
    block(g, 0.3, 0.35, 1.5, 1.55, 0, n, a, GLASS_ROOF, WIN.GLASS, 0.12);
    g.noWin().color(shade(a, 0.85)).shed(0.3, 0.35, 1.5, 1.55, n, 0.36, false);
    g.rect(1.2, 1.2, 1.8, 1.8, n * 0.4 + 0.006, ROOF_GREEN);
    g.color(0x6a6e72).box(0.7, F * 0.8, 1.55, 1.1, F * 0.87, 1.7);
    lotTree(g, c, 0.2, 1.8, 1.0);
    lotTree(g, c, 1.8, 0.2, 1.0);
  } else {
    const wall = r.pick(PAL.officeWalls);
    const n = r.int(18, 26) * F;
    const top = tiers(
      g,
      1,
      1,
      0,
      [
        [0.85, 0.85, F * 2],
        [0.65, 0.65, n * 0.7],
        [0.5, 0.5, n * 0.9],
        [0.35, 0.35, n],
      ],
      wall,
      PAL.flatRoof,
      WIN.OFFICE,
      0.15,
    );
    roofUnits(g, c, 0.35, 0.35, 1.65, 1.65, n * 0.7, 2);
    antenna(g, 1, 1, top, 0.55);
  }
};

/** 3x3 megatower: corporate, twin towers, spire tower. */
export const megatower: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.04, 2.96, 2.96, 0.012, 0xd0cbc0);
  if (c.wealth === 1) {
    const wall = r.pick([0xc8ccd0, 0xd8d4cc, 0xb8bcc0]);
    const n = r.int(34, 40) * F;
    block(g, 0.3, 0.9, 2.7, 2.1, 0, 3 * F, shade(wall, 0.85), PAL.flatRoof, WIN.SHOP, 0.22, F * 1.5);
    for (const cx of [0.95, 2.05]) {
      const top = tiers(
        g,
        cx,
        1.5,
        3 * F,
        [
          [0.42, 0.42, n * 0.6],
          [0.34, 0.34, n * 0.82],
          [0.26, 0.26, n * 0.94],
          [0.17, 0.17, n],
        ],
        wall,
        0x9a9ea2,
        WIN.OFFICE,
        0.1,
      );
      spire(g, cx, 1.5, top, 0.9, 0.09, 0xd8dce0);
    }
    g.noWin()
      .color(0x8a8e92)
      .box(1.37, n * 0.42, 1.44, 1.63, n * 0.45, 1.56, { top: 0x9a9ea2 });
    g.beam([1.37, n * 0.33, 1.5], [1.5, n * 0.42, 1.5], 0.02);
    g.beam([1.63, n * 0.33, 1.5], [1.5, n * 0.42, 1.5], 0.02);
    lotTree(g, c, 0.25, 0.3, 1.1);
    lotTree(g, c, 2.75, 0.3, 1.1);
    lotTree(g, c, 0.25, 2.7, 1.1);
    lotTree(g, c, 2.75, 2.7, 1.1);
  } else if (c.wealth === 2) {
    const a = r.pick(GLASS_WALLS);
    const n = r.int(38, 45) * F;
    const top = tiers(
      g,
      1.5,
      1.5,
      0,
      [
        [0.78, 0.78, n * 0.35],
        [0.64, 0.64, n * 0.6],
        [0.52, 0.52, n * 0.8],
        [0.4, 0.4, n * 0.92],
        [0.28, 0.28, n],
      ],
      a,
      GLASS_ROOF,
      WIN.GLASS,
      0.12,
    );
    spire(g, 1.5, 1.5, top, 1.3, 0.06, 0xd8dce0);
    pond(g, 0.3, 2.3, 1.1, 2.7);
    for (const [tx, tz] of [
      [0.25, 0.25],
      [2.75, 0.25],
      [2.75, 2.75],
      [1.9, 2.75],
      [0.25, 1.5],
    ])
      lotTree(g, c, tx, tz, 1.1);
  } else {
    const wall = r.pick(PAL.officeWalls);
    const n = r.int(30, 36) * F;
    const top = tiers(
      g,
      1.5,
      1.5,
      0,
      [
        [1.35, 1.35, 3 * F],
        [1.05, 1.05, n * 0.6],
        [0.85, 0.85, n * 0.85],
        [0.65, 0.65, n],
      ],
      wall,
      PAL.flatRoof,
      WIN.OFFICE,
      0.15,
    );
    g.noWin()
      .color(0x4a5048)
      .cylinder(1.5, 1.5, 0.42, top, top + 0.025, 8, 0x5a6058);
    g.rect(1.36, 1.47, 1.64, 1.53, top + 0.03, PAL.white);
    g.rect(1.3, 1.3, 1.36, 1.7, top + 0.03, PAL.white);
    g.rect(1.64, 1.3, 1.7, 1.7, top + 0.03, PAL.white);
    antenna(g, 0.95, 0.95, top, 0.6);
    antenna(g, 2.05, 2.05, top, 0.45);
    roofUnits(g, c, 0.45, 0.45, 2.55, 2.55, n * 0.6, 3);
  }
};
