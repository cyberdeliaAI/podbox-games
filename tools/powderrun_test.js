// stress: skis Powder Run 3D and checks it, for tools/powderrun_test.py.
// It isn't part of the game: the tool copies it into a scratch copy of the
// cart as stress.js and makes main.js's update() call tick() first.
//
// The carving comes from the tool, as wheel turns through pbgvm. This side
// skips the start screen, sets the picture's level and checks the run every
// tick. Its own work runs inside one prof() section named for the picture's
// level, so the tool can take it out of the units it reports and knows each
// tick's level. It also tells quality.js its own units, for the simulated
// iPods.
//
// The tool sets it through pbgvm's --setting: stress_level (0 to 4 fixed,
// -1 Auto), stress_device (for Auto: 1 iPod Video playing FLAC, 2 iPod
// Video, 3 iPod Classic) and stress_ticks (the run's length).

const REPORT = 100;
const SHOW = 30;
const LONG_AIR = 150;              // ticks in the air that would mean something is wrong

var NAMES = ["stress_q0", "stress_q1", "stress_q2", "stress_q3", "stress_q4"];
var fixed = -1, device = 0, last = 0;
var ticks = 0, violations = 0, shown = 0;
var lastS = 0, flight = 0, longest = 0, top = 0, rideTicks = 0;
var speedSum = 0;                  // whole km/h added up: a fraction would wrap past 32767
var at = [0.0, 0.0, 0.0, 0.0];

// Called first thing in update()
function tick() {
    var u0 = unitsnow();
    prof(scene == RIDE ? NAMES[quality.level] : "stress_idle");
    ticks++;
    if (ticks == 1)
        setup();
    if (ticks == 2)
        configure();
    if (scene == TITLE)
        startRun();
    else if (ticks > 3)
        check();
    if (ticks % REPORT == 0 || ticks == last)
        report();
    prof();
    quality.simOff = unitsnow() - u0;
}

function setup() {
    var v = sys.setting("stress_level");
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
        quality.mode = 9;
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
    var x = skier.x, y = skier.y;
    if (x < 0.0 || x >= 256.0 || y < 0.0 || y >= 256.0)
        fail("place");
    var o = skier.off();
    if (o > skier.LIMIT + 0.001 || o < -skier.LIMIT - 0.001)
        fail("heading");
    if (skier.v < skier.VMIN - 0.001 || skier.v > skier.VMAX + 0.001)
        fail("speed");
    if (skier.hrel < 0.0 || (!skier.air && skier.hrel != 0.0))
        fail("snow");
    if (skier.s < lastS)
        fail("uphill");
    lastS = skier.s;
    if (view.cz < slope.ground(view.cx, view.cy) + 1.0)
        fail("camera");
    // the skier on the screen, through the camera the last frame drew with
    var sc = quality.HALF[quality.level] != 0 ? 0.5 : 1.0;
    if (plane.project(x * sc, y * sc, (skier.g + skier.hrel) * sc, at) == 0 ||
        at[0] < 8.0 || at[0] > 152.0 || at[1] < 16.0 || at[1] > 119.0)
        fail("unseen");
    if (skier.air) {
        flight++;
        if (flight > longest)
            longest = flight;
        if (flight > LONG_AIR)
            fail("air");
    } else {
        flight = 0;
    }
    var q = quality.level;
    if (quality.settle < 2 && rate() != quality.RATES[q])
        fail("rate");
    var kmh = skier.kmh();
    if (kmh > top)
        top = kmh;
    speedSum += kmh;
    rideTicks++;
}

function fail(code) {
    violations++;
    if (shown >= SHOW)
        return;
    shown++;
    printh("VIOLATION " + code + " tick " + frame() + " x " + skier.x + " y " + skier.y +
           " off " + skier.off() + " v " + skier.v + " air " + skier.air + " hrel " + skier.hrel +
           " level " + quality.level + " sy " + at[1]);
}

function report() {
    printh("STRESS ticks " + ticks + " level " + quality.level + " changes " + quality.changes +
           " metres " + skier.metres() + " top " + top + " avg " + flr(speedSum / max(1, rideTicks)) +
           " jumps " + skier.jumps + " airtime " + skier.airTicks + " longest " + longest +
           " violations " + violations);
}
