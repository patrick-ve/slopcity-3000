import type { ZoneKind } from '../sim/types';
import { COSTS, LINE_YEARS, PLOPPABLES, type PlopCategory } from '../sim/catalog';
import {
  linePath,
  planBulldoze,
  planDezone,
  planLine,
  planPlace,
  planTerraform,
  planTrees,
  planZone,
  type LineKind,
  type Plan,
} from '../sim/actions';
import { modelForDef } from '../render/models';
import { getDef } from '../sim/catalog';
import type { PickResult } from '../render/picker';
import type { PreviewTile } from '../render/preview';
import type { Game } from './game';

export type ToolKind = 'query' | 'bulldoze' | 'dezone' | 'raise' | 'lower' | 'level' | 'trees' | 'zone' | 'line' | 'place';

export interface ToolSpec {
  key: string;
  kind: ToolKind;
  name: string;
  sub?: string;
  icon: string;
  color?: string;
  zone?: ZoneKind;
  density?: number;
  line?: LineKind;
  def?: string;
  hotkey?: string;
  group?: string;
  /** First year the tool can be used. */
  year?: number;
}

export interface ToolCategory {
  id: string;
  name: string;
  icon: string;
  tools: ToolSpec[];
  hotkey?: string;
}

const ZONE_COLORS = ['', '#4fe39a', '#5aa9ff', '#ffc94d', '#a07a4c'];

function plopTools(cat: PlopCategory, icon: string): ToolSpec[] {
  return PLOPPABLES.filter((d) => d.category === cat).map((d) => ({
    key: `place:${d.id}`,
    kind: 'place' as const,
    name: d.name,
    sub: d.desc ?? `${d.w}×${d.h}`,
    icon,
    def: d.id,
    group: cat === 'rewards' ? ((d.upkeep ?? 0) < 0 ? 'Business deals' : 'Rewards') : undefined,
  }));
}

export const QUERY_TOOL: ToolSpec = {
  key: 'query',
  kind: 'query',
  name: 'Query',
  sub: 'Inspect a tile or building',
  icon: 'query',
  hotkey: 'Esc',
};

