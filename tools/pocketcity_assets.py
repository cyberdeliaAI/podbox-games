"""Builds Pocket City 3D's city and art.

    python3 tools/pocketcity_assets.py

It paints the district as one picture first, pixel by pixel, from a plan
of cells (roads, sidewalks, buildings, park, water), then cuts it into 8x8
tiles and keeps each different tile once. So the city can be drawn freely
and still fits the sheet's 256 sprites: the tiles are whatever the picture
needs. It writes into pocketcity/:

    sheet.png               the tiles, colour 0 never used (the scroll buffer
                            copies them opaque)
    flags.json              each tile's flags: solid, water, grass, walk, road
    maps/oldtown.json       the district: one tile number a cell, and the start
    images/cars.png         the cars, 32 headings each, 16x16 a frame, a sheet
                            of their own
    palettes/city.gpl       the palette
    logo.png

The look is a fixed, gentle 2.5D: every building's roof is drawn on its
plot with its south wall below it, windows and a door, and its shadow
falls on the ground to the east, the sun being in the north-west. Nothing
moves in it at run time, so it costs nothing to draw: the city stays a flat
grid of cells for driving and collisions.
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
]
# roofs: shade, middle, light, rim; and the wall below them
ROOFS = [
    ("grey", [0x5e5e6a, 0x74747e, 0x8c8c96, 0xa8a8b0], 0x9a8e86),
    ("terracotta", [0x7a3a2a, 0x9a4a32, 0xb4603e, 0xc87a54], 0xc8b49a),
    ("slate", [0x34405a, 0x44506e, 0x56648a, 0x7080a4], 0xb0a898),
    ("sand", [0x8a7a5a, 0xa6946c, 0xbcaa80, 0xd2c296], 0xa8907a),
]

S = 8                              # pixels a cell
W = H = 128                        # cells, the district


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
    return pal, idx


def blend(c, to, t):
    out = 0
    for sh in (16, 8, 0):
        a, b = (c >> sh) & 255, (to >> sh) & 255
        out |= int(round(a + (b - a) * t)) << sh
    return out


# ---- the plan ------------------------------------------------------------------

ROAD, WALK, BUILD, PARK, TREE, WATER, PARKING, PLAZA = range(8)
STREET = 4                         # cells across a street: two lanes of two
ALLEY = 2


def plan():
    """The district as cells: what each is, and the buildings as plots."""
    kind = [[WATER] * W for _ in range(H)]
    lanes = [[None] * W for _ in range(H)]   # for markings: 'v' or 'h' street, and the cell's place across it
    land = (6, 6, W - 6, H - 6)
    for y in range(land[1], land[3]):
        for x in range(land[0], land[2]):
            kind[y][x] = WALK
    # streets: a ring along the shore, then a grid, the middle one an avenue
    xs = [6, 30, 54, 78, 102, W - 6 - STREET]
    ys = [6, 30, 54, 78, 102, H - 6 - STREET]
    for sx in xs:
        for y in range(land[1], land[3]):
            for i in range(STREET):
                kind[y][sx + i] = ROAD
                lanes[y][sx + i] = ("v", i) if lanes[y][sx + i] is None else ("x", 0)
    for sy in ys:
        for x in range(land[0], land[2]):
            for i in range(STREET):
                k = lanes[sy + i][x]
                kind[sy + i][x] = ROAD
                lanes[sy + i][x] = ("h", i) if k is None else ("x", 0)
    rnd = random.Random(5)
    plots = []
    # each block inside the streets: a sidewalk ring, then what's in it
    for bi in range(len(xs) - 1):
        for bj in range(len(ys) - 1):
            x0, x1 = xs[bi] + STREET, xs[bi + 1]
            y0, y1 = ys[bj] + STREET, ys[bj + 1]
            ix0, iy0, ix1, iy1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
            use = "park" if (bi, bj) == (3, 1) else "parking" if (bi, bj) == (1, 3) else \
                  "plaza" if (bi, bj) == (2, 2) else "town"
            if use == "park":
                for y in range(iy0, iy1):
                    for x in range(ix0, ix1):
                        kind[y][x] = PARK
                # paths across, and trees
                for x in range(ix0, ix1):
                    kind[(iy0 + iy1) // 2][x] = WALK
                for y in range(iy0, iy1):
                    kind[y][(ix0 + ix1) // 2] = WALK
                for _ in range(40):
                    tx, ty = rnd.randrange(ix0, ix1 - 1), rnd.randrange(iy0, iy1 - 1)
                    if all(kind[ty + dy][tx + dx] == PARK for dx in (0, 1) for dy in (0, 1)):
                        for dx in (0, 1):
                            for dy in (0, 1):
                                kind[ty + dy][tx + dx] = TREE
                continue
            if use == "parking":
                for y in range(iy0, iy1):
                    for x in range(ix0, ix1):
                        kind[y][x] = PARKING
                continue
            if use == "plaza":
                for y in range(iy0, iy1):
                    for x in range(ix0, ix1):
                        kind[y][x] = PLAZA
                for (tx, ty) in [(ix0 + 2, iy0 + 2), (ix1 - 4, iy0 + 2), (ix0 + 2, iy1 - 4), (ix1 - 4, iy1 - 4)]:
                    for dx in (0, 1):
                        for dy in (0, 1):
                            kind[ty + dy][tx + dx] = TREE
                continue
            # a town block: an alley through it now and then, plots either side
            parts = [(ix0, iy0, ix1, iy1)]
            if rnd.random() < 0.6:
                if rnd.random() < 0.5:
                    ax = (ix0 + ix1) // 2 - 1
                    for y in range(y0, y1):
                        for i in range(ALLEY):
                            kind[y][ax + i] = ROAD
                            lanes[y][ax + i] = ("a", i)
                    parts = [(ix0, iy0, ax - 1, iy1), (ax + ALLEY + 1, iy0, ix1, iy1)]
                    for y in range(y0, y1):
                        kind[y][ax - 1] = WALK
                        kind[y][ax + ALLEY] = WALK
                else:
                    ay = (iy0 + iy1) // 2 - 1
                    for x in range(x0, x1):
                        for i in range(ALLEY):
                            kind[ay + i][x] = ROAD
                            lanes[ay + i][x] = ("b", i)
                    parts = [(ix0, iy0, ix1, ay - 1), (ix0, ay + ALLEY + 1, ix1, iy1)]
                    for x in range(x0, x1):
                        kind[ay - 1][x] = WALK
                        kind[ay + ALLEY][x] = WALK
            for (px0, py0, px1, py1) in parts:
                plots += split(px0, py0, px1, py1, rnd)
    for (px0, py0, px1, py1, style, tall) in plots:
        for y in range(py0, py1):
            for x in range(px0, px1):
                kind[y][x] = BUILD
    return kind, lanes, plots


def split(x0, y0, x1, y1, rnd):
    """A lot cut into buildings of 4 to 9 cells across."""
    out = []
    x = x0
    while x < x1:
        w = min(x1 - x, rnd.randrange(4, 10))
        if x1 - (x + w) < 4:
            w = x1 - x
        out.append((x, y0, x + w, y1, rnd.randrange(len(ROOFS)), rnd.random() < 0.35))
        x += w
    return out


# ---- painting ------------------------------------------------------------------

def paint(kind, lanes, plots, idx):
    img = Image.new("P", (W * S, H * S), idx["water"])
    px = img.load()
    rnd = random.Random(9)
    k = lambda x, y: kind[y][x] if 0 <= x < W and 0 <= y < H else WATER
    for cy in range(H):
        for cx in range(W):
            t = kind[cy][cx]
            for y in range(S):
                for x in range(S):
                    px[cx * S + x, cy * S + y] = ground(t, cx, cy, x, y, idx, k, lanes)
    # buildings: roof on the plot, the south wall's rows below it
    for (x0, y0, x1, y1, style, tall) in plots:
        name = ROOFS[style][0]
        r = idx["roof " + name]
        wall = idx["wall " + name]
        rows = 2 if tall else 1
        X0, Y0, X1, Y1 = x0 * S, y0 * S, x1 * S, y1 * S
        wall_top = Y1 - rows * S
        for y in range(Y0, wall_top):
            for x in range(X0, X1):
                edge = x == X0 or x == X1 - 1 or y == Y0
                inner = x == X0 + 1 or y == Y0 + 1
                px[x, y] = r + 3 if edge else r + 2 if inner else r + 1
            # a darker band across the roof every other cell: the roof's sheets
        for y in range(Y0 + S, wall_top, 2 * S):
            for x in range(X0 + 1, X1 - 1):
                px[x, y] = r
        # a vent or two on the bigger roofs
        if (x1 - x0) >= 6 and (wall_top - Y0) >= 2 * S:
            vx, vy = X0 + 2 * S + 2, Y0 + S + 2
            for y in range(vy, vy + 4):
                for x in range(vx, vx + 4):
                    px[x, y] = r + 2 if y == vy else r
        for y in range(wall_top, Y1):
            for x in range(X0, X1):
                gx, gy = (x - X0) % S, (y - wall_top) % S
                win = 2 <= gx <= 5 and 2 <= gy <= 5
                px[x, y] = wall + 1 if y == wall_top else (idx["glass light"] if gy == 2 and win else idx["glass"]) if win else wall
        # a door in the middle of the bottom row
        dx = X0 + ((x1 - x0) // 2) * S
        for y in range(Y1 - 6, Y1):
            for x in range(dx + 2, dx + 6):
                px[x, y] = idx["door"]
    # shadows to the east of each building, a cell wide, a cell down
    shade = {idx["asphalt"]: idx["shade asphalt"], idx["asphalt dark"]: idx["shade asphalt"],
             idx["asphalt light"]: idx["shade asphalt"], idx["walk"]: idx["shade walk"],
             idx["walk light"]: idx["shade walk"], idx["kerb"]: idx["shade asphalt"],
             idx["grass"]: idx["shade grass"], idx["grass light"]: idx["shade grass"],
             idx["grass dark"]: idx["shade grass"], idx["parking"]: idx["shade asphalt"],
             idx["line white"]: idx["walk"], idx["line yellow"]: idx["kerb"]}
    for (x0, y0, x1, y1, style, tall) in plots:
        if x1 >= W or kind[y0][x1] == BUILD:
            continue
        for cy in range(y0 + 1, min(H, y1 + 1)):
            if kind[cy][x1] == BUILD:
                continue
            for y in range(S):
                for x in range(S):
                    p = (x1 * S + x, cy * S + y)
                    px[p] = shade.get(px[p], px[p])
    # tree shadows, then the crowns over them
    for cy in range(H - 1):
        for cx in range(W - 1):
            if kind[cy][cx] == TREE and kind[cy][cx - 1] != TREE and kind[cy - 1][cx] != TREE:
                for y in range(4, 2 * S + 4):
                    for x in range(4, 2 * S + 4):
                        if (x - 11) ** 2 + (y - 11) ** 2 < 49:
                            p = (cx * S + x, cy * S + y)
                            if p[0] < W * S and p[1] < H * S:
                                px[p] = shade.get(px[p], px[p])
                for y in range(2 * S):
                    for x in range(2 * S):
                        d = (x - 7.5) ** 2 + (y - 7.5) ** 2
                        if d < 49:
                            lit = (x - 5) ** 2 + (y - 5) ** 2 < 12
                            px[cx * S + x, cy * S + y] = idx["tree light"] if lit else idx["tree"] if d < 30 else idx["tree dark"]
    return img


def ground(t, cx, cy, x, y, idx, k, lanes):
    """One pixel of a cell's ground."""
    if t == WATER:
        # the quay along the land, ripples on the water
        if k(cx, cy - 1) not in (WATER,) and y <= 1:
            return idx["quay"]
        if k(cx - 1, cy) not in (WATER,) and x <= 1:
            return idx["quay"]
        if k(cx + 1, cy) not in (WATER,) and x >= 6:
            return idx["quay"]
        if k(cx, cy + 1) not in (WATER,) and y >= 6:
            return idx["quay"]
        return idx["water light"] if (x + 3 * y + (cx + cy) % 3 * 5) % 17 == 0 else idx["water"]
    if t in (WALK, PLAZA):
        # slabs, with the kerb along a road
        if k(cx, cy - 1) in (ROAD,) and y == 0 or k(cx, cy + 1) in (ROAD,) and y == 7 or \
           k(cx - 1, cy) in (ROAD,) and x == 0 or k(cx + 1, cy) in (ROAD,) and x == 7:
            return idx["kerb"]
        if t == PLAZA:
            return idx["walk light"] if (x + y) % 4 == 0 else idx["walk"]
        return idx["walk light"] if x == 0 or y == 0 else idx["walk"]
    if t in (PARK, TREE):
        return idx["grass light"] if (x * 3 + y * 5 + (cx + 2 * cy) % 3 * 4) % 11 == 0 else idx["grass"]
    if t == PARKING:
        if x == 0 and cy % 3 != 0:
            return idx["line white"]
        if y == 0 and cy % 3 == 0:
            return idx["line white"]
        return idx["parking"]
    # roads: asphalt, the centre line, zebra crossings by the junctions
    ln = lanes[cy][cx]
    c = idx["asphalt"] if (x * 7 + y * 3 + (cx + cy) % 2 * 6) % 13 else idx["asphalt light"]
    if ln is None:
        return c
    kind_, i = ln
    if kind_ == "x":
        return c
    if kind_ == "v":
        if near_junction(cx, cy, lanes, 0, 1):
            return idx["line white"] if (y % 4) < 2 and 1 <= x <= 6 else c
        if (i == 1 and x == 7 or i == 2 and x == 0) and (y + cy * 8) % 8 < 5:
            return idx["line yellow"]
        return c
    if kind_ == "h":
        if near_junction(cx, cy, lanes, 1, 0):
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


