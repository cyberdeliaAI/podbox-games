# PodBox games

Games for the Arcade of [PodBox](https://github.com/anthonyfletcher/podbox), the firmware for the iPod Video and iPod Classic.

| Game | What it is | Docs |
|---|---|---|
| [Pulse Tunnel](pulsetunnel/) | A tube shooter that flies to your own music | [docs/pulsetunnel.md](docs/pulsetunnel.md) |
| [Marble Chain](marbles/) | A marble shooter with six levels and power-ups: stop the chain before it reaches the hole | [docs/marbles.md](docs/marbles.md) |

## Playing

Every push builds each game into a `.pbg` (see the **Actions** tab: open a run and download the game from its artifacts). A tag, such as `v0.2`, also attaches them all to a **Release**.

Copy a `.pbg` to a folder called `Games` on the iPod, eject it, and pick **Arcade** on the main menu.

To play or edit in a browser, open a game's folder (or its `.pbg`) in the [Arcade IDE](https://anthonyfletcher.github.io/podbox/ide/). Chrome and Edge edit the folder in place.

## Building

Every folder with a `cart.json` is a cart. With the PodBox repository cloned next to this one:

```sh
(cd ../podbox/arcade/sdk && npm ci --omit=dev)   # once
sh build.sh                                     # every cart into dist/ (not kept in git)
```

`tools/` holds the scripts that make each game's placeholder art and data.

To add a game, give its folder a `cart.json` and add its name to the cart list in `.github/workflows/build.yml`.
