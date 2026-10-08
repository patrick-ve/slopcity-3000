import { FLOOR, shade } from '../geom';
import { PAL } from '../palette';
import type { ModelFn } from './types';

const F = FLOOR;

// ------------------------------------------------------------------ trees
// Single trees centred on the origin (0,0), standing on y=0.

/** Broad-leaf tree: trunk + faceted crown. */
const treeRound: ModelFn = (g, c) => {
  const r = c.rng;
  const s = 0.85 + r.next() * 0.35;
  const trunkH = (0.09 + r.next() * 0.04) * s;
  const crownR = (0.1 + r.next() * 0.035) * s;
  g.noWin().color(PAL.trunk);
  g.box(-0.018 * s, 0, -0.018 * s, 0.018 * s, trunkH + crownR * 0.5, 0.018 * s, { noTop: true });
  const leaf = c.variant === 7 ? r.pick(PAL.autumn) : r.pick(PAL.leaf);
  g.color(leaf);
  g.sphere(0, trunkH + crownR * 0.95, 0, crownR, 0, 1.05 + r.next() * 0.2);
};

/** Conifer: short trunk + stacked cones. */
const treeCone: ModelFn = (g, c) => {
  const r = c.rng;
  const s = 0.85 + r.next() * 0.4;
  g.noWin().color(PAL.trunk);
  g.box(-0.016 * s, 0, -0.016 * s, 0.016 * s, 0.07 * s, 0.016 * s, { noTop: true });
  const col = r.pick(PAL.conifer);
  const phase = r.next() * Math.PI;
  g.color(col);
  g.cone(0, 0, 0.11 * s, 0.05 * s, 0.3 * s, 6, phase);
  g.color(shade(col, 1.08));
  g.cone(0, 0, 0.085 * s, 0.19 * s, 0.42 * s, 6, phase + 0.5);
  g.color(shade(col, 1.16));
  g.cone(0, 0, 0.055 * s, 0.32 * s, 0.52 * s, 6, phase + 1);
};

/** Tall poplar-like tree: thin trunk + elongated crown. */
const treeTall: ModelFn = (g, c) => {
  const r = c.rng;
  const s = 0.9 + r.next() * 0.3;
  g.noWin().color(PAL.trunk);
  g.box(-0.014 * s, 0, -0.014 * s, 0.014 * s, 0.12 * s, 0.014 * s, { noTop: true });
  g.color(r.pick(PAL.leaf));
  g.sphere(0, 0.32 * s, 0, 0.075 * s, 0, 2.7 + r.next() * 0.5);
};

// ------------------------------------------------------- construction site

