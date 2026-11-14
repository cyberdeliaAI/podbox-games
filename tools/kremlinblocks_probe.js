// Scratch-only board and piece invariants, with enough state for replay.
var checked=0;

// Runtime failures include the exact frame for reproducible input traces.
function fail(text){printh("VIOLATION "+text+" FRAME "+frame());quit();}

// Keep row counts, board contents, collision and ghost in agreement.
function check(){
    prof("probe");checked++;
    for(var y=0;y<20;y++){
        var n=0;
        for(var x=0;x<10;x++){
            var v=board.tiles[y*10+x];
            if(v<0 || v>7)fail("cell kind");
            if(v!=0)n++;
        }
        if(n!=board.counts[y])fail("row count");
    }
    if(scene==PLAY){
        if(!board.fits(kind,turn,px,py))fail("active collision");
        if(ghostValid && ghostRev==board.revision && ghostX==px && ghostTurn==turn && ghostKind==kind){
            if(ghostY<py || !board.fits(kind,turn,px,ghostY) || board.fits(kind,turn,px,ghostY+1))fail("ghost");
        }
    }
    if(scene==CLEAR && (lastClear<1 || lastClear>4))fail("clear size");
    if(points<0 || lines<0 || level<1 || level>20 || resets>8)fail("score or lock state");
    if(bagAt<0 || bagAt>7 || turn<0 || turn>3 || kind<0 || kind>6)fail("bag or active kind");
    if(frame()%100==0)printh("STATE "+frame()+" "+scene+" "+points+" "+lines+" "+level+" "+totalLocks+" "+kind+" "+turn+" "+px+" "+py);
    prof();
}
