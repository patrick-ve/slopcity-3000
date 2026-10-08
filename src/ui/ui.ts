import { h, clear } from '../util/dom';
import { money, compact, formatDate, int } from '../util/format';
import { SPEED_NAMES, type Speed } from '../sim/types';
import { getDef, COSTS } from '../sim/catalog';
import { isAvailable } from '../sim/actions';
import { getAdvice } from '../sim/advisors';
import { OVERLAYS, type OverlayId } from '../render/overlays';
import type { SimMessage } from '../sim/sim';
import type { Game } from '../game/game';
import { CATEGORIES, QUERY_TOOL, type ToolCategory, type ToolSpec } from '../game/tools';
import { icon } from './icons';
import { Minimap } from './minimap';
import {
  AdvisorsPanel,
  BudgetPanel,
  DisastersPanel,
  GraphsPanel,
  HelpPanel,
  NeighborsPanel,
  NewsPanel,
  OptionsPanel,
  OrdinancesPanel,
  QueryPanel,
  SavePanel,
  type Panel,
} from './panels';

interface NewsItem {
  text: string;
  kind?: 'info' | 'good' | 'bad';
  date: string;
}

const SPEED_ICONS = ['⏸', '🐢', '🦙', '🐆'];

export class UI {
  readonly root: HTMLDivElement;
  private topbar!: HTMLDivElement;
  private toolbar!: HTMLDivElement;
  private flyout: HTMLDivElement | null = null;
  private flyoutCat: string | null = null;
  private catButtons = new Map<string, HTMLButtonElement>();
  private statFunds!: HTMLDivElement;
  private statFundsDelta!: HTMLSpanElement;
  private statPop!: HTMLDivElement;
  private statPopDelta!: HTMLSpanElement;
  private cityName!: HTMLSpanElement;
  private dateEl!: HTMLDivElement;
  private speedName!: HTMLDivElement;
  private speedBtns: HTMLButtonElement[] = [];
  private rciFill: HTMLDivElement[] = [];
  private rciBox!: HTMLDivElement;
  private ticker!: HTMLDivElement;
  private tickerItem: HTMLDivElement | null = null;
  private tickerX = 0;
  private newsQueue: NewsItem[] = [];
  newsLog: NewsItem[] = [];
  private recycle = 0;
  private tooltipEl!: HTMLDivElement;
  private toasts!: HTMLDivElement;
  private minimap!: Minimap;
  private overlaySelect!: HTMLSelectElement;
  private legend!: HTMLDivElement;
  private toggles: Record<string, HTMLButtonElement> = {};
  private advisorBtn!: HTMLButtonElement;
  private minimapTimer = 0;
  private hudTimer = 0;
  panels: Record<string, Panel> = {};
  private query!: QueryPanel;
  /** Mouse position in screen (CSS) pixels. */
  mouse = { x: 0, y: 0 };
  /** Interface scale: screen pixels per interface pixel. */
  scale = 1;

  constructor(private game: Game, container: HTMLElement) {
    this.root = h('div', { id: 'ui' });
    container.appendChild(this.root);
    this.buildTopbar();
    this.buildToolbar();
    this.buildBottombar();
    this.buildSidepanel();
    this.tooltipEl = h('div', { class: 'tooltip', style: 'display:none' });
    this.toasts = h('div', { class: 'toasts' });
    this.root.append(this.tooltipEl, this.toasts);
    const host = this.root;
    this.query = new QueryPanel(game, host);
    this.panels = {
      budget: new BudgetPanel(game, host),
      ordinances: new OrdinancesPanel(game, host),
      graphs: new GraphsPanel(game, host),
      advisors: new AdvisorsPanel(game, host),
      neighbors: new NeighborsPanel(game, host),
      disasters: new DisastersPanel(game, host),
      save: new SavePanel(game, host),
      options: new OptionsPanel(game, host),
      help: new HelpPanel(game, host),
      news: new NewsPanel(game, host),
      query: this.query,
    };
    window.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener('resize', () => this.onResize());
    this.applyScale();
  }

