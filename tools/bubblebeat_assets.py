"""Builds Bubble Beat's art: its palette, the sprite sheet, the playfield
background and the logo.

    python3 tools/bubblebeat_assets.py

Writes into bubblebeat/: palettes/bubble.gpl, sheet.png, images/back.png
and logo.png. Every picture is indexed in the cart's own palette: the
Arcade's standard sixteen colours in 0 to 15, then three shades of eight
bubble colours, then the colours of the playfield.
"""
import math
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CART = os.path.join(HERE, "..", "bubblebeat")

STANDARD = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
            0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]

# the eight bubble colours: shade, body, light; bubble h (1 to 8) uses
# entries 16 + (h - 1) * 3 onward, so its body is 17 + (h - 1) * 3
BUBBLES = [
    ("red",    0x8c1c34, 0xe83448, 0xff9c9c),
    ("orange", 0x9a4818, 0xf58c2c, 0xffcf8c),
    ("yellow", 0x9c7c14, 0xf6d83c, 0xfff6b4),
    ("green",  0x146c3c, 0x40c85a, 0xb4f4aa),
    ("cyan",   0x14708c, 0x34d0dc, 0xbaf6f6),
    ("blue",   0x22348c, 0x3c6cf0, 0xb0c6ff),
    ("purple", 0x4c2484, 0x9c54e4, 0xdab8ff),
    ("pink",   0x8c2864, 0xee6cbc, 0xffc6e6),
]
SHADE, BODY, LIGHT = 0, 1, 2

# the playfield's own colours, from entry 40
FIELD = 40         # the field behind the bubbles
DOTS = 41          # the faint grid of cells on it
PANEL = 42         # the side panels
EDGE = 43          # their edges and the walls
CEILING = 44       # the ceiling
CEILING_LIT = 45   # its rivets and lit edge
DECK = 46          # the launcher's deck below the field
EXTRA = [0x12142c, 0x262c58, 0x1c1230, 0x5a468c, 0x4a4060, 0x8c80b0, 0x181838]

PAL = STANDARD + [c for _, s, b, l in BUBBLES for c in (s, b, l)] + EXTRA
FLAT = []
for c in PAL:
    FLAT += [(c >> 16) & 255, (c >> 8) & 255, c & 255]
FLAT += [0] * (768 - len(FLAT))

W, H = 160, 120
FX, COLS = 32, 12  # the field: x 32 to 127, twelve bubbles across


def entry(h, part):
    return 16 + (h - 1) * 3 + part


def new(w, h, c=0):
    im = Image.new("P", (w, h), c)
    im.putpalette(FLAT)
    return im


def write_palette():
    os.makedirs(os.path.join(CART, "palettes"), exist_ok=True)
    lines = ["GIMP Palette", "Name: Bubble Beat", "Columns: 16", "#"]
    names = ["c%d" % i for i in range(16)]
    names += ["%s %s" % (n, p) for n, _, _, _ in BUBBLES for p in ("shade", "body", "light")]
    names += ["field", "dots", "panel", "edge", "ceiling", "ceiling lit", "deck"]
    for c, n in zip(PAL, names):
        lines.append("%3d %3d %3d\t%s" % ((c >> 16) & 255, (c >> 8) & 255, c & 255, n))
    with open(os.path.join(CART, "palettes", "bubble.gpl"), "w") as f:
        f.write("\n".join(lines) + "\n")


# ---- the sprite sheet ------------------------------------------------------

# An 8x8 bubble, lit from the top left: L light, B body, S shade
BUBBLE = [
    "..BBBB..",
    ".BLLBBB.",
    "BLLBBBBB",
    "BLBBBBBS",
    "BBBBBBBS",
    "BBBBBBSS",
    ".SBBBSS.",
    "..SSSS..",
]

# A mark for each colour, for those who tell colours apart less easily:
# 3x3, drawn in the bubble's shade a little right of its middle
MARKS = [
    ["XXX", "X.X", "XXX"],   # red: a box
    [".X.", "XXX", ".X."],   # orange: a plus
    ["X.X", ".X.", "X.X"],   # yellow: a cross
    ["XXX", "...", "XXX"],   # green: two bars
    [".X.", "X.X", ".X."],   # cyan: a diamond
    ["X..", "XX.", "XXX"],   # blue: a wedge
    ["...", ".X.", "..."],   # purple: a dot
    ["XXX", "XXX", "XXX"],   # pink: a block
]

