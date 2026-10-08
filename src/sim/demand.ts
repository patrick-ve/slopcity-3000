import { getDef } from './catalog';
import type { Sim } from './sim';
import { NET } from './types';

export interface CityStats {
  residents: number;
  comJobs: number;
  indJobs: number;
  resCap: number;
  comCap: number;
  indCap: number;
  workforce: number;
  unemployment: number;
  powerSupply: number;
  powerDemand: number;
  waterSupply: number;
  waterDemand: number;
  garbageProduced: number;
  garbageHandled: number;
  landfillCapacity: number;
  roadTiles: number;
  railTiles: number;
  powerLineTiles: number;
  pipeTiles: number;
  highwayTiles: number;
  subwayTiles: number;
  /** Commuters who ride the subway each month. */
  subwayRiders: number;
  connections: { road: number; rail: number; power: number; pipe: number; highway: number };
  avgLandValue: number;
  avgPollution: number;
  avgCrime: number;
  avgTraffic: number;
  resPollution: number;
  resCrime: number;
  healthCover: number;
  eduCover: number;
  parksCover: number;
  hasSeaport: boolean;
  hasAirport: boolean;
  buildings: number;
  abandoned: number;
  burning: number;
  unpowered: number;
  unwatered: number;
  /** Zoned, undeveloped tiles without power. */
  unpoweredZones: number;
  zoneTiles: number[];
  emptyZoneTiles: number[];
  /** Demand target (unsmoothed) for diagnostics. */
  demandTarget: { r: number; c: number; i: number };
}

export function emptyStats(): CityStats {
  return {
    residents: 0,
    comJobs: 0,
    indJobs: 0,
    resCap: 0,
    comCap: 0,
    indCap: 0,
    workforce: 0,
    unemployment: 0,
    powerSupply: 0,
    powerDemand: 0,
    waterSupply: 0,
    waterDemand: 0,
    garbageProduced: 0,
    garbageHandled: 0,
    landfillCapacity: 0,
    roadTiles: 0,
    railTiles: 0,
    powerLineTiles: 0,
    pipeTiles: 0,
    highwayTiles: 0,
    subwayTiles: 0,
    subwayRiders: 0,
    connections: { road: 0, rail: 0, power: 0, pipe: 0, highway: 0 },
    avgLandValue: 0,
    avgPollution: 0,
    avgCrime: 0,
    avgTraffic: 0,
    resPollution: 0,
    resCrime: 0,
    healthCover: 0,
    eduCover: 0,
    parksCover: 0,
    hasSeaport: false,
    hasAirport: false,
    buildings: 0,
    abandoned: 0,
    burning: 0,
    unpowered: 0,
    unwatered: 0,
    unpoweredZones: 0,
    zoneTiles: [0, 0, 0, 0, 0],
    emptyZoneTiles: [0, 0, 0, 0, 0],
    demandTarget: { r: 0, c: 0, i: 0 },
  };
}

/** Aggregate population, jobs, coverage and infrastructure counts. */
export function updateStats(sim: Sim): void {
  const w = sim.world;
  const s = sim.stats;
  let res = 0;
  let com = 0;
  let ind = 0;
  let resCap = 0;
  let comCap = 0;
  let indCap = 0;
  let health = 0;
  let edu = 0;
  let parks = 0;
  let buildings = 0;
  let abandoned = 0;
  let burning = 0;
  let unpowered = 0;
  let unwatered = 0;
  s.hasSeaport = false;
  s.hasAirport = false;
  for (const b of w.buildings.values()) {
    const def = getDef(b.def);
    buildings++;
    if (b.abandoned) abandoned++;
    if (b.fire > 0) burning++;
    if (def.id === 'seaport' && b.build <= 0) s.hasSeaport = true;
    if (def.id === 'airport' && b.build <= 0) s.hasAirport = true;
    const isRes = def.growable ? def.zone === 1 : !!def.residents;
    if (isRes) {
      res += b.pop;
      resCap += def.cap ?? def.residents ?? 0;
      const i = w.idx(b.x, b.y);
      health += b.pop * w.cover.health[i];
      edu += b.pop * w.cover.education[i];
      parks += b.pop * w.cover.parks[i];
    } else if (def.growable && def.zone === 2) {
      com += b.pop;
      comCap += def.cap ?? 0;
    } else if (def.growable && def.zone === 3) {
      ind += b.pop;
      indCap += def.cap ?? 0;
    }
    if (b.build <= 0 && !b.abandoned) {
      if (!b.powered && (def.growable || (def.powerUse ?? 0) > 0)) unpowered++;
      if (!b.watered && def.growable && (def.density ?? 1) >= 2) unwatered++;
    }
  }
  s.residents = Math.round(res);
  s.comJobs = Math.round(com);
  s.indJobs = Math.round(ind);
  s.resCap = resCap;
  s.comCap = comCap;
  s.indCap = indCap;
  s.workforce = res * 0.5;
  const jobs = com + ind;
  s.unemployment = s.workforce > 0 ? Math.max(0, (s.workforce - jobs) / s.workforce) : 0;
  s.healthCover = res > 0 ? health / res : 0;
  s.eduCover = res > 0 ? edu / res : 0;
  s.parksCover = res > 0 ? parks / res : 0;
  s.buildings = buildings;
  s.abandoned = abandoned;
  s.burning = burning;
  s.unpowered = unpowered;
  s.unwatered = unwatered;

  let roads = 0;
  let rails = 0;
  let lines = 0;
  let pipes = 0;
  let highways = 0;
  let subways = 0;
  const zt = [0, 0, 0, 0, 0];
  const ez = [0, 0, 0, 0, 0];
  let unpZones = 0;
  for (let i = 0; i < w.size; i++) {
    const n = w.net[i];
    if (n & NET.ROAD) roads++;
    if (n & NET.RAIL) rails++;
    if (n & NET.POWER) lines++;
    if (n & NET.PIPE) pipes++;
    if (n & NET.HIGHWAY) highways++;
    if (n & NET.SUBWAY) subways++;
    const z = w.zone[i];
    if (z) {
      zt[z]++;
      if (!w.bld[i]) {
        ez[z]++;
        if (z <= 3 && !w.powered[i]) unpZones++;
      }
    }
  }
  s.roadTiles = roads;
  s.railTiles = rails;
  s.powerLineTiles = lines;
  s.pipeTiles = pipes;
  s.highwayTiles = highways;
  s.subwayTiles = subways;
  s.zoneTiles = zt;
  s.emptyZoneTiles = ez;
  s.unpoweredZones = unpZones;
}

