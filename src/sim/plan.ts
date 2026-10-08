import type { BuildingDef } from './catalog';
import type { Sim } from './sim';
import type { Curve } from './tracks/geom';
import type { TrackKind } from './tracks/net';

export interface PlanTile {
  x: number;
  y: number;
  ok: boolean;
  /** Tile will change (costs money). */
  change: boolean;
}

export interface Plan {
  kind: string;
  tiles: PlanTile[];
  cost: number;
  ok: boolean;
  reason?: string;
  apply: () => void;
  /** Terrain corner indices the plan changes (terraforming). */
  corners?: number[];
  /** For building placement. */
  def?: BuildingDef;
  x?: number;
  y?: number;
  rot?: number;
  /** Footprint (rotated). */
  w?: number;
  h?: number;
  /** New track (roads, rails, highways) for the preview. */
  track?: { kind: TrackKind; curves: Curve[] };
}

export function finishPlan(sim: Sim, kind: string, tiles: PlanTile[], cost: number, apply: () => void, reason?: string): Plan {
  const anyChange = tiles.some((t) => t.change && t.ok);
  let ok = anyChange && !reason;
  if (ok && !sim.canAfford(cost)) {
    ok = false;
    reason = 'Not enough money';
  }
  return { kind, tiles, cost, ok, reason: ok ? undefined : (reason ?? (anyChange ? undefined : 'Nothing to do here')), apply };
}
