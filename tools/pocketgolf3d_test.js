// stress: plays Pocket Golf 3D by itself and checks it, for
// tools/pocketgolf3d_test.py. It isn't part of the game: the tool copies it
// into a scratch copy of the cart as stress.js and makes main.js's update()
// call tick() first.
//
// Each tick it checks the game as the last tick left it, then plays: it
// skips the panels as soon as the picture behind them is drawn, and takes
// each shot once the picture is ready. The smart way aims where the game
// aims, picks the game's club and sets the power for the distance, a putt
// for the slope along its line too, with a little error on full shots.
// The wild way aims anywhere near, with any club, any power and any error.
// With stress_mode 2 it only checks: the tool presses the buttons and turns
// the wheel through pbgvm, so the real swing meter is played.
//
// Its work runs inside one prof() section, so the tool can take it out of
// the units. Its name tells the tool about the ticks: stress_d when the
// picture is being drawn as this tick starts, else stress_p; and an l on
// the end when a hole is loading. A tick works on the picture if it is
// under way as the tick starts or as the next starts (a camera moved in
// update() is drawn in the same tick's draw()).
//
// Settings (pbgvm --setting): stress_mode (0 smart, 1 wild, 2 input),
// stress_rounds (rounds to play, then quit()), stress_hole (practice from
// that hole instead, for stress_rounds times nine holes), stress_ticks
// (the run's length, for the totals at its end if it gets there first).
// For pictures (tools/screenshots.py, tools/gifs.py): stress_show 1 runs
// the swing meter as a player would, its marker stopped where the shot
// wants it, and lets the words after a shot stay their time; stress_hold
// is a scene (4 the word after a shot, 5 holed, 6 the scorecard) the
// pilot waits in rather than going on.

const SHOW = 30;                   // problems printed at most
const STALL = 900;                 // ticks a scene may last, but the title and aiming with input
const BUSY_MAX = 10;               // ticks in a row the picture may take (two pictures: a cut as one finishes)
const FLIGHT_MAX = 1300;           // ticks a shot may take

var ticks = 0, violations = 0, shown = 0;
var mode = 0, roundsWanted = 1, practiceFrom = -1, runTicks = 0;
var show = 0, hold = -1;
var wantP = 0.0, wantE = 0.0;      // the shot the meter is being run for
var holes = 0, rounds = 0, total = 0, best = 0, strokesAll = 0, parAll = 0;
var shotsN = 0, puttsN = 0, wet = 0, outs = 0, treeShots = 0, picked = 0, aces = 0;
var busy = 0, busyMax = 0, renders = 0;
var flightT = 0, flightMax = 0;
var lastScene = -1, sceneT = 0;
var lastState = 0;
var holeDone = false;
var struck = 0;                    // strokes once the last shot was struck

var NAMES = ["stress_p", "stress_d", "stress_pl", "stress_dl"];

// Called first thing in update()
function tick() {
    var drawing = view.dirty || view.stage != 0;
    var k = drawing ? 1 : 0;
    if (scene == LOAD)
        k += 2;
    prof(NAMES[k]);
    ticks++;
    if (ticks == 1)
        configure();
    check(drawing);
    if (mode != 2)
        play();
    if (runTicks > 0 && ticks == runTicks - 1)
        report();
    prof();
    // a hole the harness began to load just now loads its first step in
    // this tick's update(): a mark for the tool, costing next to nothing
    if (scene == LOAD && k < 2) {
        prof("stress_l");
        prof();
    }
}

// The settings, once
function configure() {
    var v = sys.setting("stress_mode");
    if (v != null)
        mode = v;
    v = sys.setting("stress_rounds");
    if (v != null)
        roundsWanted = v;
    v = sys.setting("stress_hole");
    if (v != null)
        practiceFrom = v;
    v = sys.setting("stress_ticks");
    if (v != null)
        runTicks = v;
    v = sys.setting("stress_show");
    if (v != null)
        show = v;
    v = sys.setting("stress_hold");
    if (v != null)
        hold = v;
}

// A problem: printed (the first SHOW of them) and counted
function bad(what, n) {
    violations++;
    if (shown < SHOW) {
        shown++;
        printh("VIOLATION tick " + ticks + " scene " + scene + " hole " + holeN + " " + what + " " + n);
    }
}

