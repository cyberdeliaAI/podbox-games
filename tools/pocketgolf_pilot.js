// Scratch-only trajectory search. Every candidate uses the production
// physics, restores all state, then drives real aim/hold/release handlers.
// Its emitted inputs replay against the uninstrumented cartridge.
var mask=0, clicks=0, previous=0, prior=0;
var state=new FixArray(18);
var phase=0, candidate=0, bestScore=30000.0, bestAim=0.0, bestHold=1;
var desired=0.0, chosenHold=1, held=0, shotHole=-1;
var angleCount=43, powerCount=15;
var aims=new FixArray(48);
var bad=0, searchOrigin=0.0, searchY=0.0;
var shots=0, completed=0, tickCount=0;

// Input shims only exist in the test build.
function button(i){return (mask&(1<<i))!=0;}
function pressed(i){return (mask&(1<<i))!=0 && (prior&(1<<i))==0;}
function wheelInput(){return clicks;}

// Snapshot integer and fixed-point fields explicitly.
function save(){
    state[0]=ball.x;state[1]=ball.y;state[2]=ball.vx;state[3]=ball.vy;
    state[4]=ball.z;state[5]=ball.vz;state[6]=ball.safeX;state[7]=ball.safeY;
    state[8]=ball.cup;state[9]=ball.moving;state[10]=ball.event;state[11]=ball.cooldown;
    state[12]=ball.delay;state[13]=ball.ticks;state[14]=geometry.clock;state[15]=geometry.gateOpen;
    state[16]=ball.bump;
}
function restore(){
    ball.x=state[0];ball.y=state[1];ball.vx=state[2];ball.vy=state[3];
    ball.z=state[4];ball.vz=state[5];ball.safeX=state[6];ball.safeY=state[7];
    ball.cup=state[8]!=0.0;ball.moving=state[9]!=0.0;ball.event=flr(state[10]);ball.cooldown=flr(state[11]);
    ball.delay=flr(state[12]);ball.ticks=flr(state[13]);geometry.clock=flr(state[14]);geometry.gateOpen=state[15]!=0.0;
    ball.bump=flr(state[16]);geometry.update();
}

// Quantize candidate aims to the physical precision-wheel resolution.
function quantize(a){return flr(a*768.0+0.5)/768.0;}

// Read the generated navigation potential, with a small cup-distance tie.
function cost(){
    if(ball.cup)return -10000.0;
    if(ball.event==1)return 10000.0;
    var field=course.plan.field;
    var switching=false;
    if(course.plan.switchField.length>0 && !state[15]){field=course.plan.switchField;switching=true;}
    if(switching && geometry.gateOpen){field=course.plan.field;}
    var ix=flr(ball.x/4.0),iy=flr(ball.y/4.0);
    if(ix<0 || ix>=course.plan.gw || iy<0 || iy>=course.plan.h/4)return 12000.0;
    var d=field[iy*course.plan.gw+ix];
    if(d<0)return 8000.0;
    var result=d*4.0+(abs(ball.x-course.plan.cup[0])+abs(ball.y-course.plan.cup[1]))*0.025;
    if(switching && geometry.gateOpen)result-=1000.0;
    if(ball.moving)result+=sqrt(ball.vx*ball.vx+ball.vy*ball.vy)*6.0;
    return result;
}

