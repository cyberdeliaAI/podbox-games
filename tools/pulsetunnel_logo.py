"""Draws the cart's 44x44 logo in the standard sixteen colours"""
import os
from PIL import Image, ImageDraw
PAL = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
       0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]
flat = []
for c in PAL:
    flat += [(c >> 16) & 255, (c >> 8) & 255, c & 255]
SCALE = 4
big = Image.new("P", (44 * SCALE, 44 * SCALE), 1)
big.putpalette(flat)
d = ImageDraw.Draw(big)
cx, cy = 22 * SCALE, 21 * SCALE
# spokes
import math
for i in range(6):
    a = (i * 60 + 22) * math.pi / 180
    d.line([(cx + math.cos(a) * 21 * SCALE, cy - math.sin(a) * 17 * SCALE),
            (cx + math.cos(a) * 3 * SCALE, cy - math.sin(a) * 2.5 * SCALE)], fill=5, width=SCALE)
# rings, near to far
for s, c in [(1.0, 12), (0.68, 12), (0.47, 13), (0.33, 13), (0.23, 5)]:
    rx, ry = 20 * s * SCALE, 16 * s * SCALE
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=c, width=SCALE)
# the core
d.ellipse([cx - 3 * SCALE, cy - 3 * SCALE, cx + 3 * SCALE, cy + 3 * SCALE], fill=7)
# a gate arc, pink, with its gap at the top right
rx, ry = 20 * 0.47 * SCALE, 16 * 0.47 * SCALE
d.arc([cx - rx, cy - ry, cx + rx, cy + ry], start=-10, end=280, fill=14, width=SCALE * 2)
# an enemy
d.ellipse([cx - 13 * SCALE, cy - 9 * SCALE, cx - 9 * SCALE, cy - 5 * SCALE], fill=14)
# the ship at the bottom of the rim
sx, sy = cx, cy + 15 * SCALE
d.polygon([(sx, sy - 7 * SCALE), (sx - 6 * SCALE, sy + 4 * SCALE), (sx, sy + 1 * SCALE)], fill=7)
d.polygon([(sx, sy - 7 * SCALE), (sx + 6 * SCALE, sy + 4 * SCALE), (sx, sy + 1 * SCALE)], fill=6)
small = big.resize((44, 44), Image.NEAREST)
small.putpalette(flat)
small.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "pulsetunnel", "logo.png"))

