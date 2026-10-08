import { World } from '../sim/world';
import { generateMap, type MapOptions } from '../sim/mapgen';
import { Sim } from '../sim/sim';
import type { Speed } from '../sim/types';
import { deserialize, loadFromSlot, saveToSlot, serialize } from '../sim/save';
import { formatDate, money } from '../util/format';
import { randomSeed } from '../util/rng';
import { GameRenderer, type ShadowQuality } from '../render/renderer';
import type { OverlayId } from '../render/overlays';
import { Sfx } from '../audio/sfx';
import { Music } from '../audio/music';
import { UI } from '../ui/ui';
import { Menu, type NewGameOptions } from '../ui/menu';
import { h } from '../util/dom';
import { Input } from './input';
import { QUERY_TOOL, ToolController, type ToolSpec } from './tools';
import { buildDemoCity } from './demo';
import { applyPlan, linePath, planLine, planPlace, planZone, type LineKind } from '../sim/actions';
import type { ZoneKind } from '../sim/types';
import { UndoStack } from '../sim/undo';
import { buildStarter, getStarter } from '../sim/starters';
import { buildScenario, getScenario, updateScenario } from '../sim/scenarios';

export type Mode = 'menu' | 'play';

export interface Settings {
  shadows: ShadowQuality;
  dayNight: boolean;
  volume: number;
  muted: boolean;
  music: boolean;
  musicVolume: number;
  edgeScroll: boolean;
  autosave: boolean;
  grid: boolean;
}

const SETTINGS_KEY = 'slopcity.settings';
const AUTOSAVE_SECONDS = 180;

function loadSettings(): Settings {
  const defaults: Settings = {
    shadows: 'high',
    dayNight: true,
    volume: 0.5,
    muted: false,
    music: true,
    musicVolume: 0.35,
    edgeScroll: false,
    autosave: true,
    grid: false,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) } : defaults;
  } catch {
    return defaults;
  }
}

/** Owns the simulation, renderer, UI and the main loop. */
export class Game {
  mode: Mode = 'menu';
  sim: Sim | null = null;
  readonly renderer: GameRenderer;
  readonly tools: ToolController;
  readonly ui: UI;
  readonly menu: Menu;
  readonly input: Input;
  readonly sfx = new Sfx();
  readonly music = new Music(() => this.sfx.context());
  /** Map actions that can be undone (Ctrl/Cmd + Z). */
  readonly undo = new UndoStack();
  settings: Settings = loadSettings();
  undergroundManual = false;
  private lastSpeed: Speed = 2;
  private autosaveTimer = AUTOSAVE_SECONDS;
  private unsubs: (() => void)[] = [];
  private last = performance.now();
  private demoCentre = { x: 0, y: 0 };

