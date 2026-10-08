import type { Department, ServiceKind, ZoneKind } from './types';

export type PlopCategory =
  | 'transport'
  | 'power'
  | 'water'
  | 'garbage'
  | 'safety'
  | 'healthEdu'
  | 'parks'
  | 'rewards';

export interface BuildingDef {
  id: string;
  name: string;
  /** Footprint in tiles (unrotated). */
  w: number;
  h: number;
  /** Procedural model key (see render/models). */
  model: string;
  desc?: string;

  // --- growables (zone-developed) ---
  growable?: boolean;
  zone?: ZoneKind;
  density?: number;
  wealth?: number;
  /** Residents (R) or jobs (C/I) at full occupancy. */
  cap?: number;

  // --- ploppables ---
  category?: PlopCategory;
  cost?: number;
  /** Monthly upkeep; negative means monthly income (business deals). */
  upkeep?: number;
  /** First year this building is available. */
  year?: number;
  /** Population needed to unlock (rewards). */
  reward?: number;
  /** Budget department that scales upkeep and effectiveness. */
  dept?: Department;

  power?: number; // MW produced
  water?: number; // kL produced per month
  powerUse?: number; // MW consumed (ploppables)
  waterUse?: number;
  pollution?: number; // 0..1 emission strength
  service?: { kind: ServiceKind; radius: number; strength: number };
  burn?: number; // tons of garbage burned per month
  recycle?: number; // fraction of garbage removed
  landValue?: { radius: number; amount: number };
  crime?: number; // added crime around the building
  residents?: number; // housing capacity for ploppables (arcology)
  demand?: { r?: number; c?: number; i?: number };
  needsShore?: boolean;
  needsRail?: boolean;
  /** Ground tint under the footprint (sRGB hex). */
  ground?: number;
  /** Can be destroyed by fire. */
  fireproof?: boolean;
}

const CONCRETE = 0xbdb8ae;
const PARK = 0x8fc45a;
const PAVED = 0xc9c4b8;

// ---------------------------------------------------------------- growables

type Row = [zone: 'R' | 'C' | 'I', density: number, wealth: number, size: number, cap: number, model: string, name: string];

