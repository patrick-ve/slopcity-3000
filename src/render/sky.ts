import * as THREE from 'three';
import { shared } from './materials';

interface Key {
  t: number;
  top: number;
  bottom: number;
  sun: number;
  sunI: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  night: number;
}

// time of day: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
const KEYS: Key[] = [
  { t: 0.0, top: 0x0b1530, bottom: 0x1e2c52, sun: 0x9fb4ff, sunI: 0.75, hemiSky: 0x5a6ca8, hemiGround: 0x23222c, hemiI: 0.95, night: 1 },
  { t: 0.2, top: 0x18264f, bottom: 0x3d4a78, sun: 0xa8b8ff, sunI: 0.75, hemiSky: 0x6070a8, hemiGround: 0x26242c, hemiI: 1.0, night: 1 },
  { t: 0.26, top: 0x4f6fa8, bottom: 0xf2a675, sun: 0xffb27a, sunI: 1.4, hemiSky: 0xa0b8e0, hemiGround: 0x5a4838, hemiI: 0.9, night: 0.45 },
  { t: 0.34, top: 0x7fb0e0, bottom: 0xd8e8f0, sun: 0xffe2bf, sunI: 2.4, hemiSky: 0xc4dcff, hemiGround: 0x6e5c46, hemiI: 1.15, night: 0 },
  { t: 0.5, top: 0x6aa6dc, bottom: 0xd4e8f2, sun: 0xfff3e0, sunI: 2.8, hemiSky: 0xcfe4ff, hemiGround: 0x76664e, hemiI: 1.25, night: 0 },
  { t: 0.66, top: 0x75a8d8, bottom: 0xe8e0d0, sun: 0xffe0b5, sunI: 2.4, hemiSky: 0xc4d8f8, hemiGround: 0x6e5c46, hemiI: 1.1, night: 0 },
  { t: 0.74, top: 0x5a6aa0, bottom: 0xf59a6a, sun: 0xff9a5a, sunI: 1.3, hemiSky: 0xb09ac8, hemiGround: 0x584030, hemiI: 0.85, night: 0.5 },
  { t: 0.8, top: 0x1f2a58, bottom: 0x4a4a80, sun: 0xa8b8ff, sunI: 0.75, hemiSky: 0x6070a8, hemiGround: 0x26242c, hemiI: 1.0, night: 1 },
  { t: 1.0, top: 0x0b1530, bottom: 0x1e2c52, sun: 0x9fb4ff, sunI: 0.75, hemiSky: 0x5a6ca8, hemiGround: 0x23222c, hemiI: 0.95, night: 1 },
];

const ca = new THREE.Color();
const cb = new THREE.Color();

function mixColor(a: number, b: number, t: number, out: THREE.Color): THREE.Color {
  ca.setHex(a);
  cb.setHex(b);
  return out.copy(ca).lerp(cb, t);
}

/** Day/night cycle: drives lights, background gradient and lit windows. */
export class Sky {
  /** 0..1 time of day. */
  time = 0.42;
  enabled = true;
  /** Real seconds per full day. */
  dayLength = 360;
  readonly sunDir = new THREE.Vector3();
  private top = new THREE.Color();
  private bottom = new THREE.Color();

  constructor(
    private sun: THREE.DirectionalLight,
    private hemi: THREE.HemisphereLight,
    private container: HTMLElement,
  ) {
    this.apply();
  }

  update(dt: number, running: boolean): void {
    if (this.enabled && running) this.time = (this.time + dt / this.dayLength) % 1;
    this.apply();
  }

  get isNight(): boolean {
    return shared.uNight.value > 0.5;
  }

  apply(): void {
    const t = this.enabled ? this.time : 0.42;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
    mixColor(a.sun, b.sun, f, this.sun.color);
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * f;
    mixColor(a.hemiSky, b.hemiSky, f, this.hemi.color);
    mixColor(a.hemiGround, b.hemiGround, f, this.hemi.groundColor);
    this.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * f;
    shared.uNight.value = a.night + (b.night - a.night) * f;
    mixColor(a.top, b.top, f, this.top);
    mixColor(a.bottom, b.bottom, f, this.bottom);
    this.container.style.background = `linear-gradient(180deg, #${this.top.getHexString()} 0%, #${this.bottom.getHexString()} 100%)`;
    // sun (or moon) direction: daytime arc from east to west, moon at night
    const day = t > 0.22 && t < 0.78;
    const u = day ? (t - 0.22) / 0.56 : ((t + 0.22) % 1) / 0.44;
    const az = -0.6 + u * Math.PI * 0.75;
    const el = Math.max(0.28, Math.sin(u * Math.PI) * 1.05);
    this.sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
  }
}
