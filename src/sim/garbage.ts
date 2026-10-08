import { getDef } from './catalog';
import type { Sim } from './sim';
import { DIRTY_OBJECTS } from './world';
import { ROAD_REACH } from './networks';

/** Tons a single landfill tile can hold. */
export const LANDFILL_CAPACITY = 1000;
export const EXPORT_LIMIT = 1500;

export function landfillLevel(tons: number): number {
  return Math.min(4, Math.floor((tons / LANDFILL_CAPACITY) * 5));
}

/** Monthly garbage production and disposal. */
export function updateGarbage(sim: Sim): void {
  const w = sim.world;
  const s = sim.stats;
  const c = sim.city;
  let produced = s.residents * 0.01 + s.comJobs * 0.012 + s.indJobs * 0.02;
  let recycle = 0;
  for (const b of w.buildings.values()) {
    const def = getDef(b.def);
    if (def.recycle && b.build <= 0 && b.powered) recycle += def.recycle;
  }
  recycle = Math.min(0.5, recycle) + (c.ordinances.recycling ? 0.15 : 0);
  produced *= 1 - Math.min(0.6, recycle);

  let remaining = produced + c.garbageBacklog;
  let handled = 0;
  // incinerators and waste-to-energy
  for (const b of w.buildings.values()) {
    const def = getDef(b.def);
    if (!def.burn || b.build > 0 || b.fire > 0) continue;
    if ((def.powerUse ?? 0) > 0 && !b.powered) continue;
    const t = Math.min(remaining, def.burn);
    remaining -= t;
    handled += t;
  }
  // landfills with road access
  let capacity = 0;
  for (let i = 0; i < w.size && remaining > 0.01; i++) {
    if (w.zone[i] !== 4 || w.bld[i] || w.roadDist[i] > ROAD_REACH) continue;
    const free = LANDFILL_CAPACITY - w.landfill[i];
    if (free <= 0) continue;
    const before = landfillLevel(w.landfill[i]);
    const t = Math.min(free, remaining, 220);
    w.landfill[i] += t;
    remaining -= t;
    handled += t;
    if (landfillLevel(w.landfill[i]) !== before) w.markDirty(i % w.w, (i / w.w) | 0, DIRTY_OBJECTS);
  }
  for (let i = 0; i < w.size; i++) {
    if (w.zone[i] === 4 && !w.bld[i] && w.roadDist[i] <= ROAD_REACH) capacity += LANDFILL_CAPACITY - w.landfill[i];
  }
  // export to neighbours
  sim.garbageExported = 0;
  if (c.deals.garbage && s.connections.road > 0 && remaining > 0) {
    const t = Math.min(remaining, EXPORT_LIMIT);
    sim.garbageExported = t;
    remaining -= t;
    handled += t;
  }
  const prevBacklog = c.garbageBacklog;
  c.garbageBacklog = Math.max(0, remaining * 0.9);
  s.garbageProduced = produced;
  s.garbageHandled = handled;
  s.landfillCapacity = capacity;
  if (c.garbageBacklog > 300 && prevBacklog <= 300) {
    sim.message({
      title: 'Garbage crisis',
      text: 'Garbage is piling up in the streets. Zone a landfill, build an incinerator or make a deal with a neighbour.',
      kind: 'bad',
    });
  }
}
