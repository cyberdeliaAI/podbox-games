// stage: perspective disco tiles, two coloured spotlights and beat dots.
// Light comes from the same phase as the pose, never an unrelated timer.
var viewIndex=0;
var cornerX=new Int32Array(4),cornerY=new Int32Array(4);

// The floor is baked from the same camera at 32 angles. Only the dancer
// needs live geometry. Palette remaps make the nine tiles follow the beat.
function draw() {
    // Moving beams are patterned light over the dark backdrop, not flashes.
    var sweep=-sin(((music.count%16)+music.phase)/16.0);
    var reach=flr(sweep*27.0);
    if(music.listening){
        line(9,17,73+reach,99,12);line(9,17,91+reach,99,32);
        line(150,17,64-reach,99,14);line(150,17,82-reach,99,33);
    }else{
    fillp(0x5a5a);
    trifill(9,17,73+reach,99,91+reach,99,music.pulse>0.5?12:32);
    trifill(150,17,64-reach,99,82-reach,99,music.pulse>0.5?14:33);
    fillp();
    }
    if(music.listening){
        for(var i=0;i<4;i++){
            mesh.project((i==0 || i==3)?-1.8:1.8,0.0,i<2?-1.8:1.8);
            cornerX[i]=mesh.outX;cornerY[i]=mesh.outY;
        }
        for(var i=0;i<4;i++){
            var next=(i+1)%4;
            line(cornerX[i],cornerY[i],cornerX[next],cornerY[next],13);
            circfill(cornerX[i],cornerY[i],2,music.pulse>0.5?14:12);
        }
        line(cornerX[0],cornerY[0],cornerX[2],cornerY[2],5);
        line(cornerX[1],cornerY[1],cornerX[3],cornerY[3],5);
    }else{
        for(var i=0;i<3;i++){
            var base=34+i*2;
            pal(base,base+((i+music.count)%3==0 && music.phase<0.55?1:0));
        }
        palt(0,false);
        blitpart(IMG.floor,(viewIndex%4)*160,(viewIndex/4)*40,160,40,0,64);
        palt(0,true);pal();
    }
    mesh.project(dancer.rootX,0.0,0.0);
    ovalfill(mesh.outX-12,mesh.outY-3,mesh.outX+12,mesh.outY+3,1);
    // Compact fixtures and speakers keep the dance floor readable.
    rectfill(3,16,14,22,5);circfill(9,20,3,music.pulse>0.5?12:13);
    rectfill(145,16,156,22,5);circfill(150,20,3,music.pulse>0.5?14:2);
    rectfill(3,60,19,92,0);rect(3,60,19,92,5);
    circfill(11,80,5,5);circ(11,80,3,music.pulse>0.5?12:13);circ(11,67,2,6);
    rectfill(140,60,156,92,0);rect(140,60,156,92,5);
    circfill(148,80,5,5);circ(148,80,3,music.pulse>0.5?14:2);circ(148,67,2,6);
}
