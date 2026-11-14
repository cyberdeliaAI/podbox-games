"""Generate Kremlin Blocks' original art and its piece rotations.

    python3 tools/kremlinblocks_assets.py

Everything is drawn here, pixel by pixel, from a plan of shapes: onion
domes with their own stripes, scales and chevrons, tent roofs, clock
towers, brick walls with swallowtail merlons, white stone plaques and a
folk-patterned border. Nothing is copied from another game or traced from
a photograph. It writes into kremlinblocks/:

    palettes/kremlin.gpl    the palette (the HUD's entries are listed in view.js)
    images/title.png        the start screen: a cathedral of domes behind the wall
    images/stage1-5.png     the playfield's surroundings, one for each stage:
                            day on the square, winter, sunset, white nights, night
    sheet.png               the seven blocks, bevelled, at sprites 1 to 7
    logo.png                44x44
    pieces.js               the seven pieces' four rotations

The well sits in a brick tower gate in the middle of every stage. The
stone plaques the numbers are printed on are part of the pictures, so
drawing them costs nothing at run time.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / 'kremlinblocks'

STANDARD = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
            0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]
# from 16: name, colour. view.js names some of these: keep them in step
NAMED = [
    ('ink', 0x15101f), ('brick dark', 0x571a20), ('brick', 0x962b2b), ('brick light', 0xc4473b),
    ('stone shade', 0xb9ab95), ('stone', 0xece2cd), ('gold dark', 0x8f621c), ('gold', 0xd7a239),
    ('gold light', 0xf6dc88), ('green dark', 0x1c4a3b), ('green', 0x2e7751), ('green light', 0x58a86a),
    ('blue dark', 0x1e346f), ('blue', 0x3767c2), ('blue light', 0x8bb5ee), ('teal dark', 0x176c66),
    ('teal', 0x2aa597), ('teal light', 0x8edbc9), ('red dark', 0x8a1c2c), ('red', 0xd8343c),
    ('rose', 0xf08aa0), ('snow', 0xf5f8fc), ('snow shade', 0xb7c7df), ('window', 0x251a2c),
    ('lamp', 0xf8d374), ('well', 0x110d19), ('well dot', 0x2a2338),
    # the skies: three bands each, top to bottom
    ('day 0', 0x1c7f94), ('day 1', 0x37aab0), ('day 2', 0x86d4cc),
    ('winter 0', 0x7d97c4), ('winter 1', 0xa9c0e0), ('winter 2', 0xdbe6f4),
    ('sunset 0', 0x7b3d7a), ('sunset 1', 0xe0684a), ('sunset 2', 0xf6b25c),
    ('nights 0', 0x6a6aa8), ('nights 1', 0xa88cbe), ('nights 2', 0xebbdc4),
    ('night 0', 0x080b26), ('night 1', 0x141d48), ('night 2', 0x23316a),
]
# the blocks: light, middle, dark
BLOCKS = [
    (0xff8a8a, 0xe03a3a, 0x8c1a26),     # crimson
    (0xffe08a, 0xf0b230, 0x9a6414),     # gold
    (0x8ae6a0, 0x2fb35a, 0x17663a),     # emerald
    (0x9ab8ff, 0x3a6ee8, 0x1c3488),     # cobalt
    (0xffbb80, 0xf07a2a, 0x9a3e12),     # orange
    (0xe0a0ff, 0xa04ad0, 0x5a2080),     # violet
    (0x9af0e6, 0x2ab8b0, 0x146a66),     # teal
]
BASE = [[(0, 1), (1, 1), (2, 1), (3, 1)], [(1, 0), (2, 0), (1, 1), (2, 1)], [(1, 0), (0, 1), (1, 1), (2, 1)],
        [(1, 0), (2, 0), (0, 1), (1, 1)], [(0, 0), (1, 0), (1, 1), (2, 1)], [(0, 0), (0, 1), (1, 1), (2, 1)],
        [(2, 0), (0, 1), (1, 1), (2, 1)]]
W, H = 160, 120
WELL = (55, 14, 105, 114)          # the well: x0, y0, x1, y1 (exclusive), as view.js draws it


def palette():
    pal = list(STANDARD)
    idx = {}
    for name, c in NAMED:
        idx[name] = len(pal)
        pal.append(c)
    idx['blocks'] = len(pal)
    for light, mid, dark in BLOCKS:
        pal += [light, mid, dark]
    return pal, idx


def flat(pal):
    out = []
    for c in pal:
        out += [(c >> 16) & 255, (c >> 8) & 255, c & 255]
    return out + [0] * (768 - len(out))


class Canvas:
    """A palette picture with the shapes the city is made of."""

    def __init__(self, idx, w=W, h=H):
        self.idx = idx
        self.im = Image.new('P', (w, h), idx['ink'])
        self.px = self.im.load()
        self.d = ImageDraw.Draw(self.im)
        self.w, self.h = w, h

    def c(self, name):
        return self.idx[name] if isinstance(name, str) else name

    def put(self, x, y, col):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = self.c(col)

    def get(self, x, y):
        return self.px[x, y] if 0 <= x < self.w and 0 <= y < self.h else -1

    def rect(self, x0, y0, x1, y1, col):
        self.d.rectangle((x0, y0, x1, y1), fill=self.c(col))

    def line(self, pts, col):
        self.d.line(pts, fill=self.c(col))

    def poly(self, pts, col):
        self.d.polygon(pts, fill=self.c(col))

    # ---- the sky ---------------------------------------------------------------

    def sky(self, stage, y0=0, y1=H):
        """Three bands, top to bottom, dithered where they meet."""
        names = ['%s %d' % (stage, i) for i in range(3)]
        span = y1 - y0
        for y in range(y0, y1):
            t = (y - y0) / span * 3
            band = min(2, int(t))
            frac = t - band
            for x in range(self.w):
                b = band
                if band < 2 and frac > 0.75 and (x + y) % 2 == 0:
                    b += 1
                self.put(x, y, names[b])

    def stars(self, n, y1, seed):
        r = seed
        for i in range(n):
            r = (r * 1103515245 + 12345) & 0x7fffffff
            x = r % self.w
            y = (r >> 8) % y1
            self.put(x, y, 'snow' if i % 3 else 'gold light')

    # ---- brick and stone -----------------------------------------------------------

    def brick(self, x0, y0, x1, y1, light=True):
        """Red brick: courses of 3 rows, a mortar line under each, bricks 6 long."""
        for y in range(y0, y1 + 1):
            row = (y - y0) % 3
            course = (y - y0) // 3
            for x in range(x0, x1 + 1):
                if row == 2:
                    col = 'brick dark'
                elif (x - x0 + course * 3) % 6 == 5:
                    col = 'brick dark'
                elif light and row == 0 and (x - x0 + course * 3) % 6 == 0:
                    col = 'brick light'
                else:
                    col = 'brick'
                self.put(x, y, col)

    def merlons(self, x0, x1, y, h=6, w=5, gap=3):
        """Swallowtail merlons standing on row y: a notch in each top."""
        x = x0
        while x + w - 1 <= x1:
            self.brick(x, y - h, x + w - 1, y - 1)
            mid = x + w // 2
            self.put(mid, y - h, 'ink')
            self.put(mid, y - h + 1, 'ink')
            self.put(x, y - h, 'brick light')
            self.put(x + w - 1, y - h, 'brick dark')
            x += w + gap

    def wall(self, x0, x1, top, bottom):
        """A stretch of wall: merlons on a parapet, brick below."""
        self.brick(x0, top, x1, bottom)
        self.line([(x0, top), (x1, top)], 'brick light')
        self.merlons(x0, x1, top)

    def stone(self, x0, y0, x1, y1):
        """A white stone plaque with a red double border and gold corners."""
        self.rect(x0, y0, x1, y1, 'stone')
        self.d.rectangle((x0, y0, x1, y1), outline=self.c('red dark'))
        self.d.rectangle((x0 + 2, y0 + 2, x1 - 2, y1 - 2), outline=self.c('red'))
        for (cx, cy) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
            self.put(cx, cy, 'gold')
        self.line([(x0 + 1, y1 + 1), (x1 + 1, y1 + 1)], 'ink')
        self.line([(x1 + 1, y0 + 1), (x1 + 1, y1 + 1)], 'ink')

    def folk(self, y, x0=0, x1=W - 1):
        """A woven border four rows deep: red diamonds on white, gold between."""
        for x in range(x0, x1 + 1):
            for dy in range(4):
                p = (x - x0) % 8
                d = abs(p - 3.5)
                diamond = abs(dy - 1.5) + d < 3
                col = 'red' if diamond else ('gold' if (p == 0 and dy in (1, 2)) else 'stone')
                if dy == 0 or dy == 3:
                    col = 'red dark' if diamond else 'stone shade'
                self.put(x, y + dy, col)

    # ---- domes, roofs, drums ------------------------------------------------------------

    def dome(self, cx, base, w, h, pattern, a, b, finial=True):
        """An onion dome: widest two thirds down, a pointed tip, pinched at
        the base. pattern: spiral, chevron, scales, plain or gold."""
        prof = [(0.0, 0.0), (0.12, 0.16), (0.3, 0.5), (0.5, 0.86), (0.66, 1.0), (0.8, 0.94),
                (0.9, 0.76), (1.0, 0.6)]
        top = base - h
        r = w / 2.0
        for y in range(top, base):
            t = (y - top + 0.5) / h
            for i in range(len(prof) - 1):
                if prof[i][0] <= t <= prof[i + 1][0]:
                    t0, r0 = prof[i]
                    t1, r1 = prof[i + 1]
                    rr = r * (r0 + (r1 - r0) * (t - t0) / (t1 - t0))
                    break
            for x in range(int(cx - rr - 1), int(cx + rr + 2)):
                dx = x + 0.5 - cx
                if abs(dx) > rr:
                    continue
                u = dx / max(rr, 0.5)
                if pattern == 'spiral':
                    k = (dx * 1.1 + (y - top) * 1.0 + u * 3.0) % 6
                    col = a if k < 3 else b
                elif pattern == 'chevron':
                    k = ((y - top) + abs(dx) * 0.9) % 6
                    col = a if k < 3 else b
                elif pattern == 'scales':
                    k = (int(x - cx + 50) + 2 * ((y - top) // 2)) % 4
                    col = b if (k == 0 and (y - top) % 2 == 0) else a
                elif pattern == 'gold':
                    col = 'gold'
                else:
                    col = a
                # light from the left: a highlight, a darker right side
                if u < -0.55 and pattern in ('gold', 'plain'):
                    col = 'gold light' if pattern == 'gold' else col
                if u > 0.55:
                    col = shade(col)
                if abs(dx) > rr - 1 and u > 0:
                    col = 'ink' if pattern != 'gold' else 'gold dark'
                self.put(x, y, col)
        if finial:
            self.line([(cx, top - 4), (cx, top - 1)], 'gold')
            self.put(cx, top - 5, 'gold light')
            self.line([(cx - 1, top - 3), (cx + 1, top - 3)], 'gold')

    def drum(self, cx, top, w, h, lit=False):
        """The cylinder under a dome: white stone, slit windows, a cornice."""
        x0, x1 = int(cx - w / 2), int(cx + w / 2)
        self.rect(x0, top, x1, top + h - 1, 'stone')
        self.line([(x1, top), (x1, top + h - 1)], 'stone shade')
        self.line([(x0, top), (x1, top)], 'gold')
        for x in range(x0 + 2, x1 - 1, 3):
            self.line([(x, top + 2), (x, top + h - 2)], 'lamp' if lit else 'window')

    def tent(self, cx, base, w, h, col='green'):
        """A tall tent roof, ribbed, with a gold star of a finial."""
        light, mid, dark = col + ' light', col, col + ' dark'
        for y in range(base - h, base):
            t = (y - (base - h)) / h
            half = w / 2.0 * t
            for x in range(int(cx - half), int(cx + half) + 1):
                rel = (x - cx) / max(half, 0.5)
                k = mid if (x - int(cx)) % 3 else dark
                if rel < -0.6:
                    k = light
                if rel > 0.6:
                    k = dark
                self.put(x, y, k)
        star(self, cx, base - h - 3, 'gold')

    def clock(self, cx, cy, r=4):
        """A clock face: white, gold rim, hands at ten to two."""
        self.d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=self.c('stone'), outline=self.c('gold'))
        self.line([(cx, cy), (cx - 2, cy - 2)], 'ink')
        self.line([(cx, cy), (cx + 2, cy - 1)], 'ink')

    def windows(self, x0, y0, x1, y1, step=5, lit=0, seed=1):
        """Rows of arched windows; lit: how many in ten glow."""
        r = seed
        for y in range(y0, y1 - 3, 6):
            for x in range(x0, x1 - 1, step):
                r = (r * 1103515245 + 12345) & 0x7fffffff
                col = 'lamp' if (r >> 4) % 10 < lit else 'window'
                self.rect(x, y + 1, x + 1, y + 3, col)
                self.put(x, y, col if col == 'lamp' else 'stone shade')

    def arches(self, x0, x1, y, w=6):
        """Kokoshnik gables: a row of round white arches on a roof line."""
        for x in range(x0, x1 - w + 2, w):
            cx = x + w / 2.0 - 0.5
            for dx in range(w):
                yy = y - int(round(math.sqrt(max(0.0, (w / 2.0) ** 2 - (dx - w / 2.0 + 0.5) ** 2))))
                self.line([(x + dx, yy), (x + dx, y)], 'stone')
                self.put(x + dx, yy, 'gold')
            self.put(int(cx), y - 1, 'brick')

    def snowcaps(self, sky_names):
        """Snow on everything the sky touches from above."""
        skies = {self.idx[n] for n in sky_names}
        for x in range(self.w):
            for y in range(1, self.h):
                if self.px[x, y] not in skies and self.px[x, y - 1] in skies:
                    self.px[x, y] = self.idx['snow']
                    if y + 1 < self.h and self.px[x, y + 1] not in skies:
                        self.px[x, y + 1] = self.idx['snow shade'] if (x % 3) else self.idx['snow']


SHADE = {'red': 'red dark', 'stone': 'stone shade', 'gold': 'gold dark', 'green': 'green dark',
         'green light': 'green', 'blue': 'blue dark', 'blue light': 'blue', 'teal': 'teal dark',
         'teal light': 'teal', 'gold light': 'gold', 'rose': 'red', 'snow': 'snow shade',
         'brick': 'brick dark', 'brick light': 'brick'}


def shade(col):
    return SHADE.get(col, col)


def star(cv, cx, cy, col):
    """A small five-pointed star, 5x5."""
    for (dx, dy) in [(0, -2), (-1, -1), (0, -1), (1, -1), (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0),
                     (-1, 1), (1, 1), (-1, 2), (1, 2), (0, 1)]:
        cv.put(cx + dx, cy + dy, col)
    cv.put(cx, cy, 'gold light')


# ---- the buildings -------------------------------------------------------------------------

def cathedral(cv, cx, base, scale, lit=0, gold=False):
    """A cathedral of many domes: a tall tent tower in the middle, four onion
    domes round it, each its own pattern, on drums over a stone body with
    kokoshnik arches and windows."""
    s = scale
    body_top = base - int(22 * s)
    cv.rect(int(cx - 30 * s), body_top, int(cx + 30 * s), base, 'brick')
    cv.brick(int(cx - 30 * s), body_top, int(cx + 30 * s), base)
    cv.windows(int(cx - 27 * s), body_top + 5, int(cx + 27 * s), base - 2, step=max(4, int(6 * s)), lit=lit, seed=7)
    cv.line([(int(cx - 30 * s), body_top), (int(cx + 30 * s), body_top)], 'stone')
    cv.arches(int(cx - 30 * s), int(cx + 30 * s), body_top, w=max(4, int(6 * s)))
    domes = [(-21, 17, 14, 'chevron', 'green light', 'gold'),
             (21, 17, 14, 'spiral', 'blue light', 'stone'),
             (-11, 26, 16, 'spiral', 'red', 'stone'),
             (11, 26, 16, 'scales', 'teal', 'gold light')]
    for (dx, dh, dw, pat, a, b) in domes:
        x = int(cx + dx * s)
        drum_top = body_top - int(dh * s * 0.45)
        cv.drum(x, drum_top, max(5, int(dw * s * 0.55)), int(dh * s * 0.45), lit=lit > 0)
        if gold:
            pat, a, b = 'gold', 'gold', 'gold'
        cv.dome(x, drum_top + 1, int(dw * s), int(dh * s), pat, a, b)
    # the tall tower in the middle: brick with white bands and a few
    # arched windows, a small golden dome on top
    tw = int(12 * s)
    tower_top = body_top - int(30 * s)
    cv.brick(cx - tw // 2, tower_top, cx + tw // 2, body_top)
    cv.line([(cx - tw // 2, tower_top), (cx - tw // 2, body_top)], 'brick light')
    for y in range(tower_top + 6, body_top, 8):
        cv.line([(cx - tw // 2, y), (cx + tw // 2, y)], 'stone')
        cv.rect(cx - 1, y + 2, cx, y + 5, 'lamp' if lit else 'window')
        cv.put(cx - 1, y + 1, 'stone')
        cv.put(cx, y + 1, 'stone')
    cv.arches(cx - tw // 2, cx + tw // 2, tower_top, w=max(3, tw // 3))
    cv.tent(cx, tower_top - 2, tw + 2, int(26 * s), 'green')
    cv.dome(cx, tower_top - int(26 * s) - 1, max(5, int(7 * s)), max(6, int(9 * s)), 'gold', 'gold', 'gold')


def clocktower(cv, cx, base, h, w, lit=0):
    """A tall brick gate tower: white stone bands, a clock, a ribbed tent roof."""
    top = base - h
    cv.brick(cx - w // 2, top, cx + w // 2, base)
    cv.line([(cx - w // 2, top), (cx - w // 2, base)], 'brick light')
    cv.line([(cx + w // 2, top), (cx + w // 2, base)], 'brick dark')
    for y in range(top + 10, base, 14):
        cv.line([(cx - w // 2, y), (cx + w // 2, y)], 'stone')
    cv.windows(cx - w // 2 + 2, top + 14, cx + w // 2, base - 4, step=4, lit=lit, seed=cx)
    # the upper stage: narrower, white, with the clock
    uw = w - 4
    cv.rect(cx - uw // 2, top - 12, cx + uw // 2, top, 'stone')
    cv.line([(cx + uw // 2, top - 12), (cx + uw // 2, top)], 'stone shade')
    cv.clock(cx, top - 6, min(4, uw // 2 - 1))
    cv.merlons(cx - w // 2, cx + w // 2, top, h=3, w=3, gap=2)
    cv.tent(cx, top - 12, uw + 2, int(h * 0.6), 'green')


def side_church(cv, cx, base, w, pattern, a, b, lit=0, dome_w=None):
    """A small church: a brick body, a drum and one big onion dome."""
    body_top = base - 18
    cv.brick(cx - w // 2, body_top, cx + w // 2, base)
    cv.line([(cx - w // 2, body_top), (cx + w // 2, body_top)], 'stone')
    cv.arches(cx - w // 2, cx + w // 2, body_top, w=5)
    cv.windows(cx - w // 2 + 2, body_top + 4, cx + w // 2, base - 2, step=4, lit=lit, seed=cx * 3)
    dw = dome_w or w
    cv.drum(cx, body_top - 8, max(5, dw // 2), 8, lit=lit > 0)
    cv.dome(cx, body_top - 7, dw, int(dw * 1.15), pattern, a, b)


def palace(cv, x0, x1, base, top, lit=0):
    """A long palace front: pale walls, white columns, a green roof and a gold spire."""
    cv.rect(x0, top, x1, base, 'teal light')
    for x in range(x0 + 1, x1, 4):
        cv.line([(x, top + 2), (x, base)], 'stone')
    cv.windows(x0 + 3, top + 3, x1, base - 1, step=4, lit=lit, seed=x0 + 5)
    cv.rect(x0 - 1, top - 3, x1 + 1, top, 'green')
    cv.line([(x0 - 1, top - 3), (x1 + 1, top - 3)], 'green light')


# ---- the stages and the title -------------------------------------------------------------------

STAGES = [
    # sky, snow, lit windows (in ten), stars, sun, the big dome's pattern and colours, the small one's
    dict(sky='day', snow=False, lit=0, stars=0, sun=(20, 30, 6), big=('spiral', 'red', 'stone'),
         small=('chevron', 'green light', 'gold')),
    dict(sky='winter', snow=True, lit=1, stars=0, sun=None, big=('spiral', 'blue light', 'stone'),
         small=('scales', 'teal', 'gold light')),
    dict(sky='sunset', snow=False, lit=2, stars=0, sun=(24, 44, 9), big=('gold', 'gold', 'gold'),
         small=('spiral', 'red', 'gold light')),
    dict(sky='nights', snow=False, lit=3, stars=6, sun=None, big=('scales', 'teal', 'gold light'),
         small=('gold', 'gold', 'gold')),
    dict(sky='night', snow=False, lit=6, stars=40, sun=None, big=('chevron', 'green light', 'gold'),
         small=('spiral', 'blue light', 'stone')),
]
SCORE = (2, 2, 46, 20)             # the plaques the numbers are printed on, as view.js prints them
COUNTS = (2, 88, 46, 112)          # rows, and the level or the clock, one over the other
NEXT = (113, 2, 157, 46)           # the next three pieces
BEST = (113, 92, 157, 112)


def stage(idx, n):
    st = STAGES[n]
    cv = Canvas(idx)
    cv.sky(st['sky'], 0, 104)
    if st['stars']:
        cv.stars(st['stars'], 80, 97 + n)
    if st['sun']:
        sx, sy, r = st['sun']
        cv.d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=cv.c('gold light'))
    lit = st['lit']
    # far behind: a row of small domes against the sky
    for (x, w, pat, a, b) in [(8, 9, 'gold', 'gold', 'gold'), (40, 8, 'spiral', 'blue light', 'stone'),
                             (150, 9, 'gold', 'gold', 'gold'), (120, 8, 'chevron', 'red', 'stone')]:
        cv.drum(x, 70, 5, 8, lit=lit > 0)
        cv.dome(x, 71, w, w + 2, pat, a, b)
    # the left: a church with one big onion dome
    pat, a, b = st['big']
    cv.brick(4, 66, 44, 104)
    cv.line([(4, 66), (44, 66)], 'stone')
    cv.arches(4, 44, 66, w=6)
    cv.windows(7, 70, 42, 102, step=5, lit=lit, seed=11 + n)
    cv.drum(24, 52, 14, 14, lit=lit > 0)
    cv.dome(24, 53, 30, 30, pat, a, b)
    # the right: a clock tower and a small church
    pat, a, b = st['small']
    cv.brick(130, 74, 158, 104)
    cv.line([(130, 74), (158, 74)], 'stone')
    cv.arches(130, 158, 74, w=5)
    cv.windows(133, 78, 156, 102, step=5, lit=lit, seed=29 + n)
    cv.drum(146, 64, 9, 10, lit=lit > 0)
    cv.dome(146, 65, 18, 18, pat, a, b)
    clocktower(cv, 121, 104, 34, 14, lit=lit)
    if st['snow']:
        cv.snowcaps(['%s %d' % (st['sky'], i) for i in range(3)])
    # the wall along the bottom
    cv.wall(0, W - 1, 104, 115)
    # the tower gate the well stands in
    x0, y0, x1, y1 = WELL
    cv.brick(x0 - 6, y0 - 6, x1 + 5, H - 5)
    cv.line([(x0 - 6, y0 - 6), (x0 - 6, H - 5)], 'brick light')
    cv.line([(x1 + 5, y0 - 6), (x1 + 5, H - 5)], 'brick dark')
    cv.merlons(x0 - 6, x1 + 5, y0 - 6, h=5, w=5, gap=3)
    cv.rect(x0 - 2, y0 - 2, x1 + 1, y1 + 1, 'stone')
    cv.rect(x0 - 1, y0 - 1, x1, y1, 'gold dark')
    cv.rect(x0, y0, x1 - 1, y1 - 1, 'well')
    if st['snow']:
        cv.snowcaps(['%s %d' % (st['sky'], i) for i in range(3)])
    for box in (SCORE, COUNTS, NEXT, BEST):
        cv.stone(*box)
    cv.folk(H - 4)
    return cv.im


MENU = (52, 74, 107, 111)          # the title's menu plaque, as view.js prints it


def title(idx):
    cv = Canvas(idx)
    cv.sky('day', 0, 96)
    cv.d.ellipse((134, 22, 146, 34), fill=cv.c('day 2'))
    side_church(cv, 16, 96, 24, 'scales', 'teal', 'gold light', dome_w=22)
    side_church(cv, 144, 96, 24, 'spiral', 'blue light', 'stone', dome_w=22)
    clocktower(cv, 36, 96, 40, 14)
    clocktower(cv, 124, 96, 40, 14)
    cathedral(cv, 80, 96, 1.15)
    cv.wall(0, W - 1, 96, 115)
    cv.stone(*MENU)
    banner(cv, *BANNER)
    cv.folk(H - 4)
    return cv.im


BANNER = (16, 3, 143, 21)          # the title's name is printed on this


def banner(cv, x0, y0, x1, y1):
    """A red cloth banner with a gold edge and swallowtail ends."""
    cv.rect(x0, y0, x1, y1, 'red')
    cv.line([(x0, y0), (x1, y0)], 'gold')
    cv.line([(x0, y1), (x1, y1)], 'gold')
    cv.line([(x0, y0 + 2), (x1, y0 + 2)], 'red dark')
    cv.line([(x0, y1 - 2), (x1, y1 - 2)], 'red dark')
    mid = (y0 + y1) // 2
    for side, x in ((-1, x0), (1, x1)):
        cv.poly([(x, y0), (x + side * 8, y0), (x + side * 4, mid), (x + side * 8, y1), (x, y1)], 'red dark')
        cv.put(x + side * 4, mid, 'gold')
    cv.line([(x0 + 1, y1 + 1), (x1 + 1, y1 + 1)], 'ink')


def sheet(pal):
    im = Image.new('P', (128, 128), 0)
    im.putpalette(flat(pal))
    px = im.load()
    base = palette()[1]['blocks']
    for k in range(7):
        light, mid, dark = base + k * 3, base + k * 3 + 1, base + k * 3 + 2
        ox = (k + 1) * 8
        for y in range(4):
            for x in range(4):
                c = mid
                if y == 0 or x == 0:
                    c = light
                if y == 3 or x == 3:
                    c = dark
                px[ox + x, y] = c
        px[ox + 1, 1] = 7
    return im


def logo(idx, pal):
    cv = Canvas(idx, 44, 44)
    cv.sky('day', 0, 44)
    cv.dome(22, 26, 24, 24, 'spiral', 'red', 'stone')
    cv.drum(22, 26, 12, 6)
    cv.brick(0, 32, 43, 43)
    cv.merlons(0, 43, 32, h=4, w=4, gap=2)
    base = idx['blocks']
    for (x, y, k) in [(3, 36, 3), (8, 36, 3), (13, 36, 3), (13, 31, 3), (28, 36, 0), (33, 36, 0), (33, 31, 0),
                      (38, 31, 0)]:
        cv.rect(x, y, x + 3, y + 3, base + k * 3 + 1)
        cv.line([(x, y), (x + 3, y)], base + k * 3)
        cv.line([(x + 3, y), (x + 3, y + 3)], base + k * 3 + 2)
    return cv.im


def main():
    pal, idx = palette()
    if idx['blocks'] + 21 > 256:
        raise SystemExit('palette: too many colours')
    (ROOT / 'images').mkdir(exist_ok=True)
    (ROOT / 'palettes').mkdir(exist_ok=True)
    rows = ['GIMP Palette', 'Name: Kremlin Blocks', 'Columns: 16', '#']
    rows += ['%d %d %d\tc%d' % ((c >> 16) & 255, (c >> 8) & 255, c & 255, i) for i, c in enumerate(pal)]
    (ROOT / 'palettes/kremlin.gpl').write_text('\n'.join(rows) + '\n')
    for name, im in [('title', title(idx))] + [('stage%d' % (n + 1), stage(idx, n)) for n in range(len(STAGES))]:
        im.putpalette(flat(pal))
        im.save(ROOT / 'images' / (name + '.png'))
    old = ROOT / 'images/back.png'
    if old.exists():
        old.unlink()
    sheet(pal).save(ROOT / 'sheet.png')
    lg = logo(idx, pal)
    lg.putpalette(flat(pal))
    lg.save(ROOT / 'logo.png')
    # the pieces' rotations: unchanged, so recorded games still play the same
    xs, ys = [], []
    for kind, base in enumerate(BASE):
        points = list(base)
        for rotation in range(4):
            xs.extend(p[0] for p in points)
            ys.extend(p[1] for p in points)
            if kind != 1:
                limit = 3 if kind == 0 else 2
                points = [(limit - y, x) for x, y in points]
    (ROOT / 'pieces.js').write_text('// pieces: generated four-cell rotations. Edit tools/kremlinblocks_assets.py.\nvar xs=' +
                                    str(xs) + ';\nvar ys=' + str(ys) + ';\n')
    print('Kremlin Blocks: %d colours, the title, %d stages, seven blocks, the logo and the pieces' %
          (len(pal), len(STAGES)))
    print('palette entries for view.js:', {k: idx[k] for k in ('ink', 'stone', 'red dark', 'red', 'gold', 'gold dark',
                                                                'gold light', 'well', 'well dot', 'snow', 'blue dark',
                                                                'brick', 'brick dark', 'blocks')})


if __name__ == '__main__':
    main()
