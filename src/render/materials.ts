import * as THREE from 'three';

/**
 * Uniforms shared by all custom materials. Mutate `.value` to update every
 * material at once.
 */
export const shared = {
  uNight: { value: 0 },
  uTime: { value: 0 },
  uOverlay: { value: emptyTexture() as THREE.Texture },
  uOverlayAmt: { value: 0 },
  uTiles: { value: emptyTexture() as THREE.Texture },
  uMapSize: { value: new THREE.Vector2(1, 1) },
  uGrid: { value: 0 },
  uUnder: { value: 0 },
  uHeights: { value: emptyTexture() as THREE.Texture },
  uLevelH: { value: 0.25 },
  uSeaY: { value: 0 },
};

function emptyTexture(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

const SRGB_TO_LINEAR_VERTEX = /* glsl */ `
#include <color_vertex>
#ifdef USE_COLOR
  vColor.rgb = pow(vColor.rgb, vec3(2.2));
#endif
`;

const WORLD_POS_VERTEX = /* glsl */ `
#include <project_vertex>
{
  vec4 wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  vWorld = (modelMatrix * wp).xyz;
}
`;

const HASH = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`;

/**
 * Material for buildings, trees and props. Vertex attributes:
 *  - color (sRGB, uint8), aWall (window cell coords), aInfo (style, seed).
 */
export function createBuildingMaterial(opts: { transparent?: boolean; opacity?: number } = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = shared.uNight;
    shader.uniforms.uOverlay = shared.uOverlay;
    shader.uniforms.uOverlayAmt = shared.uOverlayAmt;
    shader.uniforms.uMapSize = shared.uMapSize;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
attribute vec2 aWall;
attribute vec2 aInfo;
varying vec2 vWall;
varying vec2 vInfo;
varying vec3 vWorld;`,
      )
      .replace('#include <color_vertex>', SRGB_TO_LINEAR_VERTEX + '\nvWall = aWall;\nvInfo = aInfo;\n')
      .replace('#include <project_vertex>', WORLD_POS_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform float uNight;
uniform sampler2D uOverlay;
uniform float uOverlayAmt;
uniform vec2 uMapSize;
varying vec2 vWall;
varying vec2 vInfo;
varying vec3 vWorld;
${HASH}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
float winLit = 0.0;
float litK = 1.0;
vec3 litColor = vec3(1.0, 0.76, 0.42);
{
  float style = floor(vInfo.x + 0.5);
  float dark = 0.0;
  if (style >= 128.0) { style -= 128.0; dark = 1.0; }
  if (style > 0.5) {
    vec2 f = fract(vWall);
    vec2 cell = floor(vWall);
    vec4 r;
    vec3 glass;
    float litP;
    if (style < 1.5)      { r = vec4(0.28, 0.30, 0.72, 0.78); glass = vec3(0.16, 0.20, 0.27); litP = 0.42; }
    else if (style < 2.5) { r = vec4(0.07, 0.24, 0.93, 0.86); glass = vec3(0.20, 0.27, 0.36); litP = 0.38; litK = 0.8; }
    else if (style < 3.5) { r = vec4(0.04, 0.06, 0.96, 0.94); glass = mix(vec3(0.20, 0.33, 0.46), diffuseColor.rgb * 0.8, 0.45); litP = 0.3; litK = 0.55; litColor = vec3(0.9, 0.93, 1.0); }
    else if (style < 4.5) { r = vec4(0.10, 0.58, 0.90, 0.84); glass = vec3(0.20, 0.24, 0.28); litP = 0.3; }
    else if (style < 5.5) { r = vec4(0.06, 0.06, 0.94, 0.80); glass = vec3(0.24, 0.32, 0.40); litP = 0.85; litK = 0.6; }
    else                  { r = vec4(0.30, 0.14, 0.70, 0.86); glass = vec3(0.18, 0.24, 0.32); litP = 0.5; }
    vec2 fw = max(fwidth(vWall), vec2(1e-4));
    vec2 inLo = smoothstep(r.xy - fw, r.xy + fw, f);
    vec2 inHi = vec2(1.0) - smoothstep(r.zw - fw, r.zw + fw, f);
    float inside = inLo.x * inLo.y * inHi.x * inHi.y;
    float coverage = (r.z - r.x) * (r.w - r.y);
    float aa = clamp(1.6 - max(fw.x, fw.y) * 3.0, 0.0, 1.0);
    inside = mix(coverage * 0.8, inside, aa);
    vec3 g = glass * (0.8 + 0.45 * f.y);
    if (dark > 0.5) g = vec3(0.10, 0.09, 0.08);
    diffuseColor.rgb = mix(diffuseColor.rgb, g, inside * 0.92);
    float rnd = hash21(cell + vec2(vInfo.y * 7.13, vInfo.y * 3.71));
    float on = step(rnd, litP) * (1.0 - dark);
    winLit = inside * on * uNight;
  }
}
if (uOverlayAmt > 0.0) {
  vec4 ov = texture2D(uOverlay, vWorld.xz / uMapSize);
  diffuseColor.rgb = mix(diffuseColor.rgb, ov.rgb, ov.a * uOverlayAmt * 0.75);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
totalEmissiveRadiance += litColor * winLit * 0.85 * litK;`,
      );
  };
  return m;
}

/**
 * Terrain + road material. Samples a per-tile texture for zone/lot tints,
 * draws an optional grid and blends in the data-map overlay.
 */
export function createTerrainMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTiles = shared.uTiles;
    shader.uniforms.uOverlay = shared.uOverlay;
    shader.uniforms.uOverlayAmt = shared.uOverlayAmt;
    shader.uniforms.uMapSize = shared.uMapSize;
    shader.uniforms.uGrid = shared.uGrid;
    shader.uniforms.uUnder = shared.uUnder;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace('#include <color_vertex>', SRGB_TO_LINEAR_VERTEX)
      .replace('#include <project_vertex>', WORLD_POS_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform sampler2D uTiles;
uniform sampler2D uOverlay;
uniform float uOverlayAmt;
uniform vec2 uMapSize;
uniform float uGrid;
uniform float uUnder;
varying vec3 vWorld;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
{
  vec2 tuv = vWorld.xz / uMapSize;
  vec4 tile = texture2D(uTiles, tuv);
  vec2 fwv = fwidth(vWorld.xz);
  if (tile.a > 0.003) {
    if (tile.a > 0.5) {
      vec2 f = fract(vWorld.xz);
      float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      float e = max(fwv.x, fwv.y);
      float border = 1.0 - smoothstep(0.075 - e, 0.075 + e, edge);
      float strength = clamp((tile.a - 0.5) * 2.0, 0.0, 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, tile.rgb, mix(0.30, 0.85, border) * strength);
    } else {
      diffuseColor.rgb = mix(diffuseColor.rgb, tile.rgb, tile.a * 2.0);
    }
  }
  if (uGrid > 0.0) {
    vec2 gd = abs(fract(vWorld.xz + 0.5) - 0.5) / max(fwv, vec2(1e-4));
    float line = 1.0 - min(min(gd.x, gd.y), 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0), line * 0.22 * uGrid);
  }
  if (uUnder > 0.0) {
    vec3 under = vec3(0.16, 0.11, 0.07) + diffuseColor.rgb * 0.15;
    diffuseColor.rgb = mix(diffuseColor.rgb, under, 0.8 * uUnder);
  }
  vec4 ov = texture2D(uOverlay, tuv);
  diffuseColor.rgb = mix(diffuseColor.rgb, ov.rgb, ov.a * uOverlayAmt);
}`,
      );
  };
  return m;
}

/** Plain vertex-coloured flat material (map skirt, misc). */
export function createPlainMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', SRGB_TO_LINEAR_VERTEX);
  };
  return m;
}

/** Build a BufferGeometry from merged model arrays. */
export function makeObjectGeometry(
  count: number,
  position: Float32Array,
  normal: Int8Array,
  color: Uint8Array,
  wall: Float32Array,
  info: Uint8Array,
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position.subarray(0, count * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normal.subarray(0, count * 3), 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(color.subarray(0, count * 3), 3, true));
  g.setAttribute('aWall', new THREE.BufferAttribute(wall.subarray(0, count * 2), 2));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info.subarray(0, count * 2), 2));
  return g;
}
