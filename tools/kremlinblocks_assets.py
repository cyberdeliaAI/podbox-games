"""Generate Kremlin Blocks' original blocks, logo and rotation coordinates."""
from pathlib import Path
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]/'kremlinblocks'
PALETTE=[0x000000,0x1a2244,0x6b2a5e,0x0f6640,0x8a5236,0x4f4a52,0xb8b4bc,0xf6f2ea,0xe8304a,0xf5962a,0xf8e43c,0x3cd250,0x2f9cf0,0x7e7aa8,0xf27ab4,0xf9c89a]
PALETTE += [0x130f1d,0x32121c,0x571b27,0x8a2931,0xbb433f,0xdba952,0xf3db9b,0x24514a,0x3e7b58,0xe9ddc9,0x65613d,0x252037]
COLOURS=[12,10,14,11,8,13,9]
BASE=[[(0,1),(1,1),(2,1),(3,1)],[(1,0),(2,0),(1,1),(2,1)],[(1,0),(0,1),(1,1),(2,1)],[(1,0),(2,0),(0,1),(1,1)],[(0,0),(1,0),(1,1),(2,1)],[(0,0),(0,1),(1,1),(2,1)],[(2,0),(0,1),(1,1),(2,1)]]


def main():
    flat=[v for c in PALETTE for v in (c>>16&255,c>>8&255,c&255)]+[0]*(768-len(PALETTE)*3)
    sheet=Image.new('P',(128,128),0);sheet.putpalette(flat);d=ImageDraw.Draw(sheet)
    for i,c in enumerate(COLOURS,1):
        x=i*8;d.rectangle((x,0,x+3,3),fill=c);d.line((x,0,x+3,0),fill=7);d.line((x,0,x,3),fill=6);d.point((x+3,3),fill=5)
    sheet.save(ROOT/'sheet.png')
    (ROOT/'images').mkdir(exist_ok=True);(ROOT/'palettes').mkdir(exist_ok=True)
    rows=['GIMP Palette','Name: Kremlin Blocks','Columns: 16','#']+[f'{c>>16&255} {c>>8&255} {c&255}\tc{i}' for i,c in enumerate(PALETTE)]
    (ROOT/'palettes/kremlin.gpl').write_text('\n'.join(rows)+'\n')
    back=Image.new('P',(160,120),16);back.putpalette(flat);sky=ImageDraw.Draw(back)
    for y in range(40,111):sky.line((0,y,159,y),fill=17 if y>72 else 16)
    for x,y in [(8,19),(151,27),(42,34),(120,12),(26,44),(102,25),(66,42)]:sky.point((x,y),fill=26)
    # Red-brick walls and swallowtail crenellations, drawn from a new plan.
    sky.rectangle((0,91,159,112),fill=18)
    for y in range(95,112,5):
        sky.line((0,y,159,y),fill=17)
        for x in range((y//5%2)*6,160,12):sky.line((x,y-4,x,y),fill=19)
    for x in range(0,160,10):sky.polygon([(x,92),(x,87),(x+2,87),(x+4,90),(x+6,87),(x+8,87),(x+8,92)],fill=19)
    def tower(x,top,width,roof,clock=False):
        left=x-width//2;right=x+width//2
        sky.rectangle((left,top,right,104),fill=19)
        sky.line((left,top,left,104),fill=20);sky.line((right,top,right,104),fill=18)
        for yy in range(top+6,104,7):
            sky.line((left+1,yy,right-1,yy),fill=18)
            for xx in range(left+3+(yy%2)*3,right,6):sky.line((xx,yy-5,xx,yy),fill=18)
        sky.rectangle((left-2,top-3,right+2,top+1),fill=21)
        sky.polygon([(left-3,top-4),(x,roof),(right+3,top-4)],fill=23)
        sky.line((x,roof,left-3,top-4),fill=24)
        sky.line((x,roof-6,x,roof),fill=21)
        sky.polygon([(x,roof-10),(x+1,roof-7),(x+4,roof-7),(x+1,roof-5),(x+2,roof-2),(x,roof-4),(x-3,roof-2),(x-2,roof-5),(x-4,roof-7),(x-1,roof-7)],fill=21)
        if clock:
            cy=top+9;sky.ellipse((x-6,cy-6,x+6,cy+6),fill=22,outline=21)
            sky.line((x,cy-4,x,cy,x+3,cy+1),fill=17)
        for yy in range(top+22,97,11):sky.rectangle((x-2,yy,x+2,yy+5),fill=17)
    tower(21,67,16,45)
    tower(126,55,18,29,True)
    tower(80,67,24,42,True)
    tower(151,77,12,59)
    # A small onion dome gives the skyline another recognisable silhouette.
    sky.rectangle((42,77,54,104),fill=19)
    sky.polygon([(42,77),(40,70),(43,64),(47,59),(49,54),(51,61),(56,68),(56,73),(54,77)],fill=21)
    sky.line((49,54,49,48),fill=22);sky.line((47,50,51,50),fill=22)
    for x in range(3,158,8):
        sky.polygon([(x,115),(x+3,112),(x+6,115),(x+3,118)],fill=19)
        sky.point((x+3,115),fill=21)
    back.save(ROOT/'images/back.png')
    logo=Image.new('P',(44,44),16);logo.putpalette(flat);d=ImageDraw.Draw(logo);d.rectangle((2,2,41,41),outline=13)
    for x,y,k in [(0,6,0),(1,6,0),(2,6,0),(3,6,0),(4,6,1),(5,6,1),(4,5,1),(5,5,1),(0,5,5),(0,4,5),(1,5,5),(2,5,5),(3,4,2),(2,3,2),(3,3,2),(4,3,2),(1,1,3),(2,1,3),(0,2,3),(1,2,3)]:
        sx,sy=5+x*5,4+y*5;d.rectangle((sx,sy,sx+3,sy+3),fill=COLOURS[k]);d.point((sx,sy),fill=7)
    d.rectangle((31,16,39,39),fill=19)
    d.polygon([(29,16),(35,6),(41,16)],fill=24)
    d.line((35,2,35,6),fill=21);d.point((34,3),fill=21);d.point((36,3),fill=21)
    d.ellipse((33,20,37,24),fill=22);d.line((35,20,35,22,36,22),fill=17)
    logo.save(ROOT/'logo.png')
    xs=[];ys=[]
    for kind,base in enumerate(BASE):
        points=list(base)
        for rotation in range(4):
            xs.extend(p[0] for p in points);ys.extend(p[1] for p in points)
            if kind!=1:
                limit=3 if kind==0 else 2
                points=[(limit-y,x) for x,y in points]
    (ROOT/'pieces.js').write_text('// pieces: generated four-cell rotations. Edit tools/kremlinblocks_assets.py.\nvar xs='+str(xs)+';\nvar ys='+str(ys)+';\n')
    print('Kremlin Blocks: original sprites, logo and seven piece geometries')


if __name__=='__main__':main()