// Include full-circle banks plus precise direct and navigation aims.
function beginSearch(){
    var targetX=course.plan.cup[0],targetY=course.plan.cup[1];
    var field=course.plan.field;
    if(course.plan.switchField.length>0 && !geometry.gateOpen)field=course.plan.switchField;
    var gx=flr(ball.x/4.0),gy=flr(ball.y/4.0);
    for(var i=0;i<10;i++){
        var index=gy*course.plan.gw+gx;
        var best=field[index],nx=gx,ny=gy;
        if(gx>0 && field[index-1]>=0 && field[index-1]<best){best=field[index-1];nx=gx-1;ny=gy;}
        if(gx+1<course.plan.gw && field[index+1]>=0 && field[index+1]<best){best=field[index+1];nx=gx+1;ny=gy;}
        if(gy>0 && field[index-course.plan.gw]>=0 && field[index-course.plan.gw]<best){best=field[index-course.plan.gw];nx=gx;ny=gy-1;}
        if(gy+1<course.plan.h/4 && field[index+course.plan.gw]>=0 && field[index+course.plan.gw]<best){nx=gx;ny=gy+1;}
        if(nx==gx && ny==gy)break;
        gx=nx;gy=ny;
    }
    var route=atan2(gx*4+2-ball.x,gy*4+2-ball.y);
    var direct=atan2(targetX-ball.x,targetY-ball.y);
    for(var i=0;i<32;i++)aims[i]=quantize(i/32.0);
    for(var i=0;i<7;i++)aims[32+i]=quantize(direct+(i-3)/768.0);
    for(var i=0;i<4;i++)aims[39+i]=quantize(route+(i-1)*0.008);
    candidate=0;bestScore=30000.0;
    searchOrigin=ball.x;searchY=ball.y;
    phase=1;
}

// One rollout stays below the VM's runaway-call ceiling.
function evaluate(){
    save();
    var angle=aims[candidate/powerCount];
    var powerTicks=2+(candidate%powerCount)*3;
    // The scene advances while thinking. Predict the release frame for
    // each hold duration, including one aim frame and the release edge.
    geometry.clock+=angleCount*powerCount-1-candidate+powerTicks+2;
    geometry.update();
    ball.fire(angle,powerTicks/45.0);
    for(var i=0;i<240 && !ball.cup && ball.event!=1;i++){
        geometry.clock++;geometry.update();ball.step();
        if(!ball.moving && ball.delay==0)break;
    }
    var score=cost();
    if(score<bestScore){bestScore=score;bestAim=angle;bestHold=powerTicks;}
    restore();
    candidate++;
    if(candidate>=angleCount*powerCount){phase=2;desired=bestAim;chosenHold=bestHold;}
}

// Main entry: make one plan, then physically charge and release the putt.
function before(){
    prof("pilot");
    prior=previous;mask=0;clicks=0;tickCount++;
    if(scene==TITLE){
        if(selection<3){if((previous&2)==0)mask=2;}
        else if((previous&16)==0)mask=16;
    }else if(scene==HOLED){
        if(shotHole!=hole){
            completed++;shotHole=hole;
            printh("HOLE "+hole+" STROKES "+strokes+" PICKED "+picked);
        }
        phase=0;
        if(endWait>22 && (previous&16)==0)mask=16;
    }else if(scene==CARD){
        if(endWait>14 && (previous&16)==0)mask=16;
    }else if(scene==RESULTS){
        printh("TOUR DONE "+total+" HOLES "+completed+" TICKS "+tickCount);quit();
    }else if(scene==PLAY){
        if(strokes>=28){printh("PILOT STUCK "+hole+" "+ball.x+" "+ball.y+" best "+bestScore);quit();}
        if(ball.moving || ball.delay>0){phase=0;}
        else if(!putter.precision){if((previous&1)==0)mask=1;}
        else if(phase==0){beginSearch();}
        else if(phase==1){evaluate();}
        else if(phase==2){
            var d=desired-putter.aim;d-=flr(d+0.5);
            clicks=flr(0.5-d*768.0);phase=3;held=0;
        }else if(phase==3){
            if(held<chosenHold){mask=16;held++;}
            else{phase=4;shots++;}
        }else if(phase==4){phase=0;}
    }
    if(mask!=previous || clicks!=0)printh("INPUT "+(frame()-1)+" "+mask+" "+clicks);
    if(tickCount%10000==0)printh("PILOT AT "+hole+" "+strokes+" "+ball.x+" "+ball.y+" phase "+phase);
    previous=mask;
    prof();
}