def cut(img, kind):
    """Each different 8x8 tile once; the map as tile numbers, from 1."""
    px = img.load()
    tiles, seen, cells = [], {}, []
    flags = {}
    for cy in range(H):
        row = []
        for cx in range(W):
            block = tuple(px[cx * S + x, cy * S + y] for y in range(S) for x in range(S))
            t = kind[cy][cx]
            f = {BUILD: SOLID, WATER: SOLID | WATERF, TREE: SOLID | GRASS, PARK: GRASS,
                 WALK: WALKF, PLAZA: WALKF, ROAD: ROADF, PARKING: ROADF}[t]
            key = (block, f)
            if key not in seen:
                seen[key] = len(tiles) + 1
                tiles.append(block)
                flags[seen[key]] = f
            row.append(seen[key])
        cells.append(row)
    return tiles, flags, cells


# ---- the cars --------------------------------------------------------------------

FRAMES = 32


def car_frame(a, idx, k=6):
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

    quad(-6.2, 6.2, -3.4, 3.4, idx["car shadow"], 1.2, 1.4)       # the shadow
    for u in (-3.8, 3.6):                                          # tyres
        quad(u - 1.4, u + 1.4, -3.6, 3.6, idx["tyre"])
    quad(-6.0, 6.0, -3.0, 3.0, idx["body dark"])                  # the body
    quad(-5.4, 5.6, -2.6, 2.6, idx["body"])
    quad(-0.4, 2.4, -2.2, 2.2, idx["glass"])                      # windscreen
    quad(-3.6, -1.8, -2.2, 2.2, idx["glass"])                     # rear window
    quad(-1.8, -0.4, -2.0, 2.0, idx["body light"])                # roof
    quad(2.4, 5.4, -1.6, 1.6, idx["body light"])                  # bonnet
    quad(4.9, 6.1, -2.8, -1.3, idx["line white"])                 # headlights, big enough to show
    quad(4.9, 6.1, 1.3, 2.8, idx["line white"])                   # at every heading
    quad(-6.1, -5.1, -2.8, -1.5, idx["door"])                     # rear lights
    quad(-6.1, -5.1, 1.5, 2.8, idx["door"])
    return big.resize((16, 16), Image.NEAREST)