  /**
   * Scale the whole interface on small and very large screens. The root is
   * laid out at (screen size / scale) and scaled back up with a transform, so
   * all interface coordinates stay in one consistent "interface pixel" space.
   */
  private applyScale(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const small = Math.min(vw / 1100, vh / 720);
    const large = Math.min(vw / 1920, vh / 1080);
    const s = small < 1 ? Math.max(0.8, small) : large > 1 ? Math.min(1.3, large) : 1;
    this.scale = s;
    const st = this.root.style;
    if (s === 1) {
      st.width = st.height = st.transform = st.transformOrigin = st.right = st.bottom = '';
    } else {
      st.right = st.bottom = 'auto';
      st.width = `${vw / s}px`;
      st.height = `${vh / s}px`;
      st.transformOrigin = '0 0';
      st.transform = `scale(${s})`;
    }
    // layout breakpoints in interface pixels
    const lw = vw / s;
    this.root.classList.toggle('ui-compact', lw < 1060);
    this.root.classList.toggle('ui-narrow', lw < 900);
  }

  /** Keep the layout, open windows and menus inside the new screen size. */
  private onResize(): void {
    this.applyScale();
    for (const p of Object.values(this.panels)) if (p.win.open) p.win.clamp();
    if (this.flyoutCat) this.openCategory(this.flyoutCat);
  }

  setHidden(hidden: boolean): void {
    this.root.classList.toggle('hidden', hidden);
  }

  // ---------------------------------------------------------------- top bar

  private buildTopbar(): void {
    this.cityName = h('span', { class: 'city' });
    const brand = h('div', { class: 'brand' }, h('span', { class: 'logo', html: 'Slop<b>City</b> 3000' }), this.cityName);
    this.statFunds = h('div', { class: 'val num' });
    this.statFundsDelta = h('span', { class: 'delta' });
    this.statPop = h('div', { class: 'val num' });
    this.statPopDelta = h('span', { class: 'delta' });
    const funds = h('div', { class: 'stat', title: 'Treasury and monthly cash flow', onclick: () => this.openWindow('budget') }, h('div', { class: 'lbl' }, 'Funds'), h('div', { style: 'display:flex;align-items:baseline' }, this.statFunds, this.statFundsDelta));
    const pop = h('div', { class: 'stat', title: 'Population', onclick: () => this.openWindow('graphs') }, h('div', { class: 'lbl' }, 'Population'), h('div', { style: 'display:flex;align-items:baseline' }, this.statPop, this.statPopDelta));
    funds.style.cursor = 'pointer';
    pop.style.cursor = 'pointer';
    const btn = (id: string, ic: string, title: string) => h('button', { class: 'iconbtn', title, html: icon(ic), onclick: () => this.toggleWindow(id) });
    this.advisorBtn = btn('advisors', 'advisors', 'Advisors');
    this.topbar = h(
      'div',
      { class: 'topbar glass' },
      brand,
      h('div', { class: 'spacer' }),
      funds,
      pop,
      h(
        'div',
        { class: 'tb-buttons' },
        btn('budget', 'budget', 'Budget (taxes, funding, bonds)'),
        btn('ordinances', 'ordinances', 'Ordinances'),
        btn('graphs', 'graphs', 'City statistics'),
        this.advisorBtn,
        btn('neighbors', 'neighbors', 'Neighbours & deals'),
        btn('news', 'news', 'News archive'),
        btn('disasters', 'disasters', 'Disasters'),
        btn('save', 'save', 'Save & load'),
        btn('options', 'options', 'Options'),
        btn('help', 'help', 'How to play'),
      ),
    );
    this.root.appendChild(this.topbar);
  }

  // ---------------------------------------------------------------- toolbar

