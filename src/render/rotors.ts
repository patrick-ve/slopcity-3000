import * as THREE from 'three';
import { getModel } from './models';
import { modelToGeometry } from './meshUtil';
import { createBuildingMaterial } from './materials';
import type { RotorInst } from './objects';

const MAX = 600;
const m4 = new THREE.Matrix4();
const rot = new THREE.Matrix4();
const spin = new THREE.Matrix4();
const scl = new THREE.Matrix4();

/** Spinning wind-turbine blades (instanced). */
export class Rotors {
  readonly mesh: THREE.InstancedMesh;
  private list: RotorInst[] = [];
  private angle = 0;

  constructor() {
    const geo = modelToGeometry(getModel({ model: 'rotor_blades', w: 1, h: 1 }));
    this.mesh = new THREE.InstancedMesh(geo, createBuildingMaterial(), MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
  }

  set(list: RotorInst[]): void {
    this.list = list.slice(0, MAX);
  }

  update(dt: number, running: boolean): void {
    if (running) this.angle += dt * 2.4;
    for (let i = 0; i < this.list.length; i++) {
      const r = this.list[i];
      m4.makeTranslation(r.x, r.y, r.z);
      rot.makeRotationY(r.yaw);
      spin.makeRotationZ(this.angle + i * 0.7);
      scl.makeScale(r.r, r.r, r.r);
      m4.multiply(rot).multiply(spin).multiply(scl);
      this.mesh.setMatrixAt(i, m4);
    }
    this.mesh.count = this.list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
