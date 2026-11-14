// Pocket City 3D: a city seen from above, to drive about in, on foot and
// at the wheel, with work to do and the police to keep away from.
//
// Five districts on islands joined by bridges (tools/pocketcity_assets.py
// paints them): Old Town, Downtown, Greenside, the Harbour and Sunset
// Beach. Traffic keeps to its lanes and the lights, people walk the
// sidewalks, twenty jobs wait at the phone boxes and thirty tapes are lost
// about the city. See docs/pocketcity.md.
//
// This file is the game around the city: the scenes, the order of a tick,
// what counts as an offence, the sounds, saving and being busted. The
// city on the screen is city.js, its streets and lights roads.js, the
// player's car car.js, the player player.js, the other cars traffic.js,
// the people people.js, the police police.js, the jobs and tapes jobs.js,
// the camera and the picture view.js, the numbers and the map hud.js and
// the start screen title.js.

const TITLE = 0, PLAY = 1, MAPVIEW = 2;
const ENGINE_EVERY = 3;            // ticks between the engine's notes
const RED = 12, RAM = 15, RAM_COP = 30, KNOCK = 25, THEFT = 20;   // heat for each offence
const RAM_HARD = 1.0;              // pixels a tick closing: a knock that counts as ramming
const FINE = 200;                  // dollars, when busted
const CASH_MAX = 999999;
const LATE = 4;                    // late frames in a second that drop the rate to 25
const SAVE_CASH = 1, SAVE_DONE = 2, SAVE_TAPES = 3, SAVE_SEEN = 4;   // saved numbers

var scene = TITLE;
var spin = true;                   // Spin steering, else Thumb
var sounds = true;
var stats = false;
var cash = 0;
var startX = 0.0, startY = 0.0;
var objs = new Int32Array(40);
var late = 0;                      // late frames this second
var settle = 0;                    // ticks still to ignore late frames, after the camera jumped