  private buildToolbar(): void {
    this.toolbar = h('div', { class: 'toolbar glass' });
    CATEGORIES.forEach((cat, i) => {
      const b = h('button', {
        class: `iconbtn cat-${cat.id}`,
        title: `${cat.name}${cat.hotkey ? ` (${cat.hotkey})` : ''}`,
        html: icon(cat.icon, 22),
        onclick: () => this.onCategory(cat, b),
      }) as HTMLButtonElement;
      this.catButtons.set(cat.id, b);
      this.toolbar.appendChild(b);
      if (i === 0 || i === 2 || i === 6) this.toolbar.appendChild(h('div', { class: 'sep' }));
    });
    this.root.appendChild(this.toolbar);
  }

  private onCategory(cat: ToolCategory, btn: HTMLElement): void {
    this.game.sfx.play('click');
    if (cat.id === 'query') {
      this.closeFlyout();
      this.game.selectTool(QUERY_TOOL);
      return;
    }
    if (this.flyoutCat === cat.id) {
      this.closeFlyout();
      return;
    }
    this.openFlyout(cat, btn);
  }

  openCategory(id: string): void {
    const cat = CATEGORIES.find((c) => c.id === id);
    const btn = this.catButtons.get(id);
    if (cat && btn) this.openFlyout(cat, btn);
  }

  private openFlyout(cat: ToolCategory, btn: HTMLElement): void {
    this.closeFlyout();
    const sim = this.game.sim;
    const fly = h('div', { class: 'flyout glass' }, h('h3', {}, cat.name));
    let group: string | undefined;
    for (const t of cat.tools) {
      if (t.group && t.group !== group) {
        group = t.group;
        fly.appendChild(h('div', { class: 'group-title' }, group));
      }
      let costText = '';
      let disabled = false;
      let sub = t.sub ?? '';
      if (t.kind === 'place' && t.def) {
        const def = getDef(t.def);
        costText = def.cost ? money(def.cost) : 'Free';
        if (sim) {
          const av = isAvailable(sim, def);
          if (!av.ok) {
            disabled = true;
            sub = av.why ?? sub;
          }
        }
        if ((def.upkeep ?? 0) < 0) costText = `+${money(-(def.upkeep ?? 0))}/mo`;
      } else if (t.kind === 'zone') costText = t.zone === 4 ? money(COSTS.landfill) : money(COSTS.zone[t.density ?? 1]);
      const swatch = h('div', { class: 'swatch', html: icon(t.icon, 18) });
      if (t.color) {
        swatch.style.background = t.color;
        swatch.style.color = '#16202a';
      }
      if (disabled) swatch.innerHTML = icon('lock', 16);
      const item = h(
        'button',
        {
          class: `toolitem ${this.game.tools.tool.key === t.key ? 'on' : ''} ${disabled ? 'disabled' : ''}`,
          title: t.sub ?? t.name,
          onclick: () => {
            if (disabled) {
              this.game.sfx.play('error');
              return;
            }
            this.game.sfx.play('click');
            this.game.selectTool(t);
            this.closeFlyout();
          },
        },
        swatch,
        h('div', { class: 'meta' }, h('div', { class: 'name' }, t.name), h('div', { class: 'sub' }, sub)),
        costText ? h('div', { class: 'cost' }, costText) : t.hotkey ? h('kbd', {}, t.hotkey) : null,
      );
      fly.appendChild(item);
    }
    // align with the category button (interface pixels), then keep it on screen
    const tb = this.toolbar;
    const top = Math.max(10, tb.offsetTop + btn.offsetTop - tb.scrollTop - 8);
    fly.style.top = `${top}px`;
    this.root.appendChild(fly);
    const maxTop = this.root.clientHeight - 76 - fly.offsetHeight;
    if (top > maxTop) fly.style.top = `${Math.max(10, maxTop)}px`;
    this.flyout = fly;
    this.flyoutCat = cat.id;
    this.catButtons.get(cat.id)?.classList.add('on');
  }

  closeFlyout(): void {
    this.flyout?.remove();
    this.flyout = null;
    this.flyoutCat = null;
    this.syncToolbar();
  }

  /** Highlight the category of the current tool. */
  syncToolbar(): void {
    const key = this.game.tools.tool.key;
    for (const [id, b] of this.catButtons) {
      const cat = CATEGORIES.find((c) => c.id === id)!;
      b.classList.toggle('on', cat.tools.some((t) => t.key === key) || this.flyoutCat === id);
    }
  }

