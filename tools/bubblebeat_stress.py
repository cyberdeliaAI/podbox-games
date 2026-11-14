"""Plays Bubble Beat by itself, checks the board's invariants every tick
and reports what each tick of play costs in units.

    python3 tools/bubblebeat_stress.py                    # levels 1, 5, 10 and 20; smart and blind; with and without music
    python3 tools/bubblebeat_stress.py --levels 12 --modes smart --music tracks --ticks 20000
    python3 tools/bubblebeat_stress.py --selftest         # shows the checks can fail

It copies bubblebeat/ into a scratch folder, adds tools/bubblebeat_stress.js
as stress.js, makes update() call stress.tick() first, builds the copy with
the SDK's pbgc and plays it in pbgvm. The cart's own files aren't touched.

The player (see bubblebeat_stress.js):

    smart   tries 41 aims with both bubbles, flies each as the game would
            and takes the biggest pop; with a beat it waits for the beat
    blind   shoots at random

The music:

    none    no music: the ceiling comes down by shots
    beat    a steady 120 BPM track
    tracks  the fake library's queue, each track at its own tempo, so the
            beat is listened for again at every new track

A run starts at its level, goes on to the next after a clear and back to
its level after a loss. Units are those of the ticks that start in play,
less the harness's own (its prof() sections). The budget on an iPod Video
playing FLAC is about 12,500 units a tick at 33 ticks a second.

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
CART = os.path.join(REPO, "bubblebeat")
HARNESS = os.path.join(HERE, "bubblebeat_stress.js")

MODES = {"blind": 0, "smart": 1}
MUSIC = {"none": [], "beat": ["--playing", "--beat", "120"], "tracks": ["--playing", "--beat", "0"]}
BUDGET_33 = 12500

HOOK = "function update() {"
# the self-test leaves a colour's count behind when a bubble pops or falls
SELFTEST = ("board.js", "    occ[j + 1] = 0;\n    counts[v]--;", "    occ[j + 1] = 0;")


def fail(msg, code=2):
    print("bubblebeat_stress: " + msg, file=sys.stderr)
    sys.exit(code)


def numbers(text):
    out = []
    for part in text.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            out += range(int(a), int(b) + 1)
        elif part:
            out.append(int(part))
    return out


def words(text, allowed, what):
    out = [w.strip() for w in text.split(",") if w.strip()]
    for w in out:
        if w not in allowed:
            fail("unknown %s '%s': use %s" % (what, w, ", ".join(allowed)))
    return out


def build(sdk, work, name, patch=None):
    folder = os.path.join(work, name)
    shutil.copytree(CART, folder)
    shutil.copy(HARNESS, os.path.join(folder, "stress.js"))
    edits = [("main.js", HOOK, HOOK + "\n    stress.tick();")]
    if patch:
        edits.append(patch)
    for f, a, b in edits:
        path = os.path.join(folder, f)
        with open(path) as fh:
            src = fh.read()
        if src.count(a) != 1:
            fail("expected '%s' exactly once in bubblebeat/%s" % (a.strip(), f))
        with open(path, "w") as fh:
            fh.write(src.replace(a, b))
    pbg = os.path.join(work, name + ".pbg")
    r = subprocess.run(["node", os.path.join(sdk, "pbgc.js"), "build", folder, "-o", pbg],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        fail("the cart with the harness didn't build")
    return pbg


def play(vm, pbg, level, mode, music, seed, ticks, every):
    cmd = [vm, pbg, "--ticks", str(ticks), "--seed", str(seed), "--units",
           "--setting", "stress_level=%d" % level, "--setting", "stress_mode=%d" % MODES[mode],
           "--setting", "stress_every=%d" % every, "--setting", "stress_ticks=%d" % ticks] + MUSIC[music]
    r = subprocess.run(cmd, capture_output=True, text=True)
    run = {"level": level, "mode": mode, "music": music, "seed": seed, "exit": r.returncode,
           "errors": [], "problems": [], "summary": {}, "units": []}
    for line in r.stdout.splitlines():
        if line.startswith("VIOLATION"):
            run["problems"].append(line)
        elif line.startswith("STRESS "):
            p = line.split()[1:]
            run["summary"] = {p[i]: int(p[i + 1]) for i in range(0, len(p) - 1, 2)}
    harness, in_play = 0, False
    for line in r.stderr.splitlines():
        p = line.split()
        if len(p) == 3 and p[0] == "prof" and p[1].startswith("stress_"):
            harness += int(p[2])
            in_play = in_play or p[1] == "stress_play"
        elif len(p) == 3 and p[0] == "tick":
            if in_play:
                run["units"].append(int(p[2]) - harness)
            harness, in_play = 0, False
        elif p and p[0] not in ("start", "prof"):
            run["errors"].append(line)
    return run


def stats(units):
    if not units:
        return None
    u = sorted(units)
    at = lambda q: u[min(len(u) - 1, int(len(u) * q))]
    return {"avg": sum(u) // len(u), "p95": at(0.95), "p99": at(0.99), "max": u[-1],
            "over": 100.0 * sum(1 for v in u if v > BUDGET_33) / len(u)}


COLUMNS = [("lvl", 3), ("mode", 5), ("music", 6), ("seed", 4), ("shots", 5), ("pops", 4), ("beat", 4),
           ("clear", 5), ("lost", 4), ("drops", 5), ("top", 3), ("avg", 6), ("p95", 6), ("p99", 6),
           ("max", 6), (">12.5k", 6), ("viol", 4)]


def row(values):
    return "  ".join(str(v).rjust(w) for v, (_, w) in zip(values, COLUMNS))


def describe(run):
    s, u = run["summary"], stats(run["units"])
    cells = [run["level"], run["mode"], run["music"], run["seed"], s.get("shots", 0), s.get("pops", 0),
             s.get("onbeat", 0), s.get("clears", 0), s.get("losses", 0), s.get("drops", 0), s.get("level", 0)]
    if u:
        cells += ["{:,}".format(u["avg"]), "{:,}".format(u["p95"]), "{:,}".format(u["p99"]),
                  "{:,}".format(u["max"]), "%.1f%%" % u["over"]]
    else:
        cells += ["-"] * 5
    cells.append(s.get("violations", 0))
    return row(cells)


def report(runs, verbose):
    print()
    print(row([c for c, _ in COLUMNS]))
    for run in runs:
        print(describe(run))
    print()
    print("Units a tick of play, harness taken out. pops: shots that scored; beat: shots fired on the")
    print("beat; top: the furthest level reached. Budget: 12,500 at 33.")
    bad = 0
    for run in runs:
        name = "level %d %s %s seed %d" % (run["level"], run["mode"], run["music"], run["seed"])
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
        lines = run["problems"] if verbose else run["problems"][:5]
        if lines:
            print("\n%s:" % name)
            for line in lines:
                print("  " + line)
    print()
    for music in MUSIC:
        u = stats([v for r in runs if r["music"] == music for v in r["units"]])
        if u:
            print("All {:<6}  avg {:>6,}  p95 {:>6,}  p99 {:>6,}  max {:>6,}  over 12,500 {:>5.1f}%".format(
                music, u["avg"], u["p95"], u["p99"], u["max"], u["over"]))
    viol = sum(r["summary"].get("violations", 0) for r in runs)
    print("%d runs, %d violations: %s" % (len(runs), viol, "FAIL" if bad else "ok"))
    return 1 if bad else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--levels", default="1,5,10,20", help="levels to start at (default 1,5,10,20)")
    ap.add_argument("--modes", default="smart,blind", help="smart and/or blind (default both)")
    ap.add_argument("--music", default="none,tracks", help="none, beat and/or tracks (default none,tracks)")
    ap.add_argument("--seeds", default="1", help="random seeds (default 1)")
    ap.add_argument("--ticks", type=int, default=9000, help="ticks a run (default 9000, 4.5 minutes at 33)")
    ap.add_argument("--every", type=int, default=20, help="ticks between shots at most (default 20)")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4, help="runs at once")
    ap.add_argument("--sdk", default=os.environ.get("SDK", os.path.join(REPO, "..", "podbox", "arcade", "sdk")),
                    help="the SDK folder (default $SDK or ../podbox/arcade/sdk)")
    ap.add_argument("--keep", action="store_true", help="keep the scratch folder and say where it is")
    ap.add_argument("--verbose", action="store_true", help="print every problem line in full")
    ap.add_argument("--selftest", action="store_true",
                    help="break the colour counts in a scratch copy and check that the invariants catch it")
    args = ap.parse_args()

    sdk = os.path.abspath(args.sdk)
    vm = os.path.join(sdk, "host", "pbgvm")
    if not os.path.isfile(os.path.join(sdk, "pbgc.js")):
        fail("no SDK at %s: clone https://github.com/anthonyfletcher/podbox next to this repo or pass --sdk" % sdk)
    if not os.access(vm, os.X_OK):
        fail("no %s: run 'sh host/build.sh' in the SDK folder" % vm)
    modes = words(args.modes, MODES, "mode")
    musics = words(args.music, MUSIC, "music")

    work = tempfile.mkdtemp(prefix="bubblebeat-stress-")
    try:
        if args.selftest:
            pbg = build(sdk, work, "broken", SELFTEST)
            print("Self-test: board.js no longer lowers a colour's count when a bubble pops or falls")
            run = play(vm, pbg, 1, "smart", "none", 1, 3000, 20)
            v = run["summary"].get("violations", 0)
            print("  level 1: %d violations, first: %s" % (v, run["problems"][0] if run["problems"] else "none"))
            print("ok: the invariants caught it" if v else "FAIL: no violations, so the checks aren't working")
            return 0 if v else 1
        pbg = build(sdk, work, "bubblebeat")
        jobs = [(lvl, m, mu, seed) for lvl in numbers(args.levels) for m in modes for mu in musics
                for seed in numbers(args.seeds)]
        print("Bubble Beat stress: %d runs of %d ticks" % (len(jobs), args.ticks))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            runs = list(pool.map(lambda j: play(vm, pbg, j[0], j[1], j[2], j[3], args.ticks, args.every), jobs))
        return report(runs, args.verbose)
    finally:
        if args.keep:
            print("scratch folder kept: %s" % work)
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