  constructor(app: HTMLElement) {
    const view = h('div', { id: 'view' });
    app.appendChild(view);
    this.renderer = new GameRenderer(view);
    this.tools = new ToolController(this);
    this.ui = new UI(this, app);
    // the menu lives inside the UI root so it scales with the interface
    this.menu = new Menu(this, this.ui.root);
    this.input = new Input(this, this.renderer.canvas);
    this.applySettings();
    // browsers only allow audio after a user gesture: start the music on the first one
    const unlock = () => {
      this.music.unlock();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('beforeunload', () => {
      if (this.mode === 'play' && this.settings.autosave) this.autosave();
    });
  }

  start(): void {
    this.showDemo();
    this.menu.showMain();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ------------------------------------------------------------ worlds

  private attach(sim: Sim, play: boolean): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.sim = sim;
    this.undo.clear();
    this.renderer.setSim(sim);
    this.tools.setTool(QUERY_TOOL);
    this.ui.closeAll();
    this.ui.clearNews();
    if (!play) return;
    const ev = sim.events;
    this.unsubs.push(
      ev.on('news', (n) => this.ui.pushNews(n.text, n.kind)),
      ev.on('message', (m) => {
        this.ui.toast(m);
        this.sfx.play('message');
      }),
      ev.on('sound', (s) => this.sfx.play(s)),
      ev.on('shake', (s) => (this.renderer.cam.shake = s)),
      ev.on('month', () => {
        this.checkScenario();
        this.ui.onMonth();
      }),
      ev.on('unlock', () => this.ui.onUnlock()),
      ev.on('building', (e) => {
        if (e.type === 'destroyed')
          this.renderer.particles.burst(
            e.b.x + e.b.w / 2,
            sim.world.surfaceY(e.b.x + e.b.w / 2, e.b.y + e.b.h / 2) + 0.1,
            e.b.y + e.b.h / 2,
            20,
            e.b.w,
            true,
          );
      }),
    );
  }

  /** Title-screen background: a small generated city, slowly orbiting. */
  showDemo(): void {
    this.mode = 'menu';
    this.ui.setHidden(true);
    const seed = 20251;
    const world = new World(80, 80);
    generateMap(world, { size: 80, seed, terrain: 'rolling', water: 'river', trees: 'normal' });
    const sim = new Sim(world, { name: 'Demo', mayor: 'Demo', startYear: 1980, difficulty: 'easy', seed });
    sim.city.disastersEnabled = false;
    this.demoCentre = buildDemoCity(sim);
    for (let d = 0; d < 365 * 7; d++) sim.stepDay();
    sim.setSpeed(1);
    this.attach(sim, false);
    const cam = this.renderer.cam;
    cam.lookAt(this.demoCentre.x, this.demoCentre.y, 15);
    cam.goalPitch = 0.62;
    cam.snap();
  }

  /** Terrain preview for the new-city dialog. */
  previewMap(map: MapOptions): void {
    const world = new World(map.size, map.size);
    generateMap(world, map);
    const sim = new Sim(world, { name: 'Preview', mayor: '', startYear: 1950, difficulty: 'easy', seed: map.seed });
    this.attach(sim, false);
    const cam = this.renderer.cam;
    cam.lookAt(map.size / 2, map.size / 2, map.size * 0.55);
    cam.goalPitch = 0.75;
    cam.snap();
  }

  newCity(o: NewGameOptions): void {
    const world = new World(o.map.size, o.map.size);
    generateMap(world, o.map);
    const sim = new Sim(world, { name: o.name, mayor: o.mayor, startYear: o.startYear, difficulty: o.difficulty, seed: o.map.seed });
    if (o.sandbox) {
      sim.city.sandbox = true;
      sim.city.disastersEnabled = false;
    }
    this.beginPlay(sim);
    this.renderer.cam.lookAt(world.w / 2, world.h / 2, Math.min(22, world.w * 0.25));
    this.renderer.cam.goalPitch = 0.66;
    this.ui.toast(
      {
        title: `Welcome to ${o.name}!`,
        text: 'Build a road (R), zone residential and industrial land beside it (Z), then add a power plant. Open “How to play” (?) for more tips.',
        kind: 'good',
      },
      14000,
    );
    this.ui.pushNews(`Mayor ${o.mayor} founds the city of ${o.name}`, 'good');
  }

  private beginPlay(sim: Sim): void {
    this.attach(sim, true);
    this.mode = 'play';
    this.menu.hide();
    this.ui.setHidden(false);
    this.ui.syncOverlay(this.renderer.overlay);
    this.ui.syncToggles();
    this.ui.syncToolbar();
    this.setSpeed(2);
    this.autosaveTimer = AUTOSAVE_SECONDS;
    this.ui.onMonth();
  }

  /** Starter city being built (only one at a time). */
  private building = false;

  /**
   * Build a starter city in small steps (the page stays responsive and the
   * menu shows progress), then hand it to the player.
   */
  async playStarter(id: string, onProgress?: (p: number) => void): Promise<void> {
    if (this.building) return;
    this.building = true;
    try {
      const def = getStarter(id);
      const gen = buildStarter(def);
      let step = gen.next();
      while (!step.done) {
        onProgress?.(step.value);
        await new Promise((res) => setTimeout(res, 0));
        step = gen.next();
      }
      onProgress?.(1);
      const sim = step.value;
      this.beginPlay(sim);
      this.focusCity(sim);
      this.ui.toast({ title: `Welcome to ${def.name}`, text: def.tagline, kind: 'good' }, 8000);
      this.ui.pushNews(`Mayor takes office in ${def.name}, population ${sim.stats.residents.toLocaleString('en-US')}`, 'good');
    } finally {
      this.building = false;
    }
  }

  /** Build a scenario's starting city (with progress) and play it. */
  async playScenario(id: string, onProgress?: (p: number) => void): Promise<void> {
    if (this.building) return;
    this.building = true;
    try {
      const def = getScenario(id);
      const gen = buildScenario(def);
      let step = gen.next();
      while (!step.done) {
        onProgress?.(step.value);
        await new Promise((res) => setTimeout(res, 0));
        step = gen.next();
      }
      onProgress?.(1);
      const sim = step.value;
      this.beginPlay(sim);
      this.focusCity(sim, sim.world.buildings.size ? 18 : 30);
      def.onStart?.(sim);
      sim.recompute(false);
      this.ui.openWindow('scenario');
      this.ui.pushNews(`Scenario: ${def.name}. ${def.brief}`, 'info');
    } finally {
      this.building = false;
    }
  }

  /** Monthly scenario check: announce a win or a loss once. */
  private checkScenario(): void {
    const sim = this.sim;
    if (!sim) return;
    const result = updateScenario(sim);
    if (!result) return;
    const def = getScenario(sim.city.scenario!.id);
    if (result === 'won') {
      this.sfx.play('fanfare');
      this.ui.toast(
        { title: `${def.name}: you did it!`, text: 'Every goal is met. The city is yours to keep building.', kind: 'good' },
        12000,
      );
      this.ui.pushNews(`Mayor completes the ${def.name} challenge!`, 'good');
    } else {
      this.sfx.play('error');
      this.ui.toast(
        { title: `${def.name}: time is up`, text: 'Not every goal was met in time. You can keep playing.', kind: 'bad' },
        12000,
      );
    }
    this.ui.openWindow('scenario');
  }

  /** Point the camera at the middle of a city's buildings. */
  private focusCity(sim: Sim, zoom = 18): void {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const b of sim.world.buildings.values()) {
      sx += b.x;
      sy += b.y;
      n++;
    }
    const w = sim.world;
    this.renderer.cam.lookAt(n ? sx / n : w.w / 2, n ? sy / n : w.h / 2, zoom);
    this.renderer.cam.goalPitch = 0.66;
    this.renderer.cam.snap();
  }

