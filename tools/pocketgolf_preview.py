"""Render four theme previews through the production native VM."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--sdk',type=Path,default=Path(os.environ.get('SDK',ROOT.parent/'podbox/arcade/sdk')))
    ap.add_argument('--out',type=Path,default=ROOT/'pocketgolf/previews')
    args=ap.parse_args();sdk=args.sdk.resolve();args.out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pocketgolf-preview-') as temp:
        work=Path(temp);cart=work/'preview.pbg'
        subprocess.run(['node',str(sdk/'pbgc.js'),'build',str(ROOT/'pocketgolf'),'-o',str(cart)],check=True)
        for hole,name in [(0,'gardens'),(9,'pirate'),(21,'desert'),(35,'winter')]:
            plan=json.loads((ROOT/'pocketgolf/data'/f'h{hole+1:02}.json').read_text())
            x,y=plan['tee'];store=work/name;store.mkdir()
            state=dict(version=1,hole=hole,mode=3,scene=1,strokes=0,total=0,x=x,y=y,vx=0.0,vy=0.0,z=0.0,vz=0.0,safeX=x,safeY=y,cup=False,moving=False,cooldown=0,delay=0,clock=0,gate=False,debt=0,aim=0.0,scores=[0]*36,picked=False,previousBest=0,newRecord=False)
            (store/'round.json').write_text(json.dumps(state))
            buttons='2:16,3:0'+(',20:8,21:0' if hole==35 else '')
            subprocess.run([str(sdk/'host/pbgvm'),str(cart),'--ticks','60','--seed','1','--buttons',buttons,'--store',str(store),'--shot',str(args.out/f'{name}.png')],check=True)
    print(f'Previews: {args.out}')


if __name__=='__main__':main()
