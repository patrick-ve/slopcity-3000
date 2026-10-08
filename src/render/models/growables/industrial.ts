/** Industrial growable models: workshops, factories, tank farms and tech campuses. */
import type { ModelFn } from '../types';
import { PAL } from '../../palette';
import {
  acUnit,
  barrels,
  block,
  car,
  chimney,
  crates,
  F,
  fence,
  FENCE,
  frontQuad,
  GLASS_ROOF,
  GLASS_WALLS,
  lotTree,
  parking,
  pine,
  pond,
  ROOF_GREEN,
  roofUnits,
  sawtooth,
  tank,
  truck,
} from './shared';
import { mixHex, shade, WIN } from '../../geom';

// ================================================================ industrial

/** 1x1 workshop / small warehouse / machine shop. */
export const workshop: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick(PAL.industrial);
  const roof = r.pick(PAL.industrialRoof);
  g.rect(0.04, 0.04, 0.96, 0.96, 0.012, PAL.gravel);
  if (c.wealth === 0) {
    const h = F * 1.3;
    g.color(wall).win(WIN.IND, 0.14, h);
    g.box(0.12, 0, 0.15, 0.68, h, 0.62, { noTop: true });
    g.noWin().color(roof).gable(0.12, 0.15, 0.68, 0.62, h, 0.07, 'x', 0.02, wall);
    frontQuad(g, 0.28, 0.5, 0, F * 0.95, 0.622, 0x6a6e72);
    if (r.chance(0.6)) chimney(g, 0.2, 0.25, h, 0.22, 0.025, 0x6a5a4a, 'smoke');
    crates(g, c, 0.72, 0.2, 0.9, 0.6, 3);
    barrels(g, c, 0.75, 0.72, 2);
    fence(g, 0.05, 0.05, 0.95, 0.95, 0.045, FENCE, false);
    car(g, 0.4, 0.82, true, r.pick(PAL.cars));
  } else {
    const h = F * 1.5;
    block(g, 0.1, 0.12, 0.9, 0.6, 0, h, wall, roof, WIN.IND, 0.18, h);
    frontQuad(g, 0.2, 0.42, 0, F, 0.602, 0x5a5e62);
    frontQuad(g, 0.55, 0.77, 0, F, 0.602, 0x5a5e62);
    g.noWin()
      .color(shade(roof, 0.9))
      .box(0.15, F * 1.05, 0.6, 0.85, F * 1.1, 0.68);
    truck(g, 0.31, 0.78, false, r.pick(PAL.cars));
    crates(g, c, 0.65, 0.72, 0.9, 0.92, 2);
  }
};

/** 1x1 clean tech: startup, software house, server farm. */
export const techSmall: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.name === 'Server Farm') {
    g.rect(0.04, 0.04, 0.96, 0.96, 0.012, PAL.concrete);
    g.noWin().color(0xe6eaee);
    g.box(0.1, 0, 0.1, 0.9, F * 0.9, 0.42, { top: 0xc8ccd0 });
    g.box(0.1, 0, 0.5, 0.65, F * 0.9, 0.85, { top: 0xc8ccd0 });
    for (const [x, z] of [
      [0.25, 0.26],
      [0.5, 0.26],
      [0.75, 0.26],
      [0.3, 0.68],
    ])
      acUnit(g, x, z, F * 0.9, 1);
    block(g, 0.7, 0.55, 0.9, 0.85, 0, F, PAL.glassBlue, PAL.flatRoof, WIN.GLASS, 0.1);
    fence(g, 0.05, 0.05, 0.95, 0.95, 0.05, FENCE, false);
  } else {
    const floors = c.name === 'Software House' ? 3 : 2;
    const wall = r.pick(PAL.techWalls);
    const accent = r.pick([PAL.orange, PAL.green, PAL.blue, 0x2bb3a3, 0xe86a92]);
    const top = floors * F;
    g.rect(0.45, 0.7, 0.55, 0.97, 0.012, PAL.sidewalk);
    block(g, 0.15, 0.15, 0.85, 0.7, 0, top, wall, 0xd8dcdf, WIN.GLASS, 0.12);
    g.noWin()
      .color(accent)
      .box(0.13, 0, 0.6, 0.3, top + 0.02, 0.72, { top: shade(accent, 0.85) });
    g.rect(0.2, 0.2, 0.5, 0.45, top + 0.008, 0x2a3f6f);
    g.rect(0.55, 0.2, 0.8, 0.45, top + 0.008, ROOF_GREEN);
    lotTree(g, c, 0.85, 0.85, 0.8);
    car(g, 0.25, 0.85, true, r.pick(PAL.cars));
  }
};

