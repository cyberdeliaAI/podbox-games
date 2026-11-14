"""Plays Sloop by itself, checks it every tick and reports what each tick
of play costs in units.

    python3 tools/sloop_stress.py                     # smart, blind and still; no music, a steady beat and tracks
    python3 tools/sloop_stress.py --modes smart --music tracks --seeds 1,2,3 --ticks 30000
    python3 tools/sloop_stress.py --selftest          # shows the checks can fail

It copies sloop/ into a scratch folder, adds tools/sloop_stress.js as
stress.js, makes update() call stress.tick() first, builds the copy with the
SDK's pbgc and plays it in pbgvm. The cart's own files aren't touched.

The player (see sloop_stress.js):

    smart   swings for the block landing next, to be there on its beat with
            speed: about what a good player does
    blind   turns the wheel at random, through pbgvm, with Play and the nudges
    still   never touches it

The music:

    none    no music: the game's own tempo, 32 bars a round, faster each round
    beat    a steady 120 BPM track
    tracks  the fake library's queue, each track at its own tempo, a round a
            track, listened for afresh each time

A run starts a game, and another when one is over. Every tick it checks:
hearts 0 to 3, the combo 1 to 9, the points never going down in a game,
every block's strength, kind, angle and radius in range and none past the
ring left unmissed, the block count matching the blocks, no block while
the game waits for the tempo, the ball's angle and speed in range, the
rate 25 while listening and 33 otherwise, and no listening beyond its time.

Exit status: 0 when every check held, 1 when one didn't or a run stopped
with an error, 2 when the cart didn't build.
"""
import argparse
import concurrent.futures
import os
import random
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
CART = os.path.join(REPO, "sloop")
HARNESS = os.path.join(HERE, "sloop_stress.js")

MODES = {"blind": 0, "smart": 1, "still": 2}
MUSIC = {"none": [], "beat": ["--playing", "--beat", "120"], "tracks": ["--playing", "--beat", "0"]}
BUDGETS = {33: 12500, 25: 17500}

HOOK = "function update() {"
# the self-test forgets to count a block gone when it reaches the crane
SELFTEST = ("blocks.js", "            on[i] = 0;\n            count--;\n            reached(", "            on[i] = 0;\n            reached(")


def fail(msg, code=2):
    print("sloop_stress: " + msg, file=sys.stderr)
    sys.exit(code)


def blind_input(seed, ticks):
    """Wheel turns at random, now and then Play and the nudges."""
    rnd = random.Random(seed)
    wheel, buttons = [], []
    t = 30
    while t < ticks - 10:
        wheel.append("%d:%d:-1" % (t, rnd.choice([-1, 1]) * rnd.randrange(2, 14)))
        if rnd.random() < 0.08:
            buttons += ["%d:8" % t, "%d:0" % (t + 1)]
        elif rnd.random() < 0.1:
            b = rnd.choice([1, 2])
            buttons += ["%d:%d" % (t, b), "%d:0" % (t + rnd.randrange(3, 12))]
        t += rnd.randrange(3, 20)
    return ["--wheel", ",".join(wheel), "--buttons", ",".join(buttons)]


