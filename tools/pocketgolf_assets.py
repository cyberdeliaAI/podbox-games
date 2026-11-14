"""Generate Pocket Golf's original art and 36 explicit authored hole plans.

Edit HOLES to change layouts. No random layout generation is used. The
navigation fields are test/AI hints derived from the physical geometry.
Writes pocketgolf/ and this tool's navigation hints. Pillow is required.
"""
from pathlib import Path
import argparse
import collections
import json
import math
from PIL import Image,ImageDraw

CART=Path(__file__).resolve().parents[1]/'pocketgolf'
STANDARD=[0x000000,0x1a2244,0x6b2a5e,0x0f6640,0x8a5236,0x4f4a52,0xb8b4bc,0xf6f2ea,0xe8304a,0xf5962a,0xf8e43c,0x3cd250,0x2f9cf0,0x7e7aa8,0xf27ab4,0xf9c89a]
PAL=STANDARD+[0x173b2a,0x245d37,0x3c8b45,0x79bc57,0xc9e388,0x234754,0x3c735a,0x61ab73,0xa9db8d,0xf1dd9a,0x5a3d2d,0x86603c,0xb88a50,0xe2b868,0xffdf92,0x4f6b82,0x7b9cac,0xaac5cf,0xd5e5df,0xf7f5df,0xcbae65,0x9dcde0,0x2877b1,0x255a2f,0x182d31,0x766e55,0xf0c868,0xb27ce0,0x6a49a2,0x122a3c,0x82b8df]
FLAT=[v for c in PAL for v in ((c>>16)&255,(c>>8)&255,c&255)]+[0]*(768-len(PAL)*3)
COURSES=['Sunny Gardens','Pirate Cove','Desert Adventure','Winter Wonderland']


def line(x0,y0,x1,y1,height=8,bounce=.82):
    length=math.hypot(x1-x0,y1-y0)
    return [x0,y0,x1,y1,round((x1-x0)/length,6),round((y1-y0)/length,6),round(length,5),height,bounce]


def mover(kind,x,y,r=12,period=220,angle=0,dx=0,dy=0):
    return dict(kind=kind,x=x,y=y,r=r,period=period,angle=angle,dx=dx,dy=dy)


def special(kind,x,y,tx=0,ty=0,angle=0,r=4):
    return dict(kind=kind,x=x,y=y,tx=tx,ty=ty,angle=angle,r=r)


def hole(name,par=2,tee=(24,44),cup=(136,44),w=160,h=88,lines=(),regions=(),movers=(),circles=(),specials=(),base=0):
    return dict(name=name,par=par,tee=list(tee),cup=list(cup),w=w,h=h,
                lines=[line(8,8,w-8,8),line(w-8,8,w-8,h-8),line(w-8,h-8,8,h-8),line(8,h-8,8,8)]+list(lines),
                regions=list(regions),movers=list(movers),circles=list(circles),specials=list(specials),base=base)