/** 2x2 small factory or warehouse. */
export const factorySmall: ModelFn = (g, c) => {
  const r = c.rng;
  const roof = r.pick(PAL.industrialRoof);
  if (c.wealth === 0) {
    const wall = r.pick(PAL.walls.brick);
    const h = F * 1.6;
    g.rect(0.05, 0.05, 1.95, 1.95, 0.012, PAL.gravel);
    g.color(wall).win(WIN.IND, 0.16, h);
    g.box(0.2, 0, 0.2, 1.35, h, 1.3, { noTop: true });
    sawtooth(g, 0.2, 0.2, 1.35, 1.3, h, 3, 0.16, roof);
    chimney(g, 1.6, 0.4, 0, 1.0, 0.07, shade(wall, 0.85), 'smoke');
    block(g, 1.45, 0.9, 1.85, 1.55, 0, 2 * F, r.pick(PAL.walls.low), PAL.flatRoof, WIN.OFFICE, 0.12);
    frontQuad(g, 0.5, 0.8, 0, F, 1.302, 0x5a5e62);
    crates(g, c, 0.25, 1.45, 1.25, 1.85, 5);
    barrels(g, c, 1.5, 1.7, 3);
    truck(g, 0.95, 1.68, true, r.pick(PAL.cars));
    fence(g, 0.06, 0.06, 1.94, 1.94, 0.05, FENCE, false);
  } else {
    const wall = r.pick(PAL.industrial);
    const h = F * 1.8;
    g.rect(0.05, 1.1, 1.95, 1.95, 0.012, PAL.asphalt);
    g.color(wall).win(WIN.IND, 0.2, h);
    g.box(0.15, 0, 0.15, 1.85, h, 1.1, { noTop: true });
    g.noWin().color(roof).gable(0.15, 0.15, 1.85, 1.1, h, 0.09, 'x', 0.02, wall);
    for (const dx of [0.35, 0.75, 1.15, 1.55]) frontQuad(g, dx - 0.12, dx + 0.12, 0, F * 0.9, 1.102, 0x4a4e52);
    g.color(shade(roof, 0.9)).box(0.2, F * 0.95, 1.1, 1.8, F, 1.2);
    truck(g, 0.35, 1.38, false, r.pick(PAL.cars));
    truck(g, 1.15, 1.38, false, r.pick(PAL.cars), r.pick([0xe8e8e4, 0x3f7fd6, 0xd6453d]));
    g.color(r.pick(PAL.awnings)).box(0.7, h - 0.12, 1.1, 1.3, h - 0.02, 1.12);
  }
};