function taxEffect(rate: number): number {
  return (7 - rate) * 0.05;
}

/**
 * RCI demand. Residents follow jobs; commerce follows residents; industry
 * follows the workforce and outside markets. Smoothed by `alpha`.
 */
export function updateDemand(sim: Sim, alpha: number): void {
  const s = sim.stats;
  const c = sim.city;
  const ord = c.ordinances;
  const R = s.residents;
  const C = s.comJobs;
  const I = s.indJobs;
  const jobs = C + I;

  // bonuses from buildings (stadium, city hall, seaport, airport...)
  let br = 0;
  let bc = 0;
  let bi = 0;
  for (const b of sim.world.buildings.values()) {
    const def = getDef(b.def);
    if (!def.demand || b.build > 0) continue;
    br += def.demand.r ?? 0;
    bc += def.demand.c ?? 0;
    bi += def.demand.i ?? 0;
  }
  const conn = s.connections;
  const connBonus = Math.min(0.12, conn.road * 0.03) + Math.min(0.08, conn.rail * 0.04) + Math.min(0.1, conn.highway * 0.05);

  // ---- residential
  const jobPull = (jobs * 2.1 + 140 - R) / Math.max(250, R * 0.45);
  const qol =
    (0.35 - s.resPollution) * 0.35 +
    (0.3 - s.resCrime) * 0.3 +
    (c.le - 65) / 120 +
    (c.eq - 80) / 500 +
    s.parksCover * 0.08 -
    Math.min(0.2, c.garbageBacklog / 3000);
  let r = Math.max(-1, Math.min(1, jobPull)) * 0.75 + qol + taxEffect(c.tax.R) + br + connBonus * 0.5;
  if (ord.income_tax) r -= 0.06;
  if (ord.nuclear_free) r += 0.03;
  if (s.unpowered > s.buildings * 0.2 && s.buildings > 10) r -= 0.15;

  // ---- commercial
  const comNeed = R * 0.17 + I * 0.07 + 25;
  let cm = ((comNeed - C) / Math.max(90, comNeed * 0.45)) * 0.8 + taxEffect(c.tax.C) + bc + connBonus * 0.5;
  if (ord.sales_tax) cm -= 0.06;
  if (ord.parking_fines) cm -= 0.02;
  if (ord.smoking_ban) cm -= 0.02;
  if (ord.tourism) cm += 0.08;
  if (!s.hasAirport && C > 6000) cm -= Math.min(0.3, (C - 6000) / 20000);

  // ---- industrial
  const market = 1 + connBonus * 2 + (s.hasSeaport ? 0.25 : 0);
  const indNeed = R * 0.5 * 0.68 * market + 70;
  let id = ((indNeed - I) / Math.max(110, indNeed * 0.45)) * 0.8 + taxEffect(c.tax.I) + bi;
  if (ord.clean_air) id -= 0.06;
  if (ord.business_promo) id += 0.08;
  if (!s.hasSeaport && I > 5000) id -= Math.min(0.3, (I - 5000) / 18000);

  r = Math.max(-1, Math.min(1, r));
  cm = Math.max(-1, Math.min(1, cm));
  id = Math.max(-1, Math.min(1, id));
  s.demandTarget = { r, c: cm, i: id };
  c.demand.r += (r - c.demand.r) * alpha;
  c.demand.c += (cm - c.demand.c) * alpha;
  c.demand.i += (id - c.demand.i) * alpha;
}