# Surface numbers: green, fast, rough, sand, ice, water, N/E/S/W slopes,
# bridge and ramp. Each entry below is an authored layout, not a seed.
HOLES=[
 hole('First Putt'),
 hole('The Bank',3,lines=[line(80,8,80,52)]),
 hole('Garden Bend',3,tee=(24,64),cup=(136,64),lines=[line(78,38,78,80),line(78,38,120,38)]),
 hole('Sand Picnic',3,regions=[[36,18,20,52,2],[60,22,32,44,3]]),
 hole('Gentle Rise',3,regions=[[60,24,40,40,8]]),
 hole('Under the Hedge',3,lines=[line(80,8,80,80)],specials=[special(2,63,44,103,44)]),
 hole('Garden Gate',3,movers=[mover(2,80,44,r=14,angle=.25,dy=20)]),
 hole('Little Windmill',3,movers=[mover(1,80,44,r=14,period=260)]),
 hole('Festival Finale',4,tee=(24,60),cup=(168,28),w=192,h=112,lines=[line(72,8,72,65),line(120,50,120,104)],regions=[[80,16,32,24,3]],circles=[[152,76,7]]),
 hole('Boardwalk',3,regions=[[64,8,32,72,5],[60,36,40,16,10]]),
 hole('Twin Islands',3,tee=(24,28),cup=(168,84),w=192,h=112,regions=[[56,8,72,96,5],[52,20,80,16,10],[112,32,16,56,10]]),
 hole('The Shipwreck',3,lines=[line(60,24,96,60),line(96,60,120,44)],circles=[[112,24,6]]),
 hole('Tidal Bend',4,tee=(24,68),cup=(136,20),regions=[[48,8,24,72,5],[44,56,32,16,10],[96,40,24,16,5]]),
 hole('Moon Pearl',3,regions=[[76,8,16,72,5]],specials=[special(1,60,44,112,44)],circles=[[136,68,7]]),
 hole('Cannon Run',3,regions=[[48,24,64,40,1]],specials=[special(3,54,44,angle=0)]),
 hole('Captain Spinner',4,movers=[mover(4,80,44,r=18,period=300)],circles=[[112,25,6],[112,64,6]],specials=[special(6,80,44,r=12)]),
 hole('Hidden Passage',4,lines=[line(84,8,84,80)],regions=[[20,60,40,16,5]],specials=[special(2,44,24,112,60)]),
 hole('Treasure Route',5,tee=(24,84),cup=(192,28),w=224,h=128,lines=[line(72,40,72,120),line(136,8,136,80)],regions=[[88,32,24,72,5],[84,88,32,16,10]],specials=[special(1,44,28,160,88)]),
 hole('Dune Welcome',3,regions=[[56,16,48,56,3]]),
 hole('Temple Angles',3,lines=[line(68,16,92,40),line(68,72,92,48)]),
 hole('Sunken Courtyard',4,tee=(24,72),cup=(168,24),w=192,h=112,regions=[[48,8,24,72,3],[88,32,32,72,3]],lines=[line(128,8,128,72)]),
 hole('Rampart Jump',3,regions=[[50,28,20,32,11]],specials=[special(5,60,44,r=5)],lines=[line(90,18,90,70,height=1.0)]),
 hole('Sand Clock',4,movers=[mover(2,80,44,r=16,angle=.25,dy=18,period=180)],regions=[[32,20,24,48,3],[104,20,24,48,3]]),
 hole('Temple Switch',4,lines=[],movers=[mover(3,80,44,r=36,angle=.25,period=250)],specials=[special(4,44,64,r=5)]),
 hole('Solar Boost',4,tee=(24,64),cup=(136,24),regions=[[40,12,80,20,3]],specials=[special(3,50,60,angle=.125)]),
 hole('Round the Ruins',4,tee=(24,24),cup=(136,64),circles=[[64,30,9],[96,58,9]],lines=[line(78,8,78,42)]),
 hole('Pharaoh Finale',5,tee=(24,84),cup=(192,24),w=224,h=128,lines=[line(70,8,70,74),line(144,44,144,120)],regions=[[88,20,36,30,3],[164,62,24,40,9]],movers=[mover(1,112,88,r=14,period=280)]),
 hole('First Frost',2,regions=[[48,18,64,52,4]]),
 hole('Snow Bank',3,tee=(24,64),cup=(136,24),regions=[[32,16,96,56,4]],lines=[line(80,8,80,48)]),
 hole('Frozen Bridge',3,regions=[[60,8,40,72,5],[56,34,48,20,4]]),
 hole('Glacier Turn',4,tee=(24,84),cup=(168,24),w=192,h=112,regions=[[32,16,120,80,4]],lines=[line(76,40,76,104),line(76,40,124,40)]),
 hole('Polar Portals',4,regions=[[64,8,28,72,5]],specials=[special(1,44,24,116,64)]),
 hole('Aurora Slope',4,regions=[[40,16,72,56,4],[60,28,32,32,6]],circles=[[112,20,6]]),
 hole('Ice Windmill',4,regions=[[32,16,96,56,4]],movers=[mover(1,80,44,r=14,period=300)]),
 hole('Snow Switch',4,tee=(24,64),cup=(136,24),movers=[mover(3,80,44,r=36,angle=.25)],specials=[special(4,44,28,r=5)],regions=[[96,16,32,56,4]]),
 hole('Deluxe Summit',5,tee=(24,92),cup=(208,24),w=240,h=144,lines=[line(72,8,72,96),line(152,48,152,136)],regions=[[88,20,40,80,4],[176,64,24,48,3]],movers=[mover(2,112,108,r=12,angle=.25,dx=14,period=240)],specials=[special(5,48,108,r=5),special(1,44,28,184,108)]),
]


def surface(plan,x,y):
    value=plan['base']
    for rx,ry,w,h,s in plan['regions']:
        if rx<=x<rx+w and ry<=y<ry+h:value=s
    return value


def distance_segment(x,y,l):
    t=max(0,min(l[6],(x-l[0])*l[4]+(y-l[1])*l[5]))
    return math.hypot(x-l[0]-l[4]*t,y-l[1]-l[5]*t)


