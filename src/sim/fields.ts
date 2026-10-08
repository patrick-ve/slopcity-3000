import { NET, SERVICE_KINDS, type Department } from './types';
import { getDef } from './catalog';
import type { Sim } from './sim';
import type { World } from './world';
import { needsPower } from './util';

const staticCache = new WeakMap<World, Float32Array>();

/** Separable box blur (radius r), result written to dst. */
export function boxBlur(src: Float32Array, dst: Float32Array, W: number, H: number, r: number): void {
  const tmp = new Float32Array(W * H);
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let acc = 0;
    const row = y * W;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[row + x] = acc / n;
      acc += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc / n;
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
}

/** Terrain-based part of land value (elevation, views of water). */
export function updateStaticLand(sim: Sim): void {
  const w = sim.world;
  const out = new Float32Array(w.size);
  // distance to water (capped)
  const dist = new Uint8Array(w.size).fill(255);
  const q: number[] = [];
  for (let y = 0; y < w.h; y++) {
    for (let x = 0; x < w.w; x++) {
      if (w.isWater(x, y)) {
        dist[w.idx(x, y)] = 0;
        q.push(w.idx(x, y));
      }
    }
  }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    const d = dist[i];
    if (d >= 6) continue;
    const x = i % w.w;
    const y = (i / w.w) | 0;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (!w.inBounds(nx, ny)) continue;
      const j = w.idx(nx, ny);
      if (dist[j] === 255) {
        dist[j] = d + 1;
        q.push(j);
      }
    }
  }
  for (let y = 0; y < w.h; y++) {
    for (let x = 0; x < w.w; x++) {
      const i = w.idx(x, y);
      const elev = Math.max(0, w.tileMax(x, y) - w.seaLevel);
      let v = 0.3 + Math.min(0.14, elev * 0.012);
      const d = dist[i];
      if (d > 0 && d <= 6) v += 0.16 * (1 - (d - 1) / 6);
      out[i] = v;
    }
  }
  staticCache.set(w, out);
}

function deptEffect(sim: Sim, dept: Department | undefined): number {
  return dept ? sim.fundingEffect(dept) : 1;
}

/** Service coverage fields (police, fire, health, education, parks, transit). */
export function updateCoverage(sim: Sim): void {
  const w = sim.world;
  for (const k of SERVICE_KINDS) w.cover[k].fill(0);
  for (const b of w.buildings.values()) {
    const def = getDef(b.def);
    if (!def.service || b.build > 0 || b.fire > 0) continue;
    let eff = def.service.strength * deptEffect(sim, def.dept);
    if (needsPower(def) && !b.powered) eff *= 0.4;
    const field = w.cover[def.service.kind];
    const r = def.service.radius;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(w.w - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(w.h - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const v = eff * Math.min(1, Math.max(0, 1.25 - d / r));
        if (v <= 0) continue;
        const i = w.idx(x, y);
        field[i] = 1 - (1 - field[i]) * (1 - Math.min(1, v));
      }
    }
  }
  if (sim.city.ordinances.volunteer_fire) {
    const f = w.cover.fire;
    for (let i = 0; i < w.size; i++) f[i] = Math.max(f[i], 0.2);
  }
  // fire risk depends on fire coverage
  for (let i = 0; i < w.size; i++) {
    const id = w.bld[i];
    if (!id) {
      w.fireRisk[i] = 0;
      continue;
    }
    const b = w.buildings.get(id)!;
    const def = getDef(b.def);
    let base = 0.12 + Math.min(0.4, w.popDensity[i] * 0.4);
    if (def.growable && def.zone === 3) base += def.wealth === 0 ? 0.3 : 0.15;
    if (!def.growable) base *= 0.35;
    if (def.fireproof) base *= 0.2;
    w.fireRisk[i] = base * (1 - w.cover.fire[i] * 0.85);
  }
}

/** Air pollution from industry, plants, traffic and landfills, diffused. */
export function updatePollution(sim: Sim): void {
  const w = sim.world;
  const emit = new Float32Array(w.size);
  const cleanAir = sim.city.ordinances.clean_air ? 0.75 : 1;
  for (const b of w.buildings.values()) {
    if (b.build > 0) continue;
    const def = getDef(b.def);
    let e = 0;
    if (def.growable && def.zone === 3 && !b.abandoned) {
      const occ = def.cap ? b.pop / def.cap : 0;
      e = [0.75, 0.42, 0.08][def.wealth ?? 0] * (0.35 + 0.65 * occ) * cleanAir;
    } else if (def.pollution) {
      e = def.pollution * (def.power || def.burn ? cleanAir : 1);
    }
    if (b.fire > 0) e = Math.max(e, 0.6);
    if (e <= 0) continue;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) emit[w.idx(x, y)] = Math.max(emit[w.idx(x, y)], e);
  }
  for (let i = 0; i < w.size; i++) {
    if (w.net[i] & NET.ROAD) emit[i] += Math.min(1.5, w.traffic[i]) * 0.22;
    if (w.zone[i] === 4 && w.landfill[i] > 0) emit[i] += 0.12;
  }
  const a = new Float32Array(w.size);
  boxBlur(emit, a, w.w, w.h, 3);
  boxBlur(a, w.pollution, w.w, w.h, 3);
  let sum = 0;
  let n = 0;
  let resSum = 0;
  let resW = 0;
  for (let i = 0; i < w.size; i++) {
    let v = Math.min(1, w.pollution[i] * 3.2 + emit[i] * 0.35);
    v *= 1 - w.tree[i] * 0.07;
    w.pollution[i] = v;
    if (w.bld[i]) {
      sum += v;
      n++;
      if (w.zone[i] === 1) {
        resSum += v * (1 + w.popDensity[i] * 10);
        resW += 1 + w.popDensity[i] * 10;
      }
    }
  }
  sim.stats.avgPollution = n ? sum / n : 0;
  sim.stats.resPollution = resW ? resSum / resW : 0;
}

