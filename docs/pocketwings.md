# Pocket Wings 3D

A relaxed flying game for the PodBox Arcade: a small propeller aircraft over a landscape, with no enemies, no score and no time limit. Just fly.

This is phase 1 of the plan below: one landscape (Green Valley), the flight, both camera views, the instruments and a picture that adjusts itself to what the iPod can draw.

## Flying

| Control | Action |
|---|---|
| Wheel | Bank and turn. Leave it and the wings level by themselves |
| Prev (held) | Climb |
| Next (held) | Dive |
| Play | Slow, cruise or fast |
| Select | The view from behind or the cockpit |
| Menu | Pause: Restart flight, Main menu, options |

With Thumb steering (pause menu) the aircraft banks toward where your thumb rests on the wheel, right or left of the top.

The ground can't hurt you. The aircraft looks at the ground under it and a little ahead (further at speed), rises smoothly when it gets close and never comes nearer than three world pixels. The world wraps: fly off one side and you come back in on the other.

## The views

- **Behind**: the camera hangs a little behind and above the aircraft. The aircraft's sprite shows the bank, and its shadow follows it over the ground. A compass strip runs along the top, the height (metres above the water) and the speed (knots) sit in the corners.
- **Cockpit**: the camera sits in the aircraft, with a panel along the bottom: height, heading, speed and a dial that tips with the wings.

The Arcade's 3D view can't roll the picture, so the horizon stays level in a turn. Climbing and diving move the horizon up and down instead.

## The landscape

`tools/pocketwings_assets.py` makes Green Valley: rolling hills, a river that winds right round the world and meets itself, two lakes, forests, a patchwork of fields, three villages and rock on the steepest slopes. Each material has three shades, chosen by how the slope faces a sun in the north-west, so the hills have their shading for free.

Every landscape is 256 world pixels square and seamless, because `land.draw` wraps the world. The noise is made periodic by tiling a small random lattice three by three, scaling it up and cutting out the middle. At cruise the valley takes about 20 seconds to cross.

The pictures are lazy images: only the landscape being flown is read from the cart, so more landscapes cost no memory until they're chosen.

## The picture adjusts itself

`land.draw` is by far the dearest thing drawn. On an iPod Video playing FLAC a tick has about 12,500 units at 33 ticks a second, 17,500 at 25 and 22,800 at 20, and the full-size valley alone costs 20,000 to 29,000. So the picture comes in five levels:

| Level | Landscape | Ground | Far hills | Sees | Rate | Units (behind, avg / p95) |
|---|---|---|---|---|---|---|
| Q0 | full size | fine | yes | 300 | 33 | 38,000 / 39,300 |
| Q1 | full size | coarse | yes | 300 | 33 | 27,100 / 28,300 |
| Q2 | half size | coarse | no | 300 | 25 | 15,000 / 16,200 |
| Q3 | half size | coarse | no | 200 | 25 | 13,400 / 14,900 |
| Q4 | half size | coarse | no | 200 | 20 | 13,400 / 15,000 |

The **half-size landscape** is the trick that makes an iPod Video playing music work. Each landscape is also stored at 128 square with its heights halved, and the quicker levels draw that one with the camera's place halved to match. Perspective doesn't care about scale, so it's the same view of the same landscape, only coarser, for about 8,000 units less. The flying always goes by the full-size heights.

**Auto** (the default) watches the frames that run late. More than three in a second and it steps down a level. After a quiet spell it tries a level up, on trial for three seconds and watched every tick, so a failed try costs a couple of frames; each failed try puts the next one further off, from half a minute up to four. A level that holds for twenty seconds is remembered for the next flight. Measured on simulated iPods:

| iPod | Settles at | Time there | Ticks over budget |
|---|---|---|---|
| iPod Video playing FLAC | Q2, 25 frames a second | 98% | 0.1% |
| iPod Video, music stopped | Q0, 33 frames a second | 96% | 0% |
| iPod Classic | Q0, 33 frames a second | 96% | 0% |

The Picture option can also hold it at Fast (Q3) or Detailed (Q0). The Frame rate option shows the level and the rate on screen.

The far hills on the horizon (`plane.sky`, about 2,900 units) stand where the drawn ground ends rather than on the true horizon, which is lower on the screen the higher you fly.

## Testing

`python3 tools/pocketwings_test.py` flies the game by itself in `pbgvm` from flight plans made from a seed: turns of the wheel, Prev and Next held (often all the way down to the hills) and Play for the speeds, through pbgvm's real input. It holds each level in turn from both views and reports the units, then lets Auto run on a simulated iPod Video playing FLAC, iPod Video and iPod Classic. Every tick it checks that the aircraft is above the ground, the chase camera too, that the place, heading, bank and speed are in range and that the rate matches the level. `--selftest` takes the lift and the floor away in a scratch copy to show the checks catch the aircraft going through the ground.

For the simulated iPods `quality.js` has a `sim` setting that judges each tick by its own units (`unitsnow()` at the end of `draw()`) against that iPod's budget, instead of by `skipped()`. The game leaves it off.

## Files

| File | What it does |
|---|---|
| `main.js` | The scenes, the options and the order of things |
| `world.js` | The landscapes: loading their pictures and palette, the ground's height |
| `flight.js` | The aircraft: controls, banking, climbing, speeds, keeping clear of the ground |
| `view.js` | The picture: sky, far hills, ground, fog, the chase camera, the aircraft and its shadow |
| `quality.js` | The five levels of the picture and Auto |
| `hud.js` | The instruments and messages |
| `title.js` | The start screen over a flyover, and how to fly |
| `images/valley_*.png`, `palettes/valley.gpl`, `sheet.png`, `logo.png` | Made by `tools/pocketwings_assets.py` |
| `sounds/` | Tick, gear and start |

## The plan from here

1. **Phase 1, done**: Green Valley, flying, both views, instruments, the self-adjusting picture, the test tool.
2. **Phase 2**: an attitude display and a vertical speed in the cockpit, gentler handling at the edges of the speeds, terrain-following assistance (Scenic flight).
3. **Phase 3**: the other five landscapes, each made by its own shaping in the assets script (islands in a sea, ridged alps, terraced canyons, frozen lakes, volcanic craters) with its own palette and far hills. The island landscapes hide the wrap behind open water.
4. **Phase 4**: scenery as billboards (trees, palms, houses), placed by the assets script and kept to what the level allows; an engine sound (a tone that follows the speed); Discovery mode with landmarks to find, saved.
5. **Phase 5**: release, and a page to play in a browser where the Arcade allows it (a cart that leaves the music alone can be exported; Pages needs a public repo).

Still to find out: how `plane.billboards` stands sprites on `land.draw`'s hills (the `zs` heights), and what billboards cost on top of the half-size landscape.
