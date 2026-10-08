/** Residential growable models: houses, row houses, apartments and towers. */
import type { ModelFn } from '../types';
import { PAL } from '../../palette';
import {
  antenna,
  bands,
  block,
  car,
  chimney,
  DECK,
  DOOR,
  F,
  fence,
  fountain,
  frontQuad,
  GLASS_ROOF,
  GLASS_WALLS,
  hedge,
  lotTree,
  lum,
  parking,
  pine,
  POOL,
  ROOF_GREEN,
  roofTree,
  roofUnits,
  spire,
  tiers,
  waterTank,
} from './shared';
import { shade, WIN } from '../../geom';

// =============================================================== residential

/** Detached house (bungalow / family house / villa by wealth). */
export const house: ModelFn = (g, c) => {
  const r = c.rng;
  const wall =
    c.wealth === 0 ? r.pick(PAL.walls.low) : c.wealth === 1 ? r.pick([...PAL.walls.mid, ...PAL.walls.pastel]) : r.pick(PAL.walls.high);
  const roof = r.pick(PAL.roofList);
  const floors = c.wealth === 0 ? 1 : c.wealth === 1 ? r.int(1, 2) : 2;
  const hw = c.wealth === 2 ? 0.34 : 0.27 + r.next() * 0.04; // half width
  const hd = c.wealth === 2 ? 0.24 : 0.2 + r.next() * 0.03;
  const cx = 0.5 + (r.next() - 0.5) * 0.06;
  const cz = 0.42;
  const top = floors * F;

  // driveway / path to the front (+z)
  g.rect(cx - 0.05, cz + hd, cx + 0.05, 0.98, 0.012, PAL.sidewalk);

  g.color(wall).win(WIN.RES, 0.13, F);
  g.box(cx - hw, 0, cz - hd, cx + hw, top, cz + hd, { noTop: true });

  g.noWin().color(roof);
  if (c.wealth === 2 && r.chance(0.5)) g.hip(cx - hw, cz - hd, cx + hw, cz + hd, top, 0.16, 0.035);
  else g.gable(cx - hw, cz - hd, cx + hw, cz + hd, top, 0.15 + r.next() * 0.04, 'x', 0.035, wall);

  if (r.chance(0.6)) {
    g.color(shade(wall, 0.75));
    const chx = cx + hw * 0.55;
    g.box(chx - 0.025, top, cz - 0.05, chx + 0.025, top + 0.17, cz);
  }

  // door (+ porch roof for bungalows)
  frontQuad(g, cx - 0.035, cx + 0.035, 0, 0.09, cz + hd + 0.002, shade(roof, 0.8));
  if (c.wealth === 0 && r.chance(0.5)) {
    g.color(shade(wall, 0.9)).box(cx - 0.1, 0.085, cz + hd, cx + 0.1, 0.1, cz + hd + 0.08);
  }

  if (c.wealth >= 1 && r.chance(0.6)) {
    // attached garage on the side
    const gx0 = cx + hw;
    const gx1 = Math.min(0.95, gx0 + 0.16);
    g.color(shade(wall, 0.92));
    g.box(gx0, 0, cz - 0.1, gx1, F * 0.85, cz + hd);
    frontQuad(g, gx0 + 0.02, gx1 - 0.02, 0, 0.08, cz + hd + 0.002, PAL.white);
    g.rect(gx0 + 0.02, cz + hd, gx1 - 0.02, 0.98, 0.012, PAL.sidewalk);
  }
  if (c.wealth === 2) {
    // pool behind the villa, hedges along the street
    g.rect(0.18, 0.04, 0.55, 0.16, 0.014, POOL);
    hedge(g, 0.04, 0.9, 0.3, 0.96);
    hedge(g, 0.7, 0.9, 0.96, 0.96);
  } else if (c.wealth === 1 && r.chance(0.5)) {
    fence(g, 0.04, 0.04, 0.96, 0.4, 0.04, PAL.white, false);
  }
  lotTree(g, c, 0.14 + r.next() * 0.06, 0.8 + r.next() * 0.1, 0.9 + r.next() * 0.4);
  if (r.chance(0.5)) lotTree(g, c, 0.86, 0.12 + r.next() * 0.2, 0.8 + r.next() * 0.5);
};

