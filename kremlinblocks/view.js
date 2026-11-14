// view: the city round the well, the cached board, the numbers, the start
// screen and the effects.
//
// The pictures (tools/kremlinblocks_assets.py) hold the city, the tower
// gate the well stands in and the stone plaques the numbers go on, so they
// cost a blit. Settled blocks live in a 50x100 image: normal locks paint
// four cells; after a clear, two cached rows rebuild per tick during the
// twelve-tick animation, in update, so skipped draws can't leave stale
// cells. Active pieces and the ghost are drawn over it without touching
// cells.
//
// The effects (snow in winter, fireworks for four rows, a level and a new
// stage) are particle pools moved in update by tick(). Their chance comes
// from a generator of their own, fx, never rnd(), so the bag deals the same
// pieces with or without them.
const X=55,Y=14,PITCH=5;
const INK=16,STONE=21,RED_DARK=34,RED=35,GOLD=23,GOLD_DARK=22,GOLD_LIGHT=24,WELL=41,SNOW=37;
const LEVEL_UP=0;
const HELP_PAGES=3;
const SNOW_MAX=40,SPARKS_MAX=96,SPARKS=18;   // sparks a firework
const BANNER_TICKS=70;
var cache,rebuild=-1;
var snow,sparks,fx=new Int32Array(2);
var snowAt=0,sparkAt=0;
var qx=new Int32Array(4),qy=new Int32Array(4),queued=0;   // fireworks waiting: one goes up a tick
var DIRX=new FixArray(16),DIRY=new FixArray(16);           // sixteen ways round, worked out once
var stageShown=0,stageFor=0,levelFor=0,levelShown=1;
var STAGES=[IMG.stage1,IMG.stage2,IMG.stage3,IMG.stage4,IMG.stage5];
var STAGE_NAMES=["RED SQUARE","WINTER","SUNSET","WHITE NIGHTS","NIGHT SKY"];
var ITEM_NAMES=["MARATHON","SPRINT","BLITZ","HIGH SCORES","HOW TO PLAY"];
var MODE_NAMES=["MARATHON","SPRINT 40","BLITZ 2:00"];
var BURST=[GOLD_LIGHT,RED,SNOW,GOLD,7,35,24,37];
var HELP_TITLES=["CONTROLS","THE WAYS TO PLAY","THE CITY"];
var HELP_LINES=[
    ["WHEEL: MOVE THE BLOCK","PREV, NEXT: ROTATE","SELECT: DROP IT","PLAY, HELD: DROP FASTER","FULL ROWS CLEAR.","MENU: PAUSE, OPTIONS"],
    ["MARATHON: TEN ROWS A","LEVEL, UP TO LEVEL 20.","SPRINT: FORTY ROWS,","AS FAST AS YOU CAN.","BLITZ: THE MOST POINTS","IN TWO MINUTES."],
    ["THE CITY CHANGES AS YOU","GO: RED SQUARE, WINTER,","SUNSET, WHITE NIGHTS","AND THE NIGHT SKY.","FOUR ROWS AT ONCE ARE","WORTH FIREWORKS."],
];

// One small image holds all settled blocks; the effects' pools
function setup(){
    cache=img(50,100);fullReset();
    rng.seed(fx,1917);
    snow=particles.pool(SNOW_MAX);snow.cull=true;
    sparks=particles.pool(SPARKS_MAX);sparks.gravity=0.035;sparks.drag=0.02;sparks.cull=true;
    for(var i=0;i<16;i++){DIRX[i]=cos(i/16.0);DIRY[i]=sin(i/16.0);}
}

// A blank cache costs little and is only made when a round starts.
function fullReset(){target(cache);cls(WELL);target(SCREEN);rebuild=-1;stageFor=0;levelFor=0;}

// Four committed blocks update their cached cells before a possible clear.
function paintPiece(kind,turn,x,y){
    var base=(kind*4+turn)*4;
    target(cache);
    for(var i=0;i<4;i++)spr(kind+1,(x+pieces.xs[base+i])*PITCH,(y+pieces.ys[base+i])*PITCH);
    target(SCREEN);
}

// Rebuild a bounded pair of rows while controls wait for the clear effect.
function rebuildRows(){
    if(rebuild<0)return;
    target(cache);
    for(var j=0;j<2 && rebuild>=0;j++){
        var y=rebuild;rectfill(0,y*PITCH,49,y*PITCH+4,WELL);
        for(var x=0;x<10;x++){
            var cell=board.tiles[y*10+x];
            if(cell!=0)spr(cell,x*PITCH,y*PITCH);
        }
        rebuild--;
    }
    target(SCREEN);
}

// ---- the effects, moved in update -----------------------------------------------