/** 2x2 clean industry: research lab, electronics plant, biotech plant. */
export const techLab: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick(PAL.techWalls);
  if (c.name === 'Electronics Plant') {
    block(g, 0.15, 0.2, 1.85, 1.15, 0, 2 * F, wall, 0xd8dcdf, WIN.IND, 0.18);
    g.noWin()
      .color(PAL.glassBlue)
      .box(0.14, F * 1.2, 0.19, 1.86, F * 1.45, 1.16, { noTop: true });
    block(g, 0.5, 1.15, 1.5, 1.5, 0, 3 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.12);
    roofUnits(g, c, 0.15, 0.2, 1.85, 1.15, 2 * F, 4);
    parking(g, c, 0.1, 1.62, 1.9, 1.95, 5);
    lotTree(g, c, 0.25, 1.35, 1.0);
    lotTree(g, c, 1.75, 1.35, 1.0);
  } else if (c.name === 'Biotech Plant') {
    block(g, 0.15, 0.15, 1.2, 1.1, 0, 3 * F, wall, 0xd8dcdf, WIN.GLASS, 0.13);
    for (const [tx, tz] of [
      [1.45, 0.35],
      [1.72, 0.35],
      [1.58, 0.66],
    ])
      tank(g, tx, tz, 0.11, 0.32, 0xf2f4f6);
    g.color(PAL.steel).beam([1.2, 0.2, 0.5], [1.58, 0.2, 0.5], 0.02);
    block(g, 1.3, 0.95, 1.85, 1.5, 0, F * 1.2, PAL.glassGreen, 0xb8d8c8, WIN.GLASS, 0.1);
    g.rect(0.2, 1.2, 1.2, 1.9, 0.012, shade(PAL.grass, 1.1));
    lotTree(g, c, 0.4, 1.5, 1.1);
    lotTree(g, c, 0.9, 1.7, 1.0);
    parking(g, c, 1.3, 1.6, 1.9, 1.95, 2, false);
  } else {
    block(g, 0.2, 0.25, 1.25, 0.95, 0, 2 * F, wall, 0xd8dcdf, WIN.GLASS, 0.13);
    block(g, 0.95, 0.85, 1.8, 1.55, 0, 3 * F, wall, 0xd8dcdf, WIN.OFFICE, 0.15);
    g.noWin()
      .color(PAL.steel)
      .beam([0.5, 2 * F, 0.5], [0.5, 2 * F + 0.12, 0.5], 0.02);
    g.color(PAL.white).cylinder(0.5, 0.5, 0.1, 2 * F + 0.12, 2 * F + 0.14, 8, 0xe8ecef);
    g.rect(0.3, 1.1, 0.9, 1.9, 0.012, shade(PAL.grass, 1.12));
    g.rect(1.3, 1.55, 1.4, 1.97, 0.012, PAL.sidewalk);
    lotTree(g, c, 0.45, 1.35, 1.1);
    lotTree(g, c, 0.75, 1.7, 1.0);
    pine(g, c, 1.75, 0.3, 1.1);
    parking(g, c, 1.45, 1.65, 1.9, 1.95, 2, false);
  }
};

/** 1x1 storage tanks, tank farm, grain silos. */
export const tanks: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.04, 0.04, 0.96, 0.96, 0.012, PAL.concrete);
  if (c.name === 'Grain Silo') {
    const col = r.pick([0xe8e4dc, 0xd8d0c0, 0xc8ccd0]);
    for (const [x, z] of [
      [0.28, 0.3],
      [0.52, 0.3],
      [0.28, 0.56],
      [0.52, 0.56],
    ]) {
      g.noWin()
        .color(col)
        .lathe(
          x,
          z,
          [
            [0.11, 0],
            [0.11, 0.52],
            [0, 0.6],
          ],
          8,
        );
    }
    g.color(shade(col, 0.85)).box(0.72, 0, 0.22, 0.88, 0.75, 0.42, { top: PAL.flatRoofDark });
    g.color(PAL.steel).beam([0.72, 0.7, 0.32], [0.4, 0.62, 0.43], 0.025);
    truck(g, 0.3, 0.82, true, r.pick(PAL.cars), 0xb89a5a);
  } else if (c.name === 'Tank Farm') {
    const col = r.pick([0xf2f2ee, 0xd8dce0, 0xe8e0c8]);
    tank(g, 0.4, 0.4, 0.3, 0.2, col, 0, 10);
    tank(g, 0.82, 0.22, 0.1, 0.18, shade(col, 0.95));
    tank(g, 0.82, 0.55, 0.1, 0.18, shade(col, 0.95));
    g.color(PAL.steel).beam([0.4, 0.04, 0.75], [0.85, 0.04, 0.75], 0.02);
    g.beam([0.82, 0.04, 0.32], [0.82, 0.04, 0.75], 0.02);
    g.noWin().color(0x9a958c).box(0.15, 0, 0.78, 0.35, 0.08, 0.92);
  } else {
    const col = r.pick([0xf2f2ee, 0xd8dce0, 0xe8e0c8, 0xc8d0d8]);
    tank(g, 0.3, 0.3, 0.17, 0.3, col);
    tank(g, 0.7, 0.3, 0.13, 0.24, shade(col, 0.94));
    tank(g, 0.45, 0.72, 0.15, 0.28, shade(col, 0.97));
    g.color(PAL.steel).beam([0.3, 0.05, 0.3], [0.7, 0.05, 0.3], 0.018);
    g.beam([0.45, 0.05, 0.72], [0.3, 0.05, 0.3], 0.018);
    g.noWin().color(0x9a958c).box(0.72, 0, 0.62, 0.9, 0.09, 0.85, { top: PAL.flatRoofDark });
  }
};

