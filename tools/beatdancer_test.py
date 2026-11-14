"""Check Beat Dancer music sync, controls, all camera views and FLAC units.

Only scratch copies are instrumented. Performance is measured against the
plain cartridge, including the SDK's music analyser charge.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]
CART=ROOT/'beatdancer'


def build(sdk,folder,pbg):
    r=subprocess.run(['node',str(sdk/'pbgc.js'),'build',str(folder),'-o',str(pbg)],capture_output=True,text=True,timeout=30)
    assert r.returncode==0,r.stdout+r.stderr


def run(vm,pbg,ticks,extra=()):
    r=subprocess.run([str(vm),str(pbg),'--ticks',str(ticks),'--seed','1','--units']+list(extra),capture_output=True,text=True,timeout=60)
    assert r.returncode==0,r.stdout[-1000:]+r.stderr[-1000:]
    assert 'VIOLATION' not in r.stdout,r.stdout[-2000:]
    u=[int(p[2]) for l in r.stderr.splitlines() if len(p:=l.split())==3 and p[0]=='tick']
    return r,u


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--sdk',type=Path,default=Path(os.environ.get('SDK',ROOT.parent/'podbox/arcade/sdk')))
    ap.add_argument('--keep',type=Path)
    args=ap.parse_args();sdk=args.sdk.resolve();vm=sdk/'host/pbgvm'
    reports=[]
    with tempfile.TemporaryDirectory(prefix='beatdancer-test-') as temp:
        work=Path(temp);plain=work/'plain.pbg';build(sdk,CART,plain)
        folder=work/'checked';shutil.copytree(CART,folder)
        shutil.copy(ROOT/'tools/beatdancer_probe.js',folder/'probe.js')
        p=folder/'main.js';s=p.read_text().replace('function draw() {','function demoDraw() {')
        p.write_text(s+'\nfunction draw(){demoDraw();probe.check();}\n')
        checked=work/'checked.pbg';build(sdk,folder,checked)
        cases=[('silent demo',6000,[]),('playing without a beat',2000,['--playing']),
               ('slow beat',6000,['--playing','--beat','48','--buttons','300:16,301:0']),
               ('fast beat',6000,['--playing','--beat','180']),
               ('playlist transitions',45000,['--playing','--beat','0']),
               ('pause and suspend',6000,['--playing','--beat','120','--pause','400','--suspend-at','800']),
               ('music option off',3000,['--playing','--beat','120','--opt','1:0:0']),
               ('held style and orbit keys',1000,['--buttons','20:2,180:0,220:8,400:0','--opt','1:3:0']),
               ('free tempo minimum',3000,['--opt','1:1:60']),
               ('free tempo maximum',3000,['--opt','1:1:180'])]
        spin='300:16,301:0,900:16,901:0,1600:16,1601:0,2200:16,2201:0'
        for style in range(4):
            cases.append((f'style {style}, orbit, spin and overlay',6000,['--playing','--beat','120','--opt',f'1:2:{style},1:4:1','--buttons',spin]))
        for name,ticks,extra in cases:
            checked_run,_=run(vm,checked,ticks,extra)
            r,u=run(vm,plain,ticks,extra)
            assert len(u)==ticks
            assert max(u)<=17500,f'{name}: {max(u)} exceeds the 25 Hz FLAC budget'
            rows=[l.split() for l in checked_run.stdout.splitlines() if l.startswith('TOTAL ')]
            states=[l.split() for l in checked_run.stdout.splitlines() if l.startswith('STATE ')]
            if '--beat' in extra and name!='music option off':
                assert rows and int(rows[-1][2])>0,f'{name}: never found the beat'
            if name.startswith('style ') and not name.startswith('style 0'):
                expected=int(name.split()[1].strip(','))-1
                assert all(int(p[7])==expected for p in states),name
            if name=='playlist transitions':assert int(rows[-1][8])>=4,rows[-1]
            if name in ('playing without a beat','music option off','silent demo'):
                assert all(p[2]=='0' for p in states),name
            if name=='held style and orbit keys':
                assert all(p[7]=='1' for p in states[2:]),states
                assert all(p[8]=='1' for p in states[4:]),states
            values=sorted(u);record=dict(case=name,ticks=ticks,mean=sum(u)//ticks,p99=values[int(ticks*.99)],maximum=max(u))
            reports.append(record);print('PASS',name,':',record['mean'],'mean,',record['maximum'],'max units')
        # A fault must be visible to the probe.
        p=folder/'music.js';s=p.read_text().replace('pulse = max(0.0, 1.0 - phase * 3.0);','pulse = 2.0;');p.write_text(s)
        faulty=work/'faulty.pbg';build(sdk,folder,faulty)
        r=subprocess.run([str(vm),str(faulty),'--ticks','5'],capture_output=True,text=True)
        assert 'VIOLATION light envelope' in r.stdout,r.stdout+r.stderr
        print('PASS fault injection catches a broken light envelope')
        if args.keep:
            args.keep.mkdir(parents=True,exist_ok=True)
            (args.keep/'report.json').write_text(json.dumps(reports,indent=2)+'\n')
    print('Beat Dancer: all checks passed')


if __name__=='__main__':main()
