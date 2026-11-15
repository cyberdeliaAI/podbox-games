"""Builds Pocket Golf 3D's courses and art.

    python3 tools/pocketgolf3d_assets.py

Each hole is a landscape of its own, 128 pixels across and 256 long, a
pixel 2.5 yards, the tee near the bottom and the green near the top. It is
made from a short description (par, length, how it bends, its width, its
hazards, its hills) and written as two pictures for land.draw:

    images/c<c>h<n>_h.png   the heights, a quarter of a world pixel a step
    images/c<c>h<n>_c.png   the colours: each surface in three shades, the
                            sun from the north-west baked in, the fairway
                            mown in stripes across, the green in a check

and its data in data/course<c>.json: par, yards, the tee, the pin, the
point a tee shot aims at, the trees (each a place, a kind and a height).
Both pictures are lazy: the game loads one hole at a time.

It also writes the palette (palettes/golf.gpl), the trees and the flag
(images/trees.png), each course's far hills (images/sky<c>.png, for
plane.sky) and the logo. A surface is known from its colour: data/surf.json
gives each palette entry's surface, which the ball's physics reads.

Every hole comes from fixed seeds, so a run makes the same course.
"""
import json
import math
import os
import random

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CART = os.path.join(HERE, "..", "pocketgolf3d")

W, H = 128, 256                    # a hole's map
YARDS = 2.5                        # yards a world pixel
HSCALE = 0.25                      # world pixels a step of height
TILT = 1.2                         # height steps a green rises over its radius
TEE = (64, 240)                    # where every hole's tee is

STANDARD = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
            0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]

# the surfaces, each in three shades (lit, middle, shaded), and what the ball makes of them
FAIRWAY, ROUGH, DEEP, GREEN, FRINGE, TEE_BOX, SAND, WATER = range(1, 9)
SURFACES = [
    # name, surface, light, middle, dark
    ("fairway a", FAIRWAY, 0x7ccf52, 0x5cb43c, 0x3f8a2c),
    ("fairway b", FAIRWAY, 0x6ec148, 0x4ea434, 0x367c26),
    ("rough", ROUGH, 0x4f9a36, 0x3c8029, 0x2b601f),
    ("deep", DEEP, 0x3a6e2a, 0x2a5420, 0x1c3c18),
    ("green a", GREEN, 0x96e070, 0x7cd05a, 0x5aa844),
    ("green b", GREEN, 0x8ad866, 0x70c650, 0x529c3e),
    ("fringe", FRINGE, 0x86d05e, 0x68b84a, 0x4c9238),
    ("tee", TEE_BOX, 0x8ad466, 0x6cbc50, 0x4e963c),
    ("sand", SAND, 0xf4e2a8, 0xe2cc88, 0xbfa468),
    ("water", WATER, 0x5aa6e6, 0x3a80c8, 0x2a5e9c),
]
OTHER = [
    ("sky 0", 0x3e8ed8), ("sky 1", 0x6aacea), ("sky 2", 0xa8d4f4), ("haze", 0xc4e0f2),
    ("hill far", 0x8cb4c8), ("hill near", 0x6a9a8a), ("treeline", 0x2e5a3a), ("treeline light", 0x447a48),
    ("leaf light", 0x5aa040), ("leaf", 0x3c7c2c), ("leaf dark", 0x24521e),
    ("pine light", 0x3e8a50), ("pine", 0x2a6a3c), ("pine dark", 0x184628),
    ("trunk", 0x6a4a2e), ("shadow", 0x14281a), ("flag", 0xe8304a), ("pole", 0xf6f2ea),
    ("ball", 0xffffff), ("ball shade", 0xb8c0c8), ("meter", 0x1c2238), ("meter light", 0x3a4468),
]


def palette():
    pal = list(STANDARD)
    idx = {}
    surf = [0] * 256
    for name, s, a, b, c in SURFACES:
        idx[name] = len(pal)
        for k, col in enumerate((a, b, c)):
            surf[len(pal)] = s
            pal.append(col)
    for name, col in OTHER:
        idx[name] = len(pal)
        pal.append(col)
    return pal, idx, surf