/** 2x2 factory (saw-tooth + striped chimney) or assembly plant. */
export const factory: ModelFn = (g, c) => {
  const r = c.rng;
  const roof = r.pick(PAL.industrialRoof);
  g.rect(0.05, 0.05, 1.95, 1.95, 0.012, PAL.gravel);
  if (c.wealth === 0) {
    const wall = r.pick(PAL.walls.brick);
    const h = F * 1.8;
    g.color(wall).win(WIN.IND, 0.16, h);
    g.box(0.15, 0, 0.2, 1.45, h, 1.4, { noTop: true });
    sawtooth(g, 0.15, 0.2, 1.45, 1.4, h, 4, 0.15, roof);
    chimney(g, 1.68, 0.42, 0, 1.25, 0.08, 0xc8c0b8, 'dark', true);
    block(g, 1.5, 0.9, 1.9, 1.5, 0, F * 2, shade(wall, 0.9), PAL.flatRoofDark, WIN.IND, 0.14);
    frontQuad(g, 0.55, 0.9, 0, F * 1.1, 1.402, 0x5a5e62);
    g.noWin().color(0x4a4a4a).pyramid(0.35, 1.7, 0.3, 0.3, 0, 0.12);
    g.color(0x8a8070).pyramid(0.7, 1.72, 0.28, 0.26, 0, 0.1);
    crates(g, c, 1.0, 1.55, 1.4, 1.85, 3);
    truck(g, 1.55, 1.75, true, r.pick(PAL.cars));
  } else {
    const wall = r.pick(PAL.industrial);
    const h = F * 1.6;
    block(g, 0.15, 0.15, 1.85, 1.25, 0, h, wall, roof, WIN.IND, 0.2, h);
    for (const sx of [0.4, 0.9, 1.4]) g.rect(sx, 0.3, sx + 0.25, 1.1, h + 0.006, 0x9cc4dc);
    roofUnits(g, c, 0.15, 0.15, 1.85, 1.25, h, 2);
    g.emitter(1.7, h + 0.05, 0.3, 'steam');
    g.noWin()
      .color(PAL.steel)
      .cylinder(1.7, 0.3, 0.03, h, h + 0.08, 6);
    block(g, 0.25, 1.25, 0.95, 1.6, 0, 2 * F, r.pick(PAL.officeWalls), PAL.flatRoof, WIN.OFFICE, 0.15);
    for (const dx of [1.2, 1.55]) frontQuad(g, dx - 0.12, dx + 0.12, 0, F * 0.9, 1.252, 0x4a4e52);
    truck(g, 1.2, 1.52, false, r.pick(PAL.cars));
    truck(g, 1.55, 1.52, false, r.pick(PAL.cars));
  }
};

