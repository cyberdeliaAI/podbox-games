"""Makes the games' moving pictures: a few seconds of play as a GIF, for
their forum posts and the games' site.

    python3 tools/gifs.py                    # every game listed below
    python3 tools/gifs.py sloop pocketcity   # just these

pbgvm keeps one picture a run, of the last tick, so a GIF of 40 frames is 40
runs of the same game with the same input, each a few ticks longer than the
last, several at once. Each game is built once in a scratch copy, the way
tools/screenshots.py builds it for its stills: with its own test harness
playing where it needs a player (Marble Chain, Bubble Beat, Sloop; Pocket
City drives its test's plan, Powder Run's harness steers round the trees),
Pulse Tunnel on its AUTOPILOT, Pocket Golf
replaying the input its release test saved (run
`python3 tools/pocketgolf_test.py --keep dist/pocketgolf-checks` first).
The frames share one palette and are played at the speed they were taken.

They go to docs/screenshots/<cart>.gif. Beat Dancer 3D and Kremlin Blocks
make their own (beatdancer/previews/disco.gif, kremlinblocks/previews/game.gif).
"""
import concurrent.futures
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import screenshots                 # noqa: E402  its builds, saves files and settings
import pocketcity_test             # noqa: E402  its driving plans
import powderrun_test              # noqa: E402  its skiing plans

REPO = screenshots.REPO
SDK = screenshots.SDK
OUT = screenshots.OUT
BEAT = screenshots.BEAT
AUTOPILOT = [("main.js", "const AUTOPILOT = false;", "const AUTOPILOT = true;")]


def golf_trace():
    """The input Pocket Golf's release test saved, for its replay."""
    d = os.path.join(REPO, "dist", "pocketgolf-checks")
    if not os.path.exists(os.path.join(d, "buttons.txt")):
        raise SystemExit("gifs: run python3 tools/pocketgolf_test.py --keep dist/pocketgolf-checks first")
    return ["--buttons", open(os.path.join(d, "buttons.txt")).read().strip(),
            "--wheel", open(os.path.join(d, "wheel.txt")).read().strip()]


# cart: harness (or None), patches, pbgvm input (a function, so a plan or a
# trace is only made when wanted), saved numbers, first tick, frames, ticks
# between frames, ms a frame
GIFS = {
    "pulsetunnel": (None, AUTOPILOT, lambda: ["--buttons", "120:16,121:0"] + BEAT, {}, 1300, 40, 2, 60),
    "marbles": ("marbles_stress", [], lambda: ["--setting", "stress_level=4", "--setting", "stress_mode=1",
                                               "--setting", "stress_every=20"], {}, 800, 40, 3, 90),
    "bubblebeat": ("bubblebeat_stress", [], lambda: ["--setting", "stress_level=8", "--setting", "stress_mode=1"] + BEAT,
                   {}, 250, 40, 3, 90),
    "sloop": ("sloop_stress", [], lambda: ["--setting", "stress_mode=1"] + BEAT, {}, 1150, 40, 2, 60),
    "pocketwings": (None, [], lambda: ["--seed", "2", "--buttons", "20:16,21:0,100:2,150:0", "--wheel", "200:6:-1"],
                    {1: 4, 9: 0}, 190, 40, 3, 120),
    # its test harness steers round what's ahead, as the title's demo does
    "powderrun": ("powderrun_test", [], lambda: ["--seed", "3", "--setting", "stress_ticks=3000", "--setting", "stress_dodge=1",
                                                 "--setting", "stress_slope=0", "--setting", "stress_mode=0",
                                                 "--setting", "stress_level=1"] + powderrun_test.plan(3, 3000),
                  {}, 900, 40, 3, 90),
    "pocketcity": ("pocketcity_test", [], lambda: ["--seed", "2", "--setting", "stress_ticks=9000"] +
                   pocketcity_test.plan(2, 9000, False), {}, 3240, 40, 3, 90),
    "outpostecho": (None, [], lambda: ["--buttons", "2:16,3:0,5:16,6:0,40:16,41:0"], {}, 40, 40, 3, 120),
    "pocketgolf": (None, [], golf_trace, {}, 12280, 44, 3, 90),
}


def frame(vm, pbg, args, saves, work, n, ticks):
    """Frame n: a run to ticks, its last picture kept. Each run has its own
    saves file and store, as each run writes them."""
    store = os.path.join(work, "store%d" % n)
    os.makedirs(store, exist_ok=True)
    extra = []
    if saves:
        extra = ["--saves", screenshots.saves(os.path.join(work, "saves%d.bin" % n), saves)]
    shot = os.path.join(work, "f%03d.png" % n)
    subprocess.run([vm, pbg, "--ticks", str(ticks), "--shot", shot, "--store", store] + args + extra,
                   capture_output=True, text=True)
    if not os.path.exists(shot):
        raise SystemExit("gifs: no picture at tick %d" % ticks)
    return shot


def make(cart, work, first=None):
    harness, patches, inputs, saves, start, count, step, ms = GIFS[cart]
    if first is not None:
        start = first
    pbg = screenshots.build(cart, work, cart, harness, patches)
    vm = os.path.join(SDK, "host", "pbgvm")
    args = inputs()
    with concurrent.futures.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
        shots = list(pool.map(lambda i: frame(vm, pbg, args, saves, work, i, start + i * step), range(count)))
    frames = [Image.open(s).convert("RGB") for s in shots]
    # one palette for every frame, from all of them side by side
    w, h = frames[0].size
    sheet = Image.new("RGB", (w, h * len(frames)))
    for i, f in enumerate(frames):
        sheet.paste(f, (0, i * h))
    pal = sheet.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    path = os.path.join(OUT, cart + ".gif")
    out[0].save(path, save_all=True, append_images=out[1:], duration=ms, loop=0, optimize=True, disposal=1)
    return path, os.path.getsize(path)


def main():
    args = sys.argv[1:]
    first = None
    if "--start" in args:
        i = args.index("--start")
        first = int(args[i + 1])
        del args[i:i + 2]
    carts = args or list(GIFS)
    for c in carts:
        if c not in GIFS:
            raise SystemExit("gifs: no moving picture listed for %s" % c)
    os.makedirs(OUT, exist_ok=True)
    work = tempfile.mkdtemp(prefix="gifs-")
    try:
        for c in carts:
            d = os.path.join(work, c)
            os.makedirs(d)
            path, size = make(c, d, first)
            print("%s: %d KB" % (os.path.relpath(path, REPO), size // 1024))
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
