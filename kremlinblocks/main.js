// Kremlin Blocks: an original falling-block game for the click wheel, in a
// city of onion domes and red brick.
//
// Three ways to play: Marathon (endless, faster every ten rows, to level
// 20), Sprint (forty rows as fast as you can) and Blitz (the most points in
// two minutes). The city round the well changes as you go, through five
// stages: day on the square, winter, sunset, white nights and night.
//
// The board is authoritative. Drawing, the effects and the tunes never
// change it, and the effects draw their chance from a generator of their
// own (view.js), so the pieces come in the same order with or without them.
const TITLE=0,PLAY=1,CLEAR=2,OVER=3;
const MARATHON=0,SPRINT=1,BLITZ=2;
const SPRINT_ROWS=40;              // rows a Sprint is run to
const BLITZ_MS=120000;             // a Blitz's length
const MENU=0,SCORES=1,HELP=2;      // the start screen's pages
const ITEMS=5;                     // Marathon, Sprint, Blitz, high scores, how to play
const STAGE_LEVELS=4;              // Marathon levels a stage
const SPRINT_STAGE=8;              // Sprint rows a stage
const BLITZ_STAGE=24000;           // Blitz ms a stage
var scene=TITLE,points=0,lines=0,level=1,startLevel=1,combo=-1;
var kind=0,turn=0,px=3,py=-1,ghostY=0;
var fallMs=0.0,lockMs=0.0,resets=0,clearTicks=0;
var queue=new Int32Array(3),bag=new Int32Array(7),bagAt=7;
var sounds=true,ghost=true,stats=false,effects=true;
var wasPrev=false,wasNext=false,wasSelect=false;
var muteInput=true,spent=0,wheelCarry=0;
var kicks=[0,-1,1,-2,2];
var awards=[0,100,300,500,800];
var totalLocks=0,lastClear=0;
var ghostValid=false,ghostKind=-1,ghostTurn=-1,ghostX=-99,ghostRev=-1;
var mode=MARATHON;
var page=MENU,sel=0,scorePage=0,helpPage=0;
var clock=0,clockCarry=0;          // ms played this round, counted exactly from the rate
var stage=0;                       // the city round the well, 0 to 4
var finished=false;                // the round ended by its rule (Sprint done, Blitz time), not a full stack
var newBest=false,bestBefore=0;   // the best when the round started, to tell a new one
var BOARDS=[BOARD.points,BOARD.sprint,BOARD.blitz];

// Native pause keeps the VM, including the bag, options and board image.
function init(){
    view.setup();
    options();
    menuitem(1,"New game",start);
    menuitem(2,"Main menu",toTitle);
}

// Options don't move a piece or reseed its bag.
function options(){
    sounds=opt.get(OPT.sounds)==1;ghost=opt.get(OPT.ghost)==1;stats=opt.get(OPT.stats)==1;
    effects=opt.get(OPT.effects)==1;
}

// A shuffled bag supplies each piece once before the next seven begin.
function nextPiece(){
    if(bagAt>=7){
        for(var i=0;i<7;i++)bag[i]=i;
        for(var i=6;i>0;i--){var j=rnd(i+1),k=bag[i];bag[i]=bag[j];bag[j]=k;}
        bagAt=0;
    }
    var result=bag[bagAt];bagAt++;return result;
}

// Short original tones leave the owner's music playing.
function effect(hz,ticks){if(sounds)tone(0,hz,ticks,30,WAVE.TRIANGLE);}

// Start consumes Select until release, so the title can't hard-drop a piece.
function start(){
    board.reset();view.fullReset();
    startLevel=mode==SPRINT?1:opt.get(OPT.level);
    points=0;lines=0;level=startLevel;combo=-1;totalLocks=0;lastClear=0;
    clock=0;clockCarry=0;finished=false;newBest=false;bestBefore=bestNow();
    stage=stageNow();view.stageShown=stage;
    bagAt=7;for(var i=0;i<3;i++)queue[i]=nextPiece();
    scene=PLAY;muteInput=true;wheelCarry=0;
    spawn();
}