export const CATEGORIES: ToolCategory[] = [
  { id: 'query', name: 'Query', icon: 'query', tools: [QUERY_TOOL] },
  {
    id: 'landscape',
    name: 'Bulldoze & Landscape',
    icon: 'bulldoze',
    hotkey: 'B',
    tools: [
      { key: 'bulldoze', kind: 'bulldoze', name: 'Bulldoze', sub: 'Demolish anything (drag an area)', icon: 'bulldoze', hotkey: 'B' },
      { key: 'dezone', kind: 'dezone', name: 'De-zone', sub: 'Remove zoning from empty land', icon: 'dezone' },
      { key: 'raise', kind: 'raise', name: 'Raise Terrain', sub: `§${COSTS.terraform} per corner level`, icon: 'raise' },
      { key: 'lower', kind: 'lower', name: 'Lower Terrain', sub: `§${COSTS.terraform} per corner level`, icon: 'lower' },
      { key: 'level', kind: 'level', name: 'Level Terrain', sub: 'Flatten to the height where you start', icon: 'level' },
      { key: 'trees', kind: 'trees', name: 'Plant Trees', sub: `§${COSTS.tree} per tile`, icon: 'tree' },
    ],
  },
  {
    id: 'zones',
    name: 'Zones',
    icon: 'zones',
    hotkey: 'Z',
    tools: [
      ...([1, 2, 3] as const).map((d) => ({
        key: `zone:R${d}`,
        kind: 'zone' as const,
        name: `${['', 'Light', 'Medium', 'Dense'][d]} Residential`,
        sub: `§${COSTS.zone[d]} per tile`,
        icon: 'zones',
        color: ZONE_COLORS[1],
        zone: 1 as ZoneKind,
        density: d,
        group: 'Residential',
      })),
      ...([1, 2, 3] as const).map((d) => ({
        key: `zone:C${d}`,
        kind: 'zone' as const,
        name: `${['', 'Light', 'Medium', 'Dense'][d]} Commercial`,
        sub: `§${COSTS.zone[d]} per tile`,
        icon: 'zones',
        color: ZONE_COLORS[2],
        zone: 2 as ZoneKind,
        density: d,
        group: 'Commercial',
      })),
      ...([1, 2, 3] as const).map((d) => ({
        key: `zone:I${d}`,
        kind: 'zone' as const,
        name: `${['', 'Light', 'Medium', 'Dense'][d]} Industrial`,
        sub: `§${COSTS.zone[d]} per tile`,
        icon: 'zones',
        color: ZONE_COLORS[3],
        zone: 3 as ZoneKind,
        density: d,
        group: 'Industrial',
      })),
      {
        key: 'zone:L',
        kind: 'zone',
        name: 'Landfill',
        sub: `§${COSTS.landfill} per tile · stores garbage`,
        icon: 'garbage',
        color: ZONE_COLORS[4],
        zone: 4,
        density: 1,
        group: 'Special',
      },
    ],
  },
  {
    id: 'transport',
    name: 'Transportation',
    icon: 'road',
    hotkey: 'R',
    tools: [
      {
        key: 'line:road',
        kind: 'line',
        line: 'road',
        name: 'Road',
        sub: `§${COSTS.road}/tile · bridges §${COSTS.bridge}`,
        icon: 'road',
        hotkey: 'R',
      },
      { key: 'line:rail', kind: 'line', line: 'rail', name: 'Rail', sub: `§${COSTS.rail}/tile`, icon: 'rail' },
      {
        key: 'line:highway',
        kind: 'line',
        line: 'highway',
        name: 'Highway',
        sub: `§${COSTS.highway}/tile · elevated, needs on-ramps`,
        icon: 'highway',
        year: LINE_YEARS.highway,
      },
      {
        key: 'line:subway',
        kind: 'line',
        line: 'subway',
        name: 'Subway',
        sub: `§${COSTS.subway}/tile · underground, needs stations`,
        icon: 'subway',
        year: LINE_YEARS.subway,
      },
      ...plopTools('transport', 'transport'),
    ],
  },
  {
    id: 'power',
    name: 'Power',
    icon: 'power',
    hotkey: 'P',
    tools: [
      {
        key: 'line:power',
        kind: 'line',
        line: 'power',
        name: 'Power Line',
        sub: `§${COSTS.powerLine}/tile · must cross roads`,
        icon: 'powerline',
        hotkey: 'P',
      },
      ...plopTools('power', 'power'),
    ],
  },
  {
    id: 'water',
    name: 'Water',
    icon: 'water',
    hotkey: 'U',
    tools: [
      {
        key: 'line:pipe',
        kind: 'line',
        line: 'pipe',
        name: 'Water Pipe',
        sub: `§${COSTS.pipe}/tile · underground`,
        icon: 'pipe',
        hotkey: 'U',
      },
      ...plopTools('water', 'water'),
    ],
  },
  { id: 'garbage', name: 'Garbage', icon: 'garbage', tools: plopTools('garbage', 'garbage') },
  { id: 'safety', name: 'Police & Fire', icon: 'safety', tools: plopTools('safety', 'safety') },
  { id: 'healthEdu', name: 'Health & Education', icon: 'education', tools: plopTools('healthEdu', 'health') },
  { id: 'parks', name: 'Parks & Recreation', icon: 'parks', tools: plopTools('parks', 'parks') },
  { id: 'rewards', name: 'Rewards & Deals', icon: 'rewards', tools: plopTools('rewards', 'trophy') },
];

export function findTool(key: string): ToolSpec | undefined {
  for (const c of CATEGORIES) for (const t of c.tools) if (t.key === key) return t;
  return undefined;
}

const RED = 0xef4444;
const DIM = 0x9aa6b5;
const LINE_COLORS: Record<LineKind, number> = {
  road: 0x4ade80,
  rail: 0xe7e5e4,
  power: 0xfde047,
  pipe: 0x38bdf8,
  highway: 0xfb923c,
  subway: 0xc084fc,
};
const ZONE_HEX = [0, 0x4fe39a, 0x5aa9ff, 0xffc94d, 0xa07a4c];

