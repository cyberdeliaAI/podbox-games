"""Builds Pocket Wings 3D's landscapes and art.

    python3 tools/pocketwings_assets.py

For each landscape <name> it writes into pocketwings/:

    images/<name>_h.png     the heights: one world pixel a pixel, 0 to 255
    images/<name>_c.png     the colours, with the sun's shading baked in
    images/<name>_h2.png    the same landscape at half size, 128 square, for the
    images/<name>_c2.png    quicker levels of the picture: heights halved too
    images/<name>_sky.png   hills on the horizon, a whole turn across
    palettes/<name>.gpl     the palette both pictures are drawn in

and once: sheet.png (the aircraft at five banks) and logo.png.

Every landscape is 256 pixels square and seamless: the Arcade's land.draw
wraps the world, so its left edge meets its right and its top its bottom.
The noise is made periodic by tiling a small random lattice three by three,
scaling it up and cutting out the middle, so it joins wherever it is cut.
Features drawn on top (the river, the lakes, the villages) wrap the same
way. The colour picture carries the shading: each material has a dark, a
middle and a light shade, picked by how the slope faces a sun in the
north-west, which gives the hills their depth for nothing at run time.
"""
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


# ---- periodic noise ------------------------------------------------------------

def lattice(n, seed):
    """Smooth noise from 0 to 1 that repeats every S pixels: an n by n
    random lattice, scaled up bicubically from a 3 by 3 tiling of itself."""
    rnd = random.Random(seed)
    small = Image.new("L", (n, n))
    small.putdata([rnd.randrange(256) for _ in range(n * n)])
    tiled = Image.new("L", (n * 3, n * 3))
    for i in range(3):
        for j in range(3):
            tiled.paste(small, (i * n, j * n))
    big = tiled.resize((S * 3, S * 3), Image.BICUBIC).crop((S, S, S * 2, S * 2))
    return [v / 255.0 for v in big.tobytes()]


def fbm(octaves, seed):
    """Octaves of lattice noise, coarse to fine, as (lattice size, weight)."""
    total = [0.0] * (S * S)
    wsum = 0.0
    for k, (n, w) in enumerate(octaves):
        layer = lattice(n, seed * 31 + k)
        for i in range(S * S):
            total[i] += layer[i] * w
        wsum += w
    lo, hi = min(total), max(total)
    return [(v - lo) / (hi - lo) for v in total]


def wrapd(a, b):
    """The shortest distance from a to b on a circle S around."""
    d = abs(a - b) % S
    return min(d, S - d)


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


# ---- Green Valley --------------------------------------------------------------

VALLEY = {
    # materials with three shades each: dark, middle, light
    "meadow": (0x52963a, 0x78be4c, 0xa0da64),
    "grass":  (0x2c7030, 0x40923a, 0x5cb048),
    "forest": (0x103e22, 0x1a582c, 0x287036),
    "wheat":  (0xa88c32, 0xd6b64c, 0xeed678),
    "plough": (0x5a3c28, 0x7a5436, 0x966c46),
    "rock":   (0x585860, 0x807e84, 0xaaa8ac),
    "sand":   (0xaa9664, 0xceba80, 0xe8d8a4),
}
MATERIALS = ["meadow", "grass", "forest", "wheat", "plough", "rock", "sand"]
# then single colours
SINGLES = [("deep", 0x224e96), ("water", 0x3470be), ("glint", 0x96c8f0),
           ("roof", 0xaa3428), ("wall", 0xe2d6be),
           ("sky top", 0x4678d2), ("sky", 0x6ea0e6), ("sky low", 0xa0c8f0), ("haze", 0xbed6ec),
           ("far hills", 0x7896be), ("far hills lit", 0x8caace)]

WATER = 14          # the water's surface, world pixels


def valley_palette():
    pal = list(STANDARD)
    index = {}
    for m in MATERIALS:
        index[m] = len(pal)
        pal += list(VALLEY[m])
    for name, c in SINGLES:
        index[name] = len(pal)
        pal.append(c)
    return pal, index


