import type { Sim } from '../sim/sim';
import { applyPlan, linePath, planLine, planPlace, planZone } from '../sim/actions';
import type { ZoneKind } from '../sim/types';

/**
 * Lay out a small scripted city (for the title screen): a road grid with
 * mixed zones, power, water and a few services, on the flattest dry area.
 */
export function buildDemoCity(sim: Sim): { x: number; y: number } {
  const w = sim.world;
  const W = 30;
  const H = 24;
  let best = { x: Math.floor(w.w / 2 - W / 2), y: Math.floor(w.h / 2 - H / 2), score: -Infinity };
  for (let y = 4; y + H < w.h - 4; y += 3) {
    for (let x = 4; x + W < w.w - 4; x += 3) {
      let water = 0;
      let rough = 0;
      for (let yy = y; yy < y + H; yy += 2) {
        for (let xx = x; xx < x + W; xx += 2) {
          if (w.isWater(xx, yy)) water++;
          rough += w.tileMax(xx, yy) - w.tileMin(xx, yy);
        }
      }
      const cx = x + W / 2 - w.w / 2;
      const cy = y + H / 2 - w.h / 2;
      const score = -water * 50 - rough * 2 - Math.hypot(cx, cy) * 0.5;
      if (score > best.score) best = { x, y, score };
    }
  }
  const bx = best.x;
  const by = best.y;
  const road = (x0: number, y0: number, x1: number, y1: number) => applyPlan(planLine(sim, 'road', linePath(x0, y0, x1, y1)));
  const zone = (x0: number, y0: number, x1: number, y1: number, z: ZoneKind, d: number) => applyPlan(planZone(sim, bx + x0, by + y0, bx + x1, by + y1, z, d));
  for (const dy of [0, 8, 16, 23]) road(bx, by + dy, bx + W - 1, by + dy);
  for (const dx of [0, 10, 20, 29]) road(bx + dx, by, bx + dx, by + H - 1);
  // a road toward the nearest map edge for neighbour trade
  road(bx, by + 8, 0, by + 8);
  zone(1, 1, 9, 7, 1, 1);
  zone(11, 1, 19, 7, 1, 2);
  zone(21, 1, 28, 7, 1, 1);
  zone(1, 9, 9, 15, 2, 1);
  zone(11, 9, 19, 15, 2, 3);
  zone(21, 9, 28, 15, 1, 3);
  zone(1, 17, 9, 22, 1, 2);
  zone(21, 17, 28, 22, 3, 2);
  // power plant beside industry, power lines across roads between blocks
  applyPlan(planPlace(sim, 'coal_plant', bx + 25, by + 24, 0));
  applyPlan(planPlace(sim, 'gas_plant', bx + 30, by + 18, 0));
  for (const [x, y] of [
    [10, 4], [20, 4], [5, 8], [15, 8], [25, 8], [10, 12], [20, 12], [5, 16], [15, 16], [25, 16], [10, 19], [20, 19], [26, 23], [29, 19], [12, 16], [10, 21],
  ]) applyPlan(planLine(sim, 'power', [[bx + x, by + y]]));
  applyPlan(planPlace(sim, 'police_station', bx + 11, by + 17, 'auto'));
  applyPlan(planPlace(sim, 'fire_station', bx + 13, by + 17, 'auto'));
  applyPlan(planPlace(sim, 'school', bx + 16, by + 17, 'auto'));
  applyPlan(planPlace(sim, 'large_park', bx + 11, by + 19, 'auto'));
  applyPlan(planPlace(sim, 'small_park', bx + 15, by + 21, 'auto'));
  applyPlan(planPlace(sim, 'clinic', bx + 18, by + 21, 'auto'));
  // pumps touch the gas plant so they are powered
  applyPlan(planPlace(sim, 'water_pump', bx + 30, by + 21, 0));
  applyPlan(planPlace(sim, 'water_pump', bx + 31, by + 21, 0));
  applyPlan(planPlace(sim, 'water_tower', bx + 32, by + 21, 0));
  for (const dx of [5, 15, 25]) applyPlan(planLine(sim, 'pipe', linePath(bx + dx, by + 2, bx + dx, by + 22)));
  applyPlan(planLine(sim, 'pipe', linePath(bx + 5, by + 22, bx + 32, by + 22)));
  // keep the showcase town healthy: ship garbage out, fund health and reading programmes
  sim.city.deals.garbage = true;
  sim.city.ordinances = { free_clinics: true, pro_reading: true };
  return { x: bx + W / 2, y: by + H / 2 };
}
