// Pocket Wings 3D: a small aircraft over a landscape, to fly about in.
//
// No enemies, no score, no hurry. The wheel banks and turns the aircraft,
// Prev and Next climb and dive, Play steps through three speeds and Select
// switches between the view from behind and the cockpit. The landscape
// wraps, so the flight goes on as long as the player likes.
//
// This file is the game around the flight: the scenes, the options and
// the order things happen in. The landscape is world.js, the aircraft
// flight.js, the picture view.js, its level of detail quality.js, the
// instruments hud.js and the start screen title.js.

const TITLE = 0, FLY = 1;

var scene = TITLE;
var spin = true;                   // Spin steering, else Thumb
var stats = false;                 // the frame rate on screen
var msg = "", msgUntil = 0;

function init() {
    world.load(0);
    quality.start();
    menuitem(1, "Restart flight", takeOff);
    menuitem(2, "Main menu", toTitle);
    toTitle();
}

function readOptions() {
    spin = opt.get(OPT.steering) == 0;
    stats = opt.get(OPT.stats) == 1;
    quality.setMode(opt.get(OPT.picture));
}

function toTitle() {
    scene = TITLE;
    title.enter();
}

function takeOff() {
    flight.reset(world.startX, world.startY, world.startZ, world.startHdg);
    view.chase = true;
    scene = FLY;
    sfx(SFX.start);
}

function update() {
    if (opt.changed())
        readOptions();
    if (resumed())
        quality.resume();          // back from a pause: its frames weren't late
    quality.tick();
    var k = 33.0 / rate();
    if (scene == TITLE) {
        if (title.update(k))
            takeOff();
        return;
    }
    flight.update(spin, k);
    if (btnp(4)) {
        view.chase = !view.chase;
        sfx(SFX.tick);
    }
    view.update(k);
}

function draw() {
    view.draw();
    if (scene == TITLE)
        title.draw();
    else
        hud.draw();
    quality.after();
}

function announce(s) {
    msg = s;
    msgUntil = frame() + 45;
}