/** 2x2 estate: main block, wings, portico, pool and gardens. */
export const mansion: ModelFn = (g, c) => {
  const r = c.rng;
  const wall = r.pick(PAL.walls.high);
  const roof = r.pick([PAL.roofs.slate, PAL.roofs.charcoal, PAL.roofs.terracotta, PAL.roofs.blue, PAL.roofs.green, PAL.roofs.red]);
  const floors = r.int(2, 3);
  const top = floors * F;
  // grounds
  g.rect(0.93, 1.13, 1.07, 1.97, 0.012, PAL.sidewalk);
  g.rect(0.6, 1.4, 1.4, 1.64, 0.013, PAL.sidewalk);
  const px = 0.62 + r.next() * 0.3;
  g.rect(px - 0.06, 0.08, px + 0.58, 0.47, 0.012, DECK);
  g.rect(px, 0.13, px + 0.52, 0.42, 0.014, POOL);
  // main block
  const mx0 = 0.55;
  const mx1 = 1.45;
  const mz0 = 0.55;
  const mz1 = 1.05;
  g.color(wall).win(WIN.RES, 0.12, F);
  g.box(mx0, 0, mz0, mx1, top, mz1, { noTop: true });
  g.noWin().color(roof).hip(mx0, mz0, mx1, mz1, top, 0.2, 0.04);
  // wings
  const wingMode = r.int(0, 2);
  const wingTop = Math.max(1, floors - 1) * F;
  const wings: [number, number][] = [];
  if (wingMode !== 1) wings.push([0.2, 0.6]);
  if (wingMode !== 0) wings.push([1.4, 1.8]);
  for (const [wx0, wx1] of wings) {
    g.color(wall).win(WIN.RES, 0.12, F);
    g.box(wx0, 0, 0.42, wx1, wingTop, 1.28, { noTop: true });
    g.noWin().color(roof).hip(wx0, 0.42, wx1, 1.28, wingTop, 0.15, 0.035);
  }
  // portico with columns and a pediment
  const colTop = Math.min(top, 2 * F) - 0.01;
  g.color(PAL.white);
  for (const x of [0.8, 0.92, 1.08, 1.2]) g.box(x - 0.014, 0, 1.1, x + 0.014, colTop, 1.128, { noTop: true });
  g.box(0.74, colTop, 1.05, 1.26, colTop + 0.03, 1.15, { top: shade(PAL.white, 0.95) });
  g.color(roof).gable(0.74, 1.05, 1.26, 1.15, colTop + 0.03, 0.08, 'z', 0.01, PAL.white);
  frontQuad(g, 0.96, 1.04, 0, 0.1, mz1 + 0.002, 0x5a3a28);
  // chimneys
  g.color(shade(wall, 0.8));
  g.box(mx0 + 0.1, top - 0.05, mz0 + 0.08, mx0 + 0.17, top + 0.24, mz0 + 0.15);
  g.box(mx1 - 0.17, top - 0.05, mz0 + 0.08, mx1 - 0.1, top + 0.24, mz0 + 0.15);
  fountain(g, 1.0, 1.52);
  hedge(g, 0.06, 1.86, 0.86, 1.93);
  hedge(g, 1.14, 1.86, 1.94, 1.93);
  lotTree(g, c, 0.18, 0.2, 1.2);
  lotTree(g, c, 1.82, 0.2, 1.1);
  pine(g, c, 0.2, 1.62, 1.2);
  pine(g, c, 1.8, 1.62, 1.3);
  if (r.chance(0.6)) lotTree(g, c, 0.4, 1.72, 0.9);
};