/** Construction site sized to the footprint: fence, slabs, columns, crane. */
const construction: ModelFn = (g, c) => {
  const r = c.rng;
  const w = c.w;
  const h = c.h;
  const m = 0.05;
  g.rect(m, m, w - m, h - m, 0.012, PAL.dirt);
  // plywood fence (front left open as the gate)
  const fh = 0.045;
  g.noWin().color(0xd8c8a0);
  g.panel([w - m, 0, m], [m, 0, m], [m, fh, m], [w - m, fh, m]);
  g.panel([m, 0, m], [m, 0, h - m], [m, fh, h - m], [m, fh, m]);
  g.panel([w - m, 0, h - m], [w - m, 0, m], [w - m, fh, m], [w - m, fh, h - m]);
  g.panel([m, 0, h - m], [w * 0.55, 0, h - m], [w * 0.55, fh, h - m], [m, fh, h - m]);

  // building skeleton: slabs + columns + core
  const x0 = 0.18;
  const z0 = 0.18;
  const x1 = w - 0.18;
  const z1 = h - 0.28;
  const levels = Math.max(1, Math.min(6, w * 2 + r.int(-1, 0)));
  const top = levels * F;
  const concrete = 0xc4c0b6;
  g.color(concrete);
  g.box(x0, 0, z0, x1, 0.02, z1, { top: shade(concrete, 1.05) });
  // finished floor slabs; the top storey only has columns sticking out
  for (let i = 1; i < levels; i++) {
    g.color(shade(concrete, 0.8)).box(x0, i * F - 0.015, z0, x1, i * F, z1, { top: concrete });
  }
  g.color(0x8a857c);
  const cols: [number, number][] = [
    [x0 + 0.02, z0 + 0.02],
    [x1 - 0.02, z0 + 0.02],
    [x0 + 0.02, z1 - 0.02],
    [x1 - 0.02, z1 - 0.02],
  ];
  if (w >= 2) cols.push([(x0 + x1) / 2, z0 + 0.02], [(x0 + x1) / 2, z1 - 0.02]);
  for (const [px, pz] of cols) g.box(px - 0.012, 0, pz - 0.012, px + 0.012, top, pz + 0.012, { noTop: true });
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  g.color(0x9a968e).box(cx - 0.07, 0, cz - 0.07, cx + 0.07, top + 0.06, cz + 0.07, { top: 0x8a8680 });

  // scaffolding on the front: two poles + a plank per level
  g.color(0xc8a050);
  g.beam([x0, 0, z1 + 0.04], [x0, top, z1 + 0.04], 0.012);
  g.beam([x1, 0, z1 + 0.04], [x1, top, z1 + 0.04], 0.012);
  for (let i = 1; i <= levels; i += 2) g.box(x0, i * F - 0.01, z1 + 0.02, x1, i * F, z1 + 0.06);

  // materials
  g.color(0x8a6a42).box(w - 0.32, 0, h - 0.24, w - 0.14, 0.05, h - 0.1);
  g.color(0x9a958c).pyramid(0.25, h - 0.16, 0.18, 0.12, 0, 0.06);

  if (w === 1) {
    // cement mixer truck at the gate
    g.color(PAL.white).box(0.62, 0.012, h - 0.17, 0.72, 0.07, h - 0.11);
    g.color(PAL.orange).cylinderX(0.72, 0.9, 0.08, h - 0.14, 0.035, 6);
    g.color(0x3a3c40).box(0.72, 0.012, h - 0.165, 0.92, 0.04, h - 0.115);
  }
  // tower crane for larger sites
  if (w >= 2) {
    const yellow = PAL.yellow;
    const mx = x1 - 0.12;
    const mz = z0 + 0.12;
    const mh = top + 0.55;
    g.color(yellow).box(mx - 0.03, 0, mz - 0.03, mx + 0.03, mh, mz + 0.03, { noTop: true });
    const jib = Math.min(w * 0.85, 1.9);
    g.box(mx - jib, mh, mz - 0.02, mx + 0.25, mh + 0.04, mz + 0.02);
    g.color(shade(yellow, 0.85)).box(mx - 0.03, mh - 0.06, mz + 0.03, mx + 0.05, mh, mz + 0.08);
    g.color(0x8a8680).box(mx + 0.14, mh - 0.07, mz - 0.035, mx + 0.24, mh, mz + 0.035);
    g.color(yellow).pyramid(mx, mz, 0.06, 0.06, mh + 0.04, 0.12);
    g.color(0x3a3c40).beam([mx - jib * 0.7, mh, mz], [mx - jib * 0.7, top + 0.12, mz], 0.006);
    g.color(0x6a6e72).box(mx - jib * 0.7 - 0.02, top + 0.09, mz - 0.02, mx - jib * 0.7 + 0.02, top + 0.12, mz + 0.02);
  }
};

// ------------------------------------------------------------------ rubble

/** Debris of a destroyed or burned building (1x1). */
const rubble: ModelFn = (g, c) => {
  const r = c.rng;
  g.rect(0.05, 0.05, 0.95, 0.95, 0.012, 0x6f665c);
  const cols = [0x9a958c, 0xa89f90, 0x7f786e, 0x8a7a68, 0xb8b0a2];
  for (let i = 0; i < 6; i++) {
    const x = 0.2 + r.next() * 0.6;
    const z = 0.2 + r.next() * 0.6;
    const sx = 0.04 + r.next() * 0.07;
    const sz = 0.03 + r.next() * 0.05;
    const sy = 0.02 + r.next() * 0.04;
    g.push().translate(x, 0, z).rotateY(r.next() * Math.PI);
    g.noWin().color(r.pick(cols)).box(-sx, 0, -sz, sx, sy, sz);
    g.pop();
  }
  g.color(0x5f584f).pyramid(0.38 + r.next() * 0.1, 0.42 + r.next() * 0.1, 0.36, 0.3, 0, 0.09);
  g.color(0x2f2b28).pyramid(0.65, 0.62, 0.22, 0.2, 0, 0.06);
  g.color(0x26231f).pyramid(0.3, 0.72, 0.16, 0.14, 0, 0.045);
  // a broken wall fragment still standing
  g.push().translate(0.25 + r.next() * 0.5, 0, 0.25).rotateY(r.next() * 0.6 - 0.3);
  g.color(r.pick(cols)).box(-0.12, 0, -0.015, 0.1, 0.1 + r.next() * 0.06, 0.015);
  g.pop();
  // charred beam
  g.color(0x2a2622).beam([0.25, 0.02, 0.35], [0.7, 0.07, 0.55], 0.025);
};

