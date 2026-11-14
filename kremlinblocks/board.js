// board: bounded 10x20 cells, pure placement queries and bottom-up clears.
const W=10,H=20,SIZE=200;
var tiles=new Uint8Array(SIZE);
var rows=new Int32Array(H),counts=new Int32Array(H);
var revision=0;

// Empty a round without allocating another board.
function reset(){fill(tiles,0);fill(rows,0);fill(counts,0);revision++;}

// Hidden spawn cells are allowed above the well, never beside or below it.
function fits(kind,turn,x,y){
    var base=(kind*4+turn)*4;
    for(var i=0;i<4;i++){
        var xx=x+pieces.xs[base+i],yy=y+pieces.ys[base+i];
        if(xx<0 || xx>=W || yy>=H)return false;
        if(yy>=0 && tiles[yy*W+xx]!=0)return false;
    }
    return true;
}

// Detect lock-out before writing any cell. A failed lock leaves no debris.
function place(kind,turn,x,y){
    if(!fits(kind,turn,x,y))return false;
    var base=(kind*4+turn)*4;
    for(var i=0;i<4;i++)if(y+pieces.ys[base+i]<0)return false;
    for(var i=0;i<4;i++){
        var xx=x+pieces.xs[base+i],yy=y+pieces.ys[base+i];
        tiles[yy*W+xx]=kind+1;counts[yy]++;
    }
    revision++;return true;
}

// Mark full rows, then move every surviving row exactly once.
function clear(){
    var n=0;
    for(var y=0;y<H;y++){
        var full=counts[y]==W;
        rows[y]=full?1:0;if(full)n++;
    }
    if(n==0)return 0;
    // whole rows move with copy() and the rows left at the top empty with
    // fill(): engine work, not a loop of script per cell
    var dest=H-1;
    for(var y=H-1;y>=0;y--){
        if(rows[y]!=0)continue;
        if(dest!=y)copy(tiles,dest*W,tiles,y*W,W);
        counts[dest]=counts[y];dest--;
    }
    if(dest>=0){fill(tiles,0,0,(dest+1)*W);fill(counts,0,0,dest+1);}
    revision++;
    return n;
}

// Recount after an authored fixture. Normal play maintains counts on placement.
function recount(){fill(counts,0);for(var y=0;y<H;y++)for(var x=0;x<W;x++)if(tiles[y*W+x]!=0)counts[y]++;revision++;}
