// Pocket Wings 3D: a small aircraft over six landscapes, to fly about in.
//
// No enemies, no score, no hurry. The wheel banks and turns the aircraft,
// Prev and Next climb and dive, Play steps through three speeds and Select
// switches between the view from behind and the cockpit. The landscapes
// wrap, so a flight goes on as long as the player likes.
//
// Free Flight is just that. Discovery points the way to each landscape's
// five landmarks, one after another, and keeps the ones found; flying low
// over one finds it in Free Flight too.
//
// This file is the game around the flight: the scenes, the two ways to
// fly, the landmarks, the engine's sound, the records, the options and the
// order things happen in. The landscapes are world.js, what stands on them
// scenery.js, the aircraft flight.js, the picture view.js, its level of
// detail quality.js, the instruments hud.js and the start screen title.js.
//
// Saved numbers (dget/dset): 1 the picture's level (quality.js); 2 to 7 the
// landmarks found in each landscape, a bit each; 8 the landscapes flown a
// minute in, a bit each; 9 the landscape last chosen; 10 seconds flown in
// all.

const TITLE = 0, FLY = 1;
const FREE = 0, DISCOVERY = 1;
const FIND = 16.0;                 // world pixels from a landmark that find it...
const FIND_ABOVE = 90.0;           // ...flying no higher than this above it
const ENGINE_EVERY = 4;            // ticks between the engine's notes
const R_FOUND = 2, R_FLOWN = 8, R_LAND = 9, R_SECONDS = 10;

var scene = TITLE;
var flyMode = FREE;
var spin = true;                   // Spin steering, else Thumb
var stats = false;                 // the frame rate on screen
var engine = true;                 // the engine's sound
var landN = 0;                     // the landscape chosen
var found = 0;                     // this landscape's landmarks found, a bit each
var goal = -1;                   // Discovery's next landmark, or -1 when all are found
var checkAt = 0;                   // the landmark looked at this tick
var flown = 0;                     // ticks flown in this landscape this flight
var secondTicks = 0;
var msg = "", msgUntil = 0;
var foundN = -1, foundUntil = 0;   // a landmark just found, for the words on screen

// Memory first (see world.js), then the saved choice, the landscape and the title
function init() {
    world.setup();
    hud.setup();
    scenery.setup(data.read(DATA.scenery));
    landN = mid(0, flr(dget(R_LAND)), world.COUNT - 1);
    world.load(landN);
    found = flr(dget(R_FOUND + landN));
    quality.start();
    menuitem(1, "Restart flight", takeOff);
    menuitem(2, "Main menu", toTitle);
    toTitle();
}

// The pause menu's options, read when they change
function readOptions() {
    spin = opt.get(OPT.steering) == 0;
    stats = opt.get(OPT.stats) == 1;
    flight.scenic = opt.get(OPT.height) == 1;
    engine = opt.get(OPT.engine) == 1;
    quality.setMode(opt.get(OPT.picture));
    if (!engine)
        quiet();
}

// The engine's sound off
function quiet() {
    tone(3, 0, 0, 0, WAVE.SQUARE);
}

// Back to the start screen, the engine quiet
function toTitle() {
    scene = TITLE;
    quiet();
    title.enter();
}

// A landscape from the title, its pictures loaded now
function pickLand(n) {
    landN = n;
    world.load(n);
    found = flr(dget(R_FOUND + n));
    dset(R_LAND, n);
    toTitle();
}

// A new flight from the landscape's start, the way to fly chosen last
function takeOff() {
    flight.reset(world.startX, world.startY, world.startZ, world.startHdg);
    view.chase = true;
    view.update(1.0);
    scenery.reframe(view.cx, view.cy);
    scene = FLY;
    flown = 0;
    nextTarget();
    sfx(SFX.start);
    hud.sayLand(landN);
}