/** 3x3 heavy factory, distribution center, auto plant. */
export const factoryBig: ModelFn = (g, c) => {
  const r = c.rng;
  const roof = r.pick(PAL.industrialRoof);
  if (c.name === 'Distribution Center') {
    const wall = r.pick(PAL.industrial);
    const h = F * 2.1;
    g.rect(0.05, 1.6, 2.95, 2.95, 0.012, PAL.asphalt);
    block(g, 0.15, 0.15, 2.85, 1.6, 0, h, wall, roof, WIN.IND, 0.3, h);
    for (const sx of [0.4, 1.0, 1.6, 2.2]) g.rect(sx, 0.35, sx + 0.3, 1.4, h + 0.006, 0x9cc4dc);
    for (let i = 0; i < 8; i++) frontQuad(g, 0.3 + i * 0.32, 0.5 + i * 0.32, 0, F * 0.9, 1.602, 0x3f4347);
    const colors = [0xe8e8e4, 0x3f7fd6, 0xd6453d, 0xe8e8e4, 0x4caf50];
    for (let i = 0; i < 5; i++) if (r.chance(0.8)) truck(g, 0.4 + i * 0.64, 1.88, false, r.pick(PAL.cars), colors[i]);
    for (let i = 0; i < 9; i++) g.rect(0.2 + i * 0.3, 2.25, 0.21 + i * 0.3, 2.45, 0.015, PAL.laneWhite);
    block(g, 2.35, 2.45, 2.85, 2.9, 0, 2 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.12);
    parking(g, c, 0.15, 2.55, 2.2, 2.9, 5, false);
  } else if (c.name === 'Auto Plant') {
    const wall = r.pick(PAL.industrial);
    g.rect(0.05, 0.05, 2.95, 2.95, 0.012, PAL.gravel);
    block(g, 0.15, 0.15, 1.9, 1.5, 0, F * 2, wall, roof, WIN.IND, 0.22, F * 2);
    for (const sx of [0.35, 0.85, 1.35]) g.rect(sx, 0.3, sx + 0.3, 1.35, F * 2 + 0.006, 0x9cc4dc);
    block(g, 2.0, 0.15, 2.85, 1.1, 0, F * 2.6, shade(wall, 0.92), PAL.flatRoofDark, WIN.IND, 0.2);
    chimney(g, 2.65, 0.35, F * 2.6, 0.35, 0.04, PAL.steel, 'steam');
    block(g, 2.0, 1.2, 2.85, 1.55, 0, 2 * F, r.pick(PAL.officeWalls), PAL.flatRoof, WIN.OFFICE, 0.14);
    g.rect(0.15, 1.75, 2.85, 2.85, 0.013, PAL.asphalt);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 7; i++) {
        if (r.chance(0.85)) car(g, 0.35 + i * 0.36, 1.9 + row * 0.33, true, r.pick(PAL.cars));
      }
    }
  } else {
    const wall = r.pick(PAL.walls.brick);
    const h = F * 2.2;
    g.rect(0.05, 0.05, 2.95, 2.95, 0.012, PAL.gravel);
    g.color(wall).win(WIN.IND, 0.18, h);
    g.box(0.2, 0, 0.2, 2.0, h, 1.9, { noTop: true });
    sawtooth(g, 0.2, 0.2, 2.0, 1.9, h, 5, 0.17, roof);
    block(g, 2.15, 0.2, 2.85, 1.3, 0, F * 2.8, shade(wall, 0.88), PAL.flatRoofDark, WIN.IND, 0.16);
    chimney(g, 2.3, 1.6, 0, 1.45, 0.09, 0xb8b0a8, 'dark', true);
    chimney(g, 2.65, 1.6, 0, 1.2, 0.08, 0xb8b0a8, 'smoke', true);
    if (r.chance(0.5)) chimney(g, 2.5, 1.95, 0, 1.0, 0.07, 0x8a8078, 'dark');
    g.noWin().color(0x3a3a3a).pyramid(0.45, 2.45, 0.5, 0.5, 0, 0.2);
    g.color(0x8a8070).pyramid(1.1, 2.5, 0.45, 0.4, 0, 0.16);
    g.color(PAL.steel).beam([0.6, 0.08, 2.4], [1.2, h, 1.85], 0.03);
    truck(g, 1.8, 2.3, true, r.pick(PAL.cars));
    truck(g, 2.4, 2.65, true, r.pick(PAL.cars));
    fence(g, 0.06, 0.06, 2.94, 2.94, 0.05, FENCE, false);
  }
};