/** 1x1 row of narrow attached houses. */
export const townhouse: ModelFn = (g, c) => {
  const r = c.rng;
  const n = c.wealth === 2 ? 3 : r.int(3, 4);
  const x0 = 0.05;
  const x1 = 0.95;
  const zb = 0.18;
  const zf = 0.72;
  const uw = (x1 - x0) / n;
  const base = c.wealth === 0 ? 2 : c.wealth === 1 ? r.int(2, 3) : 3;
  const palette =
    c.wealth === 0
      ? [...PAL.walls.brick, ...PAL.walls.low]
      : c.wealth === 1
        ? PAL.walls.pastel
        : [0x8e5c44, 0x7f4f3a, 0xd8c9a8, 0xa65a3f, 0xc9b49a, 0x9a6a52];
  g.rect(x0, zf, x1, 0.95, 0.012, c.wealth === 1 ? shade(PAL.grass, 1.1) : PAL.sidewalk);
  let prev = -1;
  for (let i = 0; i < n; i++) {
    const ux0 = x0 + i * uw;
    const ux1 = ux0 + uw;
    const floors = base + (c.wealth !== 2 && r.chance(0.3) ? 1 : 0);
    const top = floors * F + (c.wealth !== 1 ? r.int(0, 2) * 0.014 : 0);
    let wall = r.pick(palette);
    if (wall === prev) wall = r.pick(palette);
    prev = wall;
    const light = lum(wall) > 150;
    g.color(wall).win(WIN.RES, 0.1, F);
    if (c.wealth === 1) {
      g.box(ux0, 0, zb, ux1, top, zf, { noTop: true });
      g.noWin()
        .color(r.pick(PAL.roofList))
        .gable(ux0, zb, ux1, zf, top, 0.12 + r.next() * 0.05, 'z', 0.008, wall);
    } else {
      g.box(ux0, 0, zb, ux1, top, zf, { top: r.pick([PAL.flatRoof, PAL.flatRoofDark, 0x7a746c]) });
      g.noWin()
        .color(light ? shade(wall, 0.7) : 0xe8e0d0)
        .box(ux0, top - 0.02, zf, ux1, top + 0.012, zf + 0.025);
    }
    const dx = ux0 + uw * (i % 2 === 0 ? 0.3 : 0.7);
    if (c.wealth === 2) {
      // stoop, raised door and a bay window next to it
      g.color(shade(wall, 0.8)).box(dx - 0.035, 0, zf, dx + 0.035, 0.035, zf + 0.08);
      frontQuad(g, dx - 0.025, dx + 0.025, 0.035, 0.12, zf + 0.002, 0x2b2420);
      const bx0 = i % 2 === 0 ? dx + 0.05 : ux0 + 0.025;
      const bx1 = i % 2 === 0 ? ux1 - 0.025 : dx - 0.05;
      g.color(shade(wall, 1.06)).win(WIN.RES, 0.06, F);
      g.box(bx0, 0.035, zf, bx1, top - F * 0.6, zf + 0.045, { top: shade(wall, 0.75) });
    } else {
      frontQuad(g, dx - 0.025, dx + 0.025, 0, 0.09, zf + 0.002, 0x4a3a30);
    }
  }
  if (c.wealth !== 2 && (n === 3 || r.chance(0.5))) lotTree(g, c, 0.2 + r.next() * 0.6, 0.09, 0.8);
};

