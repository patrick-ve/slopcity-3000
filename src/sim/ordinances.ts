export type OrdinanceCategory = 'finance' | 'safety' | 'health' | 'environment' | 'transport' | 'promotion';

export interface Ordinance {
  id: string;
  name: string;
  category: OrdinanceCategory;
  desc: string;
  /** Fixed monthly cost (negative = income). */
  base: number;
  /** Additional monthly cost per 1,000 residents (negative = income). */
  perK: number;
  /** Population needed before the ordinance becomes available. */
  minPop?: number;
}

export const ORDINANCES: Ordinance[] = [
  // finance
  { id: 'sales_tax', name: 'Sales Tax', category: 'finance', base: 0, perK: -14, desc: '+Income. Commercial demand drops a little.', minPop: 2000 },
  { id: 'income_tax', name: 'Income Tax', category: 'finance', base: 0, perK: -16, desc: '+Income. Residential demand drops a little.', minPop: 2000 },
  { id: 'parking_fines', name: 'Parking Fines', category: 'finance', base: 0, perK: -5, desc: '+Income. Slightly lowers commercial demand.', minPop: 500 },
  { id: 'gambling', name: 'Legalized Gambling', category: 'finance', base: 0, perK: -12, desc: '+Income, but crime rises everywhere.', minPop: 3000 },
  // safety
  { id: 'neighborhood_watch', name: 'Neighborhood Watch', category: 'safety', base: 20, perK: 4, desc: 'Reduces crime by 10%.' },
  { id: 'youth_curfew', name: 'Youth Curfew', category: 'safety', base: 30, perK: 5, desc: 'Reduces crime. Teenagers are not amused.', minPop: 1000 },
  { id: 'volunteer_fire', name: 'Volunteer Fire Department', category: 'safety', base: 25, perK: 3, desc: 'Gives every area some fire protection.' },
  { id: 'smoke_detectors', name: 'Smoke Detector Program', category: 'safety', base: 15, perK: 3, desc: 'Fewer fires start.' },
  // health & education
  { id: 'free_clinics', name: 'Free Clinics', category: 'health', base: 40, perK: 8, desc: 'Raises life expectancy.', minPop: 1000 },
  { id: 'smoking_ban', name: 'Public Smoking Ban', category: 'health', base: 10, perK: 2, desc: 'Better health, slightly lower commercial demand.' },
  { id: 'pro_reading', name: 'Pro-Reading Campaign', category: 'health', base: 30, perK: 5, desc: 'Raises the education level of the city.' },
  // environment
  { id: 'clean_air', name: 'Clean Air Act', category: 'environment', base: 50, perK: 6, desc: 'Cuts industrial and plant pollution by 25%. Industry demand falls.', minPop: 1000 },
  { id: 'recycling', name: 'Recycling Program', category: 'environment', base: 30, perK: 5, desc: 'Cuts garbage by 15%.' },
  { id: 'water_conservation', name: 'Water Conservation', category: 'environment', base: 20, perK: 4, desc: 'Cuts water use by 20%.' },
  { id: 'power_conservation', name: 'Power Conservation', category: 'environment', base: 20, perK: 4, desc: 'Cuts power use by 20%.' },
  { id: 'tree_planting', name: 'Tree Planting Program', category: 'environment', base: 15, perK: 2, desc: 'Citizens plant trees in parks and yards over time.' },
  // transport
  { id: 'carpool', name: 'Carpool Incentive', category: 'transport', base: 25, perK: 5, desc: 'Reduces traffic by 10%.' },
  { id: 'commuter_shuttle', name: 'Commuter Shuttle Service', category: 'transport', base: 40, perK: 7, desc: 'Reduces traffic by 15%.', minPop: 5000 },
  // promotion
  { id: 'tourism', name: 'Tourism Promotion', category: 'promotion', base: 60, perK: 4, desc: 'Boosts commercial demand.', minPop: 2000 },
  { id: 'business_promo', name: 'Business Promotion', category: 'promotion', base: 60, perK: 4, desc: 'Boosts industrial demand.', minPop: 2000 },
  { id: 'city_beautification', name: 'City Beautification', category: 'promotion', base: 40, perK: 5, desc: 'Raises land value a little everywhere.' },
  { id: 'nuclear_free', name: 'Nuclear Free Zone', category: 'promotion', base: 0, perK: 0, desc: 'Bans nuclear power. Residents feel safer (+R demand).' },
];

export const ORDINANCE_BY_ID: Record<string, Ordinance> = Object.fromEntries(ORDINANCES.map((o) => [o.id, o]));

export const ORDINANCE_CATEGORY_NAMES: Record<OrdinanceCategory, string> = {
  finance: 'Finance',
  safety: 'Safety',
  health: 'Health & Education',
  environment: 'Environment',
  transport: 'Transportation',
  promotion: 'Promotion & Image',
};

export function ordinanceMonthly(o: Ordinance, population: number): number {
  return o.base + (o.perK * population) / 1000;
}
