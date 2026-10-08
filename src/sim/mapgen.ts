import { Noise2D } from '../util/noise';
import { Rng } from '../util/rng';
import { MAX_LEVEL, World } from './world';

export type TerrainKind = 'flat' | 'rolling' | 'hilly' | 'mountains';
export type WaterKind = 'none' | 'lakes' | 'river' | 'coast' | 'island';
export type TreeKind = 'few' | 'normal' | 'many';

export interface MapOptions {
  size: number;
  seed: number;
  terrain: TerrainKind;
  water: WaterKind;
  trees: TreeKind;
}

export const DEFAULT_MAP: MapOptions = {
  size: 128,
  seed: 1,
  terrain: 'rolling',
  water: 'river',
  trees: 'normal',
};

const AMPLITUDE: Record<TerrainKind, number> = { flat: 1.2, rolling: 4.5, hilly: 8.5, mountains: 14 };

/** Fill a world with generated terrain, water and trees. */
export function generateMap(world: World, opts: MapOptions): void {
  const rng = new Rng(opts.seed);
  const noise = new Noise2D(opts.seed);
  const noise2 = new Noise2D(opts.seed ^ 0x5bd1e995);
  const W = world.w + 1;
  const H = world.h + 1;
  const sea = world.seaLevel;
  const amp = AMPLITUDE[opts.terrain];
  const field = new Float32Array(W * H);
  const freq = 1.6 / world.w;

  // --- base relief
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x * freq;
      const ny = y * freq;
      let v = noise.fbm(nx * 1.4, ny * 1.4, 5, 2, 0.5); // -1..1
      if (opts.terrain === 'mountains') v = v * 0.55 + (noise2.ridged(nx * 1.1, ny * 1.1, 4) - 0.35) * 1.3;
      if (opts.terrain === 'hilly') v += (noise2.ridged(nx * 1.6, ny * 1.6, 3) - 0.4) * 0.5;
      field[y * W + x] = sea + 2.2 + (v * 0.5 + 0.35) * amp;
    }
  }

  // --- water features
  const nrm = (x: number, y: number) => [x / (W - 1), y / (H - 1)];
  if (opts.water === 'coast') {
    const side = rng.int(0, 3);
    const depth = 4 + amp * 0.35;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [u, v] = nrm(x, y);
        const d = [v, 1 - u, 1 - v, u][side]; // distance from chosen edge (0..1)
        const wobble = noise2.fbm(x * 0.05, y * 0.05, 3) * 0.08;
        const t = Math.max(0, 1 - (d + wobble) / 0.3);
        field[y * W + x] -= t * t * (depth + 3) + (d + wobble < 0.12 ? 3 : 0);
      }
    }
  } else if (opts.water === 'island') {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [u, v] = nrm(x, y);
        const dx = u - 0.5;
        const dy = v - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy) * 2 + noise2.fbm(x * 0.04, y * 0.04, 3) * 0.18;
        const t = Math.min(1, Math.max(0, (r - 0.62) / 0.3));
        field[y * W + x] -= t * (amp + 7);
      }
    }
  } else if (opts.water === 'lakes') {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const l = noise2.fbm(x * 0.035, y * 0.035, 3);
        if (l > 0.28) field[y * W + x] = Math.min(field[y * W + x], sea + 1 - (l - 0.28) * 22);
      }
    }
  } else if (opts.water === 'river') {
    carveRiver(field, W, H, sea, rng, noise2);
  }

  // --- quantise and enforce the slope constraint (|Δ| ≤ 1 between neighbouring corners)
  const h = new Int32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    let v = Math.round(field[i]);
    if (opts.water === 'none') v = Math.max(sea, v);
    h[i] = Math.max(0, Math.min(MAX_LEVEL, v));
  }
  relaxSlopes(h, W, H);
  for (let i = 0; i < W * H; i++) world.heights[i] = h[i];

  // --- trees
  const treeThreshold = { few: 0.38, normal: 0.18, many: 0.0 }[opts.trees];
  const scatter = { few: 0.01, normal: 0.03, many: 0.06 }[opts.trees];
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      if (world.isWater(x, y)) continue;
      const i = world.idx(x, y);
      const f = noise.fbm(x * 0.045 + 100, y * 0.045 - 50, 4);
      const level = world.tileMax(x, y) - sea;
      if (f > treeThreshold) {
        const dens = 1 + Math.min(2, Math.floor((f - treeThreshold) * 8));
        world.tree[i] = level > 16 ? 1 : dens;
      } else if (rng.chance(scatter)) {
        world.tree[i] = 1;
      }
    }
  }
  world.markAllDirty();
}

/** Carve a meandering river across the map, from one edge to the opposite one. */
function carveRiver(field: Float32Array, W: number, H: number, sea: number, rng: Rng, noise: Noise2D): void {
  const vertical = rng.chance(0.5);
  const len = vertical ? H : W;
  const across = vertical ? W : H;
  const pts: [number, number][] = [];
  let pos = across * (0.3 + rng.next() * 0.4);
  for (let t = -4; t < len + 4; t++) {
    pos += noise.noise(t * 0.03, 7.7) * 0.9;
    pos = Math.max(across * 0.15, Math.min(across * 0.85, pos));
    pts.push(vertical ? [pos, t] : [t, pos]);
  }
  const width = 2.2 + rng.next() * 1.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // distance to the polyline (sampled: river points are one unit apart)
      const t = vertical ? y : x;
      let best = Infinity;
      for (let k = Math.max(0, t - 6 + 4); k < Math.min(pts.length, t + 6 + 4); k++) {
        const dx = pts[k][0] - x;
        const dy = pts[k][1] - y;
        const d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
      const d = Math.sqrt(best);
      if (d < width) {
        field[y * W + x] = Math.min(field[y * W + x], sea - 2.4 + (d / width) * 2.0);
      } else if (d < width + 6) {
        // gentle valley around the river
        const k = (d - width) / 6;
        field[y * W + x] = Math.min(field[y * W + x], sea + 0.6 + k * k * 10);
      }
    }
  }
}

/**
 * Lower corners so that no two 4-neighbouring corners differ by more than 1.
 * Equivalent to h'(p) = min_q h(q) + manhattan(p, q): two chamfer sweeps.
 */
export function relaxSlopes(h: Int32Array, W: number, H: number): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = h[i];
        if (x > 0) v = Math.min(v, h[i - 1] + 1);
        if (y > 0) v = Math.min(v, h[i - W] + 1);
        h[i] = v;
      }
    }
    for (let y = H - 1; y >= 0; y--) {
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        let v = h[i];
        if (x < W - 1) v = Math.min(v, h[i + 1] + 1);
        if (y < H - 1) v = Math.min(v, h[i + W] + 1);
        h[i] = v;
      }
    }
  }
}
