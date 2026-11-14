// stress: flies Pocket Wings 3D and checks it, for tools/pocketwings_test.py.
// It isn't part of the game: the tool copies it into a scratch copy of the
// cart as stress.js and makes main.js's update() call tick() first.
//
// The flying itself comes from the tool, as wheel turns and held buttons
// through pbgvm. This side skips the start screen, sets the camera and the
// picture's level, and checks the flight every tick. All of its own work
// runs inside one prof() section, named for the picture's level, so the
// tool can take it out of the units it reports and knows each tick's level.
// It also tells quality.js its own units, for the simulated iPods.
//
// The tool sets it through pbgvm's --setting, read with sys.setting():
// stress_view (0 behind, 1 cockpit), stress_level (0 to 4 fixed, -1 Auto),
// stress_device (for Auto: 1 iPod Video playing FLAC, 2 iPod Video,
// 3 iPod Classic), stress_ticks (the run's length), stress_land (0 to 5),
// stress_mode (0 Free Flight, 1 Discovery), stress_scenic (1 Follow the
// ground), stress_seek (1: in Discovery, steer for the next landmark and
// fly low enough to find it, as a player would) and stress_tour (every that
// many ticks, on to the next landscape: memory must hold steady).

const REPORT = 100;
const SHOW = 30;

var NAMES = ["stress_q0", "stress_q1", "stress_q2", "stress_q3", "stress_q4"];
var viewMode = 0, fixed = -1, device = 0, last = 0;
var landIs = 0, modeIs = 0, scenicIs = 0, seek = 0, tour = 0;
var finds = 0, lastFound = 0, flights = 0;
var ticks = 0, violations = 0, shown = 0, lowTicks = 0;
var minClear = 999.0;

// Called first thing in update()
function tick() {
    var u0 = unitsnow();
    prof(scene == FLY ? NAMES[quality.level] : "stress_idle");
    ticks++;
    if (ticks == 1)
        setup();
    if (ticks == 2)
        configure();               // after the options have been read once
    if (tour > 0 && ticks % tour == 0 && scene == FLY) {
        pickLand((landN + 1) % world.COUNT);
        flyMode = modeIs;
        takeOff();
        view.chase = viewMode == 0;
        flights++;
        lastFound = found;
    } else if (scene == TITLE && ticks > 2) {
        flyMode = modeIs;
        takeOff();
        view.chase = viewMode == 0;
        flights++;
        lastFound = found;
    } else if (scene == FLY && ticks > 3) {
        check();
        if (seek != 0 && flyMode == DISCOVERY && goal >= 0)
            steer();
    }
    if (ticks % REPORT == 0 || ticks == last)
        report();
    prof();
    quality.simOff = unitsnow() - u0;
}

// The tool's settings, read once
function setup() {
    // what the saved numbers brought, before the tool's settings change anything
    printh("START land " + landN + " found " + found + " seconds " + flr(dget(R_SECONDS)) +
           " flown " + flr(dget(R_FLOWN)) + " level " + quality.level);
    var v = sys.setting("stress_view");
    if (v != null)
        viewMode = flr(v);
    v = sys.setting("stress_level");
    if (v != null)
        fixed = flr(v);
    v = sys.setting("stress_device");
    if (v != null)
        device = flr(v);
    v = sys.setting("stress_ticks");
    if (v != null)
        last = flr(v);
    v = sys.setting("stress_land");
    if (v != null)
        landIs = flr(v);
    v = sys.setting("stress_mode");
    if (v != null)
        modeIs = flr(v);
    v = sys.setting("stress_scenic");
    if (v != null)
        scenicIs = flr(v);
    v = sys.setting("stress_seek");
    if (v != null)
        seek = flr(v);
    v = sys.setting("stress_tour");
    if (v != null)
        tour = flr(v);
    if (landIs != landN)
        pickLand(landIs);
}

// For seek: bank toward the next landmark, and come down near it
function steer() {
    var d = hud.bearing() - flight.hdg;
    d -= flr(d + 0.5);
    flight.bank = mid(-1.0, (0.0 - d) * 8.0, 1.0);
    var dx = scenery.wrapd(world.markX[goal] - flight.x), dy = scenery.wrapd(world.markY[goal] - flight.y);
    var above = flight.z - world.ground(world.markX[goal], world.markY[goal]);
    if (abs(dx) < 60.0 && abs(dy) < 60.0 && above > 40.0)
        flight.vs = -0.4;
    else if (above < 25.0)
        flight.vs = 0.2;
}

// The picture's level held, or Auto on a simulated iPod
function configure() {
    flight.scenic = scenicIs != 0;
    if (fixed >= 0) {
        quality.mode = 9;          // neither Auto nor an option: held where it is put
        quality.setLevel(fixed);
    } else {
        quality.mode = quality.AUTO;
        quality.sim = device;
        quality.setLevel(3);
    }
    quality.changes = 0;
}

// ---- the checks ---------------------------------------------------------------

function check() {
    var x = flight.x, y = flight.y, z = flight.z;
    if (x < 0.0 || x >= 256.0 || y < 0.0 || y >= 256.0)
        fail("place");
    if (flight.hdg < 0.0 || flight.hdg >= 1.0)
        fail("heading");
    if (flight.bank < -1.0 || flight.bank > 1.0)
        fail("bank");
    if (z > flight.CEILING + 0.01)
        fail("ceiling");
    var g = world.ground(x, y);
    if (z < g + 2.0)
        fail("ground");
    if (z - g < minClear)
        minClear = z - g;
    if (view.chase && view.cz < world.ground(view.cx, view.cy) + 1.0)
        fail("camera");
    if (flight.spd < flight.SPEEDS[0] * 0.9 || flight.spd > flight.SPEEDS[2] * 1.1)
        fail("speed");
    var q = quality.level;
    if (q < 0 || q >= quality.LEVELS)
        fail("level");
    else if (quality.settle < 2 && rate() != quality.RATES[q])
        fail("rate");
    if (flight.low)
        lowTicks++;
    // the scenery's list: within its cap, and what was drawn is in it
    if (scenery.dN > scenery.used || scenery.dN > scenery.DRAW)
        fail("list");
    // Follow the ground keeps its height within bounds
    if (flight.agl < flight.AGL_MIN - 0.01 || flight.agl > flight.AGL_MAX + 0.01)
        fail("agl");
    // the landmarks found only grow, Discovery's next is one not yet found
    if ((found & lastFound) != lastFound)
        fail("lost");
    if (found != lastFound)
        finds++;
    lastFound = found;
    if (goal >= 0 && ((found >> goal) & 1) != 0)
        fail("goal");
    if (goal < 0 && flyMode == DISCOVERY && found != (1 << world.MARKS_EACH) - 1)
        fail("nogoal");
}

// A check that didn't hold: counted, and the first few printed
function fail(code) {
    violations++;
    if (shown >= SHOW)
        return;
    shown++;
    printh("VIOLATION " + code + " tick " + frame() + " x " + flight.x + " y " + flight.y +
           " z " + flight.z + " ground " + world.ground(flight.x, flight.y) +
           " level " + quality.level + " rate " + rate());
}

// A STRESS line for the tool
function report() {
    var c = 0;
    for (var i = 0; i < world.MARKS_EACH; i++)
        c += (found >> i) & 1;
    printh("STRESS ticks " + ticks + " level " + quality.level + " changes " + quality.changes +
           " low " + lowTicks + " clear " + flr(minClear) + " land " + landN + " found " + c +
           " finds " + finds + " flights " + flights + " drawn " + scenery.dN + " violations " + violations);
}