// A tick of the effects: snow drifting down in winter, the sparks flying,
// fireworks now and then over the start screen, the banners' clocks
function tick(){
    particles.step(snow);
    particles.step(sparks);
    if(stageFor>0)stageFor--;
    if(levelFor>0)levelFor--;
    if(!effects){queued=0;return;}
    if(queued>0){
        queued--;
        burst(qx[queued],qy[queued],SPARKS);
    }
    if(scene==TITLE){
        if(frame()%55==0)later(30+rng.rnd(fx,100),18+rng.rnd(fx,30));
        return;
    }
    if(stage==1 && frame()%3==0 && (scene==PLAY || scene==CLEAR)){
        // a flake over one side of the city or the other, never over the well
        var side=rng.rnd(fx,2)<1;
        var i=snowAt;snowAt=(snowAt+1)%SNOW_MAX;
        snow.life[i]=260;snow.x[i]=side?rng.rnd(fx,50):110+rng.rnd(fx,50);snow.y[i]=0;
        snow.dx[i]=rng.rnd(fx,0.3)-0.15;snow.dy[i]=0.3+rng.rnd(fx,0.25);snow.c[i]=SNOW;snow.sp[i]=0;
    }
}

// A firework waiting its turn: at most one goes up a tick, so a show
// never lands on one tick
function later(x,y){
    if(queued>=4)return;
    qx[queued]=x;qy[queued]=y;queued++;
}

// A firework: n sparks from x, y, flying out round in two colours, each
// one of sixteen ways at its own speed
function burst(x,y,n){
    var c1=BURST[rng.rnd(fx,8)],c2=BURST[rng.rnd(fx,8)];
    var turn0=rng.rnd(fx,16);
    for(var k=0;k<n;k++){
        var i=sparkAt;sparkAt=(sparkAt+1)%SPARKS_MAX;
        var d=(turn0+k)%16,v=0.5+(k%4)*0.25;
        sparks.life[i]=22+(k%5)*3;sparks.x[i]=x;sparks.y[i]=y;
        sparks.dx[i]=DIRX[d]*v;sparks.dy[i]=DIRY[d]*v-0.25;sparks.c[i]=k%2==0?c1:c2;sparks.sp[i]=0;
    }
}

// Rows cleared: two or three, a firework over the city; four, a show
function cleared(n){
    if(!effects || n<2)return;
    if(n<4){later(rng.rnd(fx,2)<1?24:140,24+rng.rnd(fx,20));return;}
    later(24,26);later(140,30);later(80,12);
}

// A new stage: its name in a banner, and fireworks
function newStage(st){
    stageShown=st;stageFor=BANNER_TICKS;
    if(effects){later(30,20);later(130,22);}
}

// A word over the well for a moment: the new level
function say(what,n){levelShown=n;levelFor=BANNER_TICKS-20;}

// ---- drawing ------------------------------------------------------------------------

// Draw a piece or an outlined landing guide within the well's clip.
function piece(kind,turn,x,y,outline){
    var base=(kind*4+turn)*4;
    for(var i=0;i<4;i++){
        var xx=X+(x+pieces.xs[base+i])*PITCH,yy=Y+(y+pieces.ys[base+i])*PITCH;
        if(outline)rect(xx,yy,xx+3,yy+3,GOLD_DARK);else spr(kind+1,xx,yy);
    }
}

// Next pieces use the exact generated geometry, at the game's cell size.
function preview(kind,x,y){
    var base=kind*16;
    for(var i=0;i<4;i++)spr(kind+1,x+pieces.xs[base+i]*5,y+pieces.ys[base+i]*5);
}

// A time in ms as minutes and seconds, with hundredths when asked
function clockText(ms,fine){
    var s=flr(ms/1000),t=flr(ms/1000)%60;
    var out=flr(s/60)+(t<10?":0":":")+t;
    if(fine){var c=flr((ms%1000)/10);out=out+(c<10?".0":".")+c;}
    return out;
}

// The numbers on their plaques: the score; lines and the level or the
// clock; the next three pieces; the best for this way to play
function hud(){
    print("SCORE",6,5,RED);print(points,6,12,INK);
    var v=mode==SPRINT?lines+"/40":""+lines;
    print("ROWS",6,93,RED);print(v,43-textw(v),93,INK);
    if(mode==MARATHON){v=""+level;print("LEVEL",6,102,RED);}
    else{v=clockText(mode==BLITZ?BLITZ_MS-clock:clock,false);print("TIME",6,102,RED);}
    print(v,43-textw(v),102,INK);
    print("NEXT",117,5,RED);
    for(var i=0;i<3;i++)preview(queue[i],121,13+i*11);
    print("BEST",117,95,RED);
    var best=bestNow();
    if(mode==SPRINT)print(best>0?clockText(best,true):"-",117,104,INK);else print(best,117,104,INK);
    if(stats)print(spent+" U",59,2,11);
}

