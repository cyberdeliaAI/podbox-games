// course: the holes, one loaded at a time, and what is where on it.
//
// A hole is a landscape of its own, 128 pixels across and 256 long, a world
// pixel 2.5 yards, the tee near the bottom and the green near the top
// (tools/pocketgolf3d_assets.py makes them). Its heights and colours are two
// lazy pictures for land.draw; the heights are a quarter of a world pixel a
// step, so a green can slope gently. Loading a hole takes four ticks, as
// each picture costs about a tick to read: begin() drops the hole before,
// then work() reads the heights, the colours, and sets the trees out, a
// step a tick, and a fourth tick is left for main.js to set the hole up.
// Between holes only, never in play, as the disk may be resting.
//
// The ground's height is blended from the four pixels round a point, so a
// ball rolls smoothly rather than down a staircase. A point's surface comes
// from its colour: every colour belongs to one (data/surf.json).
//
// Memory: the heap never moves what it holds, and a picture's unpacking
// takes up to 16.6 KB of working memory from the free space above the
// topmost thing held. A picture is 32 KB. If the new heights picture went
// in at the top of that space while the old pictures were still waiting
// to be cleared up below it, too little room could be left above it, and
// the game would stop "out of memory". So setup() keeps RESERVE bytes for
// good, low in memory, which leaves the free space at the top under 32 KB
// with a hole loaded: the first new picture never fits there, the engine
// clears up first, the old pictures' space joins the free top and the new
// ones go in where they were, with room above. Anything new kept for good
// (a bigger array, an image) must come off RESERVE: re-measure with
// pbgvm --memory (free less RESERVE, after a hole is loaded, should be
// about 26 KB) and run tools/pocketgolf3d_test.py, whose practice run
// loads 36 holes.
//
// The trees of every hole are read once from data/course<c>.json, with the
// height of the ground each stands on. The current hole's are kept in a
// grid of 16-pixel squares, so the ball looks only at the trees in the
// squares round it.

const MAPW = 128, MAPH = 256;      // a hole's map, world pixels
const HSCALE = 0.25;               // world pixels a step of height
const YARDS = 2.5;                 // yards a world pixel
const FAIRWAY = 1, ROUGH = 2, DEEP = 3, GREEN = 4, FRINGE = 5, TEE = 6, SAND = 7, WATER = 8;   // surfaces
const HOLES = 9;                   // holes a course
const COURSES = 1;
const MAXT = 1500;                 // trees of a course, at most
const SQUARE = 16;                 // pixels a square of the trees' grid
const GW = 8, GH = 16;             // the grid's squares across and down
const MINX = 6, MAXX = 122, MINY = 4, MAXY = 250;   // in bounds
const RESERVE = 106000;            // bytes kept low in memory for good: see above

var HIMG = [IMG.c1h1_h, IMG.c1h2_h, IMG.c1h3_h, IMG.c1h4_h, IMG.c1h5_h, IMG.c1h6_h, IMG.c1h7_h, IMG.c1h8_h, IMG.c1h9_h];
var CIMG = [IMG.c1h1_c, IMG.c1h2_c, IMG.c1h3_c, IMG.c1h4_c, IMG.c1h5_c, IMG.c1h6_c, IMG.c1h7_c, IMG.c1h8_c, IMG.c1h9_c];
var SKY = [IMG.sky1];
var SURF_NAMES = ["", "FAIRWAY", "ROUGH", "WOODS", "GREEN", "FRINGE", "TEE", "BUNKER", "WATER"];

// The courses' names, here rather than from the data: a text kept from a
// file read at the start would stay high in memory, under the free space a
// hole's pictures need to load (see main.js's init())
var names = ["MEADOW LINKS"];
var parSum = 0;                    // the first course's par
var surf = new Uint8Array(256);    // each colour's surface
var par = new Int32Array(HOLES * COURSES), yards = new Int32Array(HOLES * COURSES);
var teeX = new FixArray(HOLES * COURSES), teeY = new FixArray(HOLES * COURSES);
var pinX = new FixArray(HOLES * COURSES), pinY = new FixArray(HOLES * COURSES);
var aimX = new FixArray(HOLES * COURSES), aimY = new FixArray(HOLES * COURSES);
var greenX = new FixArray(HOLES * COURSES), greenY = new FixArray(HOLES * COURSES), greenR = new FixArray(HOLES * COURSES);
var slopeX = new FixArray(HOLES * COURSES), slopeY = new FixArray(HOLES * COURSES);   // a green's rise a pixel
var t0 = new Int32Array(HOLES * COURSES + 1);   // each hole's first tree
// every tree of the course, packed as the data has them (see plant())
var treeP = new Int32Array(MAXT), treeQ = new Int32Array(MAXT);

var cur = -1;                      // the hole loaded: course * HOLES + hole
var want = -1;                     // the hole being loaded
var step = 0;                      // work()'s next step, 0 none
var heights = null, colours = null;
var tn = 0;                        // the loaded hole's trees
var tx = new FixArray(200), ty = new FixArray(200), th = new FixArray(200), tz = new FixArray(200);
var tk = new Uint8Array(200);
var tq = new Int32Array(200);      // each tree's square
var gstart = new Int32Array(GW * GH + 1), glist = new Int32Array(200);
var gat = new Int32Array(GW * GH);

var reserve;

