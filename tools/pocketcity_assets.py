"""Builds Pocket City 3D's city and art.

    python3 tools/pocketcity_assets.py

It paints the whole city as one picture first, pixel by pixel, from a plan
of cells (roads, sidewalks, buildings, parks, water, sand, containers),
then cuts it into 8x8 tiles and keeps each different tile once. So the city
can be drawn freely and still fits the sheet's 255 sprites: the tiles are
whatever the picture needs. It writes into pocketcity/:

    sheet.png               the tiles, colour 0 never used (the scroll ring
                            copies them opaque)
    flags.json              each tile's flags: solid, water, grass, walk, road
    maps/city.json          the city: one tile number a cell, and the start
    data/roads.json         the street network: junctions, their links and
                            traffic lights, and which are in each square of
                            the map, for the traffic
    data/city.json          the jobs, the lost tapes, the paint shops and the
                            parking spots
    images/cars.png         four kinds of car, 32 headings each, 16x16 a frame
    images/people.png       people walking and knocked down, and the icons
    images/citymap.png      the whole city at a pixel for two cells, for the map
    palettes/city.gpl       the palette
    logo.png

The city is 256 by 256 cells of 8 pixels in five districts, on islands
joined by bridges: Old Town, Downtown, Greenside, the Harbour and Sunset
Beach. The look is a fixed, gentle 2.5D: every building's roof is drawn on
its plot with its south wall below it, windows and a door, and its shadow
falls to the east, the sun being in the north-west. Nothing moves in it at
run time, so it costs nothing to draw: the city stays a flat grid of cells
for driving and collisions.

Everything comes from fixed seeds, so a run makes the same city.
"""
import json
import math
import os
import random

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CART = os.path.join(HERE, "..", "pocketcity")

STANDARD = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
            0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]

# the palette from 16 on: name, colour
COLOURS = [
    ("asphalt dark", 0x3a3a44), ("asphalt", 0x4a4a54), ("asphalt light", 0x5c5c66),
    ("line white", 0xd8d8dc), ("line yellow", 0xe0b83c),
    ("kerb", 0x6e6e78), ("walk", 0x9a98a0), ("walk light", 0xb0aeb6),
    ("grass dark", 0x2e6a2e), ("grass", 0x3e863a), ("grass light", 0x58a24a),
    ("tree dark", 0x1c4a22), ("tree", 0x2a6630), ("tree light", 0x46883e),
    ("water deep", 0x1e4a7a), ("water", 0x2a5e94), ("water light", 0x5a90c4),
    ("quay", 0x7a7068),
    ("shade asphalt", 0x2c2c36), ("shade walk", 0x74727c), ("shade grass", 0x24542a),
    ("glass", 0x2a3a5a), ("glass light", 0x6a86b4), ("door", 0x4a2e22),
    ("car shadow", 0x14141c), ("tyre", 0x1c1c22),
    ("body light", 0xf05a5a), ("body", 0xc83030), ("body dark", 0x7a1c22),
    ("parking", 0x50505a),
    ("sand", 0xd8c48a), ("sand light", 0xe8d8a4), ("shade sand", 0xa8966a), ("foam", 0xe8f0f4),
    ("wood", 0x8a6440), ("wood light", 0xa47a50),
    ("box red", 0xa83a32), ("box red dark", 0x6e2420),
    ("box blue", 0x2e5a9a), ("box blue dark", 0x1c3864),
    ("box green", 0x3a7a4a), ("box green dark", 0x22502e),
    ("palm", 0x4a9a3a), ("palm dark", 0x2e6a28), ("trunk", 0x7a5a3a),
    ("rail", 0xb8b8c0), ("rail dark", 0x6a6a74),
    ("skin", 0xe8b08a), ("hair", 0x3a2a22), ("shirt", 0xe86a2a), ("shirt dark", 0xa84a1a),
    ("trousers", 0x2a3a5a),
    ("siren a", 0xe8304a), ("siren b", 0x2f9cf0),
]
# the cars' paints: light, middle, dark; the first is the body's own
PAINTS = [
    ("red", 0xf05a5a, 0xc83030, 0x7a1c22),
    ("blue", 0x6a9af0, 0x2e5ac8, 0x1c327a),
    ("green", 0x7ad08a, 0x2e9a48, 0x1c5a2a),
    ("yellow", 0xf8e070, 0xe0b030, 0x8a6a1a),
    ("white", 0xf4f4f8, 0xc8c8d0, 0x7a7a84),
    ("black", 0x6a6a74, 0x3a3a44, 0x1c1c22),
    ("police", 0xf4f4f8, 0xdcdce4, 0x24242c),
    ("gold", 0xfff0a0, 0xe8c040, 0x9a7a20),
]
# shirts and trousers for the people: shirt, its shade, trousers
LOOKS = [
    (0x2f9cf0, 0x1c62a0, 0x2a3a5a), (0x3cd250, 0x24863a, 0x4a3a2a), (0xf8e43c, 0xb0a020, 0x2a3a5a),
    (0xf27ab4, 0xb04a80, 0x3a3a44), (0xf6f2ea, 0xb8b4bc, 0x4a3a2a), (0x8a5236, 0x5a3420, 0x2a2a34),
    (0x7e7aa8, 0x545078, 0x1c1c22), (0xe8304a, 0xa01c30, 0x2a3a5a),
]
# roofs: shade, middle, light, rim; and the wall below them
ROOFS = [
    ("grey", [0x5e5e6a, 0x74747e, 0x8c8c96, 0xa8a8b0], 0x9a8e86),
    ("terracotta", [0x7a3a2a, 0x9a4a32, 0xb4603e, 0xc87a54], 0xc8b49a),
    ("slate", [0x34405a, 0x44506e, 0x56648a, 0x7080a4], 0xb0a898),
    ("sand", [0x8a7a5a, 0xa6946c, 0xbcaa80, 0xd2c296], 0xa8907a),
    ("glass", [0x2c3e5c, 0x3c5478, 0x5a76a0, 0x86a2c8], 0x8a96a8),
    ("steel", [0x4e5a5e, 0x667276, 0x7e8a8e, 0x9aa6aa], 0x8a8478),
    ("stripe", [0xb8385a, 0xe86a8a, 0xf0ece4, 0xf8a8c0], 0xe8dcc8),
]
GREY, TERRACOTTA, SLATE, SANDROOF, GLASS, STEEL, STRIPE = range(7)

S = 8                              # pixels a cell
W = H = 256                        # cells, the city


def flat(cols):
    out = []
    for c in cols:
        out += [(c >> 16) & 255, (c >> 8) & 255, c & 255]
    return out + [0] * (768 - len(out))


def palette():
    pal = list(STANDARD)
    idx = {}
    for name, c in COLOURS:
        idx[name] = len(pal)
        pal.append(c)
    for name, cols, wall in ROOFS:
        idx["roof " + name] = len(pal)
        pal += cols
        idx["wall " + name] = len(pal)
        pal.append(wall)
        pal.append(blend(wall, 0x000000, 0.25))
    for name, a, b, c in PAINTS:
        idx["paint " + name] = len(pal)
        pal += [a, b, c]
    for i, (a, b, c) in enumerate(LOOKS):
        idx["look %d" % i] = len(pal)
        pal += [a, b, c]
    return pal, idx


