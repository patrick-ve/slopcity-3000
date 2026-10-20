import * as THREE from 'three';
import { LEVEL_H, type World } from '../sim/world';
import { deckY } from './tracks';
import { chooseExit, edgeLeg, legEnd, pose, type Leg, type Pose } from './route';

const MAX_TRAINS = 14;
const WAGONS = 3;
const GAP = 0.34;
const MAX_UNITS = MAX_TRAINS * (WAGONS + 1);

interface Train {
  leg: Leg;
  /** Distance along the leg. */
  d: number;
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

const head: Pose = { x: 0, z: 0, dx: 0, dz: 0, s: 0 };

/** Locomotives pulling a few wagons along the rail network. */
export class Trains {
  readonly group = new THREE.Group();
  private locos: THREE.InstancedMesh;
  private wagons: THREE.InstancedMesh;
  private trains: Train[] = [];
  private version = -1;
  private edges: number[] = [];
  private railLength = 0;
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

  private spawn(): void {
    const net = this.world.tracks.rail;
    if (this.railLength < 8 || this.trains.length >= Math.min(MAX_TRAINS, Math.floor(this.railLength / 30) + 1)) return;
    // a random spot, every length of track equally likely
    let r = Math.random() * this.railLength;
    let id = this.edges[0];
    for (const e of this.edges) {
      id = e;
      r -= net.length(e);
      if (r <= 0) break;
    }
    const e = net.edges.get(id)!;
    const leg = edgeLeg(net, id, Math.random() < 0.5 ? e.a : e.b, false);
    this.trains.push({
      leg,
      d: Math.random() * leg.len,
      speed: 1.3 + Math.random() * 0.5,
      trail: [],
      dist: 0,
      colour: [0xd6453d, 0x3f7fd6, 0xf2c94c, 0x4caf50][Math.floor(Math.random() * 4)],
    });
  }

  update(dt: number, running: boolean): void {
    const net = this.world.tracks.rail;
    if (this.version !== net.version) {
      this.version = net.version;
      this.edges = [...net.edges.keys()];
      this.railLength = this.edges.reduce((sum, e) => sum + net.length(e), 0);
      this.trains = this.trains.filter((t) => net.edges.has(t.leg.edge));
    }
    if (running) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 3;
        this.spawn();
      }
      for (const t of this.trains) {
        const step = dt * t.speed;
        t.d += step;
        t.dist += step;
        for (let guard = 0; t.d >= t.leg.len && guard < 6; guard++) {
          t.d -= t.leg.len;
          const node = legEnd(net, t.leg);
          pose(t.leg, t.leg.len, 0, head);
          // switches only turn gently; at the end of the line the train reverses
          const exit = chooseExit(net, node, t.leg.edge, head.dx, head.dz, 2.5, 0.3);
          if (exit === t.leg.edge) t.trail = [];
          t.leg = edgeLeg(net, exit, node, false);
        }
        pose(t.leg, t.d, 0, head);
        t.trail.push({ x: head.x, z: head.z, d: t.dist });
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
      pose(t.leg, t.d, 0, head);
      p.set(head.x, this.railY(head.x, head.z), head.z);
      q.setFromAxisAngle(up, Math.atan2(head.dx, head.dz));
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
    (this.locos.material as THREE.Material).dispose();
  }
}