/** 2x2 apartment buildings: brick walk-up, L-shaped stucco, or terraced condos. */
export const apartments: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.wealth === 0) {
    const wall = r.pick(PAL.walls.brick);
    const floors = r.int(4, 5);
    const top = floors * F;
    const x0 = 0.15;
    const x1 = 1.85;
    const z0 = 0.2;
    const z1 = 1.15;
    block(g, x0, z0, x1, z1, 0, top, wall, PAL.flatRoofDark, WIN.RES, 0.12);
    g.noWin()
      .color(shade(wall, 0.72))
      .box(x0 - 0.012, top - 0.025, z1, x1 + 0.012, top + 0.012, z1 + 0.025);
    // fire escapes
    for (const fx of [0.5, 1.5]) {
      g.color(0x34363a);
      for (let f = 1; f < floors; f++) g.box(fx - 0.1, f * F - 0.006, z1, fx + 0.1, f * F + 0.006, z1 + 0.05);
    }
    frontQuad(g, 0.95, 1.05, 0, 0.1, z1 + 0.002, DOOR);
    g.color(0x5a5a58).box(0.92, 0.1, z1, 1.08, 0.115, z1 + 0.06);
    waterTank(g, 0.45, 0.5, top);
    g.color(0x8f8a84).box(1.3, top, 0.4, 1.5, top + 0.09, 0.62);
    g.rect(0.95, z1, 1.05, 1.97, 0.012, PAL.sidewalk);
    for (const tx of [0.3, 0.7, 1.3, 1.7]) lotTree(g, c, tx, 1.8, 0.9 + r.next() * 0.3);
    car(g, 0.35, 1.5, true, r.pick(PAL.cars));
  } else if (c.wealth === 1) {
    const wall = r.pick([...PAL.walls.mid, ...PAL.walls.pastel]);
    const roof = r.pick([PAL.roofs.terracotta, PAL.roofs.red, PAL.roofs.slate, PAL.roofs.brown]);
    const floors = r.int(4, 6);
    const top = floors * F;
    const left = r.chance(0.5);
    g.color(wall).win(WIN.RES, 0.12, F);
    g.box(0.15, 0, 0.15, 1.85, top, 0.75, { noTop: true });
    g.noWin().color(roof).hip(0.15, 0.15, 1.85, 0.75, top, 0.2, 0.03);
    const wx0 = left ? 0.15 : 1.25;
    const wx1 = left ? 0.75 : 1.85;
    g.color(wall).win(WIN.RES, 0.12, F);
    g.box(wx0, 0, 0.75, wx1, top, 1.8, { noTop: true });
    g.noWin().color(roof).hip(wx0, 0.45, wx1, 1.8, top, 0.2, 0.03);
    // balconies on the faces around the courtyard
    const rail = r.pick([PAL.white, 0xd8d4cc, 0xe8dcc4]);
    bands(g, 0, left ? 0.85 : 0.25, left ? 1.75 : 1.15, 0.75, F - 0.006, floors - 1, F, rail);
    bands(g, left ? 2 : 3, 0.85, 1.7, left ? 0.75 : 1.25, F - 0.006, floors - 1, F, rail);
    // courtyard
    const cx0 = left ? 0.75 : 0.15;
    const cx1 = left ? 1.85 : 1.25;
    g.rect(cx0 + 0.08, 1.12, cx1 - 0.08, 1.22, 0.012, PAL.sidewalk);
    lotTree(g, c, (cx0 + cx1) / 2 - 0.3, 0.95, 1.1);
    lotTree(g, c, (cx0 + cx1) / 2 + 0.3, 1.45, 1.0);
    pine(g, c, (cx0 + cx1) / 2 + 0.25, 0.92, 1.1);
    const dcx = (wx0 + wx1) / 2;
    frontQuad(g, dcx - 0.04, dcx + 0.04, 0, 0.1, 1.802, DOOR);
    g.rect(dcx - 0.05, 1.8, dcx + 0.05, 1.97, 0.012, PAL.sidewalk);
  } else {
    const wall = r.pick(PAL.walls.high);
    const roof = 0xd8d4cc;
    const rail = 0x9fc8d8;
    const y1 = 2 * F;
    const y2 = y1 + r.int(2, 3) * F;
    const y3 = y2 + r.int(1, 2) * F;
    block(g, 0.2, 0.2, 1.8, 1.45, 0, y1, wall, roof, WIN.GLASS, 0.16);
    block(g, 0.2, 0.2, 1.8, 1.1, y1, y2, wall, roof, WIN.GLASS, 0.16);
    block(g, 0.4, 0.2, 1.6, 0.8, y2, y3, wall, roof, WIN.GLASS, 0.16);
    // terraces: roof gardens and glass railings
    g.rect(0.26, 1.14, 1.74, 1.4, y1 + 0.006, ROOF_GREEN);
    g.rect(0.46, 0.84, 1.54, 1.05, y2 + 0.006, ROOF_GREEN);
    g.noWin().color(rail);
    g.panel([0.2, y1, 1.45], [1.8, y1, 1.45], [1.8, y1 + 0.04, 1.45], [0.2, y1 + 0.04, 1.45]);
    g.panel([0.2, y2, 1.1], [1.8, y2, 1.1], [1.8, y2 + 0.04, 1.1], [0.2, y2 + 0.04, 1.1]);
    roofTree(g, c, 0.45, 1.27, y1, 0.6);
    roofTree(g, c, 1.55, 1.27, y1, 0.6);
    // pool in the front garden
    g.rect(0.3, 1.58, 1.42, 1.9, 0.012, DECK);
    g.rect(0.38, 1.63, 1.34, 1.85, 0.014, POOL);
    lotTree(g, c, 1.7, 1.75, 1.1);
    lotTree(g, c, 0.12, 1.75, 0.9);
  }
};

