# Posts for the PodBox forum

Drafts of one thread per game for the **Games** category of [PodBox's Discussions](https://github.com/anthonyfletcher/podbox/discussions), following the list in [discussion 42](https://github.com/anthonyfletcher/podbox/discussions/42): screenshots, a download, a browser link where there is one, the players it was tested on, the PodBox release it was built with, how to play, licence and credit.

| Game | Draft | Browser | Thread |
|---|---|---|---|
| Pulse Tunnel | [pulsetunnel.md](pulsetunnel.md) | no: it follows the music | [#48](https://github.com/anthonyfletcher/podbox/discussions/48) |
| Marble Chain | [marbles.md](marbles.md) | yes | [#49](https://github.com/anthonyfletcher/podbox/discussions/49) |
| Bubble Beat | [bubblebeat.md](bubblebeat.md) | no: it follows the music | [#50](https://github.com/anthonyfletcher/podbox/discussions/50) |
| Sloop | [sloop.md](sloop.md) | no: it follows the music | [#51](https://github.com/anthonyfletcher/podbox/discussions/51) |
| Pocket Wings 3D | [pocketwings.md](pocketwings.md) | yes | [#52](https://github.com/anthonyfletcher/podbox/discussions/52) |
| Powder Run 3D | [powderrun.md](powderrun.md) | yes | [#53](https://github.com/anthonyfletcher/podbox/discussions/53) |
| Outpost Echo 3D | [outpostecho.md](outpostecho.md) | yes | [#54](https://github.com/anthonyfletcher/podbox/discussions/54) |
| Pocket Golf Deluxe | [pocketgolf.md](pocketgolf.md) | yes | [#55](https://github.com/anthonyfletcher/podbox/discussions/55) |
| Pocket City 3D | [pocketcity.md](pocketcity.md) | yes | [#56](https://github.com/anthonyfletcher/podbox/discussions/56) |
| Beat Dancer 3D | [beatdancer.md](beatdancer.md) | no: it follows the music (its post shows the GIF from `beatdancer/previews/`) | [#57](https://github.com/anthonyfletcher/podbox/discussions/57) |
| Kremlin Blocks | [kremlinblocks.md](kremlinblocks.md) | yes (its post shows the GIF from `kremlinblocks/previews/`) | [#58](https://github.com/anthonyfletcher/podbox/discussions/58) |

All eleven were posted on 2026-11-14 as cyberdeliaAI: Pocket City and Beat Dancer with release 1.1, Kremlin Blocks with 1.2. The thread's title is the draft's first heading, the post the rest, from the line under it.

## Before posting

Done on 2026-11-14: the MIT licence, every game played on an iPod Video 5.5G, the repository public, Pages on (source: GitHub Actions).

1. **Tag a release**, `v1.0` say: `git tag v1.0 && git push origin v1.0`. `build.yml` attaches every `.pbg` but Pocket City's to the release. When it's done, `pages.yml` publishes the browser games at <https://cyberdeliaai.github.io/podbox-games/>.
2. **Check the links** in a private window, signed out: the download, the browser page and the pictures.
3. **Built with.** The drafts say PodBox release 2026-11-13, the latest when they were written. CI builds with the builder's latest SDK, so check the date of PodBox's latest release on the day of the tag.

## Pictures

The drafts link the pictures in `docs/screenshots/` on `raw.githubusercontent.com`, which works once the repository is public. Dragging the PNGs into the post's editor works as well and doesn't depend on the repository.

`python3 tools/screenshots.py` takes them again: each game is built in a scratch copy, played by its test harness where it needs a player and photographed in `pbgvm`. `python3 tools/gifs.py` makes each post's moving picture, the first in it, the same way: a run a frame, a few seconds of play (Pocket Golf's replays its release test's saved input: run that test with `--keep dist/pocketgolf-checks` first). Beat Dancer and Kremlin Blocks make their own. Run them after a change that shows, and update the post.

## Updating

Discussion 42 asks for the first post to be edited when a game changes, not a new thread. Tag a new release first: the download links point at the latest release, so they follow by themselves.