/** 3x3 tech campus or headquarters. */
export const techCampus: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick(PAL.techWalls);
  if (c.name === 'Tech Headquarters') {
    const a = r.pick(GLASS_WALLS);
    g.rect(0.06, 0.06, 2.94, 1.75, 0.01, 0xd8d2c4);
    const top = r.int(8, 10) * F;
    block(g, 1.0, 0.4, 2.0, 1.4, 0, top, a, GLASS_ROOF, WIN.GLASS, 0.12);
    g.noWin()
      .color(r.pick([PAL.orange, PAL.green, PAL.blue, 0xe86a92]))
      .box(1.3, top, 1.38, 1.7, top + 0.12, 1.42);
    block(g, 0.2, 0.3, 0.95, 1.6, 0, 3 * F, wall, 0xd8dcdf, WIN.OFFICE, 0.15);
    block(g, 2.05, 0.3, 2.8, 1.6, 0, 3 * F, wall, 0xd8dcdf, WIN.OFFICE, 0.15);
    g.rect(0.25, 0.35, 0.9, 1.55, 3 * F + 0.006, ROOF_GREEN);
    pond(g, 0.5, 1.95, 1.4, 2.6);
    g.rect(1.45, 1.4, 1.55, 2.95, 0.012, PAL.sidewalk);
    for (const [tx, tz] of [
      [1.8, 2.0],
      [2.3, 2.3],
      [2.7, 2.0],
      [2.0, 2.7],
      [0.3, 2.75],
      [0.35, 1.85],
    ])
      lotTree(g, c, tx, tz, 1.0 + r.next() * 0.3);
  } else {
    block(g, 0.2, 0.2, 1.3, 0.9, 0, 3 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.12);
    block(g, 1.7, 0.2, 2.8, 1.0, 0, 4 * F, wall, 0xd8dcdf, WIN.OFFICE, 0.15);
    block(g, 0.2, 1.5, 1.0, 2.6, 0, 2 * F, r.pick(GLASS_WALLS), PAL.flatRoof, WIN.GLASS, 0.12);
    block(g, 2.0, 1.7, 2.8, 2.7, 0, 3 * F, wall, 0xd8dcdf, WIN.GLASS, 0.14);
    g.rect(0.25, 1.55, 0.95, 2.55, 2 * F + 0.006, ROOF_GREEN);
    g.rect(1.1, 1.1, 1.9, 1.9, 0.01, shade(PAL.grass, 1.12));
    pond(g, 1.25, 1.3, 1.75, 1.7);
    g.rect(1.45, 0.9, 1.55, 2.95, 0.012, PAL.sidewalk);
    g.rect(0.2, 1.2, 2.8, 1.28, 0.012, PAL.sidewalk);
    for (const [tx, tz] of [
      [1.2, 2.2],
      [1.8, 2.3],
      [1.15, 0.3],
      [1.55, 0.6],
      [2.6, 1.35],
      [0.4, 2.8],
    ])
      lotTree(g, c, tx, tz, 1.0 + r.next() * 0.3);
    car(g, 1.75, 2.75, true, r.pick(PAL.cars));
  }
};

/** 2x2 chemical plant or steel mill. */
export const heavyPlant: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.05, 0.05, 1.95, 1.95, 0.012, PAL.concrete);
  if (c.name === 'Steel Mill') {
    const rust = r.pick([0x6a4a3a, 0x5a4a42, 0x7a5040]);
    const wall = r.pick(PAL.industrial);
    const h = F * 2.4;
    g.color(wall).win(WIN.IND, 0.2, h);
    g.box(0.15, 0, 0.15, 1.15, h, 1.85, { noTop: true });
    g.noWin().color(r.pick(PAL.industrialRoof)).shed(0.15, 0.15, 1.15, 1.85, h, 0.15, false);
    g.color(rust).lathe(
      1.55,
      0.55,
      [
        [0.2, 0],
        [0.22, 0.25],
        [0.15, 0.7],
        [0.1, 0.85],
        [0.1, 1.0],
      ],
      8,
    );
    g.emitter(1.55, 1.05, 0.55, 'dark');
    for (const [sx, sz] of [
      [1.35, 1.25],
      [1.6, 1.25],
      [1.85, 1.25],
    ]) {
      g.color(0x8a8078).lathe(
        sx,
        sz,
        [
          [0.085, 0],
          [0.085, 0.7],
          [0, 0.78],
        ],
        8,
      );
    }
    g.color(PAL.steel).beam([1.55, 0.95, 0.55], [1.6, 0.7, 1.25], 0.03);
    g.beam([1.0, 0.05, 1.9], [1.45, 0.85, 0.65], 0.04);
    chimney(g, 1.85, 0.25, 0, 1.15, 0.06, 0x8a8078, 'dark');
    g.color(0x4a4a4a).pyramid(1.5, 1.72, 0.35, 0.3, 0, 0.12);
  } else {
    const white = 0xf2f2ee;
    for (const [sx, sz] of [
      [0.42, 0.42],
      [0.42, 0.95],
    ]) {
      g.noWin().color(PAL.steel);
      for (const [lx, lz] of [
        [-0.1, -0.1],
        [0.1, -0.1],
        [-0.1, 0.1],
        [0.1, 0.1],
      ])
        g.box(sx + lx - 0.012, 0, sz + lz - 0.012, sx + lx + 0.012, 0.12, sz + lz + 0.012, { noTop: true });
      g.color(white).sphere(sx, 0.27, sz, 0.17, 0);
    }
    g.color(0xd8dce0).cylinder(1.2, 0.45, 0.07, 0, 1.0, 6);
    g.color(PAL.steel).cylinder(1.2, 0.45, 0.1, 0.45, 0.47, 6);
    g.cylinder(1.2, 0.45, 0.1, 0.75, 0.77, 6);
    g.color(0xd8dce0).cylinder(1.45, 0.75, 0.055, 0, 0.75, 6);
    g.emitter(1.2, 1.03, 0.45, 'steam');
    tank(g, 1.6, 0.35, 0.12, 0.22, 0xe8e0c8);
    g.color(PAL.steel);
    g.beam([0.3, 0.16, 1.3], [1.8, 0.16, 1.3], 0.025);
    g.beam([0.3, 0.2, 1.36], [1.8, 0.2, 1.36], 0.025);
    g.beam([1.2, 0.16, 0.45], [1.2, 0.16, 1.3], 0.025);
    chimney(g, 1.82, 0.9, 0, 1.2, 0.03, 0x9a9ea2, 'dark');
    block(g, 1.3, 1.5, 1.85, 1.88, 0, 2 * F, r.pick(PAL.industrial), PAL.flatRoof, WIN.OFFICE, 0.13);
    barrels(g, c, 0.3, 1.6, 4);
    fence(g, 0.06, 0.06, 1.94, 1.94, 0.05, FENCE, false);
  }
};