  // ------------------------------------------------------------ bottom bar

  private buildBottombar(): void {
    const cols = (['R', 'C', 'I'] as const).map((l, k) => {
      const fill = h('div', { class: 'fill', style: `background:${['var(--r)', 'var(--c)', 'var(--i)'][k]}` });
      this.rciFill.push(fill);
      return h('div', { class: 'col' }, h('div', { class: 'bar' }, fill), h('div', { class: 'lbl', style: `color:${['var(--r)', 'var(--c)', 'var(--i)'][k]}` }, l));
    });
    this.rciBox = h('div', { class: 'rci', title: 'Demand' }, ...cols);
    this.ticker = h('div', { class: 'ticker', title: 'News — click for the archive', onclick: () => this.toggleWindow('news') });
    this.dateEl = h('div', { class: 'd' });
    this.speedName = h('div', { class: 's' });
    const speeds = h('div', { class: 'speeds' });
    SPEED_ICONS.forEach((ic, s) => {
      const b = h('button', {
        class: 'iconbtn',
        title: `${SPEED_NAMES[s]} (${s === 0 ? 'Space' : s})`,
        onclick: () => {
          this.game.setSpeed(s as Speed);
          this.game.sfx.play('click');
        },
      }, ic) as HTMLButtonElement;
      this.speedBtns.push(b);
      speeds.appendChild(b);
    });
    this.root.appendChild(h('div', { class: 'bottombar glass' }, this.rciBox, this.ticker, h('div', { class: 'datebox' }, this.dateEl, this.speedName), speeds));
  }

  // ------------------------------------------------------------ side panel

  private buildSidepanel(): void {
    this.minimap = new Minimap(() => this.game.sim, this.game.renderer.cam);
    this.overlaySelect = h('select', {
      class: 'select',
      title: 'Data map',
      onchange: () => this.game.setOverlay(this.overlaySelect.value as OverlayId),
    }) as HTMLSelectElement;
    this.overlaySelect.appendChild(h('option', { value: 'none' }, 'Data map: none'));
    for (const o of OVERLAYS) this.overlaySelect.appendChild(h('option', { value: o.id }, o.name));
    this.legend = h('div', { class: 'legend', style: 'display:none' });
    const tog = (id: string, ic: string, title: string, fn: () => void) => {
      const b = h('button', { class: 'iconbtn', title, html: icon(ic, 18), onclick: fn }) as HTMLButtonElement;
      this.toggles[id] = b;
      return b;
    };
    const toggles = h(
      'div',
      { class: 'viewtoggles' },
      tog('under', 'underground', 'Underground view (pipes)', () => this.game.toggleUnderground()),
      tog('grid', 'grid', 'Grid (G)', () => this.game.toggleGrid()),
      tog('day', 'sun', 'Day/night cycle', () => this.game.toggleDayNight()),
      tog('rot', 'rotate', 'Rotate view (Q/E)', () => this.game.renderer.cam.rotateQuarter(1)),
    );
    this.root.appendChild(h('div', { class: 'sidepanel glass' }, this.minimap.canvas, this.overlaySelect, this.legend, toggles));
  }

  syncOverlay(id: OverlayId): void {
    this.overlaySelect.value = id;
    const def = OVERLAYS.find((o) => o.id === id);
    if (!def) {
      this.legend.style.display = 'none';
      return;
    }
    this.legend.style.display = '';
    clear(this.legend);
    this.legend.append(h('div', { class: 'grad', style: `background:${def.gradient}` }), h('div', { class: 'ends' }, h('span', {}, def.legend[0]), h('span', {}, def.legend[1])));
    this.minimapTimer = 0;
  }

  syncToggles(): void {
    const g = this.game;
    this.toggles.under.classList.toggle('on', g.renderer.underground);
    this.toggles.grid.classList.toggle('on', g.settings.grid);
    this.toggles.day.classList.toggle('on', g.settings.dayNight);
    this.toggles.day.innerHTML = icon(g.settings.dayNight ? 'moon' : 'sun', 18);
  }

