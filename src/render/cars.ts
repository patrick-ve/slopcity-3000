import * as THREE from 'three';
import { NET } from '../sim/types';
import { DIR_E, DIR_N, DIR_S, DIR_W, DX, DY, type World } from '../sim/world';
import { highwayY, LANE, roadSurfaceY } from './ground';
import { PAL } from './palette';

const MASK_BITS = [DIR_N, DIR_E, DIR_S, DIR_W];

/** A network the cars drive on. */
export interface CarLayer {
  flag: number;
  /** Congestion per tile. */
  traffic: (w: World) => Float32Array;
  /** Height of the driving surface. */
  surfaceY: (w: World, x: number, z: number) => number;
  /** Lane offsets right of the centre line (one is picked per car). */
  lanes: number[];
  /** Speed multiplier. */
  speed: number;
  max: number;
}

export const STREETS: CarLayer = { flag: NET.ROAD, traffic: (w) => w.traffic, surfaceY: roadSurfaceY, lanes: [LANE], speed: 1, max: 1400 };
export const HIGHWAYS: CarLayer = {
  flag: NET.HIGHWAY,
  traffic: (w) => w.hwyTraffic,
  surfaceY: highwayY,
  lanes: [0.1, 0.3],
  speed: 2.2,
  max: 700,
};

/** Car body + cabin; vertex colours are linear (white body tinted by instance colour). */
function carGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.BoxGeometry(0.11, 0.045, 0.2);
  body.translate(0, 0.035, 0);
  const cabin = new THREE.BoxGeometry(0.095, 0.04, 0.1);
  cabin.translate(0, 0.075, -0.015);
  for (const [g, c] of [
    [body, 1],
    [cabin, 0.08],
  ] as [THREE.BufferGeometry, number][]) {
    const n = g.getAttribute('position').count;
    const colors = new Float32Array(n * 3).fill(c);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(g.toNonIndexed());
  }
  const merged = new THREE.BufferGeometry();
  const pos: number[] = [];
  const nrm: number[] = [];
  const colr: number[] = [];
  for (const p of parts) {
    pos.push(...(p.getAttribute('position').array as Float32Array));
    nrm.push(...(p.getAttribute('normal').array as Float32Array));
    colr.push(...(p.getAttribute('color').array as Float32Array));
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return merged;
}

interface Car {
  lane: number;
  tx: number;
  ty: number;
  din: number;
  dout: number;
  s: number;
  len: number;
  speed: number;
  life: number;
  ex: number;
  ez: number;
  cx: number;
  cz: number;
  xx: number;
  xz: number;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const pos = new THREE.Vector3();
const one = new THREE.Vector3(1, 1, 1);
const color = new THREE.Color();

/** Animated traffic: cars wander the road network with density from the simulation. */
export class Cars {
  readonly mesh: THREE.InstancedMesh;
  private cars: Car[] = [];
  private spawnTable: number[] = [];
  private spawnWeights: number[] = [];
  private totalWeight = 0;
  private tableVersion = -1;
  private target = 0;
  private spawnAcc = 0;
  private colors: number[] = [];

