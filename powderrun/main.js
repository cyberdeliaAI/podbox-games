// Powder Run 3D: a skier going down an endless mountain.
//
// This file is the game around the run: the scenes, the two ways to ski,
// the records, the options and the order of things. The mountain is
// slope.js, its pines and boulders objects.js, the skier skier.js, the
// picture view.js, its level of detail quality.js, the numbers and
// messages on screen hud.js and the start screen title.js.
//
// Free Ride has no end: a fall costs a moment and the run goes on. Endless
// Run is scored on distance: three falls and it is over, and the mountain
// gets steeper and its forests thicker the further it goes. Each slope has
// a high-score board for it.
//
// Saved numbers (dget/dset): 1 the picture's level (quality.js), then the
// records below, and the slope and seed last chosen.

const TITLE = 0, RIDE = 1, OVER = 2;
const FREE = 0, ENDLESS = 1;
const LIVES = 3;                   // falls an Endless Run takes
const HISS_EVERY = 6;              // ticks between the snow's hiss notes
const SAVE_EVERY = 990;            // ticks between saves of the records in a run
const BIG_AIR = 700;               // ms in the air that earn a word on screen
const SPRAY_LIFE = 12;             // ticks a puff of snow lasts
const PUFF = 98;                   // its sprite: 3x3, lit on top, shaded below

// saved numbers
const R_TOTAL = 2, R_TOP = 3, R_AIR = 4, R_CLEAN = 5, R_BEST = 6, R_JUMPS = 7;
const R_SLOPES = 8, R_SLOPE = 9, R_SEED = 10;

var BOARDS = [BOARD.alpine, BOARD.forest, BOARD.high, BOARD.sunset, BOARD.frozen];
var SENS = [0.6, 0.8, 1.0, 1.25, 1.5];
var SPRAY_N = [3, 3, 2, 1, 1];     // snow thrown a puff, by the picture's level

var scene = TITLE;
var runMode = FREE;
var spin = true;                   // Spin steering, else Thumb
var showHud = true;
var stats = false;
var hiss = true;

var slopeN = 0;                    // the slope chosen
var seedPick = 0;                  // the seed chosen: 0 a new one each run
var runSeed = 1;                   // the seed of the run going
var lives = LIVES;
var banked = 0;                    // metres of this run already added to the total
var overRank = 0, overBest = false;
var spray;

// Memory first (see slope.js), then the saved choices, the slope and the title
function init() {
    slope.setup();
    spray = particles.pool(40);
    objects.setup(data.read(DATA.objects));
    slopeN = mid(0, flr(dget(R_SLOPE)), slope.COUNT - 1);
    seedPick = mid(0, flr(dget(R_SEED)), 99);
    slope.load(slopeN);
    quality.start();
    spray.gravity = 0.12;
    spray.drag = 0.05;
    spray.w = 3;
    spray.h = 3;
    menuitem(1, "Restart run", restartRun);
    menuitem(2, "Main menu", toTitle);
    toTitle();
}

// The pause menu's options, read when they change
function readOptions() {
    spin = opt.get(OPT.steering) == 0;
    showHud = opt.get(OPT.hud) == 1;
    stats = opt.get(OPT.stats) == 1;
    hiss = opt.get(OPT.sounds) == 1;
    skier.sens = SENS[mid(1, opt.get(OPT.sensitivity), 5) - 1];
    quality.setMode(opt.get(OPT.picture));
    if (!hiss)
        quiet();
}

// The snow's hiss off
function quiet() {
    tone(3, 0, 0, 0, WAVE.NOISE);
}

// ---- scenes -------------------------------------------------------------------

function toTitle() {
    bank();
    scene = TITLE;
    quiet();
    slope.setSeed(1);
    objects.seed(1, slope.THICK[slopeN]);
    title.enter();
}

// A new slope from the title, its pictures loaded now
function pickSlope(n) {
    slopeN = n;
    slope.load(n);
    dset(R_SLOPE, n);
    toTitle();
}

// A seed from the title: 0 is a new one each run
function pickSeed(n) {
    seedPick = n;
    dset(R_SEED, n);
}

// A new run, FREE or ENDLESS, on the slope chosen
function startRun(m) {
    runMode = m;
    runSeed = seedPick > 0 ? seedPick : 1 + rnd(99);
    slope.setSeed(runSeed);
    objects.seed(runSeed, m == ENDLESS ? 450 : slope.THICK[slopeN]);
    skier.reset(40.0, 40.0);
    view.reset();
    lives = LIVES;
    banked = 0;
    scene = RIDE;
    sfx(SFX.start);
    hud.sayStart(slope.NAMES[slopeN], runSeed);
}

// The pause menu's restart: the same way to ski, a new seed unless one was picked
function restartRun() {
    if (scene == TITLE)
        return;
    bank();
    startRun(runMode);
}

// Endless Run is over: the score to its board, and the panel
function runOver() {
    bank();
    scene = OVER;
    quiet();
    var m = skier.metres();
    overRank = score.submit(BOARDS[slopeN], m, "SEED " + runSeed);
    overBest = m > dget(R_BEST);
    if (overBest)
        dset(R_BEST, m);
    if (m >= 5000)
        ach.earn(ACH.endurance);
    sfx(SFX.over);
}

