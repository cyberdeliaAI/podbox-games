// ball: the ball in flight, bouncing and rolling, and where it ends up.
//
// Everything runs a tick at a time at 25 ticks a second, in world pixels
// (2.5 yards each). In the air the ball falls by G a tick and drifts with
// the wind; a hook or a slice pushes it sideways the whole way. There is no
// drag: each club's launch angle is a low, effective one that gives the
// right carry and a believable height.
//
// Landing, it bounces by the surface: high off a fairway, hardly at all in
// a bunker. The first bounce also takes the club's backspin, so a wedge
// checks up where a driver runs on. Once a bounce is under STILL it rolls:
// slowed by the surface, pulled down slopes. On a green the slope is the
// green's own tilt from the course's data, not the pixels', whose whole
// steps would roll the ball over terraces.
//
// The trees stand in a grid (course.js): the ball looks only at the ones
// in the nine squares round it, and only while it is low enough to meet
// one. A crown slows it and drops it; a trunk sends it back.
//
// The cup is bigger than a real one (CUP), as the picture is coarse: over
// it slower than SINK (a ball that would have stopped about three yards
// past) and the ball drops; faster, it lips out.

const REST = 0, FLY = 1, ROLL = 2, HOLED = 3, WET = 4, OUT = 5;   // states
const G = 0.0072;                  // world pixels a tick a tick: gravity at 25 ticks a second
const SLOPE = 0.006;               // how hard a slope pulls a rolling ball
const STILL = 0.03;                // a bounce slower than this, world pixels a tick, rolls
const CUP = 0.2;                   // the cup's reach, world pixels: a yard across, eight times a real one
const SINK = 0.06;                 // faster than this over the cup, world pixels a tick, it lips out
const DUNK = 0.15;                 // a falling ball landing this near the pin goes in
const WIND = 0.000124;             // world pixels a tick a tick for each mph of wind
const SIDE = 0.0016;               // the sideways push of a full hook or slice
const MAXROLL = 750;               // ticks a ball may roll before it is stopped

// by surface (course.js): none, fairway, rough, woods, green, fringe, tee, sand, water
var BOUNCE = [0.0, 0.2, 0.14, 0.1, 0.2, 0.18, 0.2, 0.02, 0.0];    // how much of the fall comes back up
var KEEP = [0.0, 0.6, 0.4, 0.25, 0.5, 0.5, 0.6, 0.1, 0.0];        // how much of the run a bounce keeps
var DRAG = [0.0, 0.008, 0.016, 0.032, 0.0016, 0.0035, 0.008, 0.05, 0.0];   // a rolling ball slows by, a tick

var state = REST;
var x = 0.0, y = 0.0, z = 0.0;     // world pixels; z is the height, not over the ground
var vx = 0.0, vy = 0.0, vz = 0.0;
var sx = 0.0, sy = 0.0;            // the hook or slice's push a tick
var wx = 0.0, wy = 0.0;            // the wind's push a tick
var spin = 1.0;                    // the run the first bounce keeps, for the club's backspin
var bounces = 0;
var ticks = 0;                     // ticks since it was struck
var fromX = 0.0, fromY = 0.0;      // where it was struck
var dryX = 0.0, dryY = 0.0;        // the last place it passed over dry land
var lipped = 0;                    // ticks before the cup can take it again
var lastTree = -1;                 // the tree it is in, so a crown slows it once
var landX = 0.0, landY = 0.0;      // where it first came down
var hitTree = false;               // whether this shot met a tree
var peak = false;                  // whether it has passed the top of its flight

// The ball at rest at x, y, on the ground
function place(px, py) {
    x = px;
    y = py;
    z = course.ground(x, y);
    vx = 0.0;
    vy = 0.0;
    vz = 0.0;
    state = REST;
}

// The wind for a hole: mph blowing toward heading a (turns)
function setWind(mph, a) {
    wx = cos(a) * mph * WIND;
    wy = sin(a) * mph * WIND;
}

