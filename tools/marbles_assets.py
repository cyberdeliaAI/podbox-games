"""Builds Marble Chain's assets: the three tracks, their backgrounds, the
sprite sheet and the logo.

    python3 tools/marbles_assets.py

Writes into marbles/: data/path1.json to path3.json (a track as one point a
pixel of its length), images/bg1.png to bg3.png, sheet.png and logo.png.
Every picture uses the Arcade's standard sixteen colours.
"""
import json
import math
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CART = os.path.join(HERE, "..", "marbles")

PAL = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
       0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]
FLAT = []
for c in PAL:
    FLAT += [(c >> 16) & 255, (c >> 8) & 255, c & 255]

W, H = 160, 120
SHOOTER = (80, 60)


# ---- the tracks ----------------------------------------------------------------

def spiral():
    """Track 1: an elliptical spiral that comes in at the left edge and winds
    clockwise round the shooter, closing in on it."""
    pts = []
    cx, cy = SHOOTER
    turns = 1.75
    a0 = math.radians(160)
    steps = 6000
    for i in range(steps + 1):
        t = i / steps
        a = a0 + t * turns * 2 * math.pi
        rx = 90 - 60 * t
        ry = 62 - 40 * t
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    return pts


def rounded(corners, r):
    """A polyline through the corners with each turn cut by a curve of about
    radius r."""
    out = [corners[0]]
    for k in range(1, len(corners) - 1):
        (x0, y0), (x1, y1), (x2, y2) = corners[k - 1], corners[k], corners[k + 1]
        d0 = math.hypot(x1 - x0, y1 - y0)
        d2 = math.hypot(x2 - x1, y2 - y1)
        rr = min(r, d0 / 2, d2 / 2)
        ax, ay = x1 + (x0 - x1) * rr / d0, y1 + (y0 - y1) * rr / d0
        bx, by = x1 + (x2 - x1) * rr / d2, y1 + (y2 - y1) * rr / d2
        for i in range(0, 25):
            t = i / 24
            px = (1 - t) ** 2 * ax + 2 * (1 - t) * t * x1 + t * t * bx
            py = (1 - t) ** 2 * ay + 2 * (1 - t) * t * y1 + t * t * by
            out.append((px, py))
    out.append(corners[-1])
    return out


def zigzag():
    """Track 2: a serpentine. Two rows along the top, down the left edge,
    two rows along the bottom, with the shooter in the open band between."""
    return rounded([(-6, 16), (146, 16), (146, 38), (14, 38), (14, 82),
                    (146, 82), (146, 104), (70, 104)], 11)


def square():
    """Track 3: a rounded square spiral, two rings deep."""
    return rounded([(-6, 12), (150, 12), (150, 108), (10, 108), (10, 34),
                    (128, 34), (128, 86), (32, 86), (32, 56)], 10)


def resample(pts, step=1.0):
    """Points every `step` pixels along the curve."""
    out = [pts[0]]
    acc = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        while acc + seg >= step:
            t = (step - acc) / seg
            x0, y0 = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            out.append((x0, y0))
            seg = math.hypot(x1 - x0, y1 - y0)
            acc = 0.0
        acc += seg
    return out


def reach_map(xs, ys):
    """Which 8 pixel squares of the screen lie within 8 pixels of the track
    (20 by 15 of them, row by row): a shot elsewhere cannot hit a ball."""
    out = []
    for cy in range(15):
        for cx in range(20):
            x0, y0, x1, y1 = cx * 8, cy * 8, cx * 8 + 7, cy * 8 + 7
            hit = 0
            for x, y in zip(xs, ys):
                dx = max(x0 - x, 0, x - x1)
                dy = max(y0 - y, 0, y - y1)
                if dx * dx + dy * dy <= 64:
                    hit = 1
                    break
            out.append(hit)
    return out


def write_track(n, curve):
    pts = resample(curve)
    xs = [int(round(x)) for x, _ in pts]
    ys = [int(round(y)) for _, y in pts]
    os.makedirs(os.path.join(CART, "data"), exist_ok=True)
    with open(os.path.join(CART, "data", "path%d.json" % n), "w") as f:
        json.dump({"x": xs, "y": ys, "near": reach_map(xs, ys)}, f, separators=(",", ":"))
    return pts


# ---- pictures ------------------------------------------------------------------

def new(w, h, c=0):
    im = Image.new("P", (w, h), c)
    im.putpalette(FLAT)
    return im


def write_background(n, pts, ground, speck, lip, hole):
    """The playfield: textured ground, the groove the chain rolls in, the
    hole at its end and the gun's pad."""
    im = new(W, H, ground)
    px = im.load()
    for y in range(H):
        for x in range(W):
            if (x * 7 + y * 13) % 29 == 0 or (x * 11 + y * 5) % 37 == 0:
                px[x, y] = speck[(x + y) % 3 != 0]
    d = ImageDraw.Draw(im)
    for x, y in pts[::2]:
        d.ellipse([x - 5.5, y - 5.5, x + 5.5, y + 5.5], fill=lip)
    for x, y in pts[::2]:
        d.ellipse([x - 4.5, y - 4.5, x + 4.5, y + 4.5], fill=0)
    # a stone arch where the chain comes in
    sx, sy = pts[0]
    d.rectangle([0, sy - 7, 3, sy + 7], fill=5)
    d.rectangle([0, sy - 5, 1, sy + 5], fill=0)
    # the hole at the end
    hx, hy = pts[-1]
    d.ellipse([hx - 8, hy - 8, hx + 8, hy + 8], fill=hole)
    d.ellipse([hx - 6, hy - 6, hx + 6, hy + 6], fill=2)
    d.ellipse([hx - 4, hy - 4, hx + 4, hy + 4], fill=0)
    # the gun's pad
    cx, cy = SHOOTER
    d.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=lip)
    d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=1)
    d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=0)
    os.makedirs(os.path.join(CART, "images"), exist_ok=True)
    im.save(os.path.join(CART, "images", "bg%d.png" % n))
    return im


