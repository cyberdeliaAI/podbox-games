// stress: plays Bubble Beat by itself and checks the board's invariants,
// for tools/bubblebeat_stress.py. It isn't part of the game: the tool
// copies it into a scratch copy of the cart as stress.js and makes
// main.js's update() call tick() first.
//
// Each tick it checks the board as the last tick left it, then plays: it
// starts the level it was given, aims and shoots, goes on to the next
// level after a clear and starts the first again after a loss. All of its
// own work runs inside one prof() section, stress_play on a tick that
// starts in play and stress_idle on any other, so the tool can take it out
// of the units it reports.
//
// The tool sets it through pbgvm's --setting, read with sys.setting():
// stress_level, stress_mode (0 blind, 1 smart), stress_every (ticks
// between shots) and stress_ticks (the run's length, for the last summary).

const BLIND = 0, SMART = 1;
const REPORT = 100;                // ticks between summary lines
const SHOW = 30;                   // problems printed in full
const RESTART = 50;                // ticks on an end panel before going on
const ANGLES = 41;                 // aims the smart player tries

var goal = 1;
var mode = SMART;
var every = 20;
var last = 0;
var ready = false;
var gen = new Int32Array(2);

var ticks = 0, waitEnd = 0, untilShot = 0, waiting = 0;
var shots = 0, pops = 0, clears = 0, losses = 0, drops = 0, onBeat = 0;
var topLevel = 0, maxBalls = 0, lastPoints = 0, lastDrop = 0;
var violations = 0, warnings = 0, shown = 0;

var tally = new Int32Array(9);
var rowTally = new Int32Array(16);
var scratch = new Uint8Array(24 * 16);

// ---- a tick --------------------------------------------------------------------

// Called first thing in update()
function tick() {
    var inPlay = scene == PLAY;
    if (inPlay)
        prof("stress_play");
    else
        prof("stress_idle");
    if (!ready)
        setup();
    ticks++;
    if (inPlay) {
        checkBoard();
        notice();
        shoot();
    } else {
        between();
    }
    if (ticks % REPORT == 0 || ticks == last)
        report();
    prof();
}

function setup() {
    var v = sys.setting("stress_level");
    if (v != null)
        goal = max(1, flr(v));
    v = sys.setting("stress_mode");
    if (v != null)
        mode = flr(v);
    v = sys.setting("stress_every");
    if (v != null)
        every = max(1, flr(v));
    v = sys.setting("stress_ticks");
    if (v != null)
        last = flr(v);
    rng.seed(gen, 1 + rnd(30000));
    ready = true;
}

// Off the level: start it, or go on once the end panel has shown
function between() {
    if (scene == TITLE) {
        points = 0;
        startOver(goal);
        return;
    }
    if (waitEnd == 0) {
        if (scene == CLEAR)
            clears++;
        else
            losses++;
    }
    waitEnd++;
    if (waitEnd < RESTART)
        return;
    if (scene == CLEAR) {
        startOver(level + 1);
    } else {
        points = 0;
        startOver(goal);
    }
}

function startOver(n) {
    waitEnd = 0;
    untilShot = every;
    lastPoints = points;
    lastDrop = 0;
    startLevel(n);
    if (n > topLevel)
        topLevel = n;
}

// What the last tick did
function notice() {
    if (points > lastPoints)
        pops++;
    lastPoints = points;
    if (board.drop > lastDrop)
        drops += board.drop - lastDrop;
    lastDrop = board.drop;
    if (board.total > maxBalls)
        maxBalls = board.total;
}

function report() {
    printh("STRESS ticks " + ticks + " shots " + shots + " pops " + pops +
           " onbeat " + onBeat + " clears " + clears + " losses " + losses +
           " drops " + drops + " level " + topLevel + " balls " + maxBalls +
           " points " + points + " violations " + violations + " warnings " + warnings);
}

// ---- the invariants ------------------------------------------------------------

