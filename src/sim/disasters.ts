import { NET, type Building } from './types';
import { getDef } from './catalog';
import type { Sim } from './sim';
import { DIRTY_GROUND, DIRTY_OBJECTS } from './world';

export type DisasterKind = 'fire' | 'tornado' | 'earthquake' | 'meteor';

export interface Tornado {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  lastTile: number;
}

export interface Meteor {
  x: number;
  y: number;
  /** Seconds until impact. */
  t: number;
  total: number;
}

export class Disasters {
  tornado: Tornado | null = null;
  meteors: Meteor[] = [];
  /** Remaining camera-shake seconds. */
  shake = 0;

  constructor(private sim: Sim) {}

  // --------------------------------------------------------------- fire

  ignite(b: Building, announce = true): boolean {
    const def = getDef(b.def);
    if (b.fire > 0 || def.fireproof || b.build > 0) return false;
    b.fire = 14 + Math.floor(this.sim.rng.next() * 12);
    this.sim.world.markDirty(b.x, b.y, DIRTY_OBJECTS);
    if (announce) {
      this.sim.message({ title: 'Fire!', text: `A fire has broken out at a ${def.name}.`, kind: 'bad', x: b.x + b.w / 2, y: b.y + b.h / 2 });
      this.sim.events.emit('sound', 'siren');
    }
    return true;
  }