/** 3x3 housing: concrete slabs, courtyard block, or terraced garden residences. */
export const aptComplex: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.wealth === 0) {
    const wall = r.pick([0xc9c4ba, 0xbdb6a8, 0xd2c8b4, 0xb8b2a6, 0xd8c8a8]);
    const accent = r.pick(PAL.walls.pastel);
    const floors = r.int(5, 7);
    const top = floors * F;
    for (const [z0, z1] of [
      [0.2, 0.75],
      [1.2, 1.75],
    ] as const) {
      block(g, 0.2, z0, 2.8, z1, 0, top, wall, PAL.flatRoofDark, WIN.RES, 0.11);
      for (const sx of [0.85, 2.15]) {
        g.noWin()
          .color(accent)
          .box(sx - 0.08, 0, z1, sx + 0.08, top + 0.06, z1 + 0.06, { top: shade(accent, 0.85) });
        frontQuad(g, sx - 0.035, sx + 0.035, 0, 0.1, z1 + 0.062, DOOR);
      }
    }
    parking(g, c, 0.2, 2.05, 1.7, 2.85, 5);
    // playground
    g.rect(1.9, 2.05, 2.8, 2.85, 0.013, 0xd8c8a0);
    g.noWin().color(PAL.red).box(2.05, 0, 2.25, 2.15, 0.09, 2.35);
    g.color(PAL.yellow).face(
      [
        [2.15, 0.09, 2.25],
        [2.15, 0.09, 2.35],
        [2.4, 0.015, 2.35],
        [2.4, 0.015, 2.25],
      ],
      [0.4, 1, 0],
    );
    g.color(0x3f7fd6);
    g.beam([2.3, 0, 2.55], [2.3, 0.12, 2.55], 0.012);
    g.beam([2.6, 0, 2.55], [2.6, 0.12, 2.55], 0.012);
    g.beam([2.3, 0.12, 2.55], [2.6, 0.12, 2.55], 0.012);
    lotTree(g, c, 0.5, 1.0, 1.1);
    lotTree(g, c, 1.5, 0.98, 1.0);
    pine(g, c, 2.5, 1.0, 1.2);
    lotTree(g, c, 2.65, 1.95, 1.0);
  } else if (c.wealth === 1) {
    const wall = r.pick([...PAL.walls.brick, ...PAL.walls.mid]);
    const roof = r.pick([PAL.flatRoofDark, 0x7a7068, 0x6a7078]);
    const towerRoof = r.pick([PAL.roofs.slate, PAL.roofs.terracotta, PAL.roofs.charcoal, PAL.roofs.green]);
    const floors = r.int(5, 6);
    const top = floors * F;
    const t = 0.55;
    const bars: [number, number, number, number][] = [
      [0.2, 0.2, 2.8, 0.2 + t],
      [0.2, 0.2 + t, 0.2 + t, 2.8],
      [2.8 - t, 0.2 + t, 2.8, 2.8],
      [0.2 + t, 2.8 - t, 1.3, 2.8],
      [1.7, 2.8 - t, 2.8 - t, 2.8],
    ];
    for (const [x0, z0, x1, z1] of bars) block(g, x0, z0, x1, z1, 0, top, wall, roof, WIN.RES, 0.12);
    // corner towers
    for (const [tx, tz] of [
      [0.2, 0.2],
      [2.45, 0.2],
      [0.2, 2.45],
      [2.45, 2.45],
    ]) {
      g.color(shade(wall, 0.92)).win(WIN.RES, 0.12, F);
      g.box(tx, 0, tz, tx + 0.35, top + F, tz + 0.35, { noTop: true });
      g.noWin()
        .color(towerRoof)
        .pyramid(tx + 0.175, tz + 0.175, 0.39, 0.39, top + F, 0.2);
    }
    // courtyard garden
    g.rect(0.75, 0.75, 2.25, 2.25, 0.012, shade(PAL.grass, 1.12));
    g.rect(1.45, 0.75, 1.55, 2.95, 0.013, PAL.sidewalk);
    g.rect(0.75, 1.45, 2.25, 1.55, 0.013, PAL.sidewalk);
    fountain(g, 1.5, 1.5, 0.09);
    lotTree(g, c, 1.05, 1.05, 1.2);
    lotTree(g, c, 1.95, 1.05, 1.1);
    lotTree(g, c, 1.05, 1.95, 1.0);
    lotTree(g, c, 1.95, 1.95, 1.2);
  } else {
    const wall = r.pick(PAL.walls.high);
    const roof = 0xd8d4cc;
    for (const [x0, x1] of [
      [0.2, 1.25],
      [1.75, 2.8],
    ] as const) {
      const f1 = r.int(5, 6);
      block(g, x0, 0.2, x1, 1.0, 0, f1 * F, wall, roof, WIN.GLASS, 0.16);
      block(g, x0, 1.0, x1, 1.6, 0, (f1 - 2) * F, wall, roof, WIN.GLASS, 0.16);
      block(g, x0, 1.6, x1, 2.1, 0, (f1 - 4) * F, wall, roof, WIN.GLASS, 0.16);
      g.rect(x0 + 0.05, 1.05, x1 - 0.05, 1.55, (f1 - 2) * F + 0.006, ROOF_GREEN);
      g.rect(x0 + 0.05, 1.65, x1 - 0.05, 2.05, (f1 - 4) * F + 0.006, ROOF_GREEN);
      roofTree(g, c, (x0 + x1) / 2, 1.3, (f1 - 2) * F, 0.6);
      roofTree(g, c, x0 + 0.25, 1.85, (f1 - 4) * F, 0.6);
    }
    block(g, 1.25, 0.2, 1.75, 0.7, 0, 4 * F, wall, roof, WIN.GLASS, 0.16);
    g.rect(1.3, 1.0, 1.7, 2.3, 0.012, DECK);
    g.rect(1.36, 1.1, 1.64, 2.2, 0.014, POOL);
    g.rect(0.2, 2.45, 2.8, 2.55, 0.012, PAL.sidewalk);
    for (const tx of [0.35, 0.95, 2.05, 2.65]) lotTree(g, c, tx, 2.75, 1.0 + r.next() * 0.3);
  }
};