const GROWABLE_ROWS: Row[] = [
  // Residential
  ['R', 1, 0, 1, 10, 'house', 'Bungalow'],
  ['R', 1, 1, 1, 8, 'house', 'Family House'],
  ['R', 1, 2, 1, 6, 'house', 'Villa'],
  ['R', 1, 2, 2, 16, 'mansion', 'Mansion'],
  ['R', 2, 0, 1, 28, 'townhouse', 'Row Houses'],
  ['R', 2, 1, 1, 24, 'townhouse', 'Townhouses'],
  ['R', 2, 2, 1, 20, 'townhouse', 'Brownstones'],
  ['R', 2, 0, 2, 180, 'apartments', 'Walk-up Apartments'],
  ['R', 2, 1, 2, 150, 'apartments', 'Apartments'],
  ['R', 2, 2, 2, 120, 'apartments', 'Condominiums'],
  ['R', 2, 0, 3, 420, 'apt_complex', 'Housing Complex'],
  ['R', 2, 1, 3, 360, 'apt_complex', 'Courtyard Apartments'],
  ['R', 2, 2, 3, 300, 'apt_complex', 'Garden Residences'],
  ['R', 3, 0, 1, 110, 'slim_tower', 'Tenement Tower'],
  ['R', 3, 1, 1, 100, 'slim_tower', 'Point Tower'],
  ['R', 3, 2, 1, 80, 'slim_tower', 'Luxury Point Tower'],
  ['R', 3, 0, 2, 700, 'res_tower', 'Housing Projects'],
  ['R', 3, 1, 2, 600, 'res_tower', 'High-rise Apartments'],
  ['R', 3, 2, 2, 480, 'res_tower', 'Luxury Condo Tower'],
  ['R', 3, 0, 3, 1500, 'res_megatower', 'Mega Block'],
  ['R', 3, 1, 3, 1300, 'res_megatower', 'Twin Residential Towers'],
  ['R', 3, 2, 3, 1100, 'res_megatower', 'Sky Residences'],
  // Commercial
  ['C', 1, 0, 1, 6, 'shop', 'Corner Shop'],
  ['C', 1, 0, 1, 8, 'gas_station', 'Gas Station'],
  ['C', 1, 1, 1, 8, 'shop', 'Diner'],
  ['C', 1, 2, 1, 10, 'shop', 'Boutique'],
  ['C', 1, 0, 2, 40, 'strip_mall', 'Strip Mall'],
  ['C', 1, 1, 2, 36, 'strip_mall', 'Supermarket'],
  ['C', 1, 2, 2, 30, 'strip_mall', 'Garden Market'],
  ['C', 2, 0, 1, 40, 'small_office', 'Small Offices'],
  ['C', 2, 1, 1, 40, 'small_office', 'Professional Building'],
  ['C', 2, 2, 1, 36, 'small_office', 'Bank'],
  ['C', 2, 0, 2, 180, 'office', 'Office Block'],
  ['C', 2, 1, 2, 200, 'office', 'Hotel'],
  ['C', 2, 2, 2, 220, 'office', 'Glass Offices'],
  ['C', 2, 0, 3, 380, 'mall', 'Shopping Mall'],
  ['C', 2, 1, 3, 420, 'mall', 'Department Store'],
  ['C', 2, 2, 3, 460, 'mall', 'Office Park'],
  ['C', 3, 0, 1, 150, 'slim_tower', 'Office Tower'],
  ['C', 3, 1, 1, 160, 'slim_tower', 'Corporate Tower'],
  ['C', 3, 2, 1, 170, 'slim_tower', 'Glass Tower'],
  ['C', 3, 0, 2, 800, 'skyscraper', 'Skyscraper'],
  ['C', 3, 1, 2, 900, 'skyscraper', 'Art Deco Skyscraper'],
  ['C', 3, 2, 2, 1000, 'skyscraper', 'Glass Skyscraper'],
  ['C', 3, 0, 3, 1800, 'megatower', 'Corporate Megatower'],
  ['C', 3, 1, 3, 2000, 'megatower', 'Twin Towers'],
  ['C', 3, 2, 3, 2300, 'megatower', 'Spire Tower'],
  // Industrial (wealth: 0 = heavy/dirty, 1 = manufacturing, 2 = high-tech)
  ['I', 1, 0, 1, 20, 'workshop', 'Workshop'],
  ['I', 1, 1, 1, 18, 'workshop', 'Small Warehouse'],
  ['I', 1, 2, 1, 16, 'tech_small', 'Tech Startup'],
  ['I', 1, 0, 2, 80, 'factory_small', 'Small Factory'],
  ['I', 1, 1, 2, 70, 'factory_small', 'Warehouse'],
  ['I', 1, 2, 2, 60, 'tech_lab', 'Research Lab'],
  ['I', 2, 0, 1, 30, 'tanks', 'Storage Tanks'],
  ['I', 2, 1, 1, 30, 'workshop', 'Machine Shop'],
  ['I', 2, 2, 1, 26, 'tech_small', 'Software House'],
  ['I', 2, 0, 2, 160, 'factory', 'Factory'],
  ['I', 2, 1, 2, 150, 'factory', 'Assembly Plant'],
  ['I', 2, 2, 2, 140, 'tech_lab', 'Electronics Plant'],
  ['I', 2, 0, 3, 380, 'factory_big', 'Heavy Factory'],
  ['I', 2, 1, 3, 340, 'factory_big', 'Distribution Center'],
  ['I', 2, 2, 3, 320, 'tech_campus', 'Tech Campus'],
  ['I', 3, 0, 1, 40, 'tanks', 'Tank Farm'],
  ['I', 3, 1, 1, 40, 'tanks', 'Grain Silo'],
  ['I', 3, 2, 1, 36, 'tech_small', 'Server Farm'],
  ['I', 3, 0, 2, 260, 'heavy_plant', 'Chemical Plant'],
  ['I', 3, 1, 2, 240, 'heavy_plant', 'Steel Mill'],
  ['I', 3, 2, 2, 220, 'tech_lab', 'Biotech Plant'],
  ['I', 3, 0, 3, 650, 'refinery', 'Refinery'],
  ['I', 3, 1, 3, 600, 'factory_big', 'Auto Plant'],
  ['I', 3, 2, 3, 560, 'tech_campus', 'Tech Headquarters'],
];

const ZONE_OF = { R: 1, C: 2, I: 3 } as const;

export const GROWABLES: BuildingDef[] = GROWABLE_ROWS.map(([z, d, w, s, cap, model, name]) => ({
  id: `${z}${d}${w}${s}_${model}`,
  name,
  w: s,
  h: s,
  model,
  growable: true,
  zone: ZONE_OF[z],
  density: d,
  wealth: w,
  cap,
}));

