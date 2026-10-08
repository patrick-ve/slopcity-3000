# SlopCity 3000

[![CI](https://github.com/patrick-ve/slopcity-3000/actions/workflows/ci.yml/badge.svg)](https://github.com/patrick-ve/slopcity-3000/actions/workflows/ci.yml)

A low-poly city builder for the browser, written in TypeScript with WebGL (Three.js).
It is a homage to SimCity 3000: zone land, lay roads, power and water, balance the
budget, keep your citizens happy and watch the city grow.

**Play it in your browser: <https://patrick-ve.github.io/slopcity-3000/>**

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm test             # simulation tests (vitest)
npm run test:e2e     # browser smoke tests (Playwright; run "npx playwright install chromium" once)
npm run typecheck
npm run lint         # ESLint
npm run format       # Prettier
npm run check        # type check, lint, format check and unit tests
```

A WebGL 2 browser is required (any recent Chrome, Edge, Firefox or Safari). Node.js 22.12 or newer is
needed to build. Every push to `main` runs CI and deploys the game to GitHub Pages.

## How to play

Start a **new city**, take over one of the **starter cities**, or try a **scenario** from the main menu.

1. Build a **road** (`R`). Zones only grow within 3 tiles of a road. Roads, rails and highways can follow the grid,
   run straight at any angle or curve: pick **Grid**, **Straight** or **Curve** in the shape bar (`C`).
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
| `Shift` while dragging                      | Bend lines the other way; snap free track to 15° steps         |
| `C`                                         | Grid, straight or curved roads, rails and highways             |
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
- **Free-angle track**: roads, rails and highways follow the grid, run straight at any angle or bend in smooth
  curves. New track snaps to and joins existing track, makes junctions where it crosses, and cars and trains
  follow the curves. Buildings stay on the grid and face the nearest road; every tile a road covers counts
  as road for zoning, traffic and cost.
- **Utilities**: coal, oil, gas, nuclear, wind, solar, microwave and fusion power (unlocked by
  year); pumps, towers, treatment and desalination; incinerators, waste-to-energy, recycling.
- **Services**: police, fire, clinics, hospitals, schools, college, library, museum and eight
  kinds of parks, each with coverage and department funding.
- **Simulation**: RCI demand, commute paths and traffic, pollution, land value, crime, fire
  risk, education (EQ), life expectancy, garbage, power and water capacity.
- **Economy**: tax sliders per zone, department funding, bonds, 22 ordinances, neighbour deals,
  business deals (casino, prison, toxic dump) and rewards unlocked by population.
- **Starter cities**: six ready-made cities to take over, from a railway town in 1900 to a 100,000-person
  metropolis with highways and subways. Each one is built fresh from its map by the city planner.
- **Scenarios**: six challenges with goals and a deadline (Boomtown, Gridlock Gulch, Smog Valley, Paradise Found,
  Budget Crisis, The Big Shake). Win or lose, you can keep playing the city.
- **Sandbox mode**: unlimited money, every building unlocked from the start (rewards more than once), disasters
  off by default.
- **Disasters**: fires that spread, tornadoes, earthquakes and meteors.
- **Interface**: tool fly-outs with costs, data maps (13 overlays), minimap, graphs, advisors,
  query tool, news ticker, budget window, save/load (browser storage, file export/import),
  autosave, options.
- **Sound**: synthesised sound effects and an endless procedural jazz soundtrack (swing, ballad, bossa
  nova and smooth jazz on electric piano, upright bass, vibraphone or muted trumpet, and brushes). Every
  song is composed while you play; there are no audio files. Turn the music on or off and set its volume
  in Options.
- **Rendering**: around 70 procedural low-poly building models, flat shading, soft shadows,
  procedural window grids that light up at night, a day/night cycle, animated water with
  shore foam, traffic, trains, smoke, fire, spinning wind turbines and status icons.

## Project layout

```
src/
  sim/        simulation (no rendering): world grid, map generator, catalog, actions, undo,
              networks, traffic (layered commute graph), fields, demand, growth, budget,
              garbage, disasters, news, advisors, save/load with migrations, city planner,
              starter cities, scenarios
    tracks/   roads, rails and highways as graphs of straight and curved edges: geometry,
              junction shapes, tile coverage, editing (join, split, cut) and build plans
  render/     Three.js renderer: chunked terrain/object meshes, track meshes laid on the terrain
              (render/tracks/*), materials (window and zone shaders), camera, picking, water, sky,
              cars and trains on the track curves, particles, icons, previews, overlays,
              procedural models (render/models/civic/*, growables/*)
  ui/         DOM interface: toolbar, HUD, menu, minimap, icons, one file per window (ui/panels/*)
  game/       glue: Game (main loop, modes, settings), tools, mouse/keyboard input, touch gestures
  audio/      WebAudio sound effects and the procedural jazz soundtrack (synthesised, no assets)
tests/        vitest tests for the simulation (balance, transport, undo, saves, scenarios …) and music
e2e/          Playwright browser smoke tests
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
slop.dev.track('road', 20.5, 20.5, 40.5, 30.5, 35.5, 15.5); // a curve through (35.5, 15.5)
slop.sim.disasters.trigger('tornado');
```

SlopCity 3000 is a fan project and is not affiliated with Maxis or Electronic Arts.