// Returning to the title is an explicit abandoned round.
function toTitle(){scene=TITLE;page=MENU;muteInput=true;}

// Consume exactly one preview and check the spawn before any movement.
function spawn(){
    kind=queue[0];queue[0]=queue[1];queue[1]=queue[2];queue[2]=nextPiece();
    turn=0;px=3;py=-1;fallMs=0.0;lockMs=0.0;resets=0;
    if(!board.fits(kind,turn,px,py)){lose();return;}
    ghostValid=false;
}

// Compute the landing position with bounded pure collision queries.
function locateGhost(){
    if(ghostValid && ghostKind==kind && ghostTurn==turn && ghostX==px && ghostRev==board.revision && py<=ghostY)return;
    ghostY=py;while(board.fits(kind,turn,px,ghostY+1))ghostY++;
    ghostValid=true;ghostKind=kind;ghostTurn=turn;ghostX=px;ghostRev=board.revision;
}

// Ground contact has a short delay, with at most eight movement resets.
function touch(){if(!board.fits(kind,turn,px,py+1) && resets<8){lockMs=0.0;resets++;}}

// Horizontal movement stops at the first obstruction.
function move(dx){
    if(board.fits(kind,turn,px+dx,py)){px+=dx;touch();return true;}
    return false;
}

// Small horizontal wall kicks plus a one-row floor kick keep rotation fair.
// This is the game's own rotation rule, not a claim of guideline SRS.
function rotate(direction){
    var next=(turn+direction+4)%4;
    for(var up=0;up<=(kind==0?2:1);up++)for(var i=0;i<5;i++){
        if(board.fits(kind,next,px+kicks[i],py-up)){
            px+=kicks[i];py-=up;turn=next;touch();effect(440,1);return true;
        }
    }
    return false;
}

// Lock once, score complete rows and freeze controls during their animation.
function lock(){
    if(scene!=PLAY)return;
    if(!board.place(kind,turn,px,py)){lose();return;}
    totalLocks++;
    view.paintPiece(kind,turn,px,py);
    var n=board.clear();lastClear=n;
    if(n>0){
        var was=level;
        combo++;points+=(awards[n]+max(0,combo)*50)*level;
        lines+=n;
        if(mode!=SPRINT)level=min(20,startLevel+lines/10);
        dset(1,flr(dget(1))+n);
        if(n==4)ach.earn(ACH.four);
        if(lines>=40)ach.earn(ACH.forty);
        if(combo>=4)ach.earn(ACH.combo);
        if(level>=10)ach.earn(ACH.ten);
        scene=CLEAR;clearTicks=0;view.rebuild=19;
        effect(n==4?1100:800,4);
        view.cleared(n);
        if(level>was){view.say(view.LEVEL_UP,level);tune.play(tune.LEVEL);}
        if(mode==SPRINT && lines>=SPRINT_ROWS){finish();return;}
    }else{combo=-1;effect(260,1);spawn();}
    if(mode==MARATHON && points>flr(dget(0)))dset(0,points);
}

// A hard drop awards distance once and can't repeat while Select is held.
function hardDrop(){
    locateGhost();points+=max(0,ghostY-py)*2;py=ghostY;lock();
}

// The stack is full: the round is over. Marathon and Blitz keep their points
function lose(){
    if(scene==OVER)return;
    scene=OVER;finished=false;
    if(mode!=SPRINT)record();
    effect(120,8);tune.play(tune.OVER);muteInput=true;
}

// The round ended by its own rule: forty rows run, or the Blitz's time up
function finish(){
    if(scene==OVER)return;
    scene=OVER;finished=true;
    record();
    if(mode==SPRINT)ach.earn(ACH.sprint);
    if(mode==BLITZ && points>=10000)ach.earn(ACH.blitz);
    view.cleared(4);tune.play(tune.WIN);muteInput=true;
}

// A finished round on its board and, if it's the best, in the saved numbers
function record(){
    var value=mode==SPRINT?clock:points;
    var slot=mode==MARATHON?0:mode==SPRINT?2:3;
    newBest=value>0 && (bestBefore==0 || (mode==SPRINT?value<bestBefore:value>bestBefore));
    if(newBest || (mode==MARATHON && value>flr(dget(slot))))dset(slot,value);
    score.submit(BOARDS[mode],value);
}

