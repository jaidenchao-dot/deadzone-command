# DEADZONE COMMAND — project briefing for Claude Code

A pixel-art zombie real-time-strategy game that runs entirely in the browser (HTML5 canvas + WebAudio, no
libraries, no assets — every sprite and sound is generated in code). It started as one big HTML file and was
updated through numbered "UPDATE" prompts (V2 → V9). It is now split into ~30 source files; the build turns them
back into one self-contained `dist/index.html`, which GitHub Pages publishes.

## The owner's standing rules (apply to EVERY update)
- **Preserve the existing game.** Do not redesign or remove graphics, visual style, animations, mechanics,
  controls, UI or systems unless the update explicitly asks for it. Only add / fix what is requested.
- **Preserve all previous updates and bug fixes** (list below). Never remove functionality to simplify things.
- Don't rebuild from scratch; reuse and extend the existing systems. Inspect the code before changing it and fix
  root causes (no teleport / hide-the-symptom workarounds).
- Keep the standard campaign unchanged when working on Infinite Map Mode (and vice-versa) — they share code but
  branch on `this.infinite`.
- **W, A, S, D are reserved for camera movement only** — never give a command a W/A/S/D hotkey.
- Test every requirement in the update prompt before finishing, then summarise what changed, any judgement calls,
  and any balance / performance trade-offs.

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Local play-test server at http://localhost:5173 — saving any file reloads the game |
| `npm run build` | Writes the single-file game to `dist/index.html` |
| `npm test` | Builds, then runs `tests/smoke.mjs` in headless Chromium (needs `npm install` + `npx playwright install chromium` once) |

`index.html` can also be opened directly by double-clicking (no server needed). Pushing to `main` publishes to
GitHub Pages automatically (`.github/workflows/deploy.yml`).

## How the code is organised (important)
- The scripts are **classic `<script>` tags (not ES modules)**, loaded in the order listed in `index.html`. All
  top-level `const` / `let` / `class` / `function` declarations therefore share one global scope across files —
  exactly like the original single file. Do **not** add `import`/`export`.
- `src/data/*.js`, `src/engine/*.js` hold the top-level constants, sound engine and sprites, **in their original
  order** (later files may use constants from earlier ones at load time — keep that order).
- `src/game/game.js` declares `class DeadzoneRTSGame` (constructor, start / settings, main loop, camera,
  `updateSimulation`) and the helper `defineGameMethods({...})`.
- Every other `src/game/*.js` file adds methods to the class with `defineGameMethods({ ... })`. Inside those
  files, methods are written as object-literal methods separated by **commas**, and `this` is the game, exactly as
  in a class. Files start with `'use strict';` (class bodies are strict). A method name may exist only once —
  `defineGameMethods` throws on duplicates.
- **New file?** Add it under `src/game/`, start it with `'use strict';` + `defineGameMethods({ ... });`, and add a
  `<script src="...">` tag to `index.html` after `game.js` and before `src/main.js`. The build picks up tags
  automatically.
- `src/main.js` creates `window.game = new DeadzoneRTSGame()` on page load.
- Some world constants are **mutable** `let`s: `MAP_COLS/ROWS/WIDTH/HEIGHT`, `GRID_COLS/ROWS/WRAP`
  (changed by `setWorldDimensions()` for Infinite mode) and `ZOMBIE_POP_MULT`, `HIVE_POP_CAP` (density setting).

