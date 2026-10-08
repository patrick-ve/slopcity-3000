import type { BuildingDef } from './catalog';
import type { Building } from './types';

/** A building that is finished, standing and not abandoned. */
export function isActive(b: Building): boolean {
  return b.build <= 0 && !b.abandoned;
}

/** Monthly power use (MW) of a building. */
export function powerUseOf(b: Building, def: BuildingDef): number {
  if (b.build > 0 || b.abandoned) return 0;
  if (def.growable) {
    const cap = def.cap ?? 0;
    if (def.zone === 1) return 0.2 + cap * 0.016;
    if (def.zone === 2) return 0.3 + cap * 0.03;
    return 0.5 + cap * (def.wealth === 2 ? 0.035 : 0.05);
  }
  if (def.residents) return def.powerUse ?? 0;
  return def.powerUse ?? 0;
}

/** Monthly water use (kL) of a building. */
export function waterUseOf(b: Building, def: BuildingDef): number {
  if (b.build > 0 || b.abandoned) return 0;
  if (def.growable) {
    const cap = def.cap ?? 0;
    if (def.zone === 1) return cap * 0.14;
    if (def.zone === 2) return cap * 0.1;
    return cap * (def.wealth === 0 ? 0.16 : 0.09);
  }
  return def.waterUse ?? 0;
}

/** Whether a building needs water to function well. */
export function needsWater(def: BuildingDef): boolean {
  if (def.growable) return (def.density ?? 1) >= 2 || (def.w ?? 1) >= 2;
  return (def.waterUse ?? 0) > 0;
}

export function needsPower(def: BuildingDef): boolean {
  if (def.growable) return true;
  if (def.power) return false;
  return (def.powerUse ?? 0) > 0;
}

/** Residents housed by a building (R zone or arcology). */
export function residentsOf(b: Building, def: BuildingDef): number {
  if (def.growable) return def.zone === 1 ? b.pop : 0;
  return def.residents ? b.pop : 0;
}
