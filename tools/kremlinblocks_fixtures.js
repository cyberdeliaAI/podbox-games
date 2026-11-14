// Scratch-only rule fixtures. Each group exercises production functions.
var group=0,failures=0,seen=new Int32Array(7);

// Name failures so fault injection proves the checks can detect regressions.
function expect(ok,label){if(!ok){failures++;printh("FAIL "+label);}}

// Prepare a legal sparse row-clear fixture with a marker above the stack.
function rowsWithGap(n){
    board.reset();
    for(var y=20-n;y<20;y++)for(var x=0;x<10;x++)if(x!=4)board.tiles[y*10+x]=2;
    board.tiles[0]=7;board.recount();
}

// One independent behaviour group per native tick.
function step(){
    group++;
    if(group==1){
        bagAt=7;
        for(var g=0;g<10;g++){
            fill(seen,0);
            for(var i=0;i<7;i++)seen[nextPiece()]++;
            for(var i=0;i<7;i++)expect(seen[i]==1,"seven-bag fairness");
        }
    }else if(group==2){
        board.reset();
        for(var k=0;k<7;k++)for(var r=0;r<4;r++){
            expect(board.fits(k,r,3,-4),"hidden spawn");
            expect(!board.fits(k,r,-4,5) && !board.fits(k,r,10,5),"side boundaries");
            expect(!board.fits(k,r,3,20),"floor boundary");
        }
    }else if(group==3){
        for(var n=1;n<=4;n++){
            rowsWithGap(n);expect(board.place(0,1,2,16),"place vertical line");
            expect(board.clear()==n,"simultaneous row clear");
            expect(board.tiles[n*10]==7 && board.tiles[0]==0,"row compaction");
            expect(board.counts[n]>=1,"compacted row count");
            for(var y=0;y<20;y++)expect(board.counts[y]<10,"no full row left");
        }
    }else if(group==4){
        board.reset();expect(!board.place(1,0,3,-1),"hidden lock-out");
        var count=0;for(var i=0;i<200;i++)count+=board.tiles[i];
        expect(count==0,"failed lock is atomic");
    }else if(group==5){
        start();kind=0;turn=1;px=-2;py=5;
        expect(rotate(1) && turn==2 && px==0,"left wall kick");
        kind=0;turn=0;px=3;py=18;
        expect(rotate(1) && turn==1 && py==16,"long-piece floor kick");
        fill(board.tiles,1);kind=0;turn=0;px=3;py=8;
        for(var x=3;x<7;x++)board.tiles[9*10+x]=0;board.recount();
        expect(!rotate(1) && px==3 && py==8 && turn==0,"blocked rotation stays put");
    }else if(group==6){
        start();kind=1;turn=0;px=3;py=0;ghostValid=false;
        hardDrop();expect(totalLocks==1 && points==36,"hard drop distance and single lock");
    }else if(group==7){
        start();rowsWithGap(4);board.tiles[0]=0;board.recount();
        kind=0;turn=1;px=2;py=16;lock();
        expect(scene==CLEAR && lastClear==4 && lines==4 && points==800,"four-row score");
        for(var i=0;i<12;i++)gameUpdate();
        expect(scene==PLAY && view.rebuild==-1,"clear completes without any screen draw");
        for(var i=0;i<200;i++)expect(board.tiles[i]==0,"four-row empty board");
    }else if(group==8){
        start();kind=1;turn=0;px=3;py=18;muteInput=false;
        for(var i=0;i<8;i++)rotate(1);
        expect(resets==8,"bounded reset count");
        for(var i=0;i<20 && totalLocks==0;i++){move(i%2==0?-1:1);gameUpdate();}
        expect(totalLocks==1,"movement can't stall a grounded block forever");
    }else if(group==9){
        start();fill(board.tiles,1);board.recount();spawn();
        expect(scene==OVER,"blocked spawn ends round");
    }else{printh("FIXTURES "+failures);quit();}
}