// Struck along heading a, rising at angle up (turns), at speed v (world
// pixels a tick); side is the hook or slice, -1 to 1, keep the run the
// first bounce keeps
function strike(a, up, v, side, keep) {
    var h = v * cos(up);
    vx = cos(a) * h;
    vy = sin(a) * h;
    vz = (0.0 - sin(up)) * v;      // sin is upside down
    // a slice (side > 0) pushes right: the heading a quarter turn clockwise
    sx = cos(a - 0.25) * side * SIDE * min(1.0, h);
    sy = sin(a - 0.25) * side * SIDE * min(1.0, h);
    spin = keep;
    fromX = x;
    fromY = y;
    dryX = x;
    dryY = y;
    landX = x;
    landY = y;
    bounces = 0;
    ticks = 0;
    lipped = 0;
    lastTree = -1;
    hitTree = false;
    peak = false;
    state = vz > 0.0 ? FLY : ROLL;
}

// A putt: rolling along heading a at speed v
function putt(a, v) {
    strike(a, 0.0, v, 0.0, 1.0);
    state = ROLL;
}

// One tick of the ball. Returns what happened for main.js: 0 nothing, 1 a
// bounce, 2 a tree, 3 a stop or the end of the shot
function step() {
    if (state == FLY)
        return fly();
    if (state == ROLL)
        return roll();
    return 0;
}

// In the air: gravity, wind, the hook or slice, the trees and the landing
function fly() {
    ticks++;
    vx += wx + sx;
    vy += wy + sy;
    vz -= G;
    if (vz < 0.0)
        peak = true;
    x += vx;
    y += vy;
    z += vz;
    var r = 0;
    if (x < 0.0 || x >= 128.0 || y < 0.0 || y >= 256.0) {
        // off the map altogether: out of bounds, wherever it comes down
        state = OUT;
        return 3;
    }
    var g = course.ground(x, y);
    var s = course.surface(x, y);
    if (s != course.WATER && course.inside(x, y)) {
        dryX = x;
        dryY = y;
    }
    if (z < g + 12.0 && trees())
        r = 2;
    if (z > g)
        return r;
    // down
    z = g;
    if (bounces == 0) {
        landX = x;
        landY = y;
    }
    if (!course.inside(x, y)) {
        state = OUT;
        return 3;
    }
    if (s == course.WATER) {
        state = WET;
        return 3;
    }
    if (s == course.GREEN && near(x, y) < DUNK * DUNK) {
        state = HOLED;
        return 3;
    }
    var keep = KEEP[s];
    if (bounces == 0)
        keep = keep * spin;
    bounces++;
    vx = vx * keep;
    vy = vy * keep;
    vz = (0.0 - vz) * BOUNCE[s];
    sx = 0.0;
    sy = 0.0;
    if (vz < STILL) {
        vz = 0.0;
        state = ROLL;
        ticks = 0;
    }
    return 1;
}

// On the ground: the surface slows it, the slope pulls it, the cup takes it
function roll() {
    ticks++;
    var s = course.surface(x, y);
    var gx, gy;
    if (s == course.GREEN || s == course.FRINGE) {
        gx = course.slopeX[course.cur];
        gy = course.slopeY[course.cur];
    } else {
        gx = (course.ground(x + 1.5, y) - course.ground(x - 1.5, y)) / 3.0;
        gy = (course.ground(x, y + 1.5) - course.ground(x, y - 1.5)) / 3.0;
    }
    var ax = gx * SLOPE, ay = gy * SLOPE;
    var d = DRAG[s];
    var v = speed();
    if (v <= d && pull(ax, ay) <= d) {
        // too slow, and the slope can't start it again: the same test as
        // below, or a ball the slope pulls a little would never stop
        stop();
        return 3;
    }
    vx -= ax;
    vy -= ay;
    v = speed();
    if (v <= d) {
        vx = 0.0;
        vy = 0.0;
    } else {
        var k = (v - d) / v;
        vx = vx * k;
        vy = vy * k;
    }
    var ox = x, oy = y;
    x += vx;
    y += vy;
    if (!course.inside(x, y)) {
        state = OUT;
        return 3;
    }
    z = course.ground(x, y);
    s = course.surface(x, y);
    if (s == course.WATER) {
        state = WET;
        return 3;
    }
    dryX = x;
    dryY = y;
    if (lipped > 0)
        lipped--;
    else if (cup(ox, oy, v))
        return 3;
    if (ticks > MAXROLL) {
        stop();
        return 3;
    }
    return 0;
}