# A popping bubble: a ring of sparks, then fewer
POP = [
    ["..7..7..",
     ".7....7.",
     "7......7",
     "........",
     "........",
     "7......7",
     ".7....7.",
     "..7..7.."],
    ["........",
     "...7....",
     ".7....7.",
     "........",
     "....7...",
     ".7....7.",
     "...7....",
     "........"],
]


def put(px, n, rows, colours):
    ox, oy = (n % 16) * 8, (n // 16) * 8
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colours:
                px[ox + x, oy + y] = colours[ch]


def write_sheet():
    sheet = new(128, 128, 0)
    px = sheet.load()
    for h in range(1, 9):
        cols = {"B": entry(h, BODY), "L": entry(h, LIGHT), "S": entry(h, SHADE)}
        put(px, h, BUBBLE, cols)                 # sprites 1 to 8: the bubbles
        put(px, 8 + h, BUBBLE, cols)             # 9 to 16: with their marks
        mark = MARKS[h - 1]
        ox, oy = ((8 + h) % 16) * 8 + 3, ((8 + h) // 16) * 8 + 3
        for y, row in enumerate(mark):
            for x, ch in enumerate(row):
                if ch == "X":
                    px[ox + x, oy + y] = entry(h, SHADE)
    for i, rows in enumerate(POP):
        put(px, 17 + i, rows, {"7": 7})          # 17 and 18: a pop
    sheet.save(os.path.join(CART, "sheet.png"))


# ---- the background --------------------------------------------------------

def write_back():
    im = new(W, H, PANEL)
    d = ImageDraw.Draw(im)
    # the field and the deck the launcher stands on
    d.rectangle([FX, 0, FX + 95, 99], fill=FIELD)
    d.rectangle([FX, 100, FX + 95, 119], fill=DECK)
    # a faint dot where each cell of the grid is, with the ceiling up
    px = im.load()
    for r in range(13):
        for c in range(COLS - (r & 1)):
            x = FX + 4 + c * 8 + (r & 1) * 4
            y = 6 + 4 + r * 7
            if y < 99:
                px[x - 1, y] = DOTS
    # the walls, and the edges of the panels
    d.rectangle([FX - 2, 0, FX - 1, 119], fill=EDGE)
    d.rectangle([FX + 96, 0, FX + 97, 119], fill=EDGE)
    d.line([FX - 3, 0, FX - 3, 119], fill=CEILING)
    d.line([FX + 98, 0, FX + 98, 119], fill=CEILING)
    # a few small bubbles at the foot of each panel
    for (x, y, h) in [(6, 110, 1), (14, 112, 4), (22, 109, 6), (138, 111, 3), (146, 109, 7), (154, 112, 2)]:
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=entry(h, SHADE))
        px[x - 1, y - 1] = entry(h, BODY)
    os.makedirs(os.path.join(CART, "images"), exist_ok=True)
    im.save(os.path.join(CART, "images", "back.png"))


# ---- the logo --------------------------------------------------------------

def write_logo():
    s = 4
    big = new(44 * s, 44 * s, FIELD)
    d = ImageDraw.Draw(big)
    # a cluster of bubbles hanging from a bar, the way the field fills
    d.rectangle([0, 0, 44 * s, 5 * s], fill=CEILING)
    d.line([0, 5 * s, 44 * s, 5 * s], fill=CEILING_LIT, width=s)
    layout = [(0, [2, 2, 6, 6]), (1, [2, 6, 6]), (2, [4, 4, 1, 1])]
    for r, row in layout:
        for c, h in enumerate(row):
            x = (5.5 + c * 11 + (r & 1) * 5.5) * s
            y = (11 + r * 9.5) * s
            rr = 5.3 * s
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=entry(h, SHADE))
            d.ellipse([x - rr + s, y - rr, x + rr - 0.5 * s, y + rr - 1.2 * s], fill=entry(h, BODY))
            d.ellipse([x - rr + 1.5 * s, y - rr + 1.5 * s, x - 0.5 * s, y - 0.5 * s], fill=entry(h, LIGHT))
    # the beat, as bars along the bottom
    for i, hgt in enumerate([2, 4, 3, 6, 3, 5, 2, 4]):
        x = (3 + i * 5) * s
        d.rectangle([x, (43 - hgt) * s, x + 3 * s, 43 * s], fill=7 if i % 4 == 3 else 13)
    small = big.resize((44, 44), Image.NEAREST)
    small.putpalette(FLAT)
    small.save(os.path.join(CART, "logo.png"))


def main():
    write_palette()
    write_sheet()
    write_back()
    write_logo()
    print("palette", len(PAL), "colours")


if __name__ == "__main__":
    main()