// Every check, on the state the last tick left
function check(drawing) {
    if (scene < TITLE || scene > LOAD)
        bad("scene", scene);
    if (scene != lastScene) {
        if (scene == FLIGHT)
            struck = strokes;
        if (lastScene == FLIGHT) {
            // the shot is over: how long it took, and what it met
            flightMax = max(flightMax, flightT);
            if (ball.hitTree)
                treeShots++;
            if (strokes > struck) {
                if (ball.x == ball.fromX && ball.y == ball.fromY)
                    outs++;
                else
                    wet++;
            }
        }
        lastScene = scene;
        sceneT = 0;
    }
    sceneT++;
    if (scene != TITLE && !(mode == 2 && (scene == AIM || scene == CARD)) && sceneT > STALL)
        bad("stalled", sceneT);
    if (swing.phase < swing.IDLE || swing.phase > swing.DONE)
        bad("phase", swing.phase);
    if (swing.club < 0 || swing.club > swing.PUTTER)
        bad("club", swing.club);
    if (aimA < 0.0 || aimA >= 1.0)
        bad("aim", aimA);
    // the picture: never long in the drawing (on hold while a hole loads)
    if (scene == LOAD) {
        // not counted
    } else if (drawing) {
        if (busy == 0)
            renders++;
        busy++;
        busyMax = max(busyMax, busy);
        if (busy > BUSY_MAX)
            bad("picture busy", busy);
    } else {
        busy = 0;
    }
    if (view.stage < 0 || view.stage > 3)
        bad("view stage", view.stage);
    if (view.camH < 0.0 || view.camH >= 1.0)
        bad("camera heading", view.camH);
    if (scene == TITLE || scene == LOAD)
        return;
    if (course.cur != holeN || holeN < 0 || holeN >= course.HOLES)
        bad("hole loaded", course.cur);
    if (strokes < 0 || strokes > MAXSTROKES + 1)
        bad("strokes", strokes);
    for (var i = 0; i < course.HOLES; i++)
        if (scores[i] < 0 || scores[i] > MAXSTROKES)
            bad("score", scores[i]);
    ballChecks();
    if (scene == FLIGHT) {
        flightT++;
        if (flightT > FLIGHT_MAX)
            bad("flight", flightT);
    } else {
        flightT = 0;
    }
    if (scene == AIM && lie != course.surface(ball.x, ball.y))
        bad("lie", lie);
    if (scene == HOLED && !holeDone) {
        holeDone = true;
        holeOver();
    }
    if (scene != HOLED)
        holeDone = false;
    if (ball.state == ball.FLY && lastState != ball.FLY)
        shotsN++;
    lastState = ball.state;
}

// The ball: on the map, never under the ground, no faster than a drive
function ballChecks() {
    var st = ball.state;
    if (st < ball.REST || st > ball.OUT)
        bad("ball state", st);
    if (st != ball.REST && st != ball.FLY && st != ball.ROLL)
        return;
    if (ball.x < 0.0 || ball.x >= 128.0 || ball.y < 0.0 || ball.y >= 256.0) {
        bad("ball off the map", flr(ball.x) * 1000 + flr(ball.y));
        return;
    }
    if (st != ball.FLY && !course.inside(ball.x, ball.y))
        bad("ball out of bounds at rest", flr(ball.x) * 1000 + flr(ball.y));
    var g = course.ground(ball.x, ball.y);
    if (ball.z < g - 0.02)
        bad("ball under the ground", flr((g - ball.z) * 100.0));
    if (st != ball.FLY && ball.z > g + 0.02)
        bad("ball off the ground", flr((ball.z - g) * 100.0));
    if (abs(ball.vx) > 2.0 || abs(ball.vy) > 2.0 || abs(ball.vz) > 2.0)
        bad("ball speed", flr(ball.speed() * 100.0));
    if (st != ball.FLY && course.surface(ball.x, ball.y) == course.WATER)
        bad("ball on the water", st);
}

// A hole finished: its score, and a holed ball near the pin
function holeOver() {
    var j = course.cur;
    var s = scores[holeN];
    if (s < 1 || s > MAXSTROKES)
        bad("hole's score", s);
    if (ball.state == ball.HOLED) {
        if (abs(ball.x - course.pinX[j]) > 0.5 || abs(ball.y - course.pinY[j]) > 0.5)
            bad("holed away from the pin", flr(ball.x) * 1000 + flr(ball.y));
        if (s == 1)
            aces++;
        // holed: the hole's best saved, and no worse than this
        var b = flr(dget(R_HOLE + holeN));
        if (b < 1 || b > s)
            bad("hole's best", b);
    } else {
        if (strokes < MAXSTROKES)
            bad("over without holing", strokes);
        picked++;
    }
    holes++;
    strokesAll += s;
    parAll += course.par[j];
    printh("HOLE " + (holeN + 1) + " par " + course.par[j] + " strokes " + s + " wind " + windMph);
}