/** 1x1 tower: residential (R) or office (C) depending on zone. */
export const slimTower: ModelFn = (g, c) => {
  const r = c.rng;
  const isC = c.zone === 2;
  g.rect(0.04, 0.04, 0.96, 0.96, 0.012, isC ? PAL.concrete : 0xcfcabe);
  let top: number;
  if (!isC) {
    if (c.wealth === 0) {
      const wall = r.pick([...PAL.walls.brick, 0xb8b0a0, 0xa8a090]);
      top = r.int(8, 11) * F;
      block(g, 0.2, 0.2, 0.8, 0.8, 0, top, wall, PAL.flatRoofDark, WIN.RES, 0.11);
      g.noWin()
        .color(shade(wall, 0.7))
        .box(0.19, top - 0.025, 0.19, 0.81, top + 0.012, 0.81, { noTop: true });
      waterTank(g, 0.36, 0.36, top);
      g.color(0x8f8a84).box(0.52, top, 0.5, 0.7, top + 0.08, 0.7);
    } else if (c.wealth === 1) {
      const wall = r.pick(PAL.walls.mid);
      const floors = r.int(9, 12);
      top = floors * F;
      block(g, 0.22, 0.22, 0.78, 0.78, 0, top, wall, PAL.flatRoof, WIN.RES, 0.11);
      bands(g, 0, 0.26, 0.74, 0.78, F - 0.006, floors - 1, F, r.pick([PAL.white, 0xd8d4cc]), 0.04);
      g.color(0x9a968e).box(0.35, top, 0.3, 0.6, top + 0.07, 0.55);
    } else {
      const wall = r.pick(PAL.walls.high);
      top = r.int(10, 13) * F;
      const crown = top - 2 * F;
      g.color(shade(wall, 0.85)).win(WIN.SHOP, 0.18, F);
      g.box(0.27, 0, 0.27, 0.73, F, 0.73, { noTop: true });
      block(g, 0.22, 0.22, 0.78, 0.78, F, crown, wall, 0xd8d4cc, WIN.GLASS, 0.12);
      g.rect(0.25, 0.25, 0.75, 0.75, crown + 0.006, ROOF_GREEN);
      block(g, 0.32, 0.32, 0.68, 0.68, crown, top, wall, 0xd8d4cc, WIN.GLASS, 0.12);
      antenna(g, 0.5, 0.5, top, 0.25);
      lotTree(g, c, 0.1, 0.9, 0.7);
      lotTree(g, c, 0.9, 0.9, 0.7);
    }
    frontQuad(g, 0.44, 0.56, 0, 0.1, 0.802, DOOR);
    g.noWin().color(0x6a6e72).box(0.4, 0.1, 0.78, 0.6, 0.115, 0.86);
  } else {
    if (c.wealth === 0) {
      const wall = r.pick(PAL.officeWalls);
      top = r.int(9, 12) * F;
      block(g, 0.14, 0.14, 0.86, 0.86, 0, F * 1.3, shade(wall, 0.85), PAL.flatRoof, WIN.SHOP, 0.2, F * 1.3);
      block(g, 0.22, 0.22, 0.78, 0.78, F * 1.3, top, wall, PAL.flatRoof, WIN.OFFICE, 0.14);
      roofUnits(g, c, 0.22, 0.22, 0.78, 0.78, top, 2);
    } else if (c.wealth === 1) {
      const wall = r.pick([0x5a6068, 0x6a6058, 0x4f5862, 0x7a7068]);
      top = r.int(10, 13) * F;
      block(g, 0.22, 0.22, 0.78, 0.78, 0, top, wall, PAL.flatRoofDark, WIN.OFFICE, 0.12);
      g.noWin()
        .color(shade(wall, 1.3))
        .box(0.2, top - F * 0.6, 0.2, 0.8, top + 0.04, 0.8, { top: shade(wall, 0.9) });
      antenna(g, 0.5, 0.5, top + 0.04, 0.35);
    } else {
      const wall = r.pick(GLASS_WALLS);
      top = r.int(11, 14) * F;
      block(g, 0.15, 0.15, 0.85, 0.85, 0, F * 1.3, PAL.concreteDark, PAL.flatRoof, WIN.SHOP, 0.2, F * 1.3);
      block(g, 0.22, 0.22, 0.78, 0.78, F * 1.3, top, wall, GLASS_ROOF, WIN.GLASS, 0.12);
      g.noWin()
        .color(PAL.white)
        .box(0.2, F * 1.3, 0.75, 0.25, top + 0.05, 0.8, { top: PAL.white });
      g.color(shade(wall, 0.85)).shed(0.22, 0.22, 0.78, 0.78, top, 0.22, false);
    }
    g.noWin()
      .color(0x6a6e72)
      .box(0.36, F * 0.75, 0.78, 0.64, F * 0.82, 0.9);
  }
};

