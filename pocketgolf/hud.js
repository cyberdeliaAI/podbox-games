// hud: compact shot information and readable low-score cards. All text is
// original, uses CAPS and stays inside the native 160x120 screen.

// Centre labels without allocating another string.
function centre(text,y,c) { print(text,80-textw(text)/2,y,c); }

// A border shared by static pages and the hole result panel.
function box(label) {
    rect(3,3,156,116,13);
    print(label,9,9,10);
    line(9,19,150,19,5);
}

// Minimal play HUD leaves the course visible.
function draw() {
    rectfill(0,0,159,11,1);
    print("C"+(hole/9+1)+" H"+(hole%9+1)+" PAR "+course.plan.par,3,3,7);
    print("S "+strokes,137,3,10);
    rectfill(0,100,159,119,1);
    rect(4,103,112,110,13);
    var width = flr(putter.charge * 106.0 / 45.0);
    if (width>0) rectfill(5,104,5+width,109,putter.charge>36.0?8:putter.charge>24.0?10:11);
    print(putter.precision?"FINE":"AIM",125,104,putter.precision?10:6);
    print(ball.moving?"BALL IN PLAY":view.over?"COURSE OVERVIEW":"HOLD SELECT / RELEASE TO PUTT",4,114,6);
    if (stats) {
        rectfill(1,13,79,23,1);
        print(rate()+"/S "+view.spent+" U",3,16,11);
    }
    if (frame()<messageUntil) {
        rectfill(6,83,153,95,1);
        centre(message,87,10);
    }
    if (records.failed) print("SAVE UNAVAILABLE",3,26,8);
}

// Conventional score names, with a separate pickup label.
function scoreName() {
    var d = strokes-course.plan.par;
    if (picked) return "PICKUP";
    if (strokes==1) return "HOLE IN ONE!";
    if (d<=-2) return "EAGLE";
    if (d==-1) return "BIRDIE";
    if (d==0) return "PAR";
    if (d==1) return "BOGEY";
    if (d==2) return "DOUBLE BOGEY";
    return "HOLE COMPLETE";
}

// The ball sinks before the result accepts the next Select press.
function holeResult() {
    if (endWait<16) return;
    rectfill(15,26,144,85,1);
    rect(15,26,144,85,13);
    centre(scoreName(),33,10);
    centre(strokes+" STROKES / PAR "+course.plan.par,47,7);
    if (newRecord) centre("NEW HOLE RECORD",58,11);
    else if (previousBest>0) centre("BEST "+previousBest,58,6);
    centre(mode==PRACTICE?"SELECT: AGAIN":"SELECT: CONTINUE",74,7);
}

// Seven short menu rows fit around the title without hiding controls.
function title() {
    font(FONT.CAPS,2); centre("POCKET GOLF",7,11); font(FONT.CAPS);
    centre("DELUXE / 36 HOLES",25,10);
    for(var i=0;i<7;i++){
        var y=41+i*10;
        if(i==selection)rectfill(14,y-2,145,y+7,3);
        centre(rows[i],y,i==selection?7:6);
    }
    centre("WHEEL: MOVE / SELECT: OK",112,13);
}

// Nine-hole scorecards include the total, par, relative score and old best.
function scorecard() {
    var c=hole/9, sum=0, par=0;
    box(course.names[c]);
    for(var i=0;i<9;i++){
        var x=12+(i%3)*48,y=28+(i/3)*17;
        print((i+1)+":"+cards[c*9+i],x,y,7);
        sum+=cards[c*9+i];par+=course.catalog[c*9+i].par;
    }
    centre("TOTAL "+sum+" / PAR "+par,80,10);
    centre("RELATIVE "+(sum-par>0?"+":"")+(sum-par),90,7);
    centre(newRecord?"NEW COURSE RECORD":previousBest>0?"PREVIOUS BEST "+previousBest:"FIRST SCORE",100,11);
    centre("SELECT: CONTINUE",110,6);
}

// Full Tour results use total par across all thirty-six authored holes.
function result() {
    box(mode==TOUR?"FULL TOUR COMPLETE":"CHAMPIONSHIP COMPLETE");
    var par=0;
    for(var i=0;i<36;i++)if(cards[i]>0)par+=course.catalog[i].par;
    font(FONT.CAPS,2);centre("SCORE "+total,35,7);font(FONT.CAPS);
    centre("PAR "+par+" / "+(total-par>0?"+":"")+(total-par),56,10);
    centre(mode==TOUR?"ALL FOUR COURSES PLAYED":"NINE HOLES PLAYED",76,11);
    centre("SELECT: MAIN MENU",103,7);
}

// Pause is native; these are the in-cart menu and help pages.
function panel() {
    if(scene==LOADING){centre("LOADING HOLE "+(hole%9+1),52,10);centre(course.names[hole/9],66,7);}
    else if(scene==TITLE)title();
    else if(scene==CARD)scorecard();
    else if(scene==RESULTS)result();
    else {
        box("HOW TO PLAY");
        print("WHEEL: AIM",10,27,7);
        print("HOLD SELECT: BUILD POWER",10,38,7);
        print("RELEASE SELECT: PUTT",10,49,7);
        print("PREV: PRECISION AIM",10,60,7);
        print("NEXT: GUIDE / PLAY: OVERVIEW",10,71,7);
        print("WATER: LAST DRY POINT +1",10,84,13);
        centre("SELECT: BACK",106,10);
    }
}
