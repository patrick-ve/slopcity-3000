import * as THREE from 'three';
import type { World } from '../sim/world';

const DIST = 400;

/**
 * Orthographic city camera: target on the ground, yaw/pitch orbit, zoom as
 * the half-height of the view in world units. All values ease toward goals.
 */
export class CameraController {
  readonly camera: THREE.OrthographicCamera;
  target = new THREE.Vector3();
  goalTarget = new THREE.Vector3();
  yaw = Math.PI / 4;
  goalYaw = Math.PI / 4;
  pitch = 0.66;
  goalPitch = 0.66;
  zoom = 24;
  goalZoom = 24;
  minZoom = 3.5;
  maxZoom = 120;
  shake = 0;
  private aspect = 1;
  private world: World | null = null;

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  }

  setWorld(world: World): void {
    this.world = world;
    this.maxZoom = Math.max(world.w, world.h) * 0.75;
  }

  resize(w: number, h: number): void {
    this.aspect = w / Math.max(1, h);
  }

  /** Jump to a position without easing. */
  snap(): void {
    this.target.copy(this.goalTarget);
    this.yaw = this.goalYaw;
    this.pitch = this.goalPitch;
    this.zoom = this.goalZoom;
  }

  lookAt(x: number, z: number, zoom?: number): void {
    this.goalTarget.set(x, this.goalTarget.y, z);
    if (zoom !== undefined) this.goalZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
  }

  /** Pan in screen-aligned ground directions (world units). */
  pan(right: number, forward: number): void {
    const sx = Math.cos(this.yaw);
    const sz = -Math.sin(this.yaw);
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    this.goalTarget.x += sx * right + fx * forward;
    this.goalTarget.z += sz * right + fz * forward;
    this.clamp();
  }

  rotate(delta: number): void {
    this.goalYaw += delta;
  }

  /** Rotate by a quarter turn and snap to the 45° diagonals SC-style. */
  rotateQuarter(dir: 1 | -1): void {
    const step = Math.PI / 2;
    const base = Math.round((this.goalYaw - Math.PI / 4) / step) * step + Math.PI / 4;
    this.goalYaw = base + dir * step;
  }

  tilt(delta: number): void {
    this.goalPitch = Math.max(0.35, Math.min(1.35, this.goalPitch + delta));
  }

  zoomBy(factor: number): void {
    this.goalZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.goalZoom * factor));
  }

  private clamp(): void {
    if (!this.world) return;
    const m = 2;
    this.goalTarget.x = Math.max(-m, Math.min(this.world.w + m, this.goalTarget.x));
    this.goalTarget.z = Math.max(-m, Math.min(this.world.h + m, this.goalTarget.z));
  }

  update(dt: number): void {
    const k = 1 - Math.pow(0.0001, dt); // ease factor
    if (this.world) {
      const w = this.world;
      const gx = Math.max(0, Math.min(w.w - 0.001, this.goalTarget.x));
      const gz = Math.max(0, Math.min(w.h - 0.001, this.goalTarget.z));
      this.goalTarget.y = Math.max(w.surfaceY(gx, gz), w.seaLevel * 0.25);
    }
    this.target.lerp(this.goalTarget, k);
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.pitch += (this.goalPitch - this.pitch) * k;
    this.zoom += (this.goalZoom - this.zoom) * k;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    this.apply();
  }

  apply(): void {
    const cam = this.camera;
    const t = this.target.clone();
    if (this.shake > 0) {
      const a = Math.min(1, this.shake) * 0.25;
      t.x += (Math.random() - 0.5) * a;
      t.z += (Math.random() - 0.5) * a;
      t.y += (Math.random() - 0.5) * a * 0.5;
    }
    const cp = Math.cos(this.pitch);
    cam.position.set(t.x + cp * Math.sin(this.yaw) * DIST, t.y + Math.sin(this.pitch) * DIST, t.z + cp * Math.cos(this.yaw) * DIST);
    cam.lookAt(t);
    cam.left = -this.zoom * this.aspect;
    cam.right = this.zoom * this.aspect;
    cam.top = this.zoom;
    cam.bottom = -this.zoom;
    cam.near = 1;
    cam.far = DIST * 2 + 200;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** World units per screen pixel (for drag panning). */
  unitsPerPixel(viewHeightPx: number): number {
    return (this.zoom * 2) / Math.max(1, viewHeightPx);
  }
}
