# SlopCity 3000

A low-poly city builder for the browser, written in TypeScript with WebGL (Three.js).
It is a homage to SimCity 3000: zone land, lay roads, power and water, balance the
budget, keep your citizens happy and watch the city grow.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # simulation tests (vitest)
npm run typecheck
```

A WebGL 2 browser is required (any recent Chrome, Edge, Firefox or Safari).

## How to play

1. Build a **road** (`R`). Zones only grow within 3 tiles of a road.
2. **Zone** residential (green) and industrial (yellow) land along it (`Z`). Add commercial (blue) later.
3. Build a **power plant**. Zoned land and buildings carry power to each other, but you need
   **power lines** (`P`) to cross roads and empty land. Unpowered zones show a lightning bolt.
4. Lay **water pipes** (`U`, underground view) from a water pump. Medium and dense zones need water to grow big.
5. Watch the **RCI meter** (bottom left). Bars above the line mean demand.
6. Add police, fire stations, schools, hospitals, parks and garbage handling as the city grows.
   The **advisors** tell you what is wrong.
7. Connect a road to the map edge to trade with neighbours.

### Controls

| Input                                       | Action                                                         |
| ------------------------------------------- | -------------------------------------------------------------- |
| Left drag                                   | Use the current tool (zones, roads, bulldoze, …)               |
| Right drag                                  | Pan                                                            |
| Middle drag, or `Option`/`Alt` + left drag  | Rotate and tilt (also on the title screen)                     |
| Wheel / trackpad pinch                      | Zoom (toward the cursor)                                       |
| `Shift` + wheel / two-finger sideways swipe | Rotate                                                         |
| Touch: one finger                           | Use the current tool (query tool: drag to pan, tap to inspect) |
| Touch: two fingers                          | Pan, pinch to zoom, twist to rotate                            |
| Touch: three fingers                        | Drag up or down to tilt                                        |
| `W` `A` `S` `D` / arrows                    | Pan                                                            |
| `Q` / `E`                                   | Rotate the view 90°                                            |
| `Shift` while dragging                      | Bend lines the other way                                       |
| `X` / `Tab`                                 | Rotate the building you are placing                            |
| `Space`, `1` `2` `3`                        | Pause, Turtle, Llama, Cheetah                                  |
| `B` `R` `P` `U` `Z`                         | Bulldoze, road, power line, pipe, zones menu                   |
| `G` / `M` / `H`                             | Grid, mute, help                                               |
| `Esc`                                       | Close window / cancel / query tool                             |
| `Ctrl`/`Cmd` + `Z`                          | Undo the last map action (refunds its cost)                    |
| `Ctrl`/`Cmd` + `S`                          | Quick save                                                     |

## Features

- **Terrain**: generated maps (flat to mountainous; river, lakes, coast, island; forests),
  slopes with building foundations, terraforming (raise, lower, level), bridges.
- **Zones**: residential, commercial, industrial in light / medium / dense, plus landfills.
  Buildings grow on lots of 1×1 up to 3×3, in three wealth levels (heavy, manufacturing and
  high-tech industry), redevelop when demand rises and get abandoned when conditions turn bad.
- **Infrastructure**: roads, rail with trains, elevated highways with on-ramps (from 1940), subways with
  stations (from 1910), power lines, underground water pipes, bus stops, train stations, seaport, airport.
  Commuters take the fastest route over streets, highways and subway lines.
- **Utilities**: coal, oil, gas, nuclear, wind, solar, microwave and fusion power (unlocked by
  year); pumps, towers, treatment and desalination; incinerators, waste-to-energy, recycling.
- **Services**: police, fire, clinics, hospitals, schools, college, library, museum and eight
  kinds of parks, each with coverage and department funding.
- **Simulation**: RCI demand, commute paths and traffic, pollution, land value, crime, fire
  risk, education (EQ), life expectancy, garbage, power and water capacity.
- **Economy**: tax sliders per zone, department funding, bonds, 22 ordinances, neighbour deals,
  business deals (casino, prison, toxic dump) and rewards unlocked by population.
- **Disasters**: fires that spread, tornadoes, earthquakes and meteors.
- **Interface**: tool fly-outs with costs, data maps (13 overlays), minimap, graphs, advisors,
  query tool, news ticker, budget window, save/load (browser storage, file export/import),
  autosave, options.
- **Rendering**: around 70 procedural low-poly building models, flat shading, soft shadows,
  procedural window grids that light up at night, a day/night cycle, animated water with
  shore foam, traffic, trains, smoke, fire, spinning wind turbines and status icons.

## Project layout

```
src/
  sim/        simulation (no rendering): world grid, map generator, catalog, actions,
              networks, traffic, fields, demand, growth, budget, garbage, disasters,
              news, advisors, save/load
  render/     Three.js renderer: chunked terrain/road/object meshes, materials (window and
              zone shaders), camera, picking, water, sky, cars, trains, particles, icons,
              previews, overlays, procedural models (render/models/*)
  ui/         DOM interface: toolbar, HUD, windows, menu, minimap, icons
  game/       glue: Game (main loop, modes, settings), tools, input, demo city
  audio/      WebAudio sound effects (synthesised, no assets)
tests/        vitest tests for the simulation
viewer.html   development model viewer (/viewer.html?filter=coal_plant&variants=4)
```

The simulation runs one game day per tick (about 0.1 ms on a 128×128 map; heavier work runs
once a month). The renderer rebuilds only dirty 16×16 chunks, merges everything per chunk and
uses instancing for cars, trains, particles, rotors and icons.

### Developer helpers

In the browser console, `slop` is the running game:

```js
slop.dev.quickStart(); // new city without the menu
slop.dev.buildDemo(); // lay out a sample town
slop.dev.runDays(365 * 5); // fast-forward five years
slop.dev.place('stadium', 40, 40);
slop.sim.disasters.trigger('tornado');
```

SlopCity 3000 is a fan project and is not affiliated with Maxis or Electronic Arts.
