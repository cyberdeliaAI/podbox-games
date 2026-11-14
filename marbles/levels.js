// levels: the six levels, the three tracks they run on, and what is kept
// between plays (how far the player has got and the best score on each).

const COUNT = 6;

var ROUTE = [0, 1, 2, 0, 1, 2];                    // which track a level runs on
var BALLS = [45, 55, 65, 80, 90, 100];             // balls in the level
var COLOURS = [3, 4, 4, 5, 5, 6];                  // colours in play
var SPEED = [0.16, 0.18, 0.2, 0.22, 0.24, 0.27];   // pixels a tick at 33 a second
var POWER = [0, 22, 20, 18, 16, 14];               // about one ball in this many carries a power-up
var LABEL = ["SPIRAL", "ZIGZAG", "SQUARE", "WHIRL", "SWITCHBACK", "LABYRINTH"];

// the tracks, as lists of coordinates
var TX = [null, null, null];
var TY = [null, null, null];
var NEAR = [null, null, null];

var unlocked = 1;                  // levels the player may start
var best = new Int32Array(8);      // best score on each level; 0 for none

function load() {
    var t = data.read(DATA.path1);
    TX[0] = t.x;
    TY[0] = t.y;
    NEAR[0] = t.near;
    t = data.read(DATA.path2);
    TX[1] = t.x;
    TY[1] = t.y;
    NEAR[1] = t.near;
    t = data.read(DATA.path3);
    TX[2] = t.x;
    TY[2] = t.y;
    NEAR[2] = t.near;

    unlocked = mid(1, flr(dget(0)), COUNT);
    for (var i = 0; i < COUNT; i++)
        best[i] = mid(0, flr(dget(1 + i)), 30000);
}

// The level a plain Play starts: the furthest the player has got
function next() {
    return unlocked - 1;
}

// Level i was cleared with this score: keep the best and open the next
function cleared(i, pts) {
    var p = min(pts, 30000);
    if (p > best[i]) {
        best[i] = p;
        dset(1 + i, p);
    }
    if (i + 2 > unlocked && i + 1 < COUNT) {
        unlocked = i + 2;
        dset(0, unlocked);
    }
}

// Whether every level has been cleared
function allDone() {
    for (var i = 0; i < COUNT; i++)
        if (best[i] == 0)
            return false;
    return true;
}
