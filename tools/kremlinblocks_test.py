"""Kremlin Blocks rule fixtures, autoplay, replay and FLAC budget checks."""
import argparse
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]
CART=ROOT/'kremlinblocks'


def build(sdk,folder,pbg):
    r=subprocess.run(['node',str(sdk/'pbgc.js'),'build',str(folder),'-o',str(pbg)],capture_output=True,text=True,timeout=30)
    assert r.returncode==0,r.stdout+r.stderr


def run(vm,pbg,ticks,buttons='',wheel='',extra=(),allow_fail=False):
    args=[str(pbg),'--ticks',str(ticks),'--seed','1','--units']
    if buttons:args+=['--buttons',buttons]
    if wheel:args+=['--wheel',wheel]
    r=subprocess.run(list(vm)+args+list(extra),capture_output=True,text=True,timeout=90)
    assert r.returncode==0,r.stdout[-1500:]+r.stderr[-1500:]
    assert allow_fail or 'VIOLATION' not in r.stdout,r.stdout[-1500:]
    u=[int(p[2]) for l in r.stderr.splitlines() if len(p:=l.split())==3 and p[0]=='tick']
    return r,u


def instrument(work,name,pilot=False):
    d=work/name;shutil.copytree(CART,d)
    if pilot:
        for p in d.glob('*.js'):p.write_text(p.read_text().replace('btn(','pilot.button(').replace('wheel()','pilot.wheelInput()'))
        shutil.copy(ROOT/'tools/kremlinblocks_pilot.js',d/'pilot.js')
    shutil.copy(ROOT/'tools/kremlinblocks_probe.js',d/'probe.js')
    p=d/'main.js';p.write_text(p.read_text().replace('function update(){','function gameUpdate(){')+
                               '\nfunction update(){'+('pilot.before();' if pilot else '')+'gameUpdate();probe.check();}\n')
    return d


