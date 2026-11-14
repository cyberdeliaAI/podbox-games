// stress: plays Sloop by itself and checks it, for tools/sloop_stress.py.
// It isn't part of the game: the tool copies it into a scratch copy of the
// cart as stress.js and makes main.js's update() call tick() first.
//
// It starts a game, plays and starts another when one is over. Its own
// work runs inside prof() sections named stress, so the tool can take it
// out of the units it reports.
//
// The tool sets it through pbgvm's --setting: stress_mode (0 blind: the
// tool's own wheel turns, 1 smart: swings for each block in turn, 2 still:
// never touches it) and stress_ticks (the run's length).

const REPORT = 100;
const SHOW = 30;

var modeIs = 1, last = 0;
var ticks = 0, violations = 0, shown = 0;
var games = 0, bestPoints = 0, bestRound = 0, smashedAll = 0, triplesAll = 0, goldsAll = 0;
var heartsAll = 0, bestComboAll = 1, lastPoints = 0, lastHearts = 3, playTicks = 0, listenTicks = 0;

// Called first thing in update()
function tick() {
    prof("stress");
    ticks++;
    if (ticks == 1)
        setup();
    if (scene == TITLE && ticks > 2) {
        startGame();
        games++;
        lastPoints = 0;
        lastHearts = HEARTS;
    } else if (scene == OVER && sceneTicks > 40) {
        tally();
        startGame();
        games++;
        lastPoints = 0;
        lastHearts = HEARTS;
    } else if (scene == PLAY || scene == CLEAR) {
        check();
        if (modeIs == 1)
            smart();
    }
    if (ticks % REPORT == 0 || ticks == last)
        report();
    prof();
}

// The tool's settings, read once
function setup() {
    var v = sys.setting("stress_mode");
    if (v != null)
        modeIs = flr(v);
    v = sys.setting("stress_ticks");
    if (v != null)
        last = flr(v);
}

// A game over: its numbers into the run's
function tally() {
    bestPoints = max(bestPoints, points);
    bestRound = max(bestRound, round);
    smashedAll += smashedN;
    triplesAll += triples;
    goldsAll += golds;
    bestComboAll = max(bestComboAll, bestCombo);
}

// ---- the player ---------------------------------------------------------------

// Swing for the block landing next, to be there on its beat. A heavy
// block it waits for a little short of, then swings through on the beat,
// for the triple; a light one it just meets, with speed.
function smart() {
    var now = rhythm.now();
    var best = -1, soonest = 99999;
    for (var i = 0; i < blocks.MAX; i++) {
        if (blocks.on[i] == 0 || blocks.br[i] < ball.L - blocks.PASSED)
            continue;
        var left = blocks.bt[i] - now;
        if (left < -150)
            continue;
        if (left < soonest) {
            soonest = left;
            best = i;
        }
    }
    if (best < 0) {
        ball.vel -= ball.vel * 0.05;
        return;
    }
    var d = blocks.ba[best] - ball.ang;
    d -= flr(d + 0.5);
    var ticksLeft = max(1, soonest * rate() / 1000);
    var side = d < 0.0 ? -1.0 : 1.0;
    if (blocks.bd[best] != 0) {
        if (ticksLeft > 3) {
            // wait a tenth of a turn short of it
            var w = d - side * 0.1;
            ball.vel += mid(-0.006, w / max(1, ticksLeft - 3) - ball.vel, 0.006);
        } else {
            ball.vel = side * 0.04;
        }
        return;
    }
    // the speed that gets there on the beat, but never slower than enough
    // to hit hard once it's close
    var want = d / ticksLeft;
    if (ticksLeft < 10 && abs(want) < 0.03)
        want = side * 0.03;
    ball.vel += mid(-0.004, want - ball.vel, 0.004);
}

// ---- the checks ---------------------------------------------------------------

// The invariants, every tick of play
function check() {
    if (hearts < 0 || hearts > HEARTS)
        fail("hearts");
    if (hearts < lastHearts)
        heartsAll += lastHearts - hearts;
    lastHearts = hearts;
    if (combo < 1 || combo > COMBO_MAX)
        fail("combo");
    if (points < lastPoints)
        fail("points");
    lastPoints = points;
    var n = 0;
    for (var i = 0; i < blocks.MAX; i++) {
        if (blocks.on[i] == 0)
            continue;
        n++;
        if (blocks.bh[i] < 1 || blocks.bk[i] > 2)
            fail("block");
        if (blocks.ba[i] < 0.0 || blocks.ba[i] >= 1.0)
            fail("angle");
        if (blocks.br[i] <= blocks.HUB || blocks.br[i] > blocks.R_OUT + 20.0)
            fail("radius");
        if (blocks.br[i] < ball.L - blocks.PASSED - 0.5 && blocks.bp[i] == 0)
            fail("unmissed");
    }
    if (n != blocks.count)
        fail("count");
    if (waiting && n > 0)
        fail("waiting");
    if (ball.ang < 0.0 || ball.ang >= 1.0)
        fail("ball");
    if (abs(ball.vel) > ball.VMAX + 0.0001)
        fail("speed");
    if (rhythm.listening) {
        listenTicks++;
        if (rhythm.own - rhythm.listenFrom > rhythm.LISTEN_MS + 200)
            fail("listen");
        if (rate() != 25 && rhythm.own - rhythm.listenFrom > 100)
            fail("rate");
    } else if (rate() != 33 && rhythm.own > 200) {
        fail("rate");
    }
    playTicks++;
}

// A check that didn't hold: counted, and the first few printed
function fail(code) {
    violations++;
    if (shown >= SHOW)
        return;
    shown++;
    printh("VIOLATION " + code + " tick " + frame() + " scene " + scene + " hearts " + hearts +
           " combo " + combo + " count " + blocks.count + " ang " + ball.ang + " vel " + ball.vel);
}

// A STRESS line for the tool
function report() {
    var live = scene == OVER ? 0 : 1;
    printh("STRESS ticks " + ticks + " games " + games + " points " + max(bestPoints, points * live) +
           " round " + max(bestRound, round) + " smashed " + (smashedAll + smashedN * live) +
           " triples " + (triplesAll + triples * live) + " golds " + (goldsAll + golds * live) +
           " hearts " + heartsAll + " combo " + max(bestComboAll, bestCombo) +
           " listen " + listenTicks + " play " + playTicks + " violations " + violations);
}