// ---- from skier.js ------------------------------------------------------------

// The skier ran into something at speed v
function fell(v) {
    quiet();
    clean();
    if (runMode == ENDLESS && scene == RIDE) {
        lives--;
        if (lives <= 0) {
            runOver();
            return;
        }
        hud.say(lives == 1 ? "LAST SKIS!" : "FALL!", 50);
    } else {
        hud.say("FALL!", 40);
    }
}

// Up again after a fall
function rose() {
    skier.runFrom = skier.s;
}

// Back on the snow after ticks in the air
function landed(ticks) {
    if (scene != RIDE)
        return;
    var ms = ticks * 1000 / rate();
    if (ms > dget(R_AIR))
        dset(R_AIR, ms);
    if (ms >= 1000)
        ach.earn(ACH.air);
    if (ms >= BIG_AIR)
        hud.sayAir(ms);
}

// ---- records ------------------------------------------------------------------

// This run's metres not yet counted into the total, counted; and the run's
// other records
function bank() {
    if (scene == TITLE)
        return;
    var m = skier.metres();
    if (m > banked) {
        dset(R_TOTAL, flr(dget(R_TOTAL)) + m - banked);
        banked = m;
    }
    if (skier.top > dget(R_TOP))
        dset(R_TOP, skier.top);
    dset(R_JUMPS, flr(dget(R_JUMPS)) + skier.jumps - skier.jumpsBanked);
    skier.jumpsBanked = skier.jumps;
    clean();
    if (m >= 500) {
        var bit = 1 << slopeN, have = flr(dget(R_SLOPES));
        if ((have & bit) == 0) {
            have |= bit;
            dset(R_SLOPES, have);
            if (have == 31)
                ach.earn(ACH.tour);
        }
    }
}

// The run since the last fall, as a record
function clean() {
    var c = skier.runMetres();
    if (c > dget(R_CLEAN))
        dset(R_CLEAN, c);
}

// Achievements and words on screen as the run goes
function milestones() {
    var m = skier.metres();
    if (m >= 1000)
        ach.earn(ACH.kilometre);
    if (skier.top >= 110)
        ach.earn(ACH.speed);
    if (skier.runMetres() >= 3000)
        ach.earn(ACH.clean);
    if (m >= banked + 1000 || frame() % SAVE_EVERY == 0)
        bank();
    if (runMode == ENDLESS) {
        // steeper and thicker as it goes: full after 2,750 metres
        objects.thicken(min(1000, 450 + m / 5));
        slope.extra = min(8, m / 500) / 100.0;
    }
}

// The owner quits and the iPod keeps the game: the records first
function ending() {
    bank();
}

// ---- the tick -----------------------------------------------------------------

function update() {
    if (opt.changed())
        readOptions();
    if (resumed()) {
        // back from a pause: the frames it took were not late
        quality.resume();
        quiet();
    }
    quality.tick();
    var k = 33.0 / rate();
    var q = quality.level;
    objects.scan(quality.RANGE[q], quality.CAP[q]);
    if (scene == TITLE) {
        if (title.update(k))
            startRun(title.chosen);
        return;
    }
    if (scene == OVER) {
        view.update(k);
        particles.step(spray);
        hud.update();
        if (btnp(4))
            startRun(ENDLESS);
        return;
    }
    if (btnp(3))
        view.toggle();
    skier.update(spin, k, 0.0);
    view.update(k);
    if (scene != RIDE)
        return;                    // the run just ended
    snow();
    throwSnow(q);
    particles.step(spray);
    milestones();
    hud.update();
}

// The skis' hiss on the snow: louder and higher the faster, gone in the
// air and while down
function snow() {
    if (!hiss || frame() % HISS_EVERY != 0)
        return;
    if (skier.air || !skier.upright()) {
        quiet();
        return;
    }
    var v = skier.v, c = abs(skier.carve);
    var vol = flr(mid(0.0, 10.0 + v * 22.0 + c * 18.0 + (skier.braking ? 24.0 : 0.0), 70.0));
    tone(3, flr(900.0 + v * 900.0 + c * 600.0), HISS_EVERY + 2, vol, WAVE.NOISE);
}

// Snow thrown up from the skis: carving hard, braking and landing, out
// from the turn
function throwSnow(q) {
    if (skier.air || !skier.upright())
        return;
    var c = skier.carve, v = skier.v, n = SPRAY_N[q];
    if (skier.landing == skier.LAND_TICKS)
        n += 3;
    else if ((frame() & 1) != 0 || !((abs(c) > 0.45 && v > 0.8) || (skier.braking && v > 0.4)))
        return;
    particles.emit(spray, n, view.footX, view.footY - 1, 0.0 - c * 1.1, -0.9 - v * 0.3, 0.6, SPRAY_LIFE,
                   0, PUFF);
}

// The picture, then the title or the HUD over it
function draw() {
    view.draw();
    if (scene == TITLE) {
        title.draw();
    } else {
        particles.draw(spray);
        hud.draw();
    }
    quality.after();
}