// The best for the mode being played: points, or a Sprint's time in ms (0: none yet)
function bestNow(){return flr(dget(mode==MARATHON?0:mode==SPRINT?2:3));}

// The stage for how far the round has got
function stageNow(){
    if(mode==SPRINT)return min(4,flr(lines/SPRINT_STAGE));
    if(mode==BLITZ)return min(4,flr(clock/BLITZ_STAGE));
    return min(4,flr((level-1)/STAGE_LEVELS));
}

// Gravity is in milliseconds, so the simulation doesn't depend on drawing.
function update(){
    if(opt.changed())options();
    if(resumed()){muteInput=true;fallMs=0.0;lockMs=0.0;wheelCarry=0;}
    var select=btn(4)&&!wasSelect,prev=btn(0)&&!wasPrev,next=btn(1)&&!wasNext;
    wasSelect=btn(4);wasPrev=btn(0);wasNext=btn(1);
    if(!btn(4)&&!btn(0)&&!btn(1)&&!btn(3))muteInput=false;
    view.tick();tune.tick();
    if(scene==TITLE){menu(select,prev,next);return;}
    if(scene==OVER){if(select && !muteInput)start();return;}
    // the round's clock: Sprint counts up, Blitz down
    clockCarry+=1000;clock+=flr(clockCarry/rate());clockCarry=clockCarry%rate();
    if(mode==BLITZ && clock>=BLITZ_MS){clock=BLITZ_MS;finish();return;}
    var st=stageNow();
    if(st!=stage){
        stage=st;view.newStage(st);tune.play(tune.STAGE);
        if(st==4 && mode==MARATHON)ach.earn(ACH.night);
    }
    if(scene==CLEAR){
        clearTicks++;if(clearTicks>=2)view.rebuildRows();if(clearTicks>=12){scene=PLAY;muteInput=true;wheelCarry=0;spawn();}return;
    }
    if(!muteInput){
        wheelCarry+=wheel();
        var steps=mid(-5,wheelCarry/4,5);wheelCarry%=4;
        for(var i=0;i<abs(steps);i++)if(!move(steps>0?1:-1))break;
        if(prev)rotate(-1);if(next)rotate(1);
        if(select){hardDrop();return;}
    }
    var dt=1000.0/rate(),fast=btn(3)&&!muteInput;
    fallMs+=dt;
    var interval=fast?40:max(70,850-(level-1)*40);
    if(fallMs>=interval){
        fallMs-=interval;
        if(board.fits(kind,turn,px,py+1)){py++;lockMs=0.0;if(fast)points++;}
    }
    if(!board.fits(kind,turn,px,py+1)){lockMs+=dt;if(lockMs>=350.0)lock();}
    else if(resets<8)lockMs=0.0;
    if(scene==PLAY)locateGhost();
}

// The start screen: the menu, the high scores and how to play. The wheel,
// Prev and Next move; Select chooses. Select on Marathon, the first, starts
function menu(select,prev,next){
    wheelCarry+=wheel();
    var steps=wheelCarry/3;wheelCarry%=3;
    if(prev)steps--;
    if(next)steps++;
    if(muteInput){steps=0;select=false;}
    if(page==SCORES){
        if(steps!=0){scorePage=(scorePage+steps+30)%3;click();}
        if(select){page=MENU;effect(520,2);}
        return;
    }
    if(page==HELP){
        if(steps!=0){helpPage=mid(0,helpPage+steps,view.HELP_PAGES-1);click();}
        if(select){page=MENU;effect(520,2);}
        return;
    }
    if(steps!=0){sel=(sel+steps+ITEMS*10)%ITEMS;click();}
    if(select){
        if(sel<=BLITZ){mode=sel;effect(660,3);start();}
        else if(sel==3){page=SCORES;scorePage=0;effect(520,2);}
        else{page=HELP;helpPage=0;effect(520,2);}
    }
}

// The scene renderer has no access to the bag or falling timers.
function draw(){view.draw();}
