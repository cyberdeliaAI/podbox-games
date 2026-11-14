// Kremlin Blocks: an original falling-block game for the click wheel.
// The board is authoritative. Drawing and the ghost never change it.
const TITLE=0,PLAY=1,CLEAR=2,OVER=3;
var scene=TITLE,points=0,lines=0,level=1,startLevel=1,combo=-1;
var kind=0,turn=0,px=3,py=-1,ghostY=0;
var fallMs=0.0,lockMs=0.0,resets=0,clearTicks=0;
var queue=new Int32Array(3),bag=new Int32Array(7),bagAt=7;
var sounds=true,ghost=true,stats=false;
var wasPrev=false,wasNext=false,wasSelect=false;
var muteInput=true,spent=0,wheelCarry=0;
var kicks=[0,-1,1,-2,2];
var awards=[0,100,300,500,800];
var totalLocks=0,lastClear=0;
var ghostValid=false,ghostKind=-1,ghostTurn=-1,ghostX=-99,ghostRev=-1;

// Native pause keeps the VM, including the bag, options and board image.
function init(){view.setup();menuitem(1,"New game",start);menuitem(2,"Main menu",toTitle);}

// Options don't move a piece or reseed its bag.
function options(){sounds=opt.get(OPT.sounds)==1;ghost=opt.get(OPT.ghost)==1;stats=opt.get(OPT.stats)==1;}

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
    startLevel=opt.get(OPT.level);
    points=0;lines=0;level=startLevel;combo=-1;totalLocks=0;lastClear=0;
    bagAt=7;for(var i=0;i<3;i++)queue[i]=nextPiece();
    scene=PLAY;muteInput=true;wheelCarry=0;
    spawn();
}

// Returning to the title is an explicit abandoned round.
function toTitle(){scene=TITLE;muteInput=true;}

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
        combo++;points+=(awards[n]+max(0,combo)*50)*level;
        lines+=n;level=min(20,startLevel+lines/10);
        dset(1,flr(dget(1))+n);
        if(n==4)ach.earn(ACH.four);
        if(lines>=40)ach.earn(ACH.forty);
        if(combo>=4)ach.earn(ACH.combo);
        if(level>=10)ach.earn(ACH.ten);
        scene=CLEAR;clearTicks=0;view.rebuild=19;
        effect(n==4?1100:800,4);
    }else{combo=-1;effect(260,1);spawn();}
    if(points>flr(dget(0)))dset(0,points);
}

// A hard drop awards distance once and can't repeat while Select is held.
function hardDrop(){
    locateGhost();points+=max(0,ghostY-py)*2;py=ghostY;lock();
}

// Native records are submitted once per finished round.
function lose(){
    if(scene==OVER)return;
    scene=OVER;score.submit(BOARD.points,points);
    if(points>flr(dget(0)))dset(0,points);
    effect(120,8);muteInput=true;
}

// Gravity is in milliseconds, so the simulation doesn't depend on drawing.
function update(){
    if(opt.changed())options();
    if(resumed()){muteInput=true;fallMs=0.0;lockMs=0.0;wheelCarry=0;}
    var select=btn(4)&&!wasSelect,prev=btn(0)&&!wasPrev,next=btn(1)&&!wasNext;
    wasSelect=btn(4);wasPrev=btn(0);wasNext=btn(1);
    if(!btn(4)&&!btn(0)&&!btn(1)&&!btn(3))muteInput=false;
    if(scene==TITLE || scene==OVER){if(select && !muteInput)start();return;}
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

// The scene renderer has no access to the bag or falling timers.
function draw(){view.draw();}
