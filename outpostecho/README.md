# Outpost Echo 3D

A complete, original first-person sci-fi adventure for the PodBox Arcade. In 2187, a maintenance shuttle reaches a research station that has stopped transmitting. Restore its systems, follow the crew's logs and bring the communications array back online.

Version 1.0 implements the six software phases of the concept. It includes five sectors, thirty main rooms, five hidden service caches, access puzzles, security patrols, equipment, records and a final story resolution. The maps are authored plans, not random mazes. Hardware validation and playtesting with people remain open.

## Play

Copy `dist/outpostecho.pbg` to `Games` on the iPod and open Arcade. Or open the self-contained `dist/outpostecho.html` in a current Chrome or Edge browser. The browser file needs no server or external assets. The cart keeps its original SDK-generated ID.

| Input | Action |
|---|---|
| Wheel | Turn left or right |
| Select | Start walking, then tap again to stop |
| Prev, held | Walk backward |
| Next | Open or close a door, read a terminal, activate a system or use an exit |
| Play, tap and release | Use the equipped tool |
| Play, held | Switch tools once per hold |
| Menu | Pause, settings, save and main menu or restart sector |

Holding Select never repeats the walking toggle. Movement settings also offer hold-to-walk controls. Pause stops latched walking. Turn sensitivity, security difficulty, sound effects, tool selection and the performance overlay are in Options.

In the browser, Up and Down turn, Left moves backward, Right interacts, Enter is Select, Space is Play and Escape pauses. The drawn wheel works too. Browser saves live in that browser's local storage. A different browser, origin or cleared storage has a separate save.

The game doesn't control or analyse the owner's music. All sound effects are original short tones and can be muted.

## The expedition

| Sector | Situation |
|---|---|
| Arrival Bay | Restore docking power, find the access pass and reconnect the local relay |
| Research Laboratories | Recover the access decoder and unlock the research relay |
| Power Reactor | Restart the power bus, cross guarded service routes and restore the reactor relay |
| Botanical Research | Follow the crew's shelter logs through the hydroponic rooms and reroute power |
| Communications Center | Restore the main array and send the signal that completes the expedition |

Each sector has two routes around the main rooms. Find its power bus and access pass, then activate the relay before using the transit hatch. From Research on, the relay also needs the decoder. The HUD shows the next objective. Next works on an object in front of you within interaction range.

Ordinary doors open freely. Security doors need the pass. Powered doors need the local bus. Hidden service panels look like walls until a nearby scan reveals them. Open a revealed panel with Next and collect its cache for energy and bonus points. Doors never close onto the player or a robot.

The station has two robots per sector. They patrol, notice a nearby player with a clear line of sight, approach and return after losing sight. Walls and closed doors block sight and movement. Contact drains suit energy. The player can outrun them, use another route or temporarily disable them with a pulse.

| Tool | Use |
|---|---|
| Pulse | Stun visible robots in front of you for eight seconds. Each use costs one charge |
| Scanner | Show the local map, mark nearby equipment and closed doors, and reveal hidden service panels. No charge cost |
| Decoder | Activate a secured relay after restoring power and finding the pass. Found in Research |

Energy cells restore 30 energy and two pulse charges. Service caches restore 25 energy. Maximum energy is 100 and maximum pulse charge is four. There is no mandatory combat and no robot-kill objective. Explorer difficulty reduces detection range and contact damage; Alert increases them.

Results show elapsed mission time, items, secrets, robots disabled or avoided and points. Every completed sector gets a record. Completing Communications submits the expedition total and earns the final achievement. A faster clear, secrets and avoiding contact improve the score. Logs pause the mission clock.

The ideal automated walkthrough takes about 7.4 minutes for the entire expedition. A first human visit involves finding objects, reading logs and choosing routes. The concept's three-to-seven-minute pacing per sector still needs human playtesting; it isn't a measured claim.

## Saving and records

Progress is saved at pickups, terminals, sector completion, return to the menu and normal exit. Continue restores the position, energy, equipment, doors, room discovery and puzzle state. Door animations settle to their stored open or closed target. Robot patrol positions and temporary stun timers reset on Continue; contact and disable statistics persist. A resumed player always starts stopped.

Completed-sector checkpoints continue at the next sector. The final checkpoint reopens the ending without submitting a duplicate score. Sector Select offers unlocked sectors. New Expedition resets the current expedition while retaining unlocked sectors, achievements and records. Restart Sector keeps points from earlier sectors and resets the current one.

Saved numbers: 0 is the unlocked-sector count, 1 marks a completed expedition and 10 to 14 hold best sector scores. The versioned `checkpoint` store file holds the current expedition. Native boards hold sector and expedition records. A checkpoint that can't be written displays SAVE UNAVAILABLE.

## Build

From the repository root, with the SDK beside the repo:

```sh
node ../podbox/arcade/sdk/pbgc.js build outpostecho -o dist/outpostecho.pbg
```

The standalone browser builder needs the SDK's development dependency `esbuild`. With a full SDK install:

```sh
(cd ../podbox/arcade/sdk && npm ci)
node tools/outpostecho_web.mjs
```

The builder downloads the official browser engine from an immutable published PodBox commit, verifies its SHA-256 and bundles everything into one HTML file. It preserves the SDK's licence notices and source link. It also writes `outpostecho-runtime.wasm` for verification and `outpostecho-release.json` with checksums.

Optional paths keep dependencies outside the shared SDK:

```sh
node tools/outpostecho_web.mjs --sdk /path/to/arcade/sdk \
  --runtime /path/to/arcade.wasm --esbuild /path/to/esbuild/lib/main.js
```

