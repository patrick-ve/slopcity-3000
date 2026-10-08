import * as THREE from 'three';
import type { Disasters } from '../sim/disasters';
import type { World } from '../sim/world';
import type { Particles } from './particles';

/** Visuals for moving disasters: tornado funnel and falling meteors. */
export class Effects {
  readonly group = new THREE.Group();
  private funnel: THREE.Mesh;
  private meteors: THREE.Mesh[] = [];
  private meteorGeo = new THREE.DodecahedronGeometry(0.35, 0);
  private meteorMat = new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false });
  private debrisAcc = 0;

  constructor(private world: World) {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector2(0.12 + t * t * 1.4, t * 4.2));
    }
    const geo = new THREE.LatheGeometry(pts, 9);
    const mat = new THREE.MeshLambertMaterial({
      color: 0x8a8f96,
      transparent: true,
      opacity: 0.78,
      flatShading: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.funnel = new THREE.Mesh(geo, mat);
    this.funnel.visible = false;
    this.group.add(this.funnel);
  }

  setWorld(world: World): void {
    this.world = world;
  }

  update(dt: number, d: Disasters, particles: Particles, time: number): void {
    const t = d.tornado;
    if (t) {
      const y = this.world.surfaceY(Math.min(this.world.w - 0.01, Math.max(0, t.x)), Math.min(this.world.h - 0.01, Math.max(0, t.y)));
      this.funnel.visible = true;
      this.funnel.position.set(t.x, y, t.y);
      this.funnel.rotation.y = time * 6;
      this.funnel.scale.setScalar(Math.min(1, t.life / 2, (22 - t.life) / 1.5 + 0.2));
      this.debrisAcc += dt * 14;
      while (this.debrisAcc >= 1) {
        this.debrisAcc -= 1;
        particles.burst(t.x, y + 0.1, t.y, 1, 0.8);
      }
    } else {
      this.funnel.visible = false;
    }
    // meteors
    while (this.meteors.length < d.meteors.length) {
      const m = new THREE.Mesh(this.meteorGeo, this.meteorMat);
      this.group.add(m);
      this.meteors.push(m);
    }
    for (let i = 0; i < this.meteors.length; i++) {
      const mesh = this.meteors[i];
      const m = d.meteors[i];
      if (!m) {
        if (mesh.visible) {
          mesh.visible = false;
        }
        continue;
      }
      const f = Math.max(0, m.t / m.total);
      const gy = this.world.surfaceY(Math.min(this.world.w - 0.01, m.x), Math.min(this.world.h - 0.01, m.y));
      mesh.visible = true;
      mesh.position.set(m.x - f * 18, gy + f * 30, m.y - f * 10);
      mesh.rotation.set(time * 3, time * 2, 0);
      particles.burst(mesh.position.x, mesh.position.y, mesh.position.z, 1, 0.4, true);
      if (m.t <= dt * 1.5) particles.burst(m.x, gy + 0.2, m.y, 40, 2.5, true);
    }
  }
}