// Once, after the images are made and before anything else: the reserve,
// the surfaces and every course's holes and trees
function setup() {
    reserve = new Uint8Array(RESERVE);
    var s = data.read(DATA.surf).surf;
    for (var i = 0; i < 256; i++)
        surf[i] = s[i];
    var n = 0;
    for (var c = 0; c < COURSES; c++) {
        var d = data.read(DATA.course1);
        for (var h = 0; h < HOLES; h++) {
            var r = d.holes[h], j = c * HOLES + h;
            par[j] = r.par;
            if (c == 0)
                parSum += r.par;
            yards[j] = r.yards;
            teeX[j] = r.tee[0];
            teeY[j] = r.tee[1];
            pinX[j] = r.pin[0];
            pinY[j] = r.pin[1];
            aimX[j] = r.aim[0];
            aimY[j] = r.aim[1];
            greenX[j] = r.green[0];
            greenY[j] = r.green[1];
            greenR[j] = r.green[2];
            slopeX[j] = r.tilt[0];
            slopeY[j] = r.tilt[1];
            t0[j] = n;
            var t = r.trees;
            for (var i = 0; i + 1 < t.length && n < MAXT; i += 2) {
                treeP[n] = t[i];
                treeQ[n] = t[i + 1];
                n++;
            }
        }
    }
    t0[HOLES * COURSES] = n;
}

// Hole j (course * HOLES + hole) loaded at once, for the start
function load(j) {
    begin(j);
    while (work()) {
    }
}

// Starts loading hole j: the hole before let go, the rest a step a tick
function begin(j) {
    // nothing may hold the last hole's pictures (or a half-loaded one's), or they stay
    var old = cur >= 0 ? cur : want;
    heights = null;
    colours = null;
    if (old >= 0) {
        img.drop(HIMG[old]);
        img.drop(CIMG[old]);
    }
    cur = -1;
    want = j;
    step = 1;
}

// A step of loading. Returns true while there are more
function work() {
    if (step == 1) {
        heights = img.load(HIMG[want]);
        step = 2;
        return true;
    }
    if (step == 2) {
        colours = img.load(CIMG[want]);
        step = 3;
        return true;
    }
    if (step == 3) {
        plant(want);
        step = 4;
        return true;
    }
    cur = want;
    step = 0;
    return false;
}

// Hole j's trees, sorted into the grid square by square. A tree's square
// comes straight from its packed place: x and y are in 64ths, a square 16
// pixels, so x >> 10 and y >> 10
function plant(j) {
    tn = min(200, t0[j + 1] - t0[j]);
    fill(gstart, 0);
    var a = t0[j];
    for (var i = 0; i < tn; i++) {
        var p = treeP[a + i], q = treeQ[a + i];
        tx[i] = (p & 8191) * 0.015625;
        ty[i] = (p >> 13) * 0.015625;
        tz[i] = (q & 4095) * 0.015625;
        th[i] = ((q >> 12) & 1023) * 0.015625;
        tk[i] = q >> 22;
        var sq = min(GH - 1, p >> 23) * GW + min(GW - 1, (p & 8191) >> 10);
        tq[i] = sq;
        gstart[sq + 1]++;
    }
    for (var q = 1; q <= GW * GH; q++)
        gstart[q] += gstart[q - 1];
    copy(gat, 0, gstart, 0, GW * GH);
    for (var i = 0; i < tn; i++) {
        var sq = tq[i];
        glist[gat[sq]] = i;
        gat[sq]++;
    }
}

// The square of the trees' grid a point is in
function square(x, y) {
    return mid(0, flr(y) >> 4, GH - 1) * GW + mid(0, flr(x) >> 4, GW - 1);
}

// The ground's height at x, y in world pixels, blended from the four
// pixels round it
function ground(x, y) {
    var x0 = flr(x - 0.5), y0 = flr(y - 0.5);
    var fx = x - 0.5 - x0, fy = y - 0.5 - y0;
    var a = land.height(heights, x0, y0), b = land.height(heights, x0 + 1, y0);
    var c = land.height(heights, x0, y0 + 1), d = land.height(heights, x0 + 1, y0 + 1);
    var top = a + (b - a) * fx, bottom = c + (d - c) * fx;
    return (top + (bottom - top) * fy) * HSCALE;
}

// The surface under x, y
function surface(x, y) {
    if (!inside(x, y))
        return DEEP;
    return surf[land.height(colours, flr(x), flr(y))];
}

// Whether x, y is in bounds: the woods along the map's edge are not
function inside(x, y) {
    return x >= MINX && x < MAXX && y >= MINY && y < MAXY;
}

// A step's length in yards. Squared in quarters: a fraction squared past
// 181 would wrap
function dist(dx, dy) {
    var a = dx * 0.25, b = dy * 0.25;
    return flr(sqrt(a * a + b * b) * 4.0 * YARDS + 0.5);
}

// A step's length in world pixels, as a fraction
function pixels(dx, dy) {
    var a = dx * 0.25, b = dy * 0.25;
    return sqrt(a * a + b * b) * 4.0;
}

// The distance from x, y to the pin, in yards
function toPin(x, y) {
    return dist(pinX[cur] - x, pinY[cur] - y);
}

// Whether x, y is on the green (or its fringe, for the putter)
function onGreen(x, y) {
    var s = surface(x, y);
    return s == GREEN || s == FRINGE;
}
