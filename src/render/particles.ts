import * as THREE from 'three';
import type { EmitterInst } from './objects';

const MAX_SMOKE = 1800;
const MAX_FLAME = 700;

const enum Kind {
  Smoke = 0,
  Steam = 1,
  Dark = 2,
  Fire = 3,
  Dust = 4,
}

const KIND_OF: Record<EmitterInst['kind'], Kind> = { smoke: Kind.Smoke, steam: Kind.Steam, dark: Kind.Dark, fire: Kind.Fire };
const RATE = [1.3, 1.0, 1.5, 7, 0];

interface Pool {
  mesh: THREE.InstancedMesh;
  n: number;
  max: number;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  age: Float32Array;
  life: Float32Array;
  size: Float32Array;
  kind: Uint8Array;
  rot: Float32Array;
}

function makePool(mesh: THREE.InstancedMesh, max: number): Pool {
  return {
    mesh,
    n: 0,
    max,
    px: new Float32Array(max),
    py: new Float32Array(max),
    pz: new Float32Array(max),
    vx: new Float32Array(max),
    vy: new Float32Array(max),
    vz: new Float32Array(max),
    age: new Float32Array(max),
    life: new Float32Array(max),
    size: new Float32Array(max),
    kind: new Uint8Array(max),
    rot: new Float32Array(max),
  };
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const sc = new THREE.Vector3();
const col = new THREE.Color();
const c1 = new THREE.Color();
const c2 = new THREE.Color();

/** Low-poly puffs of smoke/steam and flickering flames. */
export class Particles {
  readonly group = new THREE.Group();
  private smoke: Pool;
  private flame: Pool;
  private emitters: EmitterInst[] = [];
  private timers: number[] = [];
  wind = new THREE.Vector2(0.25, 0.1);

  constructor() {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const smokeMesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), MAX_SMOKE);
    smokeMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SMOKE * 3), 3);
    smokeMesh.frustumCulled = false;
    smokeMesh.count = 0;
    smokeMesh.castShadow = false;
    const flameGeo = new THREE.OctahedronGeometry(1, 0);
    const flameMesh = new THREE.InstancedMesh(flameGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_FLAME);
    flameMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLAME * 3), 3);
    flameMesh.frustumCulled = false;
    flameMesh.count = 0;
    this.smoke = makePool(smokeMesh, MAX_SMOKE);
    this.flame = makePool(flameMesh, MAX_FLAME);
    this.group.add(smokeMesh, flameMesh);
  }

  setEmitters(list: EmitterInst[]): void {
    this.emitters = list;
    this.timers = list.map(() => Math.random());
  }

  private spawn(pool: Pool, kind: Kind, x: number, y: number, z: number, s: number): void {
    if (pool.n >= pool.max) return;
    const i = pool.n++;
    pool.px[i] = x + (Math.random() - 0.5) * 0.05;
    pool.py[i] = y;
    pool.pz[i] = z + (Math.random() - 0.5) * 0.05;
    pool.age[i] = 0;
    pool.kind[i] = kind;
    pool.rot[i] = Math.random() * 6.28;
    switch (kind) {
      case Kind.Fire:
        pool.vx[i] = (Math.random() - 0.5) * 0.15;
        pool.vy[i] = 0.5 + Math.random() * 0.4;
        pool.vz[i] = (Math.random() - 0.5) * 0.15;
        pool.life[i] = 0.5 + Math.random() * 0.4;
        pool.size[i] = (0.07 + Math.random() * 0.06) * s;
        break;
      case Kind.Dust:
        pool.vx[i] = (Math.random() - 0.5) * 0.8;
        pool.vy[i] = 0.2 + Math.random() * 0.4;
        pool.vz[i] = (Math.random() - 0.5) * 0.8;
        pool.life[i] = 1.2 + Math.random();
        pool.size[i] = (0.045 + Math.random() * 0.05) * Math.min(1.3, s);
        break;
      default:
        pool.vx[i] = (Math.random() - 0.5) * 0.04;
        pool.vy[i] = 0.32 + Math.random() * 0.15;
        pool.vz[i] = (Math.random() - 0.5) * 0.04;
        pool.life[i] = 3.2 + Math.random() * 1.6;
        pool.size[i] = (0.06 + Math.random() * 0.03) * s;
    }
  }

  /** A burst of dust (construction, demolition, explosions). */
  burst(x: number, y: number, z: number, n = 12, s = 1, fire = false): void {
    for (let k = 0; k < n; k++) {
      this.spawn(this.smoke, Kind.Dust, x + (Math.random() - 0.5) * s, y, z + (Math.random() - 0.5) * s, s);
      if (fire && k % 2 === 0) this.spawn(this.flame, Kind.Fire, x + (Math.random() - 0.5) * s, y, z + (Math.random() - 0.5) * s, 1.5);
    }
  }

  update(dt: number, running: boolean): void {
    if (running) {
      for (let k = 0; k < this.emitters.length; k++) {
        const em = this.emitters[k];
        const kind = KIND_OF[em.kind];
        this.timers[k] += dt * RATE[kind];
        while (this.timers[k] >= 1) {
          this.timers[k] -= 1;
          if (kind === Kind.Fire) {
            this.spawn(this.flame, Kind.Fire, em.x, em.y, em.z, em.s);
            if (Math.random() < 0.35) this.spawn(this.smoke, Kind.Dark, em.x, em.y + 0.15, em.z, 1.4);
          } else {
            this.spawn(this.smoke, kind, em.x, em.y, em.z, em.s);
          }
        }
      }
      this.step(this.smoke, dt);
      this.step(this.flame, dt);
    }
    this.write(this.smoke);
    this.write(this.flame);
  }

  private step(p: Pool, dt: number): void {
    let i = 0;
    while (i < p.n) {
      p.age[i] += dt;
      if (p.age[i] >= p.life[i]) {
        const last = --p.n;
        if (i !== last) {
          p.px[i] = p.px[last];
          p.py[i] = p.py[last];
          p.pz[i] = p.pz[last];
          p.vx[i] = p.vx[last];
          p.vy[i] = p.vy[last];
          p.vz[i] = p.vz[last];
          p.age[i] = p.age[last];
          p.life[i] = p.life[last];
          p.size[i] = p.size[last];
          p.kind[i] = p.kind[last];
          p.rot[i] = p.rot[last];
        }
        continue;
      }
      const t = p.age[i] / p.life[i];
      const k = p.kind[i];
      const drift = k === Kind.Fire ? 0.2 : 1;
      p.px[i] += (p.vx[i] + this.wind.x * t * drift) * dt;
      p.py[i] += p.vy[i] * dt * (k === Kind.Fire ? 1 : 1 - t * 0.5);
      p.pz[i] += (p.vz[i] + this.wind.y * t * drift) * dt;
      if (k === Kind.Dust) p.vy[i] -= dt * 0.25;
      i++;
    }
  }

  private write(p: Pool): void {
    const mesh = p.mesh;
    for (let i = 0; i < p.n; i++) {
      const t = p.age[i] / p.life[i];
      const k = p.kind[i];
      let s: number;
      if (k === Kind.Fire) {
        s = p.size[i] * (1 - t) * (1 + Math.sin(p.rot[i] + t * 20) * 0.15);
        c1.setRGB(1, 0.85, 0.3);
        c2.setRGB(0.9, 0.2, 0.05);
        col.copy(c1).lerp(c2, t);
      } else {
        const grow = 0.5 + t * 2.2;
        const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
        s = p.size[i] * grow * fade;
        if (k === Kind.Steam) col.setRGB(0.92, 0.94, 0.96);
        else if (k === Kind.Dark) col.setRGB(0.18 + t * 0.2, 0.18 + t * 0.2, 0.19 + t * 0.2);
        else if (k === Kind.Dust) col.setRGB(0.72 + t * 0.15, 0.66 + t * 0.15, 0.56 + t * 0.15);
        else col.setRGB(0.42 + t * 0.35, 0.42 + t * 0.35, 0.44 + t * 0.35);
      }
      e.set(p.rot[i], p.rot[i] * 0.7, 0);
      q.setFromEuler(e);
      v.set(p.px[i], p.py[i], p.pz[i]);
      sc.set(s, s * (k === Kind.Fire ? 1.6 : 1), s);
      m4.compose(v, q, sc);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col);
    }
    mesh.count = p.n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.smoke.n = 0;
    this.flame.n = 0;
    this.emitters = [];
    this.timers = [];
  }
}
