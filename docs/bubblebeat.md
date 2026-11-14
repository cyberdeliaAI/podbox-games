# Bubble Beat

A bubble shooter for the PodBox Arcade that plays to your own music. Bubbles hang from a ceiling in a hex grid. Aim the launcher with the wheel and shoot: three or more of one colour together pop, and whatever they held up falls for more. The ceiling comes down a row every few bars of the music, so a calm song gives you time and a loud one doesn't. Shoot on the beat and the pop counts double; on the first beat of a bar, triple.

Without music the game works just as well: the ceiling then comes down every few shots.

## Controls

- **Aim**: turn the wheel. Prev and Next nudge the aim while held. Switch to Thumb in the pause menu to point the launcher where your thumb rests instead.
- **Shoot**: Select. The dotted guide shows the first stretch of the path, bounces included.
- **Swap** the loaded bubble with the next: Play.
- **Menus**: turn the wheel (or press Prev and Next) to move, Select to choose. The pause menu has Restart level and Main menu.

## Rules

- A bubble flies until it touches a bubble or the ceiling, bouncing off the walls, and sticks to the nearest free spot.
- Three or more of its colour joined together pop. Every bubble no longer hanging from the ceiling falls.
- The launcher only loads colours still on the field.
- The level is won when the field is clear and lost when a bubble hangs below the line above the launcher.

## The beat

When a track starts the game listens for its tempo, which takes a second or two. The panel on the right then shows the tempo and four dots for the bar, lit on each beat.

- **Shots on the beat**: a shot fired within 110 ms of a beat multiplies what it pops and drops by two, or by three on a bar's first beat.
- **The ceiling**: its meter on the right fills with every beat, a bar of loud music faster and a quiet one slower, and the ceiling comes down a row when it's full. It shakes when it's nearly there.
- **No beat**: when the tracker can't find one (a quiet intro, spoken word) the screen says NO BEAT YET and it listens again eight seconds later, three tries a track. Meanwhile, and without music, the meter fills with shots instead.
- The Beat bonus option turns all of this off: no listening, and the ceiling goes by shots.

## Scoring

- A popped bubble is 10, a fallen one 20, or 40 when six or more fall at once.
- On the beat: everything the shot scores times two, on a bar's first beat times three.
- A cleared level adds 1,000, plus 250 for every drop of the ceiling short of six.
- The run's score goes to the Arcade's score table when the game is over. The furthest level reached is kept, and the start screen offers to continue there.

## Levels

Levels are made from their number, so level 7 is the same every time. Each is one of eight shapes cut from the top rows (a block, a wedge, an hourglass, a beam with pillars, a lattice, two lobes, a wave and a frame), filled with colours in clusters: a bubble often takes its left or upper neighbour's colour, so there are groups to find.

| Level | Colours | Rows | Bars a drop | Shots a drop |
|---|---|---|---|---|
| 1 | 3 | 5 | 10 | 10 |
| 3 | 4 | 6 | 9 | 10 |
| 6 | 5 | 7 | 8 | 9 |
| 9 | 6 | 8 | 7 | 8 |
| 12 | 7 | 9 | 6 | 7 |
| 18 and on | 7 | 9 | 4 | 6, 5 from 20 |

All of it is in `levels.js`.

## Options

| Option | |
|---|---|
| Aiming | Spin (the wheel turns the launcher) or Thumb (it points where your thumb rests) |
| Beat bonus | On: the game follows the music. Off: the ceiling goes by shots |
| Colour marks | A small mark on every bubble, a different one for each colour |

## How it works

The grid is stored doubled: every bubble takes two cells side by side of a board 24 cells wide, and odd rows sit one cell to the right. Joined across and down, the way the Arcade's `grid.region` and `grid.fill` join cells, a bubble then touches exactly its six neighbours on the hex grid. So the engine finds a colour's group (`grid.region` from the bubble that landed) and what still hangs from the ceiling (`grid.fill` from a solid ceiling row on a copy of the board, then whatever is left is loose), instead of loops in script.

A bubble's centre is simply `FX + 4 + x * 4` for its first cell's column `x` on that board, whatever its row, which keeps a big pop cheap.

The field is drawn into a picture only when it changes and copied to the screen each tick. A bubble that lands without popping anything is drawn into the picture on its own. A pop, a fall or a drop of the ceiling has the whole picture drawn again on the next tick, and the guide is worked out again on the tick after that, so the work of a big pop is spread over three ticks. The ceiling, the launcher, the shot, the effects and the beat panel are drawn on top every tick.

On a bar's first beat the bubbles' highlights flash white for three ticks, through the palette.

## Stress test

`python3 tools/bubblebeat_stress.py` plays the game by itself in `pbgvm` and checks the board at the start of every tick: the two halves of every bubble agree, the colour and row counts match the board, the ceiling row is whole, nothing hangs from nothing, no bubble is below the line and the launcher only holds colours that are on the board. It reports the units each tick of play costs, with its own work taken out.

The smart player tries 41 aims with both bubbles, flies each one as the game would and takes the biggest pop; with a beat it waits for the beat. The blind player shoots at random. Each runs with no music and with the fake library's tracks at their own tempos. `--selftest` breaks the colour counts in a scratch copy to show the checks catch it.

## Performance

Measured with the stress test, 32 runs of 9,000 ticks (levels 1, 5, 10 and 20, two seeds, smart and blind, with and without music):

| | Units a tick |
|---|---|
| Average | 3,500 to 3,700 |
| 95th percentile | 4,800 to 4,900 |
| 99th percentile | 8,000 to 10,000 |
| Over 12,500 | 0.1% of ticks |

The worst ticks are a single shot that pops and drops 30 bubbles or more: up to about 23,000 for that one tick. While the beat tracker listens, a second or two at each new track, it adds about 6,300.

## Files

| File | What it does |
|---|---|
| `main.js` | The game around the board: scenes, the ceiling, scoring, effects, the picture of the field and the panels |
| `board.js` | The doubled hex grid: placing, groups, what falls, where a shot touches and comes to rest, drawing the bubbles |
| `launcher.js` | Aiming, loading, firing, swapping, the bubble in flight and the guide |
| `rhythm.js` | Listening for the tempo, the three tries, following the beats, judging a shot |
| `levels.js` | The eight shapes, the colours in clusters and how hard each level presses |
| `title.js` | The start screen and how to play |
| `palettes/bubble.gpl`, `sheet.png`, `images/back.png`, `logo.png` | The art, made by `tools/bubblebeat_assets.py` |
| `sounds/` | Shoot, bounce, stick, pop, fall, drop, warn, beat, clear, lose, swap, tick and start |

`tools/bubblebeat_assets.py` makes the palette (the standard sixteen colours, then three shades of eight bubble colours, then the playfield's own), the sprite sheet (the bubbles, the bubbles with their marks and two pop frames), the background and the logo.

## Ideas

- A bonus for popping the colour that matches what the music is doing (`playback.bands()`), as the original concept had it.
- An endless mode where a new row pushes in from the top on every few bars instead of the ceiling coming down.
- Spreading a giant pop's effects over a few ticks as a ripple outward from the shot, which would also flatten the last performance spikes.
