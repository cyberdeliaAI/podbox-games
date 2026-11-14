"""Capture the Kremlin Blocks title and real autoplay through the native VM."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
STAGE_TICKS=[640,1310,2210,3110,4110]   # ticks of the saved autoplay in each stage: day, winter, sunset, white nights, night


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--sdk',type=Path,default=Path(os.environ.get('SDK',ROOT.parent/'podbox/arcade/sdk')))
    ap.add_argument('--trace',type=Path,default=ROOT/'dist/kremlinblocks-checks')
    ap.add_argument('--out',type=Path,default=ROOT/'kremlinblocks/previews')
    args=ap.parse_args();sdk=args.sdk.resolve()
    if not (args.trace/'buttons.txt').exists():ap.error('Run tools/kremlinblocks_test.py --keep dist/kremlinblocks-checks first')
    args.out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='kremlinblocks-preview-') as temp:
        w=Path(temp);cart=w/'cart.pbg'
        subprocess.run(['node',str(sdk/'pbgc.js'),'build',str(ROOT/'kremlinblocks'),'-o',str(cart)],check=True)
        base=[str(sdk/'host/pbgvm'),str(cart),'--seed','1']
        # the title with a firework going up over the domes
        subprocess.run(base+['--ticks','70','--shot',str(w/'title.png')],check=True,capture_output=True)
        frames=[]
        with Image.open(w/'title.png') as image:frames.append(image.convert('P',palette=Image.Palette.ADAPTIVE,colors=96))
        frames[0].save(args.out/'title.png')
        # seven frames in each of the five stages the autoplay passes through
        for start in STAGE_TICKS:
            for i in range(7):
                p=w/f'{start}_{i}.png'
                subprocess.run(base+['--ticks',str(start+i*6),'--buttons',(args.trace/'buttons.txt').read_text(),'--wheel',(args.trace/'wheel.txt').read_text(),'--shot',str(p)],check=True,capture_output=True)
                with Image.open(p) as image:frames.append(image.convert('P',palette=Image.Palette.ADAPTIVE,colors=96))
        frames[4].save(args.out/'game.png')
        durations=[1500]+([150]*6+[700])*len(STAGE_TICKS)
        frames[0].save(args.out/'game.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=2)
    print('Native previews:',args.out)


if __name__=='__main__':main()
