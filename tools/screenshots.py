"""Takes the screenshots for the games' posts and README.

    python3 tools/screenshots.py                 # every game
    python3 tools/screenshots.py sloop marbles   # just these

Each shot builds a scratch copy of the cart, with the game's own test
harness playing it where a game needs a player (Marble Chain, Bubble Beat
and Sloop play themselves through their stress harness, Pocket City's
pilot does its jobs; Pulse Tunnel flies on its AUTOPILOT), runs it in pbgvm to the tick given with the input given
and keeps pbgvm's picture of the screen (160x120, doubled to 320x240). The
shots go to docs/screenshots/<cart>-<n>.png as indexed PNGs, small enough
for a post. The cart folders aren't touched.

Re-run it after a change that shows, and after a PodBox release, before
updating a post.
"""
import os
import shutil
import struct
import subprocess
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SDK = os.environ.get("SDK", os.path.join(REPO, "..", "podbox", "arcade", "sdk"))
OUT = os.path.join(REPO, "docs", "screenshots")
HOOK = "function update() {"
BEAT = ["--playing", "--beat", "120"]


def saves(path, numbers):
    """A saves file with these saved numbers set: {slot: value}."""
    v = [0] * 256
    for k, n in numbers.items():
        v[k] = n
    with open(path, "wb") as f:
        f.write(struct.pack("<256i", *v) + bytes(32))
    return path


# cart: list of (name, harness or None, patches, pbgvm args, saved numbers)
# A harness is a tools/<file>.js copied in as stress.js and called first in
# update(). A harness of "copy" takes the picture at args[0] in the repo
# instead: Pocket Golf's own previews, made by tools/pocketgolf_preview.py.
SHOTS = {
    "pulsetunnel": [
        ("title", None, [], ["--ticks", "200"] + BEAT, {}),
        ("run", None, [("main.js", "const AUTOPILOT = false;", "const AUTOPILOT = true;")],
         ["--ticks", "1400", "--buttons", "120:16,121:0"] + BEAT, {}),
        ("later", None, [("main.js", "const AUTOPILOT = false;", "const AUTOPILOT = true;")],
         ["--ticks", "3300", "--buttons", "120:16,121:0"] + BEAT, {}),
    ],
    "marbles": [
        ("title", None, [], ["--ticks", "120"], {}),
        ("level1", "marbles_stress", [], ["--ticks", "900", "--setting", "stress_level=1",
                                           "--setting", "stress_mode=1", "--setting", "stress_every=20"], {}),
        ("level4", "marbles_stress", [], ["--ticks", "1500", "--setting", "stress_level=4",
                                           "--setting", "stress_mode=1", "--setting", "stress_every=20"], {}),
    ],
    "bubblebeat": [
        ("title", None, [], ["--ticks", "120"], {}),
        ("level3", "bubblebeat_stress", [], ["--ticks", "190", "--setting", "stress_level=3",
                                              "--setting", "stress_mode=1"] + BEAT, {}),
        ("level8", "bubblebeat_stress", [], ["--ticks", "330", "--setting", "stress_level=8",
                                              "--setting", "stress_mode=1"] + BEAT, {}),
    ],
    "sloop": [
        ("title", None, [], ["--ticks", "120"] + BEAT, {}),
        ("triple", "sloop_stress", [], ["--ticks", "1213", "--setting", "stress_mode=1"] + BEAT, {}),
        ("busy", "sloop_stress", [], ["--ticks", "4400", "--setting", "stress_mode=1"] + BEAT, {}),
    ],
    "pocketwings": [
        ("valley", None, [], ["--ticks", "260", "--seed", "2", "--buttons", "20:16,21:0,100:2,150:0",
                              "--wheel", "200:6:-1"], {1: 4, 9: 0}),
        ("alps", None, [], ["--ticks", "420", "--seed", "3", "--buttons", "20:16,21:0,150:2,200:0",
                            "--wheel", "300:6:-1"], {1: 4, 9: 2}),
        ("cockpit", None, [], ["--ticks", "330", "--seed", "3", "--buttons", "20:16,21:0,60:16,61:0",
                               "--wheel", "200:-6:-1"], {1: 4, 9: 3}),
    ],
    "powderrun": [
        ("alpine", None, [], ["--ticks", "520", "--seed", "3", "--buttons", "20:16,21:0",
                              "--wheel", "300:6:-1,301:6:-1,360:-5:-1,361:-5:-1,470:7:-1"], {1: 1, 9: 0, 10: 7}),
        ("sunset", None, [], ["--ticks", "520", "--seed", "3", "--buttons", "20:16,21:0",
                              "--wheel", "300:6:-1,301:6:-1,360:-5:-1,361:-5:-1,470:7:-1"], {1: 1, 9: 3, 10: 7}),
        ("title", None, [], ["--ticks", "200", "--seed", "3"], {1: 1, 9: 2, 10: 7}),
    ],
    "outpostecho": [
        ("title", None, [], ["--ticks", "40"], {}),
        ("docking", None, [], ["--ticks", "120", "--buttons", "2:16,3:0,5:16,6:0,40:16,41:0"], {}),
        ("scanner", None, [], ["--ticks", "70", "--buttons", "2:16,3:0,5:16,6:0,30:8,52:0,60:8,61:0"], {}),
    ],
    "pocketgolf": [
        ("title", None, [], ["--ticks", "40"], {}),
        ("pirate", "copy", [], ["pocketgolf/previews/pirate.png"], {}),
        ("desert", "copy", [], ["pocketgolf/previews/desert.png"], {}),
    ],
    # the test's pilot plays the jobs: a chase through Downtown, a fare in
    # Greenside; then the police after a player standing still
    "pocketcity": [
        ("downtown", "pocketcity_test", [], ["--ticks", "1830", "--seed", "1", "--setting", "stress_ticks=14000",
                                             "--setting", "stress_jobs=1"], {}),
        ("greenside", "pocketcity_test", [], ["--ticks", "3130", "--seed", "1", "--setting", "stress_ticks=14000",
                                              "--setting", "stress_jobs=1"], {}),
        ("police", "pocketcity_test", [], ["--ticks", "430", "--seed", "2", "--setting", "stress_ticks=9000",
                                           "--setting", "stress_heat=60", "--buttons", "20:0"], {}),
    ],
    "beatdancer": [
        ("groove", None, [], ["--ticks", "400", "--seed", "1"] + BEAT, {}),
        ("disco", None, [], ["--ticks", "900", "--seed", "1"] + BEAT, {}),
        ("robot", None, [], ["--ticks", "1650", "--seed", "1"] + BEAT, {}),
    ],
}