def blend(c, to, t):
    out = 0
    for sh in (16, 8, 0):
        a, b = (c >> sh) & 255, (to >> sh) & 255
        out |= int(round(a + (b - a) * t)) << sh
    return out


# ---- the plan ------------------------------------------------------------------

(ROAD, WALK, BUILD, PARK, TREE, WATER, PARKING, PLAZA, SAND, WOOD, YARD, BOX, FOUNTAIN, PALM,
 RAIL) = range(15)
KIND_NAMES = ["road", "walk", "build", "park", "tree", "water", "parking", "plaza", "sand", "wood",
              "yard", "box", "fountain", "palm", "rail"]
STREET = 4                         # cells across a street: two lanes of two
ALLEY = 2

# name, land (x0, y0, x1, y1), the streets' first cells across and down, style
DISTRICTS = [
    ("OLD TOWN", (6, 6, 122, 122), [6, 30, 54, 78, 102, 118], [6, 30, 54, 78, 102, 118], "town"),
    ("DOWNTOWN", (134, 6, 250, 122), [134, 158, 182, 206, 230, 246], [6, 30, 54, 78, 102, 118], "towers"),
    ("GREENSIDE", (6, 134, 122, 250), [6, 30, 54, 78, 102, 118], [134, 154, 174, 194, 214, 234, 246], "green"),
    ("HARBOUR", (134, 134, 186, 250), [134, 158, 182], [134, 154, 174, 194, 214, 234, 246], "harbour"),
    ("SUNSET BEACH", (198, 134, 250, 250), [198, 230], [134, 154, 174, 194, 214, 234], "beach"),
]
# a street across the water: "h" runs across at row y, "v" down at column x, from, to
BRIDGES = [
    ("h", 30, 122, 134), ("h", 78, 122, 134),        # Old Town and Downtown
    ("v", 30, 122, 134), ("v", 78, 122, 134),        # Old Town and Greenside
    ("v", 158, 122, 134),                            # Downtown and the Harbour
    ("v", 230, 122, 134),                            # Downtown and Sunset Beach
    ("h", 194, 122, 134),                            # Greenside and the Harbour
    ("h", 154, 186, 198), ("h", 214, 186, 198),      # the Harbour and Sunset Beach
]


class Plan:
    def __init__(self):
        self.kind = [[WATER] * W for _ in range(H)]
        self.lanes = [[None] * W for _ in range(H)]   # 'v' or 'h' street and the cell's place across it, 'x' junction
        self.dist = [[-1] * W for _ in range(H)]      # the district of each land cell
        self.plots = []                               # buildings: x0, y0, x1, y1, roof, wall rows
        self.boxes = []                               # containers: x0, y, colour; three cells long
        self.rails = {}                               # a bridge's railings: cell -> the side the road is on

    def fill(self, x0, y0, x1, y1, k):
        for y in range(y0, y1):
            for x in range(x0, x1):
                self.kind[y][x] = k


def plan():
    p = Plan()
    rnd = random.Random(5)
    for d, (name, (lx0, ly0, lx1, ly1), xs, ys, style) in enumerate(DISTRICTS):
        p.fill(lx0, ly0, lx1, ly1, WALK)
        for y in range(ly0, ly1):
            for x in range(lx0, lx1):
                p.dist[y][x] = d
        ex, ey = xs[-1] + STREET, ys[-1] + STREET
        for sx in xs:
            for y in range(ys[0], ey):
                for i in range(STREET):
                    p.kind[y][sx + i] = ROAD
                    p.lanes[y][sx + i] = ("v", i) if p.lanes[y][sx + i] is None else ("x", 0)
        for sy in ys:
            for x in range(xs[0], ex):
                for i in range(STREET):
                    k = p.lanes[sy + i][x]
                    p.kind[sy + i][x] = ROAD
                    p.lanes[sy + i][x] = ("h", i) if k is None else ("x", 0)
        for bi in range(len(xs) - 1):
            for bj in range(len(ys) - 1):
                x0, x1 = xs[bi] + STREET, xs[bi + 1]
                y0, y1 = ys[bj] + STREET, ys[bj + 1]
                BLOCKS[style](p, rnd, bi, bj, x0, y0, x1, y1)
        if style == "beach":
            beach(p, rnd, lx0, ly0, lx1, ly1, ex, ey)
    for axis, at, a, b in BRIDGES:
        for c in range(a, b):
            for i in range(STREET):
                if axis == "h":
                    p.kind[at + i][c] = ROAD
                    p.lanes[at + i][c] = ("h", i)
                else:
                    p.kind[c][at + i] = ROAD
                    p.lanes[c][at + i] = ("v", i)
            if axis == "h":
                p.kind[at - 1][c] = RAIL
                p.rails[(c, at - 1)] = "s"
                p.kind[at + STREET][c] = RAIL
                p.rails[(c, at + STREET)] = "n"
            else:
                p.kind[c][at - 1] = RAIL
                p.rails[(at - 1, c)] = "e"
                p.kind[c][at + STREET] = RAIL
                p.rails[(at + STREET, c)] = "w"
    for (x0, y0, x1, y1, style, rows) in p.plots:
        p.fill(x0, y0, x1, y1, BUILD)
    return p


def inner(x0, y0, x1, y1):
    """A block's inside, within its ring of sidewalk."""
    return x0 + 1, y0 + 1, x1 - 1, y1 - 1


def trees(p, rnd, ix0, iy0, ix1, iy1, n, ground, k=TREE):
    """Up to n trees of 2x2 cells on cells of this ground."""
    for _ in range(n):
        tx, ty = rnd.randrange(ix0, ix1 - 1), rnd.randrange(iy0, iy1 - 1)
        if all(p.kind[ty + dy][tx + dx] == ground for dx in (0, 1) for dy in (0, 1)):
            p.fill(tx, ty, tx + 2, ty + 2, k)


def split(x0, y0, x1, y1, rnd, roofs, rows, lo=4, hi=10):
    """A lot cut across into buildings of lo to hi - 1 cells."""
    out = []
    x = x0
    while x < x1:
        w = min(x1 - x, rnd.randrange(lo, hi))
        if x1 - (x + w) < lo:
            w = x1 - x
        roof = rnd.choice(roofs)
        out.append((x, y0, x + w, y1, roof, rows if isinstance(rows, int) else rows(rnd)))
        x += w
    return out