def build(sdk, work, name, patch=None):
    folder = os.path.join(work, name)
    shutil.copytree(CART, folder)
    shutil.copy(HARNESS, os.path.join(folder, "stress.js"))
    edits = [("main.js", HOOK, HOOK + "\n    stress.tick();")] + ([patch] if patch else [])
    for f, a, b in edits:
        path = os.path.join(folder, f)
        with open(path) as fh:
            src = fh.read()
        if src.count(a) != 1:
            fail("expected '%s' exactly once in sloop/%s" % (a.strip(), f))
        with open(path, "w") as fh:
            fh.write(src.replace(a, b))
    pbg = os.path.join(work, name + ".pbg")
    r = subprocess.run(["node", os.path.join(sdk, "pbgc.js"), "build", folder, "-o", pbg],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        fail("the cart with the harness didn't build")
    return pbg


def play(vm, pbg, mode, music, seed, ticks):
    cmd = [vm, pbg, "--ticks", str(ticks), "--seed", str(seed), "--units",
           "--setting", "stress_mode=%d" % MODES[mode], "--setting", "stress_ticks=%d" % ticks] + MUSIC[music]
    if mode == "blind":
        cmd += blind_input(seed, ticks)
    r = subprocess.run(cmd, capture_output=True, text=True)
    run = {"mode": mode, "music": music, "seed": seed, "exit": r.returncode, "errors": [], "problems": [],
           "summary": {}, "units": [], "rates": []}
    for line in r.stdout.splitlines():
        if line.startswith("VIOLATION"):
            run["problems"].append(line)
        elif line.startswith("STRESS "):
            p = line.split()[1:]
            run["summary"] = {p[i]: int(p[i + 1]) for i in range(0, len(p) - 1, 2)}
    harness = 0
    for line in r.stderr.splitlines():
        p = line.split()
        if len(p) == 3 and p[0] == "prof" and p[1] == "stress":
            harness += int(p[2])
        elif len(p) == 3 and p[0] == "tick":
            run["units"].append(int(p[2]) - harness)
            harness = 0
        elif p and p[0] not in ("start", "prof", "achieved", "show") and not p[0][0].isdigit():
            run["errors"].append(line)
    return run


def stats(units):
    if not units:
        return {"avg": 0, "p95": 0, "max": 0}
    u = sorted(units)
    at = lambda f: u[min(len(u) - 1, int(len(u) * f))]
    return {"avg": sum(u) // len(u), "p95": at(0.95), "max": u[-1]}


def bad(run):
    return run["exit"] != 0 or run["errors"] or not run["summary"] or run["summary"].get("violations", 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--modes", default="smart,blind,still", help="players (default smart,blind,still)")
    ap.add_argument("--music", default="none,beat,tracks", help="music (default none,beat,tracks)")
    ap.add_argument("--seeds", default="1,2", help="seeds (default 1,2)")
    ap.add_argument("--ticks", type=int, default=9000, help="ticks a run (default 9000)")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4, help="runs at once")
    ap.add_argument("--sdk", default=os.environ.get("SDK", os.path.join(REPO, "..", "podbox", "arcade", "sdk")),
                    help="the SDK folder (default $SDK or ../podbox/arcade/sdk)")
    ap.add_argument("--keep", action="store_true", help="keep the scratch folder and say where it is")
    ap.add_argument("--verbose", action="store_true", help="print every problem line")
    ap.add_argument("--selftest", action="store_true",
                    help="forget a block's count in a scratch copy and check that the checks catch it")
    args = ap.parse_args()

    sdk = os.path.abspath(args.sdk)
    vm = os.path.join(sdk, "host", "pbgvm")
    if not os.path.isfile(os.path.join(sdk, "pbgc.js")):
        fail("no SDK at %s: clone https://github.com/anthonyfletcher/podbox next to this repo or pass --sdk" % sdk)
    if not os.access(vm, os.X_OK):
        fail("no %s: run 'sh host/build.sh' in the SDK folder" % vm)
    modes = [m for m in args.modes.split(",") if m]
    musics = [m for m in args.music.split(",") if m]
    seeds = [int(s) for s in args.seeds.split(",") if s.strip()]
    for m in modes:
        if m not in MODES:
            fail("no player called %s" % m)
    for m in musics:
        if m not in MUSIC:
            fail("no music called %s" % m)

    work = tempfile.mkdtemp(prefix="sloop-stress-")
    try:
        if args.selftest:
            pbg = build(sdk, work, "broken", SELFTEST)
            print("Self-test: blocks.js forgets to count a block gone when it reaches the crane")
            run = play(vm, pbg, "still", "none", 1, 3000)
            v = run["summary"].get("violations", 0)
            print("  %d violations, first: %s" % (v, run["problems"][0] if run["problems"] else "none"))
            print("ok: the checks caught it" if v else "FAIL: no violations, so the checks aren't working")
            return 0 if v else 1
        pbg = build(sdk, work, "sloop")
        jobs = [(m, mu, s) for m in modes for mu in musics for s in seeds]
        print("Sloop: %d runs of %d ticks" % (len(jobs), args.ticks))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            runs = list(pool.map(lambda j: play(vm, pbg, j[0], j[1], j[2], args.ticks), jobs))
        print()
        print("  player  music   seed  games  best   round  smashed  triple  gold  hearts  combo  listening    avg    p95    max  over 12,500")
        fails = 0
        for run in runs:
            s = run["summary"]
            u = stats(run["units"])
            over = sum(1 for v in run["units"] if v > BUDGETS[33])
            print("  %-6s  %-6s  %4d  %5d  %5d  %5d  %7d  %6d  %4d  %6d  %5d  %9d  %5s  %5s  %5s  %5.1f%%" % (
                run["mode"], run["music"], run["seed"], s.get("games", 0), s.get("points", 0), s.get("round", 0),
                s.get("smashed", 0), s.get("triples", 0), s.get("golds", 0), s.get("hearts", 0), s.get("combo", 0),
                s.get("listen", 0), "{:,}".format(u["avg"]), "{:,}".format(u["p95"]), "{:,}".format(u["max"]),
                100.0 * over / max(1, len(run["units"]))))
        for run in runs:
            if bad(run):
                fails += 1
                print("\n%s %s seed %d: exit %d" % (run["mode"], run["music"], run["seed"], run["exit"]))
                for line in run["errors"][:5] + (run["problems"] if args.verbose else run["problems"][:5]):
                    print("  " + line)
        print()
        print("  (units: a tick's, the harness taken out; while listening the game runs at 25 a second, budget 17,500)")
        print("%d runs: %s" % (len(runs), "FAIL" if fails else "ok"))
        return 1 if fails else 0
    finally:
        if args.keep:
            print("scratch folder kept: %s" % work)
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
