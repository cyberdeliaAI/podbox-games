// hud: the instruments over the view. In the chase view a compass strip
// along the top and the height and speed in its corners; in the cockpit a
// panel along the bottom with the height, the climb, the heading, the speed
// and an attitude display (a little horizon that tips with the bank and
// rises and sinks with the climb). In Discovery the next landmark's mark on
// the compass, its name and how far. Words in the middle, the frame rate
// when the option asks for it.
//
// Words kept for a moment are fixed texts and numbers, never text put
// together, for the memory's sake (see world.js).

var CARDS = ["E", "N", "W", "S"];  // at headings 0, 0.25, 0.5, 0.75
const AX = 80, AY = 108, AR = 10;  // the attitude display's middle and radius
var span = new Int32Array(AR * 2 + 1);   // its half width on each row
var landShown = -1, landUntil = 0;

// The attitude display's rows, once
function setup() {
    for (var r = 0 - AR; r <= AR; r++)
        span[r + AR] = flr(sqrt((AR * AR - r * r) * 1.0) + 0.5);
}

// A flight's start: the landscape's name for a moment
function sayLand(n) {
    landShown = n;
    landUntil = frame() + 70;
}

// The compass strip: ticks every 30 degrees, letters at the four points,
// and in Discovery the next landmark's mark
function compass(y) {
    var h = flight.hdg;
    // only the ticks in view, about a sixth of a turn either side
    var i0 = flr((h - 0.15) * 12.0) + 1, i1 = flr((h + 0.15) * 12.0);
    for (var j = i0; j <= i1; j++) {
        var i = (j % 12 + 12) % 12;
        var sx = 80 - flr((j / 12.0 - h) * 160.0 / view.FOV);
        if (i % 3 == 0)
            print(CARDS[i / 3], sx - 1, y, 7);
        else
            pset(sx, y + 2, 6);
    }
    pset(80, y + 7, 10);
    if (flyMode == DISCOVERY && goal >= 0) {
        var d2 = bearing() - h;
        d2 -= flr(d2 + 0.5);
        if (d2 < -0.14)
            print(">", 108, y, 10);
        else if (d2 > 0.14)
            print("<", 48, y, 10);
        else {
            var mx = 80 - flr(d2 * 160.0 / view.FOV);
            rectfill(mx - 1, y + 6, mx + 1, y + 8, 10);
        }
    }
}

// The way to the next landmark, turns
function bearing() {
    var dx = scenery.wrapd(world.markX[goal] - flight.x), dy = scenery.wrapd(world.markY[goal] - flight.y);
    return atan2(dx, dy);
}

// How far the next landmark is, tenths of a kilometre (a world pixel is ten
// metres). Whole numbers: squared, a fraction would wrap past 32767
function distance() {
    var dx = flr(scenery.wrapd(world.markX[goal] - flight.x)), dy = flr(scenery.wrapd(world.markY[goal] - flight.y));
    return sqrt(dx * dx + dy * dy) / 10;
}

// Everything over the view, chase or cockpit
function draw() {
    if (view.chase) {
        compass(2);
        if (flight.scenic)
            shadow("AGL " + metresUp(), 3, 3, 7);
        else
            shadow("ALT " + metres(), 3, 3, 7);
        var s = "" + knots() + " KT";
        shadow(s, 156 - textw(s), 3, 7);
    } else {
        cockpit();
    }
    if (flyMode == DISCOVERY) {
        if (goal >= 0) {
            var d = distance();
            var t = world.MARKS[landN * world.MARKS_EACH + goal] + " " + d / 10 + "." + d % 10 + " KM";
            shadow(t, 80 - textw(t) / 2, 13, 10);
        } else {
            shadow("ALL FOUND HERE", 80 - textw("ALL FOUND HERE") / 2, 13, 11);
        }
    }
    if (flight.low && (frame() & 8) != 0)
        shadow("LOW", 74, view.chase ? 100 : 82, 10);
    if (frame() < foundUntil) {
        shadow("FOUND", 80 - textw("FOUND") / 2, 34, 11);
        var m = world.MARKS[foundN];
        shadow(m, 80 - textw(m) / 2, 43, 7);
    } else if (frame() < landUntil) {
        var nm = world.NAMES[landShown];
        shadow(nm, 80 - textw(nm) / 2, 40, 7);
    } else if (frame() < msgUntil) {
        shadow(msg, 80 - textw(msg) / 2, 40, 7);
    }
    if (stats) {
        var q = "Q" + quality.level + " " + rate() + "/S";
        shadow(q, 156 - textw(q), view.chase ? 22 : 12, 13);
    }
}

// The panel along the bottom, in the cockpit view
function cockpit() {
    rectfill(0, 96, 159, 119, 5);
    line(0, 96, 159, 96, 13);
    attitude();
    print(flight.scenic ? "AGL" : "ALT", 6, 101, 13);
    print("" + (flight.scenic ? metresUp() : metres()), 6, 109, 7);
    var v = climbRate();
    print("VS", 38, 101, 13);
    print(v > 0 ? "+" + v : "" + v, 38, 109, v > 0 ? 11 : v < 0 ? 9 : 7);
    print("HDG", 100, 101, 13);
    print("" + flight.compass(), 100, 109, 7);
    print("KT", 134, 101, 13);
    print("" + knots(), 134, 109, 7);
    compass(2);
}

// A little horizon: sky over ground, the line tipping against the bank and
// rising as the aircraft dives, the aircraft's wings fixed across it
function attitude() {
    circfill(AX, AY, AR, 12);
    var b = flight.bank * 0.09;
    var t = sin(b) / cos(b);           // how far the line rises a pixel across
    var off = mid(-8.0, flight.climb * 14.0, 8.0);
    // in strips two rows high: half the drawing, and the dial is small
    for (var r = 0 - AR; r <= AR; r += 2) {
        var hw = span[r + AR];
        // ground where the strip is below the line: r > off + dx * t
        var lo = 0 - hw, hi = hw;
        if (t > 0.001) {
            hi = min(hw, flr((r - off) / t));
        } else if (t < -0.001) {
            lo = max(0 - hw, flr((r - off) / t) + 1);
        } else if (r <= off) {
            continue;
        }
        if (lo <= hi)
            rectfill(AX + lo, AY + r, AX + hi, AY + min(r + 1, AR), 4);
    }
    line(AX - 7, AY, AX - 3, AY, 10);
    line(AX + 3, AY, AX + 7, AY, 10);
    pset(AX, AY, 10);
}

// The climb as the panel shows it: whole metres a second, by the game's scale
function climbRate() {
    return flr(flight.climb * 60.0);
}

// Height above the water, as metres: a world pixel is ten
function metres() {
    return max(0, flr((flight.z - world.water) * 10.0));
}

// Height above the ground under the aircraft, as metres
function metresUp() {
    return max(0, flr((flight.z - flight.gnd) * 10.0));
}

// The speed in knots, by the game's scale
function knots() {
    return flr(flight.spd * 200.0);
}

// Text with a dark shadow down and right
function shadow(s, x, y, c) {
    print(s, x + 1, y + 1, 1);
    print(s, x, y, c);
}