The runtime used for this release is SHA-256 `783888cafbc2f9d48f21a8f8c5223df8702bf55d59459942ad10ddea27d79057`. Native verification used SDK commit `126ebba20eb4f650d98ec03e6838d226af2e7013`.

## Architecture

| File | Responsibility |
|---|---|
| `cart.json` | Identity, rate, flags, six options, scoreboards and achievements |
| `main.js` | Scenes, menus, mission clock, sector progression, results and fallback |
| `station.js` | Sector loading, pickups, objectives, interactions and sight rays |
| `player.js` | Swept actor, wheel turning, walking, reverse, tool presses and pause safety |
| `doors.js` | Lock rules, animated panels and synchronized collision |
| `robots.js` | Fixed actor pool, staggered sight checks, patrols, stuns and contact damage |
| `tools.js` | Pulse, scanner, decoder and tool switching |
| `saves.js` | Versioned checkpoints, validation and Continue |
| `view.js` | SDK wall renderer, fog, shaded side faces and occluded billboards |
| `hud.js` | Mission HUD, scanner, title, help, logs and results |
| `maps/*.json` | Five authored tile maps and spawn/room markers |
| `data/sectors.json` | Puzzle objects, narrative, door locks and patrol endpoints |
| `images/*_map.png` | Offline scanner maps |

A map cell is eight world pixels. Walls are 16 pixels high, the eye is eight pixels up and the player's hitbox is 2.4 pixels wide. Movement uses `actors.move()` with `FLAG.solid`. Rendering uses `walls.draw()` with `FLAG.wall`. Closed wall tiles carry both flags. A fully open door keeps only the rendering flag, allowing the SDK to draw its panel without blocking movement. Closing waits for the entire doorway to be clear.

The art and maps have separate generators:

```sh
python3 tools/outpostecho_levels.py
python3 tools/outpostecho_assets.py
```

The first writes the five explicit room plans and mission data. The second needs Pillow and writes only Outpost Echo's indexed textures, equipment sprites, animated robots, foliage, scanner maps, palette and logo. It doesn't touch other carts. Sprite blocks occupy separate 2x2 regions. All assets are original.

## Verification and performance

```sh
python3 tools/outpostecho_test.py
python3 tools/outpostecho_test.py --selftest
python3 tools/outpostecho_test.py --browser-runtime dist/outpostecho-runtime.wasm
```

The release runner validates every sealed map, lock dependencies, patrol routes and capacities. It checks real button handling, held-button safety, reverse, classic controls, pauses, suspension after pause and the 20 Hz fallback. Targeted fixtures exercise lock rejection, door animation, doorway occupancy, pulse charges, scanner cost, damage and retry. Five further seeded runs start near active robots on Alert, with the overlay enabled, for 3,000 ticks per sector.

A scratch-only pilot navigates every sector through the real input handlers. After every update, including the last, a probe checks collision, bounds, mission prerequisites, energy, discovery, door state and capacities. The input stream then replays against the plain cart. The replay must reach the final ending with secrets and a valid checkpoint. It also checks fresh-process Continue, completed-game Continue, unlocked sectors and persistent scoreboards. The browser WASM must produce identical units and the same final checkpoint as the native VM.

The self-test deliberately bypasses wall collision in a scratch copy. It must fail the wall invariant. The shipping files are never modified by a test.

Measured on 2026-11-14, 11,108 ticks through the full campaign:

| Plain-cart replay | Average units | p95 | Maximum |
|---|---|---|---|
| Default HUD | 12,009 | 14,229 | 16,860 |
| Performance overlay enabled | 12,359 | 14,573 | 17,213 |

Continue peaked at 14,152 units. The five Alert stress runs peaked between 15,799 and 16,626. No sampled tick exceeded 17,500, the iPod Video FLAC budget at 25 Hz. Music on and off produced identical work. These measurements include real gameplay, not the pilot's pathfinding. They are sampled VM costs, not a promise about every possible input or physical hardware. The runner fails on an over-budget sampled tick.

The 112-column visor, flat floors, bounded prop pool and staggered robot sensing reserve time for gameplay. Close billboards have a screen-size cap. A checkpoint tick reuses the previous 3D picture while updating the HUD, spreading storage and rendering across ticks. After repeated skipped frames the cart falls to 20 Hz; speeds and durations scale by `25.0 / rate()`. Headless runs need explicit skipped-frame input to exercise that fallback.

Use `--store` and `--saves` for persistence during manual VM runs:

```sh
mkdir -p /tmp/outpost-store
../podbox/arcade/sdk/host/pbgvm dist/outpostecho.pbg \
  --ticks 300 --seed 1 --buttons 2:16,3:0,5:16,6:0 --units \
  --store /tmp/outpost-store --saves /tmp/outpost-saves.bin --shot /tmp/outpost.png
```

## Release status

All six software phases are implemented: first-person navigation, interactive puzzles, robots and equipment, a complete Arrival Bay mission, four further sectors and release features. An independent `.github/workflows/outpostecho.yml` builds this cart, tests it and uploads the native and browser artifacts. It pins the SDK and leaves the existing all-cart workflow untouched. The local equivalent passed; the hosted workflow hasn't run until the changes are pushed.

Remaining release validation requires a real iPod Video and Classic: click wheel comfort, audio balance, FLAC playback timing and sustained frame rate. Human difficulty and pacing also need playtesting. The HTML artifact and its WASM engine are built and verified; the app's browser preview blocks local file URLs, so an interactive browser UI smoke test wasn't completed here. Nothing is published or pushed automatically.