  constructor(
    private world: World,
    private layer: CarLayer = STREETS,
  ) {
    const max = layer.max;
    this.mesh = new THREE.InstancedMesh(carGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
  }

  private rebuildTable(): void {
    const w = this.world;
    const congestion = this.layer.traffic(w);
    this.spawnTable = [];
    this.spawnWeights = [];
    this.totalWeight = 0;
    let traffic = 0;
    for (let i = 0; i < w.size; i++) {
      if (!(w.net[i] & this.layer.flag)) continue;
      const t = Math.min(1.5, congestion[i]);
      const wt = 0.05 + t;
      this.spawnTable.push(i);
      this.totalWeight += wt;
      this.spawnWeights.push(this.totalWeight);
      traffic += t;
    }
    this.target = Math.min(this.layer.max, Math.round(this.spawnTable.length * 0.04 + traffic * 0.9));
    this.tableVersion = w.roadVersion;
  }

  private pickSpawn(): number {
    const r = Math.random() * this.totalWeight;
    let lo = 0;
    let hi = this.spawnWeights.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.spawnWeights[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return this.spawnTable[lo];
  }

  private chooseExit(tx: number, ty: number, din: number): number {
    const mask = this.world.netMask(tx, ty, this.layer.flag);
    const back = (din + 2) & 3;
    const opts: number[] = [];
    const weights: number[] = [];
    for (let d = 0; d < 4; d++) {
      if (!(mask & MASK_BITS[d]) || d === back) continue;
      opts.push(d);
      weights.push(d === din ? 2.2 : 1);
    }
    if (!opts.length) return back;
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < opts.length; k++) {
      r -= weights[k];
      if (r <= 0) return opts[k];
    }
    return opts[opts.length - 1];
  }

  private setupTile(c: Car): void {
    const cxT = c.tx + 0.5;
    const czT = c.ty + 0.5;
    const di = c.din;
    const dout = c.dout;
    // right of direction d is (d+1)%4
    const rIn = (di + 1) & 3;
    const rOut = (dout + 1) & 3;
    c.ex = cxT - DX[di] * 0.5 + DX[rIn] * c.lane;
    c.ez = czT - DY[di] * 0.5 + DY[rIn] * c.lane;
    c.xx = cxT + DX[dout] * 0.5 + DX[rOut] * c.lane;
    c.xz = czT + DY[dout] * 0.5 + DY[rOut] * c.lane;
    if (dout === di) {
      c.cx = (c.ex + c.xx) / 2;
      c.cz = (c.ez + c.xz) / 2;
      c.len = 1;
    } else if (dout === ((di + 2) & 3)) {
      c.cx = cxT + DX[di] * 0.45;
      c.cz = czT + DY[di] * 0.45;
      c.len = 1.1;
    } else {
      c.cx = cxT + DX[rIn] * c.lane + DX[rOut] * c.lane;
      c.cz = czT + DY[rIn] * c.lane + DY[rOut] * c.lane;
      c.len = dout === rIn ? 0.55 : 0.9;
    }
  }

  private spawn(): void {
    if (!this.spawnTable.length || this.cars.length >= this.layer.max) return;
    const i = this.pickSpawn();
    const w = this.world;
    const tx = i % w.w;
    const ty = (i / w.w) | 0;
    const mask = w.netMask(tx, ty, this.layer.flag);
    const dirs = [0, 1, 2, 3].filter((d) => mask & MASK_BITS[d]);
    if (!dirs.length) return;
    const dout = dirs[Math.floor(Math.random() * dirs.length)];
    const din = dout;
    const c: Car = {
      tx,
      ty,
      din,
      dout,
      s: Math.random(),
      len: 1,
      speed: (0.9 + Math.random() * 0.5) * this.layer.speed,
      lane: this.layer.lanes[Math.floor(Math.random() * this.layer.lanes.length)],
      life: 12 + Math.random() * 40,
      ex: 0,
      ez: 0,
      cx: 0,
      cz: 0,
      xx: 0,
      xz: 0,
    };
    this.setupTile(c);
    this.cars.push(c);
    this.colors.push(PAL.cars[Math.floor(Math.random() * PAL.cars.length)]);
  }

  update(dt: number, running: boolean): void {
    const w = this.world;
    if (this.tableVersion !== w.roadVersion) this.rebuildTable();
    if (running) {
      if (this.cars.length < this.target) {
        this.spawnAcc += dt * Math.max(2, (this.target - this.cars.length) * 0.5);
        while (this.spawnAcc >= 1) {
          this.spawnAcc -= 1;
          this.spawn();
        }
      }
      const traffic = this.layer.traffic(w);
      for (let k = this.cars.length - 1; k >= 0; k--) {
        const c = this.cars[k];
        const i = w.idx(c.tx, c.ty);
        const slow = 1 / (1 + Math.min(2, traffic[i]) * 0.7);
        c.s += (dt * c.speed * slow) / c.len;
        while (c.s >= 1) {
          c.s -= 1;
          const nx = c.tx + DX[c.dout];
          const ny = c.ty + DY[c.dout];
          c.life -= 1;
          if (!w.inBounds(nx, ny) || !(w.net[w.idx(nx, ny)] & this.layer.flag) || c.life <= 0) {
            this.remove(k);
            break;
          }
          c.tx = nx;
          c.ty = ny;
          c.din = c.dout;
          c.dout = this.chooseExit(nx, ny, c.din);
          this.setupTile(c);
        }
        if (k < this.cars.length && this.cars[k] === c && !(w.net[w.idx(c.tx, c.ty)] & this.layer.flag)) this.remove(k);
      }
      if (this.cars.length > this.target * 1.2 + 5) this.cars.length = Math.floor(this.target * 1.1);
    }
    this.write();
  }

  private remove(k: number): void {
    const last = this.cars.length - 1;
    this.cars[k] = this.cars[last];
    this.colors[k] = this.colors[last];
    this.cars.pop();
    this.colors.pop();
  }

  private write(): void {
    const w = this.world;
    const mesh = this.mesh;
    for (let k = 0; k < this.cars.length; k++) {
      const c = this.cars[k];
      const t = c.s;
      const u = 1 - t;
      const x = u * u * c.ex + 2 * u * t * c.cx + t * t * c.xx;
      const z = u * u * c.ez + 2 * u * t * c.cz + t * t * c.xz;
      const dx = 2 * u * (c.cx - c.ex) + 2 * t * (c.xx - c.cx);
      const dz = 2 * u * (c.cz - c.ez) + 2 * t * (c.xz - c.cz);
      pos.set(x, this.layer.surfaceY(w, x, z) + 0.002, z);
      q.setFromAxisAngle(up, Math.atan2(dx, dz));
      m4.compose(pos, q, one);
      mesh.setMatrixAt(k, m4);
      color.setHex(this.colors[k]);
      mesh.setColorAt(k, color);
    }
    mesh.count = this.cars.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.cars = [];
    this.colors = [];
  }
}
