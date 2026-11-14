"""Builds Pocket Wings 3D's landscapes and art.

    python3 tools/pocketwings_assets.py

For each of the six landscapes <name> it writes into pocketwings/:

    images/<name>_h.png     the heights: one world pixel a pixel, 0 to 255
    images/<name>_c.png     the colours, with the sun's shading baked in
    images/<name>_h2.png    the same landscape at half size, 128 square, for the
    images/<name>_c2.png    quicker levels of the picture: heights halved too
    images/<name>_sky.png   hills on the horizon, a whole turn across
    palettes/<name>.gpl     the palette they are all drawn in
    data/<name>.json        where a flight starts, the water's height, the
                            scenery (trees, palms, houses, rocks) and the five
                            landmarks, in the order the game names them

and once: images/scenery.png (every kind of scenery and landmark at a run
of sizes on the screen), data/scenery.json (where each is in it, and the
sizes), sheet.png (the aircraft at five banks) and
logo.png.

Every landscape is 256 pixels square and seamless: the Arcade's land.draw
wraps the world, so its left edge meets its right and its top its bottom.
The noise is made periodic by tiling a small random lattice three by three,
scaling it up and cutting out the middle, so it joins wherever it is cut.
Features drawn on top (rivers, lakes, craters, villages) wrap the same way.
The colour picture carries the shading: each material has a dark, a middle
and a light shade, picked by how the slope faces a sun in the north-west,
which gives the hills their depth for nothing at run time.

Every palette has the same layout, which the game, the sky and the scenery
picture rely on: 0 to 15 the standard colours; 16 to 36 seven materials in
threes; 37 deep water, 38 water, 39 its glint, 40 roofs, 41 walls; 42 to 45
the sky from the top down to the haze; 46 and 47 the far hills; 48 to 71
the scenery's eight colours, three times, from near to far in the haze.
"""
import json
import math
import os
import random

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CART = os.path.join(HERE, "..", "pocketwings")
S = 256

STANDARD = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
            0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]


def flat(colours):
    out = []
    for c in colours:
        out += [(c >> 16) & 255, (c >> 8) & 255, c & 255]
    return out + [0] * (768 - len(out))


def blend(c, to, t):
    out = 0
    for sh in (16, 8, 0):
        a, b = (c >> sh) & 255, (to >> sh) & 255
        out |= int(round(a + (b - a) * t)) << sh
    return out


# ---- periodic noise ------------------------------------------------------------

def lattice(n, seed, w=S, h=S):
    """Smooth noise from 0 to 1 that repeats every w by h pixels: an n by n
    random lattice, scaled up bicubically from a 3 by 3 tiling of itself."""
    rnd = random.Random(seed)
    small = Image.new("L", (n, n))
    small.putdata([rnd.randrange(256) for _ in range(n * n)])
    tiled = Image.new("L", (n * 3, n * 3))
    for i in range(3):
        for j in range(3):
            tiled.paste(small, (i * n, j * n))
    big = tiled.resize((w * 3, h * 3), Image.BICUBIC).crop((w, h, w * 2, h * 2))
    return [v / 255.0 for v in big.tobytes()]


def fbm(octaves, seed):
    """Octaves of lattice noise, coarse to fine, as (lattice size, weight)."""
    total = [0.0] * (S * S)
    for k, (n, w) in enumerate(octaves):
        layer = lattice(n, seed * 31 + k)
        for i in range(S * S):
            total[i] += layer[i] * w
    lo, hi = min(total), max(total)
    return [(v - lo) / (hi - lo) for v in total]


def wrapd(a, b):
    """The shortest distance from a to b on a circle S around."""
    d = abs(a - b) % S
    return min(d, S - d)


