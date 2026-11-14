// view: a cached fixed board with at most two rebuilt rows per frame.
// Active pieces and the ghost are drawn over it without touching cells.
const X=55,Y=14,PITCH=5;
var cache,rebuild=-1;

// One small image holds all settled blocks and grid points.
function setup(){cache=img(50,100);fullReset();}

// A blank cache costs little and is only made when a round starts.
function fullReset(){target(cache);cls(16);target(SCREEN);rebuild=-1;}

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
        var y=rebuild;rectfill(0,y*PITCH,49,y*PITCH+4,16);
        for(var x=0;x<10;x++){
            var cell=board.tiles[y*10+x];
            if(cell!=0)spr(cell,x*PITCH,y*PITCH);
        }
        rebuild--;
    }
    target(SCREEN);
}

// Draw a piece or an outlined landing guide within the well's clip.
function piece(kind,turn,x,y,outline){
    var base=(kind*4+turn)*4;
    for(var i=0;i<4;i++){
        var xx=X+(x+pieces.xs[base+i])*PITCH,yy=Y+(y+pieces.ys[base+i])*PITCH;
        if(outline)rect(xx,yy,xx+3,yy+3,13);else spr(kind+1,xx,yy);
    }
}

// Next pieces use the exact generated geometry, at the game's cell size.
function preview(kind,x,y){
    var base=kind*16;
    for(var i=0;i<4;i++)spr(kind+1,x+pieces.xs[base+i]*5,y+pieces.ys[base+i]*5);
}

// Keep the score readable without obscuring the narrow playfield.
function hud(){
    rectfill(0,0,159,10,16);print("KREMLIN BLOCKS",4,3,22);
    for(var i=0;i<4;i++)rectfill(1,16+i*26,44,34+i*26,16);
    for(var i=0;i<3;i++)rectfill(113,26+i*24,139,45+i*24,16);
    print("SCORE",3,19,21);print(points,3,28,7);
    print("BEST",3,44,13);print(flr(dget(0)),3,53,10);
    print("LINES",3,70,13);print(lines,3,79,7);
    print("LEVEL",3,96,13);print(level,3,105,11);
    print("NEXT",116,18,13);
    for(var i=0;i<3;i++)preview(queue[i],116,28+i*24);
    print("PLAY",113,104,6);print("SOFT",113,112,6);
    if(stats)print(spent+" U",110,3,11);
}

// Static cards share the same playfield frame.
function panel(label,subtitle){
    rectfill(12,35,147,91,16);rect(12,35,147,91,13);
    print(label,80-textw(label)/2,44,10);
    print(subtitle,80-textw(subtitle)/2,60,7);
    print("SELECT: PLAY",56,79,11);
}

// Clear rows flash briefly before the cached stack compacts from below.
function draw(){
    palt(0,false);blit(IMG.back,0,0);palt(0,true);
    if(scene==TITLE){
        rectfill(12,12,147,37,16);rect(12,12,147,37,21);
        print("KREMLIN BLOCKS",80-textw("KREMLIN BLOCKS")/2,18,22);
        print("FALLING BLOCKS",80-textw("FALLING BLOCKS")/2,29,6);
        rectfill(43,105,116,114,16);print("SELECT: PLAY",56,108,22);return;
    }
    rect(52,11,107,116,19);rect(53,12,106,115,21);
    palt(0,false);blit(cache,X,Y);palt(0,true);
    clip(X,Y,X+49,Y+99);
    if(scene==PLAY){if(ghost && ghostValid && ghostY>py)piece(kind,turn,px,ghostY,true);piece(kind,turn,px,py,false);}
    if(scene==CLEAR && clearTicks<2)for(var y=0;y<20;y++)if(board.rows[y]!=0)rectfill(X,Y+y*PITCH,X+49,Y+y*PITCH+3,7);
    clip();hud();
    if(scene==OVER)panel("STACK FULL","SCORE "+points);
    spent=unitsnow();
}
