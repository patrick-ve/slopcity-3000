import type { Game } from './game';

interface Point {
  x: number;
  y: number;
}

interface Shape {
  /** Centroid of all touches (screen pixels). */
  cx: number;
  cy: number;
  /** Distance and angle between the first two touches. */
  dist: number;
  angle: number;
}

/** Movement (screen pixels) before a touch counts as a drag instead of a tap. */
const TAP_SLOP = 8;

/**
 * Touch gestures for the 3D view:
 * - one finger uses the current tool (with the query tool it pans, and a tap inspects),
 * - two fingers pan, pinch to zoom and twist to rotate,
 * - three fingers drag up or down to tilt.
 */
export class TouchGestures {
  private pts = new Map<number, Point>();
  private mode: 'none' | 'tool' | 'pan' | 'multi' | 'done' = 'none';
  private start: Point = { x: 0, y: 0 };
  private moved = false;
  private last: Shape | null = null;

  constructor(
    private game: Game,
    private canvas: HTMLCanvasElement,
    private panBy: (dx: number, dy: number) => void,
    private zoomAt: (factor: number, sx: number, sy: number) => void,
  ) {}

  /** True while at least one finger touches the view. */
  get active(): boolean {
    return this.pts.size > 0;
  }

  down(e: PointerEvent): void {
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this.game;
    if (this.pts.size === 1) {
      this.start = { x: e.clientX, y: e.clientY };
      this.moved = false;
      if (g.mode === 'play' && g.tools.tool.kind !== 'query') {
        this.mode = 'tool';
        g.ui.closeFlyout();
        const hit = g.renderer.pick(e.clientX, e.clientY);
        // buildings follow the finger and are placed when it lifts; drag tools start at once
        if (g.tools.tool.kind === 'place') g.tools.move(hit, false);
        else g.tools.down(hit);
      } else {
        this.mode = 'pan';
      }
      return;
    }
    if (this.mode === 'tool') g.tools.abort();
    this.mode = 'multi';
    this.last = this.shape();
  }

  move(e: PointerEvent): void {
    const p = this.pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > TAP_SLOP) this.moved = true;
    const g = this.game;
    if (this.mode === 'tool') {
      g.tools.move(g.renderer.pick(e.clientX, e.clientY), false);
    } else if (this.mode === 'pan') {
      this.panBy(dx, dy);
    } else if (this.mode === 'multi' && this.last) {
      const now = this.shape();
      const cam = g.renderer.cam;
      if (this.pts.size === 2) {
        this.panBy(now.cx - this.last.cx, now.cy - this.last.cy);
        if (this.last.dist > 0 && now.dist > 0) this.zoomAt(this.last.dist / now.dist, now.cx, now.cy);
        let da = now.angle - this.last.angle;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        cam.rotate(da);
      } else {
        cam.tilt((now.cy - this.last.cy) * 0.004);
      }
      this.last = now;
    }
  }

  up(e: PointerEvent, cancelled: boolean): void {
    if (!this.pts.delete(e.pointerId)) return;
    const g = this.game;
    const left = this.pts.size;
    if (this.mode === 'tool') {
      if (cancelled) {
        g.tools.abort();
      } else {
        const hit = g.renderer.pick(e.clientX, e.clientY);
        if (g.tools.tool.kind === 'place') g.tools.down(hit);
        else g.tools.up(hit);
      }
      // there is no hover on a touch screen: hide the preview once the finger lifts
      g.tools.move(null, false);
      this.mode = 'none';
    } else if (this.mode === 'pan') {
      if (!cancelled && !this.moved && g.mode === 'play') g.tools.down(g.renderer.pick(e.clientX, e.clientY));
      this.mode = 'none';
    } else if (this.mode === 'multi') {
      // the last finger of a gesture does nothing until all fingers have lifted
      if (left === 1) this.mode = 'done';
      else if (left > 1) this.last = this.shape();
    }
    if (left === 0) this.mode = 'none';
  }

  private shape(): Shape {
    const pts = [...this.pts.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p.x;
      cy += p.y;
    }
    cx /= pts.length;
    cy /= pts.length;
    if (pts.length < 2) return { cx, cy, dist: 0, angle: 0 };
    const [a, b] = pts;
    return { cx, cy, dist: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
}
