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
// 3 iPod Classic) and stress_ticks (the run's length).

const REPORT = 100;
const SHOW = 30;

var NAMES = ["stress_q0", "stress_q1", "stress_q2", "stress_q3", "stress_q4"];
var viewMode = 0, fixed = -1, device = 0, last = 0;
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
    if (scene == TITLE) {
        takeOff();
        view.chase = viewMode == 0;
    } else {
        check();
    }
    if (ticks % REPORT == 0 || ticks == last)
        report();
    prof();
    quality.simOff = unitsnow() - u0;
}

function setup() {
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
}

function configure() {
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

// ---- the checks ----------------------------------------------------------------

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
}

function fail(code) {
    violations++;
    if (shown >= SHOW)
        return;
    shown++;
    printh("VIOLATION " + code + " tick " + frame() + " x " + flight.x + " y " + flight.y +
           " z " + flight.z + " ground " + world.ground(flight.x, flight.y) +
           " level " + quality.level + " rate " + rate());
}

function report() {
    printh("STRESS ticks " + ticks + " level " + quality.level + " changes " + quality.changes +
           " low " + lowTicks + " clear " + flr(minClear) + " violations " + violations);
}
