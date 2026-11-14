// Scratch-only invariants, checked after every update including the last.
var failures=0, lastRate=0;
function fail(label){failures++;printh("VIOLATION "+label+" frame "+frame()+" hole "+hole);quit();}
function check(){
    prof("probe");
    if(course.current>=0 && scene!=TITLE && scene!=HELP && scene!=LOADING){
        if(course.current!=hole || imgw(course.picture)!=course.plan.w || imgh(course.picture)!=course.plan.h)fail("loaded hole or picture mismatch");
        if(ball.x<0.0 || ball.y<0.0 || ball.x>=course.plan.w || ball.y>=course.plan.h)fail("bounds");
        if(abs(ball.vx)>3.21 || abs(ball.vy)>3.21 || ball.z<0.0)fail("speed or height");
        if(strokes<0 || total<0 || hole<0 || hole>=36)fail("score");
        if(geometry.n>40 || geometry.circles>8)fail("capacity");
        if(putter.charge<0.0 || putter.charge>45.0)fail("power");
        if(ball.cup && ball.moving)fail("captured moving ball");
        if(rate()!=33 && rate()!=25)fail("rate");
        for(var i=0;i<geometry.staticN;i++){
            if(ball.z>geometry.height[i] || ball.x<geometry.loX[i] || ball.x>geometry.hiX[i] || ball.y<geometry.loY[i] || ball.y>geometry.hiY[i])continue;
            var along=mid(0.0,(ball.x-geometry.ax[i])*geometry.tx[i]+(ball.y-geometry.ay[i])*geometry.ty[i],geometry.length[i]);
            var dx=ball.x-geometry.ax[i]-geometry.tx[i]*along,dy=ball.y-geometry.ay[i]-geometry.ty[i]*along;
            if(dx*dx+dy*dy<3.05)fail("solid wall penetration");
        }
    }
    if(rate()!=lastRate){printh("PACE "+frame()+" "+rate());lastRate=rate();}
    if(frame()%100==0 || scene==RESULTS)printh("STATE "+frame()+" "+scene+" "+hole+" "+strokes+" "+ball.x+" "+ball.y+" "+ball.vx+" "+ball.vy+" "+geometry.clock+" "+total+" "+putter.aim+" "+putter.charge+" "+putter.precision+" "+putter.guide+" "+view.over+" "+rate()+" "+dget(1)+" "+dget(2));
    prof();
}
