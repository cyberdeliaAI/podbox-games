"""Pocket Golf release checks with the production fixed-point VM.

The scratch pilot searches trajectories, then drives wheel/hold/release.
Its exact inputs replay in the plain cart. Only the plain cart is timed.
Run with --browser-runtime dist/pocketgolf-runtime.wasm for WASM parity.
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
CART = REPO/'pocketgolf'


def build(sdk, folder, output):
    r = subprocess.run(['node', str(sdk/'pbgc.js'), 'build', str(folder), '-o', str(output)], capture_output=True, text=True, timeout=30)
    assert r.returncode == 0, r.stdout+r.stderr


def run(vm, cart, ticks, buttons='', wheel='', extra=(), store=None, allow_violation=False):
    args = [str(cart), '--ticks', str(ticks), '--seed', '1', '--units']
    if buttons: args += ['--buttons', buttons]
    if wheel: args += ['--wheel', wheel]
    if store:
        Path(store).mkdir(exist_ok=True)
        args += ['--store', str(store)]
    r = subprocess.run(list(vm)+args+list(extra), capture_output=True, text=True, timeout=180)
    assert r.returncode == 0, r.stdout[-2000:]+r.stderr[-2000:]
    assert allow_violation or 'VIOLATION' not in r.stdout, r.stdout[-2000:]
    units = [int(p[2]) for line in r.stderr.splitlines() if len(p:=line.split())==3 and p[0]=='tick']
    return r, units


def instrument(work, name='checked', pilot=False):
    dst=work/name
    shutil.copytree(CART, dst)
    if pilot:
        routes=json.loads((REPO/'tools/pocketgolf_routes.json').read_text())
        for i, nav in enumerate(routes):
            p=dst/'data'/f'h{i+1:02}.json'
            plan=json.loads(p.read_text());plan.update(nav)
            p.write_text(json.dumps(plan,separators=(',',':')))
        for p in dst.glob('*.js'):
            p.write_text(p.read_text().replace('btn(', 'pilot.button(').replace('btnp(', 'pilot.pressed(').replace('wheel()', 'pilot.wheelInput()'))
        shutil.copy(REPO/'tools/pocketgolf_pilot.js', dst/'pilot.js')
    shutil.copy(REPO/'tools/pocketgolf_probe.js', dst/'probe.js')
    p=dst/'main.js'
    p.write_text(p.read_text().replace('function update() {','function gameUpdate() {')+
                 '\nfunction update(){'+('pilot.before();' if pilot else '')+'gameUpdate();probe.check();}\n')
    return dst


def summary(units, checked_output, label):
    # PACE is emitted after update, so its frame number matches --units.
    changes={int(p[1]):int(p[2]) for line in checked_output.splitlines() if len(p:=line.split())==3 and p[0]=='PACE'}
    buckets={33:[],25:[]};pace=33
    for tick, value in enumerate(units,1):
        pace=changes.get(tick,pace);buckets[pace].append(value)
        assert value <= (12500 if pace==33 else 17500), f'{label}: tick {tick}, {value} units at {pace} Hz'
    report={}
    for pace,values in buckets.items():
        if not values:continue
        values.sort();report[str(pace)]={'ticks':len(values),'mean':sum(values)//len(values), 'p99':values[int(len(values)*.99)],'max':max(values)}
        print(f'PERF {label}, {pace} Hz: mean {report[str(pace)]["mean"]:,}, p99 {report[str(pace)]["p99"]:,}, max {max(values):,}')
    return report


def validate_plans():
    catalog=json.loads((CART/'data/catalog.json').read_text());assert len(catalog)==36
    routes=json.loads((REPO/'tools/pocketgolf_routes.json').read_text());assert len(routes)==36
    surfaces=set();specials=set();movers=set()
    for i in range(36):
        p=json.loads((CART/'data'/f'h{i+1:02}.json').read_text())
        assert 2<=p['par']<=5 and len(p['lines'])+sum(2 if o['kind']==1 else 1 for o in p['movers'])<=40
        assert len(p['circles'])<=8 and p['name']==catalog[i]['name']
        assert 'field' not in p, 'test hints leaked into the production cart'
        for line in p['lines']:
            assert abs(line[4]**2+line[5]**2-1)<.001 and line[6]>0
        nav=routes[i];assert nav['field'][(p['tee'][1]//4)*nav['gw']+p['tee'][0]//4]>=0
        level=json.loads((CART/'maps'/f'h{i+1:02}.json').read_text())
        assert len(level['rows'])==level['height'] and all(len(row)==level['width']*2 for row in level['rows'])
        surfaces.update(r[4] for r in p['regions']);specials.update(o['kind'] for o in p['specials']);movers.update(o['kind'] for o in p['movers'])
    assert set(range(1,12))-{6,7,9}<=surfaces and {1,2,3,4,5,6}<=specials and {1,2,3,4}<=movers
    print('PASS 36 authored maps, navigation reachability, normalized geometry and mechanic coverage')


def fixtures(sdk, vm, work, selftest=False):
    dst=work/'physics';shutil.copytree(CART,dst)
    for name in ('hud','putter','records','view'):(dst/f'{name}.js').unlink()
    shutil.copy(REPO/'tools/pocketgolf_physics.js',dst/'checks.js')
    (dst/'main.js').write_text('function init(){}\nfunction update(){checks.step();}\n')
    if selftest:
        p=dst/'ball.js';s=p.read_text();assert 'geometry.collide();' in s
        p.write_text(s.replace('geometry.collide();',''))
    p=work/'physics.pbg';build(sdk,dst,p)
    r,_=run(vm,p,15)
    if selftest:
        assert 'FAIL high-speed wall tunnelling' in r.stdout and 'PHYSICS 0' not in r.stdout,r.stdout
        print('PASS fault injection: the harness catches bypassed collisions')
    else:
        assert 'FAIL ' not in r.stdout and 'PHYSICS 0' in r.stdout,r.stdout
        print('PASS power, walls, angles, corners, friction, slopes, water, cups, portals, boosts, switches and ramps')


def state(log):
    return next(line.split() for line in reversed(log.splitlines()) if line.startswith('STATE '))


def controls(vm, checked, plain, work):
    start='2:16,3:0'  # Continue on an empty store starts the first hole.
    cases=[('idle',start,(),0),
           ('one-frame tap',start+',15:16,16:0',(),1),
           ('maximum hold is capped',start+',15:16,170:0',(),1),
           ('pause cancels a charged putt',start+',15:16,70:0',('--pause','50'),0),
           ('pause then suspend cancels a charged putt',start+',15:16,70:0',('--pause','50','--suspend-at','50'),0),
           ('held precision toggles once',start+',15:1,170:0',(),0),
           ('held guide toggles once',start+',15:2,170:0',(),0),
           ('held overview toggles once',start+',15:8,170:0',(),0),
           ('moving Select cannot create a second shot',start+',15:16,55:0,56:16,190:0',(),1)]
    for index,(label,buttons,extra,strokes) in enumerate(cases):
        r,_=run(vm,checked,200,buttons,extra=extra,store=work/f'control-{index}')
        s=state(r.stdout);assert int(s[4])==strokes,(label,s)
        if index==5:assert s[13]=='1',s
        if index==6:assert s[14]=='0',s
        if index==7:assert s[15]=='1',s
        print('PASS',label)
    r,_=run(vm,checked,100,start+',15:16,170:0',store=work/'power-cap')
    assert float(state(r.stdout)[12])==45.0 and int(state(r.stdout)[4])==0
    r,_=run(vm,checked,100,start+',15:16,70:0',extra=['--opt','50:1:0'],store=work/'option-charge')
    assert int(state(r.stdout)[4])==0
    for label,b,answers,expected in [
        ('Quick Play','0:2,1:0,2:16,3:0','0,0',0),
        ('Championship','0:2,1:0,2:2,3:0,4:16,5:0','0',1),
        ('Practice','0:2,1:0,2:2,3:0,4:2,5:0,6:2,7:0,8:16,9:0','0,0',3)]:
        store=work/('menu-'+str(expected))
        run(vm,plain,100,b,extra=['--ui',answers],store=store)
        saved=json.loads((store/'round.json').read_text())
        assert saved['mode']==expected and saved['scene']==1,(label,saved)
    print('PASS capped power, option-change safety and Quick Play/Championship/Practice menus')
    for index,broken in enumerate([{'version':1}, {'version':1,'hole':'invalid'}, [], 7]):
        store=work/f'incomplete-{index}';store.mkdir();(store/'round.json').write_text(json.dumps(broken))
        run(vm,checked,100,start,store=store)
        saved=json.loads((store/'round.json').read_text())
        assert saved['scene']==1 and saved['hole']==0
    print('PASS structurally incomplete saves start a fresh hole safely')
    # Aim resolution is four times finer, with no ball motion.
    aims=[]
    for fine in (False,True):
        r,_=run(vm,checked,100,start, '30:-12:-1', ['--opt','1:2:'+str(int(fine))],store=work/f'aim-{fine}')
        aims.append(float(state(r.stdout)[11]))
    assert abs(aims[0]-4*aims[1])<.001,aims
    print('PASS click-wheel precision is four times finer')
    # Camera, guide and sound affect neither the trajectory nor score.
    button=start+',15:16,50:0'
    base=None
    for i,extra in enumerate([(),('--opt','1:0:0','--opt','1:1:0'),('--pause','60'),('--suspend-at','60')]):
        r,_=run(vm,checked,100,button,extra=extra,store=work/f'inflight-{i}')
        s=state(r.stdout);physical=s[2:11]
        if base is None:base=physical
        else:assert physical==base,(i,physical,base)
    print('PASS sound/guide settings, pause and VM suspension preserve in-flight physics')
    _,u=run(vm,plain,100,button,store=work/'control-perf')
    assert max(u)<=12500


def fixed_rate(sdk,vm,work):
    dst=work/'rates';shutil.copytree(CART,dst)
    p=dst/'main.js';s=p.read_text().replace('function update() {','function unusedUpdate() {')
    s+='''
var comparison=0;
function update(){
 if(comparison==0){course.load(7);ball.fire(0.06,0.8);debt=0;setrate(33);comparison=1;}
 else{
  debt+=33;
  while(debt>=rate()){
   debt-=rate();geometry.clock++;geometry.update();ball.step();
   printh("STEP "+comparison+" "+geometry.clock+" "+ball.x+" "+ball.y+" "+ball.vx+" "+ball.vy+" "+ball.z);
  }
  if(geometry.clock>=132){
   if(comparison==2){quit();return;}
   course.load(7);ball.fire(0.06,0.8);debt=0;setrate(25);comparison=2;
  }
 }
}
'''
    p.write_text(s);cart=work/'rates.pbg';build(sdk,dst,cart)
    r,_=run(vm,cart,250)
    rows=[[p[2:] for line in r.stdout.splitlines() if len(p:=line.split())==8 and p[:2]==['STEP',str(n)]] for n in (1,2)]
    assert len(rows[0])==132 and rows[0]==rows[1][:132], [len(x) for x in rows]
    print('PASS identical 33/25 Hz physics steps against a moving windmill')


def browser_vm(sdk,runtime,work):
    dst=work/'browser';dst.mkdir();(dst/'wasm').mkdir()
    (dst/'package.json').write_text('{"type":"module"}')
    (dst/'src').symlink_to(sdk/'src');shutil.copy(sdk/'pbgrun.js',dst/'pbgrun.js')
    shutil.copy(runtime,dst/'wasm/arcade.wasm')
    return ['node',str(dst/'pbgrun.js')]


def repeated_loads(sdk,vm,work):
    dst=work/'loads';shutil.copytree(CART,dst)
    p=dst/'main.js';s=p.read_text().replace('function update() {','function gameUpdate() {')
    s+='''
var loadedRounds=0;
function update(){
 if(scene==TITLE)start(PRACTICE,0);
 gameUpdate();
 if(scene==PLAY){
  loadedRounds++;
  if(loadedRounds==360){printh("LOADS 360");quit();}
  else loadHole((hole+1)%36);
 }
}
'''
    p.write_text(s);cart=work/'loads.pbg';build(sdk,dst,cart)
    r,_=run(vm,cart,2000,extra=['--memory'],store=work/'loads-store')
    assert 'LOADS 360' in r.stdout,r.stdout[-1500:]
    print('PASS ten complete passes of lazy image/map loading in one 512 KB VM')


def checkpoint_checks(vm,plain,checked,work,buttons,wheel,final):
    # The first shot is charged for several frames. Save just after release.
    events=[tuple(map(int,p.split(':'))) for p in buttons.split(',')]
    release=next(t for (t,m),(pt,pm) in zip(events[1:],events) if m==0 and pm==16 and t>50)
    cut=release+8;store=work/'partial-store'
    run(vm,plain,cut,buttons,wheel,store=store)
    partial=json.loads((store/'round.json').read_text());assert partial['moving'] and not partial['cup']
    direct=work/'direct-store'
    run(vm,plain,cut+45,buttons,wheel,store=direct)
    r,_=run(vm,checked,52,'2:16,3:0',store=store)
    resumed=json.loads((store/'round.json').read_text());expected=json.loads((direct/'round.json').read_text())
    # Three title frames, four loading frames and 45 game updates.
    assert resumed['strokes']==partial['strokes']
    for key in ('x','y','vx','vy','z','clock','total','scores'):
        assert resumed[key]==expected[key],(key,resumed[key],expected[key])
    # Completed rounds resume the result without submitting or scoring again.
    r,_=run(vm,checked,100,'2:16,3:0',extra=['--saves',str(work/'saves.bin'),'--scores',str(work/'scores.bin')],store=work/'replay-store')
    s=state(r.stdout);assert int(s[2])==4 and int(s[17])==36,s
    assert 'achieved' not in r.stdout
    assert json.loads((work/'replay-store/round.json').read_text())['total']==final['total']
    # Practice can replay a ranked hole without changing persistent counters.
    practice={**final,'scene':1,'mode':3,'hole':0,'strokes':0,'total':0,'x':24.0,'y':44.0,'vx':0.0,'vy':0.0,'z':0.0,'vz':0.0,'safeX':24.0,'safeY':44.0,'cup':False,'moving':False,'cooldown':0,'delay':0,'clock':0,'debt':0,'aim':0.0,'scores':[0]*36}
    ps=work/'practice-store';ps.mkdir();(ps/'round.json').write_text(json.dumps(practice))
    practice_buttons='2:16,3:0,'+','.join(f'{t}:{m}' for t,m in events if 50<t<=release)
    r,_=run(vm,checked,release+180,practice_buttons,extra=['--saves',str(work/'saves.bin')],store=ps)
    assert json.loads((ps/'round.json').read_text())['scene']==2,r.stdout[-1200:]
    r,_=run(vm,checked,100,'2:16,3:0',extra=['--saves',str(work/'saves.bin')],store=ps)
    assert int(state(r.stdout)[17])==36,r.stdout
    print('PASS fresh-VM in-flight restore, completed round resume and practice record isolation')


def stress(vm,plain,checked,work,base):
    worst=[]
    for hole in range(36):
        p=json.loads((CART/'data'/f'h{hole+1:02}.json').read_text())
        saved={**base,'hole':hole,'scene':1,'mode':3,'strokes':0,'total':0,'x':p['tee'][0], 'y':p['tee'][1], 'safeX':p['tee'][0],'safeY':p['tee'][1], 'vx':0.0,'vy':0.0,'z':0.0,'vz':0.0,'cup':False,'moving':False,'cooldown':0,'delay':0,'clock':0,'debt':0,'aim':0.0,'gate':False,'scores':[0]*36}
        rng=random.Random(900+hole);buttons=[(2,16),(3,0)];turns=[]
        for t in range(20,1950,100):
            buttons += [(t,16),(t+rng.randint(1,55),0),(t+70,8),(t+71,0)]
            turns += [(t-2,rng.randint(-120,120),-1)]
        b=','.join(f'{t}:{v}' for t,v in sorted(buttons));wheel=','.join(f'{t}:{v}:{pos}' for t,v,pos in turns)
        stores=[]
        for name,cart in [('checked',checked),('plain',plain)]:
            store=work/f'stress-{hole}-{name}';store.mkdir();(store/'round.json').write_text(json.dumps(saved))
            r,u=run(vm,cart,2000,b,wheel,['--opt','1:3:1','--memory'],store=store)
            if name=='checked':log=r.stdout
            else:
                perf=summary(u,log,f'hole {hole+1:02} stress');worst.append(max(u))
            stores.append(json.loads((store/'round.json').read_text()))
        assert stores[0]==stores[1],f'hole {hole+1}: probe changed play'
    print(f'PASS seeded maximum-power/overview stress on all 36 holes, worst {max(worst):,} units')


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--sdk',type=Path,default=Path(os.environ.get('SDK',REPO.parent/'podbox/arcade/sdk')))
    ap.add_argument('--selftest',action='store_true');ap.add_argument('--browser-runtime',type=Path)
    ap.add_argument('--keep',type=Path)
    args=ap.parse_args();sdk=args.sdk.resolve();vm=[str(sdk/'host/pbgvm')]
    validate_plans()
    with tempfile.TemporaryDirectory(prefix='pocketgolf-check-') as temp:
        work=Path(temp);fixtures(sdk,vm,work,args.selftest)
        if args.selftest:return
        plain=work/'plain.pbg';build(sdk,CART,plain)
        checked=work/'checked.pbg';build(sdk,instrument(work),checked)
        controls(vm,checked,plain,work);fixed_rate(sdk,vm,work)
        pilot=work/'pilot.pbg';build(sdk,instrument(work,'pilot',True),pilot)
        result,_=run(vm,pilot,150000,extra=['--ceiling','8000000'],store=work/'pilot-store')
        holes=[line.split() for line in result.stdout.splitlines() if line.startswith('HOLE ')]
        assert len(holes)==36 and [int(p[1]) for p in holes]==list(range(36)) and all(p[-1]=='0' for p in holes),result.stdout[-2000:]
        end=next(line.split() for line in result.stdout.splitlines() if line.startswith('TOUR DONE'))
        ticks=int(end[-1]);total=int(end[2])
        events=[line.split() for line in result.stdout.splitlines() if line.startswith('INPUT ')]
        buttons=','.join(f'{p[1]}:{p[2]}' for p in events);wheel=','.join(f'{p[1]}:{p[3]}:-1' for p in events if p[3]!='0')
        cr,_=run(vm,checked,ticks,buttons,wheel,store=work/'checked-store')
        replay,units=run(vm,plain,ticks,buttons,wheel,['--saves',str(work/'saves.bin'),'--scores',str(work/'scores.bin')],store=work/'replay-store')
        final=json.loads((work/'replay-store/round.json').read_text())
        assert final['scene']==4 and final['hole']==35 and final['total']==total and all(n>0 for n in final['scores'])
        assert final==json.loads((work/'checked-store/round.json').read_text())
        assert 'achieved Deluxe Golfer' in replay.stdout
        s=state(cr.stdout);assert int(s[17])==36,s
        perf=summary(units,cr.stdout,'full tour, plain replay')
        overlay,ou=run(vm,plain,ticks,buttons,wheel,['--opt','1:3:1'],store=work/'overlay-store');summary(ou,cr.stdout,'full tour, performance overlay')
        _,mu=run(vm,plain,ticks,buttons,wheel,['--playing','--beat','128'],store=work/'music-store')
        assert mu==units,'owner music changed the simulation or units'
        print(f'PASS all 36 holes, {total} strokes, no pickups, native records, achievements and owner music')
        checkpoint_checks(vm,plain,checked,work,buttons,wheel,final)
        if args.browser_runtime:
            br,bu=run(browser_vm(sdk,args.browser_runtime.resolve(),work),plain,ticks,buttons,wheel,store=work/'browser-store')
            assert bu==units,'browser/native units differ'
            assert json.loads((work/'browser-store/round.json').read_text())==final,'browser/native result differs'
            print('PASS full-tour browser WASM/native parity')
        stress(vm,plain,checked,work,final);repeated_loads(sdk,vm,work)
        if args.keep:
            args.keep.mkdir(parents=True,exist_ok=True)
            for name,text in [('buttons.txt',buttons),('wheel.txt',wheel),('pilot.log',result.stdout),('units.log',replay.stderr),('report.json',json.dumps({'holes':36,'strokes':total,'ticks':ticks,'performance':perf},indent=2))]:
                (args.keep/name).write_text(text)
        print(f'Pocket Golf: release checks passed, {ticks:,} replay ticks')


if __name__=='__main__':main()
