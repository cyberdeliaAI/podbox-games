// Powder Run 3D: a skier going down an endless mountain.
//
// Phase 1 of the plan in docs/powderrun.md: one slope, the skier seen from
// behind, gravity down the mountain, carving with the wheel and the snow's
// bumps under the skis. No obstacles yet.
//
// This file is the game around the run: the scenes, the options and the
// order of things. The mountain is slope.js, the skier skier.js, the
// picture view.js, its level of detail quality.js, the numbers on screen
// hud.js and the start screen title.js.

const TITLE = 0, RIDE = 1;

var scene = TITLE;
var spin = true;                   // Spin steering, else Thumb
var showHud = true;
var stats = false;

function init() {
    slope.load(0);
    quality.start();
    menuitem(1, "Restart run", startRun);
    menuitem(2, "Main menu", toTitle);
    toTitle();
}

function readOptions() {
    spin = opt.get(OPT.steering) == 0;
    showHud = opt.get(OPT.hud) == 1;
    stats = opt.get(OPT.stats) == 1;
    quality.setMode(opt.get(OPT.picture));
}

function toTitle() {
    scene = TITLE;
    title.enter();
}

function startRun() {
    skier.reset(40.0, 40.0);
    view.reset();
    scene = RIDE;
    sfx(SFX.start);
}

function update() {
    if (opt.changed())
        readOptions();
    quality.tick();
    var k = 33.0 / rate();
    if (scene == TITLE) {
        if (title.update(k))
            startRun();
        return;
    }
    skier.update(spin, k, 0.0);
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
