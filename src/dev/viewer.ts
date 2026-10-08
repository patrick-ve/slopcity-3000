/**
 * Development model viewer: renders catalog models in a grid so their look
 * can be checked in isolation. Open /viewer.html?filter=house&variants=4
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GROWABLES, PLOPPABLES, type BuildingDef } from '../sim/catalog';
import { getModel, MODELS } from '../render/models';
import { modelToGeometry } from '../render/meshUtil';
import { createBuildingMaterial, shared } from '../render/materials';

const params = new URLSearchParams(location.search);
const filter = (params.get('filter') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const query = (params.get('q') ?? '').toLowerCase();
const variants = Math.max(1, Number(params.get('variants') ?? 1));
const night = Number(params.get('night') ?? 0);
const showLabels = params.get('labels') !== '0';

interface Item {
  label: string;
  model: string;
  def?: BuildingDef;
  w: number;
  h: number;
}

const items: Item[] = [];
const seen = new Set<string>();
for (const d of [...GROWABLES, ...PLOPPABLES]) {
  items.push({ label: `${d.name} (${d.model})`, model: d.model, def: d, w: d.w, h: d.h });
  seen.add(d.model);
}
for (const key of Object.keys(MODELS)) {
  if (!seen.has(key)) items.push({ label: key, model: key, w: 1, h: 1 });
}
// filter=<model keys or def ids> (exact), q=<substring of label>
const shown = items.filter(
  (it) =>
    (filter.length === 0 || filter.some((f) => it.model === f || it.def?.id === f)) &&
    (!query || it.label.toLowerCase().includes(query)),
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(night ? 0x0b1630 : 0x9fc3d9);
const hemi = new THREE.HemisphereLight(0xd8ecff, 0x6b5a45, night ? 0.25 : 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(night ? 0x8fa6ff : 0xfff0dc, night ? 0.25 : 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);
shared.uNight.value = night;

const mat = createBuildingMaterial();
const cols = Number(params.get('cols') ?? Math.ceil(Math.sqrt(shown.length * variants)));
const cell = 5;
let idx = 0;
const labelEls: { el: HTMLDivElement; pos: THREE.Vector3 }[] = [];
const labels = document.getElementById('labels')!;
for (const it of shown) {
  for (let v = 0; v < variants; v++) {
    const cx = (idx % cols) * cell;
    const cz = Math.floor(idx / cols) * cell;
    idx++;
    const mesh = getModel({
      model: it.model,
      w: it.w,
      h: it.h,
      wealth: it.def?.wealth ?? 0,
      variant: v,
      zone: it.def?.zone ?? 0,
      density: it.def?.density ?? 0,
      name: it.def?.name ?? it.model,
    });
    const geo = modelToGeometry(mesh, (v * 37) & 255);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(cx, 0.02, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(it.w, 0.04, it.h),
      new THREE.MeshLambertMaterial({ color: 0x7fb24a }),
    );
    plate.position.set(cx + it.w / 2, 0, cz + it.h / 2);
    plate.receiveShadow = true;
    scene.add(plate);
    if (showLabels) {
      const el = document.createElement('div');
      el.className = 'lbl';
      el.textContent = `${it.label}${variants > 1 ? ` v${v}` : ''} · ${mesh.count / 3} tris`;
      labels.appendChild(el);
      labelEls.push({ el, pos: new THREE.Vector3(cx + it.w / 2, 0, cz + it.h + 0.3) });
    }
  }
}
const rows = Math.ceil(idx / cols);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(cols * cell + 10, rows * cell + 10), new THREE.MeshLambertMaterial({ color: 0x6f9f45 }));
ground.rotation.x = -Math.PI / 2;
ground.position.set((cols * cell) / 2 - 1, -0.03, (rows * cell) / 2 - 1);
ground.receiveShadow = true;
scene.add(ground);

const centre = new THREE.Vector3((cols * cell) / 2 - 2, 0, (rows * cell) / 2 - 2);
const aspect = innerWidth / innerHeight;
const viewH = Math.max(rows, cols / aspect) * cell * 0.62 + 2;
const camera = new THREE.OrthographicCamera((-viewH * aspect) / 2, (viewH * aspect) / 2, viewH / 2, -viewH / 2, 0.1, 1000);
camera.position.copy(centre).add(new THREE.Vector3(60, 55, 60));
camera.lookAt(centre);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(centre);
controls.update();

const ext = Math.max(cols, rows) * cell;
sun.position.copy(centre).add(new THREE.Vector3(-0.5, 1, 0.35).normalize().multiplyScalar(ext + 20));
sun.target.position.copy(centre);
const sc = sun.shadow.camera;
sc.left = -ext;
sc.right = ext;
sc.top = ext;
sc.bottom = -ext;
sc.near = 1;
sc.far = ext * 3 + 60;
sc.updateProjectionMatrix();

addEventListener('resize', () => {
  const a = innerWidth / innerHeight;
  camera.left = (-viewH * a) / 2;
  camera.right = (viewH * a) / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const tmp = new THREE.Vector3();
function frame() {
  controls.update();
  renderer.render(scene, camera);
  for (const l of labelEls) {
    tmp.copy(l.pos).project(camera);
    l.el.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth}px`;
    l.el.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight}px`;
  }
  requestAnimationFrame(frame);
}
frame();

const cellsCentres: THREE.Vector3[] = [];
for (let i = 0; i < idx; i++) cellsCentres.push(new THREE.Vector3((i % cols) * cell + 1, 0, Math.floor(i / cols) * cell + 1));

/** Centre the camera on grid item i (in display order) with the given zoom. */
function focus(i: number, zoom = 4) {
  const t = cellsCentres[Math.max(0, Math.min(cellsCentres.length - 1, i))];
  const off = camera.position.clone().sub(controls.target);
  controls.target.copy(t);
  camera.position.copy(t).add(off);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  controls.update();
}
if (params.has('focus')) focus(Number(params.get('focus')), Number(params.get('zoom') ?? 4));
else if (params.has('zoom')) {
  camera.zoom = Number(params.get('zoom'));
  camera.updateProjectionMatrix();
}

(window as unknown as Record<string, unknown>).viewer = { camera, controls, scene, shared, focus };
