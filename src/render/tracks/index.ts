import type { World } from '../../sim/world';
import type { GroundBuf } from '../buffers';
import { buildHighways } from './highways';
import { buildRails } from './rails';
import { buildRoads } from './roads';

export { deckAt, HIGHWAY_CLEAR, nodeDeck } from './highways';
export { deckY, roadSurfaceY, ROAD_Y, waterY } from './common';

/** Roads, rails and highways of one chunk (tiles x0..x1-1, y0..y1-1). */
export function buildTracks(world: World, buf: GroundBuf, x0: number, y0: number, x1: number, y1: number): void {
  const t = { world, buf, x0, y0, x1, y1 };
  buildRoads(t);
  buildRails(t);
  buildHighways(t);
}
