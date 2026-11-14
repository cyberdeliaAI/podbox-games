"""Flies Pocket Wings 3D by itself, checks the flight every tick and reports
what each tick costs in units, at every level of the picture and with the
automatic level on three simulated iPods.

    python3 tools/pocketwings_test.py                 # every level, both views, then Auto on three iPods
    python3 tools/pocketwings_test.py --ticks 20000 --seeds 1,2,3
    python3 tools/pocketwings_test.py --selftest      # shows the checks can fail

It copies pocketwings/ into a scratch folder, adds tools/pocketwings_test.js
as stress.js, makes update() call stress.tick() first, builds the copy with
the SDK's pbgc and flies it in pbgvm. The cart's own files aren't touched.

The flying comes from a flight plan made from the seed, played in through
pbgvm's --wheel and --buttons as a player would: turns of the wheel this way
and that, Prev and Next held to climb and dive (often all the way down to
the hills) and Play for the speeds.

    Levels  each of the picture's five levels held, from behind and from the
            cockpit: what each costs, with the harness taken out.
    Auto    the automatic level on a simulated iPod Video playing FLAC, an
            iPod Video and an iPod Classic: where it settles, how often it
            changes and how many ticks cost more than that iPod had.

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
CART = os.path.join(REPO, "pocketwings")
HARNESS = os.path.join(HERE, "pocketwings_test.js")

HOOK = "function update() {"
# the self-test lets the aircraft through the ground: no lift when it's low,
# and no floor under it
SELFTEST = [("flight.js", "    var floor = max(gnd, ahead - 4) + CLEAR;", "    var floor = -999.0;"),
            ("flight.js", "    if (z < gnd + SKIM)", "    if (z < gnd - 999.0)")]

RATES = [33, 33, 25, 25, 20]       # as quality.js has them
DEVICES = {1: "Video FLAC", 2: "Video", 3: "Classic"}
BUDGETS = {1: {33: 12500, 25: 17500, 20: 22800},
           2: {33: 46000, 25: 61000, 20: 76000},
           3: {33: 175000, 25: 232000, 20: 290000}}


def fail(msg, code=2):
    print("pocketwings_test: " + msg, file=sys.stderr)
    sys.exit(code)


def plan(seed, ticks):
    """A flight plan: wheel turns and held buttons, as pbgvm takes them."""
    rnd = random.Random(seed)
    wheel, buttons = [], []
    t = 60
    while t < ticks - 10:
        kind = rnd.choice(["turn", "turn", "climb", "dive", "dive", "speed", "cruise"])
        length = rnd.randrange(40, 160)
        if kind == "turn":
            clicks = rnd.choice([-1, 1]) * rnd.randrange(8, 36)
            # turned in over a few ticks, and back a while later
            for i in range(4):
                wheel.append("%d:%d:-1" % (t + i, clicks // 4))
            if rnd.random() < 0.6:
                for i in range(4):
                    wheel.append("%d:%d:-1" % (t + length // 2 + i, -clicks // 4))
        elif kind == "climb":
            buttons += ["%d:1" % t, "%d:0" % (t + length)]
        elif kind == "dive":
            buttons += ["%d:2" % t, "%d:0" % (t + length)]
        elif kind == "speed":
            buttons += ["%d:8" % t, "%d:0" % (t + 1)]
        t += length + rnd.randrange(5, 40)
    args = []
    if wheel:
        args += ["--wheel", ",".join(wheel)]
    if buttons:
        # pbgvm wants them in order of tick
        buttons.sort(key=lambda b: int(b.split(":")[0]))
        args += ["--buttons", ",".join(buttons)]
    return args


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
            fail("expected '%s' exactly once in pocketwings/%s" % (a.strip(), f))
        with open(path, "w") as fh:
            fh.write(src.replace(a, b))
    pbg = os.path.join(work, name + ".pbg")
    r = subprocess.run(["node", os.path.join(sdk, "pbgc.js"), "build", folder, "-o", pbg],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        fail("the cart with the harness didn't build")
    return pbg


def fly(vm, pbg, seed, ticks, view, level, device):
    cmd = [vm, pbg, "--ticks", str(ticks), "--seed", str(seed), "--units",
           "--setting", "stress_view=%d" % view, "--setting", "stress_level=%d" % level,
           "--setting", "stress_device=%d" % device, "--setting", "stress_ticks=%d" % ticks] + plan(seed, ticks)
    r = subprocess.run(cmd, capture_output=True, text=True)
    run = {"seed": seed, "view": view, "level": level, "device": device, "exit": r.returncode,
           "errors": [], "problems": [], "summary": {}, "ticks": []}
    for line in r.stdout.splitlines():
        if line.startswith("VIOLATION"):
            run["problems"].append(line)
        elif line.startswith("STRESS "):
            p = line.split()[1:]
            run["summary"] = {p[i]: int(p[i + 1]) for i in range(0, len(p) - 1, 2)}
    harness, q = 0, -1
    for line in r.stderr.splitlines():
        p = line.split()
        if len(p) == 3 and p[0] == "prof" and p[1].startswith("stress_"):
            harness += int(p[2])
            if p[1].startswith("stress_q"):
                q = int(p[1][8:])
        elif len(p) == 3 and p[0] == "tick":
            if q >= 0:
                run["ticks"].append((q, int(p[2]) - harness))
            harness, q = 0, -1
        elif p and p[0] not in ("start", "prof"):
            run["errors"].append(line)
    return run


def stats(units):
    if not units:
        return None
    u = sorted(units)
    at = lambda f: u[min(len(u) - 1, int(len(u) * f))]
    return {"avg": sum(u) // len(u), "p95": at(0.95), "max": u[-1]}


def bad(run):
    return run["exit"] != 0 or run["errors"] or not run["summary"] or run["summary"].get("violations", 0)


def report(levels, autos, verbose):
    print()
    print("Each level held, units a tick with the harness taken out:")
    print("  level  rate  view      avg     p95     max   fits")
    for run in levels:
        u = stats([v for _, v in run["ticks"]])
        if not u:
            continue
        q = run["level"]
        fits = [name for d, name in DEVICES.items() if u["p95"] <= BUDGETS[d][RATES[q]]]
        print("  Q%d     %4d  %-7s %6s  %6s  %6s   %s" % (
            q, RATES[q], "cockpit" if run["view"] else "behind", "{:,}".format(u["avg"]),
            "{:,}".format(u["p95"]), "{:,}".format(u["max"]), ", ".join(fits) or "none"))
    print("  (fits: the iPods whose budget at that rate covers the 95th percentile)")
    print()
    print("Auto, on simulated iPods:")
    print("  iPod         view     seed  settled  changes  time at Q0..Q4                   over budget")
    for run in autos:
        t = run["ticks"]
        if not t:
            continue
        counts = [sum(1 for q, _ in t if q == k) for k in range(5)]
        over = sum(1 for q, v in t if v > BUDGETS[run["device"]][RATES[q]])
        share = "  ".join("%3d%%" % (100 * c // len(t)) for c in counts)
        print("  %-11s  %-7s  %4d  Q%d       %4d     %s   %5.1f%%" % (
            DEVICES[run["device"]], "cockpit" if run["view"] else "behind", run["seed"],
            run["summary"].get("level", -1), run["summary"].get("changes", 0), share,
            100.0 * over / len(t)))
    print("  (over budget: ticks that cost more than that iPod has at the rate they ran at)")

    fails = 0
    for run in levels + autos:
        name = "level %s view %d device %d seed %d" % (run["level"], run["view"], run["device"], run["seed"])
        if bad(run):
            fails += 1
            print("\n%s: exit %d" % (name, run["exit"]))
            for line in (run["errors"][:5] + (run["problems"] if verbose else run["problems"][:5])):
                print("  " + line)
    lows = [r["summary"].get("low", 0) for r in levels + autos]
    clear = min(r["summary"].get("clear", 999) for r in levels + autos)
    print()
    print("Ticks the ground lifted the aircraft: %d in all; the closest it came to the ground: %d" % (sum(lows), clear))
    print("%d runs: %s" % (len(levels + autos), "FAIL" if fails else "ok"))
    return 1 if fails else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ticks", type=int, default=6000, help="ticks a run (default 6000, 3 minutes at 33)")
    ap.add_argument("--seeds", default="1", help="flight plans, as seeds (default 1)")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4, help="runs at once")
    ap.add_argument("--sdk", default=os.environ.get("SDK", os.path.join(REPO, "..", "podbox", "arcade", "sdk")),
                    help="the SDK folder (default $SDK or ../podbox/arcade/sdk)")
    ap.add_argument("--keep", action="store_true", help="keep the scratch folder and say where it is")
    ap.add_argument("--verbose", action="store_true", help="print every problem line in full")
    ap.add_argument("--selftest", action="store_true",
                    help="take away the lift over the ground in a scratch copy and check that the checks catch it")
    args = ap.parse_args()

    sdk = os.path.abspath(args.sdk)
    vm = os.path.join(sdk, "host", "pbgvm")
    if not os.path.isfile(os.path.join(sdk, "pbgc.js")):
        fail("no SDK at %s: clone https://github.com/anthonyfletcher/podbox next to this repo or pass --sdk" % sdk)
    if not os.access(vm, os.X_OK):
        fail("no %s: run 'sh host/build.sh' in the SDK folder" % vm)
    seeds = [int(s) for s in args.seeds.split(",") if s.strip()]

    work = tempfile.mkdtemp(prefix="pocketwings-test-")
    try:
        if args.selftest:
            pbg = build(sdk, work, "broken", SELFTEST)
            print("Self-test: flight.js without the lift over the ground")
            run = fly(vm, pbg, 1, 3000, 0, 3, 0)
            v = run["summary"].get("violations", 0)
            print("  %d violations, first: %s" % (v, run["problems"][0] if run["problems"] else "none"))
            print("ok: the checks caught it" if v else "FAIL: no violations, so the checks aren't working")
            return 0 if v else 1
        pbg = build(sdk, work, "pocketwings")
        jobs = [(s, view, q, 0) for s in seeds for q in range(5) for view in (0, 1)]
        jobs += [(s, 0, -1, d) for s in seeds for d in (1, 2, 3)]
        print("Pocket Wings 3D: %d runs of %d ticks" % (len(jobs), args.ticks))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            runs = list(pool.map(lambda j: fly(vm, pbg, j[0], args.ticks, j[1], j[2], j[3]), jobs))
        return report([r for r in runs if r["level"] >= 0], [r for r in runs if r["level"] < 0], args.verbose)
    finally:
        if args.keep:
            print("scratch folder kept: %s" % work)
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
