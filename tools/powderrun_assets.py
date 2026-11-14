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

and once: sheet.png (the skier in eight poses) and logo.png.

The relief is only the bumps, rollers and hollows of the snow: the
mountainside's own slope isn't in the picture, because land.draw wraps the
world and no wrapping picture can go downhill for ever. The game adds the
slope itself, in how fast the skier goes and in where it puts the horizon.

The relief repeats every 256 pixels both ways, seamlessly: its noise is a
small random lattice tiled three by three, scaled up and cut from the
middle. The rollers run across the fall line, which crosses the picture
three across for every eight down, so they repeat with it too.
"""
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


# ---- Alpine Valley -------------------------------------------------------------

SNOW = [0x8e9ccc, 0xb2c0e2, 0xd2dcf0, 0xeaeffa, 0xffffff]   # deep shadow to sunlit
ICE = [0x9cc4e0, 0xc4e0f4]
ROCK = [0x4a4652, 0x6e6a78, 0x9894a4]
SKY = [0x3c6cc8, 0x5c8edc, 0x8cb4ec, 0xc8dcf4]              # top, middle, low, haze
MOUNTAINS = [0x7c8cb8, 0xd8e0f0, 0x56648e, 0xb4c0dc, 0x3e4a70]   # far, its snow, near, its snow, its shade


def alpine_palette():
    pal = list(STANDARD)
    idx = {}
    for name, cols in (("snow", SNOW), ("ice", ICE), ("rock", ROCK), ("sky", SKY), ("mountains", MOUNTAINS)):
        idx[name] = len(pal)
        pal += cols
    return pal, idx


def alpine_relief():
    base = fbm([(4, 1.0), (8, 0.5), (16, 0.18)], 7)
    rollers_at = fbm([(4, 1.0), (8, 0.5)], 8)
    moguls_at = fbm([(8, 1.0), (16, 0.5)], 9)
    moguls = fbm([(32, 1.0), (64, 0.4)], 10)
    h = [0.0] * (S * S)
    for y in range(S):
        for x in range(S):
            i = y * S + x
            v = base[i] * 34.0
            # rollers: ridges straight across the fall line, in places
            p = (FALL_X * x + FALL_Y * y) % S
            wave = 0.5 + 0.5 * math.sin(2 * math.pi * p / S)
            v += 7.0 * wave * wave * smooth(0.55, 0.75, rollers_at[i])
            # moguls: small bumps close together, in other places
            v += 5.0 * moguls[i] * smooth(0.6, 0.8, moguls_at[i])
            h[i] = v
    return h


def alpine():
    pal, idx = alpine_palette()
    h = alpine_relief()
    sl, lit = light(h)
    rnd = random.Random(3)
    col = [0] * (S * S)
    low = min(h)
    for i in range(S * S):
        if sl[i] > 2.4:
            shade = 0 if lit[i] < 0.6 else (1 if lit[i] < 0.85 else 2)
            col[i] = idx["rock"] + shade
            continue
        if h[i] < low + 2.5 and sl[i] < 0.4:
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
    heights = [int(round(v)) for v in h]
    return pal, idx, heights, col


def sky_strip(pal, idx, seed):
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
        # peaks: noise folded about its middle, so its highs come to points
        v = lattice(n, s, W, 1)
        return [int(lo + (1.0 - abs(2.0 * v[x] - 1.0)) ** 1.6 * span) for x in range(W)]

    far = ridge(10, seed, 8, 20)
    near = ridge(8, seed + 1, 4, 13)
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

def write_slope(name, pal, idx, heights, col):
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
    sky_strip(pal, idx, 41).save(os.path.join(CART, "images", name + "_sky.png"))
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


def skier(pose, lean, k=4):
    """The skier from behind, 16x16, feet at the bottom middle, leaning
    lean degrees (right positive)."""
    im = Image.new("P", (16 * k, 16 * k), 0)
    im.putpalette(flat(STANDARD))
    d = ImageDraw.Draw(im)
    fx, fy = 8 * k, 14 * k
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


def write_sheet():
    sheet = Image.new("P", (128, 128), 0)
    sheet.putpalette(flat(STANDARD))
    for f, (pose, lean) in enumerate(POSES):
        n = 64 + f * 2
        sheet.paste(skier(pose, lean), ((n % 16) * 8, (n // 16) * 8))
    sheet.save(os.path.join(CART, "sheet.png"))


def write_logo(pal, idx):
    sky = sky_strip(pal, idx, 41).crop((40, 4, 84, 48)).resize((44, 44), Image.NEAREST)
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
    pal, idx, heights, col = alpine()
    write_slope("alpine", pal, idx, heights, col)
    write_sheet()
    write_logo(pal, idx)
    print("alpine: relief %d to %d, %d colours" % (min(heights), max(heights), len(pal)))
    print("palette:", ", ".join("%s %d" % kv for kv in sorted(idx.items(), key=lambda kv: kv[1])))


if __name__ == "__main__":
    main()