## Where things live
| File | Contents |
|---|---|
| `index.html` | Page layout & all UI markup (HUD, panels, home screen tabs, modals) + script order |
| `src/styles.css` | All CSS |
| `src/data/config.js` | World / map size constants, `setWorldDimensions`, `UNIT_DEFS`, ammo (`AMMO_DEFS`, `LOADOUTS`), fuel, hunger, `DIFFICULTY_PRESETS` |
| `src/data/settings.js` | `MAP_DEFS` (Manhattan / Brooklyn / Chicago), save constants, `WASD_CODES`, nav & horde constants, `MOVE_PROFILES` (physics), `DEFAULT_SETTINGS`, aircraft type sets |
| `src/data/definitions.js` | `VEHICLE_DEFS`, `BUILDING_DEFS`, `BATTALION_DEFS`, `UPGRADE_DEFS`, `ZOMBIE_DEFS`, `WAVE_TYPES`, `HIVE_ARCHETYPES`, `MERC_DEFS`, `SURVIVOR_DEFS`, Spitter acid / puddle tuning, hoist time |
| `src/engine/sound.js` | `TacticalSoundEngine` + global `sfx` |
| `src/engine/sprites.js` | `SpriteBank`, `createPixelCanvas`, `initSprites` (all pixel art) |
| `src/game/game.js` | Class core: constructor, `startNewGame`, `applyGameSettings`, `loop`, `updateCamera`, `updateSimulation` (per-frame order of every system) |
| `src/game/world-map.js` | Standard city generation, tile queries, starting infestation, districts & reclamation |
| `src/game/infinite-map.js` | Infinite Map Mode: chunk gen, streaming / LOD rings, infinite nav, fog & sectors |
| `src/game/entities.js` | `createUnit/Vehicle/Building/Hive/Zombie`, abandoned cars, `removeEntityQuiet` |
| `src/game/survivors-mercs.js` | Survivors, shelters, outposts, intel signals, mercenary camps & AI |
| `src/game/input.js` | `bindEvents` (mouse, keyboard, buttons), pause |
| `src/game/commands.js` | Selection, control groups, formations, right-click orders, targeting modes, unload / stop / hold |
| `src/game/construction-economy.js` | Placement, construction timers, production queues, upgrades, `updateBuilding`, population, infinite resources |
| `src/game/friendly-units.js` | `updateFriendlyMobile` (player unit/vehicle AI) and `fireWeapon` |
| `src/game/zombies.js` | Zombie AI, screamers, mutants, `updateHive` |
| `src/game/hive-mind.js` | Alert grid that makes zombies converge as coordinated hordes |
| `src/game/waves.js` | Surge waves, horde formation, wave group marching |
| `src/game/navigation.js` | Nav grid, A*, line-of-sight, stuck recovery; `moveEntityToward` = movement entry point |
| `src/game/movement-physics.js` | Momentum physics (accel / brake / turning), collision, legacy zombie mover |
| `src/game/combat.js` | Projectiles, impacts, cruise missile, damage, death, hostility, target searches, effects |
| `src/game/spitter-acid.js` | Spitter arc projectiles, accuracy, poison puddles |
| `src/game/aircraft.js` | Landing / takeoff, rope pickup, rappelling, airbase storage |
| `src/game/supply.js` | Supply vehicles: resupply, HQ refill, transfers |
| `src/game/ammo-fuel-hunger.js` | Ammo use, fuel burn, hunger & starvation |
| `src/game/medical-repair.js` | Mechanics, Medic Tent, medic healing, infection & cures, passenger ejection |
| `src/game/spatial-fog.js` | Spatial grid (`forEachInRadius`, `getEntityById`) and fog of war / enemy memory |
| `src/game/home-save.js` | Home screen tabs, city maps, settings UI, save / load / export / import |
| `src/game/hud.js` | HUD, selection panel, live status, radio messages, win / loss |
| `src/game/command-grid.js` | `updateCommandGrid` — every command button & hotkey per selection type |
| `src/game/render.js` | Main world renderer |
| `src/game/render-entities.js` | Per-entity drawing, health bars, markers |
| `src/game/minimap.js` | Minimap (windowed in Infinite mode via `minimapFrame()`) |

Tip: comments tagged `// Update N:` mark which update introduced a piece of logic.

## Features that must keep working (update history)
- **V2–V3:** Survivors (locked shelters, armed outposts, estimated intel signals, escort / Return to HQ, vehicle
  use, abilities), hostile mercenary faction (forts, territories), population balance, cruise missile (freeze bug
  fixed), zombie waves, mutations, infection & Medics (6 treatments), fog of war via information memory (grey
  areas never show live enemies; buildings remembered), rescued survivors become independent units, vehicle
  destruction ejects passengers.
- **V4:** Tougher economy, ∞ resources toggle, construction timers, new vehicles (bomber, rocket truck, flame APC…),
  drivable abandoned civilian cars, Mechanic, medic passive single-target healing, ranged zombies hit aircraft,
  10x zombie population with spatial-grid performance work.
- **V5:** Per-weapon limited ammo, 4 supply vehicles (all ammo/food/fuel, resupply / HQ refill / transfer), hive
  mind, hunger, fuel (aircraft crash), helicopter land / take-off / rappel, Airbase (build + store 3 helis & 3
  planes), save / load (3 slots + autosave + export / import), better sound & effects, home screen (city maps,
  settings, saves).
- **V6:** WASD = camera only (Stop X, Hold H, Unload U…), Spitter arcing acid with misses & poison puddles, rope
  pickup by hovering helicopters, supply vehicles carry troops, Medic Tent, dense horde formation (no wedges),
  A* pathfinding with stuck recovery and vehicle clearance.
- **V7 (file V9):** Momentum movement physics for soldiers, vehicles & aircraft (zombies keep the original mover);
  optional **Infinite Map Mode** with chunk streaming (active 1 / render 2 / load 3 chunk rings, frozen idle
  zombies, low-frequency distant AI, persistent chunk records, saves).

## Testing approach
- `npm test` = quick smoke test (standard + infinite, orders, waves, save / load, no JS errors).
- For deeper checks, drive the game from Playwright: pause it (`game.paused = true`) and step the simulation
  manually (`game.updateSimulation(0.05)` × N) so tests are fast and repeatable; inspect `game.entities`.
- For refactors, prove "no behaviour change" by seeding `Math.random`, stubbing `requestAnimationFrame`,
  `performance.now`, `Date.now` and `AudioContext`, stepping the sim, and comparing `JSON.stringify(game.serializeGame())`
  hashes before vs after (this is how the split from V9 was verified: identical state after 3 simulated minutes).
- Check performance (`ms per updateSimulation`) and play-balance (idle base survival) when changing AI / physics.

## Legacy (DO NOT TOUCH)
- `legacy/DEADZONE_COMMAND_V9.html` is the old single-file version this project was split from. It is an archive only.
- **Never edit, rebuild or delete anything in `legacy/`.** It is not part of the game, the build or the tests.
- **Do not read or search it during updates.** All current code is in `index.html`, `src/` and `scripts/`. Searching the legacy file returns outdated duplicates of every function. Exclude `legacy/` from searches.
- Only open it if the user explicitly asks to compare against the original V9.