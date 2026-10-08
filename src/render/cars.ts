import * as THREE from 'three';
import type { World } from '../sim/world';
import type { TrackNet } from '../sim/tracks/net';
import { deckAt, nodeDeck, roadSurfaceY } from './tracks';
import { chooseExit, edgeLeg, legEnd, pose, turnLeg, type Leg, type Pose } from './route';
import { PAL } from './palette';

/** Lane offset from the road centre line. */
export const LANE = 0.16;

/** A network the cars drive on. */
export interface CarLayer {
  kind: 'road' | 'highway';
  /** Congestion per tile. */
  traffic: (w: World) => Float32Array;
  /** Lane offsets right of the centre line (one is picked per car). */
  lanes: number[];
  /** Speed multiplier. */
  speed: number;
  max: number;
}

export const STREETS: CarLayer = { kind: 'road', traffic: (w) => w.traffic, lanes: [LANE], speed: 1, max: 1400 };
export const HIGHWAYS: CarLayer = { kind: 'highway', traffic: (w) => w.hwyTraffic, lanes: [0.1, 0.3], speed: 2.2, max: 700 };

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
  /** Current leg, and the edge leg that follows a turn. */
  leg: Leg;
  after: Leg | null;
  /** Distance driven along the leg. */
  d: number;
  lane: number;
  speed: number;
  /** Distance left before the car leaves the road. */
  life: number;
  color: number;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const pos = new THREE.Vector3();
const one = new THREE.Vector3(1, 1, 1);
const color = new THREE.Color();
const here: Pose = { x: 0, z: 0, dx: 0, dz: 0, s: 0 };

/** Animated traffic: cars drive the road (or highway) network, as many as the simulation's traffic suggests. */
export class Cars {
  readonly mesh: THREE.InstancedMesh;
  private cars: Car[] = [];
  private spawnEdges: number[] = [];
  private spawnWeights: number[] = [];
  private totalWeight = 0;
  private tableVersion = -1;
  private netVersion = -1;
  private target = 0;
  private spawnAcc = 0;

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

  private get net(): TrackNet {
    return this.world.tracks[this.layer.kind];
  }

  /** Spawn weights per edge (length and traffic) and the number of cars to show. */
  private rebuildTable(): void {
    const w = this.world;
    const net = this.net;
    const congestion = this.layer.traffic(w);
    this.spawnEdges = [];
    this.spawnWeights = [];
    this.totalWeight = 0;
    for (const id of net.edges.keys()) {
      const tiles = net.tilesOf(-id);
      let t = 0;
      for (const i of tiles) t += Math.min(1.5, congestion[i]);
      const len = net.length(id);
      const weight = len * (0.05 + (tiles.length ? t / tiles.length : 0));
      if (weight <= 0) continue;
      this.totalWeight += weight;
      this.spawnEdges.push(id);
      this.spawnWeights.push(this.totalWeight);
    }
    let tiles = 0;
    let traffic = 0;
    const flag = net.profile.flag;
    for (let i = 0; i < w.size; i++) {
      if (!(w.net[i] & flag)) continue;
      tiles++;
      traffic += Math.min(1.5, congestion[i]);
    }
    this.target = Math.min(this.layer.max, Math.round(tiles * 0.04 + traffic * 0.9));
    this.tableVersion = w.roadVersion;
  }

  private pickEdge(): number {
    const r = Math.random() * this.totalWeight;
    let lo = 0;
    let hi = this.spawnWeights.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.spawnWeights[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return this.spawnEdges[lo];
  }

  private spawn(): void {
    if (!this.spawnEdges.length || this.cars.length >= this.layer.max) return;
    const net = this.net;
    const id = this.pickEdge();
    const e = net.edges.get(id);
    if (!e) return;
    const leg = edgeLeg(net, id, Math.random() < 0.5 ? e.a : e.b, true);
    this.cars.push({
      leg,
      after: null,
      d: Math.random() * leg.len,
      lane: this.layer.lanes[Math.floor(Math.random() * this.layer.lanes.length)],
      speed: (0.9 + Math.random() * 0.5) * this.layer.speed,
      life: 12 + Math.random() * 40,
      color: PAL.cars[Math.floor(Math.random() * PAL.cars.length)],
    });
  }

  /** At the end of an edge leg: turn into the next edge (or back at a dead end). */
  private nextLeg(c: Car): boolean {
    const net = this.net;
    if (c.after) {
      c.leg = c.after;
      c.after = null;
      return true;
    }
    if (!net.edges.has(c.leg.edge)) return false;
    const node = legEnd(net, c.leg);
    pose(c.leg, c.leg.len, 0, here);
    const exit = chooseExit(net, node, c.leg.edge, here.dx, here.dz, 2.2);
    const next = edgeLeg(net, exit, node, true);
    const turn = turnLeg(c.leg, next, node, c.lane, net.profile.cap * 0.9);
    c.leg = turn ?? next;
    c.after = turn ? next : null;
    return true;
  }

  update(dt: number, running: boolean): void {
    const w = this.world;
    const net = this.net;
    if (this.tableVersion !== w.roadVersion) this.rebuildTable();
    if (this.netVersion !== net.version) {
      // the network changed: cars on removed track leave
      this.netVersion = net.version;
      this.cars = this.cars.filter(
        (c) => (c.leg.edge ? net.edges.has(c.leg.edge) : net.nodes.has(c.leg.node)) && (!c.after || net.edges.has(c.after.edge)),
      );
    }
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
        pose(c.leg, c.d, c.lane, here);
        const tx = Math.floor(here.x);
        const tz = Math.floor(here.z);
        const jam = w.inBounds(tx, tz) ? traffic[w.idx(tx, tz)] : 0;
        const step = dt * c.speed * (1 / (1 + Math.min(2, jam) * 0.7));
        c.d += step;
        c.life -= step;
        let alive = c.life > 0;
        for (let guard = 0; alive && c.d >= c.leg.len && guard < 6; guard++) {
          c.d -= c.leg.len;
          alive = this.nextLeg(c);
        }
        if (!alive) {
          this.cars[k] = this.cars[this.cars.length - 1];
          this.cars.pop();
        }
      }
      if (this.cars.length > this.target * 1.2 + 5) this.cars.length = Math.floor(this.target * 1.1);
    }
    this.write();
  }

  private height(c: Car): number {
    const w = this.world;
    if (this.layer.kind === 'road') return roadSurfaceY(w, here.x, here.z);
    return c.leg.edge ? deckAt(w, this.net, c.leg.edge, here.s) : nodeDeck(w, this.net, c.leg.node);
  }

  private write(): void {
    const mesh = this.mesh;
    for (let k = 0; k < this.cars.length; k++) {
      const c = this.cars[k];
      pose(c.leg, c.d, c.lane, here);
      pos.set(here.x, this.height(c) + 0.002, here.z);
      q.setFromAxisAngle(up, Math.atan2(here.dx, here.dz));
      m4.compose(pos, q, one);
      mesh.setMatrixAt(k, m4);
      color.setHex(c.color);
      mesh.setColorAt(k, color);
    }
    mesh.count = this.cars.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.cars = [];
  }
}