// The round's end, over the well
function panel(){
    rectfill(53,34,106,92,STONE);rect(53,34,106,92,RED_DARK);rect(55,36,104,90,RED);
    var head=!finished?"STACK FULL":mode==SPRINT?"40 ROWS!":"TIME UP";
    print(head,80-textw(head)/2,42,RED_DARK);
    var v=mode==SPRINT && finished?clockText(clock,true):""+points;
    font(FONT.CAPS,2);print(v,80-textw(v)/2,53,INK);font(FONT.CAPS);
    if(newBest)print("NEW BEST",80-textw("NEW BEST")/2,68,(frame()>>3)%2==0?GOLD:RED);
    print("SELECT",80-textw("SELECT")/2,80,INK);
}

// A banner over the top of the well: the new stage's name, or the level
function banners(){
    if(stageFor>0){
        var name=STAGE_NAMES[stageShown];
        rectfill(53,24,106,36,STONE);rect(53,24,106,36,RED);
        print(name,80-textw(name)/2,28,RED_DARK);
    }else if(levelFor>0){
        var s="LEVEL "+levelShown;
        rectfill(61,24,98,36,STONE);rect(61,24,98,36,GOLD_DARK);
        print(s,80-textw(s)/2,28,RED_DARK);
    }
}

// The start screen: the city of domes, its name on the banner, and the
// menu, the high scores or how to play
function drawTitle(){
    palt(0,false);blit(IMG.title,0,0);palt(0,true);
    particles.draw(sparks);
    font(FONT.CAPS,2);
    var t="KREMLIN BLOCKS";
    print(t,81-textw(t)/2,8,RED_DARK);print(t,80-textw(t)/2,7,GOLD_LIGHT);
    font(FONT.CAPS);
    if(page==SCORES){scores();return;}
    if(page==HELP){help();return;}
    for(var i=0;i<ITEMS;i++){
        var y=78+i*6;
        if(i==sel){rectfill(55,y-1,104,y+4,RED);print(ITEM_NAMES[i],80-textw(ITEM_NAMES[i])/2,y,GOLD_LIGHT);}
        else print(ITEM_NAMES[i],80-textw(ITEM_NAMES[i])/2,y,INK);
    }
}

// A big stone plaque over the city, for the high scores and how to play
function plaque(title,foot){
    rectfill(10,26,149,111,STONE);rect(10,26,149,111,RED_DARK);rect(12,28,147,109,RED);
    print(title,80-textw(title)/2,32,RED_DARK);
    print(foot,80-textw(foot)/2,101,GOLD_DARK);
}

// The best five of a way to play, from its board
function scores(){
    var m=scorePage;
    plaque("< "+MODE_NAMES[m]+" >","SELECT: BACK");
    var b=BOARDS[m],n=min(5,score.count(b));
    if(n==0)print("NO SCORES YET",80-textw("NO SCORES YET")/2,60,INK);
    for(var r=0;r<n;r++){
        var v=score.get(b,r+1);
        var s=m==SPRINT?clockText(v,true):""+v;
        print((r+1)+".",34,44+r*10,RED);
        var nm=score.name(b,r+1);
        if(nm!=null)print(nm,46,44+r*10,INK);
        print(s,125-textw(s),44+r*10,INK);
    }
}

// How to play, a page at a time
function help(){
    plaque(HELP_TITLES[helpPage],(helpPage+1)+"/"+HELP_PAGES+"  WHEEL: PAGE  SELECT: BACK");
    var lines=HELP_LINES[helpPage];
    for(var i=0;i<lines.length;i++)print(lines[i],80-textw(lines[i])/2,44+i*9,INK);
}

// Clear rows flash briefly before the cached stack compacts from below.
function draw(){
    if(scene==TITLE){drawTitle();spent=unitsnow();return;}
    palt(0,false);blit(STAGES[stage],0,0);palt(0,true);
    if(stage==1)particles.draw(snow);
    palt(0,false);blit(cache,X,Y);palt(0,true);
    clip(X,Y,X+49,Y+99);
    if(scene==PLAY){if(ghost && ghostValid && ghostY>py)piece(kind,turn,px,ghostY,true);piece(kind,turn,px,py,false);}
    if(scene==CLEAR && clearTicks<2)for(var y=0;y<20;y++)if(board.rows[y]!=0)rectfill(X,Y+y*PITCH,X+49,Y+y*PITCH+3,GOLD_LIGHT);
    clip();hud();
    particles.draw(sparks);
    if(scene==OVER)panel();else banners();
    spent=unitsnow();
}