export interface TooltipInfo {
  text: string;
  cost?: number;
  bad?: string;
}

/** Turns pointer input into plans, previews and applied actions. */
export class ToolController {
  tool: ToolSpec = QUERY_TOOL;
  rot: number | 'auto' = 'auto';
  hover: PickResult | null = null;
  drag: { tx: number; ty: number } | null = null;
  plan: Plan | null = null;
  flip = false;
  tooltip: TooltipInfo | null = null;
  private lastKey = '';

  constructor(private game: Game) {}

  setTool(spec: ToolSpec): void {
    this.tool = spec;
    this.drag = null;
    this.plan = null;
    this.lastKey = '';
    if (spec.kind !== 'place') this.rot = 'auto';
    const wantUnder = spec.kind === 'line' && (spec.line === 'pipe' || spec.line === 'subway');
    this.game.setUnderground(wantUnder || (this.game.undergroundManual && spec.kind === 'bulldoze'));
    this.refresh();
  }

  rotate(): void {
    const cur = this.rot === 'auto' ? (this.plan?.rot ?? 0) : this.rot;
    this.rot = (cur + 1) % 4;
    this.lastKey = '';
    this.refresh();
  }

  cancel(): void {
    if (this.drag) {
      this.abort();
    } else if (this.tool.kind !== 'query') {
      this.setTool(QUERY_TOOL);
    }
  }

  /** Drop an unfinished drag without applying it (keeps the current tool). */
  abort(): void {
    this.drag = null;
    this.lastKey = '';
    this.refresh();
  }

  get isDragTool(): boolean {
    const k = this.tool.kind;
    return (
      k === 'zone' || k === 'dezone' || k === 'bulldoze' || k === 'trees' || k === 'level' || k === 'line' || k === 'raise' || k === 'lower'
    );
  }

  move(hit: PickResult | null, shift: boolean): void {
    this.hover = hit;
    this.flip = shift;
    this.refresh();
  }

  down(hit: PickResult | null): void {
    this.hover = hit;
    if (!hit) return;
    if (this.tool.kind === 'query') {
      this.game.ui.showQuery(hit.tx, hit.ty);
      return;
    }
    if (this.tool.kind === 'place') {
      this.refresh();
      this.commit();
      return;
    }
    if (this.isDragTool) {
      this.drag = { tx: hit.tx, ty: hit.ty };
      this.lastKey = '';
      this.refresh();
    }
  }

  up(hit: PickResult | null): void {
    if (hit) this.hover = hit;
    if (!this.drag) return;
    this.refresh();
    this.commit();
    this.drag = null;
    this.lastKey = '';
    this.refresh();
  }

  private commit(): void {
    const plan = this.plan;
    if (!plan) return;
    if (!plan.ok) {
      if (plan.reason && plan.reason !== 'Nothing to do here') {
        this.game.sfx.play('error');
        this.game.ui.toast({ title: "Can't do that", text: plan.reason, kind: 'warn' }, 2500);
      }
      return;
    }
    const sim = this.game.sim;
    if (!sim || !this.game.undo.apply(sim, plan, this.tool.name)) return;
    const r = this.game.renderer;
    if (plan.kind === 'place' && plan.def) {
      r.dust(plan.x! + plan.w! / 2, plan.y! + plan.h! / 2, Math.max(plan.w!, plan.h!) * 0.6);
    } else if (plan.kind === 'bulldoze') {
      for (const t of plan.tiles) if (t.change && Math.random() < 0.5) r.dust(t.x + 0.5, t.y + 0.5, 0.6);
    }
    this.lastKey = '';
  }

