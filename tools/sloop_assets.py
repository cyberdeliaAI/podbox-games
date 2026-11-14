"""Builds Sloop's art.

    python3 tools/sloop_assets.py

It writes sloop/sheet.png (the blocks, their cracks, the gold block, the
hearts and the wrecking ball) and sloop/logo.png, in the Arcade's standard
sixteen colours, colour 0 clear. Where things are on the sheet is listed
below and in blocks.js and hud.js.
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CART = os.path.join(HERE, "..", "sloop")

STANDARD = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
            0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]

# where things are on the sheet (the game has the same numbers)
PIECE = 1                          # a small block, 5x5 in the cell's top left
HEAVY = 2                          # a heavy block, 8x8; then cracked once and twice: 3, 4
GOLD = 5                           # the gold block, 6x6
HEART = 6                          # a heart, 7x6; then an empty one: 7
BALL = 8                           # the wrecking ball, 8x8
GLOW_PIECE = 9                     # a piece about to land, lit up
GLOW_HEAVY = 10                    # ...a heavy one
HALF_HEART = 11                    # half a heart


def flat(colours):
    out = []
    for c in colours:
        out += [(c >> 16) & 255, (c >> 8) & 255, c & 255]
    return out + [0] * (768 - len(out))


def cell():
    return Image.new("P", (8, 8), 0)


def piece(glow=False):
    im = cell()
    px = im.load()
    for y in range(5):
        for x in range(5):
            edge = x == 0 or y == 0 or x == 4 or y == 4
            px[x, y] = 7 if glow and edge else 1 if edge else 12
    px[1, 1] = 7
    px[2, 1] = 13 if not glow else 7
    px[1, 2] = 13 if not glow else 7
    return im


def heavy(cracks=0, glow=False):
    im = cell()
    px = im.load()
    for y in range(8):
        for x in range(8):
            edge = x == 0 or y == 0 or x == 7 or y == 7
            px[x, y] = 7 if glow and edge else 2 if edge else 8
    for i in range(1, 4):
        px[i, 1] = 14
        px[1, i] = 14
    for x in range(2, 7):
        px[x, 6] = 2
    for y in range(2, 7):
        px[6, y] = 2
    # cracks: a dark line in from a corner, two after the second hit
    if cracks >= 1:
        for (x, y) in [(6, 1), (5, 2), (5, 3), (4, 4), (3, 4)]:
            px[x, y] = 1
    if cracks >= 2:
        for (x, y) in [(1, 6), (2, 5), (2, 4), (3, 3)]:
            px[x, y] = 1
    return im


def gold():
    im = cell()
    px = im.load()
    for y in range(6):
        for x in range(6):
            edge = x == 0 or y == 0 or x == 5 or y == 5
            px[x, y] = 9 if edge else 10
    px[1, 1] = 7
    px[2, 1] = 7
    px[1, 2] = 7
    px[4, 4] = 9
    return im


def heart(full=True, half=False):
    im = cell()
    px = im.load()
    shape = [".XX.XX.",
             "XXXXXXX",
             "XXXXXXX",
             ".XXXXX.",
             "..XXX..",
             "...X..."]
    for y, row in enumerate(shape):
        for x, ch in enumerate(row):
            if ch == "X":
                if half and x >= 4 and (x, y) != (3, 5):
                    edge = any(shape[y + dy][x + dx] != "X" if 0 <= y + dy < 6 and 0 <= x + dx < 7 else True
                               for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    if edge:
                        px[x, y] = 5
                elif full or half:
                    px[x, y] = 7 if (x, y) == (1, 1) else 8
                else:
                    edge = any(shape[y + dy][x + dx] != "X" if 0 <= y + dy < 6 and 0 <= x + dx < 7 else True
                               for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    if edge:
                        px[x, y] = 5
    return im


def ball():
    k = 8
    big = Image.new("P", (8 * k, 8 * k), 0)
    d = ImageDraw.Draw(big)
    d.ellipse([0, 0, 8 * k - 1, 8 * k - 1], fill=4)
    d.ellipse([k * 0.5, k * 0.5, 8 * k - k * 1.2, 8 * k - k * 1.2], fill=9)
    d.ellipse([k * 1.0, k * 0.8, 8 * k - k * 2.2, 8 * k - k * 2.4], fill=10)
    d.ellipse([k * 1.6, k * 1.4, k * 3.4, k * 3.0], fill=7)
    return big.resize((8, 8), Image.NEAREST)


def write_sheet():
    sheet = Image.new("P", (128, 128), 0)
    sheet.putpalette(flat(STANDARD))

    def put(im, n):
        sheet.paste(im, ((n % 16) * 8, (n // 16) * 8))

    put(piece(), PIECE)
    for c in range(3):
        put(heavy(c), HEAVY + c)
    put(gold(), GOLD)
    put(heart(True), HEART)
    put(heart(False), HEART + 1)
    put(ball(), BALL)
    put(piece(True), GLOW_PIECE)
    put(heavy(0, True), GLOW_HEAVY)
    put(heart(False, True), HALF_HEART)
    sheet.save(os.path.join(CART, "sheet.png"))


def write_logo():
    k = 4
    im = Image.new("P", (44 * k, 44 * k), 1)
    im.putpalette(flat(STANDARD))
    d = ImageDraw.Draw(im)
    cx, cy = 14 * k, 14 * k
    # the ring the ball swings on
    d.ellipse([cx - 22 * k, cy - 22 * k, cx + 22 * k, cy + 22 * k], outline=5, width=k)
    # blocks flying in, one bursting
    for (x, y, s, c) in [(36, 6, 5, 12), (38, 30, 7, 8), (8, 37, 5, 12)]:
        d.rectangle([x * k, y * k, (x + s) * k, (y + s) * k], fill=c, outline=1, width=k // 2)
    for (x, y) in [(30, 34), (33, 40), (40, 39), (28, 29)]:
        d.rectangle([x * k, y * k, (x + 1) * k, (y + 1) * k], fill=7)
    # the crane's hub, the chain and the ball
    bx, by = 30 * k, 30 * k
    for i in range(6):
        t = i / 5.0
        x, y = cx + (bx - cx) * t, cy + (by - cy) * t
        d.ellipse([x - k, y - k, x + k, y + k], fill=6)
    d.ellipse([cx - 5 * k, cy - 5 * k, cx + 5 * k, cy + 5 * k], fill=13, outline=6, width=k)
    d.ellipse([cx - 2 * k, cy - 2 * k, cx + 2 * k, cy + 2 * k], fill=9)
    r = 7 * k
    d.ellipse([bx - r, by - r, bx + r, by + r], fill=4)
    d.ellipse([bx - r + k, by - r + k, bx + r - 2 * k, by + r - 2 * k], fill=10)
    d.ellipse([bx - r + 3 * k, by - r + 2 * k, bx - r + 6 * k, by - r + 5 * k], fill=7)
    im.resize((44, 44), Image.NEAREST).save(os.path.join(CART, "logo.png"))


def main():
    os.makedirs(CART, exist_ok=True)
    write_sheet()
    write_logo()
    print("sloop: sheet.png and logo.png written")


if __name__ == "__main__":
    main()