// -------------------------------------------------------------- power pole

/** Wooden power pole at the tile centre, crossarm along x, insulators at x=0.4/0.6, y≈0.5. */
const powerPole: ModelFn = (g) => {
  g.noWin().color(PAL.pole);
  g.lathe(0.5, 0.5, [
    [0.022, 0],
    [0.016, 0.56],
  ], 4, Math.PI / 4, true);
  g.color(shade(PAL.pole, 0.85));
  g.box(0.38, 0.465, 0.488, 0.62, 0.485, 0.512);
  g.color(0xcfd6dc);
  g.pyramid(0.4, 0.5, 0.018, 0.018, 0.485, 0.02);
  g.pyramid(0.6, 0.5, 0.018, 0.018, 0.485, 0.02);
};

// ---------------------------------------------------------------- landfill

/** Landfill tile; ctx.variant 0..4 = fill level (0 = empty pit). */
const landfill: ModelFn = (g, c) => {
  const r = c.rng;
  const level = Math.max(0, Math.min(4, c.variant));
  g.rect(0.03, 0.03, 0.97, 0.97, 0.012, 0x8a7050);
  if (level === 0) {
    g.rect(0.14, 0.14, 0.86, 0.86, 0.014, 0x5a4630);
    g.noWin().color(0x8a7050);
    g.pyramid(0.2, 0.85, 0.14, 0.12, 0, 0.05);
    g.pyramid(0.82, 0.2, 0.12, 0.12, 0, 0.04);
    return;
  }
  const hgt = 0.05 + level * 0.055;
  const prof: [number, number][] = [
    [0.44, 0],
    [0.33, hgt * 0.6],
    [0.18, hgt * 0.95],
    [0, hgt * 1.05],
  ];
  g.noWin().color(0x7d6e5a).lathe(0.5, 0.5, prof, 7, r.next() * Math.PI);
  const junk = [0xd6453d, 0x3f7fd6, 0xf2c94c, 0xf7f7f2, 0x4caf50, 0x8e5bd6, 0x9a958c, 0x5a3a28];
  const n = 2 + level * 2;
  for (let i = 0; i < n; i++) {
    const a = r.next() * Math.PI * 2;
    const d = 0.05 + r.next() * 0.3;
    // height of the mound surface at radius d
    let y = 0;
    for (let k = 0; k < prof.length - 1; k++) {
      const [r0, y0] = prof[k];
      const [r1, y1] = prof[k + 1];
      if (d <= r0 && d >= r1) {
        const t = (r0 - d) / (r0 - r1);
        y = y0 + (y1 - y0) * t;
        break;
      }
    }
    const x = 0.5 + Math.cos(a) * d;
    const z = 0.5 + Math.sin(a) * d;
    const s = 0.012 + r.next() * 0.014;
    g.color(r.pick(junk)).box(x - s, y - s * 0.5, z - s, x + s, y + s * 1.2, z + s);
  }
  if (level >= 2) {
    // bulldozer
    g.color(PAL.yellow).box(0.78, 0.01, 0.74, 0.9, 0.05, 0.84, { top: shade(PAL.yellow, 0.9) });
    g.color(0x3a3c40).box(0.8, 0.05, 0.76, 0.86, 0.08, 0.82, { top: PAL.yellow });
    g.color(0x5a5e62).box(0.76, 0.012, 0.73, 0.775, 0.045, 0.85);
  }
};

export const PROP_MODELS: Record<string, ModelFn> = {
  tree_round: treeRound,
  tree_cone: treeCone,
  tree_tall: treeTall,
  construction,
  rubble,
  power_pole: powerPole,
  landfill,
};
