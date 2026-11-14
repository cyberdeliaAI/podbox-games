"""Drives Pocket City 3D by itself, checks the drive and the picture every
tick and reports what each tick costs in units.

    python3 tools/pocketcity_test.py                  # seeds 1 to 4, Spin and Thumb steering, 9,000 ticks
    python3 tools/pocketcity_test.py --seeds 1,2,3,4,5,6 --ticks 30000
    python3 tools/pocketcity_test.py --selftest       # shows the checks can fail

It copies pocketcity/ into a scratch folder, adds tools/pocketcity_test.js as
stress.js, makes update() call stress.tick() first, builds the copy with the
SDK's pbgc and drives it in pbgvm. The cart's own files aren't touched.

The driving is a plan made from the seed, played in through pbgvm's wheel
and buttons as a player would: the throttle held most of the time, turns of
the wheel (or the thumb's place, with Thumb steering), braking, reversing
and handbrake slides. It hits a lot of walls, which is the point.

Every tick: the car on the map and never in a wall, its speed, heading and
steering in range, the camera inside the map, the ring of city.js holding
the camera's cells, and seven pixels of the last frame, away from the car
and the numbers, matching the map's tile pixels there.

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
CART = os.path.join(REPO, "pocketcity")
HARNESS = os.path.join(HERE, "pocketcity_test.js")

HOOK = "function update() {"
# the self-tests: the car through walls, and the ring not drawing a column
SELFTESTS = [("the car drives through walls", ("car.js", "function blocked(px, py) {\n", "function blocked(px, py) {\n    return false;\n")),
             ("the ring forgets a column", ("city.js", "    while (bx < cx) {\n        column(bx + BW);",
                                                      "    while (bx < cx) {"))]
BUDGET_33 = 12500


def fail(msg, code=2):
    print("pocketcity_test: " + msg, file=sys.stderr)
    sys.exit(code)


def plan(seed, ticks, thumb):
    """Wheel turns (or thumb places) and held buttons, as pbgvm takes them."""
    rnd = random.Random(seed)
    wheel, buttons = [], []
    t = 30
    mask = 16                      # the throttle, held
    buttons.append("%d:%d" % (t, mask))
    while t < ticks - 20:
        kind = rnd.choice(["turn", "turn", "straight", "straight", "straight", "brake", "slide", "reverse", "coast"])
        n = rnd.randrange(15, 90)
        if kind == "turn":
            if thumb:
                wheel.append("%d:0:%d" % (t, rnd.choice([rnd.randrange(8, 30), rnd.randrange(66, 88)])))
                wheel.append("%d:0:-1" % (t + n))
            else:
                clicks = rnd.choice([-1, 1]) * rnd.randrange(3, 10)
                wheel.append("%d:%d:-1" % (t, clicks))
                if rnd.random() < 0.5:
                    wheel.append("%d:%d:-1" % (t + n // 2, clicks))
        elif kind == "brake":
            buttons += ["%d:1" % t, "%d:16" % (t + n // 3)]
        elif kind == "slide":
            buttons += ["%d:24" % t, "%d:16" % (t + n // 2)]
            wheel.append("%d:%d:-1" % (t, rnd.choice([-1, 1]) * 8) if not thumb else "%d:0:%d" % (t, rnd.choice([12, 84])))
            if thumb:
                wheel.append("%d:0:-1" % (t + n // 2))
        elif kind == "reverse":
            buttons += ["%d:1" % t, "%d:16" % (t + n)]
        elif kind == "coast":
            buttons += ["%d:0" % t, "%d:16" % (t + n // 2)]
        t += n
    buttons.sort(key=lambda b: int(b.split(":")[0]))
    wheel.sort(key=lambda w: int(w.split(":")[0]))
    return ["--wheel", ",".join(wheel), "--buttons", ",".join(buttons)]


def build(sdk, work, name, patch=None, thumb=False):
    folder = os.path.join(work, name)
    shutil.copytree(CART, folder)
    shutil.copy(HARNESS, os.path.join(folder, "stress.js"))
    edits = [("main.js", HOOK, HOOK + "\n    stress.tick();")] + ([patch] if patch else [])
    if thumb:
        edits.append(("main.js", "    spin = opt.get(OPT.steering) == 0;", "    spin = false;"))
    for f, a, b in edits:
        path = os.path.join(folder, f)
        with open(path) as fh:
            src = fh.read()
        if src.count(a) != 1:
            fail("expected '%s' exactly once in pocketcity/%s" % (a.strip(), f))
        with open(path, "w") as fh:
            fh.write(src.replace(a, b))
    pbg = os.path.join(work, name + ".pbg")
    r = subprocess.run(["node", os.path.join(sdk, "pbgc.js"), "build", folder, "-o", pbg],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        fail("the cart with the harness didn't build")
    return pbg


def drive(vm, pbg, seed, ticks, thumb):
    cmd = [vm, pbg, "--ticks", str(ticks), "--seed", str(seed), "--units",
           "--setting", "stress_ticks=%d" % ticks] + plan(seed, ticks, thumb)
    r = subprocess.run(cmd, capture_output=True, text=True)
    run = {"seed": seed, "thumb": thumb, "exit": r.returncode, "errors": [], "problems": [], "summary": {},
           "units": []}
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
        elif p and p[0] not in ("start", "prof"):
            run["errors"].append(line)
    run["units"] = run["units"][40:]   # the start screen and the first drawing of the ring
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
    ap.add_argument("--seeds", default="1,2,3,4", help="driving plans, as seeds (default 1,2,3,4)")
    ap.add_argument("--ticks", type=int, default=9000, help="ticks a run (default 9000)")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4, help="runs at once")
    ap.add_argument("--sdk", default=os.environ.get("SDK", os.path.join(REPO, "..", "podbox", "arcade", "sdk")),
                    help="the SDK folder (default $SDK or ../podbox/arcade/sdk)")
    ap.add_argument("--keep", action="store_true", help="keep the scratch folder and say where it is")
    ap.add_argument("--verbose", action="store_true", help="print every problem line")
    ap.add_argument("--selftest", action="store_true", help="break the walls and the ring in scratch copies")
    args = ap.parse_args()

    sdk = os.path.abspath(args.sdk)
    vm = os.path.join(sdk, "host", "pbgvm")
    if not os.path.isfile(os.path.join(sdk, "pbgc.js")):
        fail("no SDK at %s: clone https://github.com/anthonyfletcher/podbox next to this repo or pass --sdk" % sdk)
    if not os.access(vm, os.X_OK):
        fail("no %s: run 'sh host/build.sh' in the SDK folder" % vm)
    seeds = [int(s) for s in args.seeds.split(",") if s.strip()]

    work = tempfile.mkdtemp(prefix="pocketcity-test-")
    try:
        if args.selftest:
            ok = True
            for i, (what, patch) in enumerate(SELFTESTS):
                pbg = build(sdk, work, "broken%d" % i, patch)
                run = drive(vm, pbg, 1, 4000, False)
                v = run["summary"].get("violations", 0)
                print("Self-test, %s: %d violations, first: %s" % (
                    what, v, run["problems"][0] if run["problems"] else "none"))
                ok = ok and v > 0
            print("ok: the checks caught both" if ok else "FAIL: a break went unnoticed")
            return 0 if ok else 1
        spin = build(sdk, work, "spin")
        thumb = build(sdk, work, "thumb", thumb=True)
        jobs = [(s, False) for s in seeds] + [(s, True) for s in seeds]
        print("Pocket City 3D: %d runs of %d ticks" % (len(jobs), args.ticks))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            runs = list(pool.map(lambda j: drive(vm, thumb if j[1] else spin, j[0], args.ticks, j[1]), jobs))
        print()
        print("  steering  seed   pixels  top km/h  crashes  sliding  on grass  pixels checked     avg     p95     max  over 12,500")
        fails = 0
        for run in runs:
            s = run["summary"]
            u = stats(run["units"])
            over = sum(1 for v in run["units"] if v > BUDGET_33)
            print("  %-8s  %4d  %7d  %8d  %7d  %7d  %8d  %14d  %6s  %6s  %6s  %5.1f%%" % (
                "thumb" if run["thumb"] else "spin", run["seed"], s.get("pixels", 0), s.get("top", 0),
                s.get("crashes", 0), s.get("sliding", 0), s.get("grass", 0), s.get("checked", 0),
                "{:,}".format(u["avg"]), "{:,}".format(u["p95"]), "{:,}".format(u["max"]),
                100.0 * over / max(1, len(run["units"]))))
        for run in runs:
            if bad(run):
                fails += 1
                print("\n%s seed %d: exit %d" % ("thumb" if run["thumb"] else "spin", run["seed"], run["exit"]))
                for line in run["errors"][:5] + (run["problems"] if args.verbose else run["problems"][:5]):
                    print("  " + line)
        print()
        print("%d runs: %s" % (len(runs), "FAIL" if fails else "ok"))
        return 1 if fails else 0
    finally:
        if args.keep:
            print("scratch folder kept: %s" % work)
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
