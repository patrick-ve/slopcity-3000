import { GeometryBuilder, type ModelMesh } from '../geom';
import { Rng, hash3 } from '../../util/rng';
import type { BuildingDef } from '../../sim/catalog';
import type { ModelCtx, ModelFn } from './types';
import { GROWABLE_MODELS } from './growables';
import { PLOP_MODELS } from './civic';
import { PROP_MODELS } from './props';

export const MODELS: Record<string, ModelFn> = {
  ...GROWABLE_MODELS,
  ...PLOP_MODELS,
  ...PROP_MODELS,
};

const cache = new Map<string, ModelMesh>();

function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fallback when a model key is missing: a plain box with windows. */
const fallback: ModelFn = (g, c) => {
  g.color(0xd0c8b8).win(2);
  g.box(0.08, 0, 0.08, c.w - 0.08, 0.15 + 0.1 * c.density * c.w, c.h - 0.08, { top: 0x8e8a84 });
};

export interface ModelRequest {
  model: string;
  w: number;
  h: number;
  wealth?: number;
  variant?: number;
  zone?: number;
  density?: number;
  name?: string;
}

/** Build (or fetch from cache) the mesh for a model key + parameters. */
export function getModel(req: ModelRequest): ModelMesh {
  const variant = req.variant ?? 0;
  const wealth = req.wealth ?? 0;
  const zone = req.zone ?? 0;
  const density = req.density ?? 0;
  const name = req.name ?? req.model;
  const key = `${req.model}|${req.w}x${req.h}|${wealth}|${variant}|${zone}|${density}|${name}`;
  let mesh = cache.get(key);
  if (mesh) return mesh;
  const fn = MODELS[req.model] ?? fallback;
  const g = new GeometryBuilder();
  const ctx: ModelCtx = {
    w: req.w,
    h: req.h,
    wealth,
    variant,
    zone,
    density,
    name,
    rng: new Rng(hash3(strHash(req.model), variant + 1, wealth * 31 + zone * 7 + strHash(name))),
  };
  try {
    fn(g, ctx);
  } catch (e) {
    console.error(`Model ${req.model} failed`, e);
  }
  mesh = g.build();
  cache.set(key, mesh);
  return mesh;
}

export function modelForDef(def: BuildingDef, variant: number): ModelMesh {
  return getModel({
    model: def.model,
    w: def.w,
    h: def.h,
    wealth: def.wealth ?? 0,
    variant,
    zone: def.zone ?? 0,
    density: def.density ?? 0,
    name: def.name,
  });
}

export function hasModel(key: string): boolean {
  return key in MODELS;
}
