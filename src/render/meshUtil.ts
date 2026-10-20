import type * as THREE from 'three';
import type { ModelMesh } from './geom';
import { ObjectBuf, rotPlacement } from './buffers';

/** Convert a cached model mesh into a standalone BufferGeometry (for previews/ghosts/viewer). */
export function modelToGeometry(mesh: ModelMesh, seed = 0, dark = false): THREE.BufferGeometry {
  const buf = new ObjectBuf();
  buf.addModel(mesh, rotPlacement(0, 0, 0, 0, 0, 0), { seed, dark });
  return buf.toGeometry();
}