// Whether the ball, rolling from ox, oy to where it is now at speed v,
// went over the cup: in if slow enough, else it lips out, turned a little
function cup(ox, oy, v) {
    var px = course.pinX[course.cur], py = course.pinY[course.cur];
    // the nearest point of this tick's roll to the pin
    var dx = x - ox, dy = y - oy;
    var len = dx * dx + dy * dy;
    var u = 1.0;
    if (len > 0.0)
        u = mid(0.0, ((px - ox) * dx + (py - oy) * dy) / len, 1.0);
    var nx = ox + dx * u - px, ny = oy + dy * u - py;
    if (abs(nx) > CUP || abs(ny) > CUP || nx * nx + ny * ny > CUP * CUP)
        return false;
    if (v < SINK) {
        x = px;
        y = py;
        state = HOLED;
        return true;
    }
    // round the rim and away, slower
    var a = atan2(vx, vy) + (rnd(2) == 0 ? 0.06 : -0.06);
    v = v * 0.6;
    vx = cos(a) * v;
    vy = sin(a) * v;
    lipped = 12;
    sfx(SFX.lip);
    return false;
}

// The trees near the ball: a crown slows and drops it, a trunk sends it
// back. Returns whether it met one this tick
function trees() {
    var cx = mid(0, flr(x) >> 4, course.GW - 1), cy = mid(0, flr(y) >> 4, course.GH - 1);
    var met = -1;
    for (var qy = max(0, cy - 1); qy <= min(course.GH - 1, cy + 1); qy++) {
        for (var qx = max(0, cx - 1); qx <= min(course.GW - 1, cx + 1); qx++) {
            var q = qy * course.GW + qx;
            for (var j = course.gstart[q]; j < course.gstart[q + 1]; j++) {
                var i = course.glist[j];
                if (inTree(i))
                    met = i;
            }
        }
    }
    if (met < 0) {
        lastTree = -1;
        return false;
    }
    if (met == lastTree)
        return false;
    lastTree = met;
    hitTree = true;
    var dz = z - course.tz[met], th = course.th[met];
    if (dz < th * 0.25) {
        // the trunk: back the way it came
        vx = (0.0 - vx) * 0.4;
        vy = (0.0 - vy) * 0.4;
    } else {
        // the leaves: most of its speed gone, a new way, dropping
        var a = atan2(vx, vy) + (rnd(1.0) - 0.5) * 0.4;
        var v = speed() * 0.25;
        vx = cos(a) * v;
        vy = sin(a) * v;
        vz = min(vz, 0.0) * 0.3;
    }
    sx = 0.0;
    sy = 0.0;
    return true;
}

// Whether the ball is inside tree i: a broad crown is round, a pine's a cone
function inTree(i) {
    var dx = x - course.tx[i], dy = y - course.ty[i];
    if (abs(dx) > 4.0 || abs(dy) > 4.0)
        return false;
    var th = course.th[i], dz = z - course.tz[i];
    if (dz < 0.0 || dz > th)
        return false;
    var d2 = dx * dx + dy * dy;
    if (dz < th * 0.25)
        return d2 < 0.16;          // the trunk
    if (course.tk[i] == 0) {
        // a broadleaf's crown: a ball round the middle of the top part
        var r = th * 0.36, u = (dz - th * 0.6) / (th * 0.4);
        return d2 < r * r * (1.0 - u * u);
    }
    // a pine: widest at the bottom of its branches
    var w = th * 0.27 * (th - dz) / (th * 0.85);
    return d2 < w * w;
}

// The ball's speed along the ground. Squared at 32 times: a slow roll's
// speed squared would be under a fraction's smallest step
function speed() {
    var a = vx * 32.0, b = vy * 32.0;
    return sqrt(a * a + b * b) / 32.0;
}

// A slope's pull, its two parts put together. Squared at 256 times: a
// gentle pull squared is under a fraction's smallest step
function pull(ax, ay) {
    var a = ax * 256.0, b = ay * 256.0;
    return sqrt(a * a + b * b) / 256.0;
}

// The distance squared from x, y to the pin, for small distances only
function near(px, py) {
    var dx = px - course.pinX[course.cur], dy = py - course.pinY[course.cur];
    if (abs(dx) > 8.0 || abs(dy) > 8.0)
        return 64.0;
    return dx * dx + dy * dy;
}

// At rest where it is
function stop() {
    vx = 0.0;
    vy = 0.0;
    vz = 0.0;
    z = course.ground(x, y);
    state = REST;
}

// How far it went from where it was struck, in yards
function yards() {
    return course.dist(x - fromX, y - fromY);
}