/** 2x2 residential tower: projects, slab with balconies, or luxury condo tower. */
export const resTower: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.wealth === 0) {
    const wall = r.pick([...PAL.walls.brick, 0xb5a48e]);
    const floors = r.int(11, 15);
    const top = floors * F;
    block(g, 0.62, 0.3, 1.38, 1.7, 0, top, wall, PAL.flatRoofDark, WIN.RES, 0.11);
    block(g, 0.3, 0.62, 1.7, 1.38, 0, top - F, wall, PAL.flatRoofDark, WIN.RES, 0.11);
    g.noWin()
      .color(0x8f8a84)
      .box(0.85, top, 0.85, 1.15, top + 0.1, 1.15);
    frontQuad(g, 0.94, 1.06, 0, 0.1, 1.702, DOOR);
    g.rect(0.95, 1.7, 1.05, 1.97, 0.012, PAL.sidewalk);
    // basketball court
    g.rect(1.42, 1.5, 1.94, 1.94, 0.013, 0xc8643c);
    g.rect(1.67, 1.5, 1.69, 1.94, 0.015, PAL.laneWhite);
    lotTree(g, c, 0.2, 0.2, 1.1);
    lotTree(g, c, 1.8, 0.25, 1.0);
    lotTree(g, c, 0.25, 1.78, 1.1);
  } else if (c.wealth === 1) {
    const wall = r.pick(PAL.walls.mid);
    const floors = r.int(12, 16);
    const ph = F * 1.4;
    const top = ph + floors * F;
    block(g, 0.15, 0.3, 1.85, 1.7, 0, ph, PAL.concrete, PAL.flatRoof, WIN.SHOP, 0.22, ph);
    g.rect(0.2, 1.35, 1.8, 1.65, ph + 0.006, ROOF_GREEN);
    block(g, 0.4, 0.6, 1.6, 1.3, ph, top, wall, PAL.flatRoofDark, WIN.RES, 0.12);
    const rail = r.pick([PAL.white, 0xd8d4cc, 0xe8dcc4]);
    bands(g, 0, 0.45, 1.55, 1.3, ph + F - 0.006, floors - 1, F, rail);
    bands(g, 1, 0.45, 1.55, 0.6, ph + 2 * F - 0.006, Math.floor((floors - 1) / 2), 2 * F, rail);
    g.noWin()
      .color(0x8f8a84)
      .box(0.8, top, 0.8, 1.2, top + 0.1, 1.1);
    antenna(g, 1.4, 0.75, top, 0.3);
    roofTree(g, c, 0.4, 1.5, ph, 0.6);
    roofTree(g, c, 1.6, 1.5, ph, 0.6);
    g.noWin()
      .color(0x6a6e72)
      .box(0.85, ph * 0.62, 1.7, 1.15, ph * 0.68, 1.85);
    g.rect(0.9, 1.7, 1.1, 1.97, 0.012, PAL.sidewalk);
  } else {
    const wall = r.pick(PAL.walls.high);
    const roof = 0xd8d4cc;
    const floors = r.int(14, 18);
    const top = floors * F;
    const mid = top - 3 * F;
    g.rect(0.06, 0.06, 1.94, 1.94, 0.012, 0xd8d2c4);
    g.color(shade(wall, 0.85)).win(WIN.SHOP, 0.2, F);
    g.box(0.6, 0, 0.6, 1.4, F, 1.4, { noTop: true });
    block(g, 0.55, 0.55, 1.45, 1.45, F, mid, wall, roof, WIN.GLASS, 0.13);
    block(g, 0.65, 0.65, 1.35, 1.35, mid, top, wall, roof, WIN.GLASS, 0.13);
    g.rect(0.75, 0.75, 1.25, 1.1, top + 0.007, POOL);
    g.noWin()
      .color(shade(wall, 0.95))
      .box(0.64, top, 1.25, 1.36, top + 0.1, 1.36, { top: roof });
    fountain(g, 1.0, 1.72, 0.08);
    for (const [tx, tz] of [
      [0.25, 0.25],
      [1.75, 0.25],
      [0.25, 1.75],
      [1.75, 1.75],
    ])
      lotTree(g, c, tx, tz, 1.0 + r.next() * 0.3);
  }
};

