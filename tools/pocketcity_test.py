"""Plays Pocket City 3D by itself, checks the city every tick and reports
what each tick costs in units.

    python3 tools/pocketcity_test.py                  # seeds 1 to 4: Spin, Thumb, the police after you; and the jobs
    python3 tools/pocketcity_test.py --seeds 1,2,3,4,5,6 --ticks 30000
    python3 tools/pocketcity_test.py --selftest       # shows the checks can fail

It copies pocketcity/ into a scratch folder, adds tools/pocketcity_test.js as
stress.js, makes update() call stress.tick() first, builds the copy with the
SDK's pbgc and plays it in pbgvm. The cart's own files aren't touched.

The playing is a plan made from the seed, played in through pbgvm's wheel
and buttons as a player would: the throttle held most of the time, turns of
the wheel (or the thumb's place, with Thumb steering), braking, reversing,
handbrake slides, and now and then a stop to get out, walk or run about and
get into the nearest car. It hits a lot of walls and cars, which is the
point. The runs:

    spin, thumb   the plan, with Spin or Thumb steering
    police        the plan with three stars of heat every 400 ticks the
                  player has none, so the police come, chase and bust
    jobs          all twenty jobs, the car put where each wants it (the
                  harness's pilot), some taxi fares left to run out of time

Every tick: the player in a car or on foot never in a wall; the car's
speed, heading and steering in range; the camera inside the map and the
ring of city.js holding its cells; every car on its lane (a road under it,
the junctions and its place along the street agreeing) or, parked or
chasing, off the walls; every person off the walls; the heat and the stars
agreeing; the jobs' state in range, a job done always paid; and seven
pixels of the last frame, away from anything drawn over the city, matching
the map's tile pixels there.

Exit status: 0 when every check held (and the jobs run finished all
twenty), 1 when one didn't or a run stopped with an error, 2 when the cart
didn't build.
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
# the self-tests: each breaks one thing in a scratch copy; the checks must notice
SELFTESTS = [
    ("the car drives through walls", ("car.js", "function blocked(px, py) {\n", "function blocked(px, py) {\n    return false;\n"), {}),
    ("the ring forgets a column", ("city.js", "    while (bx < cx) {\n        column(bx + BW);", "    while (bx < cx) {"), {}),
    ("the traffic drives on the sidewalk", ("traffic.js", "    lx[i] = roads.nx[a] - DY[d] * 8;\n    ly[i] = roads.ny[a] + DX[d] * 8;",
                                            "    lx[i] = roads.nx[a] - DY[d] * 20;\n    ly[i] = roads.ny[a] + DX[d] * 20;"), {}),
    ("a job pays nothing", ("main.js", "    cash = min(CASH_MAX, cash + pay);", "    cash = cash + 0;"), {"stress_jobs": 1}),
]
BUDGET_33 = 12500


def fail(msg, code=2):
    print("pocketcity_test: " + msg, file=sys.stderr)
    sys.exit(code)


def plan(seed, ticks, thumb):
    """Wheel turns (or thumb places) and held buttons, as pbgvm takes them."""
    rnd = random.Random(seed)
    wheel, buttons = [], []
    t = 30
    buttons.append("%d:16" % t)        # the throttle, held
    while t < ticks - 20:
        kind = rnd.choice(["turn", "turn", "turn", "straight", "straight", "straight", "straight", "brake",
                           "slide", "slide", "reverse", "coast", "coast"] * 2 + ["walk"])
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
        else:
            # stop, get out, walk and run about, try to get into a car, drive on
            walk = rnd.randrange(60, 200)
            buttons += ["%d:1" % t, "%d:2" % (t + 45), "%d:0" % (t + 46), "%d:16" % (t + 50)]
            for w in range(t + 60, t + 50 + walk, rnd.randrange(15, 40)):
                if thumb:
                    wheel.append("%d:0:%d" % (w, rnd.randrange(0, 96)))
                else:
                    wheel.append("%d:%d:-1" % (w, rnd.choice([-1, 1]) * rnd.randrange(2, 9)))
                if rnd.random() < 0.3:
                    buttons.append("%d:24" % w)
                else:
                    buttons.append("%d:16" % w)
            end = t + 50 + walk
            buttons += ["%d:2" % end, "%d:0" % (end + 1), "%d:16" % (end + 8)]
            if thumb:
                wheel.append("%d:0:-1" % end)
            n = walk + 60
        t += n
    buttons.sort(key=lambda b: int(b.split(":")[0]))
    wheel.sort(key=lambda w: int(w.split(":")[0]))
    # one entry a tick: the last given for it wins
    def dedupe(xs):
        out = {}
        for e in xs:
            out[int(e.split(":")[0])] = e
        return [out[k] for k in sorted(out)]
    return ["--wheel", ",".join(dedupe(wheel)), "--buttons", ",".join(dedupe(buttons))]


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


def play(vm, pbg, seed, ticks, kind, settings):
    thumb = kind == "thumb"
    cmd = [vm, pbg, "--ticks", str(ticks), "--seed", str(seed), "--units",
           "--setting", "stress_ticks=%d" % ticks]
    for k, v in settings.items():
        cmd += ["--setting", "%s=%d" % (k, v)]
    if kind != "jobs":
        cmd += plan(seed, ticks, thumb)
    r = subprocess.run(cmd, capture_output=True, text=True)
    run = {"seed": seed, "kind": kind, "exit": r.returncode, "errors": [], "problems": [], "summary": {},
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
    if run["exit"] != 0 or run["errors"] or not run["summary"] or run["summary"].get("violations", 0):
        return True
    return run["kind"] == "jobs" and run["summary"].get("passed", 0) < 20


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seeds", default="1,2,3,4", help="plans, as seeds (default 1,2,3,4)")
    ap.add_argument("--ticks", type=int, default=9000, help="ticks a run (default 9000; the jobs run takes 14000)")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4, help="runs at once")
    ap.add_argument("--sdk", default=os.environ.get("SDK", os.path.join(REPO, "..", "podbox", "arcade", "sdk")),
                    help="the SDK folder (default $SDK or ../podbox/arcade/sdk)")
    ap.add_argument("--keep", action="store_true", help="keep the scratch folder and say where it is")
    ap.add_argument("--verbose", action="store_true", help="print every problem line")
    ap.add_argument("--selftest", action="store_true", help="break things in scratch copies: the checks must notice")
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
            for i, (what, patch, settings) in enumerate(SELFTESTS):
                pbg = build(sdk, work, "broken%d" % i, patch)
                run = play(vm, pbg, 1, 6000, "jobs" if settings else "spin", settings)
                v = run["summary"].get("violations", 0)
                print("Self-test, %s: %d violations, first: %s" % (
                    what, v, run["problems"][0] if run["problems"] else "none"))
                ok = ok and v > 0
            print("ok: the checks caught every one" if ok else "FAIL: a break went unnoticed")
            return 0 if ok else 1
        spin = build(sdk, work, "spin")
        thumb = build(sdk, work, "thumb", thumb=True)
        jobs = [(s, "spin", spin, {}, args.ticks) for s in seeds] + \
               [(s, "thumb", thumb, {}, args.ticks) for s in seeds] + \
               [(s, "police", spin, {"stress_heat": 400}, args.ticks) for s in seeds] + \
               [(1, "jobs", spin, {"stress_jobs": 1}, max(args.ticks, 14000))]
        print("Pocket City 3D: %d runs" % len(jobs))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            runs = list(pool.map(lambda j: play(vm, j[2], j[0], j[4], j[1], j[3]), jobs))
        print()
        print("  run     seed  metres  km/h  crashes  on foot  cars  police  people  stars  busts  jobs  failed"
              "  overlaps  pixels      avg     p95     max  over 12,500")
        fails = 0
        for run in runs:
            s = run["summary"]
            u = stats(run["units"])
            over = sum(1 for v in run["units"] if v > BUDGET_33)
            print("  %-6s  %4d  %6d  %4d  %7d  %7d  %4d  %6d  %6d  %5d  %5d  %4d  %6d  %8d  %6d  %7s %7s %7s  %5.1f%%" % (
                run["kind"], run["seed"], s.get("metres", 0), s.get("top", 0), s.get("crashes", 0), s.get("foot", 0),
                s.get("cars", 0), s.get("police", 0), s.get("people", 0), s.get("stars", 0), s.get("busts", 0),
                s.get("passed", 0), s.get("failed", 0), s.get("overlaps", 0), s.get("checked", 0),
                "{:,}".format(u["avg"]), "{:,}".format(u["p95"]), "{:,}".format(u["max"]),
                100.0 * over / max(1, len(run["units"]))))
        for run in runs:
            if bad(run):
                fails += 1
                print("\n%s seed %d: exit %d" % (run["kind"], run["seed"], run["exit"]))
                if run["kind"] == "jobs" and run["summary"].get("passed", 0) < 20:
                    print("  only %d of 20 jobs done" % run["summary"].get("passed", 0))
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
