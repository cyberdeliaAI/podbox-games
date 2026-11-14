// stress: drives Pocket City 3D and checks it, for tools/pocketcity_test.py.
// It isn't part of the game: the tool copies it into a scratch copy of the
// cart as stress.js and makes main.js's update() call tick() first.
//
// The driving comes from the tool, as wheel turns and held buttons through
// pbgvm. This side skips the start screen and checks the drive every tick.
// Its own work runs inside prof() sections named stress, so the tool can
// take it out of the units it reports.
//
// Besides the car it checks the picture: a few pixels of the last frame,
// away from the car and the numbers, must be the map's tile pixels at that
// place in the world. A slip in the ring of city.js shows up there at once.
//
// Settings: stress_ticks (the run's length).

const REPORT = 100;
const SHOW = 30;
var SX = [6, 153, 6, 153, 80, 40, 120];
var SY = [30, 30, 100, 100, 40, 70, 70];

var last = 0;
var ticks = 0, violations = 0, shown = 0;
var distance = 0.0, metres = 0, top = 0, crashes = 0, slides = 0, grassTicks = 0, pixels = 0;
var lastX = 0.0, lastY = 0.0;

// Called first thing in update()
function tick() {
    prof("stress");
    ticks++;
    if (ticks == 1) {
        var v = sys.setting("stress_ticks");
        if (v != null)
            last = flr(v);
    }
    if (scene == TITLE) {
        startDrive();
        lastX = car.x;
        lastY = car.y;
    } else {
        check();
    }
    if (ticks % REPORT == 0 || ticks == last)
        report();
    prof();
}

// ---- the checks ----------------------------------------------------------------

// The car, the camera, the ring and the picture
function check() {
    var x = car.x, y = car.y;
    if (x < 0.0 || y < 0.0 || x >= city.mw * 8 || y >= city.mh * 8)
        fail("place");
    // never in a wall: eight points a little inside the car's own circle,
    // looked at here rather than through car.blocked(), which a fault could share
    for (var i = 0; i < 8; i++)
        if ((city.at(x + cos(i / 8.0) * 4.0, y + sin(i / 8.0) * 4.0) & city.SOLID) != 0)
            fail("wall");
    if (sqrt(car.vx * car.vx + car.vy * car.vy) > car.VMAX + 0.05)
        fail("speed");
    if (car.h < 0.0 || car.h >= 1.0 || car.steer < -1.0 || car.steer > 1.0)
        fail("heading");
    if (view.cx < 0 || view.cy < 0 || view.cx > city.mw * 8 - 160 || view.cy > city.mh * 8 - 120)
        fail("camera");
    if (city.bx != view.cx >> 3 || city.by != view.cy >> 3)
        fail("ring");
    // the picture against the map, away from the car and the numbers
    for (var i = 0; i < 7; i++) {
        var sx = SX[i], sy = SY[i];
        if (abs(sx - (flr(x) - view.cx)) < 12 && abs(sy - (flr(y) - view.cy)) < 12)
            continue;
        var wx = view.cx + sx, wy = view.cy + sy;
        var t = mget(wx >> 3, wy >> 3);
        var want = sget((t % 16) * 8 + (wx & 7), (t / 16) * 8 + (wy & 7));
        if (pget(sx, sy) != want)
            fail("picture");
        pixels++;
    }
    var d = sqrt((x - lastX) * (x - lastX) + (y - lastY) * (y - lastY));
    distance += d;
    if (distance >= 100.0) {
        metres += flr(distance);
        distance -= flr(distance);
    }
    lastX = x;
    lastY = y;
    var kh = car.kmh();
    if (kh > top)
        top = kh;
    if (car.crashed >= car.CRASH)
        crashes++;
    if (car.sliding)
        slides++;
    if ((car.surface & city.GRASS) != 0)
        grassTicks++;
}

// A check that didn't hold: counted, and the first few printed
function fail(code) {
    violations++;
    if (shown >= SHOW)
        return;
    shown++;
    printh("VIOLATION " + code + " tick " + frame() + " x " + car.x + " y " + car.y + " h " + car.h +
           " cam " + view.cx + "," + view.cy + " ring " + city.bx + "," + city.by);
}

// A STRESS line for the tool
function report() {
    printh("STRESS ticks " + ticks + " pixels " + (metres + flr(distance)) + " top " + top + " crashes " + crashes +
           " sliding " + slides + " grass " + grassTicks + " checked " + pixels + " violations " + violations);
}