def valley_heights():
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
                h[i] = WATER - 4.0
            elif d < 48:
                h[i] = min(h[i], WATER + 1.0 + ((d - 3.5) / 44.0) ** 1.6 * 70.0)
    # two lakes, each in a bowl of its own: an uneven shore, then a gentle
    # rise to meet the land
    for (lx, ly, r) in [(60, 40, 14), (196, 206, 11)]:
        for y in range(S):
            for x in range(S):
                dx = (x - lx + S // 2) % S - S // 2
                dy = (y - ly + S // 2) % S - S // 2
                a = math.atan2(dy, dx)
                re = r * (1.0 + 0.25 * math.sin(3 * a + lx) + 0.12 * math.sin(5 * a + ly))
                d = math.sqrt(dx * dx + dy * dy)
                bowl = WATER - 6.0 + 8.0 * (d / re) ** 2 if d < re else WATER + 2.0 + (d - re) * 1.3
                h[y * S + x] = min(h[y * S + x], bowl)
    return h


def valley():
    pal, idx = valley_palette()
    raw = valley_heights()
    # water lies flat at its surface; the land keeps its shape
    h = [max(v, WATER) for v in raw]
    sl, lit = slopes(h)
    forest = fbm([(8, 1.0), (16, 0.6), (32, 0.3)], 23)
    fields = fbm([(4, 1.0), (8, 0.5)], 37)
    rnd = random.Random(5)
    col = [0] * (S * S)
    for y in range(S):
        for x in range(S):
            i = y * S + x
            if raw[i] <= WATER:
                col[i] = idx["deep"] if raw[i] < WATER - 6 else idx["water"]
                if rnd.random() < 0.015:
                    col[i] = idx["glint"]
                continue
            v, s = h[i], sl[i]
            if v < WATER + 2.5:
                m = "sand"
            elif s > 3.2:
                m = "rock"
            elif forest[i] > 0.6 and v > WATER + 6 and v < 85:
                m = "forest"
            elif s < 1.1 and v < WATER + 30 and fields[i] > 0.42:
                # a patchwork of fields, in parcels a few pixels across
                p = ((x // 7) * 7 + (y // 5) * 13 + (y // 5 % 2) * 3) % 5
                m = ["wheat", "plough", "meadow", "wheat", "grass"][p]
            elif v > 70:
                m = "meadow"
            else:
                m = "grass"
            shade = 0 if lit[i] < 0.62 else (1 if lit[i] < 0.8 else 2)
            col[i] = idx[m] + shade
    # villages: red roofs and pale walls on flat ground by the river
    for (vx, vy) in [(40, 140), (150, 98), (222, 150)]:
        for k in range(14):
            hx = (vx + rnd.randrange(-9, 10)) % S
            hy = (vy + rnd.randrange(-7, 8)) % S
            if raw[hy * S + hx] <= WATER + 1:
                continue
            col[hy * S + hx] = idx["roof"]
            col[hy * S + (hx + 1) % S] = idx["roof"]
            col[((hy + 1) % S) * S + hx] = idx["wall"]
            col[((hy + 1) % S) * S + (hx + 1) % S] = idx["wall"]
    heights = [int(round(v)) for v in h]
    return pal, idx, heights, col


# ---- writing -------------------------------------------------------------------

def write_landscape(name, pal, idx, heights, col):
    os.makedirs(os.path.join(CART, "images"), exist_ok=True)
    os.makedirs(os.path.join(CART, "palettes"), exist_ok=True)
    hi = Image.new("P", (S, S))
    hi.putpalette(flat([(v << 16) | (v << 8) | v for v in range(256)]))
    hi.putdata(heights)
    hi.save(os.path.join(CART, "images", name + "_h.png"))
    ci = Image.new("P", (S, S))
    ci.putpalette(flat(pal))
    ci.putdata(col)
    ci.save(os.path.join(CART, "images", name + "_c.png"))
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
    hi2 = Image.new("P", (H, H))
    hi2.putpalette(flat([(v << 16) | (v << 8) | v for v in range(256)]))
    hi2.putdata(h2)
    hi2.save(os.path.join(CART, "images", name + "_h2.png"))
    ci2 = Image.new("P", (H, H))
    ci2.putpalette(flat(pal))
    ci2.putdata(c2)
    ci2.save(os.path.join(CART, "images", name + "_c2.png"))
    # the hills on the horizon: a silhouette that joins round a whole turn
    sky = Image.new("P", (S, 28), 0)
    sky.putpalette(flat(pal))
    px = sky.load()
    ridge = lattice(16, 91)
    for x in range(S):
        top = 27 - int(6 + 18 * ridge[x * 3 % S + (x // 3) * 0])
        for y in range(top, 28):
            px[x, y] = idx["far hills lit"] if y == top else idx["far hills"]
    sky.save(os.path.join(CART, "images", name + "_sky.png"))
    lines = ["GIMP Palette", "Name: " + name, "Columns: 16", "#"]
    for i, c in enumerate(pal):
        lines.append("%3d %3d %3d\tc%d" % ((c >> 16) & 255, (c >> 8) & 255, c & 255, i))
    with open(os.path.join(CART, "palettes", name + ".gpl"), "w") as f:
        f.write("\n".join(lines) + "\n")
    return idx


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
    pal, idx, heights, col = valley()
    write_landscape("valley", pal, idx, heights, col)
    write_sheet()
    write_logo(pal, idx)
    print("valley: heights %d to %d, %d colours" % (min(heights), max(heights), len(pal)))
    print("palette entries:", ", ".join("%s %d" % (k, v) for k, v in sorted(idx.items(), key=lambda kv: kv[1])))


if __name__ == "__main__":
    main()