// Discovery's next landmark: the nearest not yet found
function nextTarget() {
    goal = -1;
    var best = 99999;
    for (var i = 0; i < world.MARKS_EACH; i++) {
        if ((found >> i) & 1)
            continue;
        // whole numbers: squared, a fraction would wrap past 32767
        var dx = flr(scenery.wrapd(world.markX[i] - flight.x)), dy = flr(scenery.wrapd(world.markY[i] - flight.y));
        var d = dx * dx + dy * dy;
        if (d < best) {
            best = d;
            goal = i;
        }
    }
}

// One landmark a tick: flown over low enough, it's found
function discover() {
    var i = checkAt;
    checkAt = (checkAt + 1) % world.MARKS_EACH;
    if ((found >> i) & 1)
        return;
    var dx = scenery.wrapd(world.markX[i] - flight.x), dy = scenery.wrapd(world.markY[i] - flight.y);
    if (dx > FIND || dx < 0.0 - FIND || dy > FIND || dy < 0.0 - FIND || dx * dx + dy * dy > FIND * FIND)
        return;
    if (flight.z - world.ground(world.markX[i], world.markY[i]) > FIND_ABOVE)
        return;
    found |= 1 << i;
    dset(R_FOUND + landN, found);
    sfx(SFX.found);
    foundN = landN * world.MARKS_EACH + i;
    foundUntil = frame() + 90;
    ach.earn(ACH.first);
    if (found == (1 << world.MARKS_EACH) - 1)
        ach.earn(ACH.explorer);
    var all = true;
    for (var n = 0; n < world.COUNT; n++)
        if (flr(dget(R_FOUND + n)) != (1 << world.MARKS_EACH) - 1)
            all = false;
    if (all)
        ach.earn(ACH.cartographer);
    if (i == goal)
        nextTarget();
}

// Time in the air: seconds in all, and a minute in a landscape counts it as flown
function tally() {
    flown++;
    if (++secondTicks >= rate()) {
        secondTicks = 0;
        dset(R_SECONDS, flr(dget(R_SECONDS)) + 1);
    }
    if (flown == rate() * 60) {
        var have = flr(dget(R_FLOWN)) | (1 << landN);
        dset(R_FLOWN, have);
        if (have == (1 << world.COUNT) - 1)
            ach.earn(ACH.worldtour);
    }
    if (flight.z >= flight.CEILING)
        ach.earn(ACH.ceiling);
}

// The engine: a low hum, higher the faster and when climbing
function hum() {
    if (!engine || frame() % ENGINE_EVERY != 0)
        return;
    var hz = flr(52.0 + flight.spd * 90.0 + max(0.0, flight.vs) * 40.0);
    var vol = flr(22.0 + flight.spd * 30.0);
    tone(3, hz, ENGINE_EVERY + 2, vol, WAVE.SQUARE);
}

// A tick: the title, or the flight and all that goes with it
function update() {
    if (opt.changed())
        readOptions();
    if (resumed())
        quality.resume();          // back from a pause: its frames weren't late
    quality.tick();
    var k = 33.0 / rate();
    var q = quality.level;
    if (scene == TITLE) {
        if (title.update(k)) {
            flyMode = title.chosen;
            takeOff();
        }
        scenery.scan(view.cx, view.cy, flight.hdg, quality.RANGE[q], quality.CAP[q]);
        return;
    }
    flight.update(spin, k);
    if (btnp(4)) {
        view.chase = !view.chase;
        sfx(SFX.tick);
    }
    view.update(k);
    scenery.scan(view.cx, view.cy, flight.hdg, quality.RANGE[q], quality.CAP[q]);
    discover();
    tally();
    hum();
}

// The picture, then the title or the instruments over it
function draw() {
    view.draw();
    if (scene == TITLE)
        title.draw();
    else
        hud.draw();
    quality.after();
}

// Words in the middle of the screen for a moment: fixed ones only (see world.js)
function announce(s) {
    msg = s;
    msgUntil = frame() + 45;
}