def block_town(p, rnd, bi, bj, x0, y0, x1, y1):
    """Old Town: a park, a car park, a plaza, and town blocks with alleys."""
    ix0, iy0, ix1, iy1 = inner(x0, y0, x1, y1)
    use = "park" if (bi, bj) == (3, 1) else "parking" if (bi, bj) == (1, 3) else \
          "plaza" if (bi, bj) == (2, 2) else "town"
    if use == "park":
        p.fill(ix0, iy0, ix1, iy1, PARK)
        for x in range(ix0, ix1):
            p.kind[(iy0 + iy1) // 2][x] = WALK
        for y in range(iy0, iy1):
            p.kind[y][(ix0 + ix1) // 2] = WALK
        trees(p, rnd, ix0, iy0, ix1, iy1, 40, PARK)
        return
    if use == "parking":
        p.fill(ix0, iy0, ix1, iy1, PARKING)
        return
    if use == "plaza":
        p.fill(ix0, iy0, ix1, iy1, PLAZA)
        for (tx, ty) in [(ix0 + 2, iy0 + 2), (ix1 - 4, iy0 + 2), (ix0 + 2, iy1 - 4), (ix1 - 4, iy1 - 4)]:
            p.fill(tx, ty, tx + 2, ty + 2, TREE)
        return
    parts = [(ix0, iy0, ix1, iy1)]
    if rnd.random() < 0.6:
        if rnd.random() < 0.5:
            ax = (ix0 + ix1) // 2 - 1
            for y in range(y0, y1):
                for i in range(ALLEY):
                    p.kind[y][ax + i] = ROAD
                    p.lanes[y][ax + i] = ("a", i)
            parts = [(ix0, iy0, ax - 1, iy1), (ax + ALLEY + 1, iy0, ix1, iy1)]
            for y in range(y0, y1):
                p.kind[y][ax - 1] = WALK
                p.kind[y][ax + ALLEY] = WALK
        else:
            ay = (iy0 + iy1) // 2 - 1
            for x in range(x0, x1):
                for i in range(ALLEY):
                    p.kind[ay + i][x] = ROAD
                    p.lanes[ay + i][x] = ("b", i)
            parts = [(ix0, iy0, ix1, ay - 1), (ix0, ay + ALLEY + 1, ix1, iy1)]
            for x in range(x0, x1):
                p.kind[ay - 1][x] = WALK
                p.kind[ay + ALLEY][x] = WALK
    for (px0, py0, px1, py1) in parts:
        p.plots += split(px0, py0, px1, py1, rnd, [GREY, TERRACOTTA, SLATE, SANDROOF],
                         lambda r: 2 if r.random() < 0.35 else 1)


def block_towers(p, rnd, bi, bj, x0, y0, x1, y1):
    """Downtown: towers of glass and stone, Civic Square with its fountain,
    a car park and a small park."""
    ix0, iy0, ix1, iy1 = inner(x0, y0, x1, y1)
    if (bi, bj) == (2, 2):
        p.fill(ix0, iy0, ix1, iy1, PLAZA)
        cx, cy = (ix0 + ix1) // 2 - 1, (iy0 + iy1) // 2 - 1
        p.fill(cx, cy, cx + 2, cy + 2, FOUNTAIN)
        for (tx, ty) in [(ix0 + 2, iy0 + 2), (ix1 - 4, iy0 + 2), (ix0 + 2, iy1 - 4), (ix1 - 4, iy1 - 4)]:
            p.fill(tx, ty, tx + 2, ty + 2, TREE)
        return
    if (bi, bj) == (0, 4):
        p.fill(ix0, iy0, ix1, iy1, PARKING)
        return
    if (bi, bj) == (4, 1):
        p.fill(ix0, iy0, ix1, iy1, PARK)
        trees(p, rnd, ix0, iy0, ix1, iy1, 18, PARK)
        return
    # one row of towers, or two when the block is deep enough
    if iy1 - iy0 >= 16 and rnd.random() < 0.5:
        mid = (iy0 + iy1) // 2
        rows_ = [(iy0, mid), (mid, iy1)]
    else:
        rows_ = [(iy0, iy1)]
    for (a, b) in rows_:
        p.plots += split(ix0, a, ix1, b, rnd, [GLASS, GLASS, GREY, SLATE], 3, 6, 11)


def block_green(p, rnd, bi, bj, x0, y0, x1, y1):
    """Greenside: houses in gardens, the lake and a park."""
    ix0, iy0, ix1, iy1 = inner(x0, y0, x1, y1)
    if (bi, bj) == (1, 1):
        p.fill(ix0, iy0, ix1, iy1, PARK)
        p.fill(ix0 + 2, iy0 + 2, ix1 - 2, iy1 - 2, WATER)
        return
    if (bi, bj) in ((3, 3), (0, 5)):
        p.fill(ix0, iy0, ix1, iy1, PARK)
        trees(p, rnd, ix0, iy0, ix1, iy1, 22, PARK)
        return
    p.fill(ix0, iy0, ix1, iy1, PARK)
    depth = 4
    rows_ = [(iy0 + 1, iy0 + 1 + depth)]
    if iy1 - iy0 >= 2 * depth + 4:
        rows_.append((iy1 - 1 - depth, iy1 - 1))
    for (a, b) in rows_:
        x = ix0 + 1
        while x + 4 <= ix1 - 1:
            w = rnd.randrange(4, 6)
            if x + w > ix1 - 1:
                break
            p.plots.append((x, a, x + w, b, rnd.choice([TERRACOTTA, TERRACOTTA, SANDROOF, GREY]), 1))
            x += w + rnd.randrange(1, 3)
    trees(p, rnd, ix0, iy0, ix1, iy1, 6, PARK)


def block_harbour(p, rnd, bi, bj, x0, y0, x1, y1):
    """The Harbour: warehouses, and yards of containers."""
    ix0, iy0, ix1, iy1 = inner(x0, y0, x1, y1)
    if (bi + bj) % 2 == 0 and iy1 - iy0 >= 8:
        p.plots += split(ix0, iy0, ix1, iy1, rnd, [STEEL, STEEL, GREY], 2, 7, 12)
        return
    p.fill(ix0, iy0, ix1, iy1, YARD)
    y = iy0 + 1
    while y < iy1 - 1:
        x = ix0 + 1
        while x + 3 <= ix1 - 1:
            if rnd.random() < 0.8:
                p.boxes.append((x, y, rnd.randrange(3)))
                for i in range(3):
                    p.kind[y][x + i] = BOX
            x += 4
        y += 3


def block_beach(p, rnd, bi, bj, x0, y0, x1, y1):
    """Sunset Beach's blocks: hotels, beach huts, a car park, the promenade."""
    ix0, iy0, ix1, iy1 = inner(x0, y0, x1, y1)
    use = ["hotels", "huts", "parking", "promenade", "hotels"][bj]
    if use == "hotels":
        p.plots += split(ix0, iy0, ix1, iy1 - 3, rnd, [SANDROOF, GREY, TERRACOTTA], 2, 6, 10)
        p.fill(ix0, iy1 - 3, ix1, iy1, PLAZA)
        return
    if use == "parking":
        p.fill(ix0, iy0, ix1, iy1, PARKING)
        return
    p.fill(ix0, iy0, ix1, iy1, SAND)
    if use == "huts":
        x = ix0 + 1
        while x + 3 <= ix1 - 1:
            p.plots.append((x, iy0 + 2, x + 3, iy0 + 5, STRIPE, 1))
            x += 5
        trees(p, rnd, ix0, iy0 + 6, ix1, iy1, 8, SAND, PALM)
        return
    p.fill(ix0, iy0, ix1, iy1, PLAZA)
    for x in range(ix0 + 1, ix1 - 2, 5):
        p.fill(x, iy0 + 1, x + 2, iy0 + 3, PALM)
        p.fill(x, iy1 - 3, x + 2, iy1 - 1, PALM)


BLOCKS = {"town": block_town, "towers": block_towers, "green": block_green,
          "harbour": block_harbour, "beach": block_beach}


def beach(p, rnd, lx0, ly0, lx1, ly1, ex, ey):
    """Sand beyond the beach's streets, east and south, with a boardwalk
    along the sidewalk and palms."""
    p.fill(ex + 1, ly0, lx1, ly1, SAND)
    p.fill(lx0, ey + 1, lx1, ly1, SAND)
    for y in range(ly0, ey + 1):
        p.kind[y][ex + 1] = WOOD
    for x in range(lx0, ex + 2):
        p.kind[ey + 1][x] = WOOD
    trees(p, rnd, ex + 3, ly0 + 1, lx1 - 1, ly1 - 1, 30, SAND, PALM)
    trees(p, rnd, lx0 + 1, ey + 3, ex + 1, ly1 - 1, 12, SAND, PALM)


# ---- painting ------------------------------------------------------------------

def paint(p, idx):
    kind = p.kind
    img = Image.new("P", (W * S, H * S), idx["water"])
    px = img.load()
    boxes = {}
    for (x, y, c) in p.boxes:
        for i in range(3):
            boxes[(x + i, y)] = (c, i)

    def k(x, y):
        return kind[y][x] if 0 <= x < W and 0 <= y < H else WATER

    for cy in range(H):
        for cx in range(W):
            t = kind[cy][cx]
            for y in range(S):
                for x in range(S):
                    px[cx * S + x, cy * S + y] = ground(t, cx, cy, x, y, idx, k, p, boxes)
    # buildings: roof on the plot, the south wall's rows below it
    for (x0, y0, x1, y1, style, rows) in p.plots:
        name = ROOFS[style][0]
        r = idx["roof " + name]
        wall = idx["wall " + name]
        X0, Y0, X1, Y1 = x0 * S, y0 * S, x1 * S, y1 * S
        wall_top = Y1 - rows * S
        for y in range(Y0, wall_top):
            for x in range(X0, X1):
                edge = x == X0 or x == X1 - 1 or y == Y0
                inner_ = x == X0 + 1 or y == Y0 + 1
                c = r + 3 if edge else r + 2 if inner_ else r + 1
                if not edge and style == STEEL:
                    c = r + 2 if (x - X0) % 4 == 0 else r + 1
                elif not edge and style == STRIPE:
                    c = r + 2 if (x - X0) // 4 % 2 else r + 1
                px[x, y] = c
        if style not in (STEEL, STRIPE):
            # a darker band across the roof every other cell: the roof's sheets
            for y in range(Y0 + S, wall_top, 2 * S):
                for x in range(X0 + 1, X1 - 1):
                    px[x, y] = r
        if style == GLASS:
            # a lift house on the bigger towers
            if (x1 - x0) >= 6 and (wall_top - Y0) >= 3 * S:
                vx, vy = X0 + 2 * S, Y0 + S + 4
                for y in range(vy, vy + S):
                    for x in range(vx, vx + 2 * S):
                        px[x, y] = r + 3 if y == vy or x == vx else r
        for y in range(wall_top, Y1):
            for x in range(X0, X1):
                gx, gy = (x - X0) % S, (y - wall_top) % S
                win = 2 <= gx <= 5 and 2 <= gy <= 5
                if style == STEEL:
                    win = 2 <= gx <= 5 and gy == 3
                px[x, y] = wall + 1 if y == wall_top else (idx["glass light"] if gy == 2 and win else idx["glass"]) if win else wall
        # a door in the middle of the bottom row; a warehouse's is a wide shutter
        dx = X0 + ((x1 - x0) // 2) * S
        dw = (dx, dx + 2 * S) if style == STEEL and x1 - x0 >= 4 else (dx + 2, dx + 6)
        for y in range(Y1 - 6, Y1):
            for x in range(dw[0], dw[1]):
                px[x, y] = idx["rail dark"] if style == STEEL and (y % 2) else idx["door"]
    shade = {idx["asphalt"]: idx["shade asphalt"], idx["asphalt dark"]: idx["shade asphalt"],
             idx["asphalt light"]: idx["shade asphalt"], idx["walk"]: idx["shade walk"],
             idx["walk light"]: idx["shade walk"], idx["kerb"]: idx["shade asphalt"],
             idx["grass"]: idx["shade grass"], idx["grass light"]: idx["shade grass"],
             idx["grass dark"]: idx["shade grass"], idx["parking"]: idx["shade asphalt"],
             idx["line white"]: idx["walk"], idx["line yellow"]: idx["kerb"],
             idx["sand"]: idx["shade sand"], idx["sand light"]: idx["shade sand"],
             idx["wood"]: idx["shade asphalt"], idx["wood light"]: idx["wood"]}

    def shadow_cell(cx, cy):
        if 0 <= cx < W and 0 <= cy < H and kind[cy][cx] not in (BUILD, WATER, RAIL, BOX, FOUNTAIN):
            for y in range(S):
                for x in range(S):
                    q = (cx * S + x, cy * S + y)
                    px[q] = shade.get(px[q], px[q])

    # shadows to the east of each building, a cell wide, a cell down
    for (x0, y0, x1, y1, style, rows) in p.plots:
        for cy in range(y0 + 1, y1 + 1):
            shadow_cell(x1, cy)
    for (x, y, c) in p.boxes:
        shadow_cell(x + 3, y + 1)
    # tree and palm shadows, then the crowns over them
    for cy in range(1, H - 1):
        for cx in range(1, W - 1):
            t = kind[cy][cx]
            if t in (TREE, PALM) and kind[cy][cx - 1] != t and kind[cy - 1][cx] != t:
                for y in range(4, 2 * S + 4):
                    for x in range(4, 2 * S + 4):
                        if (x - 11) ** 2 + (y - 11) ** 2 < 49:
                            q = (cx * S + x, cy * S + y)
                            if q[0] < W * S and q[1] < H * S and kind[q[1] // S][q[0] // S] not in (TREE, PALM, BUILD):
                                px[q] = shade.get(px[q], px[q])
                for y in range(2 * S):
                    for x in range(2 * S):
                        if t == TREE:
                            d = (x - 7.5) ** 2 + (y - 7.5) ** 2
                            if d < 49:
                                lit = (x - 5) ** 2 + (y - 5) ** 2 < 12
                                px[cx * S + x, cy * S + y] = idx["tree light"] if lit else idx["tree"] if d < 30 else idx["tree dark"]
                        else:
                            c = palm(x, y, idx)
                            if c is not None:
                                px[cx * S + x, cy * S + y] = c
    return img


def palm(x, y, idx):
    """A pixel of a palm's crown, 16x16, seen from above: fronds in a star."""
    dx, dy = x - 7.5, y - 7.5
    d = math.hypot(dx, dy)
    if d < 1.6:
        return idx["trunk"]
    if d > 7.6:
        return None
    a = math.atan2(dy, dx) / (2 * math.pi) * 7
    near = abs(a - round(a))
    if near < 0.16 + 0.12 * (1 - d / 8):
        return idx["palm"] if near < 0.08 or d < 4 else idx["palm dark"]
    return None


def ground(t, cx, cy, x, y, idx, k, p, boxes):
    """One pixel of a cell's ground."""
    if t in (WATER, RAIL, FOUNTAIN):
        if t == RAIL:
            side = p.rails[(cx, cy)]
            band = {"s": y >= 5, "n": y <= 2, "e": x >= 5, "w": x <= 2}[side]
            post = {"s": y == 4, "n": y == 3, "e": x == 4, "w": x == 3}[side] and (
                x % 4 == 1 if side in "sn" else y % 4 == 1)
            if band:
                edge = {"s": y == 5, "n": y == 2, "e": x == 5, "w": x == 2}[side]
                return idx["rail"] if edge else idx["rail dark"]
            if post:
                return idx["rail dark"]
            return idx["water"]
        if t == FOUNTAIN:
            # a round basin across 2x2 cells: rim, water, a spout
            ox = x + (S if k(cx - 1, cy) == FOUNTAIN else 0)
            oy = y + (S if k(cx, cy - 1) == FOUNTAIN else 0)
            d = (ox - 7.5) ** 2 + (oy - 7.5) ** 2
            if d >= 56:
                return idx["walk light"] if (ox + oy) % 4 == 0 else idx["walk"]
            if d >= 40:
                return idx["rail"]
            if d < 4:
                return idx["foam"]
            return idx["water light"] if (ox + oy) % 5 == 0 else idx["water"]
        # the quay along the land, foam along a beach, ripples on the water
        land = lambda q: q not in (WATER, RAIL)
        shore = False
        for (nx, ny, near) in ((cx, cy - 1, y <= 1), (cx - 1, cy, x <= 1), (cx + 1, cy, x >= 6), (cx, cy + 1, y >= 6)):
            n = k(nx, ny)
            if land(n):
                shore = True
                if near:
                    if n == SAND:
                        return idx["foam"] if (x + y) % 3 else idx["water light"]
                    return idx["quay"]
        if shore:
            return idx["water"]
        return idx["water light"] if (x + 3 * y) % 11 == 0 else idx["water"]
    if t == BOX:
        c, part = boxes[(cx, cy)]
        body, dark = [("box red", "box red dark"), ("box blue", "box blue dark"), ("box green", "box green dark")][c]
        if y == 0 or y == 7 or (part == 0 and x == 0) or (part == 2 and x == 7):
            return idx[dark]
        return idx[dark] if x % 2 == 1 else idx[body]
    if t in (WALK, PLAZA, WOOD):
        # slabs or planks, with the kerb along a road
        if k(cx, cy - 1) in (ROAD,) and y == 0 or k(cx, cy + 1) in (ROAD,) and y == 7 or \
           k(cx - 1, cy) in (ROAD,) and x == 0 or k(cx + 1, cy) in (ROAD,) and x == 7:
            return idx["kerb"]
        if t == WOOD:
            vertical = k(cx, cy - 1) == WOOD or k(cx, cy + 1) == WOOD
            along = y if vertical else x
            return idx["wood light"] if along % 4 == 0 else idx["wood"]
        if t == PLAZA:
            return idx["walk light"] if (x + y) % 4 == 0 else idx["walk"]
        return idx["walk light"] if x == 0 or y == 0 else idx["walk"]
    if t in (PARK, TREE):
        return idx["grass light"] if (x * 3 + y * 5) % 11 == 0 else idx["grass"]
    if t in (SAND, PALM):
        return idx["sand light"] if (x * 5 + y * 3) % 9 == 0 else idx["sand"]
    if t == PARKING:
        if x == 0 and cy % 3 != 0:
            return idx["line white"]
        if y == 0 and cy % 3 == 0:
            return idx["line white"]
        return idx["parking"]
    if t == YARD:
        return idx["line yellow"] if (y == 0 and k(cx, cy - 1) == BOX) else idx["parking"]
    # roads: asphalt, the centre line, zebra crossings by the junctions
    ln = p.lanes[cy][cx]
    c = idx["asphalt"] if (x * 7 + y * 3 + (cx + cy) % 2 * 6) % 13 else idx["asphalt light"]
    if ln is None:
        return c
    kind_, i = ln
    if kind_ == "x":
        return c
    if kind_ == "v":
        if near_junction(cx, cy, p.lanes, 0, 1):
            return idx["line white"] if (y % 4) < 2 and 1 <= x <= 6 else c
        if (i == 1 and x == 7 or i == 2 and x == 0) and (y + cy * 8) % 8 < 5:
            return idx["line yellow"]
        return c
    if kind_ == "h":
        if near_junction(cx, cy, p.lanes, 1, 0):
            return idx["line white"] if (x % 4) < 2 and 1 <= y <= 6 else c
        if (i == 1 and y == 7 or i == 2 and y == 0) and (x + cx * 8) % 8 < 5:
            return idx["line yellow"]
        return c
    return idx["asphalt dark"] if (x + y) % 9 == 0 else c


def near_junction(cx, cy, lanes, dx, dy):
    """Whether a street cell is the first one out of a junction."""
    for s in (-1, 1):
        nx, ny = cx + dx * s, cy + dy * s
        if 0 <= nx < W and 0 <= ny < H and lanes[ny][nx] is not None and lanes[ny][nx][0] == "x":
            return True
    return False


# ---- tiles, flags and the map ----------------------------------------------------

SOLID, WATERF, GRASS, WALKF, ROADF = 1, 2, 4, 8, 16
FLAGS = {BUILD: SOLID, WATER: SOLID | WATERF, TREE: SOLID | GRASS, PARK: GRASS,
         WALK: WALKF, PLAZA: WALKF, ROAD: ROADF, PARKING: ROADF, SAND: GRASS | WALKF,
         WOOD: WALKF, YARD: ROADF, BOX: SOLID, FOUNTAIN: SOLID | WATERF, PALM: SOLID | GRASS,
         RAIL: SOLID | WATERF}


def cut(img, kind):
    """Each different 8x8 tile once; the map as tile numbers, from 1."""
    px = img.load()
    tiles, seen, cells = [], {}, []
    flags = {}
    for cy in range(H):
        row = []
        for cx in range(W):
            block = tuple(px[cx * S + x, cy * S + y] for y in range(S) for x in range(S))
            f = FLAGS[kind[cy][cx]]
            key = (block, f)
            if key not in seen:
                seen[key] = len(tiles) + 1
                tiles.append(block)
                flags[seen[key]] = f
            row.append(seen[key])
        cells.append(row)
    return tiles, flags, cells


# ---- the street network ----------------------------------------------------------

DIRS = [(0, -1), (1, 0), (0, 1), (-1, 0)]      # north, east, south, west: the order roads.js uses
REGION = 32                                    # cells a square of the map, for finding junctions near


def network(p):
    """The junctions (the 4x4 crossings), their centres, links each way and
    whether they have lights, and which are in each square of the map."""
    lanes = p.lanes
    nodes, at = [], {}
    for y in range(H):
        for x in range(W):
            ln = lanes[y][x]
            if ln and ln[0] == "x" and not (lanes[y - 1][x] and lanes[y - 1][x][0] == "x") and \
               not (lanes[y][x - 1] and lanes[y][x - 1][0] == "x"):
                n = len(nodes)
                nodes.append((x, y))
                for dy in range(STREET):
                    for dx in range(STREET):
                        at[(x + dx, y + dy)] = n
    links = []
    for (x, y) in nodes:
        out = []
        for (dx, dy) in DIRS:
            # step out of the junction along the street, then on to the next
            cx = x + (STREET if dx > 0 else -1 if dx < 0 else 0)
            cy = y + (STREET if dy > 0 else -1 if dy < 0 else 0)
            axis = "v" if dx == 0 else "h"
            target = -1
            while 0 <= cx < W and 0 <= cy < H and lanes[cy][cx] is not None:
                if lanes[cy][cx][0] == "x":
                    target = at[(cx, cy)]
                    break
                if lanes[cy][cx][0] != axis:
                    break
                cx += dx
                cy += dy
            out.append(target)
        links.append(out)
    for n, out in enumerate(links):
        for d, m in enumerate(out):
            if m >= 0 and links[m][(d + 2) % 4] != n:
                raise SystemExit("roads: junction %d's link %d isn't returned" % (n, d))
    regions = [[] for _ in range((W // REGION) * (H // REGION))]
    for n, (x, y) in enumerate(nodes):
        regions[((y + 2) // REGION) * (W // REGION) + (x + 2) // REGION].append(n)
    rstart, rlist = [], []
    for r in regions:
        rstart.append(len(rlist))
        rlist += r
    return {
        "nx": [(x + 2) * S for x, y in nodes],
        "ny": [(y + 2) * S for x, y in nodes],
        "link": [m for out in links for m in out],
        "sig": [1 if all(m >= 0 for m in out) else 0 for out in links],
        "dist": [p.dist[y + 2][x + 2] for x, y in nodes],
        "rstart": rstart + [len(rlist)],
        "rlist": rlist,
    }


# ---- jobs, tapes and the rest ------------------------------------------------------

JOBS = ["deliver", "taxi", "trial", "chase"]


def spots_near_street(p, d, rnd, n, avoid=(), spacing=24):
    """n sidewalk cells beside a street (not a junction's corner) in district d, apart."""
    out = []
    cand = []
    lx0, ly0, lx1, ly1 = DISTRICTS[d][1]
    for y in range(ly0 + 1, ly1 - 1):
        for x in range(lx0 + 1, lx1 - 1):
            if p.kind[y][x] != WALK:
                continue
            for (dx, dy) in DIRS:
                ln = p.lanes[y + dy][x + dx]
                if ln and ln[0] in ("v", "h"):
                    cand.append((x, y))
                    break
    rnd.shuffle(cand)
    for c in cand:
        if all(abs(c[0] - o[0]) + abs(c[1] - o[1]) >= spacing for o in out + list(avoid)):
            out.append(c)
        if len(out) == n:
            break
    return out


def centre(c):
    return (c[0] * S + 4, c[1] * S + 4)


def jobs(p, net, rnd):
    """Four jobs a district, in turn: a delivery to another district, a taxi
    fare, a time trial through junctions and a chase. Times come from the
    distance, at a pace a careful driver keeps."""
    givers, out = [], []
    nn = len(net["nx"])
    for d in range(len(DISTRICTS)):
        g = spots_near_street(p, d, rnd, 1, spacing=1)[0]
        givers.append(centre(g))
        for j, kind_ in enumerate(JOBS):
            if kind_ == "deliver":
                a = spots_near_street(p, d, rnd, 1, avoid=[g], spacing=30)[0]
                b = spots_near_street(p, (d + 1 + j) % len(DISTRICTS), rnd, 1, spacing=1)[0]
                pts = [centre(a), centre(b)]
            elif kind_ == "taxi":
                a = spots_near_street(p, d, rnd, 1, avoid=[g], spacing=20)[0]
                b = spots_near_street(p, rnd.randrange(len(DISTRICTS)), rnd, 1, avoid=[a], spacing=60)[0]
                pts = [centre(a), centre(b)]
            elif kind_ == "trial":
                start = min((n for n in range(nn) if net["dist"][n] == d),
                            key=lambda n: abs(net["nx"][n] - g[0] * S) + abs(net["ny"][n] - g[1] * S))
                pts = trial(net, start, rnd, 7)
            else:
                # the getaway car sets off from a junction in sight of the phone box, or nearly
                gp = givers[-1]
                near = [n for n in range(nn) if net["dist"][n] == d and
                        100 <= abs(net["nx"][n] - gp[0]) + abs(net["ny"][n] - gp[1]) <= 250]
                start = rnd.choice(near)
                pts = [(net["nx"][start], net["ny"][start])]
            length = sum(abs(pts[i][0] - pts[i - 1][0]) + abs(pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts)))
            first = abs(pts[0][0] - givers[-1][0]) + abs(pts[0][1] - givers[-1][1])
            pace = {"deliver": 1.6, "taxi": 1.6, "trial": 2.0, "chase": 1.0}[kind_]
            secs = 100 if kind_ == "chase" else int((first + length) / (pace * 33)) + 15
            out.append({"d": d, "type": JOBS.index(kind_), "x": [q[0] for q in pts], "y": [q[1] for q in pts],
                        "time": secs, "pay": 300 + d * 250 + j * 100})
    return givers, out


def trial(net, start, rnd, n):
    """n junctions along a drive from start that never turns back."""
    pts, node, came = [], start, -1
    seen = {start}
    while len(pts) < n:
        ways = [d for d in range(4) if net["link"][node * 4 + d] >= 0 and d != came]
        fresh = [d for d in ways if net["link"][node * 4 + d] not in seen]
        d = rnd.choice(fresh or ways)
        node = net["link"][node * 4 + d]
        seen.add(node)
        came = (d + 2) % 4
        if rnd.random() < 0.6 or len(pts) == n - 1:
            pts.append((net["nx"][node], net["ny"][node]))
    return pts


def tapes(p, rnd):
    """Six lost tapes a district, in out-of-the-way places: alleys, parks,
    yards, gardens, sand."""
    out = []
    for d in range(len(DISTRICTS)):
        lx0, ly0, lx1, ly1 = DISTRICTS[d][1]
        cand = []
        for y in range(ly0, ly1):
            for x in range(lx0, lx1):
                t = p.kind[y][x]
                ln = p.lanes[y][x]
                hidden = (t == ROAD and ln and ln[0] in ("a", "b")) or t in (PARK, YARD, SAND) or \
                         (t == WALK and all(p.kind[y + dy][x + dx] not in (ROAD,) for dx, dy in DIRS))
                if hidden and all(FLAGS[p.kind[y + dy][x + dx]] & SOLID == 0 for dx, dy in DIRS):
                    cand.append((x, y))
        rnd.shuffle(cand)
        got = []
        for spacing in (24, 16, 10, 6):
            for c in cand:
                if len(got) < 6 and c not in got and all(abs(c[0] - o[0]) + abs(c[1] - o[1]) >= spacing for o in got):
                    got.append(c)
        if len(got) < 6:
            raise SystemExit("tapes: only %d places in %s" % (len(got), DISTRICTS[d][0]))
        out += [centre(c) for c in got]
    return out


def parking(p):
    """Bays in the car parks for parked cars: the middle of each bay, nose north or south."""
    out = []
    for y in range(1, H - 2):
        for x in range(1, W - 2):
            if p.kind[y][x] == PARKING and p.kind[y][x + 1] == PARKING and x % 2 == 0 and y % 3 == 1 and \
               p.kind[y + 1][x] == PARKING and p.kind[y - 1][x] == PARKING:
                out.append((x * S + 4, y * S + 4, 0.25 if (x // 2) % 2 else 0.75))
    return out


# ---- the cars --------------------------------------------------------------------

FRAMES = 32
SEDAN, VAN, SPORTS, POLICE = range(4)


def car_frame(a, idx, shape, k=6):
    """A car seen from above, its nose at heading a (turns, the engine's way:
    0 east, 0.25 north), 16x16, with its shadow down and to the right."""
    big = Image.new("P", (16 * k, 16 * k), 0)
    d = ImageDraw.Draw(big)
    ang = 2 * math.pi * a
    fx, fy = math.cos(ang), -math.sin(ang)       # forward on the screen
    sx, sy = -fy, fx                              # to its right

    def pt(u, v, ox=0.0, oy=0.0):
        return ((8 + ox + fx * u + sx * v) * k, (8 + oy + fy * u + sy * v) * k)

    def quad(u0, u1, v0, v1, c, ox=0.0, oy=0.0):
        d.polygon([pt(u0, v0, ox, oy), pt(u1, v0, ox, oy), pt(u1, v1, ox, oy), pt(u0, v1, ox, oy)], fill=c)

    L = {SEDAN: 6.0, VAN: 6.8, SPORTS: 6.2, POLICE: 6.0}[shape]
    Wd = {SEDAN: 3.0, VAN: 3.2, SPORTS: 3.2, POLICE: 3.0}[shape]
    quad(-L - 0.2, L + 0.2, -Wd - 0.4, Wd + 0.4, idx["car shadow"], 1.2, 1.4)
    for u in (-L + 2.2, L - 2.4):
        quad(u - 1.4, u + 1.4, -Wd - 0.6, Wd + 0.6, idx["tyre"])
    quad(-L, L, -Wd, Wd, idx["body dark"])
    quad(-L + 0.6, L - 0.4, -Wd + 0.4, Wd - 0.4, idx["body"])
    if shape == VAN:
        quad(2.6, 4.4, -2.6, 2.6, idx["glass"])                # windscreen
        quad(-6.0, 2.6, -2.4, 2.4, idx["body light"])           # the long roof
        quad(-5.0, 1.6, -0.4, 0.4, idx["body"])                 # a seam down it
        quad(4.4, 6.4, -2.0, 2.0, idx["body"])
    elif shape == SPORTS:
        quad(0.6, 2.6, -2.4, 2.4, idx["glass"])
        quad(-2.4, -1.0, -2.2, 2.2, idx["glass"])
        quad(-1.0, 0.6, -2.0, 2.0, idx["body light"])
        quad(-6.0, 6.0, -0.8, 0.8, idx["body light"])           # a stripe nose to tail
    else:
        quad(-0.4, 2.4, -2.2, 2.2, idx["glass"])                # windscreen
        quad(-3.6, -1.8, -2.2, 2.2, idx["glass"])               # rear window
        quad(-1.8, -0.4, -2.0, 2.0, idx["body light"])          # roof
        quad(2.4, 5.4, -1.6, 1.6, idx["body light"])            # bonnet
        if shape == POLICE:
            quad(-1.6, -0.6, -2.0, -0.1, idx["siren a"])        # the light bar
            quad(-1.6, -0.6, 0.1, 2.0, idx["siren b"])
    quad(L - 1.1, L + 0.1, -Wd + 0.2, -Wd + 1.7, idx["line white"])   # headlights, big enough to show
    quad(L - 1.1, L + 0.1, Wd - 1.7, Wd - 0.2, idx["line white"])     # at every heading
    quad(-L - 0.1, -L + 0.9, -Wd + 0.2, -Wd + 1.5, idx["door"])        # rear lights
    quad(-L - 0.1, -L + 0.9, Wd - 1.5, Wd - 0.2, idx["door"])
    return big.resize((16, 16), Image.NEAREST)


def write_cars(pal, idx):
    """Four kinds, 32 headings each, 8 across: kind s, frame f at
    ((f % 8) * 16, s * 64 + (f / 8) * 16)."""
    im = Image.new("P", (128, 256), 0)
    im.putpalette(flat(pal))
    for s in range(4):
        for f in range(FRAMES):
            im.paste(car_frame(f / FRAMES, idx, s), ((f % 8) * 16, s * 64 + (f // 8) * 16))
    im.save(os.path.join(CART, "images", "cars.png"))


# ---- people and icons ---------------------------------------------------------------

# a person in the same slant as the buildings, 8x8: hair h, skin k, shirt s,
# its shade d, trousers t. Facing east, north, west and south, three frames
# each: standing and two steps
def _person(head, legs):
    body = ["..dssd..", "..sss...", "..sss..."]
    return head + body + legs


STAND = ["..t.t...", "..t.t..."]
STEP_A = [".t...t..", ".t...t.."]
STEP_B = ["...tt...", "...t.t.."]
FRONT_A = ["..t.t...", "..t....."]
FRONT_B = ["..t.t...", "....t..."]
EAST = ["...hh...", "...hkk..", "...kk..."]
NORTH = ["..hhh...", "..hhh...", "...h...."]
SOUTH = ["..hhh...", "..kkk...", "...k...."]
PEOPLE = [
    [_person(EAST, STAND), _person(EAST, STEP_A), _person(EAST, STEP_B)],
    [_person(NORTH, STAND), _person(NORTH, FRONT_A), _person(NORTH, FRONT_B)],
    [[r[::-1] for r in _person(EAST, STAND)], [r[::-1] for r in _person(EAST, STEP_A)],
     [r[::-1] for r in _person(EAST, STEP_B)]],
    [_person(SOUTH, STAND), _person(SOUTH, FRONT_A), _person(SOUTH, FRONT_B)],
]
DOWN = ["........",
        "........",
        "........",
        "........",
        ".hhsssdt",
        ".hksssdt",
        "........",
        "........"]
ICONS = {
    "star": ["...a....", "...a....", "aaaaaaa.", ".aaaaa..", "..aaa...", ".aa.aa..", ".a...a..", "........"],
    "star off": ["...b....", "...b....", "bb...bb.", ".b...b..", "..b.b...", ".bb.bb..", ".b...b..", "........"],
    "tape": ["........", "cccccccc", "cddddddc", "cd.dd.dc", "cddddddc", "cceeeecc", "cccccccc", "........"],
    "parcel": ["........", ".ffffff.", ".fgffgf.", ".gggggg.", ".fgffgf.", ".fgffgf.", ".ffffff.", "........"],
    "phone": ["..cccc..", ".c....c.", ".cc..cc.", "...cc...", "..cccc..", ".cc..cc.", ".cccccc.", "........"],
    "spray": ["...cc...", "..c..c..", "..cccc..", "..cddc..", "..cddc..", "..cddc..", "..cccc..", "........"],
    "flag": [".cc.....", ".cdddd..", ".cddd...", ".cdddd..", ".c......", ".c......", ".c......", "........"],
    "person": ["...hh...", "..hkkh..", "...kk...", ".sssss..", "..sss...", "..t.t...", "..t.t...", "........"],
}


def write_people(pal, idx):
    """people.png, 128x16: a person facing east, north, west and south, three
    frames each (sprites 0 to 11), knocked down, head west and head east (12,
    13); then the icons from 16."""
    im = Image.new("P", (128, 16), 0)
    im.putpalette(flat(pal))
    px = im.load()
    key = {"s": idx["shirt"], "d": idx["shirt dark"], "h": idx["hair"], "k": idx["skin"], "t": idx["trousers"]}

    def put(grid, n, turns=0):
        g = [list(r) for r in grid]
        for _ in range(turns):                     # a quarter turn to the left each
            g = [list(r) for r in zip(*g)][::-1]
        ox, oy = (n % 16) * 8, (n // 16) * 8
        for y in range(8):
            for x in range(8):
                c = g[y][x]
                if c != ".":
                    px[ox + x, oy + y] = key[c] if c in key else c

    for d in range(4):
        for f in range(3):
            put(PEOPLE[d][f], d * 3 + f)
    put(DOWN, 12)
    put([r[::-1] for r in DOWN], 13)
    icon = {"a": 10, "b": 5, "c": 7, "d": 1, "e": 9, "f": 9, "g": 4}
    for n, name in enumerate(["star", "star off", "tape", "parcel", "phone", "spray", "flag", "person"]):
        put([[icon.get(c, c) if c != "." else "." for c in row] for row in ICONS[name]], 16 + n)
    im.save(os.path.join(CART, "images", "people.png"))


# ---- writing ---------------------------------------------------------------------

def write(pal, idx, tiles, flags, cells, start):
    for sub in ("maps", "images", "palettes", "data"):
        os.makedirs(os.path.join(CART, sub), exist_ok=True)
    if len(tiles) > 255:
        raise SystemExit("%d tiles: the sheet holds 255" % len(tiles))
    sheet = Image.new("P", (128, 128), 0)
    sheet.putpalette(flat(pal))
    sp = sheet.load()
    for n, block in enumerate(tiles, start=1):
        ox, oy = (n % 16) * S, (n // 16) * S
        for i, c in enumerate(block):
            sp[ox + i % S, oy + i // S] = c
    sheet.save(os.path.join(CART, "sheet.png"))
    with open(os.path.join(CART, "flags.json"), "w") as f:
        json.dump({str(k): v for k, v in sorted(flags.items())}, f, separators=(",", ":"))
    rows = ["".join("%02x" % c for c in row) for row in cells]
    m = {"width": W, "height": H, "rows": rows,
         "objects": [{"kind": "start", "x": start[0], "y": start[1], "w": 8, "h": 8}]}
    with open(os.path.join(CART, "maps", "city.json"), "w") as f:
        json.dump(m, f, separators=(",", ":"))
    old = os.path.join(CART, "maps", "oldtown.json")
    if os.path.exists(old):
        os.remove(old)
    lines = ["GIMP Palette", "Name: city", "Columns: 16", "#"]
    for i, c in enumerate(pal):
        lines.append("%3d %3d %3d\tc%d" % ((c >> 16) & 255, (c >> 8) & 255, c & 255, i))
    with open(os.path.join(CART, "palettes", "city.gpl"), "w") as f:
        f.write("\n".join(lines) + "\n")


def write_citymap(p, pal, idx):
    """The city at a pixel for two cells, for the map screen."""
    style = {}
    for (x0, y0, x1, y1, st, rows) in p.plots:
        for y in range(y0, y1):
            for x in range(x0, x1):
                style[(x, y)] = st
    col = {ROAD: idx["asphalt light"], WALK: idx["walk"], PARK: idx["grass"], TREE: idx["tree"],
           WATER: idx["water"], PARKING: idx["parking"], PLAZA: idx["walk light"], SAND: idx["sand"],
           WOOD: idx["wood"], YARD: idx["parking"], BOX: idx["box red"], FOUNTAIN: idx["water light"],
           PALM: idx["palm"], RAIL: idx["rail"]}
    im = Image.new("P", (W // 2, H // 2), 0)
    im.putpalette(flat(pal))
    px = im.load()
    for y in range(H // 2):
        for x in range(W // 2):
            kinds = [p.kind[y * 2 + dy][x * 2 + dx] for dx in (0, 1) for dy in (0, 1)]
            k = ROAD if ROAD in kinds else kinds[0]
            if k == BUILD:
                px[x, y] = idx["roof " + ROOFS[style.get((x * 2, y * 2), 0)][0]] + 2
            else:
                px[x, y] = col[k]
    im.save(os.path.join(CART, "images", "citymap.png"))


def write_logo(pal, idx, city):
    crop = city.crop((54 * S - 20, 54 * S - 20, 54 * S + 68, 54 * S + 68)).resize((44, 44), Image.NEAREST)
    crop.putpalette(flat(pal))
    car = car_frame(0.125, idx, SEDAN).resize((24, 24), Image.NEAREST)
    crop.paste(car, (10, 10), mask=Image.eval(car.convert("L"), lambda v: 255 if v else 0))
    crop.save(os.path.join(CART, "logo.png"))


# palette entries the cart's code names: keep these in step with car.js,
# traffic.js and people.js
FIXED = {"body light": 42, "siren a": 68, "siren b": 69, "hair": 64, "shirt": 65, "shirt dark": 66,
         "trousers": 67, "paint red": 112, "paint police": 130, "look 0": 136}


def main():
    pal, idx = palette()
    for name, n in FIXED.items():
        if idx[name] != n:
            raise SystemExit("palette: %s is %d, the code says %d" % (name, idx[name], n))
    p = plan()
    city = paint(p, idx)
    city.putpalette(flat(pal))
    tiles, flags, cells = cut(city, p.kind)
    by = {}
    for row_k, row_c in zip(p.kind, cells):
        for kk, cc in zip(row_k, row_c):
            by.setdefault(kk, set()).add(cc)
    print("tiles by kind:", {KIND_NAMES[kk]: len(v) for kk, v in sorted(by.items())})
    # the start: on the avenue's northbound lane, a little south of the middle of Old Town
    start = (56 * S + 8, 66 * S)
    write(pal, idx, tiles, flags, cells, start)
    net = network(p)
    with open(os.path.join(CART, "data", "roads.json"), "w") as f:
        json.dump(net, f, separators=(",", ":"))
    rnd = random.Random(11)
    givers, job_list = jobs(p, net, rnd)
    tape_list = tapes(p, rnd)
    bays = parking(p)
    shops = [centre(spots_near_street(p, d, rnd, 1, avoid=[(g[0] // S, g[1] // S) for g in givers], spacing=20)[0])
             for d in range(len(DISTRICTS))]
    info = {
        "names": [d[0] for d in DISTRICTS],
        "zones": [v for d in DISTRICTS for v in d[1]],
        "gx": [g[0] for g in givers], "gy": [g[1] for g in givers],
        "jobs": job_list,
        "tx": [t[0] for t in tape_list], "ty": [t[1] for t in tape_list],
        "px": [b[0] for b in bays], "py": [b[1] for b in bays], "ph": [b[2] for b in bays],
        "sx": [s[0] for s in shops], "sy": [s[1] for s in shops],
    }
    with open(os.path.join(CART, "data", "city.json"), "w") as f:
        json.dump(info, f, separators=(",", ":"))
    write_cars(pal, idx)
    write_people(pal, idx)
    write_citymap(p, pal, idx)
    write_logo(pal, idx, city)
    print("city: %dx%d cells, %d tiles, %d buildings, %d colours, %d junctions (%d with lights), "
          "%d jobs, %d tapes, %d bays" % (W, H, len(tiles), len(p.plots), len(pal), len(net["nx"]),
                                          sum(net["sig"]), len(job_list), len(tape_list), len(bays)))
    # the whole city as one picture, for looking at (dist/ isn't kept in git)
    dist = os.path.join(HERE, "..", "dist")
    if os.path.isdir(dist):
        city.convert("RGB").save(os.path.join(dist, "pocketcity_city.png"))


if __name__ == "__main__":
    main()