def build(cart, work, name, harness, patches):
    folder = os.path.join(work, name)
    shutil.copytree(os.path.join(REPO, cart), folder)
    edits = list(patches)
    if harness:
        shutil.copy(os.path.join(HERE, harness + ".js"), os.path.join(folder, "stress.js"))
        edits.append(("main.js", HOOK, HOOK + "\n    stress.tick();"))
    for f, a, b in edits:
        path = os.path.join(folder, f)
        with open(path) as fh:
            src = fh.read()
        if src.count(a) != 1:
            raise SystemExit("screenshots: expected '%s' once in %s/%s" % (a.strip(), cart, f))
        with open(path, "w") as fh:
            fh.write(src.replace(a, b))
    pbg = os.path.join(work, name + ".pbg")
    r = subprocess.run(["node", os.path.join(SDK, "pbgc.js"), "build", folder, "-o", pbg],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("screenshots: %s didn't build:\n%s" % (cart, r.stdout + r.stderr))
    return pbg


def shoot(cart, work):
    vm = os.path.join(SDK, "host", "pbgvm")
    made = []
    for n, (label, harness, patches, args, numbers) in enumerate(SHOTS[cart], start=1):
        out = os.path.join(OUT, "%s-%d.png" % (cart, n))
        if harness == "copy":
            Image.open(os.path.join(REPO, args[0])).convert("RGB").quantize(
                colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out, optimize=True)
            made.append("%s (%s)" % (os.path.relpath(out, REPO), label))
            continue
        pbg = build(cart, work, "%s_%d" % (cart, n), harness, patches)
        shot = os.path.join(work, "%s_%d.png" % (cart, n))
        extra = []
        if numbers:
            extra = ["--saves", saves(os.path.join(work, "%s_%d.bin" % (cart, n)), numbers)]
        store = os.path.join(work, "store_%s_%d" % (cart, n))
        os.makedirs(store, exist_ok=True)
        r = subprocess.run([vm, pbg, "--shot", shot, "--store", store] + args + extra,
                           capture_output=True, text=True)
        if not os.path.exists(shot):
            raise SystemExit("screenshots: no picture from %s %s:\n%s" % (cart, label, r.stderr[-500:]))
        Image.open(shot).convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT,
                                                 dither=Image.Dither.NONE).save(out, optimize=True)
        made.append("%s (%s)" % (os.path.relpath(out, REPO), label))
    return made


def main():
    carts = sys.argv[1:] or list(SHOTS)
    for c in carts:
        if c not in SHOTS:
            raise SystemExit("screenshots: no shots listed for %s" % c)
    os.makedirs(OUT, exist_ok=True)
    work = tempfile.mkdtemp(prefix="screenshots-")
    try:
        for c in carts:
            for line in shoot(c, work):
                print(line)
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
