// roads: the street network the traffic drives on, and its lights.
//
// The streets are four cells across, a lane of two each way, and they
// cross in junctions of 4x4 cells. tools/pocketcity_assets.py finds the
// junctions in the city it painted and writes data/roads.json: each
// junction's centre, its neighbour along the street north, east, south and
// west (or -1), whether it has lights (every junction of four streets) and
// its district. A car drives on the right: its lane's middle is 8 pixels to
// the right of the street's.
//
// The map is cut into squares of 256 pixels (32 cells), 8 by 8, and each
// square lists the junctions in it, so finding a junction near a place
// looks at a few, not all of them.
//
// Directions are 0 north, 1 east, 2 south, 3 west: a right turn is d + 1.

const MAXN = 200;                  // junctions at most
const SQUARE = 256;                // pixels across a square of the map
const SQUARES = 8;                 // squares across the map
const CYCLE = 18400;               // ms of a light's whole cycle
const GREEN = 7000, AMBER = 1500;  // ms of green and amber; the rest is red
const HALF = 9200;                 // ms east-west runs behind north-south
const SKEW = 2300;                 // ms each junction's cycle is shifted by

var DX = [0, 1, 0, -1];
var DY = [-1, 0, 1, 0];
var HEAD = [0.25, 0.0, 0.75, 0.5]; // each direction's heading, turns

var n = 0;
var nx = new Int32Array(MAXN), ny = new Int32Array(MAXN);   // centres, pixels
var link = new Int32Array(MAXN * 4);                        // neighbours, -1 for none
var sig = new Uint8Array(MAXN);                             // 1: lights
var dist = new Uint8Array(MAXN);                            // the district
var rstart = new Int32Array(SQUARES * SQUARES + 1);
var rlist = new Int32Array(MAXN);
var ms = 0;                        // the lights' clock

// Once: the network from data/roads.json
function setup() {
    var d = data.read(DATA.roads);
    n = d.nx.length;
    for (var i = 0; i < n; i++) {
        nx[i] = d.nx[i];
        ny[i] = d.ny[i];
        sig[i] = d.sig[i];
        dist[i] = d.dist[i];
        for (var j = 0; j < 4; j++)
            link[i * 4 + j] = d.link[i * 4 + j];
    }
    for (var i = 0; i <= SQUARES * SQUARES; i++)
        rstart[i] = d.rstart[i];
    for (var i = 0; i < d.rlist.length; i++)
        rlist[i] = d.rlist[i];
}

// Once a tick: the lights' clock, in ms so it runs alike at 25 and 33
function tick() {
    ms += flr(1000 / rate());
}

// What a driver going way d sees at junction i: 0 green, 1 amber, 2 red.
// Without lights it is always green.
function signal(i, d) {
    if (sig[i] == 0)
        return 0;
    var p = (ms + i * SKEW) % CYCLE;
    if ((d & 1) == 1)
        p = (p + HALF) % CYCLE;
    return p < GREEN ? 0 : p < GREEN + AMBER ? 1 : 2;
}

// Both ways' lights at junction i at once, for drawing: north-south in
// ns, east-west in ew
var ns = 0, ew = 0;
function both(i) {
    var p = (ms + i * SKEW) % CYCLE;
    ns = p < GREEN ? 0 : p < GREEN + AMBER ? 1 : 2;
    p = (p + HALF) % CYCLE;
    ew = p < GREEN ? 0 : p < GREEN + AMBER ? 1 : 2;
}

// The square of the map a place is in, clamped to the map
function square(px, py) {
    var sx = mid(0, flr(px) >> 8, SQUARES - 1), sy = mid(0, flr(py) >> 8, SQUARES - 1);
    return sy * SQUARES + sx;
}

// The length of the street from junction a going way d, centre to centre
function span(a, d) {
    var b = link[a * 4 + d];
    return abs(nx[b] - nx[a]) + abs(ny[b] - ny[a]);
}