def perf(units,label):
    u=sorted(units);assert u and max(u)<=12500,(label,max(u))
    report=dict(case=label,ticks=len(u),mean=sum(u)//len(u),p99=u[int(len(u)*.99)],maximum=max(u))
    print('PERF',label,':',report['mean'],'mean,',report['maximum'],'max units')
    return report


def states(log):return [l for l in log.splitlines() if l.startswith('STATE ')]


def fixtures(sdk,vm,work,fault=False):
    d=work/'fixtures';shutil.copytree(CART,d)
    shutil.copy(ROOT/'tools/kremlinblocks_fixtures.js',d/'checks.js')
    p=d/'main.js';p.write_text(p.read_text().replace('function update(){','function gameUpdate(){')+'\nfunction update(){checks.step();}\n')
    if fault:
        p=d/'board.js';s=p.read_text();assert 'counts[dest]=counts[y]' in s
        p.write_text(s.replace('counts[dest]=counts[y]','counts[dest]=0'))
    pbg=work/'fixtures.pbg';build(sdk,d,pbg);r,_=run(vm,pbg,12,allow_fail=True)
    if fault:
        assert 'FAIL compacted row count' in r.stdout,r.stdout
        print('PASS fault injection catches broken row compaction')
    else:
        assert 'FAIL ' not in r.stdout and 'FIXTURES 0' in r.stdout,r.stdout
        print('PASS seven-bag, walls, floor, lock-out, rotations, row clears, scoring, reset limit and top-out')


def browser_vm(sdk,runtime,work):
    d=work/'browser';d.mkdir();(d/'wasm').mkdir()
    (d/'package.json').write_text('{"type":"module"}');(d/'src').symlink_to(sdk/'src')
    shutil.copy(sdk/'pbgrun.js',d/'pbgrun.js');shutil.copy(runtime,d/'wasm/arcade.wasm')
    return ['node',str(d/'pbgrun.js')]


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--sdk',type=Path,default=Path(os.environ.get('SDK',ROOT.parent/'podbox/arcade/sdk')))
    ap.add_argument('--keep',type=Path);ap.add_argument('--browser-runtime',type=Path);ap.add_argument('--selftest',action='store_true')
    args=ap.parse_args();sdk=args.sdk.resolve();vm=[str(sdk/'host/pbgvm')];reports=[]
    with tempfile.TemporaryDirectory(prefix='kremlinblocks-test-') as temp:
        w=Path(temp);fixtures(sdk,vm,w,args.selftest)
        if args.selftest:return
        plain=w/'plain.pbg';build(sdk,CART,plain)
        checked=w/'checked.pbg';build(sdk,instrument(w,'checked'),checked)
        pilot=w/'pilot.pbg';build(sdk,instrument(w,'pilot',True),pilot)
        p,_=run(vm,pilot,9000)
        assert 'achieved Four at Once' in p.stdout and 'achieved Forty Lines' in p.stdout,p.stdout[-1500:]
        summary=[l.split() for l in p.stdout.splitlines() if l.startswith('SUMMARY ')][-1]
        assert int(summary[1])>=100,summary
        events=[l.split() for l in p.stdout.splitlines() if l.startswith('INPUT ')]
        buttons=','.join(f'{p[1]}:{p[2]}' for p in events)
        wheel=','.join(f'{p[1]}:{p[3]}:-1' for p in events if p[3]!='0')
        c,_=run(vm,checked,9000,buttons,wheel)
        assert states(c.stdout)==states(p.stdout),'instrumented pilot and real input replay differ'
        r,u=run(vm,plain,9000,buttons,wheel);reports.append(perf(u,'autoplay replay'))
        assert 'achieved Forty Lines' in r.stdout
        print('PASS actual button/wheel autoplay:',summary[1],'rows across',int(summary[2])+1,'rounds')
        _,overlay=run(vm,plain,9000,buttons,wheel,['--opt','1:3:1']);reports.append(perf(overlay,'autoplay with overlay'))
        _,music=run(vm,plain,9000,buttons,wheel,['--playing','--beat','128']);assert music==u
        suspended,_=run(vm,checked,9000,buttons,wheel,['--suspend-at','4000'])
        assert states(suspended.stdout)==states(c.stdout),'VM snapshot changed board or bag'
        print('PASS owner music leaves logic/work intact and native suspend keeps the complete game')
        for label,b,extra,locks in [('held Select','2:16,180:0',[],0),('one hard drop','2:16,3:0,20:16,21:0',[],1),('pause consumes a held drop','2:16,3:0,20:16,150:0',['--pause','60'],1)]:
            cr,_=run(vm,checked,200,b,extra=extra)
            last=states(cr.stdout)[-1].split();assert int(last[6])==locks,(label,last)
            print('PASS',label)
        rng=random.Random(17);b=[];turns=[]
        for t in range(2,5000,13):
            b.extend([(t,rng.choice([16,8,1,2,0])),(t+2,0)])
            turns.append((t,rng.randint(-28,28)))
        blind_b=','.join(f'{t}:{m}' for t,m in b);blind_w=','.join(f'{t}:{v}:-1' for t,v in turns)
        extras=['--opt','1:2:10,1:3:1','--pause','700,2700','--skip','1000:5,2000:3']
        run(vm,checked,5000,blind_b,blind_w,extras)
        _,bu=run(vm,plain,5000,blind_b,blind_w,extras);reports.append(perf(bu,'level 10 random input, skipped draws and overlay'))
        if args.browser_runtime:
            br,wu=run(browser_vm(sdk,args.browser_runtime.resolve(),w),checked,9000,buttons,wheel)
            assert states(br.stdout)==states(c.stdout),'WASM/native board state differs'
            print('PASS full 9000-tick browser WASM/native replay parity')
        if args.keep:
            args.keep.mkdir(parents=True,exist_ok=True)
            for name,text in [('report.json',json.dumps(reports,indent=2)+'\n'),('buttons.txt',buttons),('wheel.txt',wheel),('pilot.log',p.stdout),('units.log',r.stderr)]:
                (args.keep/name).write_text(text)
        print('Kremlin Blocks: all checks passed')


if __name__=='__main__':main()
