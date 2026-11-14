"""Builds Powder Run 3D's slopes and art.

    python3 tools/powderrun_assets.py

For each slope <name> it writes into powderrun/:

    images/<name>_h.png     the snow's relief: one world pixel a pixel, 0 to 255
    images/<name>_c.png     its colours, with the sun's shading baked in
    images/<name>_h2.png    the same at half size, 128 square, heights halved,
    images/<name>_c2.png    for the quicker levels of the picture
    images/<name>_sky.png   the sky and the mountains round it, a whole turn
                            across, with no clear pixel so it is copied whole
    palettes/<name>.gpl     the palette they are drawn in

    data/<name>_objects.json   its pines and boulders: x, y and kind (0 small
                            pine, 1 large, 2 boulder)

and once: sheet.png (the skier in nine poses; pines and boulders, each
three times, from near to far in the haze) and logo.png.

The relief is only the bumps, rollers and hollows of the snow: the
mountainside's own slope isn't in the picture, because land.draw wraps the
world and no wrapping picture can go downhill for ever. The game adds the
slope itself, in how fast the skier goes and in where it puts the horizon.

The relief repeats every 256 pixels both ways, seamlessly: its noise is a
small random lattice tiled three by three, scaled up and cut from the
middle. The rollers run across the fall line, which crosses the picture
three across for every eight down, so they repeat with it too.
"""
import json
import math
import os
import random

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CART = os.path.join(HERE, "..", "powderrun")
S = 256

STANDARD = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
            0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]

# The fall line: three across for every eight down (as the game has it)
FALL_X, FALL_Y = 3, 8


def flat(colours):
    out = []
    for c in colours:
        out += [(c >> 16) & 255, (c >> 8) & 255, c & 255]
    return out + [0] * (768 - len(out))


# ---- periodic noise ------------------------------------------------------------

def lattice(n, seed, w=S, h=S):
    """Smooth noise from 0 to 1 that repeats every w by h pixels."""
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
    total = [0.0] * (S * S)
    for k, (n, w) in enumerate(octaves):
        layer = lattice(n, seed * 31 + k)
        for i in range(S * S):
            total[i] += layer[i] * w
    lo, hi = min(total), max(total)
    return [(v - lo) / (hi - lo) for v in total]


