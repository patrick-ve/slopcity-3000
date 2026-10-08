import * as THREE from 'three';
import type { Sim } from '../sim/sim';
import { getDef } from '../sim/catalog';
import { CHUNK, DIRTY_GROUND, DIRTY_OBJECTS, DIRTY_PIPES, LEVEL_H } from '../sim/world';
import { needsPower, needsWater } from '../sim/util';
import { ROAD_REACH } from '../sim/networks';
import { CameraController } from './camera';
import { buildGround, buildSkirt, waterY } from './ground';
import { buildObjects, buildPipes, type EmitterInst, type RotorInst } from './objects';
import { createBuildingMaterial, createPlainMaterial, createTerrainMaterial, shared } from './materials';
import { Water } from './water';
import { Sky } from './sky';
import { fillOverlay, fillTiles, OVERLAYS, type OverlayId } from './overlays';
import { Particles } from './particles';
import { Cars, HIGHWAYS } from './cars';
import { ICON, Icons } from './icons';
import { Rotors } from './rotors';
import { Preview } from './preview';
import { Effects } from './fx';
import { Trains } from './trains';
import { pickTerrain, type PickResult } from './picker';

interface Chunk {
  ground: THREE.Mesh | null;
  objects: THREE.Mesh | null;
  trees: THREE.Mesh | null;
  pipes: THREE.Mesh | null;
  emitters: EmitterInst[];
  rotors: RotorInst[];
  tops: Map<number, number>;
}

