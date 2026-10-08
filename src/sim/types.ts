export const Zone = { None: 0, R: 1, C: 2, I: 3, Landfill: 4 } as const;
export type ZoneKind = 0 | 1 | 2 | 3 | 4;
export const ZONE_NAMES = ['Unzoned', 'Residential', 'Commercial', 'Industrial', 'Landfill'] as const;
export const ZONE_LETTER = ['', 'R', 'C', 'I', 'L'] as const;
export const DENSITY_NAMES = ['', 'Light', 'Medium', 'Dense'] as const;
export const WEALTH_NAMES = ['§', '§§', '§§§'] as const;

/** Bit flags stored per tile in World.net. */
export const NET = {
  ROAD: 1,
  RAIL: 2,
  POWER: 4,
  PIPE: 8,
  /** Underground subway line. */
  SUBWAY: 16,
  /** Elevated highway (can run above roads and rails). */
  HIGHWAY: 32,
} as const;

export type ServiceKind = 'police' | 'fire' | 'health' | 'education' | 'parks' | 'transit';
export const SERVICE_KINDS: ServiceKind[] = ['police', 'fire', 'health', 'education', 'parks', 'transit'];

/** Budget departments with adjustable funding. */
export type Department = 'police' | 'fire' | 'health' | 'education' | 'transit' | 'parks' | 'roads';
export const DEPARTMENTS: Department[] = ['police', 'fire', 'health', 'education', 'transit', 'parks', 'roads'];
export const DEPARTMENT_NAMES: Record<Department, string> = {
  police: 'Police',
  fire: 'Fire',
  health: 'Health',
  education: 'Education',
  transit: 'Mass Transit',
  parks: 'Parks & Recreation',
  roads: 'Transportation',
};

export interface Building {
  id: number;
  /** Catalog id. */
  def: string;
  /** Top-left tile and footprint (already rotated). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation 0..3 (front faces +z, -x, -z, +x). */
  rot: number;
  /** Model variant 0..7. */
  variant: number;
  /** 0..255, randomises lit windows. */
  seed: number;
  /** Residents (R, arcology), jobs (C/I) or 0. */
  pop: number;
  /** Construction days remaining (0 = complete). */
  build: number;
  powered: boolean;
  watered: boolean;
  abandoned: boolean;
  /** Remaining burn days (0 = not burning). */
  fire: number;
  /** Months since completion. */
  age: number;
  /** Months with bad conditions; drives abandonment. */
  unhappy: number;
}

/** Progress of a scenario (see game/scenarios.ts). */
export interface ScenarioState {
  id: string;
  /** Game days: start of the scenario and its deadline. */
  start: number;
  deadline: number;
  status: 'active' | 'won' | 'lost';
  /** Goal targets fixed when the scenario started (some depend on the starting city). */
  targets?: number[];
}

export type Speed = 0 | 1 | 2 | 3;
export const SPEED_NAMES = ['Paused', 'Turtle', 'Llama', 'Cheetah'] as const;
/** Real milliseconds per simulated day for each speed. */
export const DAY_MS = [Infinity, 420, 140, 36] as const;

export type Difficulty = 'easy' | 'medium' | 'hard';
export const START_FUNDS: Record<Difficulty, number> = { easy: 50000, medium: 20000, hard: 10000 };

export interface Tax {
  R: number;
  C: number;
  I: number;
}

export interface Loan {
  id: number;
  principal: number;
  remaining: number;
  /** Monthly payment. */
  payment: number;
  rate: number;
}

export interface HistoryPoint {
  /** Month index since start. */
  m: number;
  pop: number;
  res: number;
  com: number;
  ind: number;
  funds: number;
  income: number;
  expense: number;
  pollution: number;
  crime: number;
  landValue: number;
  traffic: number;
  eq: number;
  le: number;
  power: number;
  powerCap: number;
  water: number;
  waterCap: number;
}

export interface MonthlyReport {
  income: {
    resTax: number;
    comTax: number;
    indTax: number;
    ordinances: number;
    deals: number;
  };
  expense: {
    departments: Record<Department, number>;
    utilities: number;
    ordinances: number;
    loans: number;
    deals: number;
  };
  total: number;
}