def smooth(a, b, v):
    t = min(1.0, max(0.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)


def light(h, soft=0.45):
    """Each pixel's slope and its light from a sun in the north-west, 0 to 1.
    soft flattens the slopes for the light only: snow scatters light, so
    its shading is gentler than its shape."""
    sl, lit = [0.0] * (S * S), [0.0] * (S * S)
    lx, ly, lz = -0.6, -0.45, 0.66
    for y in range(S):
        for x in range(S):
            dx = (h[y * S + (x + 1) % S] - h[y * S + (x - 1) % S]) / 2.0
            dy = (h[((y + 1) % S) * S + x] - h[((y - 1) % S) * S + x]) / 2.0
            sl[y * S + x] = math.sqrt(dx * dx + dy * dy)
            dx *= soft
            dy *= soft
            n = math.sqrt(dx * dx + dy * dy + 1.0)
            lit[y * S + x] = max(0.0, (-dx * lx - dy * ly + lz) / n)
    return sl, lit


# ---- the five slopes -----------------------------------------------------------

# Each slope's colours, in the same order and number so the palette entries
# are the same on every slope (the game and the objects' picture rely on
# it): snow from deep shadow to sunlit, ice, rock, the sky from the top
# down to the haze, the mountains (far, its snow, near, its snow, its
# shade), the pines (dark, middle and light green, the trunk, snow on the
# boughs and its shade) and the boulders (dark, middle and light rock, the
# snow on top).
#
# relief: the broad swells' height, the rollers' (ridges straight across
# the fall line, in places) and the moguls' (small bumps close together, in
# other places), and where each shows. rock: how steep a pixel must be to
# show rock. ice: how far above the lowest snow the ice in the hollows
# reaches. groves, lone: pines in clumps and lone pines and boulders; stone:
# the share of lone ones that are boulders. far, near: the mountain
# ranges' foot and height in the sky strip.
SLOPES = [
    dict(name="alpine", seed=7,
         snow=[0x8e9ccc, 0xb2c0e2, 0xd2dcf0, 0xeaeffa, 0xffffff],
         ice=[0x9cc4e0, 0xc4e0f4],
         rock=[0x4a4652, 0x6e6a78, 0x9894a4],
         sky=[0x3c6cc8, 0x5c8edc, 0x8cb4ec, 0xc8dcf4],
         mountains=[0x7c8cb8, 0xd8e0f0, 0x56648e, 0xb4c0dc, 0x3e4a70],
         pine=[0x1c4a34, 0x2c6a44, 0x4a8a5a, 0x5a3c2c, 0xffffff, 0xc4d0ea],
         boulder=[0x4a4652, 0x6e6a78, 0x9894a4, 0xf4f6fc],
         relief=(34.0, 7.0, (0.55, 0.75), 5.0, (0.6, 0.8)), rock_at=2.4, ice_at=2.5,
         groves=14, lone=18, stone=0.5, far=(8, 20), near=(4, 13)),
    dict(name="forest", seed=17,
         snow=[0x8a96b4, 0xaab6d0, 0xc8d2e4, 0xe2e8f2, 0xf6f8fc],
         ice=[0xa0bcd4, 0xc8dcec],
         rock=[0x4c4a50, 0x6c6a72, 0x94929a],
         sky=[0x5a6a8c, 0x7888a6, 0x9eacc2, 0xccd4e2],
         mountains=[0x6a7890, 0xc4ccda, 0x34483e, 0x8a9c96, 0x22322c],
         pine=[0x143628, 0x22523a, 0x3a6e4c, 0x4a3226, 0xfafcff, 0xc0cadc],
         boulder=[0x4c4a50, 0x6c6a72, 0x94929a, 0xf2f4f8],
         relief=(24.0, 4.0, (0.5, 0.7), 2.5, (0.65, 0.85)), rock_at=2.8, ice_at=1.5,
         groves=24, lone=10, stone=0.3, far=(6, 14), near=(8, 9)),
    dict(name="high", seed=27,
         snow=[0x7484bc, 0xa0b0dc, 0xc8d4f0, 0xe8eefc, 0xffffff],
         ice=[0x90b8e4, 0xbcdcf6],
         rock=[0x3a3440, 0x5c5664, 0x8a8494],
         sky=[0x1c3c9c, 0x3460c0, 0x6a94dc, 0xb8d0f0],
         mountains=[0x6a78a8, 0xf0f4fc, 0x4a5684, 0xc8d4ec, 0x323c64],
         pine=[0x1a4434, 0x2a6044, 0x467c58, 0x5a3c2c, 0xffffff, 0xc0cce8],
         boulder=[0x3a3440, 0x5c5664, 0x8a8494, 0xf4f6fc],
         relief=(46.0, 9.0, (0.5, 0.7), 6.0, (0.55, 0.75)), rock_at=2.2, ice_at=2.0,
         groves=6, lone=34, stone=0.85, far=(10, 30), near=(4, 20)),
    dict(name="sunset", seed=37,
         snow=[0x8a7aac, 0xb49cc0, 0xdcbcc8, 0xf4d8cc, 0xfff0e0],
         ice=[0xa8a8d8, 0xd0c8ec],
         rock=[0x4a3a4a, 0x6e5868, 0x9a8090],
         sky=[0x4a3a8a, 0x9a5a9a, 0xe88a7a, 0xf8c89a],
         mountains=[0x8a6a9a, 0xf0c0b0, 0x5a4472, 0xc890a0, 0x3a2c52],
         pine=[0x2a3a3c, 0x3a5244, 0x5a6a50, 0x4a3028, 0xffe8d8, 0xc8a8c0],
         boulder=[0x4a3a4a, 0x6e5868, 0x9a8090, 0xfff0e0],
         relief=(32.0, 9.0, (0.45, 0.65), 4.0, (0.65, 0.85)), rock_at=2.4, ice_at=2.0,
         groves=12, lone=16, stone=0.5, far=(8, 18), near=(4, 12), sun=(176, 30, 6)),
    dict(name="frozen", seed=47,
         snow=[0x86a0c4, 0xa8c0dc, 0xc8dcee, 0xe4f0fa, 0xfafdff],
         ice=[0x7ab8dc, 0xa8d8f0],
         rock=[0x50607a, 0x74849c, 0x9aa8bc],
         sky=[0x8aa8c8, 0xa8c0d8, 0xc8d8e8, 0xe4eef6],
         mountains=[0x9ab0c8, 0xe8f0f8, 0x6c849e, 0xc0d0e0, 0x4a6080],
         pine=[0x2a4a4a, 0x3a6060, 0x5a8080, 0x4a3a34, 0xffffff, 0xc8dcec],
         boulder=[0x50607a, 0x74849c, 0x9aa8bc, 0xf4faff],
         relief=(28.0, 5.0, (0.6, 0.8), 3.0, (0.6, 0.8)), rock_at=2.6, ice_at=7.0,
         groves=6, lone=16, stone=0.7, far=(6, 16), near=(3, 10)),
]
# how far toward the haze each of an object's three looks goes: near, middle
# distance, far. The size picked for the distance brings the look with it,
# which fades a tree into the haze for nothing.
HAZES = [0.0, 0.45, 0.75]


def blend(c, to, t):
    out = 0
    for sh in (16, 8, 0):
        a, b = (c >> sh) & 255, (to >> sh) & 255
        out |= int(round(a + (b - a) * t)) << sh
    return out


def palette(cfg):
    pal = list(STANDARD)
    idx = {}
    for name in ("snow", "ice", "rock", "sky", "mountains"):
        idx[name] = len(pal)
        pal += cfg[name]
    for name in ("pine", "boulder"):
        idx[name] = len(pal)
        for t in HAZES:
            pal += [blend(c, cfg["sky"][3], t) for c in cfg[name]]
    return pal, idx


def relief(cfg):
    sd = cfg["seed"]
    swell, roll, roll_at, mog, mog_at = cfg["relief"]
    base = fbm([(4, 1.0), (8, 0.5), (16, 0.18)], sd)
    rollers_at = fbm([(4, 1.0), (8, 0.5)], sd + 1)
    moguls_at = fbm([(8, 1.0), (16, 0.5)], sd + 2)
    moguls = fbm([(32, 1.0), (64, 0.4)], sd + 3)
    h = [0.0] * (S * S)
    for y in range(S):
        for x in range(S):
            i = y * S + x
            v = base[i] * swell
            # rollers: ridges straight across the fall line, in places
            p = (FALL_X * x + FALL_Y * y) % S
            wave = 0.5 + 0.5 * math.sin(2 * math.pi * p / S)
            v += roll * wave * wave * smooth(roll_at[0], roll_at[1], rollers_at[i])
            # moguls: small bumps close together, in other places
            v += mog * moguls[i] * smooth(mog_at[0], mog_at[1], moguls_at[i])
            h[i] = v
    return h


def make_slope(cfg):
    pal, idx = palette(cfg)
    h = relief(cfg)
    sl, lit = light(h)
    rnd = random.Random(cfg["seed"] + 4)
    col = [0] * (S * S)
    low = min(h)
    for i in range(S * S):
        if sl[i] > cfg["rock_at"]:
            shade = 0 if lit[i] < 0.6 else (1 if lit[i] < 0.85 else 2)
            col[i] = idx["rock"] + shade
            continue
        if h[i] < low + cfg["ice_at"] and sl[i] < 0.4:
            col[i] = idx["ice"] + (1 if lit[i] > 0.7 else 0)
            continue
        # five shades of snow by the light, and a fine grain to see speed by
        # flat snow (lit 0.66) is the second lightest; only slopes turned
        # from the sun go blue
        shade = 0 if lit[i] < 0.4 else 1 if lit[i] < 0.52 else 2 if lit[i] < 0.6 else 3 if lit[i] < 0.74 else 4
        r = rnd.random()
        if r < 0.03:
            shade = max(0, shade - 1)
        elif r < 0.05:
            shade = min(4, shade + 1)
        col[i] = idx["snow"] + shade
    heights = [int(round(v - low)) for v in h]
    objs = place_objects(h, sl, col, idx, cfg["seed"] + 14, cfg["groves"], cfg["lone"], cfg["stone"])
    return pal, idx, heights, col, objs


# ---- trees and rocks on the slope ----------------------------------------------

SMALL, LARGE, STONE = 0, 1, 2      # the kinds, as the game numbers them
START = (40, 40)                   # where a run starts: kept clear
GROVES = 14                        # clumps of pines
GROVE_GAP = 44                     # the least room between two groves' middles
TREE_GAP = 5                       # the least room between two pines of a grove
LONE = 18                          # lone pines and boulders out in the open
LONE_GAP = 20                      # ...and the least room round each


def wrapd(a, b):
    d = (a - b) % S
    return min(d, S - d)


def place_objects(h, sl, col, idx, seed, groves=GROVES, lone=LONE, stone_share=0.5):
    """Pines in groves of three to seven with open snow between them, and
    a few lone pines and boulders, boulders more on the steeper pitches.
    None on the ice, none near the start. Each casts a small shadow on the
    snow, to the south-east."""
    rnd = random.Random(seed)
    objs = []

    fx, fy = 3 / math.hypot(3, 8), 8 / math.hypot(3, 8)

    def free(x, y, gap):
        i = y * S + x
        if col[i] in (idx["ice"], idx["ice"] + 1):
            return False
        if wrapd(x, START[0]) < 26 and wrapd(y, START[1]) < 26:
            return False
        # a clear run from the start, down the fall line either way (a
        # seed turns it round)
        dx, dy = (x - START[0] + 128) % S - 128, (y - START[1] + 128) % S - 128
        along, across = dx * fx + dy * fy, dx * fy - dy * fx
        if -150 < along < 150 and abs(across) < 16:
            return False
        return all(wrapd(x, ox) ** 2 + wrapd(y, oy) ** 2 >= gap * gap for ox, oy, _ in objs)

    centres = []
    tries = 0
    while len(centres) < groves and tries < 5000:
        tries += 1
        x, y = rnd.randrange(S), rnd.randrange(S)
        if wrapd(x, START[0]) < 40 and wrapd(y, START[1]) < 40:
            continue
        if any(wrapd(x, cx) ** 2 + wrapd(y, cy) ** 2 < GROVE_GAP ** 2 for cx, cy in centres):
            continue
        centres.append((x, y))
    for cx, cy in centres:
        want = rnd.randrange(3, 8)
        r = 5 + want * 1.6
        got = 0
        for _ in range(200):
            if got == want:
                break
            a = rnd.random() * 2 * math.pi
            d = r * math.sqrt(rnd.random())
            x, y = int(cx + math.cos(a) * d) % S, int(cy + math.sin(a) * d) % S
            if not free(x, y, TREE_GAP):
                continue
            objs.append((x, y, LARGE if rnd.random() < 0.45 else SMALL))
            got += 1
    placed = 0
    for _ in range(5000):
        if placed == lone:
            break
        x, y = rnd.randrange(S), rnd.randrange(S)
        if not free(x, y, LONE_GAP):
            continue
        stone = sl[y * S + x] > 1.0 or rnd.random() < stone_share
        objs.append((x, y, STONE if stone else SMALL))
        placed += 1
    for x, y, kind in objs:
        for dx, dy in ((1, 1), (2, 1), (1, 2)) if kind != STONE else ((-1, 1), (0, 1), (1, 1)):
            col[((y + dy) % S) * S + (x + dx) % S] = idx["snow"] + (1 if kind != STONE else 0)
    return objs


def pine(w, h, look, idx):
    """A snowy pine w by h, in look 0 (near) to 2 (far, in the haze): tiers
    of boughs widening down, lit from the left, snow on their tops, a trunk."""
    im = Image.new("P", (w, h), 0)
    px = im.load()
    base = idx["pine"] + look * 6
    dark, mid, light, trunk, snow, snowshade = [base + i for i in range(6)]
    cx = (w - 1) / 2.0
    tiers = max(3, min(6, h // 9))
    body = h - 3
    for t in range(tiers):
        top = int(t * body / (tiers + 0.6))
        bottom = int((t + 1.6) * body / (tiers + 0.6))
        for y in range(top, min(bottom, body)):
            f = (y - top) / max(1.0, bottom - top - 1.0)
            half = (0.6 + t * 0.55 + f * (1.1 + t * 0.35)) * w / 8.0
            for x in range(w):
                d = x - cx
                if abs(d) <= half:
                    edge = y == top or (abs(d) > half - 1.0 and f < 0.35)
                    if edge and d < 0.5:
                        px[x, y] = snow
                    elif edge:
                        px[x, y] = snowshade
                    else:
                        px[x, y] = light if d < -half * 0.35 else mid if d < half * 0.4 else dark
    for y in range(body, h):
        for x in range(int(cx), int(cx) + 2 if w > 8 else int(cx) + 1):
            px[x, y] = trunk
    return im


def boulder(w, h, look, idx):
    """A boulder w by h, snow on its top."""
    im = Image.new("P", (w, h), 0)
    px = im.load()
    base = idx["boulder"] + look * 4
    cx, cy = (w - 1) / 2.0, h * 0.7
    for y in range(h):
        for x in range(w):
            dx, dy = (x - cx) / (w / 2.0), (y - cy) / (h * 0.65)
            if dx * dx + dy * dy <= 1.0:
                if dy < -0.45 + abs(dx) * 0.25:
                    px[x, y] = base + 3
                else:
                    px[x, y] = base + (2 if dx < -0.3 else 1 if dx < 0.35 else 0)
    return im


# ---- the objects' picture ------------------------------------------------------

# Billboards cost the iPod about five units a pixel, where a plain copy out
# of a picture costs about 0.3. So the game draws pines and boulders itself,
# copied out of images/objects.png, which holds each kind at a run of sizes on the
# screen; the game takes the size nearest what the distance asks for. The
# look (how far into the haze) goes with the size, as the size goes with
# the distance. One picture serves every slope: each slope's palette has
# its own colours at the same entries.
OBJ_TALL = [8.0, 12.0, 4.0]        # world pixels tall, as objects.js has them
OBJ_SIZES = [[4, 5, 6, 8, 10, 13, 16, 20, 25, 32, 40, 50],    # small pines, pixels tall
             [5, 6, 8, 10, 13, 16, 20, 25, 32, 40, 50, 64],   # large pines
             [2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 25]]          # boulders
FOCAL = 96.7                       # as view.js has it
LUT = 128                          # the game looks sizes up by height, 0 to 127


def obj_look(kind, h):
    d = OBJ_TALL[kind] * FOCAL / h
    return 0 if d < 70 else 1 if d < 100 else 2


def obj_image(kind, h, idx):
    look = obj_look(kind, h)
    if kind == SMALL:
        return pine(max(3, (h * 2 + 2) // 5), h, look, idx)
    if kind == LARGE:
        return pine(max(4, (h + 1) // 2), h, look, idx)
    return boulder(max(4, h * 2), h, look, idx)


def write_atlas(pal, idx):
    """objects.png, every kind at every size, packed in shelves; and
    data/objects.json: where each is, and for each kind and height on the
    screen the size to draw (255: too small to draw)."""
    ims = [(k, j, obj_image(k, h, idx)) for k in range(3) for j, h in enumerate(OBJ_SIZES[k])]
    order = sorted(range(len(ims)), key=lambda i: -ims[i][2].size[1])
    W = 128
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
    for i, (k, j, im) in enumerate(ims):
        atlas.paste(im, at[i])
    atlas.save(os.path.join(CART, "images", "objects.png"))
    first, lut = [], []
    n = 0
    for k in range(3):
        first.append(n)
        sizes = OBJ_SIZES[k]
        for want in range(LUT):
            if want < sizes[0] - 1:
                lut.append(255)
                continue
            best = min(range(len(sizes)), key=lambda j: abs(math.log(sizes[j]) - math.log(max(want, 1))))
            lut.append(n + best)
        n += len(sizes)
    out = {"x": [at[i][0] for i in range(len(ims))], "y": [at[i][1] for i in range(len(ims))],
           "w": [im.size[0] for _, _, im in ims], "h": [im.size[1] for _, _, im in ims],
           "lut": lut}
    with open(os.path.join(CART, "data", "objects.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    return W, H


def write_objects(name, objs):
    os.makedirs(os.path.join(CART, "data"), exist_ok=True)
    with open(os.path.join(CART, "data", name + "_objects.json"), "w") as f:
        json.dump({"x": [o[0] for o in objs], "y": [o[1] for o in objs], "k": [o[2] for o in objs]},
                  f, separators=(",", ":"))


def sky_strip(pal, idx, cfg):
    """256 by 64: the sky in bands down to the haze, the far range across
    the valley with snow on its tops and its foot in the haze, then the
    near range darker, its foot at the bottom. The game puts the bottom row
    a little below the level horizon, where the mountains' feet are, down
    in the valley."""
    W, H = S, 64
    im = Image.new("P", (W, H))
    im.putpalette(flat(pal))
    px = im.load()
    sky = idx["sky"]
    for y in range(H):
        band = 0 if y < 24 else 1 if y < 34 else 2 if y < 44 else 3
        for x in range(W):
            px[x, y] = sky + band
    m = idx["mountains"]

    def ridge(n, s, lo, span):
        # peaks: noise folded about its middle, so its highs come to points,
        # with a finer layer folded the same way for the shoulders and spurs
        def stretched(m, sd):
            u = lattice(m, sd, W, 1)
            a, b = min(u), max(u)
            return [(t - a) / (b - a) for t in u]

        v = stretched(n, s)
        f = stretched(n * 4, s + 7)
        out = []
        for x in range(W):
            a = 1.0 - abs(2.0 * v[x] - 1.0)
            b = 1.0 - abs(2.0 * f[x] - 1.0)
            out.append(int(lo + (a ** 1.5 * 0.85 + b * 0.15) * span))
        return out

    seed = cfg["seed"] + 34
    if "sun" in cfg:
        # a low sun, half behind the far range
        sx, sy, r = cfg["sun"]
        for y in range(H):
            for x in range(W):
                if (x - sx) ** 2 + (y - sy) ** 2 <= r * r:
                    px[x, y] = 15
    far = ridge(14, seed, *cfg["far"])
    near = ridge(10, seed + 1, *cfg["near"])
    for x in range(W):
        top = H - 8 - far[x]
        for y in range(max(0, top), H - 4):
            px[x, y] = m + (1 if y < top + 2 + far[x] // 6 else 0)
    for x in range(W):
        top = H - 1 - near[x]
        # the face toward the sun is light, the other in shade, judged a
        # few pixels either side so the faces come out whole
        lit = near[(x + 3) % W] <= near[(x - 3) % W]
        for y in range(max(0, top), H):
            snowy = y < top + 2 + near[x] // 6
            px[x, y] = m + (3 if snowy else 2 if lit else 4)
    return im


# ---- writing -------------------------------------------------------------------

def write_slope(cfg, pal, idx, heights, col):
    name = cfg["name"]
    os.makedirs(os.path.join(CART, "images"), exist_ok=True)
    os.makedirs(os.path.join(CART, "palettes"), exist_ok=True)
    grey = flat([(v << 16) | (v << 8) | v for v in range(256)])

    def save(data, size, palette, fname):
        im = Image.new("P", (size, size))
        im.putpalette(palette)
        im.putdata(data)
        im.save(os.path.join(CART, "images", fname))

    save(heights, S, grey, name + "_h.png")
    save(col, S, flat(pal), name + "_c.png")
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
    sky_strip(pal, idx, cfg).save(os.path.join(CART, "images", name + "_sky.png"))
    lines = ["GIMP Palette", "Name: " + name, "Columns: 16", "#"]
    for i, c in enumerate(pal):
        lines.append("%3d %3d %3d\tc%d" % ((c >> 16) & 255, (c >> 8) & 255, c & 255, i))
    with open(os.path.join(CART, "palettes", name + ".gpl"), "w") as f:
        f.write("\n".join(lines) + "\n")


# ---- the skier -----------------------------------------------------------------

# Poses, in order on the sheet from sprite 64, two cells by two each:
# straight, leaning left a little and a lot, right a little and a lot,
# tucked, ploughing and in the air
POSES = [("ski", 0), ("ski", -12), ("ski", -24), ("ski", 12), ("ski", 24),
         ("tuck", 0), ("plough", 0), ("air", 0)]


def skier(pose, lean, k=4, px0=8, py0=14):
    """The skier from behind, 16x16, feet at px0, py0 (the bottom middle),
    leaning lean degrees (right positive)."""
    im = Image.new("P", (16 * k, 16 * k), 0)
    im.putpalette(flat(STANDARD))
    d = ImageDraw.Draw(im)
    fx, fy = px0 * k, py0 * k
    a = math.radians(lean)
    ca, sa = math.cos(a), math.sin(a)

    def at(px, py):
        return (fx + (px * ca - py * sa) * k, fy + (px * sa + py * ca) * k)

    def poly(pts, c):
        d.polygon([at(px, py) for px, py in pts], fill=c)

    def line(p0, p1, c, w=1):
        d.line([at(*p0), at(*p1)], fill=c, width=w * k // 2)

    crouch = {"ski": 0.0, "tuck": 2.2, "plough": 0.4, "air": 1.4}[pose]
    arms = {"ski": 0.0, "tuck": -1.0, "plough": 0.6, "air": 1.6}[pose]
    # skis: two thin strips running away from the feet
    if pose == "plough":
        poly([(-3.8, 1.6), (-2.6, 1.6), (-0.4, -5.0), (-1.2, -5.0)], 10)
        poly([(3.8, 1.6), (2.6, 1.6), (0.4, -5.0), (1.2, -5.0)], 10)
    else:
        poly([(-2.4, 1.6), (-1.2, 1.6), (-1.2, -5.5), (-2.4, -5.5)], 10)
        poly([(1.2, 1.6), (2.4, 1.6), (2.4, -5.5), (1.2, -5.5)], 10)
    # poles from the hands to the snow
    hy = -6.5 + crouch
    line((-3.2 - arms, hy), (-4.6 - arms, 0.8), 6)
    line((3.2 + arms, hy), (4.6 + arms, 0.8), 6)
    # legs
    leg = 4.6 - crouch * 0.6
    poly([(-2.0, 0.2), (-0.4, 0.2), (-0.4, -leg), (-2.0, -leg)], 1)
    poly([(0.4, 0.2), (2.0, 0.2), (2.0, -leg), (0.4, -leg)], 1)
    # the jacket, a stripe across it, and the arms
    top = -9.2 + crouch
    poly([(-2.7, top), (2.7, top), (2.1, -leg), (-2.1, -leg)], 8)
    poly([(-2.6, top + 1.6), (2.6, top + 1.6), (2.5, top + 2.3), (-2.5, top + 2.3)], 7)
    poly([(-3.6 - arms, top + 0.6), (-2.6, top + 0.6), (-2.6, hy + 0.6), (-3.6 - arms, hy + 0.6)], 8)
    poly([(2.6, top + 0.6), (3.6 + arms, top + 0.6), (3.6 + arms, hy + 0.6), (2.6, hy + 0.6)], 8)
    # the helmet from behind, its strap across
    hx, hy2, r = at(0, top - 1.7)[0], at(0, top - 1.7)[1], 1.9 * k
    d.ellipse([hx - r, hy2 - r, hx + r, hy2 + r], fill=7)
    line((-1.8, top - 1.4), (1.8, top - 1.4), 1)
    return im.resize((16, 16), Image.NEAREST)


# Where things are on the sheet (the game has the same numbers)
FALLEN = 96                        # the skier down in the snow, 2x2
PUFF = 98                          # a puff of thrown snow, 3x3 in the corner of its cell


def write_sheet(pal, idx):
    sheet = Image.new("P", (128, 128), 0)
    sheet.putpalette(flat(pal))

    def put(im, n):
        sheet.paste(im, ((n % 16) * 8, (n // 16) * 8))

    for f, (pose, lean) in enumerate(POSES):
        put(skier(pose, lean), 64 + f * 2)
    put(skier("tuck", 80, 4, 4, 12), FALLEN)
    puff = Image.new("P", (8, 8), 0)
    sn = idx["snow"]
    for (x, y), c in {(1, 0): sn + 2, (0, 1): sn + 2, (1, 1): sn + 4, (2, 1): sn + 1, (1, 2): sn + 1}.items():
        puff.putpixel((x, y), c)
    put(puff, PUFF)
    sheet.save(os.path.join(CART, "sheet.png"))


def write_logo(pal, idx):
    sky = sky_strip(pal, idx, SLOPES[0]).crop((40, 4, 84, 48)).resize((44, 44), Image.NEAREST)
    im = Image.new("P", (44, 44))
    im.putpalette(flat(pal))
    im.paste(sky, (0, -6))
    d = ImageDraw.Draw(im)
    s = idx["snow"]
    d.polygon([(0, 26), (44, 34), (44, 44), (0, 44)], fill=s + 3)
    d.polygon([(0, 32), (22, 36), (44, 40), (44, 44), (0, 44)], fill=s + 2)
    d.line([(6, 43), (18, 36), (30, 39), (40, 33)], fill=s + 1)
    man = skier("ski", -14, 4).resize((20, 20), Image.NEAREST)
    mask = Image.eval(man.convert("L"), lambda v: 255 if v else 0)
    im.paste(man, (14, 18), mask=mask)
    im.save(os.path.join(CART, "logo.png"))


def main():
    first = None
    for cfg in SLOPES:
        pal, idx, heights, col, objs = make_slope(cfg)
        write_slope(cfg, pal, idx, heights, col)
        write_objects(cfg["name"], objs)
        kinds = [sum(1 for o in objs if o[2] == k) for k in range(3)]
        print("%-7s relief %d to %d, %d colours, %d small pines, %d large, %d boulders" % (
            cfg["name"], min(heights), max(heights), len(pal), kinds[0], kinds[1], kinds[2]))
        if first is None:
            first = (pal, idx)
    pal, idx = first
    write_sheet(pal, idx)
    aw, ah = write_atlas(pal, idx)
    write_logo(pal, idx)
    print("objects.png: %dx%d" % (aw, ah))
    print("palette:", ", ".join("%s %d" % kv for kv in sorted(idx.items(), key=lambda kv: kv[1])))


if __name__ == "__main__":
    main()
