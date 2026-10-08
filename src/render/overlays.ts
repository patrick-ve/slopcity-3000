import { NET } from '../sim/types';
import { getDef } from '../sim/catalog';
import type { Sim } from '../sim/sim';
import { needsWater } from '../sim/util';
import { hexToRgb } from './geom';
import { PAL } from './palette';

export type OverlayId =
  | 'none'
  | 'landValue'
  | 'pollution'
  | 'crime'
  | 'traffic'
  | 'power'
  | 'water'
  | 'police'
  | 'fire'
  | 'health'
  | 'education'
  | 'parks'
  | 'transit'
  | 'density';

export interface OverlayDef {
  id: OverlayId;
  name: string;
  legend: [string, string];
  /** CSS gradient for the legend bar. */
  gradient: string;
  smooth: boolean;
}

export const OVERLAYS: OverlayDef[] = [
  {
    id: 'landValue',
    name: 'Land Value',
    legend: ['Low', 'High'],
    gradient: 'linear-gradient(90deg,#b03a2e,#f4d03f,#27ae60)',
    smooth: true,
  },
  {
    id: 'pollution',
    name: 'Pollution',
    legend: ['Clean', 'Toxic'],
    gradient: 'linear-gradient(90deg,rgba(247,220,111,.2),#c08a3e,#4a2a12)',
    smooth: true,
  },
  {
    id: 'crime',
    name: 'Crime',
    legend: ['Safe', 'Dangerous'],
    gradient: 'linear-gradient(90deg,rgba(230,126,34,.2),#e67e22,#a93226)',
    smooth: true,
  },
  {
    id: 'traffic',
    name: 'Traffic',
    legend: ['Light', 'Jammed'],
    gradient: 'linear-gradient(90deg,#2ecc71,#f1c40f,#e74c3c)',
    smooth: false,
  },
  { id: 'power', name: 'Power Grid', legend: ['Unpowered', 'Powered'], gradient: 'linear-gradient(90deg,#e74c3c,#f7dc6f)', smooth: false },
  { id: 'water', name: 'Water', legend: ['Dry', 'Watered'], gradient: 'linear-gradient(90deg,#e74c3c,#3498db)', smooth: false },
  {
    id: 'police',
    name: 'Police Coverage',
    legend: ['None', 'Full'],
    gradient: 'linear-gradient(90deg,rgba(63,127,214,.15),#3f7fd6)',
    smooth: true,
  },
  {
    id: 'fire',
    name: 'Fire Coverage',
    legend: ['None', 'Full'],
    gradient: 'linear-gradient(90deg,rgba(224,90,76,.15),#e05a4c)',
    smooth: true,
  },
  {
    id: 'health',
    name: 'Health Coverage',
    legend: ['None', 'Full'],
    gradient: 'linear-gradient(90deg,rgba(232,106,146,.15),#e86a92)',
    smooth: true,
  },
  {
    id: 'education',
    name: 'Education Coverage',
    legend: ['None', 'Full'],
    gradient: 'linear-gradient(90deg,rgba(155,89,182,.15),#9b59b6)',
    smooth: true,
  },
  {
    id: 'parks',
    name: 'Parks Coverage',
    legend: ['None', 'Full'],
    gradient: 'linear-gradient(90deg,rgba(39,174,96,.15),#27ae60)',
    smooth: true,
  },
  {
    id: 'transit',
    name: 'Mass Transit',
    legend: ['None', 'Full'],
    gradient: 'linear-gradient(90deg,rgba(243,156,18,.15),#f39c12)',
    smooth: true,
  },
  {
    id: 'density',
    name: 'Population Density',
    legend: ['Sparse', 'Dense'],
    gradient: 'linear-gradient(90deg,rgba(142,68,173,.15),#8e44ad,#4a235a)',
    smooth: true,
  },
];