// --------------------------------------------------------------- ploppables

// prettier-ignore
export const PLOPPABLES: BuildingDef[] = [
  // ---- transport
  {
    id: 'bus_stop', name: 'Bus Stop', w: 1, h: 1, model: 'bus_stop', category: 'transport', cost: 150, upkeep: 6, year: 1920,
    dept: 'transit', service: { kind: 'transit', radius: 6, strength: 0.35 }, ground: PAVED,
    desc: 'Takes cars off nearby roads. Place it next to a road.',
  },
  {
    id: 'train_station', name: 'Train Station', w: 2, h: 2, model: 'train_station', category: 'transport', cost: 500, upkeep: 20, year: 1900,
    dept: 'transit', service: { kind: 'transit', radius: 11, strength: 0.6 }, needsRail: true, ground: PAVED, powerUse: 3,
    desc: 'Rail commuters reduce traffic. Must be next to rail tracks.',
  },
  {
    id: 'seaport', name: 'Seaport', w: 4, h: 4, model: 'seaport', category: 'transport', cost: 12000, upkeep: 90, year: 1900,
    needsShore: true, pollution: 0.35, demand: { i: 0.25 }, ground: CONCRETE, powerUse: 15, waterUse: 40,
    desc: 'Opens world markets to your industry. Must touch water.',
  },
  {
    id: 'airport', name: 'Airport', w: 6, h: 4, model: 'airport', category: 'transport', cost: 20000, upkeep: 140, year: 1930,
    pollution: 0.3, demand: { c: 0.25 }, ground: 0xa9b39a, powerUse: 25, waterUse: 60, landValue: { radius: 8, amount: -0.15 },
    desc: 'Business travellers boost commercial demand.',
  },

  // ---- power
  {
    id: 'coal_plant', name: 'Coal Power Plant', w: 4, h: 4, model: 'coal_plant', category: 'power', cost: 4000, upkeep: 45, year: 1900,
    power: 600, pollution: 1.0, ground: 0x9a958c, landValue: { radius: 6, amount: -0.2 },
    desc: 'Cheap, reliable and filthy. 600 MW.',
  },
  {
    id: 'oil_plant', name: 'Oil Power Plant', w: 4, h: 4, model: 'oil_plant', category: 'power', cost: 6500, upkeep: 60, year: 1900,
    power: 800, pollution: 0.8, ground: CONCRETE, landValue: { radius: 6, amount: -0.15 },
    desc: 'More power, a little less smoke. 800 MW.',
  },
  {
    id: 'gas_plant', name: 'Gas Power Plant', w: 3, h: 3, model: 'gas_plant', category: 'power', cost: 5000, upkeep: 55, year: 1950,
    power: 450, pollution: 0.4, ground: CONCRETE,
    desc: 'Cleaner burning natural gas. 450 MW.',
  },
  {
    id: 'nuclear_plant', name: 'Nuclear Power Plant', w: 4, h: 4, model: 'nuclear_plant', category: 'power', cost: 18000, upkeep: 130, year: 1955,
    power: 2200, pollution: 0.0, ground: CONCRETE, landValue: { radius: 8, amount: -0.25 }, waterUse: 100,
    desc: 'Massive clean output. Residents are nervous. 2,200 MW.',
  },
  {
    id: 'wind_turbine', name: 'Wind Turbine', w: 1, h: 1, model: 'wind_turbine', category: 'power', cost: 250, upkeep: 3, year: 1975,
    power: 25, pollution: 0,
    desc: 'Clean power. Produces more on high ground. ~25 MW.',
  },
  {
    id: 'solar_plant', name: 'Solar Power Plant', w: 3, h: 3, model: 'solar_plant', category: 'power', cost: 12000, upkeep: 45, year: 1985,
    power: 400, pollution: 0, ground: 0xb8b4a8,
    desc: 'Silent, spotless sunshine. 400 MW.',
  },
  {
    id: 'microwave_plant', name: 'Microwave Power Plant', w: 4, h: 4, model: 'microwave_plant', category: 'power', cost: 28000, upkeep: 160, year: 2020,
    power: 3500, pollution: 0, ground: CONCRETE,
    desc: 'Beams power down from an orbital collector. 3,500 MW.',
  },
  {
    id: 'fusion_plant', name: 'Fusion Power Plant', w: 4, h: 4, model: 'fusion_plant', category: 'power', cost: 40000, upkeep: 210, year: 2050,
    power: 6000, pollution: 0, ground: CONCRETE,
    desc: 'The power of a star, in a box. 6,000 MW.',
  },

  // ---- water
  {
    id: 'water_pump', name: 'Water Pump', w: 1, h: 1, model: 'water_pump', category: 'water', cost: 120, upkeep: 5, year: 1900,
    water: 800, powerUse: 2, ground: CONCRETE,
    desc: 'Pumps 800 kL. Pumps 50% more next to fresh water. Needs power.',
  },
  {
    id: 'water_tower', name: 'Water Tower', w: 1, h: 1, model: 'water_tower', category: 'water', cost: 300, upkeep: 6, year: 1900,
    water: 500, powerUse: 1,
    desc: 'Stores and supplies 500 kL. Needs power.',
  },
  {
    id: 'water_treatment', name: 'Water Treatment Plant', w: 2, h: 2, model: 'water_treatment', category: 'water', cost: 3000, upkeep: 50, year: 1950,
    powerUse: 8, ground: CONCRETE, service: { kind: 'health', radius: 30, strength: 0.25 }, dept: 'health',
    desc: 'Clean water raises the health of the whole city.',
  },
  {
    id: 'desalination', name: 'Desalination Plant', w: 2, h: 2, model: 'desalination', category: 'water', cost: 2500, upkeep: 40, year: 1960,
    water: 3000, powerUse: 10, needsShore: true, ground: CONCRETE,
    desc: 'Turns sea water into 3,000 kL of drinking water. Must touch water.',
  },

  // ---- garbage
  {
    id: 'incinerator', name: 'Incinerator', w: 2, h: 2, model: 'incinerator', category: 'garbage', cost: 3500, upkeep: 40, year: 1900,
    burn: 400, pollution: 0.7, powerUse: 6, ground: 0x9a958c, landValue: { radius: 5, amount: -0.2 },
    desc: 'Burns 400 tons of garbage a month. Smoky.',
  },
  {
    id: 'waste_to_energy', name: 'Waste-to-Energy Plant', w: 3, h: 3, model: 'waste_to_energy', category: 'garbage', cost: 9000, upkeep: 70, year: 1975,
    burn: 700, power: 200, pollution: 0.45, ground: CONCRETE, landValue: { radius: 5, amount: -0.15 },
    desc: 'Burns 700 tons a month and makes 200 MW.',
  },
  {
    id: 'recycling_center', name: 'Recycling Center', w: 2, h: 2, model: 'recycling_center', category: 'garbage', cost: 2000, upkeep: 30, year: 1970,
    recycle: 0.25, powerUse: 4, ground: CONCRETE,
    desc: 'Cuts city garbage by 25%.',
  },

  // ---- safety
  {
    id: 'police_station', name: 'Police Station', w: 2, h: 2, model: 'police_station', category: 'safety', cost: 600, upkeep: 60, year: 1900,
    dept: 'police', service: { kind: 'police', radius: 14, strength: 1 }, powerUse: 2, ground: PAVED,
    desc: 'Fights crime in the area.',
  },
  {
    id: 'fire_station', name: 'Fire Station', w: 2, h: 2, model: 'fire_station', category: 'safety', cost: 600, upkeep: 60, year: 1900,
    dept: 'fire', service: { kind: 'fire', radius: 14, strength: 1 }, powerUse: 2, ground: PAVED, fireproof: true,
    desc: 'Prevents fires and puts them out fast.',
  },

  // ---- health & education
  {
    id: 'clinic', name: 'Clinic', w: 1, h: 1, model: 'clinic', category: 'healthEdu', cost: 400, upkeep: 30, year: 1900,
    dept: 'health', service: { kind: 'health', radius: 8, strength: 0.6 }, powerUse: 1, ground: PAVED,
    desc: 'A small neighbourhood health clinic.',
  },
  {
    id: 'hospital', name: 'Hospital', w: 3, h: 3, model: 'hospital', category: 'healthEdu', cost: 3000, upkeep: 150, year: 1900,
    dept: 'health', service: { kind: 'health', radius: 20, strength: 1 }, powerUse: 8, waterUse: 30, ground: PAVED,
    desc: 'Raises life expectancy across a wide area.',
  },
  {
    id: 'school', name: 'Elementary School', w: 2, h: 2, model: 'school', category: 'healthEdu', cost: 1200, upkeep: 80, year: 1900,
    dept: 'education', service: { kind: 'education', radius: 14, strength: 0.8 }, powerUse: 3, ground: 0x9fc76a,
    desc: 'Educates the children of the neighbourhood.',
  },
  {
    id: 'college', name: 'College', w: 3, h: 3, model: 'college', category: 'healthEdu', cost: 6000, upkeep: 220, year: 1900,
    dept: 'education', service: { kind: 'education', radius: 28, strength: 1 }, powerUse: 8, ground: 0x9fc76a,
    landValue: { radius: 8, amount: 0.1 },
    desc: 'Higher education attracts high-tech industry.',
  },
  {
    id: 'library', name: 'Library', w: 1, h: 1, model: 'library', category: 'healthEdu', cost: 400, upkeep: 25, year: 1900,
    dept: 'education', service: { kind: 'education', radius: 10, strength: 0.45 }, powerUse: 1, ground: PAVED,
    desc: 'Lifelong learning for the neighbourhood.',
  },
  {
    id: 'museum', name: 'Museum', w: 2, h: 2, model: 'museum', category: 'healthEdu', cost: 1500, upkeep: 50, year: 1900,
    dept: 'education', service: { kind: 'education', radius: 16, strength: 0.4 }, powerUse: 2, ground: PAVED,
    landValue: { radius: 8, amount: 0.12 },
    desc: 'Culture! Raises education and land value.',
  },

  // ---- parks & recreation
  {
    id: 'small_park', name: 'Small Park', w: 1, h: 1, model: 'small_park', category: 'parks', cost: 60, upkeep: 1, year: 1900,
    dept: 'parks', service: { kind: 'parks', radius: 5, strength: 0.45 }, ground: PARK, fireproof: true,
  },
  {
    id: 'plaza', name: 'Plaza', w: 1, h: 1, model: 'plaza', category: 'parks', cost: 120, upkeep: 2, year: 1900,
    dept: 'parks', service: { kind: 'parks', radius: 5, strength: 0.4 }, ground: PAVED, fireproof: true,
  },
  {
    id: 'playground', name: 'Playground', w: 1, h: 1, model: 'playground', category: 'parks', cost: 100, upkeep: 2, year: 1900,
    dept: 'parks', service: { kind: 'parks', radius: 6, strength: 0.5 }, ground: PARK, fireproof: true,
  },
  {
    id: 'sports_field', name: 'Sports Field', w: 2, h: 2, model: 'sports_field', category: 'parks', cost: 400, upkeep: 6, year: 1900,
    dept: 'parks', service: { kind: 'parks', radius: 9, strength: 0.6 }, ground: PARK, fireproof: true,
  },
  {
    id: 'large_park', name: 'Large Park', w: 3, h: 3, model: 'large_park', category: 'parks', cost: 600, upkeep: 8, year: 1900,
    dept: 'parks', service: { kind: 'parks', radius: 11, strength: 0.85 }, ground: PARK, fireproof: true,
  },
  {
    id: 'marina', name: 'Marina', w: 2, h: 2, model: 'marina', category: 'parks', cost: 800, upkeep: 10, year: 1900,
    dept: 'parks', service: { kind: 'parks', radius: 10, strength: 0.7 }, needsShore: true, ground: PAVED, fireproof: true,
    landValue: { radius: 6, amount: 0.12 },
  },
  {
    id: 'zoo', name: 'Zoo', w: 3, h: 3, model: 'zoo', category: 'parks', cost: 2500, upkeep: 30, year: 1900,
    dept: 'parks', service: { kind: 'parks', radius: 16, strength: 0.8 }, ground: PARK, powerUse: 2,
  },
  {
    id: 'stadium', name: 'Stadium', w: 4, h: 4, model: 'stadium', category: 'parks', cost: 6000, upkeep: 60, year: 1920,
    dept: 'parks', service: { kind: 'parks', radius: 18, strength: 0.7 }, ground: PAVED, powerUse: 10, demand: { r: 0.08, c: 0.05 },
  },

  // ---- rewards & business deals
  {
    id: 'mayor_house', name: "Mayor's House", w: 2, h: 2, model: 'mayor_house', category: 'rewards', cost: 0, upkeep: 0, reward: 1200,
    landValue: { radius: 9, amount: 0.25 }, ground: PARK,
    desc: 'Your citizens built you a home. Raises nearby land value.',
  },
  {
    id: 'city_hall', name: 'City Hall', w: 3, h: 3, model: 'city_hall', category: 'rewards', cost: 0, upkeep: 0, reward: 5000,
    landValue: { radius: 10, amount: 0.2 }, demand: { r: 0.04, c: 0.04, i: 0.04 }, ground: PAVED, powerUse: 2,
    desc: 'The seat of government. Boosts demand a little.',
  },
  {
    id: 'statue', name: 'Statue of the Mayor', w: 1, h: 1, model: 'statue', category: 'rewards', cost: 0, upkeep: 0, reward: 12000,
    landValue: { radius: 6, amount: 0.2 }, ground: PAVED, fireproof: true,
    desc: 'A modest, tasteful, enormous likeness of you.',
  },
  {
    id: 'landmark_tower', name: 'SlopCity Tower', w: 2, h: 2, model: 'landmark_tower', category: 'rewards', cost: 0, upkeep: 0, reward: 30000,
    landValue: { radius: 14, amount: 0.3 }, demand: { c: 0.08 }, ground: PAVED, powerUse: 5,
    desc: 'An iconic observation tower. Tourists love it.',
  },
  {
    id: 'arcology', name: 'Arcology', w: 4, h: 4, model: 'arcology', category: 'rewards', cost: 100000, upkeep: 300, reward: 60000, year: 2000,
    residents: 8000, powerUse: 120, waterUse: 900, ground: PAVED,
    desc: 'A self-contained city in one building. Houses 8,000 people.',
  },
  {
    id: 'casino', name: 'Casino', w: 2, h: 2, model: 'casino', category: 'rewards', cost: 0, upkeep: -450, reward: 8000,
    crime: 0.35, powerUse: 6, ground: PAVED,
    desc: 'Business deal: pays §450/month but attracts crime.',
  },
  {
    id: 'prison', name: 'Maximum Security Prison', w: 3, h: 3, model: 'prison', category: 'rewards', cost: 0, upkeep: -700, reward: 15000,
    landValue: { radius: 10, amount: -0.3 }, powerUse: 6, ground: 0x9a958c, fireproof: true,
    desc: 'Business deal: pays §700/month. Nobody wants to live next door.',
  },
  {
    id: 'toxic_dump', name: 'Toxic Waste Dump', w: 3, h: 3, model: 'toxic_dump', category: 'rewards', cost: 0, upkeep: -1100, reward: 25000,
    pollution: 1.0, landValue: { radius: 12, amount: -0.4 }, ground: 0x7a7a4a, fireproof: true,
    desc: 'Business deal: pays §1,100/month. Glows a little at night.',
  },
];

