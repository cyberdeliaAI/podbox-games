"""Generate Beat Dancer's palette, perspective floor, sheet and menu logo.

The dancer, floor and lights are real-time geometry. No animation frames
or borrowed character art are used.
"""
from pathlib import Path
import math
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]/'beatdancer'
PALETTE=[0x000000,0x141629,0x6b2a5e,0x0f6640,0x8a5236,0x46455f,0xb8b4bc,0xf6f2ea,0xe8304a,0xf5962a,0xf8e43c,0x3cd250,0x2f9cf0,0x7e7aa8,0xf27ab4,0xf9c89a,
         0x186c96,0x2bb8d8,0x79edee,0x8e5222,0xf29b38,0xffdf8b,0x843763,0xd75ca5,0xffa6df,0x252c47,0x526381,0x96aac4,0x778aa9,0xc2d9e7,0xf3f9ff,
         0x162439,0x23334e,0x382447,0x183047,0x247999,0x352242,0x914b8b,0x16362f,0x448f65]


def main():
    (ROOT/'palettes').mkdir(exist_ok=True)
    rows=['GIMP Palette','Name: Beat Dancer','Columns: 16','#']+[f'{v>>16&255} {v>>8&255} {v&255}\tc{i}' for i,v in enumerate(PALETTE)]
    (ROOT/'palettes/disco.gpl').write_text('\n'.join(rows)+'\n')
    palette=[v for c in PALETTE for v in (c>>16&255,c>>8&255,c&255)]+[0]*(768-3*len(PALETTE))
    sheet=Image.new('P',(128,128));sheet.putpalette(palette);sheet.save(ROOT/'sheet.png')
    logo=Image.new('P',(44,44),1);logo.putpalette(palette);d=ImageDraw.Draw(logo)
    for y in range(31,43,4):
        for x in range(2,43,5):d.rectangle((x,y,x+3,y+2),fill=35 if (x+y)%2 else 37)
    d.line((3,4,17,32),fill=12,width=2);d.line((40,4,28,32),fill=14,width=2)
    d.line((19,25,15,37),fill=17,width=4);d.line((25,25,29,37),fill=17,width=4)
    d.line((17,18,9,24),fill=29,width=3);d.line((27,18,35,12),fill=29,width=3)
    d.rectangle((16,15,28,27),fill=17,outline=18)
    d.rectangle((16,5,28,14),fill=29);d.rectangle((17,8,27,11),fill=1)
    d.point((20,9),fill=10);d.point((25,9),fill=10)
    logo.save(ROOT/'logo.png')
    (ROOT/'images').mkdir(exist_ok=True)
    floor=Image.new('P',(640,320),1);floor.putpalette(palette)
    for view in range(32):
        angle=view/32*math.tau;ca,sa=math.cos(angle),math.sin(angle)
        ox,oy=(view%4)*160,(view//4)*40
        # Draw on a separate tile so off-screen polygons can't touch neighbours.
        tile=Image.new('P',(160,40),1);tile.putpalette(palette);td=ImageDraw.Draw(tile)
        points=[]
        for row in range(4):
            for col in range(4):
                x,z=-1.8+col*1.2,-1.8+row*1.2
                rx,rz=x*ca-z*sa,x*sa+z*ca
                depth=5.5+rz*.94+1.15*.34
                points.append((math.floor(80+rx*145/depth),math.floor(61-(-1.15*.94+rz*.34)*145/depth)-64))
        for row in range(2,-1,-1):
            for col in range(3):
                i=row*4+col
                td.polygon([points[i],points[i+1],points[i+5],points[i+4]],fill=34+((row+col)%3)*2)
        for i in range(4):
            td.line([points[i*4],points[i*4+3]],fill=5)
            td.line([points[i],points[i+12]],fill=5)
        floor.paste(tile,(ox,oy))
    floor.save(ROOT/'images/floor.png')
    print('Beat Dancer: original palette, sheet and logo')


if __name__=='__main__':main()