  /** Recompute the plan for the current hover/drag and update the preview. */
  refresh(): void {
    const g = this.game;
    const sim = g.sim;
    const preview = g.renderer.preview;
    if (!sim || !preview) return;
    const h = this.hover;
    if (!h) {
      preview.clear();
      this.tooltip = null;
      this.plan = null;
      return;
    }
    const key = `${this.tool.key}|${h.tx},${h.ty}|${this.drag?.tx},${this.drag?.ty}|${this.flip}|${this.rot}|${Math.floor(sim.city.funds)}|${sim.world.buildVersion}|${sim.world.roadVersion}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const t = this.tool;
    const a = this.drag ?? { tx: h.tx, ty: h.ty };
    let plan: Plan | null = null;
    const tiles: PreviewTile[] = [];
    preview.showGhost(null, '', 0, 0, 0, 1, 1, true);
    switch (t.kind) {
      case 'query': {
        const b = sim.world.buildingAt(h.tx, h.ty);
        if (b) {
          for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) tiles.push({ x, y, color: 0xffffff });
          this.tooltip = { text: getDef(b.def).name };
        } else {
          tiles.push({ x: h.tx, y: h.ty, color: 0xffffff });
          this.tooltip = null;
        }
        preview.showTiles(tiles);
        this.plan = null;
        return;
      }
      case 'zone':
        plan = planZone(sim, a.tx, a.ty, h.tx, h.ty, t.zone!, t.density!);
        break;
      case 'dezone':
        plan = planDezone(sim, a.tx, a.ty, h.tx, h.ty);
        break;
      case 'bulldoze':
        plan = planBulldoze(sim, a.tx, a.ty, h.tx, h.ty, g.renderer.underground);
        break;
      case 'trees':
        plan = planTrees(sim, a.tx, a.ty, h.tx, h.ty);
        break;
      case 'raise':
      case 'lower':
      case 'level':
        plan = planTerraform(sim, t.kind, a.tx, a.ty, h.tx, h.ty);
        break;
      case 'line':
        plan = planLine(sim, t.line!, linePath(a.tx, a.ty, h.tx, h.ty, this.flip));
        break;
      case 'place': {
        const def = getDef(t.def!);
        const r0 = this.rot === 'auto' ? 0 : this.rot;
        const fw = r0 % 2 ? def.h : def.w;
        const fh = r0 % 2 ? def.w : def.h;
        const ax = h.tx - Math.floor((fw - 1) / 2);
        const ay = h.ty - Math.floor((fh - 1) / 2);
        plan = planPlace(sim, def.id, ax, ay, this.rot);
        const mesh = modelForDef(def, 0);
        preview.showGhost(mesh, def.id, plan.x!, plan.y!, plan.rot!, def.w, def.h, plan.ok);
        break;
      }
    }
    this.plan = plan;
    if (!plan) return;
    let changeCount = 0;
    for (const pt of plan.tiles) {
      let color = DIM;
      if (!pt.ok) color = RED;
      else if (pt.change) {
        changeCount++;
        switch (t.kind) {
          case 'zone':
            color = ZONE_HEX[t.zone!];
            break;
          case 'bulldoze':
            color = 0xf97316;
            break;
          case 'dezone':
            color = 0xfda4af;
            break;
          case 'trees':
            color = 0x22c55e;
            break;
          case 'raise':
            color = 0xa3e635;
            break;
          case 'lower':
            color = 0x38bdf8;
            break;
          case 'level':
            color = 0xfacc15;
            break;
          case 'line':
            color = LINE_COLORS[t.line!];
            break;
          case 'place':
            color = plan.ok ? 0x4ade80 : RED;
            break;
          default:
            color = 0x4ade80;
        }
      }
      if (!plan.ok && plan.reason === 'Not enough money' && pt.change) color = RED;
      tiles.push({ x: pt.x, y: pt.y, color });
    }
    preview.showTiles(tiles);
    // tooltip
    let text = t.name;
    if (t.kind === 'zone' || t.kind === 'line' || t.kind === 'trees' || t.kind === 'dezone')
      text += changeCount ? ` · ${changeCount} tile${changeCount === 1 ? '' : 's'}` : '';
    this.tooltip = { text, cost: plan.cost > 0 ? plan.cost : undefined, bad: plan.ok ? undefined : plan.reason };
  }
}