  loadSlot(slot: string): boolean {
    const sim = loadFromSlot(slot);
    if (!sim) {
      this.ui.toast({ title: 'Load failed', text: 'That save could not be read.', kind: 'bad' });
      return false;
    }
    this.startLoaded(sim);
    return true;
  }

  private startLoaded(sim: Sim): void {
    this.beginPlay(sim);
    this.focusCity(sim);
    this.ui.toast(
      {
        title: `Welcome back to ${sim.city.name}`,
        text: `${sim.stats.residents.toLocaleString('en-US')} residents await your leadership.`,
        kind: 'good',
      },
      5000,
    );
  }

  saveSlot(slot: string): boolean {
    const sim = this.sim;
    if (!sim || this.mode !== 'play') return false;
    const ok = saveToSlot(sim, slot, formatDate(sim.city.day, sim.city.startYear));
    if (!ok) this.ui.toast({ title: 'Save failed', text: 'Browser storage is full or unavailable. Try exporting to a file.', kind: 'bad' });
    return ok;
  }

  private autosave(): void {
    if (this.sim && this.mode === 'play') this.saveSlot('autosave');
  }

  exportCity(): void {
    const sim = this.sim;
    if (!sim) return;
    const blob = new Blob([serialize(sim)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${sim.city.name.replace(/[^\w-]+/g, '_')}.slopcity.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async importCity(file: File): Promise<boolean> {
    try {
      const sim = deserialize(await file.text());
      this.startLoaded(sim);
      return true;
    } catch (e) {
      this.ui.toast({ title: 'Import failed', text: String((e as Error).message ?? e), kind: 'bad' });
      return false;
    }
  }

  toMenu(): void {
    if (this.mode === 'play' && this.settings.autosave) this.autosave();
    this.ui.closeAll();
    this.showDemo();
    this.menu.showMain();
  }

  // ----------------------------------------------------------- controls

  setSpeed(s: Speed): void {
    if (!this.sim) return;
    if (s > 0) this.lastSpeed = s;
    this.sim.setSpeed(s);
  }

  togglePause(): void {
    if (!this.sim) return;
    this.setSpeed(this.sim.speed === 0 ? this.lastSpeed : 0);
  }

  /** Revert the most recent map action and refund its cost. */
  undoLast(): void {
    const sim = this.sim;
    if (!sim || this.mode !== 'play') return;
    const e = this.undo.undo(sim);
    if (!e) {
      this.sfx.play('error');
      this.ui.toast({ title: 'Nothing to undo', text: 'Undo reverts building, zoning, bulldozing and terraforming.', kind: 'info' }, 2000);
      return;
    }
    this.sfx.play('undo');
    this.tools.refresh();
    this.ui.toast(
      { title: `Undone: ${e.label}`, text: e.refund > 0 ? `${money(e.refund)} refunded.` : 'The change is reverted.', kind: 'info' },
      2200,
    );
  }

  selectTool(spec: ToolSpec): void {
    this.tools.setTool(spec);
    this.ui.syncToolbar();
  }

  setOverlay(id: OverlayId): void {
    this.renderer.setOverlay(id);
    this.ui.syncOverlay(id);
  }

  /** Underground view requested by a tool (pipes). */
  setUnderground(on: boolean): void {
    const want = on || this.undergroundManual;
    if (this.renderer.underground !== want) this.renderer.setUnderground(want);
    this.ui?.syncToggles();
  }

  toggleUnderground(): void {
    this.undergroundManual = !this.renderer.underground;
    this.renderer.setUnderground(this.undergroundManual);
    this.ui.syncToggles();
    this.sfx.play('click');
  }

  toggleGrid(): void {
    this.settings.grid = !this.settings.grid;
    this.applySettings();
  }

  toggleDayNight(): void {
    this.settings.dayNight = !this.settings.dayNight;
    this.applySettings();
  }

  toggleMute(): void {
    this.settings.muted = !this.settings.muted;
    this.applySettings();
    this.ui.toast({ title: this.settings.muted ? 'Sound off' : 'Sound on', text: 'Press M to toggle.', kind: 'info' }, 1500);
  }

  applySettings(): void {
    const s = this.settings;
    this.renderer.setShadows(s.shadows);
    this.renderer.sky.enabled = s.dayNight;
    this.renderer.setGrid(s.grid);
    this.sfx.muted = s.muted;
    this.sfx.setVolume(s.volume);
    this.music.setVolume(s.musicVolume);
    this.music.setEnabled(s.music);
    this.music.setMuted(s.muted);
    this.ui?.syncToggles();
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  // --------------------------------------------------------------- loop

  private loop(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const sim = this.sim;
    if (sim) {
      if (this.mode === 'menu') {
        sim.update(dt * 1000);
        this.renderer.cam.rotate(dt * 0.05);
      } else {
        sim.update(dt * 1000);
        this.input.update(dt);
        if (this.settings.autosave) {
          this.autosaveTimer -= dt;
          if (this.autosaveTimer <= 0) {
            this.autosaveTimer = AUTOSAVE_SECONDS;
            this.autosave();
          }
        }
        // keep the tool preview in sync with simulation changes
        this.tools.refresh();
      }
      this.renderer.update(dt);
      this.ui.update(dt);
      this.renderer.render();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  /** Developer helpers, reachable from the console as `slop.dev`. */
  readonly dev = {
    /** Lay out the demo city in the current game. */
    buildDemo: () => (this.sim ? buildDemoCity(this.sim) : null),
    /** Fast-forward the simulation by n days. */
    runDays: (n: number) => {
      for (let d = 0; d < n && this.sim; d++) this.sim.stepDay();
    },
    /** Build a network line (road, rail, power, pipe) between two tiles. */
    line: (kind: LineKind, x0: number, y0: number, x1: number, y1: number) => {
      if (!this.sim) return 'no city';
      const plan = planLine(this.sim, kind, linePath(x0, y0, x1, y1));
      return applyPlan(plan) ? 'ok' : (plan.reason ?? 'failed');
    },
    /** Place a building by catalog id. */
    place: (def: string, x: number, y: number) => {
      if (!this.sim) return 'no city';
      const plan = planPlace(this.sim, def, x, y, 'auto');
      return applyPlan(plan) ? 'ok' : (plan.reason ?? 'failed');
    },
    /** Zone a rectangle. */
    zone: (x0: number, y0: number, x1: number, y1: number, z: ZoneKind, d: number) =>
      this.sim ? applyPlan(planZone(this.sim, x0, y0, x1, y1, z, d)) : false,
    /** Start a new city without the menu. */
    quickStart: (seed = randomSeed(), terrain: MapOptions['terrain'] = 'rolling', water: MapOptions['water'] = 'river', size = 96) =>
      this.newCity({
        name: 'Devtown',
        mayor: 'Dev',
        startYear: 1950,
        difficulty: 'easy',
        map: { size, seed, terrain, water, trees: 'normal' },
      }),
  };
}
