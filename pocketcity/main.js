// Pocket City 3D: a small city seen from above, to drive about in.
//
// Phase 1 of the plan in docs/pocketcity.md: one district (Old Town), one
// car, how it drives and drifts, walls to hit and a camera that looks
// ahead. No traffic, people or missions yet.
//
// This file is the game around the drive: the scenes, the options, the
// sounds of the car and the order of things. The district on the screen is
// city.js, the car car.js, the camera and the picture view.js, the numbers
// hud.js and the start screen title.js.

const TITLE = 0, DRIVE = 1;
const ENGINE_EVERY = 3;            // ticks between the engine's notes

var scene = TITLE;
var spin = true;                   // Spin steering, else Thumb
var sounds = true;
var stats = false;
var startX = 0.0, startY = 0.0;
var objs = new Int32Array(40);

// The palette, the district and where a drive starts, then the title
function init() {
    loadpal(PAL.city);
    loadmap(MAP.oldtown);
    city.setup();
    var n = min(mapobj(objs, 8), 8);
    for (var i = 0; i < n; i++) {
        if (objs[i * 5] == OBJ.start) {
            startX = objs[i * 5 + 1] + 4.0;
            startY = objs[i * 5 + 2] + 4.0;
        }
    }
    menuitem(1, "Restart drive", startDrive);
    menuitem(2, "Main menu", toTitle);
    toTitle();
}

// The pause menu's options, read when they change
function readOptions() {
    spin = opt.get(OPT.steering) == 0;
    sounds = opt.get(OPT.sounds) == 1;
    stats = opt.get(OPT.stats) == 1;
    if (!sounds)
        quiet();
}

// The engine and the tyres quiet
function quiet() {
    tone(3, 0, 0, 0, WAVE.SQUARE);
    tone(2, 0, 0, 0, WAVE.NOISE);
}

// Back to the start screen
function toTitle() {
    scene = TITLE;
    quiet();
    title.enter();
}

// A drive from the start, facing north up the avenue
function startDrive() {
    car.reset(startX, startY, 0.25);
    view.reset();
    scene = DRIVE;
    hud.say(hud.DISTRICT);
    sfx(SFX.start);
}

// A tick: the title, or the drive
function update() {
    if (opt.changed())
        readOptions();
    var k = 33.0 / rate();
    if (scene == TITLE) {
        if (title.update(k))
            startDrive();
        return;
    }
    car.update(spin, k);
    view.update(k);
    hud.update();
    if (car.crashed >= car.CRASH && sounds)
        sfx(SFX.crash, 1);
    else if (car.crashed > 0.3 && sounds)
        sfx(SFX.bump, 1);
    if (btnp(1) && sounds)
        sfx(SFX.horn, 0);
    engine();
}

// The engine's hum, higher with the speed and the throttle, and the tyres'
// squeal while the back is out
function engine() {
    if (!sounds || frame() % ENGINE_EVERY != 0)
        return;
    var v = abs(car.fwd);
    var hz = flr(48.0 + v * 46.0 + (btn(4) ? 22.0 : 0.0));
    tone(3, hz, ENGINE_EVERY + 1, flr(24.0 + v * 10.0 + (btn(4) ? 12.0 : 0.0)), WAVE.SQUARE);
    if (car.sliding && v > 0.6)
        tone(2, flr(1800.0 + abs(car.side) * 900.0), ENGINE_EVERY + 1, flr(min(60.0, abs(car.side) * 40.0)), WAVE.NOISE);
    else
        tone(2, 0, 0, 0, WAVE.NOISE);
}

// The picture, then the title or the numbers over it
function draw() {
    if (scene == TITLE) {
        title.draw();
        return;
    }
    view.draw();
    hud.draw();
}
