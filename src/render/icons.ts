import * as THREE from 'three';

export const ICON = { POWER: 0, WATER: 1, ROAD: 2, FIRE: 3 } as const;
const COUNT = 4;
const MAX = 3000;

function drawAtlas(): HTMLCanvasElement {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s * COUNT;
  c.height = s;
  const g = c.getContext('2d')!;
  const disc = (i: number, fill: string) => {
    const cx = i * s + s / 2;
    g.beginPath();
    g.arc(cx, s / 2, s * 0.42, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#ffffff';
    g.stroke();
  };
  // 0: no power – lightning bolt
  disc(0, '#d63a2f');
  g.fillStyle = '#ffe14d';
  g.beginPath();
  const o = 0;
  g.moveTo(o + 36, 10);
  g.lineTo(o + 20, 36);
  g.lineTo(o + 31, 36);
  g.lineTo(o + 26, 55);
  g.lineTo(o + 44, 27);
  g.lineTo(o + 33, 27);
  g.closePath();
  g.fill();
  // 1: no water – drop
  disc(1, '#d63a2f');
  g.fillStyle = '#6cc7ff';
  g.beginPath();
  const wx = s + 32;
  g.moveTo(wx, 12);
  g.bezierCurveTo(wx + 16, 30, wx + 16, 50, wx, 51);
  g.bezierCurveTo(wx - 16, 50, wx - 16, 30, wx, 12);
  g.fill();
  // 2: no road – car
  disc(2, '#d6862f');
  g.fillStyle = '#ffffff';
  const rx = 2 * s;
  g.fillRect(rx + 16, 28, 32, 12);
  g.fillRect(rx + 22, 20, 20, 10);
  g.fillStyle = '#333';
  g.beginPath();
  g.arc(rx + 23, 42, 4, 0, Math.PI * 2);
  g.arc(rx + 41, 42, 4, 0, Math.PI * 2);
  g.fill();
  // 3: fire
  disc(3, '#d63a2f');
  g.fillStyle = '#ffb23f';
  const fx = 3 * s + 32;
  g.beginPath();
  g.moveTo(fx, 10);
  g.bezierCurveTo(fx + 22, 30, fx + 14, 54, fx, 54);
  g.bezierCurveTo(fx - 14, 54, fx - 22, 30, fx, 10);
  g.fill();
  return c;
}

/** Bobbing status billboards (no power, no water, no road access). */
export class Icons {
  readonly mesh: THREE.InstancedMesh;
  private iconAttr: THREE.InstancedBufferAttribute;
  private material: THREE.ShaderMaterial;

  constructor() {
    const tex = new THREE.CanvasTexture(drawAtlas());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.iconAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    geo.setAttribute('aIcon', this.iconAttr);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: tex },
        uScale: { value: 1 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aIcon;
        uniform float uScale;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float bob = sin(uTime * 3.0 + c.x * 1.7 + c.y) * 0.08 * uScale;
          c.xy += position.xy * uScale + vec2(0.0, bob);
          gl_Position = projectionMatrix * c;
          vUv = vec2((uv.x + aIcon) / ${COUNT.toFixed(1)}, uv.y);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        varying vec2 vUv;
        void main() {
          vec4 t = texture2D(uTex, vUv);
          if (t.a < 0.1) discard;
          gl_FragColor = t;
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  set(list: { x: number; y: number; z: number; icon: number }[]): void {
    const m = new THREE.Matrix4();
    const n = Math.min(MAX, list.length);
    for (let i = 0; i < n; i++) {
      const it = list[i];
      m.makeTranslation(it.x, it.y, it.z);
      this.mesh.setMatrixAt(i, m);
      this.iconAttr.setX(i, it.icon);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.iconAttr.needsUpdate = true;
  }

  update(time: number, zoom: number): void {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uScale.value = Math.max(0.22, zoom * 0.034);
  }
}