// The palette, the city, its streets and jobs, the saved progress, then the title
function init() {
    loadpal(PAL.city);
    loadmap(MAP.city);
    city.setup();
    roads.setup();
    var d = data.read(DATA.city);
    jobs.setup(d);
    traffic.setup(d);
    var n = min(mapobj(objs, 8), 8);
    for (var i = 0; i < n; i++) {
        if (objs[i * 5] == OBJ.start) {
            startX = objs[i * 5 + 1] + 4.0;
            startY = objs[i * 5 + 2] + 4.0;
        }
    }
    cash = dget(SAVE_CASH);
    jobs.begin(dget(SAVE_DONE), dget(SAVE_TAPES), dget(SAVE_SEEN));
    menuitem(1, "City map", toMap);
    menuitem(2, "Main menu", toTitle);
    readOptions();
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

// The engine, the tyres and the siren quiet
function quiet() {
    tone(3, 0, 0, 0, WAVE.SQUARE);
    tone(2, 0, 0, 0, WAVE.NOISE);
    tone(1, 0, 0, 0, WAVE.TRIANGLE);
}

// Back to the start screen
function toTitle() {
    scene = TITLE;
    quiet();
    title.enter();
}

// The city map, from the pause menu
function toMap() {
    if (scene == PLAY) {
        scene = MAPVIEW;
        quiet();
    }
}

// A game from the saved progress: at the wheel at the start, nobody after you
function startGame() {
    traffic.reset();
    people.reset();
    police.reset();
    hud.quiet();
    jobs.begin(jobs.done, jobs.found, jobs.visited);
    startCar();
    scene = PLAY;
    sfx(SFX.start);
}

// The player at the wheel at the start, facing north up the avenue: a red
// sedan, or the gold car once every tape is found
function startCar() {
    if (jobs.tapes() == jobs.TAPES)
        player.reset(startX, startY, 0.25, traffic.SPORTS, traffic.GOLD);
    else
        player.reset(startX, startY, 0.25, traffic.SEDAN, 0);
    view.reset();
    settle = 10;
}

// A tick: the title, the map, or the city
function update() {
    if (opt.changed())
        readOptions();
    var k = 33.0 / rate();
    if (scene == TITLE) {
        if (title.update(k))
            startGame();
        return;
    }
    if (scene == MAPVIEW) {
        if (btnp(4) || btnp(3))
            scene = PLAY;
        return;
    }
    roads.tick();
    pace();
    var horn = player.update(spin, k);
    var px = player.px(), py = player.py();
    var mx = view.cx + 80, my = view.cy + 60;
    traffic.update(k, px, py, mx, my);
    if (player.inCar)
        traffic.knocks();
    else
        traffic.bumps();
    police.update(k);
    people.update(k, px, py, mx, my);
    jobs.update(k);
    if (police.busted)
        bust();
    if (police.getaway)
        ach.earn(ACH.getaway);
    view.update(k);
    hud.update();
    if (sounds) {
        if (player.inCar && car.crashed >= car.CRASH)
            sfx(SFX.crash, 0);
        else if (player.inCar && car.crashed > 0.3)
            sfx(SFX.bump, 0);
        if (horn)
            sfx(SFX.horn, 0);
        engine();
        siren();
    }
}

// More than LATE frames late in a second: down to 25 a second for good,
// where a tick has 17,500 units. Speeds go by 33.0 / rate(), so the game
// plays the same. The ticks after the camera jumped are ignored: drawing
// the whole ring afresh is always a late one
function pace() {
    if (settle > 0) {
        settle--;
        skipped();
        late = 0;
        return;
    }
    late += skipped();
    if (frame() % 33 == 0) {
        if (late > LATE && rate() > 25)
            setrate(25);
        late = 0;
    }
}

// The engine's hum, higher with the speed and the throttle, and the tyres'
// squeal while the back is out; quiet on foot
function engine() {
    if (frame() % ENGINE_EVERY != 0)
        return;
    if (!player.inCar) {
        tone(3, 0, 0, 0, WAVE.SQUARE);
        tone(2, 0, 0, 0, WAVE.NOISE);
        return;
    }
    var v = abs(car.fwd);
    var hz = flr(48.0 + v * 46.0 + (btn(4) ? 22.0 : 0.0));
    tone(3, hz, ENGINE_EVERY + 1, flr(24.0 + v * 10.0 + (btn(4) ? 12.0 : 0.0)), WAVE.SQUARE);
    if (car.sliding && v > 0.6)
        tone(2, flr(1800.0 + abs(car.side) * 900.0), ENGINE_EVERY + 1, flr(min(60.0, abs(car.side) * 40.0)), WAVE.NOISE);
    else
        tone(2, 0, 0, 0, WAVE.NOISE);
}

// The nearest siren, two notes, louder the nearer
function siren() {
    if (frame() % 4 != 0)
        return;
    if (police.siren > 240) {
        tone(1, 0, 0, 0, WAVE.TRIANGLE);
        return;
    }
    var hz = (frame() / 16) % 2 == 0 ? 740 : 980;
    tone(1, hz, 5, max(8, 46 - police.siren / 6), WAVE.TRIANGLE);
}

// The picture, then the title, the map or the numbers over it
function draw() {
    if (scene == TITLE) {
        title.draw();
        return;
    }
    if (scene == MAPVIEW) {
        hud.drawMap();
        return;
    }
    view.draw();
    hud.draw();
}

// ---- what happens in the city -----------------------------------------------------

// The player's car knocked car i, closing at force pixels a tick
function rammed(i, force) {
    if (jobs.rammed(i, force))
        return;
    var kd = traffic.on[i];
    if (force >= RAM_HARD && kd == traffic.POLICE)
        police.offence(RAM_COP);
    else if (force >= RAM_HARD && kd == traffic.DRIVE)
        police.offence(RAM);
    if (sounds)
        sfx(force >= RAM_HARD ? SFX.crash : SFX.bump, 0);
}

// The player's car knocked someone down at px, py
function knocked(px, py) {
    police.offence(KNOCK);
    if (sounds)
        sfx(SFX.bump, 0);
}

// The player took a car with its driver in it
function stole() {
    police.offence(THEFT);
}

// The player's car ran a red light
function ranRed() {
    police.offence(RED);
}

// The player on foot was knocked down by a car
function hurt() {
    if (sounds)
        sfx(SFX.bump, 0);
}

// A car door
function door() {
    if (sounds)
        sfx(SFX.door, 0);
}

// Busted: a fine, the job lost, the police stood down, back to the start
function bust() {
    police.busted = false;
    if (jobs.active >= 0)
        jobs.fail("BUSTED");
    cash = max(0, cash - FINE);
    police.standDown();
    if (sounds)
        sfx(SFX.busted, 0);
    hud.say("BUSTED", 0, hud.BIG, 0);
    traffic.reset();
    people.reset();
    startCar();
    save();
}

// Fresh paint at a paint shop: the police forget the car
function respray() {
    if (cash < jobs.RESPRAY) {
        return;
    }
    cash -= jobs.RESPRAY;
    police.standDown();
    car.paint = (car.paint + 1 + flr(rnd(traffic.PAINTS - 1))) % traffic.PAINTS;
    if (sounds)
        sfx(SFX.spray, 0);
    hud.say("FRESH PAINT", 0, hud.PLAIN, 0);
    save();
}

// A tape found: n of them now
function gotTape(n) {
    if (sounds)
        sfx(SFX.tape, 0);
    hud.say("TAPE", n, hud.COUNT, jobs.TAPES);
    if (n >= 10)
        ach.earn(ACH.mixtape);
    if (n == jobs.TAPES) {
        ach.earn(ACH.collector);
        hud.say("THE GOLD CAR IS YOURS", 0, hud.PLAIN, 0);
    }
    save();
}

// A job started, done (paying pay) or failed; a checkpoint passed
function jobStarted() {
    if (sounds)
        sfx(SFX.job, 0);
}

function jobDone(pay) {
    cash = min(CASH_MAX, cash + pay);
    if (sounds)
        sfx(SFX.pass, 0);
    ach.earn(ACH.first);
    if (jobs.done == jobs.JOBS)
        ach.earn(ACH.city);
    score.submit(BOARD.cash, cash);
    save();
}

function jobFailed() {
    if (sounds)
        sfx(SFX.fail, 0);
}

function checkpoint() {
    if (sounds)
        sfx(SFX.check, 0);
}

// The progress, kept
function save() {
    dset(SAVE_CASH, cash);
    dset(SAVE_DONE, jobs.done);
    dset(SAVE_TAPES, jobs.found);
    dset(SAVE_SEEN, jobs.visited);
}