// Every rule board.js keeps between ticks
function checkBoard() {
    var BW = board.BW, BH = board.BH;
    fill(tally, 0);
    fill(rowTally, 0);
    var total = 0;
    for (var x = 0; x < BW; x++)
        if (board.col[x] != board.CEIL || board.occ[x] != 1)
            fail("ceiling", 0, x);
    for (var x = 0; x < BW; x++)
        if (board.occ[(BH - 1) * BW + x] != 0)
            fail("floor", BH - 1, x);
    for (var r = 0; r < board.ROWS; r++) {
        var row = (r + 1) * BW, o = r & 1;
        // the cells no bubble of this row covers
        if (o == 1 && (board.occ[row] != 0 || board.occ[row + BW - 1] != 0))
            fail("padding", r, -1);
        for (var c = 0; c < board.width(r); c++) {
            var i = row + c * 2 + o, v = board.col[i];
            if (v != board.col[i + 1])
                fail("halves", r, c);
            if ((v != 0) != (board.occ[i] == 1) || board.occ[i] != board.occ[i + 1])
                fail("occ", r, c);
            if (v == 0)
                continue;
            if (v > 8)
                fail("colour", r, c);
            else
                tally[v]++;
            rowTally[r]++;
            total++;
        }
    }
    for (var v = 1; v <= 8; v++)
        if (tally[v] != board.counts[v])
            fail("counts", -1, v);
    for (var r = 0; r < board.ROWS; r++)
        if (rowTally[r] != board.rowN[r])
            fail("rows", r, -1);
    if (total != board.total)
        fail("total", -1, -1);
    // nothing hangs from nothing
    copy(scratch, 0, board.occ, 0, BW * BH);
    grid.fill(scratch, BW, 0, 0, 0);
    var loose = scratch.indexOf(1);
    if (loose >= 0)
        fail("loose", loose / BW - 1, loose % BW);
    if (board.lowest() > board.LINE)
        fail("line", -1, -1);
    if (board.total > 0 && (!board.has(launcher.cur) || !board.has(launcher.nxt)))
        fail("loaded", launcher.cur, launcher.nxt);
    if (press < 0.0 || press >= 1.0)
        fail("press", -1, -1);
}

function fail(code, r, c) {
    violations++;
    if (shown >= SHOW)
        return;
    shown++;
    printh("VIOLATION " + code + " tick " + frame() + " level " + level + " r " + r + " c " + c +
           " total " + board.total + " drop " + board.drop);
}

// ---- the player ----------------------------------------------------------------

function shoot() {
    if (launcher.flying || intro > INTRO - 16)
        return;
    if (untilShot > 0) {
        untilShot--;
        return;
    }
    if (mode == SMART) {
        // with a beat, wait for it, a beat at most
        if (rhythm.locked && rhythm.phase() > 0.08 && waiting < 40) {
            waiting++;
            return;
        }
        aimSmart();
    } else {
        launcher.aim = launcher.LO + rng.rnd(gen, launcher.HI - launcher.LO);
    }
    waiting = 0;
    var p = rhythm.locked ? beat.clock() : -1;
    if (launcher.fire(p)) {
        shots++;
        if (launcher.mult > 1)
            onBeat++;
        untilShot = every - 1;
    }
}

// Tries ANGLES aims with each of the two bubbles: where each would come to
// rest, and how big a group it would make there. A pop wins, the bigger
// the better; then a pair; then the highest place.
function aimSmart() {
    var best = -1, bestAim = 0.25, bestSwap = false;
    for (var pass = 0; pass < 2; pass++) {
        var c = pass == 0 ? launcher.cur : launcher.nxt;
        if (pass == 1 && c == launcher.cur)
            break;
        for (var i = 0; i < ANGLES; i++) {
            var a = launcher.LO + (launcher.HI - launcher.LO) * i / (ANGLES - 1.0);
            var at = restsAt(a);
            if (at < 0)
                continue;
            var r = at >> 4, cc = at & 15;
            board.put(r, cc, c);
            var n = board.group(r, cc);
            board.take(r, cc);
            var sc = (n >= 3 ? 100000 + n * 1000 : n == 2 ? 50000 : 0) + (20 - r) * 10 - pass;
            if (sc > best) {
                best = sc;
                bestAim = a;
                bestSwap = pass == 1;
            }
        }
    }
    if (bestSwap)
        launcher.swap();
    launcher.aim = bestAim;
}

// Where a bubble fired at aim a would come to rest, flown as fly() flies it
function restsAt(a) {
    var ca = cos(a), sa = sin(a);
    var x = launcher.X + ca * launcher.MUZZLE, y = launcher.Y + sa * launcher.MUZZLE;
    var dx = ca * launcher.SPEED * 0.5, dy = sa * launcher.SPEED * 0.5;
    for (var s = 0; s < 200; s++) {
        x += dx;
        y += dy;
        if (x < launcher.LEFT) {
            x = launcher.LEFT * 2.0 - x;
            dx = -dx;
        } else if (x > launcher.RIGHT) {
            x = launcher.RIGHT * 2.0 - x;
            dx = -dx;
        }
        if (board.touches(x, y)) {
            var at = board.snap(x, y, 1);
            return at >= 0 ? at : board.snap(x, y, 2);
        }
    }
    return -1;
}
