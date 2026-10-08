import { h } from '../util/dom';
import { icon } from './icons';

let zTop = 20;

/** Screen pixels per interface pixel for an element (the UI root may be scaled). */
export function scaleOf(el: HTMLElement): number {
  const w = el.offsetWidth;
  return w ? el.getBoundingClientRect().width / w : 1;
}

/** A draggable, closable floating window. */
export class UIWindow {
  readonly el: HTMLDivElement;
  readonly body: HTMLDivElement;
  private titleEl: HTMLHeadingElement;
  onClose: (() => void) | null = null;

  constructor(
    private host: HTMLElement,
    readonly id: string,
    title: string,
    iconName: string,
    width = 420,
  ) {
    this.titleEl = h('h2', { html: `${icon(iconName, 18)}<span></span>` });
    (this.titleEl.querySelector('span') as HTMLSpanElement).textContent = title;
    const close = h('button', { class: 'iconbtn', title: 'Close (Esc)', html: icon('close', 16), onclick: () => this.close() });
    const head = h('div', { class: 'head' }, this.titleEl, close);
    this.body = h('div', { class: 'body' });
    this.el = h('div', { class: 'win glass', style: `width:${width}px` }, head, this.body);
    this.el.addEventListener('pointerdown', () => this.front());
    this.dragify(head);
  }

  setTitle(title: string): void {
    (this.titleEl.querySelector('span') as HTMLSpanElement).textContent = title;
  }

  get open(): boolean {
    return this.el.isConnected;
  }

  /** Attach the window (call place() after filling it to centre it). */
  show(): boolean {
    const fresh = !this.el.isConnected;
    if (fresh) {
      this.el.style.visibility = 'hidden';
      this.host.appendChild(this.el);
    }
    this.front();
    return fresh;
  }

  /** Put the window next to a screen point (CSS pixels), keeping it on screen. */
  placeNear(x: number, y: number): void {
    const s = scaleOf(this.host);
    const px = x / s;
    const py = y / s;
    const w = this.el.offsetWidth;
    const hgt = this.el.offsetHeight;
    let left = px + 28;
    if (left + w > this.host.clientWidth - 214) left = px - w - 28;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${py - hgt / 2}px`;
    this.clamp();
    this.el.style.visibility = '';
  }

  /** Centre the window in the free area, keeping it on screen. */
  place(): void {
    const w = this.el.offsetWidth;
    const hgt = this.el.offsetHeight;
    this.el.style.left = `${(this.host.clientWidth - w) / 2}px`;
    this.el.style.top = `${(this.host.clientHeight - hgt) / 2 - 10}px`;
    this.clamp();
    this.el.style.visibility = '';
  }

  /**
   * Move the window back inside the screen (after a resize or a move):
   * right of the toolbar, below the top bar and above the bottom bar when
   * there is room, and never with its title bar off the screen.
   */
  clamp(): void {
    if (!this.el.isConnected) return;
    const W = this.host.clientWidth;
    const H = this.host.clientHeight;
    const w = this.el.offsetWidth;
    const hgt = this.el.offsetHeight;
    const maxL = Math.max(10, W - w - 10);
    const left = Math.min(Math.max(this.el.offsetLeft, Math.min(74, maxL)), maxL);
    const maxT = Math.max(10, H - hgt - 76);
    const top = Math.min(Math.max(this.el.offsetTop, Math.min(66, maxT)), maxT);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  front(): void {
    this.el.style.zIndex = String(++zTop);
  }

  close(): void {
    if (!this.el.isConnected) return;
    this.el.remove();
    this.onClose?.();
  }

  toggle(): void {
    if (this.open) this.close();
    else if (this.show()) this.place();
  }

  private dragify(handle: HTMLElement): void {
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;
    let s = 1;
    const move = (e: PointerEvent) => {
      const x = Math.max(0, Math.min(this.host.clientWidth - 60, ox + (e.clientX - sx) / s));
      const y = Math.max(0, Math.min(this.host.clientHeight - 40, oy + (e.clientY - sy) / s));
      this.el.style.left = `${x}px`;
      this.el.style.top = `${y}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      handle.style.cursor = '';
    };
    handle.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      sx = e.clientX;
      sy = e.clientY;
      ox = this.el.offsetLeft;
      oy = this.el.offsetTop;
      s = scaleOf(this.host);
      handle.style.cursor = 'grabbing';
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }
}
