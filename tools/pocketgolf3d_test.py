"""Plays Pocket Golf 3D by itself, checks the game every tick and reports
what each tick costs in units.

    python3 tools/pocketgolf3d_test.py                  # smart, wild and input players, practice through every hole, saves
    python3 tools/pocketgolf3d_test.py --seeds 1,2,3,4,5,6 --rounds 3
    python3 tools/pocketgolf3d_test.py --selftest       # shows the checks can fail

It copies pocketgolf3d/ into a scratch folder, adds tools/pocketgolf3d_test.js
as stress.js, makes update() call stress.tick() first, builds the copy with
the SDK's pbgc and plays it in pbgvm. The cart's own files aren't touched.

Players: smart (the game's aim and club, the power for the distance, a
putt read for its slope, a little error), wild (any aim near, any club,
power and error) and input (the buttons and the wheel pressed at random
through pbgvm, so the real swing meter and menus are played). A practice
run goes through every hole several times, loading each hole's pictures
again, and a saves run checks what a round leaves in the saved numbers.

Each tick it checks the scene, the club, the meter, the aim, the hole
loaded, the strokes and scores, the ball (on the map, in bounds at rest,
never under the ground, on it when not flying, not too fast, never at rest
on water), how long a shot and a picture take, a holed ball at the pin
and its hole's best saved.

Units: a tick whose draw() works on the picture (a cut: the land, then the
trees over a few ticks) is reported apart from the ticks of play. Play
ticks must stay inside the iPod Video's 17,500 at 25 ticks a second; the
picture's first tick (the land) goes a little over, and the screen holds
the last picture through it.

Exit status: 0 when every check held, 1 when one didn't or a run stopped
with an error, 2 when the cart didn't build.
"""
import argparse
import concurrent.futures
import os
import random
import shutil
import struct
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
CART = os.path.join(REPO, "pocketgolf3d")
HARNESS = os.path.join(HERE, "pocketgolf3d_test.js")

HOOK = "function update() {"
# the self-test lets a rolling ball sink into the ground
SELFTEST = [("ball.js", "    z = course.ground(x, y);\n    s = course.surface(x, y);",
             "    z = course.ground(x, y) - 1.0;\n    s = course.surface(x, y);")]
BUDGET = 17500                     # units a tick at 25, iPod Video playing FLAC
MODES = {0: "smart", 1: "wild", 2: "input"}


def fail(msg, code=2):
    print("pocketgolf3d_test: " + msg, file=sys.stderr)
    sys.exit(code)


def sdk_dir(arg):
    sdk = arg or os.environ.get("SDK") or os.path.join(REPO, "..", "podbox", "arcade", "sdk")
    if not os.path.exists(os.path.join(sdk, "pbgc.js")):
        fail("no SDK at %s (set --sdk or SDK)" % sdk)
    vm = os.path.join(sdk, "host", "pbgvm")
    if not os.path.exists(vm):
        fail("no pbgvm at %s: build it with sh host/build.sh in the SDK" % vm)
    return sdk, vm


