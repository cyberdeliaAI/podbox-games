"""Plays Marble Chain by itself, checks the chain's invariants every tick
and reports what each tick of play costs in units.

    python3 tools/marbles_stress.py                  # levels 1 to 6, seeds 1 and 2, smart and blind
    python3 tools/marbles_stress.py --levels 6 --modes smart,still --seeds 1 --ticks 3000
    python3 tools/marbles_stress.py --selftest       # shows the checks can fail

It copies marbles/ into a scratch folder, adds tools/marbles_stress.js as
stress.js, makes update() call stress.tick() first, builds the copy with
the SDK's pbgc and plays it in pbgvm. The cart's own files aren't touched.

The player (see marbles_stress.js):

    smart   aims where the loaded ball pops a run, nearest the hole, and
            swaps when the next ball does better
    blind   shoots at random angles, so the chain grows
    still   never shoots: the chain alone as it rolls to the hole

Each run plays one level over and over, starting it again after a win or
a loss. Units are those of the ticks that start in play, less the
harness's own (its prof() sections). The budget on an iPod Video playing
FLAC is about 12,500 units a tick at 33 ticks a second and 17,500 at 25.

Exit status: 0 when every run kept every invariant, 1 when one didn't or
a run stopped with an error, 2 when the cart didn't build.
"""
import argparse
import concurrent.futures
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
CART = os.path.join(REPO, "marbles")
HARNESS = os.path.join(HERE, "marbles_stress.js")

MODES = {"blind": 0, "smart": 1, "still": 2}
BUDGET_33 = 12500
BUDGET_25 = 17500

# where the harness goes in: the first line of main.js's update()
HOOK = "function update() {"
# the self-test makes pops outlast the busy count an insert sets
SELFTEST_FROM = "const POP = 8;"
SELFTEST_TO = "const POP = 12;"


def fail(msg, code=2):
    print("marbles_stress: " + msg, file=sys.stderr)
    sys.exit(code)


def numbers(text, top):
    """'1-6', '1,3,6' or '2' as a list of whole numbers from 1 to top."""
    out = []
    for part in text.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            out += range(int(a), int(b) + 1)
        elif part:
            out.append(int(part))
    for v in out:
        if top and not 1 <= v <= top:
            fail("%d is out of range 1 to %d" % (v, top))
    return out


# ---- building ---------------------------------------------------------------

