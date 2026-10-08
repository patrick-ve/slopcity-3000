import * as THREE from 'three';
import { LEVEL_H, type World } from '../sim/world';
import { shared } from './materials';
import { waterY } from './ground';

/**
 * Water: a faceted, gently animated plane at sea level plus side walls at the
 * map edges. Shallow water is lighter and foams at the shore (heights texture).
 */
export class Water {
  mesh: THREE.Mesh;
  private material: THREE.MeshPhongMaterial;

  constructor(private world: World) {
    this.material = new THREE.MeshPhongMaterial({
      color: 0x3f9fc6,
      specular: 0x9fd8ff,
      shininess: 70,
      flatShading: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = shared.uTime;
      shader.uniforms.uHeights = shared.uHeights;
      shader.uniforms.uMapSize = shared.uMapSize;
      shader.uniforms.uLevelH = shared.uLevelH;
      shader.uniforms.uSeaY = shared.uSeaY;
      shader.uniforms.uNight = shared.uNight;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSeaY;\nvarying vec3 vWorld;')
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `#include <begin_vertex>
vec4 wpos = modelMatrix * vec4(transformed, 1.0);
if (transformed.y > uSeaY - 0.001) {
  float wv = sin(wpos.x * 1.7 + uTime * 1.3) * 0.5 + sin(wpos.z * 2.3 - uTime * 1.1) * 0.35 + sin((wpos.x + wpos.z) * 3.1 + uTime * 2.0) * 0.15;
  transformed.y += wv * 0.025;
}
vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
uniform sampler2D uHeights;
uniform vec2 uMapSize;
uniform float uLevelH;
uniform float uSeaY;
uniform float uTime;
uniform float uNight;
varying vec3 vWorld;`,
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
{
  vec2 huv = (vWorld.xz + 0.5) / (uMapSize + 1.0);
  float ground = texture2D(uHeights, huv).r * 255.0 * uLevelH;
  float depth = uSeaY - ground;
  vec3 shallow = vec3(0.32, 0.78, 0.80);
  vec3 deep = vec3(0.07, 0.33, 0.55);
  diffuseColor.rgb = mix(shallow, deep, smoothstep(0.0, 0.75, depth));
  float foam = 1.0 - smoothstep(0.02, 0.14 + 0.03 * sin(uTime * 2.0 + vWorld.x * 4.0), depth);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.98, 1.0), foam * 0.75);
  diffuseColor.a = mix(0.62, 0.9, smoothstep(0.0, 0.8, depth));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.35, 0.45, 0.7), uNight * 0.6);
}`,
        );
    };
    this.mesh = new THREE.Mesh(this.buildGeometry(), this.material);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 2;
  }

  /** Grid at sea level (2 tiles per cell) plus walls where terrain is below water at the map edges. */
  private buildGeometry(): THREE.BufferGeometry {
    const w = this.world;
    const y = waterY(w);
    const pos: number[] = [];
    const seg = 2;
    // only build cells that are near water to save fill-rate
    for (let gz = 0; gz < w.h; gz += seg) {
      for (let gx = 0; gx < w.w; gx += seg) {
        let wet = false;
        for (let yy = gz - 1; yy <= gz + seg && !wet; yy++) {
          for (let xx = gx - 1; xx <= gx + seg && !wet; xx++) {
            if (w.inBounds(xx, yy) && w.tileMin(xx, yy) < w.seaLevel + 0.5) wet = true;
          }
        }
        if (!wet) continue;
        const x0 = gx;
        const x1 = Math.min(w.w, gx + seg);
        const z0 = gz;
        const z1 = Math.min(w.h, gz + seg);
        pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
      }
    }
    const L = LEVEL_H;
    const wall = (ax: number, az: number, ha: number, bx: number, bz: number, hb: number, out: [number, number]) => {
      const ya = Math.min(y, ha * L);
      const yb = Math.min(y, hb * L);
      if (ya >= y - 1e-4 && yb >= y - 1e-4) return;
      const nx = -(bz - az);
      const nz = bx - ax;
      const a0 = [ax, ya, az];
      const b0 = [bx, yb, bz];
      const b1 = [bx, y, bz];
      const a1 = [ax, y, az];
      if (nx * out[0] + nz * out[1] > 0) pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
      else pos.push(...b0, ...a0, ...a1, ...b0, ...a1, ...b1);
    };
    for (let x = 0; x < w.w; x++) {
      wall(x, 0, w.corner(x, 0), x + 1, 0, w.corner(x + 1, 0), [0, -1]);
      wall(x, w.h, w.corner(x, w.h), x + 1, w.h, w.corner(x + 1, w.h), [0, 1]);
    }
    for (let z = 0; z < w.h; z++) {
      wall(0, z, w.corner(0, z), 0, z + 1, w.corner(0, z + 1), [-1, 0]);
      wall(w.w, z, w.corner(w.w, z), w.w, z + 1, w.corner(w.w, z + 1), [1, 0]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  rebuild(): void {
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.buildGeometry();
  }
}
