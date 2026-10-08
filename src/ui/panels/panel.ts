/** Shared panel interface and formatting helpers for the game windows. */
import { UIWindow } from '../window';
import { money } from '../../util/format';

export interface Panel {
  win: UIWindow;
  refresh(): void;
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${money(n)}`;
}