def field(plan,target):
    w,h=math.ceil(plan['w']/4),math.ceil(plan['h']/4)
    clear=set()
    for y in range(h):
        for x in range(w):
            px,py=x*4+2,y*4+2
            if not 10<=px<plan['w']-10 or not 10<=py<plan['h']-10:continue
            if surface(plan,px,py)==5:continue
            if any(distance_segment(px,py,l)<2.1 for l in plan['lines']):continue
            if any(math.hypot(px-cx,py-cy)<r+2.0 for cx,cy,r in plan['circles']):continue
            clear.add((x,y))
    reverse={}
    for o in plan['specials']:
        if o['kind'] not in (1,2):continue
        out=(int(o['tx']//4),int(o['ty']//4))
        for p in clear:
            if abs(p[0]*4+2-o['x'])<=o['r'] and abs(p[1]*4+2-o['y'])<=o['r']:
                reverse.setdefault(out,[]).append(p)
    end=(int(target[0]//4),int(target[1]//4))
    assert end in clear,(plan['name'],'target blocked',end)
    dist={end:0};todo=collections.deque([end])
    while todo:
        x,y=todo.popleft()
        for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]+reverse.get((x,y),[]):
            if p in clear and p not in dist:dist[p]=dist[(x,y)]+1;todo.append(p)
    start=(plan['tee'][0]//4,plan['tee'][1]//4)
    assert start in dist,(plan['name'],'no route from tee')
    return [dist.get((x,y),-1) for y in range(h) for x in range(w)]


def indexed(w,h,c=0):
    p=Image.new('P',(w,h),c);p.putpalette(FLAT);return p


def art(plan,index):
    theme=index//9;green=18+theme*5
    image=indexed(plan['w'],plan['h'],16+theme*5);d=ImageDraw.Draw(image)
    d.rectangle((8,8,plan['w']-8,plan['h']-8),fill=green)
    px=image.load()
    for y in range(10,plan['h']-8):
        for x in range(10,plan['w']-8):
            s=surface(plan,x,y)
            colour=green
            if s==1:colour=green+1 if x%8==0 else green
            elif s==2:colour=39 if (x+y)%3 else 3
            elif s==3:colour=36 if (x*5+y*7)%17 else 27
            elif s==4:colour=37 if (x-y)%19 else 34
            elif s==5:colour=38 if y%7 else 12
            elif s in (6,7,8,9):colour=green+1 if (x+y)%8<2 else green
            elif s==10:colour=27 if x%5 else 29
            elif s==11:colour=42 if x%5 else 26
            elif (x*11+y*7)%53==0:colour=green+1
            px[x,y]=colour
    # Raised barrier edges and their offset shadows are baked once.
    for l in plan['lines']:
        pts=(l[0],l[1],l[2],l[3])
        d.line((l[0]+2,l[1]+3,l[2]+2,l[3]+3),fill=40,width=4)
        d.line(pts,fill=26 if theme<3 else 31,width=3)
        d.line((l[0],l[1]-1,l[2],l[3]-1),fill=29 if theme<3 else 34,width=1)
    for x,y,r in plan['circles']:
        d.ellipse((x-r+1,y-r+2,x+r+1,y+r+2),fill=40)
        d.ellipse((x-r,y-r,x+r,y+r),fill=9,outline=15)
    for o in plan['specials']:
        x,y=o['x'],o['y'];r=o['r']
        d.ellipse((x-r,y-r,x+r,y+r),fill=43 if o['kind'] in (1,2) else 42,outline=7)
        if o['kind'] in (1,2):d.ellipse((x-2,y-2,x+2,y+2),fill=44)
        if o['kind'] in (1,2):
            tx,ty=o['tx'],o['ty']
            d.ellipse((tx-4,ty-4,tx+4,ty+4),fill=43,outline=7)
            d.ellipse((tx-2,ty-2,tx+2,ty+2),fill=44)
        if o['kind']==4:d.line((x-2,y,x+2,y),fill=8,width=2)
        if o['kind']==5:d.polygon([(x-3,y+2),(x+3,y+2),(x,y-3)],fill=7)
        if o['kind']==6:
            d.line((x-r+2,y,x+r-2,y),fill=29,width=2)
            d.line((x,y-r+2,x,y+r-2),fill=29,width=2)
    for x,y,w,h,s in plan['regions']:
        if s in (6,7,8,9):
            cx,cy=x+w//2,y+h//2;dx,dy={6:(0,-4),7:(4,0),8:(0,4),9:(-4,0)}[s]
            d.line((cx-dx,cy-dy,cx+dx,cy+dy),fill=7)
            d.ellipse((cx+dx-1,cy+dy-1,cx+dx+1,cy+dy+1),fill=7)
    # Tiny original theme ornaments sit beyond the playable boundary.
    for x in range(16,plan['w']-12,24):
        if theme==0:d.ellipse((x,1,x+3,4),fill=14);d.point((x+1,2),fill=10)
        elif theme==1:d.line((x,1,x+5,5),fill=29,width=2)
        elif theme==2:d.line((x,1,x,5),fill=11,width=2)
        else:d.polygon([(x,0),(x-3,5),(x+3,5)],fill=3)
    cup=plan['cup'];d.ellipse((cup[0]-3,cup[1]-2,cup[0]+3,cup[1]+3),fill=7);d.ellipse((cup[0]-2,cup[1]-1,cup[0]+2,cup[1]+2),fill=0)
    d.line((cup[0]+1,cup[1]-10,cup[0]+1,cup[1]-2),fill=7);d.polygon([(cup[0]+2,cup[1]-10),(cup[0]+8,cup[1]-8),(cup[0]+2,cup[1]-6)],fill=8)
    return image


def generated_snapshot():
    files=[p for p in CART.rglob('*') if p.is_file() and
           (p.relative_to(CART).parts[0] in ('data','images','maps','palettes') or
            p.name in ('cart.json','sheet.png','logo.png'))]
    files.append(CART.parent/'tools/pocketgolf_routes.json')
    result={}
    for p in files:
        if not p.exists():continue
        if p.suffix=='.png':
            with Image.open(p) as image:
                result[str(p)]=(image.mode,image.size,bytes(image.getpalette() or []),image.tobytes())
        else:result[str(p)]=p.read_bytes()
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='compare data, palette and image pixels with committed output')
    args=parser.parse_args()
    before=generated_snapshot() if args.check else None
    assert len(HOLES)==36
    for folder in ['data','images','maps','palettes']:(CART/folder).mkdir(exist_ok=True)
    catalog=[];routes=[]
    for i,plan in enumerate(HOLES):
        switch=next((o for o in plan['specials'] if o['kind']==4),None)
        routes.append(dict(field=field(plan,plan['cup']),gw=math.ceil(plan['w']/4),
                           switchField=field(plan,(switch['x'],switch['y'])) if switch else []))
        name=f'h{i+1:02}'
        (CART/'data'/f'{name}.json').write_text(json.dumps(plan,separators=(',',':'))+'\n')
        image=art(plan,i);image.save(CART/'images'/f'{name}.png')
        if plan['w']>160 or plan['h']>88:
            image.resize((plan['w']//2,plan['h']//2),Image.Resampling.NEAREST).save(CART/'images'/f'o{i+1:02}.png')
        else:
            (CART/'images'/f'o{i+1:02}.png').unlink(missing_ok=True)
        w,h=math.ceil(plan['w']/8),math.ceil(plan['h']/8)
        rows=[''.join(f'{surface(plan,x*8+4,y*8+4)+1:02x}' for x in range(w)) for y in range(h)]
        level={'width':w,'height':h,'rows':rows,'objects':[{'kind':'tee','x':plan['tee'][0],'y':plan['tee'][1],'w':1,'h':1},{'kind':'cup','x':plan['cup'][0],'y':plan['cup'][1],'w':1,'h':1,'props':{'par':plan['par']}}]}
        (CART/'maps'/f'{name}.json').write_text(json.dumps(level,indent=2)+'\n')
        catalog.append({'name':plan['name'],'par':plan['par'],'course':i//9,'w':plan['w'],'h':plan['h']})
    (CART/'data/catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
    (CART.parent/'tools/pocketgolf_routes.json').write_text(json.dumps(routes,separators=(',',':'))+'\n')
    lines=['GIMP Palette','Name: Pocket Golf','Columns: 16','#']+[f'{c>>16&255:3} {c>>8&255:3} {c&255:3}\tc{i}' for i,c in enumerate(PAL)]
    (CART/'palettes/golf.gpl').write_text('\n'.join(lines)+'\n')
    sheet=indexed(128,128);d=ImageDraw.Draw(sheet)
    for i in range(1,13):
        x=i%16*8;y=i//16*8;d.rectangle((x,y,x+7,y+7),fill=[18,19,39,36,37,38,19,19,19,19,27,42][i-1])
    sheet.save(CART/'sheet.png')
    logo=indexed(44,44,16);d=ImageDraw.Draw(logo);d.rounded_rectangle((2,2,41,41),radius=6,fill=18,outline=29,width=2);d.ellipse((23,27,33,32),fill=0);d.line((28,8,28,29),fill=7,width=2);d.polygon([(30,8),(39,12),(30,17)],fill=8);d.ellipse((9,27,17,35),fill=7);d.point((11,29),fill=6);logo.save(CART/'logo.png')
    cart=json.loads((CART/'cart.json').read_text());cart['lazy_images']=[f'h{i+1:02}' for i in range(36)]+[f'o{i+1:02}' for i,p in enumerate(HOLES) if p['w']>160 or p['h']>88];(CART/'cart.json').write_text(json.dumps(cart,indent=2)+'\n')
    print('Pocket Golf: 36 authored holes, four themes, backgrounds and navigation fields')
    if args.check:
        after=generated_snapshot()
        if before!=after:raise SystemExit('Generated assets differ. Review and regenerate the Pocket Golf assets.')
        print('PASS generated data, palettes and image pixels match')


if __name__=='__main__':main()
