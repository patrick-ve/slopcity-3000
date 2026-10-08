/** Growable building models by model key. */
import type { ModelFn } from '../types';
import { apartments, aptComplex, house, mansion, resMegatower, resTower, slimTower, townhouse } from './residential';
import { gasStation, mall, megatower, office, shop, skyscraper, smallOffice, stripMall } from './commercial';
import { factory, factoryBig, factorySmall, heavyPlant, refinery, tanks, techCampus, techLab, techSmall, workshop } from './industrial';
import { lotTree, pine } from './shared';

export const GROWABLE_MODELS: Record<string, ModelFn> = {
  house,
  mansion,
  townhouse,
  apartments,
  apt_complex: aptComplex,
  slim_tower: slimTower,
  res_tower: resTower,
  res_megatower: resMegatower,
  shop,
  gas_station: gasStation,
  strip_mall: stripMall,
  small_office: smallOffice,
  office,
  mall,
  skyscraper,
  megatower,
  workshop,
  tech_small: techSmall,
  factory_small: factorySmall,
  tech_lab: techLab,
  tanks,
  factory,
  factory_big: factoryBig,
  tech_campus: techCampus,
  heavy_plant: heavyPlant,
  refinery,
};

// Exported for reuse by other model files.
export { lotTree, pine };
