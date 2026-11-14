// Scratch-only placement search. It drives buttons and raw wheel clicks.
var mask=0,clicks=0,previous=0;
var planned=-1,bestTurn=0,bestX=3,lastScene=-1;
var trial=new Uint8Array(200),height=new Int32Array(10);
var allLines=0,games=0,lastLines=0,peak=0;

// These shims only exist in the instrumented cart.
function button(i){return (mask&(1<<i))!=0;}
function wheelInput(){return clicks;}

// Prefer line clears, low stacks and few enclosed holes.
function cost(k,r,x,y){
    copy(trial,0,board.tiles,0,200);
    var base=(k*4+r)*4;
    for(var i=0;i<4;i++){
        var yy=y+pieces.ys[base+i];if(yy<0)return 999999;
        trial[yy*10+x+pieces.xs[base+i]]=k+1;
    }
    var full=0,holes=0,sum=0,rough=0,top=0;
    for(var y=0;y<20;y++){
        var filled=0;for(var x=0;x<10;x++)if(trial[y*10+x]!=0)filled++;
        if(filled==10)full++;
    }
    for(var x=0;x<10;x++){
        var started=false;var h=0;
        for(var y=0;y<20;y++){
            if(trial[y*10+x]!=0){if(!started){h=20-y;started=true;}}
            else if(started)holes++;
        }
        height[x]=h;sum+=h;top=max(top,h);
        if(x>0)rough+=abs(h-height[x-1]);
    }
    return sum*5+holes*45+rough*3+top*4-full*150;
}

// Candidate searches don't touch the live board or random generator.
function plan(){
    var best=999999;
    for(var r=0;r<4;r++)for(var x=-2;x<10;x++){
        if(!board.fits(kind,r,x,py))continue;
        var y=py;while(board.fits(kind,r,x,y+1))y++;
        var score=cost(kind,r,x,y);
        if(score<best){best=score;bestTurn=r;bestX=x;}
    }
    planned=totalLocks;
}

// Complete real rounds. Select is always released between separate drops.
function before(){
    prof("pilot");mask=0;clicks=0;
    if(lines<lastLines){allLines+=lastLines;games++;}
    lastLines=lines;peak=max(peak,points);
    if(scene==TITLE || scene==OVER){if(previous==0)mask=16;planned=-1;}
    else if(scene==PLAY && !muteInput){
        if(planned!=totalLocks)plan();
        if(turn!=bestTurn){if(previous==0)mask=2;}
        else if(px!=bestX)clicks=px<bestX?4:-4;
        else if(previous==0)mask=16;
    }
    if(mask!=previous || clicks!=0)printh("INPUT "+(frame()-1)+" "+mask+" "+clicks);
    if(frame()%1000==0)printh("SUMMARY "+(allLines+lines)+" "+games+" "+peak);
    previous=mask;prof();
}
