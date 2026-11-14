"""Skis Powder Run 3D by itself, checks the run every tick and reports what
each tick costs in units, at every level of the picture and with the
automatic level on three simulated iPods.

    python3 tools/powderrun_test.py                   # every level, then Auto on three iPods
    python3 tools/powderrun_test.py --ticks 20000 --seeds 1,2,3
    python3 tools/powderrun_test.py --selftest        # shows the checks can fail

It copies powderrun/ into a scratch folder, adds tools/powderrun_test.js as
stress.js, makes update() call stress.tick() first, builds the copy with the
SDK's pbgc and skis it in pbgvm. The cart's own files aren't touched.

The carving comes from a plan made from the seed, played in through pbgvm's
--wheel as a player would turn it: S-turns of every size, hard turns held
until the skis won't turn further, and straight runs with the wheel left
alone.

Each run's checks: the skier stays on the picture, within 75 degrees of
the fall line, between the lowest and highest speed, never under the snow,
never going back up the mountain, on the screen and not in the air too
long; the camera stays above the snow; the rate matches the picture's
level.

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
CART = os.path.join(REPO, "powderrun")
HARNESS = os.path.join(HERE, "powderrun_test.js")

HOOK = "function update() {"
# the self-test lets the skier sink through the snow on landing
SELFTEST = [("skier.js", "        if (hrel <= 0.0) {", "        if (hrel <= -999.0) {")]

RATES = [33, 33, 25, 25, 20]       # as quality.js has them
DEVICES = {1: "Video FLAC", 2: "Video", 3: "Classic"}
BUDGETS = {1: {33: 12500, 25: 17500, 20: 22800},
           2: {33: 46000, 25: 61000, 20: 76000},
           3: {33: 175000, 25: 232000, 20: 290000}}


def fail(msg, code=2):
    print("powderrun_test: " + msg, file=sys.stderr)
    sys.exit(code)


def plan(seed, ticks):
    """Wheel turns, as pbgvm takes them: S-turns, hard turns and straight
    runs; and the buttons: jumps (Select), tucks (Next), braking (Prev) and
    now and then the camera (Play)."""
    rnd = random.Random(seed)
    buttons = []
    t = 60
    while t < ticks - 10:
        kind = rnd.choice(["jump", "jump", "tuck", "brake", "camera"])
        if kind == "jump":
            buttons += ["%d:16" % t, "%d:0" % (t + 1)]
            t += rnd.randrange(30, 150)
        elif kind == "tuck":
            n = rnd.randrange(40, 200)
            buttons += ["%d:2" % t, "%d:0" % (t + n)]
            t += n + rnd.randrange(20, 100)
        elif kind == "brake":
            n = rnd.randrange(10, 60)
            buttons += ["%d:1" % t, "%d:0" % (t + n)]
            t += n + rnd.randrange(20, 100)
        else:
            buttons += ["%d:8" % t, "%d:0" % (t + 1)]
            t += rnd.randrange(100, 400)
    wheel = []
    t = 30
    side = 1
    while t < ticks - 10:
        kind = rnd.choice(["s", "s", "s", "hard", "straight"])
        if kind == "s":
            clicks = side * rnd.randrange(6, 22)
            for i in range(3):
                wheel.append("%d:%d:-1" % (t + i, clicks // 3))
            side = -side
            t += rnd.randrange(25, 70)
        elif kind == "hard":
            clicks = side * rnd.randrange(24, 40)
            for i in range(4):
                wheel.append("%d:%d:-1" % (t + i, clicks // 4))
            side = -side
            t += rnd.randrange(60, 120)
        else:
            t += rnd.randrange(60, 200)
    return (["--wheel", ",".join(wheel)] if wheel else []) + ["--buttons", ",".join(buttons)]


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
            fail("expected '%s' exactly once in powderrun/%s" % (a.strip(), f))
        with open(path, "w") as fh:
            fh.write(src.replace(a, b))
    pbg = os.path.join(work, name + ".pbg")
    r = subprocess.run(["node", os.path.join(sdk, "pbgc.js"), "build", folder, "-o", pbg],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        fail("the cart with the harness didn't build")
    return pbg


SLOPES = ["alpine", "forest", "high", "sunset", "frozen"]
MODES = ["free", "endless"]


def ski(vm, pbg, seed, ticks, level, device, dodge=1, slope=0, mode=0, extra=()):
    cmd = [vm, pbg, "--ticks", str(ticks), "--seed", str(seed), "--units",
           "--setting", "stress_level=%d" % level, "--setting", "stress_device=%d" % device,
           "--setting", "stress_ticks=%d" % ticks, "--setting", "stress_dodge=%d" % dodge,
           "--setting", "stress_slope=%d" % slope, "--setting", "stress_mode=%d" % mode] + plan(seed, ticks)
    r = subprocess.run(cmd + list(extra), capture_output=True, text=True)
    run = {"seed": seed, "level": level, "device": device, "dodge": dodge, "slope": slope, "mode": mode,
           "stress": [], "start": {}, "memory": {}, "paused": 0, "resumed": 0,
           "exit": r.returncode,
           "errors": [], "problems": [], "summary": {}, "ticks": []}
    for line in r.stdout.splitlines():
        if line.startswith("VIOLATION"):
            run["problems"].append(line)
        elif line.startswith("STRESS "):
            run["stress"].append(line)
            p = line.split()[1:]
            run["summary"] = {p[i]: int(p[i + 1]) for i in range(0, len(p) - 1, 2)}
        elif line.startswith("START "):
            p = line.split()[1:]
            run["start"] = {p[i]: int(p[i + 1]) for i in range(0, len(p) - 1, 2)}
        elif line.startswith("memory arena"):
            p = line.split()[1:]
            run["memory"] = {p[i]: int(p[i + 1]) for i in range(0, len(p) - 1, 2)}
        elif line == "paused":
            run["paused"] += 1
        elif line == "resumed":
            run["resumed"] += 1
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


def report(levels, autos, rides, verbose):
    print()
    print("Each level held, units a tick with the harness taken out:")
    print("  level  rate  seed     avg     p95     max   fits")
    for run in levels:
        u = stats([v for _, v in run["ticks"]])
        if not u:
            continue
        q = run["level"]
        fits = [name for d, name in DEVICES.items() if u["p95"] <= BUDGETS[d][RATES[q]]]
        print("  Q%d     %4d  %4d  %6s  %6s  %6s   %s" % (
            q, RATES[q], run["seed"], "{:,}".format(u["avg"]), "{:,}".format(u["p95"]),
            "{:,}".format(u["max"]), ", ".join(fits) or "none"))
    print("  (fits: the iPods whose budget at that rate covers the 95th percentile)")
    print()
    print("Auto, on simulated iPods:")
    print("  iPod         seed  settled  changes  time at Q0..Q4                   over budget")
    for run in autos:
        t = run["ticks"]
        if not t:
            continue
        counts = [sum(1 for q, _ in t if q == k) for k in range(5)]
        over = sum(1 for q, v in t if v > BUDGETS[run["device"]][RATES[q]])
        share = "  ".join("%3d%%" % (100 * c // len(t)) for c in counts)
        print("  %-11s  %4d  Q%d       %4d     %s   %5.1f%%" % (
            DEVICES[run["device"]], run["seed"], run["summary"].get("level", -1),
            run["summary"].get("changes", 0), share, 100.0 * over / len(t)))
    print()
    print("The skiing, Auto on the iPod Video playing FLAC, steering round what's ahead or blind:")
    print("  slope    mode     seed  steer   metres  best  runs  top km/h  avg  jumps  in the air  longest  falls  drawn  most  over")
    for run in [r for r in autos if r["device"] == 1] + rides:
        s = run["summary"]
        t = run["ticks"]
        over = sum(1 for q, v in t if v > BUDGETS[1][RATES[q]])
        print("  %-7s  %-7s  %4d  %-6s  %6d  %4d  %4d  %8d  %3d  %5d  %10d  %7d  %5d  %5d  %4d  %4.1f%%" % (
            SLOPES[run["slope"]], MODES[run["mode"]], run["seed"], "dodge" if run["dodge"] else "blind",
            s.get("metres", 0), s.get("best", 0), s.get("runs", 0), s.get("top", 0), s.get("avg", 0),
            s.get("jumps", 0), s.get("airtime", 0), s.get("longest", 0), s.get("falls", 0),
            s.get("drawn", 0), s.get("drawnmax", 0), 100.0 * over / max(1, len(t))))

    fails = 0
    for run in levels + autos + rides:
        name = "level %s device %d seed %d dodge %d slope %s mode %s" % (
            run["level"], run["device"], run["seed"], run["dodge"], SLOPES[run["slope"]], MODES[run["mode"]])
        if bad(run):
            fails += 1
            print("\n%s: exit %d" % (name, run["exit"]))
            for line in (run["errors"][:5] + (run["problems"] if verbose else run["problems"][:5])):
                print("  " + line)
    print()
    print("%d runs: %s" % (len(levels + autos + rides), "FAIL" if fails else "ok"))
    return 1 if fails else 0


def saved(path):
    with open(path, "rb") as f:
        return struct.unpack("<256i", f.read()[:1024])


def sessions(vm, pbg, work, ticks, jobs):
    """Long runs on every slope both ways, then the saves read back, a
    suspend, pauses and a tour of every slope for memory."""
    fails = []
    print("Long runs: %d ticks each, Auto on the iPod Video playing FLAC, saves kept" % ticks)
    print("  slope    mode     metres in all  runs  violations  saved total  saved top  over")
    long_jobs = [(sl, m) for sl in range(5) for m in (0, 1)]
    paths = {j: os.path.join(work, "saves_%d_%d.bin" % j) for j in long_jobs}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, jobs)) as pool:
        runs = list(pool.map(lambda j: ski(vm, pbg, 7 + j[0], ticks, -1, 1, 1, j[0], j[1],
                                           ["--saves", paths[j]]), long_jobs))
    for (sl, m), run in zip(long_jobs, runs):
        s = run["summary"]
        v = saved(paths[(sl, m)]) if os.path.exists(paths[(sl, m)]) else [0] * 256
        t = run["ticks"]
        over = sum(1 for q, u in t if u > BUDGETS[1][RATES[q]])
        print("  %-7s  %-7s  %13d  %4d  %10d  %11d  %9d  %4.1f%%" % (
            SLOPES[sl], MODES[m], s.get("allm", 0), s.get("runs", 0), s.get("violations", 0),
            v[2], v[3], 100.0 * over / max(1, len(t))))
        name = "long %s %s" % (SLOPES[sl], MODES[m])
        if bad(run):
            fails.append((name, run["errors"][:3] + run["problems"][:3]))
        # every run's metres are in the total, but for at most the last
        # stretch not yet banked (a save every 990 ticks or 1,000 metres);
        # a save on the last tick may be a few metres past the last report
        if not (s.get("allm", 0) - 1100 <= v[2] <= s.get("allm", 0) + 5):
            fails.append((name, ["saved total %d against %d skied" % (v[2], s.get("allm", 0))]))
        if v[9] != sl or v[3] <= 0 or v[7] <= 0:
            fails.append((name, ["saved slope %d top %d jumps %d" % (v[9], v[3], v[7])]))

    # the saves read back: a new start on the sunset slope's file starts there
    path = paths[(3, 0)]
    v = saved(path)
    run = ski(vm, pbg, 1, 30, -1, 1, 1, 3, 0, ["--saves", path])
    st = run["start"]
    ok = st.get("slope") == 3 and st.get("total") == v[2] and st.get("top") == v[3]
    print()
    print("Saves read back: slope %s, total %s m, top %s km/h: %s" % (
        st.get("slope"), st.get("total"), st.get("top"), "ok" if ok else "FAIL"))
    if not ok:
        fails.append(("saves", ["start %s, file total %d top %d" % (st, v[2], v[3])]))

    # suspended and resumed half way: the same run as one never suspended
    a = ski(vm, pbg, 3, 3000, -1, 1, 1, 0, 0)
    b = ski(vm, pbg, 3, 3000, -1, 1, 1, 0, 0, ["--suspend-at", "1500"])
    same = a["stress"] == b["stress"] and b["resumed"] == 1
    print("Suspended at tick 1500 and resumed: %s" % ("the same run" if same else "DIFFERENT"))
    if not same or bad(b):
        fails.append(("suspend", ["resumed %d, %d report lines differ" % (
            b["resumed"], sum(1 for x, y in zip(a["stress"], b["stress"]) if x != y))]))

    # paused three times: nothing breaks, and Auto doesn't take the pauses for late frames
    c = ski(vm, pbg, 3, 3000, -1, 1, 1, 0, 0, ["--pause", "500,1500,2500"])
    print("Paused three times: %d pauses, %s" % (c["paused"], "ok" if not bad(c) and c["paused"] == 3 else "FAIL"))
    if bad(c) or c["paused"] != 3:
        fails.append(("pause", c["errors"][:3] + c["problems"][:3]))

    # fifty changes of slope against one slope: memory holds steady
    one = ski(vm, pbg, 5, 4000, -1, 1, 1, 0, 0, ["--memory"])
    tour = ski(vm, pbg, 5, 20000, -1, 1, 1, 0, 0, ["--memory", "--setting", "stress_tour=397"])
    m1, m2 = one["memory"], tour["memory"]
    held1, held2 = m1.get("held", 0), m2.get("held", 0)
    steady = bool(m1) and bool(m2) and held2 <= held1 + 4096 and not bad(tour)
    print("Memory after one slope: %s held, %s free; after 50 changes of slope: %s held, %s free: %s" % (
        "{:,}".format(held1), "{:,}".format(m1.get("free", 0)), "{:,}".format(held2),
        "{:,}".format(m2.get("free", 0)), "steady" if steady else "FAIL"))
    if not steady:
        fails.append(("memory", tour["errors"][:3] + tour["problems"][:3]))

    for name, lines in fails:
        print("\n%s:" % name)
        for line in lines:
            print("  " + line)
    print()
    print("Sessions: %s" % ("FAIL" if fails else "ok"))
    return 1 if fails else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ticks", type=int, default=6000, help="ticks a run (default 6000)")
    ap.add_argument("--seeds", default="1", help="carving plans, as seeds (default 1)")
    ap.add_argument("--slopes", default="0,1,2,3,4",
                    help="slopes skied by Auto in both ways to ski: 0 alpine to 4 frozen (default all)")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4, help="runs at once")
    ap.add_argument("--sdk", default=os.environ.get("SDK", os.path.join(REPO, "..", "podbox", "arcade", "sdk")),
                    help="the SDK folder (default $SDK or ../podbox/arcade/sdk)")
    ap.add_argument("--keep", action="store_true", help="keep the scratch folder and say where it is")
    ap.add_argument("--verbose", action="store_true", help="print every problem line in full")
    ap.add_argument("--sessions", action="store_true",
                    help="long runs on every slope with saves kept, then the saves read back, a suspend, pauses and memory")
    ap.add_argument("--long", type=int, default=40000, help="ticks a long run with --sessions (default 40000)")
    ap.add_argument("--selftest", action="store_true",
                    help="let the skier sink through the snow in a scratch copy and check that the checks catch it")
    args = ap.parse_args()

    sdk = os.path.abspath(args.sdk)
    vm = os.path.join(sdk, "host", "pbgvm")
    if not os.path.isfile(os.path.join(sdk, "pbgc.js")):
        fail("no SDK at %s: clone https://github.com/anthonyfletcher/podbox next to this repo or pass --sdk" % sdk)
    if not os.access(vm, os.X_OK):
        fail("no %s: run 'sh host/build.sh' in the SDK folder" % vm)
    seeds = [int(s) for s in args.seeds.split(",") if s.strip()]

    work = tempfile.mkdtemp(prefix="powderrun-test-")
    try:
        if args.selftest:
            pbg = build(sdk, work, "broken", SELFTEST)
            print("Self-test: skier.js lets the skier sink through the snow on landing")
            run = ski(vm, pbg, 1, 3000, 3, 0)
            v = run["summary"].get("violations", 0)
            print("  %d violations, first: %s" % (v, run["problems"][0] if run["problems"] else "none"))
            print("ok: the checks caught it" if v else "FAIL: no violations, so the checks aren't working")
            return 0 if v else 1
        pbg = build(sdk, work, "powderrun")
        if args.sessions:
            return sessions(vm, pbg, work, args.long, args.jobs)
        slopes = [int(v) for v in args.slopes.split(",") if v.strip()]
        jobs = [(s, q, 0, 1, 0, 0) for s in seeds for q in range(5)]
        jobs += [(s, -1, d, 1, 0, 0) for s in seeds for d in (1, 2, 3)]
        rides = [(s, -1, 1, 1, sl, m) for s in seeds for sl in slopes for m in (0, 1) if (sl, m) != (0, 0)]
        rides += [(s, -1, 1, 0, 0, 0) for s in seeds]
        print("Powder Run 3D: %d runs of %d ticks" % (len(jobs + rides), args.ticks))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            runs = list(pool.map(lambda j: ski(vm, pbg, j[0], args.ticks, *j[1:]), jobs + rides))
        n = len(jobs)
        return report([r for r in runs[:n] if r["level"] >= 0], [r for r in runs[:n] if r["level"] < 0],
                      runs[n:], args.verbose)
    finally:
        if args.keep:
            print("scratch folder kept: %s" % work)
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