def offset(a, b):
    """b - a the short way round, -S/2 to S/2."""
    return (b - a + S // 2) % S - S // 2


def smooth(a, b, v):
    t = min(1.0, max(0.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)


def percentile(values, p):
    return sorted(values)[int(len(values) * p)]


# ---- shading -------------------------------------------------------------------

def slopes(h):
    """Each pixel's slope (how many world pixels it rises a pixel across) and
    its light from a sun in the north-west, 0 to 1."""
    sl, lit = [0.0] * (S * S), [0.0] * (S * S)
    lx, ly, lz = -0.55, -0.55, 0.63
    for y in range(S):
        for x in range(S):
            dx = (h[y * S + (x + 1) % S] - h[y * S + (x - 1) % S]) / 2.0
            dy = (h[((y + 1) % S) * S + x] - h[((y - 1) % S) * S + x]) / 2.0
            n = math.sqrt(dx * dx + dy * dy + 1.0)
            sl[y * S + x] = math.sqrt(dx * dx + dy * dy)
            lit[y * S + x] = max(0.0, (-dx * lx - dy * ly + lz) / n)
    return sl, lit


def shade(lit):
    return 0 if lit < 0.62 else (1 if lit < 0.8 else 2)


# ---- the palette ---------------------------------------------------------------

SINGLES = ["deep", "water", "glint", "roof", "wall", "sky top", "sky", "sky low", "haze",
           "far hills", "far hills lit"]
SCENERY_HAZES = [0.0, 0.4, 0.7]    # how far into the haze each of the scenery's looks goes


def palette(cfg):
    """The layout every landscape shares (see the top of this file)."""
    pal = list(STANDARD)
    idx = {}
    for name, cols in cfg["materials"]:
        idx[name] = len(pal)
        pal += list(cols)
    assert len(pal) == 37
    for name in SINGLES:
        idx[name] = len(pal)
        pal.append(cfg["singles"][name])
    assert idx["sky top"] == 42 and idx["far hills lit"] == 47
    idx["scenery"] = len(pal)
    haze = cfg["singles"]["haze"]
    for t in SCENERY_HAZES:
        pal += [blend(c, haze, t) for c in cfg["scenery"]]
    return pal, idx


# ---- placing things ------------------------------------------------------------

def scatter(rnd, n, ok, gap, taken, tries=20000):
    """Up to n places where ok(x, y) holds, none within gap of another or of
    anything in taken (which they join)."""
    got = []
    for _ in range(tries):
        if len(got) == n:
            break
        x, y = rnd.randrange(S), rnd.randrange(S)
        if not ok(x, y):
            continue
        if any(wrapd(x, a) ** 2 + wrapd(y, b) ** 2 < gap * gap for a, b in taken):
            continue
        got.append((x, y))
        taken.append((x, y))
    return got


def spot(cx, cy, ok, taken, radius=40):
    """The nearest place to cx, cy where ok holds and nothing is within 8."""
    best = None
    for r in range(radius + 1):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r:
                    continue
                x, y = (cx + dx) % S, (cy + dy) % S
                if ok(x, y) and not any(wrapd(x, a) ** 2 + wrapd(y, b) ** 2 < 64 for a, b in taken):
                    best = (x, y)
                    break
            if best:
                break
        if best:
            break
    if best is None:
        raise SystemExit("no place for a landmark near %d, %d" % (cx, cy))
    taken.append(best)
    return best


def highest(h, ok, avoid, gap):
    """The highest place where ok holds, at least gap from those in avoid."""
    order = sorted(range(S * S), key=lambda i: -h[i])
    for i in order:
        x, y = i % S, i // S
        if ok(x, y) and all(wrapd(x, a) ** 2 + wrapd(y, b) ** 2 >= gap * gap for a, b in avoid):
            avoid.append((x, y))
            return (x, y)
    raise SystemExit("no high place left")


# the kinds of scenery, as the game numbers them
BROADLEAF, PINE, PALM, HOUSE, CACTUS, ROCK = 0, 1, 2, 3, 4, 5
TOWER, MILL, LIGHTHOUSE, ARCH, DOME, NEEDLE = 6, 7, 8, 9, 10, 11


# ---- Green Valley --------------------------------------------------------------

def valley_heights(cfg):
    w = cfg["water"]
    base = fbm([(4, 1.0), (8, 0.5), (16, 0.25), (32, 0.12), (64, 0.05)], 11)
    # rolling land, all of it above the water: only the river and the lakes
    # go below
    h = [20.0 + (v ** 1.5) * 80.0 for v in base]
    # the river: a meander that runs right round the world and meets itself,
    # in a broad valley that steepens away from the water. The distance to
    # it is measured along the curve, so its banks are as gentle where it
    # bends as where it runs straight.
    curve = [128 + 38 * math.sin(2 * math.pi * x / S) + 14 * math.sin(6 * math.pi * x / S + 1.0)
             for x in range(S)]
    for y in range(S):
        for x in range(S):
            d = 99.0
            for dx in range(-30, 31, 2):
                dy = wrapd(y, curve[(x + dx) % S])
                d = min(d, math.sqrt(dx * dx + dy * dy))
            i = y * S + x
            if d < 3.5:
                h[i] = w - 4.0
            elif d < 48:
                h[i] = min(h[i], w + 1.0 + ((d - 3.5) / 44.0) ** 1.6 * 70.0)
    # two lakes, each in a bowl of its own: an uneven shore, then a gentle
    # rise to meet the land
    for (lx, ly, r) in [(60, 40, 14), (196, 206, 11)]:
        for y in range(S):
            for x in range(S):
                dx = offset(lx, x)
                dy = offset(ly, y)
                a = math.atan2(dy, dx)
                re = r * (1.0 + 0.25 * math.sin(3 * a + lx) + 0.12 * math.sin(5 * a + ly))
                d = math.sqrt(dx * dx + dy * dy)
                bowl = w - 6.0 + 8.0 * (d / re) ** 2 if d < re else w + 2.0 + (d - re) * 1.3
                h[y * S + x] = min(h[y * S + x], bowl)
    return h


def valley_colours(cfg, idx, raw, h, sl, lit, rnd):
    w = cfg["water"]
    forest = fbm([(8, 1.0), (16, 0.6), (32, 0.3)], 23)
    fields = fbm([(4, 1.0), (8, 0.5)], 37)
    col = [0] * (S * S)
    for y in range(S):
        for x in range(S):
            i = y * S + x
            if raw[i] <= w:
                col[i] = idx["deep"] if raw[i] < w - 6 else idx["water"]
                if rnd.random() < 0.015:
                    col[i] = idx["glint"]
                continue
            v, s = h[i], sl[i]
            if v < w + 2.5:
                m = "sand"
            elif s > 3.2:
                m = "rock"
            elif forest[i] > 0.6 and v > w + 6 and v < 85:
                m = "forest"
            elif s < 1.1 and v < w + 30 and fields[i] > 0.42:
                # a patchwork of fields, in parcels a few pixels across
                p = ((x // 7) * 7 + (y // 5) * 13 + (y // 5 % 2) * 3) % 5
                m = ["wheat", "plough", "meadow", "wheat", "grass"][p]
            elif v > 70:
                m = "meadow"
            else:
                m = "grass"
            col[i] = idx[m] + shade(lit[i])
    return col


def valley_things(cfg, idx, raw, h, sl, col, rnd):
    w = cfg["water"]
    land = lambda x, y: raw[y * S + x] > w + 2 and sl[y * S + x] < 2.0
    mat = lambda x, y, m: idx[m] <= col[y * S + x] < idx[m] + 3
    taken, things = [], []
    villages = [(40, 140), (150, 98), (222, 150)]
    for (vx, vy) in villages:
        for k in range(14):
            hx = (vx + rnd.randrange(-9, 10)) % S
            hy = (vy + rnd.randrange(-7, 8)) % S
            if raw[hy * S + hx] <= w + 1:
                continue
            col[hy * S + hx] = idx["roof"]
            col[hy * S + (hx + 1) % S] = idx["roof"]
            col[((hy + 1) % S) * S + hx] = idx["wall"]
            col[((hy + 1) % S) * S + (hx + 1) % S] = idx["wall"]
    marks = [(MILL, spot(100, 176, lambda x, y: land(x, y) and mat(x, y, "wheat"), taken)),
             (TOWER, spot(150, 98, land, taken)),
             (DOME, spot(60, 62, land, taken)),
             (NEEDLE, highest(h, land, taken, 30)),
             (ARCH, spot(200, 40, lambda x, y: land(x, y) and mat(x, y, "forest"), taken, 60))]
    for (vx, vy) in villages:
        things += [(x, y, HOUSE) for x, y in scatter(
            rnd, 5, lambda x, y: land(x, y) and wrapd(x, vx) < 12 and wrapd(y, vy) < 10, 4, taken)]
    things += [(x, y, BROADLEAF) for x, y in scatter(
        rnd, 60, lambda x, y: land(x, y) and (mat(x, y, "grass") or mat(x, y, "meadow")), 9, taken)]
    things += [(x, y, PINE) for x, y in scatter(
        rnd, 40, lambda x, y: land(x, y) and mat(x, y, "forest"), 7, taken)]
    return things, marks


# ---- Coral Islands -------------------------------------------------------------

def islands_heights(cfg):
    w = cfg["water"]
    n = fbm([(4, 1.0), (8, 0.6), (16, 0.3), (32, 0.12)], 61)
    t = percentile(n, 0.70)
    h = []
    for v in n:
        if v < t:
            h.append(w - 3.0 - (t - v) * 40.0)
        else:
            f = (v - t) / (1.0 - t)
            h.append(w + 1.0 + f ** 1.25 * 95.0)
    return h


def islands_colours(cfg, idx, raw, h, sl, lit, rnd):
    w = cfg["water"]
    jungle = fbm([(8, 1.0), (16, 0.5), (32, 0.3)], 63)
    col = [0] * (S * S)
    for i in range(S * S):
        if raw[i] <= w:
            col[i] = idx["water"] if raw[i] > w - 5 else idx["deep"]
            if rnd.random() < 0.006:
                col[i] = idx["glint"]
            continue
        v, s = h[i], sl[i]
        if v < w + 3:
            m = "sand"
        elif s > 3.0:
            m = "cliff"
        elif v > w + 62:
            m = "upland"
        elif jungle[i] > 0.55:
            m = "jungle"
        elif jungle[i] < 0.3 and s < 1.0:
            m = "plantation"
        else:
            m = "grass"
        col[i] = idx[m] + shade(lit[i])
    return col


def islands_things(cfg, idx, raw, h, sl, col, rnd):
    w = cfg["water"]
    land = lambda x, y: raw[y * S + x] > w + 1 and sl[y * S + x] < 2.5
    mat = lambda x, y, m: idx[m] <= col[y * S + x] < idx[m] + 3

    def shore(x, y):
        return land(x, y) and any(raw[((y + dy) % S) * S + (x + dx) % S] <= w - 4
                                  for dx, dy in ((5, 0), (-5, 0), (0, 5), (0, -5)))

    taken, things = [], []
    marks = [(LIGHTHOUSE, spot(30, 30, shore, taken, 128)),
             (NEEDLE, highest(h, land, taken, 40)),
             (DOME, highest(h, land, taken, 70)),
             (ARCH, spot(200, 60, lambda x, y: land(x, y) and mat(x, y, "sand"), taken, 128)),
             (TOWER, spot(120, 200, shore, taken, 128))]
    things += [(x, y, PALM) for x, y in scatter(
        rnd, 70, lambda x, y: land(x, y) and (mat(x, y, "sand") or mat(x, y, "grass")), 6, taken)]
    things += [(x, y, HOUSE) for x, y in scatter(rnd, 14, shore, 10, taken)]
    things += [(x, y, BROADLEAF) for x, y in scatter(
        rnd, 30, lambda x, y: land(x, y) and mat(x, y, "jungle"), 7, taken)]
    return things, marks


# ---- High Alps -----------------------------------------------------------------

def alps_heights(cfg):
    w = cfg["water"]
    # broad massifs, and on them sharp ridges: noise folded about its middle
    base = fbm([(4, 1.0), (8, 0.45), (16, 0.2)], 71)
    ridged = [0.0] * (S * S)
    for k, (n, wt) in enumerate([(8, 1.0), (16, 0.5), (32, 0.2)]):
        layer = lattice(n, 72 * 31 + k)
        for i in range(S * S):
            ridged[i] += (1.0 - abs(2.0 * layer[i] - 1.0)) ** 2 * wt
    lo, hi = min(ridged), max(ridged)
    h = []
    for i in range(S * S):
        r = (ridged[i] - lo) / (hi - lo)
        v = base[i]
        h.append(28.0 + v ** 1.5 * 120.0 + r * v * 60.0)
    # the deepest valleys hold lakes
    t = percentile(h, 0.07)
    return [w - 4.0 if v < t else max(v, w + 1.0) for v in h]


def alps_colours(cfg, idx, raw, h, sl, lit, rnd):
    w = cfg["water"]
    forest = fbm([(8, 1.0), (16, 0.5)], 73)
    col = [0] * (S * S)
    for i in range(S * S):
        if raw[i] <= w:
            col[i] = idx["deep"] if rnd.random() > 0.3 else idx["water"]
            if rnd.random() < 0.01:
                col[i] = idx["glint"]
            continue
        v, s = h[i], sl[i]
        if v > 150 and s < 1.6:
            m = "glacier"
        elif v > 128 or (v > 112 and lit[i] > 0.75):
            m = "snow"
        elif s > 2.8:
            m = "rock"
        elif s > 2.0 and v > 85:
            m = "scree"
        elif forest[i] > 0.5 and w + 4 < v < 100:
            m = "forest"
        elif v < 75:
            m = "meadow"
        else:
            m = "grass"
        col[i] = idx[m] + shade(lit[i])
    return col


def alps_things(cfg, idx, raw, h, sl, col, rnd):
    w = cfg["water"]
    land = lambda x, y: raw[y * S + x] > w + 2 and sl[y * S + x] < 2.2
    mat = lambda x, y, m: idx[m] <= col[y * S + x] < idx[m] + 3
    near_lake = lambda x, y: land(x, y) and any(raw[((y + dy) % S) * S + (x + dx) % S] <= w
                                                for dx, dy in ((6, 0), (-6, 0), (0, 6), (0, -6)))
    taken, things = [], []
    marks = [(DOME, highest(h, lambda x, y: sl[y * S + x] < 3.0, taken, 30)),
             (TOWER, spot(60, 190, near_lake, taken, 128)),
             (ARCH, spot(180, 120, lambda x, y: mat(x, y, "scree") or mat(x, y, "rock"), taken, 128)),
             (NEEDLE, spot(120, 40, lambda x, y: mat(x, y, "snow") or mat(x, y, "glacier"), taken, 128)),
             (MILL, spot(200, 220, lambda x, y: land(x, y) and mat(x, y, "meadow"), taken, 128))]
    things += [(x, y, PINE) for x, y in scatter(
        rnd, 70, lambda x, y: land(x, y) and mat(x, y, "forest"), 6, taken)]
    things += [(x, y, HOUSE) for x, y in scatter(
        rnd, 14, lambda x, y: land(x, y) and mat(x, y, "meadow"), 9, taken)]
    things += [(x, y, ROCK) for x, y in scatter(
        rnd, 20, lambda x, y: mat(x, y, "scree") and sl[y * S + x] < 3.0, 9, taken)]
    return things, marks


# ---- Red Canyon ----------------------------------------------------------------

def canyon_heights(cfg):
    w = cfg["water"]
    n = fbm([(4, 1.0), (8, 0.5), (16, 0.2)], 81)
    steps = 7
    h = []
    for v in n:
        # terraces: flat tops and steep risers between them
        f = v * steps
        k = math.floor(f)
        r = smooth(0.78, 1.0, f - k)
        h.append(24.0 + (k + r) / steps * 110.0)
    # the canyon: a river that winds right round the world between sheer walls
    curve = [128 + 46 * math.sin(2 * math.pi * x / S + 0.6) + 12 * math.sin(8 * math.pi * x / S)
             for x in range(S)]
    for y in range(S):
        for x in range(S):
            d = 99.0
            for dx in range(-20, 21, 2):
                dy = wrapd(y, curve[(x + dx) % S])
                d = min(d, math.sqrt(dx * dx + dy * dy))
            i = y * S + x
            if d < 2.5:
                h[i] = w - 3.0
            elif d < 16:
                h[i] = min(h[i], w + 1.0 + ((d - 2.5) / 13.5) ** 0.6 * 60.0)
    return h


def canyon_colours(cfg, idx, raw, h, sl, lit, rnd):
    w = cfg["water"]
    col = [0] * (S * S)
    for i in range(S * S):
        if raw[i] <= w:
            col[i] = idx["water"] if rnd.random() > 0.02 else idx["glint"]
            continue
        v, s = h[i], sl[i]
        if v < w + 4:
            m = "oasis"
        elif s > 2.6:
            m = "dark rock"
        elif s < 0.6:
            m = "sand" if rnd.random() > 0.08 else "scrub"
        else:
            # the walls in bands, by height
            m = ["red rock", "orange rock", "pale rock"][int((v - 20) / 11) % 3]
        col[i] = idx[m] + shade(lit[i])
    return col


def canyon_things(cfg, idx, raw, h, sl, col, rnd):
    w = cfg["water"]
    land = lambda x, y: raw[y * S + x] > w + 2 and sl[y * S + x] < 1.5
    mat = lambda x, y, m: idx[m] <= col[y * S + x] < idx[m] + 3
    taken, things = [], []
    marks = [(ARCH, spot(40, 60, land, taken, 128)),
             (NEEDLE, highest(h, land, taken, 40)),
             (TOWER, spot(128, 128 + 46, lambda x, y: land(x, y) and mat(x, y, "oasis"), taken, 128)),
             (MILL, spot(200, 30, lambda x, y: land(x, y) and mat(x, y, "sand"), taken, 128)),
             (DOME, spot(90, 220, lambda x, y: land(x, y) and mat(x, y, "sand"), taken, 128))]
    things += [(x, y, CACTUS) for x, y in scatter(
        rnd, 60, lambda x, y: land(x, y) and (mat(x, y, "sand") or mat(x, y, "scrub")), 8, taken)]
    things += [(x, y, ROCK) for x, y in scatter(rnd, 30, land, 12, taken)]
    things += [(x, y, HOUSE) for x, y in scatter(
        rnd, 8, lambda x, y: land(x, y) and mat(x, y, "oasis"), 6, taken)]
    things += [(x, y, BROADLEAF) for x, y in scatter(
        rnd, 12, lambda x, y: raw[y * S + x] > w and mat(x, y, "oasis"), 5, taken)]
    return things, marks


# ---- Frozen Lakes --------------------------------------------------------------

def frozen_heights(cfg):
    w = cfg["water"]
    n = fbm([(4, 1.0), (8, 0.5), (16, 0.25), (32, 0.1)], 91)
    t = percentile(n, 0.24)
    return [w - 2.0 if v < t else w + 1.0 + ((v - t) / (1.0 - t)) ** 1.3 * 58.0 for v in n]


def frozen_colours(cfg, idx, raw, h, sl, lit, rnd):
    w = cfg["water"]
    forest = fbm([(8, 1.0), (16, 0.5), (32, 0.3)], 93)
    col = [0] * (S * S)
    for i in range(S * S):
        if raw[i] <= w:
            r = rnd.random()
            col[i] = idx["glint"] if r < 0.03 else idx["deep"] if r < 0.25 else idx["water"]
            continue
        v, s = h[i], sl[i]
        if v < w + 2:
            m = "shore"
        elif s > 2.6:
            m = "rock"
        elif forest[i] > 0.56:
            m = "forest"
        elif s > 1.6:
            m = "tundra"
        elif lit[i] < 0.6:
            m = "blue snow"
        elif rnd.random() < 0.15:
            m = "packed"
        else:
            m = "snow"
        col[i] = idx[m] + shade(lit[i])
    return col


def frozen_things(cfg, idx, raw, h, sl, col, rnd):
    w = cfg["water"]
    land = lambda x, y: raw[y * S + x] > w + 2 and sl[y * S + x] < 2.0
    mat = lambda x, y, m: idx[m] <= col[y * S + x] < idx[m] + 3
    shore = lambda x, y: land(x, y) and any(raw[((y + dy) % S) * S + (x + dx) % S] <= w
                                            for dx, dy in ((5, 0), (-5, 0), (0, 5), (0, -5)))
    taken, things = [], []
    marks = [(TOWER, highest(h, land, taken, 30)),
             (LIGHTHOUSE, spot(70, 70, shore, taken, 128)),
             (DOME, spot(190, 60, land, taken, 128)),
             (NEEDLE, spot(60, 200, lambda x, y: mat(x, y, "tundra") or mat(x, y, "rock"), taken, 128)),
             (MILL, spot(200, 190, land, taken, 128))]
    things += [(x, y, PINE) for x, y in scatter(
        rnd, 70, lambda x, y: land(x, y) and mat(x, y, "forest"), 6, taken)]
    things += [(x, y, HOUSE) for x, y in scatter(rnd, 12, shore, 12, taken)]
    things += [(x, y, ROCK) for x, y in scatter(
        rnd, 12, lambda x, y: mat(x, y, "tundra") or mat(x, y, "rock"), 10, taken)]
    return things, marks


# ---- Fire Mountains ------------------------------------------------------------

VOLCANOES = [(64, 70, 46, 120.0, 7), (186, 84, 38, 95.0, 6), (110, 186, 52, 140.0, 8), (222, 206, 30, 75.0, 5)]


def volcano_heights(cfg):
    w = cfg["water"]
    n = fbm([(4, 1.0), (8, 0.5), (16, 0.25), (32, 0.1)], 101)
    t = percentile(n, 0.18)
    h = [w - 3.0 - (t - v) * 30.0 if v < t else w + 1.0 + (v - t) * 34.0 for v in n]
    for (vx, vy, r, top, crater) in VOLCANOES:
        for y in range(S):
            for x in range(S):
                d = math.hypot(offset(vx, x), offset(vy, y))
                if d >= r:
                    continue
                cone = w + 6.0 + (top - w - 6.0) * (1.0 - d / r) ** 1.35
                rim = w + 6.0 + (top - w - 6.0) * (1.0 - crater / r) ** 1.35
                if d < crater:
                    cone = rim - (crater - d) * 2.4
                i = y * S + x
                h[i] = max(h[i], cone)
    return h


def volcano_colours(cfg, idx, raw, h, sl, lit, rnd):
    w = cfg["water"]
    lush = fbm([(8, 1.0), (16, 0.5)], 103)
    rough = fbm([(16, 1.0), (32, 0.6), (64, 0.3)], 107)
    col = [0] * (S * S)
    for y in range(S):
        for x in range(S):
            i = y * S + x
            if raw[i] <= w:
                col[i] = idx["water"] if raw[i] > w - 4 else idx["deep"]
                if rnd.random() < 0.006:
                    col[i] = idx["glint"]
                continue
            v, s = h[i], sl[i]
            m = None
            for (vx, vy, r, top, crater) in VOLCANOES:
                d = math.hypot(offset(vx, x), offset(vy, y))
                if d < crater - 2:
                    m = "lava"
                    break
                if d < crater + 2:
                    m = "sulphur" if rough[i] > 0.6 else "scoria"
                    break
                # flows and ash run down the cone unevenly
                f = d / r + (rough[i] - 0.5) * 0.5
                if f < 0.5:
                    m = "black rock" if rough[i] > 0.45 else "scoria"
                    break
                if f < 0.85:
                    m = "ash" if rough[i] < 0.62 else "black rock"
                    break
            if m is None:
                m = "forest" if lush[i] > 0.6 and v > w + 4 else "green"
            col[i] = idx[m] + shade(lit[i])
    return col


def volcano_things(cfg, idx, raw, h, sl, col, rnd):
    w = cfg["water"]
    land = lambda x, y: raw[y * S + x] > w + 2 and sl[y * S + x] < 2.2
    mat = lambda x, y, m: idx[m] <= col[y * S + x] < idx[m] + 3
    shore = lambda x, y: land(x, y) and any(raw[((y + dy) % S) * S + (x + dx) % S] <= w
                                            for dx, dy in ((5, 0), (-5, 0), (0, 5), (0, -5)))
    taken, things = [], []
    vx, vy, r, top, crater = VOLCANOES[2]
    marks = [(DOME, spot(vx + crater + 3, vy, lambda x, y: mat(x, y, "scoria") or mat(x, y, "sulphur"), taken)),
             (LIGHTHOUSE, spot(10, 140, shore, taken, 128)),
             (ARCH, spot(150, 140, lambda x, y: land(x, y) and mat(x, y, "black rock"), taken, 128)),
             (TOWER, spot(30, 230, land, taken, 128)),
             (NEEDLE, spot(186, 84 + 20, lambda x, y: mat(x, y, "ash") or mat(x, y, "black rock"), taken, 60))]
    things += [(x, y, BROADLEAF) for x, y in scatter(
        rnd, 40, lambda x, y: land(x, y) and (mat(x, y, "green") or mat(x, y, "forest")), 8, taken)]
    things += [(x, y, PALM) for x, y in scatter(rnd, 20, shore, 7, taken)]
    things += [(x, y, ROCK) for x, y in scatter(
        rnd, 30, lambda x, y: mat(x, y, "ash") or mat(x, y, "black rock"), 9, taken)]
    things += [(x, y, HOUSE) for x, y in scatter(
        rnd, 8, lambda x, y: land(x, y) and mat(x, y, "green"), 12, taken)]
    return things, marks


# ---- the six -------------------------------------------------------------------

LANDSCAPES = [
    dict(name="valley", water=14, start=(0.0, 140.0, 62.0, 0.0),
         heights=valley_heights, colours=valley_colours, things=valley_things,
         materials=[("meadow", (0x52963a, 0x78be4c, 0xa0da64)), ("grass", (0x2c7030, 0x40923a, 0x5cb048)),
                    ("forest", (0x103e22, 0x1a582c, 0x287036)), ("wheat", (0xa88c32, 0xd6b64c, 0xeed678)),
                    ("plough", (0x5a3c28, 0x7a5436, 0x966c46)), ("rock", (0x585860, 0x807e84, 0xaaa8ac)),
                    ("sand", (0xaa9664, 0xceba80, 0xe8d8a4))],
         singles={"deep": 0x224e96, "water": 0x3470be, "glint": 0x96c8f0, "roof": 0xaa3428, "wall": 0xe2d6be,
                  "sky top": 0x4678d2, "sky": 0x6ea0e6, "sky low": 0xa0c8f0, "haze": 0xbed6ec,
                  "far hills": 0x7896be, "far hills lit": 0x8caace},
         scenery=[0x1e5a26, 0x2e7a32, 0x4e9a42, 0x6a4628, 0xb43a2c, 0xece2cc, 0x7c7a82, 0xb4b2b8],
         hills=(16, 6, 18, 1.0)),
    dict(name="islands", water=30, start=(128.0, 20.0, 70.0, 0.75),
         heights=islands_heights, colours=islands_colours, things=islands_things,
         materials=[("sand", (0xc8b47c, 0xe6d49a, 0xf6eac0)), ("grass", (0x4c9a3a, 0x6cbc48, 0x92d860)),
                    ("jungle", (0x0e4a26, 0x166232, 0x227c3e)), ("upland", (0x6c7a3c, 0x8a9a4c, 0xaab862)),
                    ("cliff", (0x5a4c40, 0x7c6a5a, 0x9e8c7a)), ("plantation", (0x3a7a2a, 0x58a03a, 0x78bc50)),
                    ("reef", (0x2c8c9a, 0x40aab4, 0x60c4c8))],
         singles={"deep": 0x14628e, "water": 0x2aa0b8, "glint": 0xb4ecf0, "roof": 0xc89a5a, "wall": 0xeadcb8,
                  "sky top": 0x2c7ce0, "sky": 0x58a4ee, "sky low": 0x94ccf4, "haze": 0xc4e4f6,
                  "far hills": 0x6a9ab6, "far hills lit": 0x84b4c8},
         scenery=[0x1e6a2a, 0x34903a, 0x62b84a, 0x7a5a36, 0xc8603a, 0xf4ead4, 0x8a8478, 0xc8c0b0],
         hills=(10, 0, 9, 2.0)),
    dict(name="alps", water=40, start=(30.0, 30.0, 150.0, 0.875),
         heights=alps_heights, colours=alps_colours, things=alps_things,
         materials=[("meadow", (0x4a8a3a, 0x68aa4a, 0x8ac862)), ("grass", (0x5a7a40, 0x76984e, 0x96b464)),
                    ("forest", (0x0e3a26, 0x184e30, 0x24663c)), ("scree", (0x6a6258, 0x8a8276, 0xaaa296)),
                    ("rock", (0x4a4852, 0x6a6872, 0x8e8c96)), ("snow", (0xb4c4e0, 0xdce6f6, 0xffffff)),
                    ("glacier", (0x8cb4dc, 0xb0d0ee, 0xd4e8fa))],
         singles={"deep": 0x1a4a7a, "water": 0x2e6c9e, "glint": 0xa8d4f4, "roof": 0x8a3a24, "wall": 0xd8c4a0,
                  "sky top": 0x1e54c4, "sky": 0x4a84e0, "sky low": 0x8cbaf0, "haze": 0xc0d8f2,
                  "far hills": 0x8494b8, "far hills lit": 0xe6eef8},
         scenery=[0x0e3c24, 0x1c5432, 0x2e6c40, 0x5a3a24, 0x9a3c28, 0xe4d8c0, 0x6c6a72, 0xf4f8fc],
         hills=(20, 8, 24, 0.6)),
    dict(name="canyon", water=10, start=(0.0, 60.0, 120.0, 0.0),
         heights=canyon_heights, colours=canyon_colours, things=canyon_things,
         materials=[("sand", (0xb88c5a, 0xd6aa72, 0xeec890)), ("red rock", (0x7a2c1c, 0xa0402a, 0xc0583a)),
                    ("orange rock", (0x9a5424, 0xc0702e, 0xdc8c44)), ("pale rock", (0xb49a7a, 0xd2b896, 0xead4b4)),
                    ("dark rock", (0x4a2418, 0x643222, 0x7e4430)), ("scrub", (0x6a6a34, 0x868446, 0xa2a05a)),
                    ("oasis", (0x2e6a2a, 0x46883a, 0x62a44c))],
         singles={"deep": 0x1e5a6a, "water": 0x2e7a86, "glint": 0x8ccad0, "roof": 0x9a4a2c, "wall": 0xe6caa0,
                  "sky top": 0x2a64c0, "sky": 0x5a90dc, "sky low": 0x9cc0e8, "haze": 0xe8d4c0,
                  "far hills": 0xb47a5a, "far hills lit": 0xd09a74},
         scenery=[0x2e5a2a, 0x46783a, 0x66984c, 0x6a4a2c, 0xb4502e, 0xf0dcb8, 0x8a5a3e, 0xc89a72],
         hills=(12, 4, 16, 0.0)),
    dict(name="frozen", water=22, start=(128.0, 128.0, 70.0, 0.25),
         heights=frozen_heights, colours=frozen_colours, things=frozen_things,
         materials=[("snow", (0xc8d4e6, 0xe2eaf6, 0xfafcff)), ("blue snow", (0x94a8cc, 0xacbede, 0xc4d4ec)),
                    ("forest", (0x1a3a34, 0x2a4e46, 0x46685e)), ("tundra", (0x6a6a5e, 0x868476, 0xa2a092)),
                    ("rock", (0x4e5260, 0x6a6e7c, 0x8a8e9c)), ("packed", (0xb4c0d4, 0xccd6e6, 0xe4ecf6)),
                    ("shore", (0x9aa6b4, 0xb4bece, 0xccd4e2))],
         singles={"deep": 0x7ea6c8, "water": 0x9cc2de, "glint": 0xeaf6fe, "roof": 0x8a3a30, "wall": 0x9a7a5a,
                  "sky top": 0x6a8ab8, "sky": 0x90aed0, "sky low": 0xbacee4, "haze": 0xdae4f0,
                  "far hills": 0x98a8c4, "far hills lit": 0xcad6e8},
         scenery=[0x1a3c34, 0x2c5246, 0xe4eef6, 0x5a4232, 0x9a3a2e, 0xf0f4f8, 0x6c7080, 0xc4ccd8],
         hills=(10, 3, 10, 1.0)),
    dict(name="volcano", water=12, start=(10.0, 10.0, 90.0, 0.875),
         heights=volcano_heights, colours=volcano_colours, things=volcano_things,
         materials=[("green", (0x3a7a2c, 0x529a3a, 0x70b64c)), ("forest", (0x123e1e, 0x1c562a, 0x2a6e36)),
                    ("ash", (0x5a5658, 0x787476, 0x969294)), ("black rock", (0x1e1c22, 0x302e36, 0x46444c)),
                    ("scoria", (0x6a2e22, 0x8a3e2c, 0xa8523a)), ("lava", (0xc0300c, 0xf06414, 0xfcb428)),
                    ("sulphur", (0x9a8a2a, 0xc8b436, 0xe8d850))],
         singles={"deep": 0x1a3e6a, "water": 0x285c8c, "glint": 0x90bce0, "roof": 0x9a3a2a, "wall": 0xd6c8b0,
                  "sky top": 0x3a4e86, "sky": 0x6a74a0, "sky low": 0xa294aa, "haze": 0xc4b4b8,
                  "far hills": 0x5e5470, "far hills lit": 0x7a6a84},
         scenery=[0x1c4a22, 0x2e6a30, 0x4c8c3e, 0x4a3426, 0xa83a26, 0xe6dcc8, 0x3a3640, 0x6e6874],
         hills=(6, 2, 22, 2.2)),
]


def make_landscape(cfg):
    pal, idx = palette(cfg)
    raw = cfg["heights"](cfg)
    w = cfg["water"]
    h = [max(v, w) for v in raw]      # water lies flat at its surface
    sl, lit = slopes(h)
    rnd = random.Random(len(cfg["name"]) * 7 + w)
    col = cfg["colours"](cfg, idx, raw, h, sl, lit, rnd)
    things, marks = cfg["things"](cfg, idx, raw, h, sl, col, rnd)
    heights = [int(round(v)) for v in h]
    assert max(heights) < 230 - 9, cfg["name"] + " is higher than the aircraft's ceiling allows"
    return pal, idx, heights, col, things, marks


# ---- writing -------------------------------------------------------------------

def far_hills(pal, idx, cfg):
    """The hills on the horizon: a silhouette that joins round a whole turn.
    hills: (lattice size, foot, height, sharpness); sharpness 0 gives flat
    topped mesas, 2 lone peaks."""
    n, foot, span, sharp = cfg["hills"]
    sky = Image.new("P", (S, 28), 0)
    sky.putpalette(flat(pal))
    px = sky.load()
    ridge = lattice(n, len(cfg["name"]) * 13 + 91, S, 1)
    fine = lattice(n * 4, len(cfg["name"]) * 13 + 92, S, 1)
    lo, hi = min(ridge), max(ridge)
    for x in range(S):
        v = (ridge[x] - lo) / (hi - lo)
        if sharp == 0.0:
            v = round(v * 3) / 3.0                       # mesas: flat tops in steps
        else:
            v = (1.0 - abs(2.0 * v - 1.0)) ** sharp      # folded to points
        v = v * 0.85 + fine[x] * 0.15
        top = 27 - int(foot + v * span)
        for y in range(max(0, top), 28):
            px[x, y] = idx["far hills lit"] if y <= top + (1 if span > 20 else 0) else idx["far hills"]
    return sky


def write_landscape(cfg, pal, idx, heights, col, things, marks):
    name = cfg["name"]
    for d in ("images", "palettes", "data"):
        os.makedirs(os.path.join(CART, d), exist_ok=True)
    grey = flat([(v << 16) | (v << 8) | v for v in range(256)])

    def save(data, size, palette_, fname):
        im = Image.new("P", (size, size))
        im.putpalette(palette_)
        im.putdata(data)
        im.save(os.path.join(CART, "images", fname))

    save(heights, S, grey, name + "_h.png")
    save(col, S, flat(pal), name + "_c.png")
    # half size: each pixel stands for two by two, its height the four's
    # average in half-size world pixels, its colour the top left one's
    H = S // 2
    h2, c2 = [], []
    for y in range(H):
        for x in range(H):
            i = (y * 2) * S + x * 2
            avg = (heights[i] + heights[i + 1] + heights[i + S] + heights[i + S + 1]) / 4.0
            h2.append(int(round(avg / 2.0)))
            c2.append(col[i])
    save(h2, H, grey, name + "_h2.png")
    save(c2, H, flat(pal), name + "_c2.png")
    far_hills(pal, idx, cfg).save(os.path.join(CART, "images", name + "_sky.png"))
    lines = ["GIMP Palette", "Name: " + name, "Columns: 16", "#"]
    for i, c in enumerate(pal):
        lines.append("%3d %3d %3d\tc%d" % ((c >> 16) & 255, (c >> 8) & 255, c & 255, i))
    with open(os.path.join(CART, "palettes", name + ".gpl"), "w") as f:
        f.write("\n".join(lines) + "\n")
    out = {"start": list(cfg["start"]), "water": cfg["water"],
           "x": [t[0] for t in things], "y": [t[1] for t in things], "k": [t[2] for t in things],
           "mx": [m[1][0] for m in marks], "my": [m[1][1] for m in marks], "mk": [m[0] for m in marks]}
    with open(os.path.join(CART, "data", name + ".json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))


# ---- the scenery picture -------------------------------------------------------

# Billboards cost the iPod about five units a pixel, so the game draws
# scenery itself: projected with plane.project and copied out of
# images/scenery.png at the size nearest what the distance asks for. The
# smaller sizes are drawn part way into the haze, so they fade with the
# distance for nothing. The colours are the palettes' scenery entries (48 on),
# so one picture serves every landscape: leaf dark, middle and light, wood,
# roof, wall, stone and pale stone (snow on the frozen landscape's trees).
TALL = [4.0, 5.0, 5.0, 3.0, 3.0, 3.0, 12.0, 10.0, 12.0, 8.0, 8.0, 11.0]   # world pixels, as scenery.js has them
WIDE = [0.8, 0.5, 0.8, 1.3, 0.7, 0.9, 0.5, 0.9, 0.45, 1.3, 1.1, 0.35]       # width for each pixel of height
SCENERY_SIZES = [2, 3, 4, 6, 8, 11, 15, 20, 27]
MARK_SIZES = [3, 4, 6, 8, 11, 15, 20, 28, 38]
FOCAL = 96.7                       # as view.js has it


def look_for(kind, hpx):
    d = TALL[kind] * FOCAL / hpx
    return 0 if d < 60 else 1 if d < 110 else 2


def draw_thing(kind, hpx, idx):
    """kind at hpx pixels tall, in the look its distance gives it."""
    look = look_for(kind, hpx)
    base = idx["scenery"] + look * 8
    dark, mid, light, wood, roof, wall, stone, pale = [base + i for i in range(8)]
    w = max(2, int(round(hpx * WIDE[kind])))
    k = 4
    im = Image.new("P", (w * k, hpx * k), 0)
    d = ImageDraw.Draw(im)
    W, H = w * k, hpx * k
    if kind == BROADLEAF:
        d.rectangle([W * 0.42, H * 0.6, W * 0.58, H], fill=wood)
        d.ellipse([0, 0, W - 1, H * 0.75], fill=mid)
        d.ellipse([W * 0.1, H * 0.05, W * 0.6, H * 0.45], fill=light)
        d.ellipse([W * 0.5, H * 0.35, W - 1, H * 0.75], fill=dark)
    elif kind == PINE:
        d.rectangle([W * 0.42, H * 0.82, W * 0.58, H], fill=wood)
        tiers = max(2, min(5, hpx // 6))
        for t in range(tiers):
            top = H * t / (tiers + 0.5)
            bot = H * (t + 1.6) / (tiers + 0.5)
            half = W * (0.22 + 0.28 * (t + 1) / tiers)
            d.polygon([(W / 2, top), (W / 2 + half, min(bot, H * 0.85)), (W / 2 - half, min(bot, H * 0.85))], fill=dark)
            d.polygon([(W / 2, top), (W / 2 - half * 0.2, min(bot, H * 0.85)), (W / 2 - half, min(bot, H * 0.85))], fill=mid)
            d.line([(W / 2, top), (W / 2 - half, min(bot, H * 0.85))], fill=pale if kind == PINE else light, width=k // 2)
    elif kind == PALM:
        d.line([(W * 0.45, H), (W * 0.5, H * 0.55), (W * 0.62, H * 0.22)], fill=wood, width=max(1, int(W * 0.12)))
        for a in (-150, -110, -60, -20, 20):
            r = math.radians(a)
            d.line([(W * 0.62, H * 0.22), (W * 0.62 + math.cos(r) * W * 0.5, H * 0.22 + math.sin(r) * H * 0.18 + H * 0.12)],
                   fill=mid if a < 0 else dark, width=max(1, int(H * 0.06)))
    elif kind == HOUSE:
        d.rectangle([W * 0.1, H * 0.45, W * 0.9, H], fill=wall)
        d.rectangle([W * 0.55, H * 0.45, W * 0.9, H], fill=stone)
        d.polygon([(0, H * 0.5), (W * 0.5, 0), (W - 1, H * 0.5)], fill=roof)
        d.rectangle([W * 0.3, H * 0.65, W * 0.45, H], fill=wood)
    elif kind == CACTUS:
        d.rectangle([W * 0.38, 0, W * 0.62, H], fill=mid)
        d.rectangle([W * 0.38, 0, W * 0.48, H], fill=light)
        d.rectangle([W * 0.05, H * 0.35, W * 0.38, H * 0.48], fill=mid)
        d.rectangle([W * 0.05, H * 0.15, W * 0.2, H * 0.48], fill=mid)
        d.rectangle([W * 0.62, H * 0.5, W * 0.95, H * 0.62], fill=dark)
        d.rectangle([W * 0.8, H * 0.28, W * 0.95, H * 0.62], fill=dark)
    elif kind == ROCK:
        d.polygon([(0, H), (W * 0.15, H * 0.35), (W * 0.45, 0), (W * 0.8, H * 0.3), (W - 1, H)], fill=stone)
        d.polygon([(0, H), (W * 0.15, H * 0.35), (W * 0.45, 0), (W * 0.45, H)], fill=pale)
    elif kind == TOWER:
        d.rectangle([W * 0.15, H * 0.25, W * 0.85, H], fill=pale)
        d.rectangle([W * 0.55, H * 0.25, W * 0.85, H], fill=stone)
        d.polygon([(W * 0.05, H * 0.27), (W * 0.5, 0), (W * 0.95, H * 0.27)], fill=roof)
        d.rectangle([W * 0.4, H * 0.4, W * 0.55, H * 0.5], fill=wood)
    elif kind == MILL:
        d.polygon([(W * 0.3, H), (W * 0.38, H * 0.35), (W * 0.62, H * 0.35), (W * 0.7, H)], fill=wall)
        d.polygon([(W * 0.33, H * 0.36), (W * 0.5, H * 0.22), (W * 0.67, H * 0.36)], fill=roof)
        cx, cy = W * 0.5, H * 0.32
        for a in (45, 135, 225, 315):
            r = math.radians(a)
            d.line([(cx, cy), (cx + math.cos(r) * W * 0.48, cy + math.sin(r) * H * 0.3)], fill=wood, width=max(1, k))
    elif kind == LIGHTHOUSE:
        d.polygon([(W * 0.2, H), (W * 0.32, H * 0.2), (W * 0.68, H * 0.2), (W * 0.8, H)], fill=wall)
        for b in range(3):
            y0 = H * (0.3 + b * 0.25)
            d.rectangle([W * 0.2, y0, W * 0.8, y0 + H * 0.1], fill=roof)
        d.rectangle([W * 0.3, H * 0.08, W * 0.7, H * 0.2], fill=10)
        d.polygon([(W * 0.25, H * 0.09), (W * 0.5, 0), (W * 0.75, H * 0.09)], fill=roof)
    elif kind == ARCH:
        d.polygon([(0, H), (W * 0.05, H * 0.15), (W * 0.5, 0), (W * 0.95, H * 0.15), (W - 1, H)], fill=stone)
        d.polygon([(0, H), (W * 0.05, H * 0.15), (W * 0.5, 0), (W * 0.5, H * 0.3)], fill=pale)
        d.ellipse([W * 0.22, H * 0.35, W * 0.78, H * 1.5], fill=0)
    elif kind == DOME:
        d.rectangle([W * 0.1, H * 0.55, W * 0.9, H], fill=stone)
        d.pieslice([W * 0.12, H * 0.1, W * 0.88, H], 180, 360, fill=wall)
        d.pieslice([W * 0.5, H * 0.1, W * 0.88, H], 270, 360, fill=pale)
        d.line([(W * 0.5, H * 0.1), (W * 0.62, 0)], fill=stone, width=max(1, k))
    elif kind == NEEDLE:
        d.polygon([(0, H), (W * 0.3, H * 0.1), (W * 0.5, 0), (W * 0.7, H * 0.12), (W - 1, H)], fill=stone)
        d.polygon([(0, H), (W * 0.3, H * 0.1), (W * 0.5, 0), (W * 0.45, H)], fill=pale)
    return im.resize((w, hpx), Image.NEAREST)


def write_scenery(pal, idx):
    """images/scenery.png, every kind at every size, packed in shelves; and
    data/scenery.json: where each is, and the sizes."""
    ims = []
    for kind in range(12):
        sizes = SCENERY_SIZES if kind < TOWER else MARK_SIZES
        for hpx in sizes:
            ims.append((kind, hpx, draw_thing(kind, hpx, idx)))
    order = sorted(range(len(ims)), key=lambda i: -ims[i][2].size[1])
    W = 256
    x = y = shelf = 0
    at = {}
    for i in order:
        w, h = ims[i][2].size
        if x + w > W:
            x, y, shelf = 0, y + shelf, 0
        at[i] = (x, y)
        x += w
        shelf = max(shelf, h)
    H = y + shelf
    atlas = Image.new("P", (W, H), 0)
    atlas.putpalette(flat(pal))
    for i, (_, _, im) in enumerate(ims):
        atlas.paste(im, at[i])
    atlas.save(os.path.join(CART, "images", "scenery.png"))
    # the game works out for itself which size to draw for each height
    # (scenery.js), from the sizes listed here: a table of every height
    # would take memory the landscapes need
    out = {"x": [at[i][0] for i in range(len(ims))], "y": [at[i][1] for i in range(len(ims))],
           "w": [im.size[0] for _, _, im in ims], "h": [im.size[1] for _, _, im in ims],
           "sizes": SCENERY_SIZES, "marks": MARK_SIZES}
    with open(os.path.join(CART, "data", "scenery.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    return W, H


# ---- the aircraft and the logo -------------------------------------------------

BANKS = [-30, -15, 0, 15, 30]       # degrees, left wing down to right wing down


def aircraft(deg, k=4):
    """The aircraft from behind and a little above, 24x16, banked deg."""
    W, H = 24 * k, 16 * k
    im = Image.new("P", (W, H), 0)
    im.putpalette(flat(STANDARD))
    d = ImageDraw.Draw(im)
    cx, cy = 12 * k, 9 * k
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)

    def rot(px, py):
        return (cx + px * ca - py * sa, cy + px * sa + py * ca)

    def poly(pts, c):
        d.polygon([rot(px * k, py * k) for px, py in pts], fill=c)

    poly([(-11.5, -0.6), (11.5, -0.6), (11.5, 0.9), (-11.5, 0.9)], 7)      # the wings
    poly([(-11.5, 0.3), (11.5, 0.3), (11.5, 0.9), (-11.5, 0.9)], 6)        # their shade
    poly([(-11.5, -0.6), (-9.5, -0.6), (-9.5, 0.9), (-11.5, 0.9)], 8)      # red tips
    poly([(9.5, -0.6), (11.5, -0.6), (11.5, 0.9), (9.5, 0.9)], 8)
    poly([(-4.5, 2.6), (4.5, 2.6), (4.5, 3.6), (-4.5, 3.6)], 7)            # the tailplane
    poly([(-0.6, -5.5), (0.6, -5.5), (0.9, 2.8), (-0.9, 2.8)], 8)          # the fin
    poly([(-1.8, -1.8), (1.8, -1.8), (1.6, 3.2), (-1.6, 3.2)], 6)          # the body
    poly([(-1.0, -1.6), (0.6, -1.6), (0.4, 0.4), (-1.0, 0.4)], 7)          # its highlight
    poly([(-1.2, -2.2), (1.2, -2.2), (1.0, -1.4), (-1.0, -1.4)], 12)       # the canopy
    return im.resize((24, 16), Image.NEAREST)


def write_sheet():
    sheet = Image.new("P", (128, 128), 0)
    sheet.putpalette(flat(STANDARD))
    for f, deg in enumerate(BANKS):
        n = 64 + f * 3                          # 3x2 cells from sprite 64
        sheet.paste(aircraft(deg), ((n % 16) * 8, (n // 16) * 8))
    sheet.save(os.path.join(CART, "sheet.png"))


def write_logo(pal, idx):
    k = 4
    big = Image.new("P", (44 * k, 44 * k), idx["sky"])
    big.putpalette(flat(pal))
    d = ImageDraw.Draw(big)
    d.rectangle([0, 0, 44 * k, 10 * k], fill=idx["sky top"])
    d.rectangle([0, 26 * k, 44 * k, 30 * k], fill=idx["sky low"])
    # hills, then a valley with its river
    pts = [(0, 30 * k)] + [(x * k, (30 - 5 * math.sin(x / 7.0) - 3 * math.sin(x / 3.1)) * k) for x in range(45)] + [(44 * k, 44 * k), (0, 44 * k)]
    d.polygon(pts, fill=idx["grass"] + 1)
    d.polygon([(0, 36 * k), (44 * k, 33 * k), (44 * k, 44 * k), (0, 44 * k)], fill=idx["meadow"] + 1)
    d.polygon([(14 * k, 44 * k), (24 * k, 36 * k), (27 * k, 36 * k), (22 * k, 44 * k)], fill=idx["water"])
    small = big.resize((44, 44), Image.NEAREST)
    small.putpalette(flat(pal))
    plane = aircraft(15, 4)
    small.paste(plane, (10, 12), mask=Image.eval(plane.convert("L"), lambda v: 255 if v else 0))
    small.save(os.path.join(CART, "logo.png"))


def main():
    first = None
    for cfg in LANDSCAPES:
        pal, idx, heights, col, things, marks = make_landscape(cfg)
        write_landscape(cfg, pal, idx, heights, col, things, marks)
        kinds = {}
        for t in things:
            kinds[t[2]] = kinds.get(t[2], 0) + 1
        print("%-8s heights %d to %d, %d colours, %d scenery %s, landmarks %s" % (
            cfg["name"], min(heights), max(heights), len(pal), len(things),
            dict(sorted(kinds.items())), [(m[0], m[1]) for m in marks]))
        if first is None:
            first = (pal, idx)
    pal, idx = first
    w, h = write_scenery(pal, idx)
    write_sheet()
    write_logo(pal, idx)
    print("scenery.png: %dx%d" % (w, h))


if __name__ == "__main__":
    main()
