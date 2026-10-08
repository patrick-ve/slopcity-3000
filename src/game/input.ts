import type { Game } from './game';
import { QUERY_TOOL, findTool } from './tools';
import type { Speed } from '../sim/types';

const PAN_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Mouse + keyboard handling for the 3D view. */
export class Input {
  pointerOverUI = true;
  private held = new Set<string>();
  private pan: { x: number; y: number; moved: boolean } | null = null;
  private orbit: { x: number; y: number } | null = null;
  private leftDown = false;
  private lastMove = { x: 0, y: 0 };

  constructor(private game: Game, private canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointerenter', () => (this.pointerOverUI = false));
    canvas.addEventListener('pointerleave', () => {
      this.pointerOverUI = true;
      if (!this.leftDown) this.game.tools.move(null, false);
    });
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.keydown(e));
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }

  private get playing(): boolean {
    return this.game.mode === 'play';
  }

  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    if (e.button === 2) {
      this.pan = { x: e.clientX, y: e.clientY, moved: false };
    } else if (e.button === 1) {
      e.preventDefault();
      this.orbit = { x: e.clientX, y: e.clientY };
    } else if (e.button === 0 && this.playing) {
      if (e.altKey) {
        this.orbit = { x: e.clientX, y: e.clientY };
        return;
      }
      this.leftDown = true;
      this.game.ui.closeFlyout();
      this.game.tools.down(this.game.renderer.pick(e.clientX, e.clientY));
    }
  }

  private move(e: PointerEvent): void {
    this.lastMove.x = e.clientX;
    this.lastMove.y = e.clientY;
    const cam = this.game.renderer.cam;
    if (this.pan) {
      const dx = e.clientX - this.pan.x;
      const dy = e.clientY - this.pan.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.pan.moved = true;
      const upp = cam.unitsPerPixel(this.canvas.clientHeight);
      cam.pan(-dx * upp, (dy * upp) / Math.sin(cam.pitch));
      cam.target.copy(cam.goalTarget);
      this.pan.x = e.clientX;
      this.pan.y = e.clientY;
    }
    if (this.orbit) {
      const dx = e.clientX - this.orbit.x;
      const dy = e.clientY - this.orbit.y;
      cam.rotate(-dx * 0.006);
      cam.tilt(dy * 0.004);
      this.orbit.x = e.clientX;
      this.orbit.y = e.clientY;
    }
    if (this.playing) this.game.tools.move(this.game.renderer.pick(e.clientX, e.clientY), e.shiftKey);
  }

  private up(e: PointerEvent): void {
    if (e.button === 2) {
      if (this.pan && !this.pan.moved && this.playing) this.game.tools.cancel();
      this.pan = null;
    } else if (e.button === 1 || (e.button === 0 && this.orbit)) {
      this.orbit = null;
    } else if (e.button === 0 && this.leftDown) {
      this.leftDown = false;
      this.game.tools.up(this.game.renderer.pick(e.clientX, e.clientY));
    }
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const cam = this.game.renderer.cam;
    const factor = Math.pow(1.0015, e.deltaY * (e.deltaMode === 1 ? 30 : 1));
    const before = cam.goalZoom;
    cam.zoomBy(factor);
    const f = cam.goalZoom / before;
    const hit = this.game.renderer.pick(e.clientX, e.clientY);
    if (hit && f !== 1) {
      cam.goalTarget.x = hit.x + (cam.goalTarget.x - hit.x) * f;
      cam.goalTarget.z = hit.z + (cam.goalTarget.z - hit.z) * f;
    }
  }

  private keydown(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const g = this.game;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      if (this.playing && g.sim && g.saveSlot(g.sim.city.name)) g.ui.toast({ title: 'City saved', text: `Saved as “${g.sim.city.name}”.`, kind: 'good' }, 2000);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (PAN_KEYS[e.code]) {
      this.held.add(e.code);
      return;
    }
    if (e.code === 'Escape') {
      if (!g.ui.closeTopWindow()) g.tools.cancel();
      return;
    }
    if (!this.playing) return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        g.togglePause();
        break;
      case 'Digit0':
        g.setSpeed(0);
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
        g.setSpeed(Number(e.code.slice(5)) as Speed);
        break;
      case 'KeyQ':
        g.renderer.cam.rotateQuarter(-1);
        break;
      case 'KeyE':
        g.renderer.cam.rotateQuarter(1);
        break;
      case 'KeyB':
        g.selectTool(findTool('bulldoze')!);
        break;
      case 'KeyR':
        g.selectTool(findTool('line:road')!);
        break;
      case 'KeyP':
        g.selectTool(findTool('line:power')!);
        break;
      case 'KeyU':
        g.selectTool(findTool('line:pipe')!);
        break;
      case 'KeyZ':
        g.ui.openCategory('zones');
        break;
      case 'KeyG':
        g.toggleGrid();
        break;
      case 'KeyX':
      case 'Tab':
        e.preventDefault();
        g.tools.rotate();
        break;
      case 'KeyM':
        g.toggleMute();
        break;
      case 'Equal':
      case 'NumpadAdd':
        g.renderer.cam.zoomBy(0.8);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        g.renderer.cam.zoomBy(1.25);
        break;
      case 'KeyH':
        g.ui.openWindow('help');
        break;
      case 'Backquote':
        g.selectTool(QUERY_TOOL);
        break;
    }
  }

  update(dt: number): void {
    const cam = this.game.renderer.cam;
    let px = 0;
    let pz = 0;
    for (const k of this.held) {
      const d = PAN_KEYS[k];
      if (d) {
        px += d[0];
        pz += d[1];
      }
    }
    if (this.game.settings.edgeScroll && !this.pointerOverUI && document.hasFocus()) {
      const m = 6;
      const { x, y } = this.lastMove;
      if (x <= m) px -= 1;
      if (x >= window.innerWidth - m) px += 1;
      if (y <= m) pz += 1;
      if (y >= window.innerHeight - m) pz -= 1;
    }
    if (px || pz) {
      const speed = cam.zoom * 1.4 * dt;
      cam.pan(px * speed, (pz * speed) / Math.max(0.5, Math.sin(cam.pitch)));
    }
  }
}
