import * as THREE from 'three';
import type { ModelMesh } from './geom';
import { makeObjectGeometry } from './materials';

/** Convert a cached model mesh into a standalone BufferGeometry (for previews/ghosts/viewer). */
export function modelToGeometry(mesh: ModelMesh, seed = 0, dark = false): THREE.BufferGeometry {
  const info = new Uint8Array(mesh.count * 2);
  for (let i = 0; i < mesh.count; i++) {
    const s = mesh.win[i];
    info[i * 2] = s ? (dark ? s + 128 : s) : 0;
    info[i * 2 + 1] = seed;
  }
  return makeObjectGeometry(mesh.count, mesh.position.slice(), mesh.normal.slice(), mesh.color.slice(), mesh.wall.slice(), info);
}
