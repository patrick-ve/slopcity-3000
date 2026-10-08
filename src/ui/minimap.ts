import { NET } from '../sim/types';
import type { Sim } from '../sim/sim';
import { fillOverlay, type OverlayId } from '../render/overlays';
import type { CameraController } from '../render/camera';
import { h } from '../util/dom';

const ZONE_RGB = [
  [0, 0, 0],
  [99, 212, 113],
  [90, 169, 255],
  [255, 201, 77],
  [160, 122, 76],
];

/** Top-down overview map; click or drag to move the camera. */
export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData | null = null;
  private overlay = new Uint8Array(0);
  private dragging = false;

  constructor(private getSim: () => Sim | null, private cam: CameraController, private size = 178) {
    this.canvas = h('canvas', { class: 'minimap', width: size, height: size }) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    const go = (e: PointerEvent) => {
      const sim = this.getSim();
      if (!sim) return;
      const r = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * sim.world.w;
      const z = ((e.clientY - r.top) / r.height) * sim.world.h;
      this.cam.lookAt(x, z);
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      go(e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.dragging) go(e);
    });
    this.canvas.addEventListener('pointerup', () => (this.dragging = false));
  }

  draw(overlay: OverlayId): void {
    const sim = this.getSim();
    if (!sim) return;
    const w = sim.world;
    if (!this.img || this.img.width !== w.w) {
      this.img = new ImageData(w.w, w.h);
      this.overlay = new Uint8Array(w.size * 4);
    }
    const d = this.img.data;
    if (overlay !== 'none') fillOverlay(sim, overlay, this.overlay);
    const sea = w.seaLevel;
    for (let y = 0; y < w.h; y++) {
      for (let x = 0; x < w.w; x++) {
        const i = y * w.w + x;
        let r: number;
        let g: number;
        let b: number;
        if (w.isWater(x, y)) {
          const depth = Math.min(1, (sea - w.tileMin(x, y)) / 4);
          r = 50 - depth * 20;
          g = 140 - depth * 50;
          b = 180 - depth * 30;
        } else {
          const e = Math.min(1, (w.tileMax(x, y) - sea) / 14);
          r = 120 - e * 30;
          g = 170 - e * 40;
          b = 80 - e * 20;
          if (w.tree[i]) {
            r -= 30;
            g -= 25;
            b -= 20;
          }
          const z = w.zone[i];
          if (z) {
            const c = ZONE_RGB[z];
            const k = w.bld[i] ? 0.85 : 0.45;
            r = r * (1 - k) + c[0] * k;
            g = g * (1 - k) + c[1] * k;
            b = b * (1 - k) + c[2] * k;
            if (w.bld[i]) {
              r *= 0.8;
              g *= 0.8;
              b *= 0.8;
            }
          } else if (w.bld[i]) {
            r = 200;
            g = 196;
            b = 186;
          }
        }
        if (w.net[i] & NET.ROAD) {
          r = 55;
          g = 58;
          b = 64;
        } else if (w.net[i] & NET.RAIL) {
          r = 120;
          g = 100;
          b = 80;
        }
        if (overlay !== 'none') {
          const a = this.overlay[i * 4 + 3] / 255;
          r = r * (1 - a) + this.overlay[i * 4] * a;
          g = g * (1 - a) + this.overlay[i * 4 + 1] * a;
          b = b * (1 - a) + this.overlay[i * 4 + 2] * a;
        }
        d[i * 4] = r;
        d[i * 4 + 1] = g;
        d[i * 4 + 2] = b;
        d[i * 4 + 3] = 255;
      }
    }
    const tmp = document.createElement('canvas');
    tmp.width = w.w;
    tmp.height = w.h;
    tmp.getContext('2d')!.putImageData(this.img, 0, 0);
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.drawImage(tmp, 0, 0, this.size, this.size);
    this.drawView();
  }

  /** Outline of the visible ground area. */
  private drawView(): void {
    const sim = this.getSim();
    if (!sim) return;
    const w = sim.world;
    const cam = this.cam;
    const sx = this.size / w.w;
    const sz = this.size / w.h;
    const aspect = (cam.camera.right - cam.camera.left) / (cam.camera.top - cam.camera.bottom);
    const hw = cam.zoom * aspect;
    const hh = cam.zoom / Math.sin(cam.pitch);
    const cx = cam.target.x;
    const cz = cam.target.z;
    const rx = Math.cos(cam.yaw);
    const rz = -Math.sin(cam.yaw);
    const fx = -Math.sin(cam.yaw);
    const fz = -Math.cos(cam.yaw);
    const pts = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ].map(([a, b]) => [(cx + rx * a + fx * b) * sx, (cz + rz * a + fz * b) * sz]);
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  }
}