def flat(cols):
    out = []
    for c in cols:
        out += [(c >> 16) & 255, (c >> 8) & 255, c & 255]
    return out + [0] * (768 - len(out))


GREY = flat([(v << 16) | (v << 8) | v for v in range(256)])

# ---- the courses -------------------------------------------------------------------
#
# A hole: par, yards along the middle of the fairway, dog (how far the green
# sits across from the tee, pixels, + right), bend (where along the hole it
# turns, 0 to 1), width (the fairway, pixels), fstart (where the fairway
# begins), green (its radius), pin (the pin from the green's middle),
# rise (the green's height over the tee, in height steps), hills (their
# size), bunkers and ponds ((along, across, size): across in fairway widths,
# + right), creek (along, or None), trees (how thick the woods), seed.

COURSES = [
    ("MEADOW LINKS", [
        dict(par=4, yards=360, dog=0, bend=0.5, width=16, fstart=0.18, green=7.0, pin=(1, -1), rise=6, hills=10,
             bunkers=[(0.62, 1.25, 3.0), (0.93, -1.0, 2.6), (0.96, 1.05, 2.2)], ponds=[], creek=None, trees=0.55, seed=1),
        dict(par=3, yards=165, dog=6, bend=0.5, width=0, fstart=1.0, green=7.0, pin=(-1, 1), rise=2, hills=6,
             bunkers=[(1.08, 0.0, 2.6)], ponds=[(0.74, 0.0, 9.0)], creek=None, trees=0.5, seed=2),
        dict(par=5, yards=505, dog=-30, bend=0.55, width=15, fstart=0.14, green=7.5, pin=(0, -2), rise=10, hills=14,
             bunkers=[(0.45, 1.3, 3.0), (0.74, -1.2, 2.8), (0.95, 1.1, 2.4)], ponds=[], creek=None, trees=0.6, seed=3),
        dict(par=4, yards=385, dog=26, bend=0.5, width=15, fstart=0.18, green=7.0, pin=(2, 0), rise=-4, hills=10,
             bunkers=[(0.55, -1.25, 3.2), (0.94, -1.1, 2.4)], ponds=[], creek=None, trees=0.6, seed=4),
        dict(par=3, yards=190, dog=-4, bend=0.5, width=0, fstart=1.0, green=6.5, pin=(1, 1), rise=22, hills=8,
             bunkers=[(0.96, -1.2, 2.2), (0.96, 1.2, 2.2)], ponds=[], creek=None, trees=0.55, seed=5),
        dict(par=4, yards=410, dog=10, bend=0.5, width=16, fstart=0.18, green=7.0, pin=(-1, -1), rise=0, hills=12,
             bunkers=[(0.93, 1.1, 2.6)], ponds=[], creek=0.66, trees=0.55, seed=6),
        dict(par=4, yards=330, dog=-8, bend=0.5, width=12, fstart=0.2, green=6.5, pin=(0, 1), rise=4, hills=8,
             bunkers=[(0.95, -1.0, 2.2)], ponds=[], creek=None, trees=0.85, seed=7),
        dict(par=5, yards=520, dog=18, bend=0.6, width=16, fstart=0.14, green=7.5, pin=(-2, 0), rise=-2, hills=12,
             bunkers=[(0.5, 1.3, 3.0), (0.96, 1.1, 2.4)], ponds=[(0.72, -1.6, 7.0), (0.84, -1.5, 6.0)], creek=None,
             trees=0.55, seed=8),
        dict(par=4, yards=420, dog=-12, bend=0.5, width=16, fstart=0.18, green=7.5, pin=(1, -2), rise=18, hills=12,
             bunkers=[(0.6, -1.3, 3.0), (0.94, -1.1, 2.4), (0.95, 1.1, 2.4)], ponds=[], creek=None, trees=0.6, seed=9),
    ]),
]


