"""Generate Outpost Echo's original indexed textures, palette and logo.

    python3 tools/outpostecho_assets.py

The handcrafted level lives in outpostecho/maps/arrival.json. This script
only writes the new cart's art. It never touches another game's files.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

CART = Path(__file__).resolve().parents[1] / "outpostecho"
STANDARD = [0x000000, 0x1a2244, 0x6b2a5e, 0x0f6640, 0x8a5236, 0x4f4a52, 0xb8b4bc, 0xf6f2ea,
            0xe8304a, 0xf5962a, 0xf8e43c, 0x3cd250, 0x2f9cf0, 0x7e7aa8, 0xf27ab4, 0xf9c89a]
MATERIALS = [0x172c42, 0x294b63, 0x427589, 0x78bec8,
             0x372b29, 0x665343, 0xa17b48, 0xe8b45c,
             0x1a322e, 0x31554a, 0x518475, 0x8ac8a1,
             0x2b233d, 0x4d3a65, 0x81679c, 0xb8a0d0]
PALETTE = STANDARD + MATERIALS + [0x080f1b, 0x111c2b, 0x17202c, 0x202d3b, 0x2a3c4d]
FLAT = [part for c in PALETTE for part in ((c >> 16) & 255, (c >> 8) & 255, c & 255)]
FLAT += [0] * (768 - len(FLAT))


def indexed(size, colour=0):
    image = Image.new("P", size, colour)
    image.putpalette(FLAT)
    return image


def main():
    (CART / "palettes").mkdir(exist_ok=True)
    lines = ["GIMP Palette", "Name: Outpost Echo", "Columns: 16", "#"]
    lines += [f"{c >> 16 & 255:3} {c >> 8 & 255:3} {c & 255:3}\tc{i}"
              for i, c in enumerate(PALETTE)]
    (CART / "palettes" / "station.gpl").write_text("\n".join(lines) + "\n")
    sheet = indexed((128, 128))
    px = sheet.load()
    for room in range(4):
        base = 16 + room * 4
        for variant in range(2):
            sprite = 1 + room + variant * 4
            ox, oy = sprite % 16 * 8, sprite // 16 * 8
            for y in range(8):
                for x in range(8):
                    c = base + 1
                    if x == 0 or y == 7:
                        c = base
                    elif y == 0:
                        c = base + 2
                    elif y == 2 and 1 <= x <= 6:
                        c = base + 3
                    elif y == 5 and x in (2, 5):
                        c = base + 2
                    if variant and 2 <= x <= 5 and 3 <= y <= 6:
                        c = base if x in (2, 5) or y == 6 else base + 3
                    px[ox + x, oy + y] = c
    # Original 16x16 equipment and robot silhouettes, on 2x2 cells.
    d = ImageDraw.Draw(sheet)
    for kind in range(1, 10):
        sp = 64 + ((kind - 1) // 8) * 32 + ((kind - 1) % 8) * 2
        x, y = sp % 16 * 8, sp // 16 * 8
        ink = [12,10,14,11,12,9,11,7,13][kind-1]
        d.ellipse((x+2,y+13,x+13,y+15),fill=16)
        if kind in (1,4,8):
            d.rectangle((x+3,y+3,x+12,y+13),fill=17,outline=18)
            d.rectangle((x+5,y+5,x+10,y+8),fill=ink)
            d.line((x+5,y+11,x+10,y+11),fill=6)
        elif kind==5:
            d.rectangle((x+1,y+1,x+14,y+14),fill=18,outline=19)
            d.rectangle((x+4,y+2,x+11,y+14),fill=32)
            d.line((x+6,y+6,x+9,y+6),fill=11,width=2)
        elif kind==9:
            d.rectangle((x+4,y+7,x+12,y+13),fill=17,outline=18)
            d.line((x+5,y+6,x+12,y+6),fill=11,width=2)
        else:
            d.rectangle((x+4,y+6,x+11,y+12),fill=ink,outline=7)
            d.line((x+6,y+8,x+9,y+8),fill=32)
    # Hydroponic foliage is distinct from the metal equipment sprites.
    x,y=16,48
    d.rectangle((x+4,y+11,x+12,y+15),fill=21,outline=22)
    d.line((x+8,y+12,x+8,y+2),fill=11,width=2)
    for yy in (3,6,9):
        d.ellipse((x+2,y+yy,x+8,y+yy+3),fill=3)
        d.ellipse((x+8,y+yy-1,x+14,y+yy+2),fill=11)
    for frame in range(3):
        sp=128+frame*2;x,y=sp%16*8,sp//16*8
        d.rectangle((x+3,y+4,x+12,y+11),fill=5 if frame==2 else 18,outline=6)
        d.rectangle((x+5,y+2,x+10,y+5),fill=5,outline=7)
        d.line((x+6,y+4,x+9,y+4),fill=12 if frame==2 else 8,width=2)
        d.rectangle((x+1,y+6,x+3,y+10),fill=6)
        d.rectangle((x+12,y+6,x+14,y+10),fill=6)
        for xx,yy in [(4,12+frame%2),(10,13-frame%2)]:
            d.rectangle((x+xx,y+yy,x+xx+2,y+15),fill=6)
    for sprite in (9,10):
        x=sprite*8
        d.rectangle((x,0,x+7,7),fill=17,outline=19)
        d.line((x+3,1,x+3,6),fill=32)
        d.point((x+5,4),fill=11)
    sheet.save(CART / "sheet.png")
    (CART / "images").mkdir(exist_ok=True)
    for path in (CART/"maps").glob("*.json"):
        level=json.loads(path.read_text()); overview=indexed((48,38),32)
        pixels=overview.load()
        for y,row in enumerate(level["rows"]):
            for x in range(level["width"]):
                cell=int(row[x*2:x*2+2],16)
                pixels[x,y]=17 if cell else 34
        overview.save(CART/"images"/(path.stem+"_map.png"))
    (CART / "flags.json").write_text(json.dumps({**{str(i):3 for i in range(1,10)}, '10':1})+'\n')

    logo = indexed((44, 44), 32)
    d = ImageDraw.Draw(logo)
    for x0, y0, x1, y1, colour in [(2, 2, 41, 41, 17), (8, 7, 35, 36, 18), (14, 12, 29, 31, 19)]:
        d.rectangle((x0, y0, x1, y1), outline=colour, width=2)
        d.line((x0, y1, 22, 24), fill=colour)
        d.line((x1, y1, 22, 24), fill=colour)
    d.rectangle((19, 18, 24, 28), fill=12)
    d.line((17, 33, 26, 33), fill=7, width=2)
    logo.save(CART / "logo.png")
    print("Outpost Echo: wall textures, equipment, robots, foliage, scanner maps and logo")


if __name__ == "__main__":
    main()
