import * as THREE from 'three';
import { LEVEL_H, type World } from '../sim/world';
import type { ModelMesh } from './geom';
import { modelToGeometry } from './meshUtil';
import { createBuildingMaterial } from './materials';
import { rotPlacement } from './buffers';
import { curvePoint, curveTangent, roughLength, type Curve } from '../sim/tracks/geom';

export interface PreviewTile {
  x: number;
  y: number;
  color: number;
}

/** A translucent band along track curves (planned roads, rails and highways, guide lines). */
export interface PreviewRibbon {
  curves: Curve[];
  /** Half width. */
  hw: number;
  color: number;
  /** Float at highway deck height instead of on the ground. */
  elevated?: boolean;
}

const OFFSET = 0.055;

/** Tool feedback: translucent tile highlights and a ghost building. */
export class Preview {
  readonly group = new THREE.Group();
  private tiles: THREE.Mesh;
  private ribbons: THREE.Mesh;
  private ghost: THREE.Mesh;
  private ghostMat: THREE.MeshLambertMaterial;
  private ghostKey = '';

  constructor(private world: World) {
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.tiles = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.tiles.renderOrder = 5;
    this.tiles.frustumCulled = false;
    this.ribbons = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ribbons.renderOrder = 6;
    this.ribbons.frustumCulled = false;
    this.ghostMat = createBuildingMaterial({ transparent: true, opacity: 0.7 });
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat);
    this.ghost.visible = false;
    this.ghost.renderOrder = 6;
    this.group.add(this.tiles, this.ribbons, this.ghost);
  }

  setWorld(world: World): void {
    this.world = world;
  }

  showTiles(list: PreviewTile[]): void {
    const w = this.world;
    const pos = new Float32Array(list.length * 18);
    const col = new Float32Array(list.length * 18);
    const c = new THREE.Color();
    let o = 0;
    for (const t of list) {
      if (!w.inBounds(t.x, t.y)) continue;
      const [h00, h10, h11, h01] = w.tileCorners(t.x, t.y);
      const water = w.isWater(t.x, t.y);
      const wy = w.seaLevel * LEVEL_H;
      const Y = (h: number) => (water ? Math.max(h * LEVEL_H, wy) : h * LEVEL_H) + OFFSET;
      const x0 = t.x + 0.03;
      const x1 = t.x + 0.97;
      const z0 = t.y + 0.03;
      const z1 = t.y + 0.97;
      const v = [
        [x0, Y(h00), z0],
        [x0, Y(h01), z1],
        [x1, Y(h11), z1],
        [x0, Y(h00), z0],
        [x1, Y(h11), z1],
        [x1, Y(h10), z0],
      ];
      c.setHex(t.color);
      for (const p of v) {
        pos[o] = p[0];
        pos[o + 1] = p[1];
        pos[o + 2] = p[2];
        col[o] = c.r;
        col[o + 1] = c.g;
        col[o + 2] = c.b;
        o += 3;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o), 3));
    g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, o), 3));
    this.tiles.geometry.dispose();
    this.tiles.geometry = g;
  }

  showRibbons(list: PreviewRibbon[]): void {
    const w = this.world;
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    const height = (x: number, z: number, elevated: boolean) => {
      const tx = Math.min(w.w - 1, Math.max(0, Math.floor(x)));
      const tz = Math.min(w.h - 1, Math.max(0, Math.floor(z)));
      if (elevated) return Math.max(w.tileMax(tx, tz), w.seaLevel) * LEVEL_H + 0.76;
      return Math.max(w.surfaceY(Math.min(w.w, Math.max(0, x)), Math.min(w.h, Math.max(0, z))), w.seaLevel * LEVEL_H + 0.03) + 0.07;
    };
    for (const r of list) {
      c.setHex(r.color);
      for (const q of r.curves) {
        const n = Math.max(2, Math.ceil(roughLength(q) / 0.2) + 1);
        let prev: number[] | null = null;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const [x, z] = curvePoint(q, t);
          const [tx, tz] = curveTangent(q, t);
          const lx = x - tz * r.hw;
          const lz = z + tx * r.hw;
          const rx = x + tz * r.hw;
          const rz = z - tx * r.hw;
          const cur = [lx, height(lx, lz, !!r.elevated), lz, rx, height(rx, rz, !!r.elevated), rz];
          if (prev) {
            pos.push(...prev.slice(0, 3), ...prev.slice(3), ...cur.slice(3));
            pos.push(...prev.slice(0, 3), ...cur.slice(3), ...cur.slice(0, 3));
            for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
          }
          prev = cur;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.ribbons.geometry.dispose();
    this.ribbons.geometry = g;
  }

  /** Show a ghost model with its (unrotated) footprint dims dw×dh at tile (x,y). */
  showGhost(mesh: ModelMesh | null, key: string, x: number, y: number, rot: number, dw: number, dh: number, ok: boolean): void {
    if (!mesh) {
      this.ghost.visible = false;
      return;
    }
    if (key !== this.ghostKey) {
      this.ghost.geometry.dispose();
      this.ghost.geometry = modelToGeometry(mesh);
      this.ghostKey = key;
    }
    const w = this.world;
    const fw = rot % 2 ? dh : dw;
    const fh = rot % 2 ? dw : dh;
    const cx = Math.max(0, Math.min(w.w - fw, x));
    const cy = Math.max(0, Math.min(w.h - fh, y));
    const base = w.footprintMax(cx, cy, fw, fh) * LEVEL_H + 0.01;
    const pl = rotPlacement(rot, dw, dh, x, base, y);
    this.ghost.matrixAutoUpdate = false;
    this.ghost.matrix.set(pl.a, 0, pl.b, pl.tx, 0, 1, 0, pl.ty, pl.c, 0, pl.d, pl.tz, 0, 0, 0, 1);
    this.ghost.matrixWorldNeedsUpdate = true;
    this.ghostMat.color.setHex(ok ? 0xbfffbf : 0xff7a7a);
    this.ghost.visible = true;
  }

  clear(): void {
    this.showTiles([]);
    this.showRibbons([]);
    this.ghost.visible = false;
  }
}