def build(sdk, work, name, patch=None):
    """A copy of the cart with the harness in, built to work/name.pbg."""
    folder = os.path.join(work, name)
    shutil.copytree(CART, folder)
    shutil.copy(HARNESS, os.path.join(folder, "stress.js"))
    main = os.path.join(folder, "main.js")
    with open(main) as f:
        src = f.read()
    if src.count(HOOK) != 1:
        fail("expected '%s' exactly once in marbles/main.js" % HOOK)
    with open(main, "w") as f:
        f.write(src.replace(HOOK, HOOK + "\n    stress.tick();"))
    if patch:
        path = os.path.join(folder, patch[0])
        with open(path) as f:
            src = f.read()
        if src.count(patch[1]) != 1:
            fail("expected '%s' exactly once in marbles/%s" % (patch[1], patch[0]))
        with open(path, "w") as f:
            f.write(src.replace(patch[1], patch[2]))
    pbg = os.path.join(work, name + ".pbg")
    r = subprocess.run(["node", os.path.join(sdk, "pbgc.js"), "build", folder, "-o", pbg],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        fail("the cart with the harness didn't build")
    return pbg


# ---- running ----------------------------------------------------------------

def play(vm, pbg, level, mode, seed, ticks, every):
    """One run of pbgvm, read back into a record."""
    cmd = [vm, pbg, "--ticks", str(ticks), "--seed", str(seed), "--units",
           "--setting", "stress_level=%d" % level,
           "--setting", "stress_mode=%d" % MODES[mode],
           "--setting", "stress_every=%d" % every,
           "--setting", "stress_ticks=%d" % ticks]
    r = subprocess.run(cmd, capture_output=True, text=True)
    run = {"level": level, "mode": mode, "seed": seed, "exit": r.returncode,
           "errors": [], "problems": [], "summary": {}, "units": [], "harness": []}

    for line in r.stdout.splitlines():
        if line.startswith(("VIOLATION", "WARNING")):
            run["problems"].append(line)
        elif line.startswith("STRESS "):
            p = line.split()[1:]
            run["summary"] = {p[i]: int(p[i + 1]) for i in range(0, len(p) - 1, 2)}

    # a tick's prof lines come before its own tick line
    harness, in_play = 0, False
    for line in r.stderr.splitlines():
        p = line.split()
        if len(p) == 3 and p[0] == "prof" and p[1].startswith("stress_"):
            harness += int(p[2])
            in_play = in_play or p[1] == "stress_play"
        elif len(p) == 3 and p[0] == "tick":
            if in_play:
                run["units"].append(int(p[2]) - harness)
                run["harness"].append(harness)
            harness, in_play = 0, False
        elif p and p[0] not in ("start", "prof"):
            run["errors"].append(line)
    return run


def stats(units):
    if not units:
        return None
    u = sorted(units)
    at = lambda q: u[min(len(u) - 1, int(len(u) * q))]
    over = lambda b: 100.0 * sum(1 for v in u if v > b) / len(u)
    return {"avg": sum(u) // len(u), "p95": at(0.95), "p99": at(0.99), "max": u[-1],
            "over33": over(BUDGET_33), "over25": over(BUDGET_25)}


# ---- reporting --------------------------------------------------------------

COLUMNS = [("lvl", 3), ("mode", 5), ("seed", 4), ("shots", 5), ("hit%", 4),
           ("won", 3), ("lost", 4), ("combo", 5), ("balls", 5), ("pwr", 3),
           ("avg", 6), ("p95", 6), ("p99", 6), ("max", 6), (">12.5k", 6), (">17.5k", 6),
           ("viol", 4), ("warn", 4)]


def row(values):
    return "  ".join(str(v).rjust(w) for v, (_, w) in zip(values, COLUMNS))


def describe(run):
    s, u = run["summary"], stats(run["units"])
    shots = s.get("shots", 0)
    hit = "%d" % (100 * s.get("hits", 0) // shots) if shots else "-"
    power = s.get("slow", 0) + s.get("back", 0) + s.get("bomb", 0)
    cells = [run["level"], run["mode"], run["seed"], shots, hit,
             s.get("wins", 0), s.get("losses", 0), s.get("combo", 0), s.get("balls", 0), power]
    if u:
        cells += ["{:,}".format(u["avg"]), "{:,}".format(u["p95"]), "{:,}".format(u["p99"]),
                  "{:,}".format(u["max"]), "%.1f%%" % u["over33"], "%.1f%%" % u["over25"]]
    else:
        cells += ["-"] * 6
    cells += [s.get("violations", 0), s.get("warnings", 0)]
    return row(cells)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--levels", default="1-6", help="levels to play, as 1-6 or 1,3,6 (default 1-6)")
    ap.add_argument("--modes", default="smart,blind", help="smart, blind and/or still (default smart,blind)")
    ap.add_argument("--seeds", default="1,2", help="random seeds (default 1,2)")
    ap.add_argument("--ticks", type=int, default=9000, help="ticks a run (default 9000, 4.5 minutes at 33)")
    ap.add_argument("--every", type=int, default=20, help="ticks between shots (default 20, 0.6 s)")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4, help="runs at once")
    ap.add_argument("--sdk", default=os.environ.get("SDK", os.path.join(REPO, "..", "podbox", "arcade", "sdk")),
                    help="the SDK folder (default $SDK or ../podbox/arcade/sdk)")
    ap.add_argument("--keep", action="store_true", help="keep the scratch folder and say where it is")
    ap.add_argument("--verbose", action="store_true", help="print every problem line in full")
    ap.add_argument("--selftest", action="store_true",
                    help="raise POP to 12 and check that the invariants catch it")
    args = ap.parse_args()

    sdk = os.path.abspath(args.sdk)
    vm = os.path.join(sdk, "host", "pbgvm")
    if not os.path.isfile(os.path.join(sdk, "pbgc.js")):
        fail("no SDK at %s: clone https://github.com/anthonyfletcher/podbox next to this repo or pass --sdk" % sdk)
    if not os.access(vm, os.X_OK):
        fail("no %s: run 'sh host/build.sh' in the SDK folder" % vm)
    modes = [m.strip() for m in args.modes.split(",") if m.strip()]
    for m in modes:
        if m not in MODES:
            fail("unknown mode '%s': use smart, blind or still" % m)

    work = tempfile.mkdtemp(prefix="marbles-stress-")
    try:
        if args.selftest:
            return selftest(sdk, vm, work, args)
        pbg = build(sdk, work, "marbles")
        jobs = [(lvl, m, seed) for lvl in numbers(args.levels, 6) for m in modes
                for seed in numbers(args.seeds, 0)]
        print("Marble Chain stress: %d runs of %d ticks, a shot every %d ticks" %
              (len(jobs), args.ticks, args.every))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            runs = list(pool.map(lambda j: play(vm, pbg, j[0], j[1], j[2], args.ticks, args.every), jobs))
        return report(runs, args)
    finally:
        if args.keep:
            print("scratch folder kept: %s" % work)
        else:
            shutil.rmtree(work, ignore_errors=True)


def report(runs, args):
    print()
    print(row([c for c, _ in COLUMNS]))
    for run in runs:
        print(describe(run))
    print()
    print("Units a tick of play, harness taken out. hit% is shots whose own landing popped;")
    print("pwr is power-ups seen (bombs can be undercounted). Budget: 12,500 at 33, 17,500 at 25.")

    bad = 0
    for run in runs:
        name = "level %d %s seed %d" % (run["level"], run["mode"], run["seed"])
        lines = run["problems"] if args.verbose else run["problems"][:5]
        if run["exit"] != 0 or run["errors"]:
            bad += 1
            print("\n%s stopped (exit %d):" % (name, run["exit"]))
            for line in run["errors"][:10]:
                print("  " + line)
        if not run["summary"]:
            bad += 1
            print("\n%s printed no summary: did the harness run?" % name)
        if run["summary"].get("violations", 0):
            bad += 1
        if lines:
            print("\n%s:" % name)
            for line in lines:
                print("  " + line)

    viol = sum(r["summary"].get("violations", 0) for r in runs)
    warn = sum(r["summary"].get("warnings", 0) for r in runs)
    print()
    for mode in MODES:
        u = stats([v for r in runs if r["mode"] == mode for v in r["units"]])
        if u:
            print("All {:<5}  avg {:>6,}  p95 {:>6,}  p99 {:>6,}  max {:>6,}  over 12,500 {:>5.1f}%  over 17,500 {:>5.1f}%".format(
                mode, u["avg"], u["p95"], u["p99"], u["max"], u["over33"], u["over25"]))
    print("%d runs, %d violations, %d warnings: %s" % (len(runs), viol, warn, "FAIL" if bad else "ok"))
    return 1 if bad else 0


def selftest(sdk, vm, work, args):
    """The checks must catch a pop that outlasts its busy count."""
    pbg = build(sdk, work, "broken", ("chain.js", SELFTEST_FROM, SELFTEST_TO))
    print("Self-test: chain.js with POP raised from 8 to 12, so an insert can cut a pop short")
    caught = 0
    for level in (1, 3, 6):
        run = play(vm, pbg, level, "smart", 1, 3000, 8)
        v = run["summary"].get("violations", 0)
        caught += v
        first = run["problems"][0] if run["problems"] else "none"
        print("  level %d: %d violations, first: %s" % (level, v, first))
    if caught:
        print("ok: the invariants caught it")
        return 0
    print("FAIL: no violations, so the checks aren't working")
    return 1


if __name__ == "__main__":
    sys.exit(main())
