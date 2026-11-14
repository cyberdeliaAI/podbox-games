"""Capture a silent GIF of the actual cart at a simulated 120 BPM."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--sdk',type=Path,default=Path(os.environ.get('SDK',ROOT.parent/'podbox/arcade/sdk')))
    ap.add_argument('--out',type=Path,default=ROOT/'beatdancer/previews')
    args=ap.parse_args();sdk=args.sdk.resolve();args.out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='beatdancer-preview-') as temp:
        work=Path(temp);cart=work/'cart.pbg'
        subprocess.run(['node',str(sdk/'pbgc.js'),'build',str(ROOT/'beatdancer'),'-o',str(cart)],check=True)
        frames=[]
        for i in range(60):
            shot=work/f'{i:03}.png'
            subprocess.run([str(sdk/'host/pbgvm'),str(cart),'--ticks',str(300+i*2),'--seed','1','--playing','--beat','120',
                            '--opt','1:2:3,1:3:0','--buttons','340:16,341:0','--shot',str(shot)],check=True,capture_output=True)
            with Image.open(shot) as image:frames.append(image.convert('P',palette=Image.Palette.ADAPTIVE,colors=64))
        frames[0].save(args.out/'disco.png')
        frames[0].save(args.out/'disco.gif',save_all=True,append_images=frames[1:],duration=80,loop=0,disposal=2)
    print(f'Native preview: {args.out}/disco.gif')


if __name__=='__main__':main()
