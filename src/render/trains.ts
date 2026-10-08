import * as THREE from 'three';
import { NET } from '../sim/types';
import { DIR_E, DIR_N, DIR_S, DIR_W, DX, DY, LEVEL_H, type World } from '../sim/world';
import { deckY } from './ground';

const MASK_BITS = [DIR_N, DIR_E, DIR_S, DIR_W];
const MAX_TRAINS = 14;
const WAGONS = 3;
const GAP = 0.34;
const MAX_UNITS = MAX_TRAINS * (WAGONS + 1);

interface Train {
  tx: number;
  ty: number;
  din: number;
  dout: number;
  s: number;
  speed: number;
  /** Recent head positions for the wagons to follow. */
  trail: { x: number; z: number; d: number }[];
  dist: number;
  colour: number;
}

function box(w: number, h: number, l: number, y: number, colour: number, out: THREE.BufferGeometry[]): void {
  const g = new THREE.BoxGeometry(w, h, l).toNonIndexed();
  g.translate(0, y + h / 2, 0);
  const c = new THREE.Color(colour);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.push(g);
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  for (const p of parts) {
    pos.push(...(p.getAttribute('position').array as Float32Array));
    nrm.push(...(p.getAttribute('normal').array as Float32Array));
    col.push(...(p.getAttribute('color').array as Float32Array));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Locomotives pulling a few wagons along the rail network. */
export class Trains {
  readonly group = new THREE.Group();
  private locos: THREE.InstancedMesh;
  private wagons: THREE.InstancedMesh;
  private trains: Train[] = [];
  private version = -1;
  private railTiles: number[] = [];
  private spawnTimer = 0;

  constructor(private world: World) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const loco: THREE.BufferGeometry[] = [];
    box(0.13, 0.1, 0.28, 0.06, 0xffffff, loco); // body (tinted per train)
    box(0.12, 0.05, 0.1, 0.16, 0x2b2d30, loco); // cab roof
    box(0.1, 0.03, 0.3, 0.035, 0x2b2d30, loco); // chassis
    const wagon: THREE.BufferGeometry[] = [];
    box(0.12, 0.09, 0.28, 0.06, 0xb8bcc2, wagon);
    box(0.1, 0.03, 0.3, 0.035, 0x2b2d30, wagon);
    this.locos = new THREE.InstancedMesh(merge(loco), mat, MAX_TRAINS);
    this.locos.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TRAINS * 3), 3);
    this.wagons = new THREE.InstancedMesh(merge(wagon), mat, MAX_UNITS);
    for (const m of [this.locos, this.wagons]) {
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
    }
    this.group.add(this.locos, this.wagons);
  }

  private railY(x: number, z: number): number {
    const w = this.world;
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (w.inBounds(tx, tz) && w.isWater(tx, tz)) return deckY(w) + 0.03;
    return w.heightAt(x, z) * LEVEL_H + 0.05;
  }

  private exits(tx: number, ty: number, din: number): number {
    const mask = this.world.netMask(tx, ty, NET.RAIL);
    const back = (din + 2) & 3;
    const opts = [0, 1, 2, 3].filter((d) => mask & MASK_BITS[d] && d !== back);
    if (!opts.length) return back;
    if (opts.includes(din) && Math.random() < 0.7) return din;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  private spawn(): void {
    const w = this.world;
    if (this.railTiles.length < 8 || this.trains.length >= Math.min(MAX_TRAINS, Math.floor(this.railTiles.length / 30) + 1)) return;
    const i = this.railTiles[Math.floor(Math.random() * this.railTiles.length)];
    const tx = i % w.w;
    const ty = (i / w.w) | 0;
    const mask = w.netMask(tx, ty, NET.RAIL);
    const dirs = [0, 1, 2, 3].filter((d) => mask & MASK_BITS[d]);
    if (!dirs.length) return;
    const d = dirs[Math.floor(Math.random() * dirs.length)];
    this.trains.push({
      tx,
      ty,
      din: d,
      dout: d,
      s: 0.5,
      speed: 1.3 + Math.random() * 0.5,
      trail: [],
      dist: 0,
      colour: [0xd6453d, 0x3f7fd6, 0xf2c94c, 0x4caf50][Math.floor(Math.random() * 4)],
    });
  }

  private headPos(t: Train): [number, number, number, number] {
    const cx = t.tx + 0.5;
    const cz = t.ty + 0.5;
    const ex = cx - DX[t.din] * 0.5;
    const ez = cz - DY[t.din] * 0.5;
    const xx = cx + DX[t.dout] * 0.5;
    const xz = cz + DY[t.dout] * 0.5;
    const s = t.s;
    const u = 1 - s;
    const x = u * u * ex + 2 * u * s * cx + s * s * xx;
    const z = u * u * ez + 2 * u * s * cz + s * s * xz;
    const dx = 2 * u * (cx - ex) + 2 * s * (xx - cx);
    const dz = 2 * u * (cz - ez) + 2 * s * (xz - cz);
    return [x, z, dx, dz];
  }

  update(dt: number, running: boolean): void {
    const w = this.world;
    if (this.version !== w.roadVersion + w.buildVersion) {
      this.version = w.roadVersion + w.buildVersion;
      this.railTiles = [];
      for (let i = 0; i < w.size; i++) if (w.net[i] & NET.RAIL) this.railTiles.push(i);
      this.trains = this.trains.filter((t) => w.hasNet(t.tx, t.ty, NET.RAIL));
    }
    if (running) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 3;
        this.spawn();
      }
      for (let k = this.trains.length - 1; k >= 0; k--) {
        const t = this.trains[k];
        const step = dt * t.speed;
        t.s += step;
        t.dist += step;
        while (t.s >= 1) {
          t.s -= 1;
          const nx = t.tx + DX[t.dout];
          const ny = t.ty + DY[t.dout];
          if (!w.hasNet(nx, ny, NET.RAIL)) {
            // end of the line: reverse
            t.din = (t.dout + 2) & 3;
            t.dout = this.exits(t.tx, t.ty, t.din);
            t.trail = [];
            continue;
          }
          t.tx = nx;
          t.ty = ny;
          t.din = t.dout;
          t.dout = this.exits(nx, ny, t.din);
        }
        const [x, z] = this.headPos(t);
        t.trail.push({ x, z, d: t.dist });
        while (t.trail.length > 2 && t.trail[1].d < t.dist - (WAGONS + 1) * GAP - 0.5) t.trail.shift();
      }
    }
    this.write();
  }

  private sample(t: Train, back: number): [number, number, number] | null {
    const target = t.dist - back;
    const tr = t.trail;
    for (let i = tr.length - 1; i > 0; i--) {
      const a = tr[i - 1];
      const b = tr[i];
      if (a.d <= target && target <= b.d) {
        const f = (target - a.d) / Math.max(1e-6, b.d - a.d);
        const x = a.x + (b.x - a.x) * f;
        const z = a.z + (b.z - a.z) * f;
        return [x, z, Math.atan2(b.x - a.x, b.z - a.z)];
      }
    }
    return null;
  }

  private write(): void {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const c = new THREE.Color();
    let wi = 0;
    for (let k = 0; k < this.trains.length; k++) {
      const t = this.trains[k];
      const [x, z, dx, dz] = this.headPos(t);
      p.set(x, this.railY(x, z), z);
      q.setFromAxisAngle(up, Math.atan2(dx, dz));
      m4.compose(p, q, one);
      this.locos.setMatrixAt(k, m4);
      this.locos.setColorAt(k, c.setHex(t.colour));
      for (let n = 1; n <= WAGONS; n++) {
        const s = this.sample(t, n * GAP);
        if (!s) continue;
        p.set(s[0], this.railY(s[0], s[1]), s[1]);
        q.setFromAxisAngle(up, s[2]);
        m4.compose(p, q, one);
        this.wagons.setMatrixAt(wi++, m4);
      }
    }
    this.locos.count = this.trains.length;
    this.wagons.count = wi;
    this.locos.instanceMatrix.needsUpdate = true;
    if (this.locos.instanceColor) this.locos.instanceColor.needsUpdate = true;
    this.wagons.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.locos.geometry.dispose();
    this.wagons.geometry.dispose();
  }
}