function ramp(stops: number[], t: number): [number, number, number] {
  const n = stops.length - 1;
  const x = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const COVER_COLORS: Partial<Record<OverlayId, number>> = {
  police: 0x3f7fd6,
  fire: 0xe05a4c,
  health: 0xe86a92,
  education: 0x9b59b6,
  parks: 0x27ae60,
  transit: 0xf39c12,
};

/** Fill an RGBA (sRGB) per-tile array for a data overlay. */
export function fillOverlay(sim: Sim, id: OverlayId, out: Uint8Array): void {
  const w = sim.world;
  out.fill(0);
  if (id === 'none') return;
  const set = (i: number, rgb: [number, number, number] | number[], a: number) => {
    out[i * 4] = rgb[0];
    out[i * 4 + 1] = rgb[1];
    out[i * 4 + 2] = rgb[2];
    out[i * 4 + 3] = Math.max(0, Math.min(255, a));
  };
  for (let i = 0; i < w.size; i++) {
    const water = w.isWaterIdx(i);
    switch (id) {
      case 'landValue':
        if (!water) set(i, ramp([0xb03a2e, 0xf4d03f, 0x27ae60], w.landValue[i] * 1.4), 215);
        break;
      case 'pollution': {
        const v = w.pollution[i];
        set(i, ramp([0xf7dc6f, 0xc08a3e, 0x4a2a12], v * 1.3), 40 + v * 260);
        break;
      }
      case 'crime': {
        const v = w.crime[i];
        if (!water) set(i, ramp([0xf5b041, 0xe67e22, 0xa93226], v * 1.4), 30 + v * 300);
        break;
      }
      case 'traffic':
        if (w.net[i] & NET.ROAD) set(i, ramp([0x2ecc71, 0xf1c40f, 0xe74c3c], w.traffic[i] / 1.1), 235);
        else if (!water) set(i, [40, 40, 50], 110);
        break;
      case 'power': {
        const relevant = w.bld[i] || w.zone[i] || w.net[i] & NET.POWER;
        if (relevant) set(i, w.powered[i] ? hexToRgb(0xf7dc6f) : hexToRgb(0xe74c3c), 220);
        else if (!water) set(i, [40, 40, 50], 90);
        break;
      }
      case 'water': {
        const id2 = w.bld[i];
        if (id2) {
          const b = w.buildings.get(id2)!;
          const def = getDef(b.def);
          if (def.water) set(i, hexToRgb(0x1f6fb2), 240);
          else if (needsWater(def) && !b.watered) set(i, hexToRgb(0xe74c3c), 230);
          else if (w.watered[i]) set(i, hexToRgb(0x3498db), 200);
          else set(i, [90, 90, 100], 150);
        } else if (w.watered[i] && !water) set(i, hexToRgb(0x5dade2), 150);
        break;
      }
      case 'density': {
        const v = w.popDensity[i];
        if (v > 0) set(i, ramp([0xd2b4de, 0x8e44ad, 0x4a235a], v), 80 + v * 175);
        break;
      }
      default: {
        const col = COVER_COLORS[id];
        if (col !== undefined && !water) {
          const v = w.cover[id as keyof typeof w.cover][i];
          set(i, hexToRgb(col), v * 230);
        }
      }
    }
  }
}

/** Ground tint per tile: zones (bordered) and lots (filled). */
export function fillTiles(sim: Sim, out: Uint8Array): void {
  const w = sim.world;
  const set = (i: number, hex: number, a: number) => {
    const [r, g, b] = hexToRgb(hex);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  };
  for (let i = 0; i < w.size; i++) {
    out[i * 4 + 3] = 0;
    const n = w.net[i];
    if (n & (NET.ROAD | NET.RAIL)) continue;
    const id = w.bld[i];
    if (id) {
      const b = w.buildings.get(id)!;
      const def = getDef(b.def);
      if (b.build > 0) set(i, 0x9a7a52, 90);
      else if (def.ground !== undefined) set(i, def.ground, 110);
      else if (def.growable) {
        if (def.zone === 1) set(i, 0x8fbf5a, 50);
        else if (def.zone === 2) set(i, 0xc2beb4, 115);
        else set(i, 0xa9a090, 110);
      }
      continue;
    }
    if (w.rubble[i]) {
      set(i, 0x6f6458, 110);
      continue;
    }
    const z = w.zone[i];
    if (z === 4) set(i, PAL.zoneLandfill, 100);
    else if (z === 1) set(i, PAL.zoneR[w.density[i] - 1] ?? PAL.zoneR[0], 255);
    else if (z === 2) set(i, PAL.zoneC[w.density[i] - 1] ?? PAL.zoneC[0], 255);
    else if (z === 3) set(i, PAL.zoneI[w.density[i] - 1] ?? PAL.zoneI[0], 255);
  }
}
