"""Outpost Echo release checks: campaign autoplay, real inputs and saves.

    python3 tools/outpostecho_test.py
    python3 tools/outpostecho_test.py --selftest
    python3 tools/outpostecho_test.py --browser-runtime /path/to/arcade.wasm

Only this cart is built. The pilot drives production button handling in a
scratch copy, then the exact inputs replay against the plain cartridge.
The plain replay must finish all five sectors and meet the frame budget.
"""
import argparse
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[1]
CART = REPO / 'outpostecho'


def build(sdk, folder, output):
    r = subprocess.run(['node', str(sdk/'pbgc.js'), 'build', str(folder), '-o', str(output)], capture_output=True, text=True, timeout=30)
    assert r.returncode == 0, r.stdout+r.stderr


def run(vm, cart, ticks, buttons='', wheel='', extra=(), store=None):
    args = [str(cart), '--ticks', str(ticks), '--seed', '1', '--units']
    if buttons: args += ['--buttons', buttons]
    if wheel: args += ['--wheel', wheel]
    if store:
        Path(store).mkdir(exist_ok=True)
        args += ['--store', str(store)]
    r = subprocess.run(list(vm)+args+list(extra), capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stdout[-1500:]+r.stderr[-1500:]
    assert 'VIOLATION' not in r.stdout, r.stdout[-2000:]
    units = [int(p[2]) for line in r.stderr.splitlines() if len(p:=line.split())==3 and p[0]=='tick']
    return r, units


def validate_maps():
    sectors = json.loads((CART/'data/sectors.json').read_text())
    flags = json.loads((CART/'flags.json').read_text())
    for name, plan in zip(['arrival','research','reactor','botanical','communications'], sectors):
        level = json.loads((CART/'maps'/f'{name}.json').read_text())
        w,h = level['width'],level['height']
        rows = [[int(row[i:i+2],16) for i in range(0,len(row),2)] for row in level['rows']]
        assert (w,h)==(48,38) and len(rows)==h and all(len(r)==w for r in rows)
        assert all(rows[0]) and all(rows[-1]) and all(r[0] and r[-1] for r in rows)
        assert len(plan['doors'])<=8 and len(plan['items'])<=16 and len(plan['robots'])<=3
        # Prove progression without treating unavailable locks as passable.
        power=card=False
        reachable=set()
        for _ in range(4):
            open_doors={(d['x'],d['y']) for d in plan['doors'] if not d['secret'] and (d['lock']!=1 or card) and (d['lock']!=2 or power)}
            reachable={(5,8)};todo=[(5,8)]
            while todo:
                x,y=todo.pop()
                for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                    xx,yy=p
                    if 0<=xx<w and 0<=yy<h and (rows[yy][xx]==0 or p in open_doors) and p not in reachable:
                        reachable.add(p);todo.append(p)
            for o in plan['items']:
                if (o['x']//8,o['y']//8) in reachable:
                    if o['kind']==1: power=True
                    if o['kind']==2: card=True
        assert power and card, f'{name}: puzzle deadlock'
        assert all((o['x']//8,o['y']//8) in reachable for o in plan['items'] if o['kind'] in (3,4,5))
        for d in plan['doors']:
            assert rows[d['y']][d['x']] and flags[str(rows[d['y']][d['x']])]&2
        for robot in plan['robots']:
            x0,y0,x1,y1=[robot[k]//8 for k in ('x','y','tx','ty')]
            assert x0==x1 or y0==y1
            for y in range(min(y0,y1),max(y0,y1)+1):
                for x in range(min(x0,x1),max(x0,x1)+1): assert rows[y][x]==0
    print('PASS five sealed maps, lock dependencies, patrol routes and capacity limits')


def instrument(work, pilot=False, fault=None):
    dst=work/('pilot' if pilot else 'checked')
    shutil.copytree(CART,dst)
    if pilot:
        for p in dst.glob('*.js'):
            p.write_text(p.read_text().replace('btn(', 'pilot.button(').replace('wheel()', 'pilot.wheelInput()'))
        shutil.copy(REPO/'tools/outpostecho_pilot.js',dst/'pilot.js')
    shutil.copy(REPO/'tools/outpostecho_probe.js',dst/'probe.js')
    p=dst/'main.js';s=p.read_text().replace('function update() {','function gameUpdate() {')
    s+='\nfunction update(){'+('pilot.before();' if pilot else '')+'gameUpdate();probe.check();}\n'
    p.write_text(s)
    if fault:
        p=dst/fault[0];s=p.read_text();assert s.count(fault[1])==1
        p.write_text(s.replace(fault[1],fault[2]))
    return dst


def summary(units,name):
    u=sorted(units)
    assert u
    print(f'PERF {name}: avg {sum(u)//len(u):,}, p95 {u[int(len(u)*.95)]:,}, max {u[-1]:,}, over 17,500 {sum(x>17500 for x in u)}')
    assert u[-1]<=17500, f'{name} exceeds the 25 Hz FLAC budget: {u[-1]}'


def control_checks(vm,cart,work):
    start='2:16,3:0,5:16,6:0'
    cases=[('idle',start,[],44.0,False),
           ('held toggle',start+',10:16,71:0',[],None,True),
           ('toggle stop',start+',10:16,11:0,40:16,41:0',[],65.0,False),
           ('pause safety',start+',10:16,11:0',['--pause','40'],65.0,False),
           ('classic controls',start+',10:16,40:0',['--opt','1:0:1'],None,False),
           ('suspend after pause',start+',10:16,11:0',['--pause','40','--suspend-at','40'],65.0,False),
           ('20 Hz fallback',start,['--skip','40:5'],44.0,False),
           ('held Play changes once',start+',10:8,60:0',[],44.0,False)]
    for index,(name,buttons,extra,x,walking) in enumerate(cases):
        r,_=run(vm,cart,100,buttons,extra=extra,store=work/f'control-{index}')
        last=[l.split() for l in r.stdout.splitlines() if l.startswith('STATE ')][-1]
        assert bool(int(last[6]))==walking, name+': '+str(last)
        if x is not None: assert abs(float(last[4])-x)<1.5, name+': '+str(last)
        if name=='20 Hz fallback': assert int(last[7])==20
        if name=='held Play changes once': assert int(last[12])==4 and int(last[13])==1 and float(last[14])==0.0
        print('PASS',name)


def fixture_checks(sdk,vm,work):
    # These scratch fixtures test state boundaries without changing shipped files.
    folder=work/'fixtures';shutil.copytree(CART,folder)
    script='''
var once=false;
function update(){
 if(once)return;
 once=true;
 startGame(); scene=EXPLORE;
 // Wrong prerequisites must never activate the relay or clear the level.
 var relayIndex=0, exitIndex=0;
 for(var i=0;i<station.itemN;i++){
   if(station.plan.items[i].kind==4)relayIndex=i;
   if(station.plan.items[i].kind==5)exitIndex=i;
 }
 station.activate(relayIndex,false);
 if(station.relay)printh("BAD relay");
 station.activate(exitIndex,false);
 if(scene!=EXPLORE)printh("BAD exit");
 // An opening door stays solid until its animation is nearly complete.
 doors.want[2]=1;
 doors.update(1.0);
 if((fget(mget(8,18))&FLAG.solid)==0)printh("BAD early door");
 for(var j=0;j<10;j++)doors.update(1.0);
 if((fget(mget(8,18))&FLAG.solid)!=0)printh("BAD open door");
 // Closing cannot put the player in a solid doorway.
 player.body.x[0]=68.0-player.SIZE*0.5;player.body.y[0]=148.0-player.SIZE*0.5;
 doors.want[2]=0;doors.update(1.0);
 if(doors.want[2]==0 || !player.clear())printh("BAD door crush");
 // Pulse is finite, aimed and blocked by walls; it really stuns a patrol.
 player.body.x[0]=robots.body.x[0]-8.0;player.body.y[0]=robots.body.y[0];player.heading=0.0;
 robots.pulse();
 if(robots.stun[0]<=0.0 || player.charge!=3)printh("BAD pulse");
 var charge=player.charge;tools.equipped=1;tools.use();
 if(player.charge!=charge)printh("BAD scanner cost");
 player.charge=0;robots.stun[0]=0.0;robots.pulse();
 if(robots.stun[0]!=0.0 || player.charge!=0)printh("BAD empty pulse");
 // Damage reaches a recoverable failure screen, with no negative energy.
 player.body.x[0]=robots.body.x[0];player.body.y[0]=robots.body.y[0];
 player.energy=1;player.invulnerable=0.0;robots.update(1.0);
 if(scene!=DOWN || player.energy!=0)printh("BAD death");
 restart(); if(player.energy!=100 || scene!=LOG)printh("BAD retry");
 printh("FIXTURES OK");quit();
}
'''
    p=folder/'main.js';s=p.read_text().replace('function update() {','function unusedUpdate() {');p.write_text(s+script)
    cart=work/'fixtures.pbg';build(sdk,folder,cart)
    r,_=run(vm,cart,2,store=work/'fixture-store')
    assert 'BAD ' not in r.stdout and 'FIXTURES OK' in r.stdout,r.stdout
    print('PASS prerequisite locks, door animation, crush safety, pulse, scanner, death and retry')


def security_stress(vm,plain,checked,work,base):
    plans=json.loads((CART/'data/sectors.json').read_text())
    for level in range(5):
        rng=random.Random(level+7);buttons=[(2,16),(3,0)];turns=[]
        for tick in range(12,2960,60):
            buttons += [(tick,rng.choice([16,1,2,8,8,0])),(tick+rng.randrange(1,35),0)]
            turns += [(tick+i,rng.randrange(-14,15),-1) for i in range(0,27,3)]
        button_text=','.join(f'{t}:{v}' for t,v in buttons)
        wheel_text=','.join(f'{t}:{v}:{p}' for t,v,p in turns)
        saved={**base,'sector':level,'x':plans[level]['robots'][0]['x']-12,
               'y':plans[level]['robots'][0]['y'],'heading':0,'energy':100,'charge':4,
               'decoder':int(level>=2),'power':0,'card':0,'relay':0,'elapsed':0,
               'points':0,'before':0,'secrets':0,'collected':0,'damage':0,'disabled':0,
               'disabledMask':0,'hitMask':0,'opened':[0]*6,'revealed':[0]*6,
               'items':[0]*len(plans[level]['items']),'rooms':[0]*6,'cleared':False}
        for name,cart in [('checked',checked),('plain',plain)]:
            store=work/f'security-{level}-{name}';store.mkdir()
            (store/'checkpoint.json').write_text(json.dumps(saved))
            r,u=run(vm,cart,3000,button_text,wheel_text,['--opt','1:2:1','--opt','1:4:2'],store=store)
            if name=='plain':summary(u,f'Alert security stress, sector {level+1}')
    print('PASS seeded input near active robots in all five sectors, Alert and overlay enabled')


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--sdk',type=Path,default=Path(os.environ.get('SDK',REPO.parent/'podbox/arcade/sdk')))
    ap.add_argument('--selftest',action='store_true')
    ap.add_argument('--browser-runtime',type=Path)
    ap.add_argument('--keep',type=Path,help='save replay inputs and the report in this directory')
    args=ap.parse_args();sdk=args.sdk.resolve();vm=[str(sdk/'host/pbgvm')]
    validate_maps()
    with tempfile.TemporaryDirectory(prefix='outpostecho-release-') as temp:
        work=Path(temp)
        if args.selftest:
            faulty=instrument(work,False,('player.js','actors.move(body, FLAG.solid, 0, contacts);','body.x[0]+=body.dx[0];body.y[0]+=body.dy[0];'))
            p=work/'broken.pbg';build(sdk,faulty,p)
            # Fault injection should be reported, so bypass run's normal assertion.
            store=work/'bad-store';store.mkdir()
            r=subprocess.run(vm+[str(p),'--ticks','220','--buttons','2:16,3:0,5:16,6:0,20:16,21:0','--wheel','12:-24:-1,13:-24:-1','--store',str(store)],capture_output=True,text=True,timeout=30)
            assert 'VIOLATION player in wall' in r.stdout,r.stdout[-1000:]
            print('PASS self-test: the harness detects bypassed collision')
            return
        plain=work/'plain.pbg';build(sdk,CART,plain)
        checked=work/'checked.pbg';build(sdk,instrument(work),checked)
        control_checks(vm,checked,work)
        fixture_checks(sdk,vm,work)
        campaign=work/'campaign.pbg';build(sdk,instrument(work,True),campaign)
        report,_=run(vm,campaign,30000,store=work/'pilot-store')
        assert 'PILOT VICTORY' in report.stdout,report.stdout[-2000:]
        tick=int(next(l for l in report.stdout.splitlines() if l.startswith('PILOT VICTORY')).split()[-1])
        events=[l.split() for l in report.stdout.splitlines() if l.startswith('INPUT ')]
        buttons=','.join(f'{p[1]}:{p[2]}' for p in events)
        wheel=','.join(f'{p[1]}:{p[3]}:-1' for p in events if p[3]!='0')
        # Identical input reaches the ending with no test namespaces attached.
        replay,units=run(vm,plain,tick,buttons,wheel,['--saves',str(work/'saves.bin'),'--scores',str(work/'scores.bin')],store=work/'replay-store')
        saved=json.loads((work/'replay-store/checkpoint.json').read_text())
        assert saved['cleared'] and saved['sector']==4 and saved['secrets']==1
        assert saved['decoder'] and saved['relay'] and saved['points']>0
        assert 'achieved Signal Restored' in replay.stdout
        summary(units,'five-sector campaign, plain replay')
        _,overlay_units=run(vm,plain,tick,buttons,wheel,['--opt','1:2:1'],store=work/'overlay-store')
        summary(overlay_units,'campaign with performance overlay')
        music,music_units=run(vm,plain,tick,buttons,wheel,['--playing','--beat','128'],store=work/'music-store')
        assert units==music_units, 'owner music altered game logic or work'
        print('PASS all five sectors, secrets, final scoring and owner music')
        # Persist a partial mission in one VM and Continue it in another.
        store=work/'resume-store'
        run(vm,plain,900,buttons,wheel,store=store)
        partial=json.loads((store/'checkpoint.json').read_text())
        assert partial['power'] and not partial['relay']
        r,resume_units=run(vm,checked,100,'2:16,3:0',store=store)
        resumed=json.loads((store/'checkpoint.json').read_text())
        assert resumed['power']==partial['power'] and resumed['card']==partial['card']
        assert abs(resumed['x']-partial['x'])<.001 and abs(resumed['y']-partial['y'])<.001
        _,restore_units=run(vm,plain,100,'2:16,3:0',store=store)
        summary(restore_units,'Continue checkpoint')
        print('PASS checkpoint across fresh VMs, position, inventory and stopped movement')
        # Completed checkpoints resume the final report without resubmitting scores.
        final_run,_=run(vm,checked,100,'2:16,3:0',extra=['--saves',str(work/'saves.bin'),'--scores',str(work/'scores.bin')],store=work/'replay-store')
        assert f'META 5 {saved["points"]} 1' in final_run.stdout, final_run.stdout[-1000:]
        final=json.loads((work/'replay-store/checkpoint.json').read_text())
        assert final['cleared'] and final['sector']==4 and final['elapsed']==saved['elapsed']
        print('PASS completed checkpoint resume')
        if args.browser_runtime:
            browser=work/'browser';browser.mkdir();(browser/'wasm').mkdir()
            (browser/'package.json').write_text('{"type":"module"}')
            (browser/'src').symlink_to(sdk/'src')
            shutil.copy(sdk/'pbgrun.js',browser/'pbgrun.js')
            shutil.copy(args.browser_runtime,browser/'wasm/arcade.wasm')
            br,bu=run(['node',str(browser/'pbgrun.js')],plain,tick,buttons,wheel,store=work/'browser-store')
            assert bu==units,'browser/native unit mismatch'
            bs=json.loads((work/'browser-store/checkpoint.json').read_text())
            assert bs==saved,'browser/native checkpoint mismatch'
            print('PASS browser WASM/native full-campaign parity')
        security_stress(vm,plain,checked,work,saved)
        if args.keep:
            args.keep.mkdir(parents=True,exist_ok=True)
            (args.keep/'buttons.txt').write_text(buttons)
            (args.keep/'wheel.txt').write_text(wheel)
            (args.keep/'campaign.log').write_text(report.stdout)
            (args.keep/'units.log').write_text(replay.stderr)
        print(f'Outpost Echo: release checks passed, campaign {tick:,} ticks')


if __name__=='__main__':main()
