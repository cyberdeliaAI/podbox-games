"""Build five hand-authored Outpost Echo maps from explicit room plans.

No random geometry is used. Edit the plans below to change routes, props
or puzzles. Only Outpost Echo files are written.
"""
import json
from pathlib import Path

CART = Path(__file__).resolve().parents[1] / 'outpostecho'
NAMES = ['Arrival Bay', 'Research Laboratories', 'Power Reactor', 'Botanical Research', 'Communications Center']
ROOMS = [
    ['Docking Hall','Transit Control','Cargo Hold','Maintenance','Relay Room','Security'],
    ['Sample Intake','Observation','Cold Storage','Workshop','Data Vault','Isolation Lab'],
    ['Reactor Access','Control Deck','Coolant Hall','Turbine Room','Service Deck','Core Relay'],
    ['Seed Bank','Glasshouse','Irrigation','Growth Chamber','Water Control','Bio Relay'],
    ['Antenna Access','Command','Archive','Service Hub','Uplink Room','Signal Control'],
]
INTRO = [
    ['ECHO / 2187','The docking clamps still work.','No one answers your call.','Restore local power and the relay.','Find a pass for Transit Control.'],
    ['RESEARCH / LAST LOG','The crew moved into shelter.','A security update cut their access.','Find the decoder in the workshop.','Use it on the data relay.'],
    ['REACTOR / EMERGENCY','Coolant pumps are running dry.','The crew shut down the main bus.','Restart it before the relay.','The drones still guard the core.'],
    ['BOTANICAL / CREW NOTE','We kept the shelter alive here.','The garden fed us for six weeks.','The uplink has no power.','Route the irrigation bus to it.'],
    ['COMMUNICATIONS / LAST CALL','The crew left in a rescue shuttle.','Their distress call never escaped.','Restore the communications array.','Tell the next ship we made it.'],
]
# Explicit prop positions, in cells. Different assignments create backtracking.
PLANS = [
    {'power':(5,29), 'card':(41,5), 'relay':(41,30), 'exit':(25,5), 'decoder':None},
    {'power':(41,30), 'card':(5,29), 'relay':(41,5), 'exit':(25,5), 'decoder':(21,30)},
    {'power':(21,30), 'card':(41,5), 'relay':(5,29), 'exit':(25,5), 'decoder':None},
    {'power':(41,5), 'card':(21,30), 'relay':(5,29), 'exit':(41,30), 'decoder':None},
    {'power':(5,29), 'card':(41,30), 'relay':(41,5), 'exit':(25,5), 'decoder':None},
]
RECTS = [(2,2,12,12),(18,2,12,12),(34,2,12,12),(2,23,12,12),(18,23,12,12),(34,23,12,12)]


def make(index):
    w,h = 48,38
    cells = [[1+(index%4) for _ in range(w)] for _ in range(h)]
    def carve(x,y,rw,rh):
        for r in range(y,y+rh):
            for c in range(x,x+rw): cells[r][c]=0
    for r,(x,y,rw,rh) in enumerate(RECTS):
        carve(x,y,rw,rh)
        material = 3 if index==3 else 1+(index+r)%4
        for c in range(x-1,x+rw+1):
            cells[y-1][c]=material; cells[y+rh][c]=material
        for row in range(y-1,y+rh+1):
            cells[row][x-1]=material; cells[row][x+rw]=material
    for x,y,rw,rh in [(14,8,4,1),(30,8,4,1),(14,29,4,1),(30,29,4,1),(8,14,1,9),(24,14,1,9),(40,14,1,9)]: carve(x,y,rw,rh)
    # A concealed service room beside the middle corridor.
    carve(19,16,4,4)
    doors = [
        {'x':16,'y':8,'lock':2,'secret':0},
        {'x':32,'y':8,'lock':0,'secret':0},
        {'x':8,'y':18,'lock':0,'secret':0},
        {'x':24,'y':18,'lock':1,'secret':0},
        {'x':40,'y':18,'lock':0,'secret':0},
        {'x':23,'y':18,'lock':0,'secret':1},
    ]
    for d in doors: cells[d['y']][d['x']]=1+(index%4) if d['secret'] else 9
    # Small authored alcoves and pillars give each floor a different silhouette.
    for x,y in [[(11,4),(36,11)],[(20,10),(43,25)],[(10,10),(36,26)],[(11,25),(27,10)],[(35,11),(27,25)]][index]:
        cells[y][x]=1+(index%4)
    plan=PLANS[index]
    items=[]
    def item(kind,pos,label,text=(),need=0):
        items.append({'kind':kind,'x':pos[0]*8+4,'y':pos[1]*8+4,'label':label,'text':list(text),'need':need})
    item(1,plan['power'],'POWER BUS',['POWER BUS RESTORED','Local systems have power.','Access panels are online.'])
    item(2,plan['card'],'ACCESS PASS')
    if plan['decoder']: item(3,plan['decoder'],'ACCESS DECODER')
    item(4,plan['relay'],'SECTOR RELAY',['RELAY ONLINE','Sector signal is stable.','The transit hatch is ready.'],int(index>0))
    item(5,plan['exit'],'TRANSIT HATCH')
    item(6,(21,18),'SERVICE CACHE')
    item(7,(10,26),'ENERGY CELL')
    item(7,(37,10),'ENERGY CELL')
    item(8,(10,5),'CREW LOG',INTRO[index])
    # Scenery is sparse and has no invisible collision.
    item(9,(3,3),'CONSOLE')
    item(9,(29,25),'PLANTS' if index==3 else 'EQUIPMENT')
    robots=[{'x':39*8+4,'y':27*8+4,'tx':43*8+4,'ty':27*8+4},
            {'x':20*8+4,'y':11*8+4,'tx':27*8+4,'ty':11*8+4}]
    objects=[{'kind':'start','x':40,'y':64,'w':8,'h':8}]
    objects += [{'kind':'room','x':x*8,'y':y*8,'w':rw*8,'h':rh*8,'props':{'name':ROOMS[index][r]}} for r,(x,y,rw,rh) in enumerate(RECTS)]
    level={'width':w,'height':h,'rows':[''.join(f'{v:02x}' for v in row) for row in cells],'objects':objects}
    return level,{'name':NAMES[index],'rooms':ROOMS[index],'intro':INTRO[index],'doors':doors,'items':items,'robots':robots}


def main():
    (CART/'maps').mkdir(exist_ok=True); (CART/'data').mkdir(exist_ok=True)
    names=['arrival','research','reactor','botanical','communications']
    sectors=[]
    for i,name in enumerate(names):
        level,sector=make(i);sectors.append(sector)
        (CART/'maps'/f'{name}.json').write_text(json.dumps(level,indent=2)+'\n')
    (CART/'data'/'sectors.json').write_text(json.dumps(sectors,indent=2)+'\n')
    print('Outpost Echo: five authored sectors, six rooms and one secret each')


if __name__=='__main__':main()