  /** Destroy a building, leaving rubble. */
  destroy(b: Building): void {
    const w = this.sim.world;
    w.removeBuilding(b.id);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) w.rubble[w.idx(x, y)] = 1;
    w.markArea(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, DIRTY_OBJECTS | DIRTY_GROUND);
    w.tilesDirty = true;
    this.sim.dirty.power = true;
    this.sim.dirty.coverage = true;
    this.sim.events.emit('building', { type: 'destroyed', b });
  }

  /** Daily fire spread and burn-down. */
  day(): void {
    const sim = this.sim;
    const w = sim.world;
    const burning = [...w.buildings.values()].filter((b) => b.fire > 0);
    const fireFund = sim.fundingEffect('fire');
    for (const b of burning) {
      if (!w.buildings.has(b.id)) continue;
      const cover = Math.min(1, w.cover.fire[w.idx(b.x, b.y)] * fireFund);
      // spread to neighbours
      for (let y = b.y - 1; y <= b.y + b.h; y++) {
        for (let x = b.x - 1; x <= b.x + b.w; x++) {
          const n = w.buildingAt(x, y);
          if (!n || n.id === b.id || n.fire > 0) continue;
          if (sim.rng.next() < 0.05 * (1 - cover * 0.9)) this.ignite(n, false);
        }
      }
      b.fire -= 1 + cover * 3;
      if (b.fire <= 0) {
        b.fire = 0;
        if (sim.rng.next() < 0.8 * (1 - cover * 0.75)) this.destroy(b);
        else {
          w.markDirty(b.x, b.y, DIRTY_OBJECTS);
          sim.events.emit('news', { text: `Firefighters save a ${getDef(b.def).name} from the flames`, kind: 'good' });
        }
      }
    }
  }

  /** Monthly random events. */
  month(): void {
    const sim = this.sim;
    if (!sim.city.disastersEnabled) return;
    const w = sim.world;
    const detectors = sim.city.ordinances.smoke_detectors ? 0.6 : 1;
    // random building fire (at most one per month)
    const list = [...w.buildings.values()];
    if (list.length > 20) {
      for (let k = 0; k < 6; k++) {
        const b = list[Math.floor(sim.rng.next() * list.length)];
        const risk = w.fireRisk[w.idx(b.x, b.y)];
        if (sim.rng.next() < risk * 0.12 * detectors) {
          this.ignite(b);
          break;
        }
      }
    }
    if (list.length > 150 && sim.rng.next() < 0.004) {
      this.trigger(sim.rng.pick(['tornado', 'earthquake', 'meteor'] as DisasterKind[]));
    }
  }

  /** Start a disaster (optionally at a tile). */
  trigger(kind: DisasterKind, tx?: number, ty?: number): void {
    const sim = this.sim;
    const w = sim.world;
    const rx = tx ?? Math.floor(w.w * (0.25 + sim.rng.next() * 0.5));
    const ry = ty ?? Math.floor(w.h * (0.25 + sim.rng.next() * 0.5));
    switch (kind) {
      case 'fire': {
        let target = w.buildingAt(rx, ry);
        if (!target) {
          const list = [...w.buildings.values()].filter((b) => !getDef(b.def).fireproof);
          target = list.length ? sim.rng.pick(list) : undefined;
        }
        if (target) this.ignite(target);
        break;
      }
      case 'tornado': {
        const a = sim.rng.next() * Math.PI * 2;
        this.tornado = { x: rx + 0.5, y: ry + 0.5, dx: Math.cos(a), dy: Math.sin(a), life: 22, lastTile: -1 };
        sim.message({ title: 'Tornado!', text: 'A tornado is tearing through the city!', kind: 'bad', x: rx, y: ry });
        sim.events.emit('sound', 'siren');
        sim.events.emit('news', { text: 'Twister touches down! Residents urged to take shelter', kind: 'bad' });
        break;
      }
      case 'earthquake': {
        const r = 10 + sim.rng.next() * 10;
        this.shake = 4;
        sim.events.emit('shake', 4);
        let hit = 0;
        for (const b of [...w.buildings.values()]) {
          const d = Math.hypot(b.x + b.w / 2 - rx, b.y + b.h / 2 - ry);
          if (d > r) continue;
          const p = 0.4 * (1 - d / r);
          const roll = sim.rng.next();
          if (roll < p * 0.6) {
            this.destroy(b);
            hit++;
          } else if (roll < p) this.ignite(b, false);
        }
        sim.message({ title: 'Earthquake!', text: `A strong earthquake shook the city. ${hit} buildings collapsed.`, kind: 'bad', x: rx, y: ry });
        sim.events.emit('news', { text: 'Earthquake rattles the city — damage being assessed', kind: 'bad' });
        sim.events.emit('sound', 'quake');
        break;
      }
      case 'meteor': {
        this.meteors.push({ x: rx + 0.5, y: ry + 0.5, t: 3, total: 3 });
        sim.message({ title: 'Meteor!', text: 'Astronomers spot a meteor heading straight for the city!', kind: 'bad', x: rx, y: ry });
        sim.events.emit('sound', 'siren');
        break;
      }
    }
  }

  /** Real-time update (seconds) for moving disasters. */
  update(dt: number): void {
    const sim = this.sim;
    const w = sim.world;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    const t = this.tornado;
    if (t) {
      t.life -= dt;
      // wobble the heading
      const turn = (sim.rng.next() - 0.5) * 1.6 * dt;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      const ndx = t.dx * c - t.dy * s;
      const ndy = t.dx * s + t.dy * c;
      t.dx = ndx;
      t.dy = ndy;
      t.x += t.dx * dt * 1.6;
      t.y += t.dy * dt * 1.6;
      if (t.x < 1 || t.y < 1 || t.x > w.w - 1 || t.y > w.h - 1) {
        t.dx = -t.dx;
        t.dy = -t.dy;
        t.x = Math.min(w.w - 1.1, Math.max(1.1, t.x));
        t.y = Math.min(w.h - 1.1, Math.max(1.1, t.y));
      }
      const tx = Math.floor(t.x);
      const ty = Math.floor(t.y);
      const ti = w.idx(tx, ty);
      if (ti !== t.lastTile) {
        t.lastTile = ti;
        for (let yy = ty - 1; yy <= ty + 1; yy++) {
          for (let xx = tx - 1; xx <= tx + 1; xx++) {
            if (!w.inBounds(xx, yy)) continue;
            const i = w.idx(xx, yy);
            const center = xx === tx && yy === ty;
            if (w.tree[i] && (center || sim.rng.next() < 0.4)) {
              w.tree[i] = 0;
              w.markDirty(xx, yy, DIRTY_OBJECTS);
            }
            if (w.net[i] & NET.POWER && center) {
              w.net[i] &= ~NET.POWER;
              w.markDirty(xx, yy, DIRTY_OBJECTS | DIRTY_GROUND);
              sim.dirty.power = true;
            }
            const b = w.buildingAt(xx, yy);
            if (b && (center ? sim.rng.next() < 0.8 : sim.rng.next() < 0.2)) this.destroy(b);
          }
        }
      }
      if (t.life <= 0) this.tornado = null;
    }
    for (const m of this.meteors) {
      m.t -= dt;
      if (m.t <= 0) this.impact(m);
    }
    this.meteors = this.meteors.filter((m) => m.t > 0);
  }

  private impact(m: Meteor): void {
    const sim = this.sim;
    const w = sim.world;
    this.shake = 2;
    sim.events.emit('shake', 2);
    sim.events.emit('sound', 'boom');
    const r = 2.6;
    for (const b of [...w.buildings.values()]) {
      const d = Math.hypot(b.x + b.w / 2 - m.x, b.y + b.h / 2 - m.y);
      if (d < r + Math.max(b.w, b.h) / 2) this.destroy(b);
      else if (d < r + 4 && sim.rng.next() < 0.5) this.ignite(b, false);
    }
    for (let y = Math.floor(m.y - r); y <= Math.ceil(m.y + r); y++) {
      for (let x = Math.floor(m.x - r); x <= Math.ceil(m.x + r); x++) {
        if (!w.inBounds(x, y) || Math.hypot(x + 0.5 - m.x, y + 0.5 - m.y) > r) continue;
        const i = w.idx(x, y);
        w.tree[i] = 0;
        if (!w.isWater(x, y) && !(w.net[i] & (NET.ROAD | NET.RAIL))) w.rubble[i] = 1;
        w.markDirty(x, y, DIRTY_OBJECTS | DIRTY_GROUND);
      }
    }
    w.tilesDirty = true;
    sim.events.emit('news', { text: 'Meteor strike leaves a smoking crater in the city', kind: 'bad' });
  }
}