export type ShadowQuality = 'off' | 'low' | 'high';

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly cam = new CameraController();
  readonly sky: Sky;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly particles = new Particles();
  readonly icons = new Icons();
  readonly rotors = new Rotors();
  preview!: Preview;
  private effects!: Effects;
  private cars!: Cars;
  private hwyCars!: Cars;
  private trains!: Trains;
  private water!: Water;
  private skirt: THREE.Mesh | null = null;
  private chunks: Chunk[] = [];
  private groundMat = createTerrainMaterial();
  private objectMat = createBuildingMaterial();
  private pipeMat = createBuildingMaterial();
  private skirtMat = createPlainMaterial();
  private chunkGroup = new THREE.Group();
  private sim: Sim | null = null;
  private tileTex: THREE.DataTexture | null = null;
  private overlayTex: THREE.DataTexture | null = null;
  private heightTex: THREE.DataTexture | null = null;
  overlay: OverlayId = 'none';
  private overlayTimer = 0;
  underground = false;
  private iconTimer = 0;
  private emittersDirty = true;
  private time = 0;
  private width = 1;
  private height = 1;
  shadowQuality: ShadowQuality = 'high';
  /** Trees cast shadows only when the camera is reasonably close. */
  private treeShadows = true;
  showGrid = false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x76664e, 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3e0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 2;
    this.scene.add(this.sun, this.sun.target);
    this.sky = new Sky(this.sun, this.hemi, container);

    this.scene.add(this.chunkGroup);
    this.scene.add(this.particles.group);
    this.scene.add(this.icons.mesh);
    this.scene.add(this.rotors.mesh);
    this.pipeMat.depthTest = true;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  resize(): void {
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(this.width, this.height);
    this.cam.resize(this.width, this.height);
  }

  // ----------------------------------------------------------------- world

  setSim(sim: Sim): void {
    this.sim = sim;
    const world = sim.world;
    // dispose old
    for (const c of this.chunks) this.disposeChunk(c);
    this.chunks = [];
    this.chunkGroup.clear();
    if (this.skirt) {
      this.skirt.geometry.dispose();
      this.scene.remove(this.skirt);
    }
    if (this.water) {
      this.water.mesh.geometry.dispose();
      (this.water.mesh.material as THREE.Material).dispose();
      this.scene.remove(this.water.mesh);
    }
    for (const c of [this.cars, this.hwyCars]) {
      if (!c) continue;
      c.mesh.geometry.dispose();
      this.scene.remove(c.mesh);
    }
    if (this.trains) {
      this.trains.dispose();
      this.scene.remove(this.trains.group);
    }
    if (this.preview) this.scene.remove(this.preview.group);
    if (this.effects) this.scene.remove(this.effects.group);
    this.particles.clear();

    for (let i = 0; i < world.chunksX * world.chunksY; i++) {
      this.chunks.push({ ground: null, objects: null, trees: null, pipes: null, emitters: [], rotors: [], tops: new Map() });
    }
    shared.uMapSize.value.set(world.w, world.h);
    shared.uLevelH.value = LEVEL_H;
    shared.uSeaY.value = waterY(world);
    this.tileTex?.dispose();
    this.overlayTex?.dispose();
    this.heightTex?.dispose();
    this.tileTex = new THREE.DataTexture(new Uint8Array(world.size * 4), world.w, world.h, THREE.RGBAFormat);
    this.tileTex.colorSpace = THREE.SRGBColorSpace;
    this.tileTex.magFilter = THREE.NearestFilter;
    this.tileTex.minFilter = THREE.NearestFilter;
    this.tileTex.flipY = false;
    shared.uTiles.value = this.tileTex;
    this.overlayTex = new THREE.DataTexture(new Uint8Array(world.size * 4), world.w, world.h, THREE.RGBAFormat);
    this.overlayTex.colorSpace = THREE.SRGBColorSpace;
    this.overlayTex.flipY = false;
    shared.uOverlay.value = this.overlayTex;
    this.heightTex = new THREE.DataTexture(new Uint8Array((world.w + 1) * (world.h + 1)), world.w + 1, world.h + 1, THREE.RedFormat);
    this.heightTex.magFilter = THREE.LinearFilter;
    this.heightTex.minFilter = THREE.LinearFilter;
    this.heightTex.flipY = false;
    shared.uHeights.value = this.heightTex;

    this.water = new Water(world);
    this.scene.add(this.water.mesh);
    this.cars = new Cars(world);
    this.scene.add(this.cars.mesh);
    this.hwyCars = new Cars(world, HIGHWAYS);
    this.scene.add(this.hwyCars.mesh);
    this.trains = new Trains(world);
    this.scene.add(this.trains.group);
    this.preview = new Preview(world);
    this.scene.add(this.preview.group);
    this.effects = new Effects(world);
    this.scene.add(this.effects.group);
    this.cam.setWorld(world);
    this.cam.goalTarget.set(world.w / 2, 0, world.h / 2);
    this.cam.goalZoom = Math.min(world.w, world.h) * 0.32;
    this.cam.snap();
    world.markAllDirty();
    this.rebuildSkirt();
    this.updateHeights();
    this.flush(true);
    this.setOverlay(this.overlay);
  }

  private disposeChunk(c: Chunk): void {
    for (const m of [c.ground, c.objects, c.trees, c.pipes]) {
      if (m) {
        m.geometry.dispose();
        this.chunkGroup.remove(m);
      }
    }
  }

  private rebuildSkirt(): void {
    const world = this.sim!.world;
    if (this.skirt) {
      this.skirt.geometry.dispose();
      this.scene.remove(this.skirt);
    }
    this.skirt = new THREE.Mesh(buildSkirt(world).toGeometry(), this.skirtMat);
    this.skirt.receiveShadow = true;
    this.scene.add(this.skirt);
  }

  private updateHeights(): void {
    const world = this.sim!.world;
    const data = this.heightTex!.image.data as Uint8Array;
    data.set(world.heights);
    this.heightTex!.needsUpdate = true;
  }

  /** Rebuild dirty chunks; `all` rebuilds everything immediately. */
  private flush(all = false): void {
    const sim = this.sim;
    if (!sim) return;
    const world = sim.world;
    if (world.heightsDirty) {
      world.heightsDirty = false;
      this.updateHeights();
      this.rebuildSkirt();
      this.water.rebuild();
    }
    if (world.tilesDirty) {
      world.tilesDirty = false;
      fillTiles(sim, this.tileTex!.image.data as Uint8Array);
      this.tileTex!.needsUpdate = true;
    }
    if (!world.dirtyChunks.size) return;
    // nearest chunks to the camera target first
    const keys = [...world.dirtyChunks.keys()];
    const tx = this.cam.target.x / CHUNK;
    const tz = this.cam.target.z / CHUNK;
    keys.sort((a, b) => {
      const ax = (a % world.chunksX) + 0.5 - tx;
      const az = Math.floor(a / world.chunksX) + 0.5 - tz;
      const bx = (b % world.chunksX) + 0.5 - tx;
      const bz = Math.floor(b / world.chunksX) + 0.5 - tz;
      return ax * ax + az * az - (bx * bx + bz * bz);
    });
    const budget = all ? keys.length : 4;
    for (let k = 0; k < Math.min(budget, keys.length); k++) {
      const key = keys[k];
      const flags = world.dirtyChunks.get(key)!;
      world.dirtyChunks.delete(key);
      this.rebuildChunk(key, flags);
    }
  }

  private rebuildChunk(key: number, flags: number): void {
    const world = this.sim!.world;
    const cx = key % world.chunksX;
    const cy = Math.floor(key / world.chunksX);
    const c = this.chunks[key];
    if (flags & DIRTY_GROUND) {
      if (c.ground) {
        c.ground.geometry.dispose();
        this.chunkGroup.remove(c.ground);
      }
      const buf = buildGround(world, cx, cy);
      c.ground = new THREE.Mesh(buf.toGeometry(), this.groundMat);
      c.ground.receiveShadow = true;
      c.ground.castShadow = true;
      this.chunkGroup.add(c.ground);
    }
    if (flags & DIRTY_OBJECTS) {
      for (const m of [c.objects, c.trees]) {
        if (!m) continue;
        m.geometry.dispose();
        this.chunkGroup.remove(m);
      }
      const res = buildObjects(world, cx, cy);
      c.objects = new THREE.Mesh(res.buf.toGeometry(), this.objectMat);
      c.objects.castShadow = true;
      c.objects.receiveShadow = true;
      c.objects.visible = !this.underground;
      c.trees = null;
      if (res.trees.count) {
        c.trees = new THREE.Mesh(res.trees.toGeometry(), this.objectMat);
        c.trees.castShadow = this.treeShadows;
        c.trees.receiveShadow = true;
        c.trees.visible = !this.underground;
        this.chunkGroup.add(c.trees);
      }
      c.emitters = res.emitters;
      c.rotors = res.rotors;
      c.tops = res.tops;
      this.chunkGroup.add(c.objects);
      this.emittersDirty = true;
    }
    if (flags & DIRTY_PIPES) {
      if (c.pipes) {
        c.pipes.geometry.dispose();
        this.chunkGroup.remove(c.pipes);
      }
      const buf = buildPipes(world, cx, cy, this.sim!.subwayLive);
      c.pipes = buf.count ? new THREE.Mesh(buf.toGeometry(), this.pipeMat) : null;
      if (c.pipes) {
        c.pipes.visible = this.underground;
        this.chunkGroup.add(c.pipes);
      }
    }
  }

  // ------------------------------------------------------------- overlays

  setOverlay(id: OverlayId): void {
    this.overlay = id;
    shared.uOverlayAmt.value = id === 'none' ? 0 : 0.78;
    const def = OVERLAYS.find((o) => o.id === id);
    if (this.overlayTex) {
      const smooth = def?.smooth ?? false;
      this.overlayTex.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
      this.overlayTex.minFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
    }
    this.refreshOverlay();
  }

  refreshOverlay(): void {
    if (!this.sim || !this.overlayTex) return;
    const id = this.underground ? 'water' : this.overlay;
    fillOverlay(this.sim, id, this.overlayTex.image.data as Uint8Array);
    this.overlayTex.needsUpdate = true;
    shared.uOverlayAmt.value = id === 'none' ? 0 : this.underground ? 0.55 : 0.78;
  }

  setUnderground(on: boolean): void {
    this.underground = on;
    shared.uUnder.value = on ? 1 : 0;
    for (const c of this.chunks) {
      if (c.objects) c.objects.visible = !on;
      if (c.trees) c.trees.visible = !on;
      if (c.pipes) c.pipes.visible = on;
    }
    this.cars.mesh.visible = !on;
    this.hwyCars.mesh.visible = !on;
    this.trains.group.visible = !on;
    this.particles.group.visible = !on;
    this.rotors.mesh.visible = !on;
    this.water.mesh.visible = !on;
    if (on && this.sim) {
      const w = this.sim.world;
      for (let k = 0; k < w.chunksX * w.chunksY; k++) w.dirtyChunks.set(k, (w.dirtyChunks.get(k) ?? 0) | DIRTY_PIPES);
    }
    this.refreshOverlay();
  }

  setGrid(on: boolean): void {
    this.showGrid = on;
    shared.uGrid.value = on ? 1 : 0;
  }

  setShadows(q: ShadowQuality): void {
    this.shadowQuality = q;
    this.renderer.shadowMap.enabled = q !== 'off';
    this.sun.castShadow = q !== 'off';
    const size = q === 'high' ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
  }

  // ------------------------------------------------------------------ icons

  private rebuildIcons(): void {
    const sim = this.sim!;
    const w = sim.world;
    const list: { x: number; y: number; z: number; icon: number }[] = [];
    const tops = new Map<number, number>();
    for (const c of this.chunks) for (const [k, v] of c.tops) tops.set(k, v);
    // water icons only once the city has started a water system (or the water view is open)
    const showWater = sim.stats.waterSupply > 0 || this.underground || this.overlay === 'water';
    for (const b of w.buildings.values()) {
      if (b.build > 0 || b.abandoned) continue;
      const def = getDef(b.def);
      let icon = -1;
      if (b.fire > 0) icon = ICON.FIRE;
      else if (needsPower(def) && !b.powered) icon = ICON.POWER;
      else if (showWater && needsWater(def) && !b.watered && (def.growable ? b.pop > 0 : true)) icon = ICON.WATER;
      else if (def.growable) {
        let rd = 255;
        for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) rd = Math.min(rd, w.roadDist[w.idx(x, y)]);
        if (rd > ROAD_REACH) icon = ICON.ROAD;
      }
      if (icon < 0) continue;
      const top = tops.get(b.id) ?? w.footprintMax(b.x, b.y, b.w, b.h) * LEVEL_H + 0.5;
      list.push({ x: b.x + b.w / 2, y: top + 0.35, z: b.y + b.h / 2, icon });
    }
    // SC-style lightning bolts over unpowered zones (sparse pattern to avoid clutter)
    for (let y = 0; y < w.h; y += 2) {
      for (let x = (y >> 1) & 1; x < w.w; x += 3) {
        const i = w.idx(x, y);
        const z = w.zone[i];
        if (z < 1 || z > 3 || w.bld[i] || w.powered[i]) continue;
        list.push({ x: x + 0.5, y: w.tileMax(x, y) * LEVEL_H + 0.45, z: y + 0.5, icon: ICON.POWER });
      }
    }
    this.icons.set(list);
    this.icons.mesh.visible = !this.underground;
  }

  // --------------------------------------------------------------- picking

  pick(sx: number, sy: number): PickResult | null {
    if (!this.sim) return null;
    const rect = this.canvas.getBoundingClientRect();
    return pickTerrain(this.sim.world, this.cam.camera, sx - rect.left, sy - rect.top, rect.width, rect.height);
  }

  /** Screen position of a world point (for UI anchors). */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.cam.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height };
  }

  // ------------------------------------------------------------------ frame

  private updateShadowCamera(): void {
    const sun = this.sun;
    const t = this.cam.target;
    const dir = this.sky.sunDir;
    const ext = Math.max(8, this.cam.zoom * 1.9);
    const cam = sun.shadow.camera;
    // snap the centre to shadow texels to avoid shimmering
    const texel = (ext * 2) / sun.shadow.mapSize.x;
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const upv = new THREE.Vector3().crossVectors(dir, right).normalize();
    const cr = Math.round(t.dot(right) / texel) * texel;
    const cu = Math.round(t.dot(upv) / texel) * texel;
    const cd = t.dot(dir);
    const centre = right.multiplyScalar(cr).add(upv.multiplyScalar(cu)).add(dir.clone().multiplyScalar(cd));
    sun.target.position.copy(centre);
    sun.position.copy(centre).addScaledVector(dir, 120);
    cam.left = -ext;
    cam.right = ext;
    cam.top = ext;
    cam.bottom = -ext;
    cam.near = 1;
    cam.far = 300;
    cam.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
  }

  update(dt: number): void {
    const sim = this.sim;
    if (!sim) return;
    const running = sim.speed > 0;
    this.time += dt;
    shared.uTime.value = this.time;
    this.cam.shake = Math.max(this.cam.shake, sim.disasters.shake > 0 ? 0.6 : 0);
    this.cam.update(dt);
    this.sky.update(dt, running);
    this.flush(false);
    if (this.emittersDirty) {
      this.emittersDirty = false;
      const em: EmitterInst[] = [];
      const ro: RotorInst[] = [];
      for (const c of this.chunks) {
        em.push(...c.emitters);
        ro.push(...c.rotors);
      }
      this.particles.setEmitters(em);
      this.rotors.set(ro);
      this.iconTimer = 0;
    }
    this.particles.update(dt, running);
    this.cars.update(dt, running);
    this.hwyCars.update(dt, running);
    this.trains.update(dt, running);
    this.rotors.update(dt, running);
    this.effects.update(dt, sim.disasters, this.particles, this.time);
    this.iconTimer -= dt;
    if (this.iconTimer <= 0) {
      this.iconTimer = 0.5;
      this.rebuildIcons();
    }
    this.icons.update(this.time, this.cam.zoom);
    this.overlayTimer -= dt;
    if ((this.overlay !== 'none' || this.underground) && this.overlayTimer <= 0) {
      this.overlayTimer = 1;
      this.refreshOverlay();
    }
    const wantTreeShadows = this.cam.zoom < 30;
    if (wantTreeShadows !== this.treeShadows) {
      this.treeShadows = wantTreeShadows;
      for (const c of this.chunks) if (c.trees) c.trees.castShadow = wantTreeShadows;
    }
    this.updateShadowCamera();
  }

  render(): void {
    this.renderer.render(this.scene, this.cam.camera);
  }

  /** Dust burst when something is built or demolished. */
  dust(x: number, z: number, size: number): void {
    const w = this.sim?.world;
    if (!w) return;
    const y = w.surfaceY(Math.min(w.w - 0.01, x), Math.min(w.h - 0.01, z));
    this.particles.burst(x, y + 0.05, z, Math.round(6 + size * 6), size);
  }

  info(): { calls: number; triangles: number; geometries: number } {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries };
  }
}
