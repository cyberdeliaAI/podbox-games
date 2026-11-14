# Posts for the PodBox forum

Drafts of one thread per game for the **Games** category of [PodBox's Discussions](https://github.com/anthonyfletcher/podbox/discussions), following the list in [discussion 42](https://github.com/anthonyfletcher/podbox/discussions/42): screenshots, a download, a browser link where there is one, the players it was tested on, the PodBox release it was built with, how to play, licence and credit.

| Game | Draft | Browser |
|---|---|---|
| Pulse Tunnel | [pulsetunnel.md](pulsetunnel.md) | no: it follows the music |
| Marble Chain | [marbles.md](marbles.md) | yes |
| Bubble Beat | [bubblebeat.md](bubblebeat.md) | no: it follows the music |
| Sloop | [sloop.md](sloop.md) | no: it follows the music |
| Pocket Wings 3D | [pocketwings.md](pocketwings.md) | yes |
| Powder Run 3D | [powderrun.md](powderrun.md) | yes |
| Outpost Echo 3D | [outpostecho.md](outpostecho.md) | yes |
| Pocket Golf Deluxe | [pocketgolf.md](pocketgolf.md) | yes |

Pocket City 3D gets a post when it's more than a prototype.

The thread's title is the draft's first heading. Paste the rest, from the line under it. Each draft still has `[TODO ...]` lines: the players it was tested on, the licence and how it was made.

## Before posting

1. **Licence.** Add a `LICENSE` file and fill in the drafts' licence line and the README.
2. **Play it on an iPod.** Fill in **Tested on**: iPod Video (5G or 5.5G), iPod Classic (6G or 7G). Everything so far has been tested in `pbgvm` only.
3. **Versions.** Each `cart.json` has its own `version`. Pulse Tunnel says `1`, Marble Chain `0.2`, Bubble Beat `0.1` and Pocket City `0.1`; the rest `1.0`.
4. **Open the repository.** Settings, General, Change visibility, or `gh repo edit cyberdeliaAI/podbox-games --visibility public --accept-visibility-change-consequences`. Then change "The repo is private" in `CLAUDE.md`.
5. **Turn on Pages.** Settings, Pages, Source: GitHub Actions.
6. **Tag a release**, `v1.0` say: `git tag v1.0 && git push origin v1.0`. `build.yml` attaches every `.pbg` to the release and `pages.yml` publishes the browser games at <https://cyberdeliaai.github.io/podbox-games/>.
7. **Check the links** in a private window, signed out: the download, the browser page and the pictures.
8. **Built with.** The drafts say PodBox release 2026-11-13, the latest when they were written. CI builds with the builder's latest SDK, so check the date of PodBox's latest release on the day of the tag.

## Pictures

The drafts link the pictures in `docs/screenshots/` on `raw.githubusercontent.com`, which works once the repository is public. Dragging the PNGs into the post's editor works as well and doesn't depend on the repository.

`python3 tools/screenshots.py` takes them again: each game is built in a scratch copy, played by its test harness where it needs a player and photographed in `pbgvm`. Run it after a change that shows, and update the post.

## Updating

Discussion 42 asks for the first post to be edited when a game changes, not a new thread. Tag a new release first: the download links point at the latest release, so they follow by themselves.
