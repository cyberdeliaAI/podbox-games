// Pocket Golf 3D: golf over a rolling 3D landscape.
//
// This file is the game round the shots: the scenes, a round and practice,
// the aim, the strokes and penalties, the records and the order of
// things. The holes are course.js, the ball ball.js, the clubs and the
// swing meter swing.js, the picture view.js, what is on screen over it
// hud.js and the start screen title.js.
//
// A hole starts with LOAD (its pictures read over four ticks, the screen
// left as it was) and INTRO (its panel). A shot goes: AIM (the wheel turns
// the aim, Prev and Next the club, then
// the swing meter), FLIGHT (the ball flies, bounces and rolls; a long
// shot's picture cuts to its landing at the top of its flight), RESULT
// (a word on where it lies) and AIM again, or HOLED and the scorecard.
// Ten strokes and the ball is picked up.
//
// Saved numbers (dget/dset): 1 the best round, 2 rounds played, 3 to 11
// each hole's best, 12 the hole last practised.

const TITLE = 0, INTRO = 1, AIM = 2, FLIGHT = 3, RESULT = 4, HOLED = 5, CARD = 6, LOAD = 7;   // scenes
const R_BEST = 1, R_ROUNDS = 2, R_HOLE = 3, R_PRACTICE = 12;
const MAXSTROKES = 10;             // picked up after this many
const INTRO_TICKS = 100;           // ticks the panel before a hole stays
const RESULT_TICKS = 45;           // ...the word after a shot
const HOLED_TICKS = 80;            // ...and the word after holing out
const TURN = 0.002;                // turns a click of the wheel turns the aim
const FINE = 0.00065;              // ...on the green
const EDGE = 0.075;                // the aim this far from the picture's middle, turns, moves the camera
const LEAD = 0.05;                 // ...this far ahead of it
const CUT = 70.0;                  // a landing further from the camera than this, world pixels, gets its own view

var scene = TITLE;
var practice = false;
var holeN = 0;
var strokes = 0;
var scores = new Int32Array(9);
var finished = false, newBest = false, boardRank = 0;
var aimA = 0.25;                   // the aim, turns
var lie = 1;                       // the surface the ball lies on
var putting = false;               // on the green: the camera close and low
var pinYds = 0;
var windMph = 0, windA = 0.0;
var showMap = false, guide = true, stats = false;
var timer = 0;
var teeShot = true;
var fairways = 0, fairwayHoles = 0;   // tee shots on par 4s and 5s that found the fairway, of those
var cutAt = false;                 // a landing view to cut to at the top of the flight

// The images first, then the data files read: what is read is let go, and
// with nothing kept above it the free space at the top of memory is big
// enough for a hole's pictures to be unpacked in (see course.js)
function init() {
    loadpal(PAL.golf);
    view.setup();
    hud.setup();
    course.setup();
    swing.setup();
    title.pick = mid(0, flr(dget(R_PRACTICE)), course.HOLES - 1);
    readOptions();
    menuitem(1, "Restart round", restart);
    menuitem(2, "Main menu", toTitle);
    toTitle();
}

// The pause menu's options, read when they change
function readOptions() {
    swing.setSpeed(opt.get(OPT.meter));
    guide = opt.get(OPT.aidguide) == 1;
    stats = opt.get(OPT.stats) == 1;
}

// ---- scenes -------------------------------------------------------------------

// The start screen, over the first hole or the one loaded
function toTitle() {
    scene = TITLE;
    if (course.cur < 0)
        course.load(course.step != 0 ? course.want : 0);
    var j = course.cur;
    view.opening(course.teeX[j], course.teeY[j],
                 atan2(course.aimX[j] - course.teeX[j], course.aimY[j] - course.teeY[j]));
    title.enter();
}

// A round of nine holes, or practice on one
function startGame() {
    practice = title.chosen == 1;
    finished = false;
    fill(scores, 0);
    fairways = 0;
    fairwayHoles = 0;
    if (practice) {
        dset(R_PRACTICE, title.pick);
        enterHole(title.pick);
    } else {
        enterHole(0);
    }
}

// The pause menu's restart: the round from the first hole, or the hole practised
function restart() {
    if (scene == TITLE)
        return;
    if (practice) {
        enterHole(holeN);
        return;
    }
    finished = false;
    fill(scores, 0);
    fairways = 0;
    fairwayHoles = 0;
    enterHole(0);
}

// Hole h: its pictures loaded over the next ticks, then setHole()
function enterHole(h) {
    holeN = h;
    showMap = false;
    course.begin(h);
    scene = LOAD;
}

// The hole loaded: its map, the wind, the ball on the tee and the panel
function setHole() {
    var h = holeN;
    hud.sayFor = 0;
    view.dirty = true;
    hud.mapHole();
    windMph = rnd(13);
    windA = rnd(1.0);
    ball.setWind(windMph, windA);
    ball.place(course.teeX[h], course.teeY[h]);
    strokes = 0;
    teeShot = true;
    showMap = false;
    if (course.par[h] > 3)
        fairwayHoles++;
    aimShot();
    scene = INTRO;
    timer = 0;
    sfx(SFX.start);
}