def build(sdk, work, name, patches=()):
    folder = os.path.join(work, name)
    shutil.copytree(CART, folder)
    shutil.copy(HARNESS, os.path.join(folder, "stress.js"))
    edits = [("main.js", HOOK, HOOK + "\n    stress.tick();")] + list(patches)
    for f, a, b in edits:
        path = os.path.join(folder, f)
        with open(path) as fh:
            src = fh.read()
        if src.count(a) != 1:
            fail("expected '%s' exactly once in pocketgolf3d/%s" % (a.strip(), f))
        with open(path, "w") as fh:
            fh.write(src.replace(a, b))
    pbg = os.path.join(work, name + ".pbg")
    r = subprocess.run(["node", os.path.join(sdk, "pbgc.js"), "build", folder, "-o", pbg],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        fail("the cart with the harness didn't build")
    return pbg


def presses(seed, ticks):
    """Random play through the buttons and the wheel, as pbgvm takes them:
    Select often (menus, panels and the meter's three presses at random
    moments), Prev and Next now and then, Play for the map, and the wheel
    turned both ways."""
    rnd = random.Random(seed)
    buttons = []
    t = 10
    while t < ticks - 10:
        b = rnd.choice([16, 16, 16, 16, 16, 1, 2, 8])
        buttons += ["%d:%d" % (t, b), "%d:0" % (t + 1)]
        t += rnd.randrange(4, 40)
    wheel = []
    t = 15
    while t < ticks - 10:
        wheel.append("%d:%d:-1" % (t, rnd.choice([-6, -3, -1, 1, 3, 6])))
        t += rnd.randrange(5, 60)
    return ["--buttons", ",".join(buttons), "--wheel", ",".join(wheel)]


def play(vm, pbg, seed, mode, rounds, ticks, hole=-1, extra=()):
    cmd = [vm, pbg, "--ticks", str(ticks), "--seed", str(seed), "--units",
           "--setting", "stress_mode=%d" % mode, "--setting", "stress_rounds=%d" % rounds,
           "--setting", "stress_hole=%d" % hole, "--setting", "stress_ticks=%d" % ticks]
    if mode == 2:
        cmd += presses(seed, ticks)
    r = subprocess.run(cmd + list(extra), capture_output=True, text=True)
    run = {"seed": seed, "mode": mode, "hole": hole, "exit": r.returncode, "errors": [], "problems": [],
           "summary": {}, "holes": [], "rounds": [], "play": [], "draw": [], "load": [], "memory": {}}
    for line in r.stdout.splitlines():
        if line.startswith("VIOLATION"):
            run["problems"].append(line)
        elif line.startswith("STRESS "):
            p = line.split()[1:]
            run["summary"] = {p[i]: int(p[i + 1]) for i in range(0, len(p) - 1, 2)}
        elif line.startswith("HOLE "):
            run["holes"].append(line)
        elif line.startswith("ROUND "):
            run["rounds"].append(line)
        elif line.startswith("memory arena"):
            p = line.split()[1:]
            run["memory"] = {p[i]: int(p[i + 1]) for i in range(0, len(p) - 1, 2)}
    # each tick's units, the harness taken out, and the harness's flags as
    # the tick started: the picture under way, and a hole loading
    ticks = []
    harness, flags = 0, None
    for line in r.stderr.splitlines():
        p = line.split()
        if len(p) == 3 and p[0] == "prof" and p[1].startswith("stress_"):
            harness += int(p[2])
            flags = (flags or "") + p[1][7:]
        elif len(p) == 3 and p[0] == "tick":
            if flags is not None:
                ticks.append((int(p[2]) - harness, "d" in flags, "l" in flags))
            harness, flags = 0, None
        elif p and p[0] not in ("start", "prof"):
            run["errors"].append(line)
    for i, (u, drawing, loading) in enumerate(ticks[1:-1], start=1):
        nxt = ticks[i + 1]
        if loading:
            run["load"].append(u)
        elif drawing or nxt[1]:
            run["draw"].append(u)
        else:
            run["play"].append(u)
    return run


def stats(units):
    if not units:
        return None
    u = sorted(units)
    at = lambda f: u[min(len(u) - 1, int(len(u) * f))]
    return {"avg": sum(u) // len(u), "p95": at(0.95), "max": u[-1], "over": sum(1 for v in u if v > BUDGET)}


def bad(run):
    s = run["summary"]
    over = (stats(run["play"]) or {}).get("over", 0)
    return run["exit"] != 0 or run["errors"] or not s or s.get("violations", 0) or over


def name(run):
    if run["hole"] >= 0:
        return "practice from hole %d, seed %d" % (run["hole"] + 1, run["seed"])
    return "%s, seed %d" % (MODES[run["mode"]], run["seed"])


def report(runs, verbose):
    print()
    print("The golf:")
    print("  run                         rounds  holes  strokes  par  best  shots  putts  water  out  trees  picked  aces")
    for run in runs:
        s = run["summary"]
        print("  %-26s  %6d  %5d  %7d  %3d  %4d  %5d  %5d  %5d  %3d  %5d  %6d  %4d" % (
            name(run), s.get("rounds", 0), s.get("holes", 0), s.get("strokes", 0), s.get("par", 0),
            s.get("best", 0), s.get("shots", 0), s.get("putts", 0), s.get("water", 0), s.get("out", 0),
            s.get("trees", 0), s.get("picked", 0), s.get("aces", 0)))
    print()
    print("Units a tick, the harness taken out (budget %s at 25):" % "{:,}".format(BUDGET))
    print("  run                          play avg     p95     max  over   pictures  ticks    max  over  longest"
          "   loads     max")
    for run in runs:
        p, d, l = stats(run["play"]), stats(run["draw"]), stats(run["load"])
        s = run["summary"]
        if not p or not d:
            continue
        f = lambda v: "{:,}".format(v)
        print("  %-26s  %10s  %6s  %6s  %4d   %8d  %5d  %6s  %4d  %7d   %5d  %6s" % (
            name(run), f(p["avg"]), f(p["p95"]), f(p["max"]), p["over"], s.get("renders", 0), len(run["draw"]),
            f(d["max"]), d["over"], s.get("busymax", 0), len(run["load"]), f(l["max"]) if l else "-"))
    print("  (pictures: cuts drawn; ticks: the ticks they took; longest: the most ticks in a row;")
    print("   loads: ticks that loaded a hole, between holes)")
    fails = 0
    for run in runs:
        if bad(run):
            fails += 1
            print("\n%s: exit %d" % (name(run), run["exit"]))
            for line in run["errors"][:5] + (run["problems"] if verbose else run["problems"][:5]):
                print("  " + line)
            if not run["summary"]:
                print("  no totals: the run didn't finish")
            over = (stats(run["play"]) or {}).get("over", 0)
            if over:
                print("  %d ticks of play over %d" % (over, BUDGET))
    return fails


def saves_run(vm, pbg, work, seed):
    """Two smart rounds with a saves file: the best round, the rounds played
    and every hole's best must be in it, and read back by a new start."""
    path = os.path.join(work, "saves.bin")
    with open(path, "wb") as f:
        f.write(struct.pack("<256i", *[0] * 256) + bytes(32))
    run = play(vm, pbg, seed, 0, 2, 60000, extra=["--saves", path])
    problems = []
    with open(path, "rb") as f:
        saved = struct.unpack("<256i", f.read()[:1024])
    s = run["summary"]
    if saved[1] != s.get("best", -1):
        problems.append("best round saved %d, played %d" % (saved[1], s.get("best", -1)))
    if saved[2] != 2:
        problems.append("rounds played saved %d, not 2" % saved[2])
    for h in range(9):
        if not 1 <= saved[3 + h] <= 10:
            problems.append("hole %d's best saved %d" % (h + 1, saved[3 + h]))
    # a new start reads them: its title shows the best round
    again = play(vm, pbg, seed + 1, 0, 1, 30000, extra=["--saves", path])
    with open(path, "rb") as f:
        after = struct.unpack("<256i", f.read()[:1024])
    if after[2] != 3:
        problems.append("rounds played after a third round %d, not 3" % after[2])
    if after[1] != min(saved[1], again["summary"].get("best", 999)):
        problems.append("best round after a third %d" % after[1])
    return run, again, problems


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--seeds", default="1,2,3,4")
    ap.add_argument("--rounds", type=int, default=2, help="rounds a smart or wild run plays")
    ap.add_argument("--input-ticks", type=int, default=20000, help="the length of an input run")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--sdk")
    ap.add_argument("--keep", help="keep the scratch build in this folder")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    args = ap.parse_args()
    sdk, vm = sdk_dir(args.sdk)
    seeds = [int(s) for s in args.seeds.split(",")]
    work = args.keep or tempfile.mkdtemp(prefix="pocketgolf3d-")
    os.makedirs(work, exist_ok=True)
    try:
        if args.selftest:
            pbg = build(sdk, work, "selftest", SELFTEST)
            run = play(vm, pbg, 1, 0, 1, 30000)
            caught = [p for p in run["problems"] if "under the ground" in p]
            print("selftest: a rolling ball let sink into the ground: %d problems, %d of them caught as under the ground"
                  % (len(run["problems"]), len(caught)))
            if caught:
                print("  " + caught[0])
                print("selftest: ok, the checks fail as they should")
                return 0
            print("selftest: FAIL, nothing was caught")
            return 1
        pbg = build(sdk, work, "golf")
        rounds_ticks = 12000 * args.rounds
        jobs = []
        for s in seeds:
            jobs.append((s, 0, args.rounds, rounds_ticks, -1))
        for s in seeds[:2]:
            jobs.append((s, 1, args.rounds, 3 * rounds_ticks, -1))
        for s in seeds[:2]:
            jobs.append((s, 2, 99, args.input_ticks, -1))
        jobs.append((seeds[0], 0, 4, 4 * 12000, 0))
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
            runs = list(pool.map(lambda j: play(vm, pbg, j[0], j[1], j[2], j[3], j[4],
                                                ["--memory"] if j[4] >= 0 else []), jobs))
        fails = report(runs, args.verbose)
        practice = runs[-1]
        mem = practice["memory"]
        if mem:
            print("\nMemory after %d holes of practice: %s" % (
                practice["summary"].get("holes", 0), " ".join("%s %s" % (k, "{:,}".format(v)) for k, v in mem.items())))
        first, again, problems = saves_run(vm, pbg, work, seeds[0])
        print("\nSaves: %d rounds, best %d, then one more read them back: %s" % (
            first["summary"].get("rounds", 0) + again["summary"].get("rounds", 0), first["summary"].get("best", 0),
            "ok" if not problems else "FAIL"))
        for p in problems:
            print("  " + p)
        if bad(first) or bad(again):
            problems.append("a saves run failed")
        n = len(runs) + 2
        total_fails = fails + (1 if problems else 0)
        print("\n%d runs: %s" % (n, "FAIL" if total_fails else "ok"))
        return 1 if total_fails else 0
    finally:
        if not args.keep:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