# A 7x7 ball: 1 body, 2 highlight, 3 shade, 0 clear
BALL = [
    "0011100",
    "0122110",
    "1221113",
    "1211113",
    "1111133",
    "0111330",
    "0033300",
]
# Its colours, for sprites 1 to 6: body, highlight, shade
COLOURS = [
    (8, 15, 2),    # red
    (10, 7, 9),    # yellow
    (11, 7, 3),    # green
    (12, 7, 1),    # blue
    (14, 7, 2),    # pink
    (9, 15, 4),    # orange
]
# A smaller ball, for one that is popping
SMALL = [
    "0000000",
    "0001000",
    "0012100",
    "0121110",
    "0011100",
    "0001000",
    "0000000",
]
# The marks on a power-up ball, 5x5 (1 backing, 7 white), drawn over the
# ball: slow (an hourglass), back (an arrow) and bomb (a burst)
GLYPHS = [
    ["11111",
     "17771",
     "11711",
     "17771",
     "11111"],
    ["11711",
     "17711",
     "77777",
     "17711",
     "11711"],
    ["17171",
     "71717",
     "17771",
     "71717",
     "17171"],
]


def put(sheet, n, rows, body, light, shade):
    ox, oy = (n % 16) * 8, (n // 16) * 8
    px = sheet.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "0":
                px[ox + x, oy + y] = {"1": body, "2": light, "3": shade}[ch]


def put_glyph(sheet, n, rows):
    ox, oy = (n % 16) * 8 + 1, (n // 16) * 8 + 1
    px = sheet.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            px[ox + x, oy + y] = int(ch) if ch == "1" else 7


def gun_picture(turns):
    """The gun, 16x16, its barrel pointing `turns` of a turn counter-clockwise
    from the right: a round body and a barrel."""
    g = new(16, 16, 0)
    d = ImageDraw.Draw(g)
    d.ellipse([1, 1, 14, 14], fill=11)
    d.ellipse([2, 2, 13, 13], fill=3)
    d.ellipse([3, 3, 7, 6], fill=11)
    a = turns * 2 * math.pi
    ux, uy = math.cos(a), -math.sin(a)       # along the barrel (y points down)
    vx, vy = -uy, ux                          # across it
    cx = cy = 7.5

    def quad(r0, r1, w, fill):
        pts = []
        for r, side in ((r0, -1), (r1, -1), (r1, 1), (r0, 1)):
            pts.append((cx + ux * r + vx * w * side, cy + uy * r + vy * w * side))
        d.polygon(pts, fill=fill)

    quad(2.0, 7.9, 2.0, 5)
    quad(6.0, 7.9, 2.3, 6)
    return g


# The gun turned to 32 directions: block b, 2x2 tiles, starts at tile
# 64 + (b // 8) * 32 + (b % 8) * 2
def put_guns(sheet):
    for b in range(32):
        n = 64 + (b // 8) * 32 + (b % 8) * 2
        sheet.paste(gun_picture(b / 32.0), ((n % 16) * 8, (n // 16) * 8))


def write_sheet():
    sheet = new(128, 128, 0)
    for i, (b, l, s) in enumerate(COLOURS):
        put(sheet, 1 + i, BALL, b, l, s)
        put(sheet, 17 + i, SMALL, b, 7, s)
    for i, rows in enumerate(GLYPHS):
        put_glyph(sheet, 25 + i, rows)
    put_guns(sheet)
    sheet.save(os.path.join(CART, "sheet.png"))
    return sheet


def write_logo(pts):
    big = new(176, 176, 1)
    d = ImageDraw.Draw(big)
    k = 176 / 160.0
    # the spiral of balls, cropped to the middle of the screen
    cols = [8, 10, 11, 12, 14, 9]
    i = 0
    for x, y in pts[60::7]:
        X, Y = (x - 80) * 1.25 * k + 88, (y - 60) * 1.25 * k + 88
        if -10 < X < 186 and -10 < Y < 186:
            c = cols[(i // 2) % 4]
            d.ellipse([X - 7, Y - 7, X + 7, Y + 7], fill=c)
            d.ellipse([X - 4, Y - 5, X - 1, Y - 2], fill=7)
        i += 1
    # the shooter
    d.ellipse([70, 70, 106, 106], fill=3)
    d.ellipse([76, 76, 100, 100], fill=11)
    d.ellipse([82, 58, 94, 70], fill=12)
    small = big.resize((44, 44), Image.NEAREST)
    small.putpalette(FLAT)
    small.save(os.path.join(CART, "logo.png"))


def main():
    p1 = write_track(1, spiral())
    p2 = write_track(2, zigzag())
    p3 = write_track(3, square())
    #                 ground  speck       groove lip  hole ring
    write_background(1, p1, 1, (13, 5), 13, 5)
    write_background(2, p2, 4, (15, 5), 15, 5)
    write_background(3, p3, 3, (6, 5), 6, 5)
    write_sheet()
    write_logo(p1)
    print("tracks", len(p1), len(p2), len(p3), "px")


if __name__ == "__main__":
    main()
