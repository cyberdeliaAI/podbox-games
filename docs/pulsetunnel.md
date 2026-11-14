# Pulse Tunnel

A tube shooter for the PodBox Arcade, on the iPod Video and iPod Classic. You fly down a tunnel that moves to your own music. A ring of the tunnel passes you on every beat, and enemies, gates and pickups arrive on the beats of whatever is playing.

## Playing

- **Steer**: rest your thumb on the wheel. The ship goes to where your thumb is. Switch to Spin in the pause menu if you'd rather turn the wheel.
- **Fire**: automatic, on the eighth notes of the music.
- **Bomb**: Select. It clears every enemy and spark in sight.
- **Gates**: fly through the gap. Shots can't pass the wall either.
- **Pickups**: green powers up your guns (twin, then triple), orange gives a bomb.
- **Heavies** take a few hits and fire a spark down their lane.
- A new sector starts every 16 bars and the tunnel gets busier.

Without music the tunnel runs at 120 BPM. With music the iPod's beat tracker finds the tempo and the tunnel takes its colours from the album art.

## On the iPod

Copy `dist/pulsetunnel.pbg` to a folder called `Games` on the iPod, eject, and pick **Arcade** on the main menu.

## Editing

Open the `pulsetunnel` folder in the Arcade IDE (https://anthonyfletcher.github.io/podbox/ide/, Chrome or Edge edits the folder in place). The IDE has a made-up music library with steady tempos, so the beat parts work without an iPod.

From the command line, in `arcade/sdk` of the PodBox repository:

```sh
node pbgc.js build path/to/pulsetunnel -o pulsetunnel.pbg
sh host/build.sh   # once
host/pbgvm pulsetunnel.pbg --ticks 900 --playing --beat 128 --buttons 70:16,71:0 --units --shot out.png
```

Set `AUTOPILOT` to `true` in `main.js` and the ship flies itself, which is handy for long test runs.

## Files

| File | What it does |
|---|---|
| `main.js` | The clock, the beat grid, planning what arrives on each beat, the ship, scoring and the screens |
| `tube.js` | The projection, the tunnel's rings and spokes, and the palette made from the album's colours |
| `foes.js` | Enemies, gates, pickups and sparks: moving, arriving at the rim and drawing |
| `shots.js` | The guns: volleys of up to three shots and what they hit |
| `hud.js` | Score, shields, bombs, tempo, messages, title and game over |
| `sounds/` | The sound effects, as jsfxr settings |

## Tuning

- `tube.VIEW` is how many beats you see ahead, `tube.K` how fast the tunnel narrows.
- `SECTOR_BEATS` in `main.js` is the length of a sector.
- `plan()` in `main.js` decides what comes on each beat: gate spacing, spawn chance, formations and pickups.
- `BEAT_FAST` decides when a fast track is flown at half its tempo (now above about 162 BPM). The Tempo option in the pause menu overrides it per player.

## Performance

Measured with `pbgvm --units` against the slowest case, an iPod Video playing FLAC, which has about 12,500 units a tick at 33 ticks a second and 17,500 at 25. The ship flew on `AUTOPILOT` for 30,000 ticks, with and without music, on Normal and Hard:

- Sector 1: about 7,000 units a tick on average.
- From sector 6 on: about 10,000 on average and 12,000 to 12,500 at the 95th percentile. About 2% to 5% of ticks go over 12,500, in bursts of enemies.
- Drawing the tunnel is about a third of every tick (some 3,300 units) and the enemies about a fifth. The tunnel is already ovals and lines, which cost little each, so there's not much left to save there.
- The beat tracker costs about 6,300 a tick at 33 while it listens, a second or more at each new track. So the game runs at 25 ticks a second while it listens and goes back to 33 once it has the tempo. Most listening ticks then fit. When the tunnel is still full of enemies from the last track, they can still go over 17,500.

When the iPod keeps falling behind, the game steps down to 25 ticks a second by itself and stays there for the rest of the run. All timing runs on milliseconds of the music, so the game plays at the same speed either way. The iPod Classic has plenty of headroom.
