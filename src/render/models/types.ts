import type { GeometryBuilder } from '../geom';
import type { Rng } from '../../util/rng';

/**
 * Context handed to every procedural model function.
 *
 * Conventions (all models):
 *  - Units are tiles. The footprint spans x∈[0,w], z∈[0,h]; y=0 is the lot
 *    ground. Keep geometry inside the footprint (a 0.04–0.08 margin looks
 *    best; parks/plazas may go edge to edge).
 *  - The front (entrance, shop windows, driveway) faces +z (the z=h edge).
 *    The game rotates the model so the front faces the nearest road.
 *  - One storey is FLOOR (0.13) tall. A one-tile house is roughly 0.5–0.65
 *    wide with 1–2 storeys plus a roof.
 *  - Use g.win(style, cellW, cellH) before walls/boxes that should show
 *    windows (style from WIN), and g.noWin() for roofs, chimneys, props.
 *  - Use ctx.rng (seeded per variant) for all randomness; never Math.random.
 */
export interface ModelCtx {
  /** Footprint in tiles (unrotated). */
  w: number;
  h: number;
  /** 0 = low (§), 1 = medium (§§), 2 = high (§§§). For industry: 0 heavy, 1 manufacturing, 2 high-tech. */
  wealth: number;
  /** 0..7 – pick colours / shapes from this via rng. */
  variant: number;
  /** Zone of the building (1 R, 2 C, 3 I) or 0 for ploppables. */
  zone: number;
  /** Zone density 1..3 (0 for ploppables). */
  density: number;
  /** Seeded RNG for this model + variant. */
  rng: Rng;
  /** Display name of the catalog entry (lets shared models pick a look). */
  name: string;
}

export type ModelFn = (g: GeometryBuilder, c: ModelCtx) => void;