// Playing: through the panels, and a shot when the picture is ready
function play() {
    if (scene == TITLE) {
        if (rounds >= roundsWanted) {
            report();
            quit();
            return;
        }
        if (ticks > 3) {
            title.chosen = practiceFrom >= 0 ? 1 : 0;
            title.pick = max(0, practiceFrom);
            startGame();
        }
        return;
    }
    var ready = !view.dirty && view.stage == 0;
    if (practice && holes >= roundsWanted * course.HOLES) {
        report();
        quit();
        return;
    }
    if (scene == hold) {
        timer = 0;
        return;
    }
    if (scene == INTRO && ready) {
        timer = show ? max(timer, INTRO_TICKS - 20) : INTRO_TICKS;
    } else if (scene == RESULT) {
        if (!show)
            timer = RESULT_TICKS;
    } else if (scene == HOLED) {
        if (!show)
            timer = HOLED_TICKS;
    } else if (scene == AIM && show && swing.phase != swing.IDLE) {
        meter();
    } else if (scene == CARD) {
        if (finished) {
            rounds++;
            var t = 0;
            for (var i = 0; i < course.HOLES; i++)
                t += scores[i];
            total += t;
            best = best == 0 ? t : min(best, t);
            printh("ROUND " + rounds + " strokes " + t + " par " + course.parSum + " fairways " + fairways + " of " + fairwayHoles);
        }
        nextHole();
    } else if (scene == AIM && ready && swing.phase == swing.IDLE) {
        shot();
    }
}

// A shot, smart or wild: aim, power and error set, and struck as the meter would
function shot() {
    var j = course.cur;
    var dx = course.pinX[j] - ball.x, dy = course.pinY[j] - ball.y;
    var d = course.pixels(dx, dy);
    var p = 1.0, e = 0.0;
    if (mode == 1) {
        aimA = aimA + (rnd(1.0) - 0.5) * 0.2;
        aimA -= flr(aimA);
        swing.club = rnd(9);
        if (swing.club == swing.PUTTER)
            swing.putting(d);
        p = 0.15 + rnd(0.85);
        e = rnd(2.0) - 1.0;
    } else if (swing.club == swing.PUTTER) {
        // the distance, firmer uphill and softer down, a little past
        var along = 0.0;
        if (d > 0.1)
            along = (course.slopeX[j] * dx + course.slopeY[j] * dy) / d;
        var drag = swing.GREEN_DRAG;
        p = (d + 0.4) * (drag + ball.SLOPE * along) / (drag * swing.full);
        p = mid(0.02, p * (0.96 + rnd(0.08)), 1.0);   // a player's touch: within 4%
        puttsN++;
    } else {
        var r = swing.reach(swing.club, lie) / course.YARDS;
        if (!(teeShot && course.par[j] > 3) && d < r)
            p = mid(0.15, (d - 2.0) / r, 1.0);
        e = (rnd(2.0) - 1.0) * 0.12;
    }
    if (show) {
        // the meter run for it: started here, stopped by meter()
        wantP = p;
        wantE = e;
        swing.phase = swing.UP;
        swing.pos = 0.0;
        return;
    }
    swing.power = p;
    swing.err = e;
    swing.phase = swing.DONE;
    shoot();
}

// The meter running, as a player watches it: the power taken as the
// marker passes it, the shot struck as it comes back to the error wanted
function meter() {
    if (swing.phase == swing.UP && swing.pos + swing.speed >= wantP) {
        swing.pos = wantP;
        swing.power = wantP;
        if (swing.club == swing.PUTTER) {
            swing.err = 0.0;
            swing.phase = swing.DONE;
            shoot();
            return;
        }
        swing.phase = swing.DOWN;
    } else if (swing.phase == swing.DOWN && swing.pos - swing.speed * 1.2 <= (0.0 - wantE) * swing.WINDOW) {
        swing.pos = (0.0 - wantE) * swing.WINDOW;
        swing.err = wantE;
        swing.phase = swing.DONE;
        shoot();
    }
}

// The totals, for the tool
function report() {
    printh("STRESS ticks " + ticks + " rounds " + rounds + " holes " + holes + " strokes " + strokesAll +
           " par " + parAll + " best " + best + " shots " + shotsN + " putts " + puttsN + " picked " + picked +
           " aces " + aces + " water " + wet + " out " + outs + " trees " + treeShots + " renders " + renders + " busymax " + busyMax + " flightmax " + flightMax +
           " violations " + violations);
}