export const DEFS: Record<string, BuildingDef> = {};
for (const d of [...GROWABLES, ...PLOPPABLES]) DEFS[d.id] = d;

export function getDef(id: string): BuildingDef {
  const d = DEFS[id];
  if (!d) throw new Error(`Unknown building def ${id}`);
  return d;
}

/** Growable templates indexed by zone/density/wealth/size. */
export function growablesFor(zone: ZoneKind, density: number, wealth: number, size: number): BuildingDef[] {
  return GROWABLES.filter((g) => g.zone === zone && g.density === density && g.wealth === wealth && g.w === size);
}

export const PLOP_CATEGORY_NAMES: Record<PlopCategory, string> = {
  transport: 'Transportation',
  power: 'Power',
  water: 'Water',
  garbage: 'Garbage',
  safety: 'Police & Fire',
  healthEdu: 'Health & Education',
  parks: 'Parks & Recreation',
  rewards: 'Rewards & Deals',
};

/** Costs of network/zone tools (per tile). */
export const COSTS = {
  road: 10,
  bridge: 60,
  rail: 20,
  railBridge: 80,
  powerLine: 5,
  pipe: 3,
  zone: [0, 5, 10, 20] as number[], // by density
  landfill: 20,
  bulldoze: 5,
  bulldozeBuilding: 10, // per footprint tile
  tree: 3,
  terraform: 25, // per corner level changed
  dezone: 1,
} as const;

/** Monthly maintenance per tile. */
export const MAINTENANCE = {
  road: 0.1,
  rail: 0.25,
  powerLine: 0.02,
  pipe: 0.01,
} as const;