/** 3x3 residential giants: mega block, twin towers, sky residences. */
export const resMegatower: ModelFn = (g, c) => {
  const r = c.rng;
  if (c.wealth === 0) {
    const wall = r.pick([0xc9c4ba, 0xbdb6a8, 0xd8cdb8, 0xa9a49a]);
    const floors = r.int(18, 22);
    const top = floors * F;
    g.noWin().color(0x5a5856).box(0.4, 0, 0.95, 2.6, F, 2.05, { noTop: true });
    block(g, 0.25, 0.85, 2.75, 2.15, F, top, wall, PAL.flatRoofDark, WIN.RES, 0.11);
    // polychrome loggia stripes on the long facades
    for (let i = 0; i < 5; i++) {
      const sx = 0.4 + i * 0.48 + r.next() * 0.1;
      const y0 = F + r.int(1, 6) * F;
      const y1 = Math.min(top - F, y0 + r.int(4, 10) * F);
      g.noWin()
        .color(r.pick(PAL.walls.pastel))
        .box(sx, y0, 2.15, sx + 0.12, y1, 2.17);
    }
    g.color(0x8f8a84).box(0.6, top, 1.3, 0.95, top + 0.14, 1.7);
    g.color(0x8f8a84).box(2.0, top, 1.3, 2.35, top + 0.14, 1.7);
    chimney(g, 1.5, 1.5, top, 0.25, 0.08, 0xa8a49c, null);
    parking(g, c, 0.2, 2.35, 2.8, 2.9, 6, false);
    parking(g, c, 0.25, 0.12, 2.75, 0.6, 4, false);
    lotTree(g, c, 0.12, 1.5, 1.1);
    lotTree(g, c, 2.88, 1.5, 1.0);
  } else if (c.wealth === 1) {
    const wall = r.pick(PAL.walls.mid);
    const ph = F * 1.2;
    block(g, 0.15, 0.15, 2.85, 2.85, 0, ph, PAL.concrete, PAL.flatRoof, WIN.SHOP, 0.24, ph);
    g.rect(0.25, 1.6, 1.4, 2.75, ph + 0.006, ROOF_GREEN);
    g.rect(1.6, 0.25, 2.75, 1.4, ph + 0.006, ROOF_GREEN);
    const rail = r.pick([PAL.white, 0xd8d4cc, 0xe8dcc4]);
    const base = r.int(22, 26);
    for (const [x0, z0, extra] of [
      [0.3, 0.3, 0],
      [1.7, 1.7, r.int(-3, 3)],
    ] as const) {
      const floors = base + extra;
      const top = ph + floors * F;
      block(g, x0, z0, x0 + 1.0, z0 + 1.0, ph, top, wall, PAL.flatRoofDark, WIN.RES, 0.12);
      bands(g, 0, x0 + 0.05, x0 + 0.95, z0 + 1.0, ph + 2 * F - 0.006, Math.floor(floors / 2), 2 * F, rail);
      bands(g, 2, z0 + 0.05, z0 + 0.95, x0 + 1.0, ph + 2 * F - 0.006, Math.floor(floors / 2), 2 * F, rail);
      block(g, x0 + 0.2, z0 + 0.2, x0 + 0.8, z0 + 0.8, top, top + F, shade(wall, 0.9), PAL.flatRoofDark, WIN.RES, 0.12);
      antenna(g, x0 + 0.5, z0 + 0.5, top + F, 0.35);
    }
    roofTree(g, c, 0.6, 2.2, ph, 0.7);
    roofTree(g, c, 1.0, 2.5, ph, 0.6);
    roofTree(g, c, 2.2, 0.6, ph, 0.7);
  } else {
    const wall = r.pick(PAL.walls.high);
    const roof = 0xd8d4cc;
    const floors = r.int(26, 30);
    const top = floors * F;
    g.rect(0.06, 0.06, 2.94, 2.94, 0.012, 0xd8d2c4);
    g.color(shade(wall, 0.85)).win(WIN.SHOP, 0.22, F * 1.2);
    g.box(0.9, 0, 0.9, 2.1, F * 1.2, 2.1, { noTop: true });
    const y = tiers(
      g,
      1.5,
      1.5,
      F * 1.2,
      [
        [0.75, 0.75, top * 0.6],
        [0.62, 0.62, top * 0.85],
        [0.48, 0.48, top],
      ],
      wall,
      roof,
      WIN.GLASS,
      0.13,
    );
    g.rect(0.8, 0.8, 2.2, 0.86, top * 0.6 + 0.006, ROOF_GREEN);
    roofTree(g, c, 0.85, 0.85, top * 0.6, 0.55);
    roofTree(g, c, 2.15, 2.15, top * 0.6, 0.55);
    spire(g, 1.5, 1.5, y, 0.7, 0.05);
    g.rect(0.35, 2.3, 1.2, 2.75, 0.013, DECK);
    g.rect(0.42, 2.38, 1.13, 2.67, 0.015, POOL);
    for (const [tx, tz] of [
      [0.3, 0.3],
      [2.7, 0.3],
      [2.7, 2.7],
      [1.6, 2.7],
      [0.3, 1.5],
    ])
      lotTree(g, c, tx, tz, 1.1 + r.next() * 0.3);
  }
};
