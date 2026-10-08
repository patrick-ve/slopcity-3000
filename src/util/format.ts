export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}§${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

export function int(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(0)}k`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export interface CalendarDate {
  year: number;
  month: number; // 0..11
  day: number; // 1..31
}

/** Convert a day counter (days since Jan 1 of startYear) into a calendar date. */
export function dayToDate(dayIndex: number, startYear: number): CalendarDate {
  const year = startYear + Math.floor(dayIndex / 365);
  let d = dayIndex % 365;
  let month = 0;
  while (d >= MONTH_DAYS[month]) {
    d -= MONTH_DAYS[month];
    month++;
  }
  return { year, month, day: d + 1 };
}

export function formatDate(dayIndex: number, startYear: number): string {
  const d = dayToDate(dayIndex, startYear);
  return `${MONTHS[d.month]} ${d.day}, ${d.year}`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
