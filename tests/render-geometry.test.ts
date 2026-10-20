import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { GeometryBuilder, type ModelMesh } from '../src/render/geom';
import { ObjectBuf, GroundBuf, releaseAfterUpload, rotPlacement } from '../src/render/buffers';
import { getModel, modelForDef } from '../src/render/models';
import { DEFS } from '../src/sim/catalog';
import { smoothEdges } from '../src/render/renderer';

/** Every catalog model and variant, plus trees and props. */
function allModels(): ModelMesh[] {
  const list: ModelMesh[] = [];
  for (const def of Object.values(DEFS)) for (let v = 0; v < 8; v++) list.push(modelForDef(def, v));
  for (const k of ['tree_round', 'tree_cone', 'tree_tall', 'rubble', 'power_pole', 'construction'])
    for (let v = 0; v < 8; v++) list.push(getModel({ model: k, w: 1, h: 1, variant: v }));
  return [...new Set(list)];
}

describe('model meshes', () => {
  it('share the corners of a plain box between its faces', () => {
    const g = new GeometryBuilder();
    g.noWin().color(0x808080).box(0, 0, 0, 1, 1, 1);
    const m = g.build();
    // four sides and a top: 30 triangle corners on 8 box corners
    expect(m.index.length).toBe(30);
    expect(m.count).toBe(8);
  });

  it('keep window walls and the two sides of a panel apart', () => {
    const g = new GeometryBuilder();
    g.color(0x808080).win(1).box(0, 0, 0, 1, 1, 1);
    const box = g.build();
    // each wall has its own window cells, the top has none: 4 corners per face
    expect(box.count).toBe(20);
    const p = new GeometryBuilder();
    p.color(0x808080).panel([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    expect(p.build().count).toBe(8);
  });

  it('keep every triangle and give each corner a normal on the side of its faces', { timeout: 30_000 }, () => {
    let corners = 0;
    let vertices = 0;
    let outside = 0;
    let wrong = 0;
    for (const m of allModels()) {
      corners += m.index.length;
      vertices += m.count;
      for (let t = 0; t < m.index.length; t += 3) {
        const [a, b, c] = [m.index[t], m.index[t + 1], m.index[t + 2]];
        if (Math.max(a, b, c) >= m.count) outside++;
        const P = (i: number) => [m.position[i * 3], m.position[i * 3 + 1], m.position[i * 3 + 2]];
        const [pa, pb, pc] = [P(a), P(b), P(c)];
        const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
        const v = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        for (const i of [a, b, c]) if (n[0] * m.normal[i * 3] + n[1] * m.normal[i * 3 + 1] + n[2] * m.normal[i * 3 + 2] <= 0) wrong++;
      }
    }
    expect(outside).toBe(0);
    expect(wrong).toBe(0);
    // the shared corners are the point of it
    expect(vertices / corners).toBeLessThan(0.45);
  });
});

describe('chunk buffers', () => {
  const box = (() => {
    const g = new GeometryBuilder();
    g.color(0x336699).win(2).box(0, 0, 0, 1, 2, 1);
    return g.build();
  })();

  it('pack each vertex in 4-byte words and offset the indices of each model', () => {
    const buf = new ObjectBuf();
    buf.addModel(box, rotPlacement(0, 1, 1, 0, 0, 0), { seed: 7 });
    buf.addModel(box, rotPlacement(1, 1, 1, 5, 0, 5), { seed: 9, dark: true });
    const g = buf.toGeometry();
    expect(g.getAttribute('position').itemSize).toBe(3);
    for (const name of ['normal', 'color', 'aWin']) expect(g.getAttribute(name).itemSize).toBe(4);
    const index = g.index!.array;
    expect(index).toBeInstanceOf(Uint16Array);
    expect(index.length).toBe(box.index.length * 2);
    for (let k = 0; k < box.index.length; k++) expect(index[box.index.length + k]).toBe(index[k] + box.count);
    const color = g.getAttribute('color').array;
    for (let i = 3; i < color.length; i += 4) expect(color[i]).toBe(255);
    // window cell u, v, style (+128 when dark) and seed
    const win = g.getAttribute('aWin').array;
    const lit = box.win.findIndex((s) => s > 0);
    expect([...win.slice(lit * 4, lit * 4 + 4)]).toEqual([box.wall[lit * 2], box.wall[lit * 2 + 1], 2, 7]);
    const dark = box.count + lit;
    expect([...win.slice(dark * 4, dark * 4 + 4)]).toEqual([box.wall[lit * 2], box.wall[lit * 2 + 1], 130, 9]);
  });

  it('leave out the window data for trees', () => {
    const buf = new ObjectBuf(false);
    buf.addModel(getModel({ model: 'tree_round', w: 1, h: 1, variant: 2 }), rotPlacement(0, 1, 1, 0, 0, 0), { seed: 0 });
    expect(buf.toGeometry().getAttribute('aWin')).toBeUndefined();
  });

  it('switch to 32-bit indices past 65534 vertices', () => {
    const buf = new ObjectBuf();
    while (buf.count < 0xffff) buf.addModel(box, rotPlacement(0, 1, 1, 0, 0, 0), { seed: 0 });
    expect(buf.toGeometry().index!.array).toBeInstanceOf(Uint32Array);
    buf.reset();
    buf.addModel(box, rotPlacement(0, 1, 1, 0, 0, 0), { seed: 0 });
    expect(buf.count).toBe(box.count);
    expect(buf.toGeometry().index!.array).toBeInstanceOf(Uint16Array);
  });

  it('drop the vertex data once it is uploaded', () => {
    const ground = new GroundBuf();
    ground.quad([0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0], 0x55aa55);
    const buf = new ObjectBuf();
    buf.addModel(box, rotPlacement(0, 1, 1, 0, 0, 0), { seed: 1 });
    for (const g of [ground.toGeometry(), buf.toGeometry()]) {
      expect(g.boundingSphere).not.toBeNull();
      releaseAfterUpload(g);
      const attrs: THREE.BufferAttribute[] = [...(Object.values(g.attributes) as THREE.BufferAttribute[]), ...(g.index ? [g.index] : [])];
      const counts = attrs.map((a) => a.count);
      // what three.js calls after uploading an attribute
      for (const a of attrs) (a as unknown as { onUploadCallback: () => void }).onUploadCallback();
      for (const a of attrs) expect(a.array).toBeNull();
      expect(attrs.map((a) => a.count)).toEqual(counts);
    }
  });
});

describe('edge smoothing', () => {
  it('stays off on sharp screens unless asked for', () => {
    expect(smoothEdges('auto', 1)).toBe(true);
    expect(smoothEdges('auto', 1.5)).toBe(true);
    expect(smoothEdges('auto', 2)).toBe(false);
    expect(smoothEdges('on', 2)).toBe(true);
    expect(smoothEdges('off', 1)).toBe(false);
  });
});