/** Land value: terrain + services + parks − pollution − crime − noise. */
export function updateLandValue(sim: Sim): void {
  const w = sim.world;
  const base = staticCache.get(w) ?? new Float32Array(w.size).fill(0.25);
  const bonus = new Float32Array(w.size);
  // building-specific land value effects
  for (const b of w.buildings.values()) {
    const def = getDef(b.def);
    if (!def.landValue || b.build > 0) continue;
    const { radius: r, amount } = def.landValue;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(w.h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w.w - 1, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r) continue;
        bonus[w.idx(x, y)] += amount * (1 - d / (r + 1));
      }
    }
  }
  // downtown: commercial job concentration
  const com = new Float32Array(w.size);
  for (const b of w.buildings.values()) {
    const def = getDef(b.def);
    if (!def.growable || def.zone !== 2 || b.build > 0) continue;
    const per = b.pop / (b.w * b.h);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) com[w.idx(x, y)] = per;
  }
  const comBlur = new Float32Array(w.size);
  boxBlur(com, comBlur, w.w, w.h, 6);
  // traffic noise (blurred)
  const noise = new Float32Array(w.size);
  boxBlur(w.traffic, noise, w.w, w.h, 1);
  const ord = sim.city.ordinances;
  const garbagePenalty = Math.min(0.12, sim.city.garbageBacklog / 6000);
  const cv = w.cover;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < w.size; i++) {
    let v = base[i];
    v += cv.parks[i] * 0.28 + cv.police[i] * 0.05 + cv.fire[i] * 0.04 + cv.health[i] * 0.07 + cv.education[i] * 0.07 + cv.transit[i] * 0.03;
    v += Math.min(0.18, comBlur[i] / 900);
    v += Math.min(0.06, w.tree[i] * 0.02);
    v -= w.pollution[i] * 0.45;
    v -= w.crime[i] * 0.25;
    v -= Math.min(1.5, noise[i]) * 0.1;
    v += bonus[i];
    if (ord.city_beautification) v += 0.04;
    v -= garbagePenalty;
    v = Math.min(1, Math.max(0, v));
    w.landValue[i] = v;
    if (w.zone[i] || w.bld[i]) {
      sum += v;
      n++;
    }
  }
  sim.stats.avgLandValue = n ? sum / n : 0;
}

/** Crime from population density, poverty, low policing. */
export function updateCrime(sim: Sim): void {
  const w = sim.world;
  // population density per tile
  w.popDensity.fill(0);
  const extra = new Float32Array(w.size);
  for (const b of w.buildings.values()) {
    const def = getDef(b.def);
    const per = b.pop / (b.w * b.h);
    const dens = Math.min(1, per / 600);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) w.popDensity[w.idx(x, y)] = dens;
    if (def.crime && b.build <= 0) {
      const r = 7;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(w.h - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w.w - 1, Math.ceil(cx + r)); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= r) extra[w.idx(x, y)] += def.crime * (1 - d / (r + 1));
        }
      }
    }
  }
  const ord = sim.city.ordinances;
  const police = w.cover.police;
  const fund = sim.fundingEffect('police');
  const raw = new Float32Array(w.size);
  const eqEffect = (sim.city.eq - 80) / 500;
  for (let i = 0; i < w.size; i++) {
    if (!w.bld[i]) {
      raw[i] = extra[i];
      continue;
    }
    let c = w.popDensity[i] * 0.75 * (1.15 - w.landValue[i]) + 0.06;
    if (ord.gambling) c += 0.08;
    c -= eqEffect;
    c *= ord.neighborhood_watch ? 0.9 : 1;
    c *= ord.youth_curfew ? 0.92 : 1;
    c += extra[i];
    c -= police[i] * 0.85 * Math.min(1, fund + 0.2);
    raw[i] = Math.max(0, c);
  }
  boxBlur(raw, w.crime, w.w, w.h, 1);
  let sum = 0;
  let n = 0;
  let resSum = 0;
  let resN = 0;
  for (let i = 0; i < w.size; i++) {
    w.crime[i] = Math.min(1, w.crime[i] * 1.4);
    if (w.bld[i]) {
      sum += w.crime[i];
      n++;
      if (w.zone[i] === 1) {
        resSum += w.crime[i];
        resN++;
      }
    }
  }
  sim.stats.avgCrime = n ? sum / n : 0;
  sim.stats.resCrime = resN ? resSum / resN : 0;
}