/** 3x3 oil refinery: columns, tank farm, flare stack, pipe racks. */
export const refinery: ModelFn = (g, c) => {
  const r = c.rng;
  const tankCol = r.pick([0xf2f2ee, 0xd8dce0, 0xe8e0c8]);
  g.rect(0.05, 0.05, 2.95, 2.95, 0.012, PAL.concrete);
  for (const [tx, tz] of [
    [0.5, 2.45],
    [1.2, 2.45],
    [0.5, 1.75],
    [1.2, 1.75],
  ])
    tank(g, tx, tz, 0.28, 0.22, tankCol, 0, 10);
  for (const [cx, cz, cr, ch] of [
    [2.0, 0.6, 0.1, 1.35],
    [2.35, 0.55, 0.08, 1.05],
    [2.6, 0.95, 0.07, 0.85],
  ] as const) {
    g.noWin().color(0xd8dce0).cylinder(cx, cz, cr, 0, ch, 6);
    g.color(PAL.steel).cylinder(cx, cz, cr + 0.03, ch * 0.45, ch * 0.45 + 0.02, 6);
    g.cylinder(cx, cz, cr + 0.03, ch * 0.75, ch * 0.75 + 0.02, 6);
    g.emitter(cx, ch + 0.03, cz, 'steam');
  }
  // process unit frame
  g.noWin().color(0xb8a088).box(1.6, 0, 1.15, 2.5, 0.22, 1.6, { top: 0x9a8a78 });
  g.color(0xd8dce0).cylinderX(1.65, 2.45, 0.32, 1.38, 0.07, 6);
  // flare stack
  chimney(g, 0.3, 0.35, 0, 1.6, 0.035, 0xc84a3a, 'dark');
  // pipe racks
  g.color(PAL.steel);
  g.beam([0.5, 0.18, 1.35], [2.6, 0.18, 1.35], 0.03);
  g.beam([0.5, 0.24, 1.42], [2.6, 0.24, 1.42], 0.03);
  g.beam([2.0, 0.18, 0.7], [2.0, 0.18, 1.35], 0.03);
  g.beam([0.85, 0.18, 1.35], [0.85, 0.18, 2.1], 0.03);
  block(g, 2.2, 2.2, 2.85, 2.8, 0, 2 * F, r.pick(PAL.industrial), PAL.flatRoof, WIN.OFFICE, 0.13);
  g.noWin().color(0x8a8f94).box(0.7, 0, 0.4, 1.3, 0.12, 0.9, { top: 0x6a6f74 });
  for (const ux of [0.85, 1.15]) g.color(0x5a6068).cylinder(ux, 0.65, 0.09, 0.12, 0.2, 8, 0x3a3f44);
  fence(g, 0.06, 0.06, 2.94, 2.94, 0.05, FENCE, false);
  truck(g, 2.3, 1.9, true, r.pick(PAL.cars), mixHex(tankCol, 0xd6453d, 0.15));
};