def write_cars(pal, idx):
    """32 headings across 2 rows of 16: frame f at (f % 8) * 16, (f / 8) * 16."""
    im = Image.new("P", (128, 64), 0)
    im.putpalette(flat(pal))
    for f in range(FRAMES):
        im.paste(car_frame(f / FRAMES, idx), ((f % 8) * 16, (f // 8) * 16))
    im.save(os.path.join(CART, "images", "cars.png"))


# ---- writing ---------------------------------------------------------------------

def write(pal, idx, tiles, flags, cells, start):
    os.makedirs(os.path.join(CART, "maps"), exist_ok=True)
    os.makedirs(os.path.join(CART, "images"), exist_ok=True)
    os.makedirs(os.path.join(CART, "palettes"), exist_ok=True)
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
    with open(os.path.join(CART, "maps", "oldtown.json"), "w") as f:
        json.dump(m, f, separators=(",", ":"))
    lines = ["GIMP Palette", "Name: city", "Columns: 16", "#"]
    for i, c in enumerate(pal):
        lines.append("%3d %3d %3d\tc%d" % ((c >> 16) & 255, (c >> 8) & 255, c & 255, i))
    with open(os.path.join(CART, "palettes", "city.gpl"), "w") as f:
        f.write("\n".join(lines) + "\n")


def write_logo(pal, idx, city):
    crop = city.crop((54 * S - 20, 54 * S - 20, 54 * S + 68, 54 * S + 68)).resize((44, 44), Image.NEAREST)
    crop.putpalette(flat(pal))
    car = car_frame(0.125, idx).resize((24, 24), Image.NEAREST)
    crop.paste(car, (10, 10), mask=Image.eval(car.convert("L"), lambda v: 255 if v else 0))
    crop.save(os.path.join(CART, "logo.png"))


def main():
    pal, idx = palette()
    kind, lanes, plots = plan()
    city = paint(kind, lanes, plots, idx)
    city.putpalette(flat(pal))
    tiles, flags, cells = cut(city, kind)
    by = {}
    for row_k, row_c in zip(kind, cells):
        for kk, cc in zip(row_k, row_c):
            by.setdefault(kk, set()).add(cc)
    print("tiles by kind:", {["road", "walk", "build", "park", "tree", "water", "parking", "plaza"][kk]: len(v) for kk, v in by.items()})
    # the start: on the avenue's left lane, a little south of the middle, heading north
    start = (54 * S + 4, 66 * S)
    write(pal, idx, tiles, flags, cells, start)
    write_cars(pal, idx)
    write_logo(pal, idx, city)
    print("oldtown: %dx%d cells, %d tiles, %d buildings, %d colours" % (W, H, len(tiles), len(plots), len(pal)))
    # the whole district as one picture, for looking at (dist/ isn't kept in git)
    dist = os.path.join(HERE, "..", "dist")
    if os.path.isdir(dist):
        city.convert("RGB").save(os.path.join(dist, "pocketcity_oldtown.png"))


if __name__ == "__main__":
    main()