  // ---------------------------------------------------------------- windows

  openWindow(id: string): void {
    const p = this.panels[id];
    if (!p) return;
    const fresh = p.win.show();
    p.refresh();
    if (fresh) p.win.place();
  }

  toggleWindow(id: string): void {
    const p = this.panels[id];
    if (!p) return;
    this.game.sfx.play('click');
    if (p.win.open) p.win.close();
    else this.openWindow(id);
  }

  closeTopWindow(): boolean {
    let top: Panel | null = null;
    let z = -1;
    for (const p of Object.values(this.panels)) {
      if (!p.win.open) continue;
      const pz = Number(p.win.el.style.zIndex || 0);
      if (pz > z) {
        z = pz;
        top = p;
      }
    }
    if (top) {
      top.win.close();
      return true;
    }
    if (this.flyout) {
      this.closeFlyout();
      return true;
    }
    return false;
  }

  closeAll(): void {
    for (const p of Object.values(this.panels)) p.win.close();
    this.closeFlyout();
  }

  showQuery(tx: number, ty: number): void {
    this.query.at(tx, ty, this.mouse.x, this.mouse.y);
  }

  // -------------------------------------------------------------- feedback

  toast(m: SimMessage, ms = 7000): void {
    const t = h(
      'div',
      { class: `toast glass ${m.kind}` },
      h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'tt' }, m.title), h('div', { class: 'tx' }, m.text)),
    );
    if (m.x !== undefined && m.y !== undefined) {
      t.appendChild(
        h('div', { class: 'acts' }, h('button', {
          class: 'btn small',
          html: icon('target', 14),
          title: 'Go there',
          onclick: () => {
            this.game.renderer.cam.lookAt(m.x!, m.y!, Math.min(this.game.renderer.cam.goalZoom, 10));
            dismiss();
          },
        })),
      );
    }
    const dismiss = () => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    };
    t.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button')) dismiss();
    });
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild?.remove();
    setTimeout(dismiss, ms);
  }

  pushNews(text: string, kind?: 'info' | 'good' | 'bad'): void {
    const sim = this.game.sim;
    const date = sim ? formatDate(sim.city.day, sim.city.startYear) : '';
    const item = { text, kind, date };
    this.newsQueue.push(item);
    this.newsLog.push(item);
    if (this.newsLog.length > 120) this.newsLog.shift();
    if (this.newsQueue.length > 6) this.newsQueue.shift();
    if (this.panels.news?.win.open) this.panels.news.refresh();
  }

  clearNews(): void {
    this.newsQueue = [];
    this.newsLog = [];
    this.tickerItem?.remove();
    this.tickerItem = null;
  }

  private updateTicker(dt: number): void {
    const width = this.ticker.clientWidth;
    if (!this.tickerItem) {
      let next = this.newsQueue.shift();
      if (!next && this.newsLog.length) {
        const recent = this.newsLog.slice(-8);
        next = recent[this.recycle++ % recent.length];
      }
      if (!next) return;
      const tag = next.kind === 'bad' ? 'ALERT' : next.kind === 'good' ? 'GOOD NEWS' : 'NEWS';
      this.tickerItem = h('div', { class: `item ${next.kind ?? ''}` }, h('span', { class: 'tag' }, tag), next.text);
      this.ticker.appendChild(this.tickerItem);
      this.tickerX = width;
    }
    this.tickerX -= dt * (this.newsQueue.length > 2 ? 140 : 80);
    this.tickerItem.style.transform = `translateX(${this.tickerX}px)`;
    if (this.tickerX + this.tickerItem.offsetWidth < 0) {
      this.tickerItem.remove();
      this.tickerItem = null;
    }
  }

  setTooltip(): void {
    const tip = this.game.tools.tooltip;
    const show = tip && this.game.mode === 'play' && !this.game.input.pointerOverUI;
    if (!show) {
      this.tooltipEl.style.display = 'none';
      return;
    }
    clear(this.tooltipEl);
    this.tooltipEl.append(tip.text);
    if (tip.cost !== undefined) this.tooltipEl.append(' · ', h('span', { class: 'cost' }, money(tip.cost)));
    if (tip.bad && tip.bad !== 'Nothing to do here') this.tooltipEl.append(h('div', { class: 'bad' }, tip.bad));
    this.tooltipEl.style.display = '';
    this.tooltipEl.style.left = `${this.mouse.x / this.scale}px`;
    this.tooltipEl.style.top = `${this.mouse.y / this.scale}px`;
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    const sim = this.game.sim;
    if (!sim) return;
    this.updateTicker(dt);
    this.setTooltip();
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.2;
      const c = sim.city;
      this.cityName.textContent = c.name;
      this.statFunds.textContent = money(c.funds);
      this.statFunds.classList.toggle('neg', c.funds < 0);
      const rep = c.lastReport;
      if (rep) {
        this.statFundsDelta.textContent = `${rep.total >= 0 ? '+' : ''}${compact(rep.total)}`;
        this.statFundsDelta.className = `delta ${rep.total >= 0 ? 'up' : 'down'}`;
      } else this.statFundsDelta.textContent = '';
      this.statPop.textContent = int(sim.stats.residents);
      const hist = c.history;
      if (hist.length > 1) {
        const prev = hist[Math.max(0, hist.length - 13)].pop;
        const d = sim.stats.residents - prev;
        this.statPopDelta.textContent = d ? `${d > 0 ? '+' : ''}${compact(d)}` : '';
        this.statPopDelta.className = `delta ${d >= 0 ? 'up' : 'down'}`;
        this.statPopDelta.title = 'Change over the last 12 months';
      } else this.statPopDelta.textContent = '';
      this.dateEl.textContent = formatDate(c.day, c.startYear);
      this.speedName.textContent = SPEED_NAMES[sim.speed];
      this.speedBtns.forEach((b, i) => b.classList.toggle('on', i === sim.speed));
      const dem = [c.demand.r, c.demand.c, c.demand.i];
      dem.forEach((v, k) => {
        const f = this.rciFill[k];
        const hgt = Math.min(1, Math.abs(v)) * 50;
        f.style.height = `${hgt}%`;
        f.style.top = v >= 0 ? `${50 - hgt}%` : '50%';
        f.style.opacity = v >= 0 ? '1' : '0.55';
      });
      this.rciBox.title = `Demand — Residential ${(c.demand.r * 100).toFixed(0)}, Commercial ${(c.demand.c * 100).toFixed(0)}, Industrial ${(c.demand.i * 100).toFixed(0)}`;
    }
    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 1.2;
      this.minimap.draw(this.game.renderer.overlay);
    }
    if (this.panels.query.win.open && Math.random() < dt * 2) this.panels.query.refresh();
  }

  /** Called every simulated month. */
  onMonth(): void {
    const sim = this.game.sim;
    if (!sim) return;
    for (const id of ['budget', 'graphs', 'advisors', 'neighbors', 'ordinances']) {
      const p = this.panels[id];
      if (p.win.open) p.refresh();
    }
    const advice = getAdvice(sim);
    const worst = advice.reduce((m, a) => Math.max(m, a.severity), 0);
    let badge = this.advisorBtn.querySelector('.badge');
    if (worst > 0) {
      if (!badge) {
        badge = h('span', { class: 'badge' });
        this.advisorBtn.appendChild(badge);
      }
      badge.className = `badge ${worst === 1 ? 'warn' : ''}`;
    } else badge?.remove();
  }

  /** Rebuild menus that depend on unlocks/year. */
  onUnlock(): void {
    if (this.flyoutCat) {
      const cat = CATEGORIES.find((c) => c.id === this.flyoutCat);
      const btn = this.catButtons.get(this.flyoutCat);
      if (cat && btn) this.openFlyout(cat, btn);
    }
  }

  selectToolFromUI(t: ToolSpec): void {
    this.game.selectTool(t);
  }
}
