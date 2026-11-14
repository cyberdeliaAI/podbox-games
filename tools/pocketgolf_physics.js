// Scratch-only tests of the production physics. One group runs per tick.
var group = 0, failures = 0;
var distances = new FixArray(5);

// Build a plain calibration surface with enough room for a full shot.
function flat(surface) {
    course.load(0);
    course.plan.w = 512;
    course.plan.h = 160;
    course.plan.base = surface;
    course.plan.regions = [];
    course.plan.specials = [];
    course.hasWater = surface == 5;
    course.plan.cup[0] = 500;
    geometry.n = 0;
    geometry.circles = 0;
    ball.reset();
}

// Each assertion names a behaviour, never an implementation detail.
function expect(ok, name) {
    if (!ok) { failures++; printh("FAIL " + name); }
}

// Exercise independent physical cases with the actual cart functions.
function step() {
    group++;
    if (group == 1) {
        flat(0); ball.fire(0.0, 0.0);
        for (var i=0;i<150;i++) ball.step();
        var small = ball.x - 24.0;
        flat(0); ball.fire(0.0, 1.0);
        for (var i=0;i<150;i++) ball.step();
        expect(small > 0.0 && small < 2.0, "minimum power");
        expect(ball.x - 24.0 > 150.0 && !ball.moving, "maximum power and stopping");
    } else if (group == 2) {
        flat(0);
        geometry.n=1;
        geometry.segment(0,80.0,8.0,80.0,120.0,0.0,1.0,112.0,8.0,0.82);
        ball.fire(0.0,1.0);
        for(var i=0;i<60;i++){ball.step();expect(ball.x<=78.21,"high-speed wall tunnelling");}
        expect(ball.vx<0.0,"wall reflection");
    } else if (group == 3) {
        flat(0);geometry.n=1;
        geometry.segment(0,68.0,20.0,108.0,60.0,0.707107,0.707107,56.56854,8.0,0.82);
        ball.x=60.0;ball.y=40.0;ball.vx=2.0;ball.moving=true;
        for(var i=0;i<22;i++)ball.step();
        expect(ball.vy>0.4 && abs(ball.vx / ball.vy - 0.0989)<0.02,"angled reflection normal");
    } else if (group == 4) {
        flat(0);geometry.n=2;
        geometry.segment(0,80.0,8.0,80.0,120.0,0.0,1.0,112.0,8.0,0.82);
        geometry.segment(1,8.0,64.0,152.0,64.0,1.0,0.0,144.0,8.0,0.82);
        ball.x=74.0;ball.y=58.0;ball.vx=2.2;ball.vy=2.2;ball.moving=true;
        for(var i=0;i<12;i++)ball.step();
        expect(ball.x<=78.21 && ball.y<=62.21 && ball.vx<0.0 && ball.vy<0.0,"corner collision");
    } else if (group == 5) {
        var surfaces=[0,1,2,3,4];
        for(var j=0;j<5;j++){
            flat(surfaces[j]);ball.vx=1.0;ball.moving=true;
            for(var i=0;i<200;i++)ball.step();
            distances[j]=ball.x-24.0;
        }
        expect(distances[4]>distances[1] && distances[1]>distances[0] && distances[0]>distances[2] && distances[2]>distances[3],"surface friction ordering");
    } else if (group == 6) {
        flat(7);
        for(var i=0;i<20;i++)ball.step();
        expect(ball.x>25.0 && ball.vx>0.1,"slope acceleration from rest");
    } else if (group == 7) {
        flat(0);course.plan.regions=[[40,8,30,120,5]];
        course.hasWater=true;
        ball.x=39.0;ball.safeX=38.0;ball.vx=2.0;ball.moving=true;
        ball.step();
        expect(ball.event==1 && ball.x==38.0 && !ball.moving,"water reset and penalty event");
        ball.event=0;for(var i=0;i<30;i++)ball.step();
        expect(ball.event==0,"water penalty is not repeated");
    } else if (group == 8) {
        flat(0);course.plan.cup[0]=136;
        ball.x=134.0;ball.vx=0.3;ball.moving=true;ball.step();
        expect(ball.cup && ball.event==2,"slow cup capture");
        flat(0);course.plan.cup[0]=136;ball.x=132.0;ball.vx=3.0;ball.moving=true;ball.step();
        expect(!ball.cup,"fast putt skips cup");
    } else if (group == 9) {
        flat(0);course.plan.specials=[{kind:1,x:30,y:44,tx:90,ty:44,r:4,angle:0}];
        ball.x=29.0;ball.vx=1.0;ball.moving=true;ball.step();
        expect(ball.x>85.0 && ball.vx>0.0 && ball.cooldown>0,"teleport momentum and cooldown");
        flat(0);course.plan.specials=[{kind:3,x:30,y:44,tx:0,ty:0,r:4,angle:0.25}];
        ball.x=29.0;ball.vx=1.0;ball.moving=true;ball.step();
        expect(abs(ball.vx)<0.01 && ball.vy < -2.0,"directional booster");
    } else if (group == 10) {
        flat(0);course.plan.specials=[{kind:4,x:30,y:44,tx:0,ty:0,r:4,angle:0}];
        ball.x=29.0;ball.vx=1.0;ball.moving=true;ball.step();
        expect(geometry.gateOpen,"switch activation");
        flat(0);course.plan.specials=[{kind:5,x:30,y:44,tx:0,ty:0,r:4,angle:0}];
        ball.x=29.0;ball.vx=1.0;ball.moving=true;ball.step();ball.step();
        expect(ball.z>0.0,"ramp lift");
    } else if (group == 11) {
        flat(0);
        geometry.staticN=0;
        geometry.movers=[{kind:2,x:80,y:44,r:10,period:220,angle:0.25,dx:10,dy:0}];
        geometry.clock=22;geometry.update();
        ball.x=73.0;ball.y=44.0;ball.step();
        expect(ball.x<73.0 && ball.vx<0.0,"moving gate pushes a resting ball");
    } else if (group == 12) {
        flat(0);geometry.circles=1;
        geometry.cx[0]=64.0;geometry.cy[0]=44.0;geometry.radius[0]=8.0;
        ball.x=52.0;ball.vx=3.2;ball.moving=true;
        for(var i=0;i<10;i++){
            ball.step();expect(ball.x<=54.21,"curved bumper tunnelling");
        }
        expect(ball.vx<0.0,"curved bumper reflection");
    } else if (group == 13) {
        flat(0);geometry.n=1;
        geometry.segment(0,80.0,8.0,80.0,120.0,0.0,1.0,112.0,1.0,0.82);
        ball.x=77.0;ball.vx=2.0;ball.z=2.0;ball.vz=0.2;ball.moving=true;
        for(var i=0;i<4;i++)ball.step();
        expect(ball.x>80.0,"airborne ball clears a low barrier");
    } else if (group == 14) {
        flat(0);course.plan.specials=[{kind:2,x:30,y:44,tx:90,ty:44,r:4,angle:0}];
        ball.x=29.0;ball.vx=1.0;ball.moving=true;ball.step();
        var arrival=ball.x;
        for(var i=0;i<10;i++)ball.step();
        expect(ball.x==arrival && ball.delay==0 && ball.vx>0.0,"tunnel transit preserves controlled momentum");
    } else {
        printh("PHYSICS " + failures);
        quit();
    }
}