// The next shot: the lie, the aim at the pin (at the landing on the
// fairway from the tee of a long hole), the club, the camera
function aimShot() {
    var j = course.cur;
    lie = course.surface(ball.x, ball.y);
    pinYds = course.toPin(ball.x, ball.y);
    var tx = course.pinX[j], ty = course.pinY[j];
    if (teeShot && course.par[j] > 3) {
        tx = course.aimX[j];
        ty = course.aimY[j];
    }
    aimA = atan2(tx - ball.x, ty - ball.y);
    swing.club = swing.pick(pinYds, lie);
    var px = course.pixels(course.pinX[j] - ball.x, course.pinY[j] - ball.y);
    swing.putting(px);
    putting = lie == course.GREEN || lie == course.FRINGE;
    view.shot(ball.x, ball.y, aimA, putting, px);
    swing.reset();
}

// From a panel or a word to aiming, the word gone if it was skipped
function toAim() {
    aimShot();
    hud.sayFor = 0;
    scene = AIM;
}

// ---- the tick -----------------------------------------------------------------

function update() {
    if (opt.changed())
        readOptions();
    hud.update();
    if (scene == TITLE) {
        if (title.update())
            startGame();
        return;
    }
    if (scene == LOAD) {
        if (!course.work())
            setHole();
        return;
    }
    if (scene == INTRO) {
        timer++;
        if (timer > INTRO_TICKS || btnp(4))
            scene = AIM;
        return;
    }
    if (scene == AIM) {
        aiming();
        return;
    }
    if (scene == FLIGHT) {
        flight();
        return;
    }
    timer++;
    if (scene == RESULT) {
        if (timer > RESULT_TICKS || btnp(4))
            toAim();
        return;
    }
    if (scene == HOLED) {
        if (timer > HOLED_TICKS || btnp(4))
            afterHole();
        return;
    }
    if (scene == CARD && btnp(4))
        nextHole();
}

// Aiming: the wheel turns the aim (the camera round with it at the
// picture's edge), Prev and Next the club, Play the map; then the swing
function aiming() {
    if (swing.phase == swing.IDLE) {
        var w = wheel();
        if (w != 0) {
            var step = putting ? FINE : TURN;
            if (abs(w) > 2)
                step = step * 2.0;     // turned fast, it goes further
            aimA -= w * step;          // clockwise turns the aim right
            aimA -= flr(aimA);
            var o = view.off(aimA);
            if (abs(o) > EDGE) {
                var px = course.pixels(course.pinX[course.cur] - ball.x, course.pinY[course.cur] - ball.y);
                view.shot(ball.x, ball.y, aimA + (o > 0.0 ? LEAD : 0.0 - LEAD), putting, px);
            }
        }
        if (btnp(0))
            changeClub(-1);
        if (btnp(1))
            changeClub(1);
        if (btnp(3))
            showMap = !showMap;
    }
    if (swing.update())
        shoot();
}

// The next club up or down the bag
function changeClub(d) {
    var c = mid(0, swing.club + d, swing.PUTTER);
    if (c != swing.club) {
        swing.club = c;
        sfx(SFX.select);
    }
}

// The swing is done: the ball struck, a stroke counted
function shoot() {
    strokes++;
    showMap = false;
    swing.strike(aimA, lie);
    cutAt = swing.club != swing.PUTTER;
    scene = FLIGHT;
    timer = 0;
}

// The ball on its way: sounds as it bounces and meets trees, the landing
// view, and the end of the shot
function flight() {
    timer++;
    var r = ball.step();
    if (r == 1) {
        var s = course.surface(ball.x, ball.y);
        if (s == course.SAND)
            sfx(SFX.sand);
        else if (ball.bounces < 4)
            sfx(SFX.bounce);
    } else if (r == 2) {
        sfx(SFX.tree);
    }
    if (cutAt && ball.peak && ball.state == ball.FLY) {
        // at the top: where it will come down, without the wind
        cutAt = false;
        var h = max(0.0, ball.z - course.ground(ball.x, ball.y));
        var tf = sqrt(2.0 * h / ball.G);
        var lx = ball.x + ball.vx * tf, ly = ball.y + ball.vy * tf;
        if (course.pixels(lx - view.camX, ly - view.camY) > CUT)
            view.landing(lx, ly, atan2(ball.vx, ball.vy));
    }
    if (r == 3)
        shotOver();
}