# ---- smooth noise ---------------------------------------------------------------------

def waves(rnd, n=6, lo=18.0, hi=70.0):
    """A sum of n sine waves with random directions, lengths and phases:
    smooth rolling ground."""
    out = []
    for _ in range(n):
        a = rnd.random() * math.pi * 2
        wl = lo + rnd.random() * (hi - lo)
        out.append((math.cos(a) * 2 * math.pi / wl, math.sin(a) * 2 * math.pi / wl, rnd.random() * 6.283,
                    0.5 + rnd.random()))
    return out


def wave_at(ws, x, y):
    return sum(amp * math.sin(kx * x + ky * y + ph) for kx, ky, ph, amp in ws) / len(ws)


# ---- one hole ---------------------------------------------------------------------------

class Hole:
    def __init__(self, d):
        self.d = d
        self.rnd = random.Random(d["seed"] * 101 + 7)
        self.curve()
        self.fields()
        self.surfaces()
        self.heights()
        self.shade_colours()
        self.plant()

    def curve(self):
        """The middle of the hole: a curve from the tee to the green, as
        long as the hole, bending dog pixels across at bend."""
        d = self.d
        L = d["yards"] / YARDS
        tx, ty = TEE
        gy = ty - L
        for _ in range(30):
            pts = []
            for i in range(401):
                t = i / 400.0
                cx, cy = tx, ty - (ty - gy) * d["bend"]
                gx = tx + d["dog"]
                x = (1 - t) ** 2 * tx + 2 * (1 - t) * t * cx + t * t * gx
                y = (1 - t) ** 2 * ty + 2 * (1 - t) * t * cy + t * t * gy
                pts.append((x, y))
            length = sum(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts)))
            gy += length - L
            if abs(length - L) < 0.2:
                break
        self.L = L
        self.pts = pts
        acc = [0.0]
        for i in range(1, len(pts)):
            acc.append(acc[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
        self.acc = acc
        self.green = pts[-1]
        if not (12 <= self.green[1] and 14 <= self.green[0] <= W - 14):
            raise SystemExit("hole %d: the green at %s is off the map" % (d["seed"], self.green))

    def point(self, t):
        """The curve at fraction t of its length, and its direction."""
        t = max(0.0, min(1.0, t))
        target = t * self.acc[-1]
        for i in range(1, len(self.acc)):
            if self.acc[i] >= target:
                a, b = self.pts[i - 1], self.pts[i]
                f = (target - self.acc[i - 1]) / max(1e-6, self.acc[i] - self.acc[i - 1])
                dx, dy = b[0] - a[0], b[1] - a[1]
                n = math.hypot(dx, dy) or 1.0
                return (a[0] + dx * f, a[1] + dy * f), (dx / n, dy / n)
        dx = self.pts[-1][0] - self.pts[-2][0]
        dy = self.pts[-1][1] - self.pts[-2][1]
        n = math.hypot(dx, dy) or 1.0
        return self.pts[-1], (dx / n, dy / n)

    def fields(self):
        """Each pixel's distance from the middle of the hole and how far
        along it that nearest point is (0 at the tee, 1 at the green): the
        nearest of every tenth point on the curve first, then the points
        round that one."""
        pts, acc = self.pts, self.acc
        n = len(pts)
        coarse = list(range(0, n, 10))
        dist = [[0.0] * W for _ in range(H)]
        along = [[0.0] * W for _ in range(H)]
        for y in range(H):
            cy = y + 0.5
            for x in range(W):
                cx = x + 0.5
                bi, bd = 0, 1e9
                for i in coarse:
                    dd = (pts[i][0] - cx) ** 2 + (pts[i][1] - cy) ** 2
                    if dd < bd:
                        bd, bi = dd, i
                for i in range(max(0, bi - 10), min(n, bi + 11)):
                    dd = (pts[i][0] - cx) ** 2 + (pts[i][1] - cy) ** 2
                    if dd < bd:
                        bd, bi = dd, i
                dist[y][x] = math.sqrt(bd)
                along[y][x] = acc[bi] / acc[-1]
        self.dist, self.along = dist, along

    def blob(self, cx, cy, size, seed):
        """Pixels of a rounded, slightly wobbly blob."""
        rnd = random.Random(seed)
        ph = [rnd.random() * 6.283 for _ in range(3)]
        out = []
        for y in range(int(cy - size * 1.6), int(cy + size * 1.6) + 1):
            for x in range(int(cx - size * 1.6), int(cx + size * 1.6) + 1):
                if 0 <= x < W and 0 <= y < H:
                    a = math.atan2(y - cy, x - cx)
                    r = size * (1 + 0.18 * math.sin(2 * a + ph[0]) + 0.12 * math.sin(3 * a + ph[1]))
                    if math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.15) < r:
                        out.append((x, y))
        return out

    def hazard_place(self, along, across, size):
        (px, py), (dx, dy) = self.point(along)
        # across: in fairway half-widths from the middle (+ right of the way the hole runs)
        half = max(self.d["width"], 8) / 2.0
        rx, ry = -dy, dx
        off = across * (half + size)
        return px + rx * off, py + ry * off

    def surfaces(self):
        d = self.d
        kind = [[DEEP] * W for _ in range(H)]
        half = d["width"] / 2.0
        gx, gy = self.green
        self.green_xy = (gx, gy)
        for y in range(H):
            for x in range(W):
                dd = self.dist[y][x]
                t = self.along[y][x]
                k = DEEP
                if dd < half + 13 + 4 * math.sin(y * 0.11 + x * 0.05):
                    k = ROUGH
                if d["width"] and dd < half and d["fstart"] <= t:
                    k = FAIRWAY
                # an apron in front of the green on every hole, par 3s too
                if t > 0.86 and dd < 6.5:
                    k = FAIRWAY
                g = math.hypot(x + 0.5 - gx, (y + 0.5 - gy) * 1.1)
                if g < d["green"] + 1.4:
                    k = FRINGE
                if g < d["green"]:
                    k = GREEN
                if abs(x + 0.5 - TEE[0]) < 4 and -3 < y + 0.5 - TEE[1] < 4:
                    k = TEE_BOX
                # the map's own edge is out of bounds: woods
                if x < 6 or x >= W - 6 or y < 4 or y >= H - 6:
                    k = DEEP
                kind[y][x] = k
        self.sand, self.water = set(), set()
        self.bodies = {}               # each stretch of water: a pond, or a column of the creek
        for i, (al, ac, size) in enumerate(d["bunkers"]):
            cx, cy = self.hazard_place(al, ac, size) if al <= 1.0 else (gx + ac * 6, gy - (al - 1.0) * 60)
            for (x, y) in self.blob(cx, cy, size * 1.3, d["seed"] * 31 + i):
                if kind[y][x] not in (TEE_BOX, GREEN):
                    kind[y][x] = SAND
                    self.sand.add((x, y))
        for i, (al, ac, size) in enumerate(d["ponds"]):
            cx, cy = self.hazard_place(al, ac, size)
            for (x, y) in self.blob(cx, cy, size, d["seed"] * 53 + i):
                if kind[y][x] not in (TEE_BOX, GREEN, FRINGE):
                    kind[y][x] = WATER
                    self.water.add((x, y))
                    self.bodies.setdefault(("pond", i), []).append((x, y))
        if d["creek"] is not None:
            (px, py), _ = self.point(d["creek"])
            for x in range(W):
                cy = py + 3.5 * math.sin(x * 0.09 + d["seed"]) + 2 * math.sin(x * 0.23)
                for y in range(int(cy - 2), int(cy + 2) + 1):
                    if 0 <= y < H and kind[y][x] not in (TEE_BOX, GREEN, FRINGE):
                        kind[y][x] = WATER
                        self.water.add((x, y))
                        self.bodies.setdefault(("creek", x), []).append((x, y))
        self.kind = kind

    def ground(self, x, y):
        """The ground's height at x, y in world pixels, blended from the four
        pixels round it as the cart's course.ground() does."""
        x0, y0 = math.floor(x - 0.5), math.floor(y - 0.5)
        fx, fy = x - 0.5 - x0, y - 0.5 - y0
        h = lambda px, py: self.h[py % H][px % W]
        top = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * fx
        bottom = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * fx
        return (top + (bottom - top) * fy) * HSCALE

    def heights(self):
        d = self.d
        rnd = self.rnd
        big = waves(rnd, 7, 40.0, 110.0)
        small = waves(rnd, 9, 14.0, 34.0)
        hgt = [[0.0] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                base = d["hills"] * (wave_at(big, x, y) + 0.2 * wave_at(small, x, y))
                # the woods rise a little toward the edges, a bowl round the hole
                edge = max(0.0, min(self.dist[y][x], 60.0) - 22) * 0.3
                # the rise from tee to green, along the hole
                rise = d["rise"] * self.along[y][x]
                hgt[y][x] = 40 + base + edge + rise
        # the fairway, the green and the tee are smoothed: gentle to play on
        sm = blur(hgt, 5)
        for y in range(H):
            for x in range(W):
                k = self.kind[y][x]
                f = {FAIRWAY: 0.75, GREEN: 1.0, FRINGE: 0.9, TEE_BOX: 1.0, ROUGH: 0.4, SAND: 0.8}.get(k, 0.0)
                hgt[y][x] = hgt[y][x] * (1 - f) + sm[y][x] * f
        # the green: a plateau with a gentle tilt; the tee flat
        gx, gy = self.green_xy
        gh = sm[int(gy)][int(gx)] + 2
        tilt_a = rnd.random() * math.pi * 2
        # the cart rolls the ball on this slope rather than on the pixels,
        # whose whole steps would make terraces of the green
        self.tilt = (TILT * math.cos(tilt_a) / d["green"] * HSCALE, TILT * math.sin(tilt_a) / d["green"] * HSCALE)
        for y in range(H):
            for x in range(W):
                g = math.hypot(x + 0.5 - gx, (y + 0.5 - gy) * 1.1)
                r = d["green"] + 2.5
                if g < r + 3:
                    w = 1.0 if g < r else (r + 3 - g) / 3.0
                    tilt = TILT * ((x - gx) * math.cos(tilt_a) + (y - gy) * math.sin(tilt_a)) / d["green"]
                    hgt[y][x] = hgt[y][x] * (1 - w) + (gh + tilt) * w
        th = sm[TEE[1]][TEE[0]] + 1.5
        for y in range(TEE[1] - 5, TEE[1] + 6):
            for x in range(TEE[0] - 6, TEE[0] + 7):
                hgt[y][x] = th
        # bunkers dip; a pond lies flat a little below its lowest shore, and a
        # creek the same across its width but following the land along it:
        # flat all the way across a hole it would be a trench where the land
        # rises, with a cliff a ball could stick on
        for (x, y) in self.sand:
            hgt[y][x] -= 2.5
        for pts in self.bodies.values():
            level = min(hgt[y][x] for (x, y) in pts) - 1.0
            for (x, y) in pts:
                hgt[y][x] = level
        self.hf = hgt
        self.h = [[max(0, min(255, int(round(v)))) for v in row] for row in hgt]

    def shade_colours(self):
        """Each pixel's colour: its surface, mown in stripes, lit by the sun
        from the north-west by the slope there."""
        names = {FAIRWAY: "fairway", ROUGH: "rough", DEEP: "deep", GREEN: "green", FRINGE: "fringe",
                 TEE_BOX: "tee", SAND: "sand", WATER: "water"}
        self.names = names
        self.shade = [[1] * W for _ in range(H)]
        h = self.hf
        for y in range(H):
            for x in range(W):
                hx = h[y][min(W - 1, x + 1)] - h[y][max(0, x - 1)]
                hy = h[min(H - 1, y + 1)][x] - h[max(0, y - 1)][x]
                # facing the sun (north-west: x and y smaller) is lit
                light = -(hx + hy) * HSCALE * 1.3
                self.shade[y][x] = 0 if light > 0.25 else 2 if light < -0.25 else 1

    def colour(self, idx, x, y):
        k = self.kind[y][x]
        s = self.shade[y][x]
        if k == FAIRWAY:
            stripe = int(self.along[y][x] * self.L / 5) % 2
            return idx["fairway a" if stripe == 0 else "fairway b"] + s
        if k == GREEN:
            check = ((x // 2) + (y // 2)) % 2
            return idx["green a" if check == 0 else "green b"] + s
        if k == WATER:
            near = any(0 <= y + dy < H and 0 <= x + dx < W and self.kind[y + dy][x + dx] != WATER
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            return idx["water"] + (0 if near else 1 if (x * 3 + y * 7) % 11 else 0)
        return idx[self.names[k]] + s

    def plant(self):
        """Trees: thick in the woods, a few at the rough's edge, never on
        the tee, the green or in a hazard. Each a place, a kind (0 broad,
        1 pine) and a height in world pixels."""
        d = self.d
        rnd = random.Random(d["seed"] * 977)
        trees = []
        for _ in range(int(2600 * d["trees"])):
            x = rnd.uniform(3, W - 3)
            y = rnd.uniform(2, H - 3)
            k = self.kind[int(y)][int(x)]
            if k == DEEP:
                gap = 4.2
            elif k == ROUGH and self.dist[int(y)][int(x)] > d["width"] / 2.0 + 6 and rnd.random() < 0.08:
                gap = 6.0
            else:
                continue
            # keep clear of the green and the tee
            if math.hypot(x - self.green_xy[0], y - self.green_xy[1]) < d["green"] + 6:
                continue
            if math.hypot(x - TEE[0], y - TEE[1]) < 9:
                continue
            if all((x - tx) ** 2 + (y - ty) ** 2 > gap * gap for tx, ty, _, _ in trees):
                kind = 1 if rnd.random() < 0.4 else 0
                trees.append((x, y, kind, rnd.uniform(5.5, 8.5) if kind == 0 else rnd.uniform(7.0, 10.5)))
            if len(trees) >= 150:
                break
        self.trees = trees


def blur(a, r):
    """A box blur of radius r, rows then columns."""
    h, w = len(a), len(a[0])
    tmp = [[0.0] * w for _ in range(h)]
    for y in range(h):
        row = a[y]
        acc = sum(row[0:r + 1]) + row[0] * r
        for x in range(w):
            tmp[y][x] = acc / (2 * r + 1)
            acc += row[min(w - 1, x + r + 1)] - row[max(0, x - r)]
    out = [[0.0] * w for _ in range(h)]
    for x in range(w):
        acc = sum(tmp[y][x] for y in range(0, r + 1)) + tmp[0][x] * r
        for y in range(h):
            out[y][x] = acc / (2 * r + 1)
            acc += tmp[min(h - 1, y + r + 1)][x] - tmp[max(0, y - r)][x]
    return out


# ---- the rest of the art ------------------------------------------------------------------

def trees_image(pal, idx):
    """images/trees.png, 64x32: a broadleaf (0, 0, 20x24) and a pine (24, 0,
    16x28), lit from the left; the flag (44, 0, 8x12)."""
    im = Image.new("P", (64, 32), 0)
    im.putpalette(flat(pal))
    px = im.load()
    for y in range(24):
        for x in range(20):
            cx, cy = 9.5, 9.0
            d = ((x - cx) / 9.5) ** 2 + ((y - cy) / 9.0) ** 2
            if y >= 17 and 8 <= x <= 11:
                px[x, y] = idx["trunk"]
            if d < 1.0 and y < 19:
                lit = (x - 6) ** 2 + (y - 5) ** 2 < 20
                bump = (x * 7 + y * 3) % 5 == 0
                px[x, y] = idx["leaf light"] if lit else idx["leaf dark"] if (d > 0.7 and x > cx) or bump else idx["leaf"]
    for y in range(28):
        for x in range(16):
            cx = 7.5
            if y >= 24 and 7 <= x <= 8:
                px[24 + x, y] = idx["trunk"]
            if y < 25:
                half = 1 + y * 0.28 + (2 if y % 6 >= 4 else 0) * (y / 28.0)
                if abs(x - cx) < half:
                    px[24 + x, y] = idx["pine light"] if x < cx - half * 0.3 else idx["pine dark"] if x > cx + half * 0.4 else idx["pine"]
    for y in range(12):
        px[44, y] = idx["pole"]
        if y < 4:
            for x in range(1, 7 - y // 2):
                px[44 + x, y] = idx["flag"]
    im.save(os.path.join(CART, "images", "trees.png"))


def sky_image(pal, idx, seed):
    """The far hills and a tree line, a whole turn across (256), for plane.sky."""
    rnd = random.Random(seed)
    im = Image.new("P", (256, 32), 0)
    im.putpalette(flat(pal))
    px = im.load()
    far = waves(rnd, 4, 40.0, 128.0)
    near = waves(rnd, 5, 10.0, 40.0)
    for x in range(256):
        hf = 18 + 8 * wave_at([(kx * 2, 0, ph, a) for kx, ky, ph, a in far], x, 0)
        hn = 8 + 4 * wave_at([(kx * 2, 0, ph, a) for kx, ky, ph, a in near], x, 0)
        for y in range(32):
            up = 31 - y
            if up < hn:
                px[x, y] = idx["treeline light"] if up > hn - 2 else idx["treeline"]
            elif up < hf:
                px[x, y] = idx["hill near"] if up < hf - 6 else idx["hill far"]
    # make the two ends meet
    im.save(os.path.join(CART, "images", "sky%d.png" % seed))


def logo(pal, idx):
    im = Image.new("P", (44, 44), idx["sky 1"])
    im.putpalette(flat(pal))
    px = im.load()
    for y in range(44):
        for x in range(44):
            if y > 22:
                # a fairway running away to a green
                w = 4 + (y - 22) * 0.9
                c = idx["rough"] + 1
                if abs(x - 22) < w:
                    c = idx["fairway a" if ((y - 22) // 4) % 2 else "fairway b"] + 1
                px[x, y] = c
            elif y > 19:
                px[x, y] = idx["treeline"]
    for y in range(20, 25):
        for x in range(18, 27):
            if ((x - 22) / 4.5) ** 2 + ((y - 22.5) / 2.2) ** 2 < 1:
                px[x, y] = idx["green a"] + 1
    for y in range(9, 23):
        px[22, y] = idx["pole"]
    for y in range(9, 14):
        for x in range(23, 30 - (y - 9)):
            px[x, y] = idx["flag"]
    for (x, y) in [(29, 37), (30, 37), (29, 38), (30, 38), (28, 37), (31, 38), (29, 36), (30, 39)]:
        px[x, y] = idx["ball"]
    im.save(os.path.join(CART, "logo.png"))


# ---- writing -----------------------------------------------------------------------------

# palette entries the cart's code names: keep these in step with view.js and hud.js
FIXED = {"sky 0": 46, "haze": 49, "shadow": 61, "flag": 62, "pole": 63, "ball": 64, "meter": 66}


def pack_trees(hole):
    """The trees, two whole numbers each, as the cart's course.setup() reads
    them: x and y in 64ths of a pixel (x + y * 8192); the height of the
    ground under it and its own height in 64ths, and its kind (z + h * 4096
    + kind * 4194304). Five numbers a tree took more memory to read than
    the cart has to spare."""
    out = []
    for (x, y, k, h) in hole.trees:
        xi, yi = int(round(x * 64)), int(round(y * 64))
        z = hole.ground(xi / 64.0, yi / 64.0)
        zi, hi = int(round(z * 64)), int(round(h * 64))
        assert 0 <= xi < 8192 and 0 <= yi < 16384 and 0 <= zi < 4096 and 0 <= hi < 1024 and k in (0, 1)
        out += [xi + yi * 8192, zi + hi * 4096 + k * 4194304]
    return out


def main():
    pal, idx, surf = palette()
    for name, n in FIXED.items():
        if idx[name] != n:
            raise SystemExit("palette: %s is %d, the code says %d" % (name, idx[name], n))
    for sub in ("images", "palettes", "data"):
        os.makedirs(os.path.join(CART, sub), exist_ok=True)
    lines = ["GIMP Palette", "Name: golf", "Columns: 16", "#"]
    lines += ["%3d %3d %3d\tc%d" % ((c >> 16) & 255, (c >> 8) & 255, c & 255, i) for i, c in enumerate(pal)]
    with open(os.path.join(CART, "palettes", "golf.gpl"), "w") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(CART, "data", "surf.json"), "w") as f:
        json.dump({"surf": surf}, f, separators=(",", ":"))
    lazy = []
    for c, (cname, holes) in enumerate(COURSES, start=1):
        out = {"name": cname, "holes": []}
        for n, d in enumerate(holes, start=1):
            hole = Hole(d)
            name = "c%dh%d" % (c, n)
            hi = Image.new("P", (W, H))
            hi.putpalette(GREY)
            hi.putdata([v for row in hole.h for v in row])
            hi.save(os.path.join(CART, "images", name + "_h.png"), optimize=True)
            ci = Image.new("P", (W, H))
            ci.putpalette(flat(pal))
            ci.putdata([hole.colour(idx, x, y) for y in range(H) for x in range(W)])
            ci.save(os.path.join(CART, "images", name + "_c.png"), optimize=True)
            lazy += [name + "_h", name + "_c"]
            gx, gy = hole.green_xy
            px, py = gx + d["pin"][0], gy + d["pin"][1]
            # a tee shot aims at the landing zone on the curve; a par 3 at the pin
            (ax, ay), _ = hole.point(min(0.62, 240.0 / d["yards"]) if d["par"] > 3 else 1.0)
            if d["par"] == 3:
                ax, ay = px, py
            out["holes"].append({
                "par": d["par"], "yards": int(round(hole.L * YARDS)),
                "tee": [TEE[0] + 0.5, TEE[1] + 0.5], "pin": [round(px, 2), round(py, 2)],
                "aim": [round(ax, 2), round(ay, 2)], "green": [round(gx, 2), round(gy, 2), d["green"]],
                "tilt": [round(hole.tilt[0], 4), round(hole.tilt[1], 4)],
                "trees": pack_trees(hole),
            })
            print("%s %-12s par %d %3d yds, %3d trees" % (name, cname if n == 1 else "", d["par"],
                                                        int(round(hole.L * YARDS)), len(hole.trees)))
        with open(os.path.join(CART, "data", "course%d.json" % c), "w") as f:
            json.dump(out, f, separators=(",", ":"))
        sky_image(pal, idx, c)
    trees_image(pal, idx)
    logo(pal, idx)
    with open(os.path.join(CART, "data", "lazy.json"), "w") as f:
        json.dump(lazy, f)
    print("%d colours; lazy pictures: %d" % (len(pal), len(lazy)))
    print("palette entries:", {k: idx[k] for k in ("fairway a", "rough", "green a", "sand", "water", "sky 0", "sky 1",
                                                     "sky 2", "haze", "shadow", "flag", "pole", "ball", "ball shade",
                                                     "meter", "meter light")})


if __name__ == "__main__":
    main()