// The ball has stopped, gone in, or is lost: what that means
function shotOver() {
    var st = ball.state;
    var was = teeShot;
    teeShot = false;
    timer = 0;
    if (st == ball.HOLED) {
        holed();
        return;
    }
    scene = RESULT;
    if (st == ball.WET) {
        strokes++;
        sfx(SFX.splash);
        drop();
        hud.say("SPLASH!", "ONE STROKE PENALTY", 0, hud.PENALTY, RESULT_TICKS, 12);
    } else if (st == ball.OUT) {
        strokes++;
        sfx(SFX.out);
        ball.place(ball.fromX, ball.fromY);
        hud.say("OUT OF BOUNDS", "ONE STROKE PENALTY", 0, hud.PENALTY, RESULT_TICKS, 8);
    } else {
        var s = course.surface(ball.x, ball.y);
        if (was && course.par[course.cur] > 3 && s == course.FAIRWAY)
            fairways++;
        if (swing.club == swing.PUTTER) {
            timer = RESULT_TICKS - 12;     // a missed putt: on with it
        } else {
            var c = s == course.SAND ? 9 : s == course.DEEP ? 8 : s == course.GREEN ? 10 : 7;
            hud.say(WORDS[s], "", ball.yards(), hud.YDS, RESULT_TICKS, c);
        }
    }
    if (strokes >= MAXSTROKES) {
        scores[holeN] = MAXSTROKES;
        scene = HOLED;
        hud.say("PICKED UP", "", MAXSTROKES, hud.STROKES, HOLED_TICKS, 8);
    }
}

var WORDS = ["", "FAIRWAY", "ROUGH", "IN THE WOODS", "ON THE GREEN", "FRINGE", "TEE", "BUNKER", "WATER"];
var SCORE_WORDS = ["ALBATROSS", "EAGLE", "BIRDIE", "PAR", "BOGEY", "DOUBLE BOGEY", "TRIPLE BOGEY"];

// The ball is in the hole: the score's name, the records, the achievements
function holed() {
    scene = HOLED;
    sfx(SFX.cup);
    var p = course.par[course.cur], d = strokes - p;
    scores[holeN] = strokes;
    var w = "", c = 7;
    if (strokes == 1) {
        w = "HOLE IN ONE!";
        ach.earn(ACH.ace);
    } else if (d >= -3 && d <= 3) {
        w = SCORE_WORDS[d + 3];
    }
    if (d < 0) {
        c = 10;
        sfx(SFX.cheer);
        ach.earn(ACH.birdie);
        if (d <= -2)
            ach.earn(ACH.eagle);
    } else if (d > 0) {
        c = 8;
    }
    hud.say(w, "", strokes, hud.STROKES, HOLED_TICKS, c);
    var b = flr(dget(R_HOLE + holeN));
    if (b == 0 || strokes < b)
        dset(R_HOLE + holeN, strokes);
}

// Dropped by the water where the ball last crossed its edge, a little
// further back toward where it was struck
function drop() {
    var x = ball.dryX, y = ball.dryY;
    var dx = ball.fromX - x, dy = ball.fromY - y;
    var d = course.pixels(dx, dy);
    if (d > 0.5) {
        dx = dx / d;
        dy = dy / d;
    } else {
        dx = 0.0;
        dy = 1.0;
    }
    for (var i = 0; i < 60 && course.surface(x, y) == course.WATER; i++) {
        x += dx;
        y += dy;
    }
    x += dx * 2.0;
    y += dy * 2.0;
    if (course.surface(x, y) == course.WATER || !course.inside(x, y)) {
        x = ball.fromX;
        y = ball.fromY;
    }
    ball.place(x, y);
}

// After the word on a holed ball: the scorecard in a round, the next hole
// in practice
function afterHole() {
    if (practice) {
        enterHole((holeN + 1) % course.HOLES);
        return;
    }
    scene = CARD;
    if (holeN == course.HOLES - 1)
        finishRound();
}

// The ninth hole is done: the board, the records, the achievements
function finishRound() {
    var total = 0;
    for (var i = 0; i < course.HOLES; i++)
        total += scores[i];
    finished = true;
    boardRank = score.submit(BOARD.meadow, total);
    var b = flr(dget(R_BEST));
    newBest = b == 0 || total < b;
    if (newBest)
        dset(R_BEST, total);
    dset(R_ROUNDS, flr(dget(R_ROUNDS)) + 1);
    if (total < course.parSum)
        ach.earn(ACH.under);
    if (fairwayHoles > 0 && fairways == fairwayHoles)
        ach.earn(ACH.fairways);
}

// On from the scorecard
function nextHole() {
    if (finished)
        toTitle();
    else
        enterHole(holeN + 1);
}

// ---- drawing ------------------------------------------------------------------

// The picture (drawn again over a few ticks when the camera moved), the
// ball and the aim over it, then the title or the HUD
function draw() {
    if (scene == LOAD || view.render())
        return;                    // the screen keeps the last picture meanwhile
    view.draw();
    if (scene == TITLE) {
        title.draw();
        return;
    }
    if (scene == AIM && swing.phase == swing.IDLE) {
        if (swing.club == swing.PUTTER) {
            var px = course.pixels(course.pinX[course.cur] - ball.x, course.pinY[course.cur] - ball.y);
            view.drawLine(ball.x, ball.y, aimA, px);
            view.drawAim(ball.x, ball.y, aimA, 0.0, false);
        } else {
            view.drawAim(ball.x, ball.y, aimA, swing.reach(swing.club, lie) / course.YARDS, guide);
        }
    }
    if (scene != INTRO && scene != CARD)
        view.drawBall();
    hud.draw();
}
