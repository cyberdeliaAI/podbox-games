// stress: plays Marble Chain by itself and checks the chain's invariants,
// for tools/marbles_stress.py. It isn't part of the game: the tool copies
// it into a scratch copy of the cart as stress.js and makes main.js's
// update() call tick() first.
//
// Each tick it checks the chain as the last tick left it, then plays: it
// starts the level it was given, shoots every few ticks and starts the
// level again after a win or a loss. All of its own work runs inside one
// prof() section, stress_play on a tick that starts in play and
// stress_idle on any other, so the tool can take it out of the units it
// reports and keep only the ticks of play.
//
// The tool sets it through pbgvm's --setting, read with sys.setting():
// stress_level (1 to 6), stress_mode (0 blind, 1 smart, 2 still),
// stress_every (ticks between shots) and stress_ticks (the run's length,
// for the last summary).

const BLIND = 0, SMART = 1, STILL = 2;
const REPORT = 100;                // ticks between summary lines
const SHOW = 30;                   // problems printed in full; the rest are only counted
const RESTART = 45;                // ticks on an end panel before the level starts again
const REACH = 6.3;                 // a shot strikes a ball this close to its line (hitTest's 40, rooted)

var goal = 0;                    // the level played, from 0
var mode = SMART;
var every = 20;                    // ticks between shots
var last = 0;                      // the run's last tick, 0 when not known
var ready = false;
var gen = new Int32Array(2);       // the shooter's own random numbers, apart from the game's

var ticks = 0;
var waitEnd = 0;                   // ticks spent on the current end panel
var untilShot = 0;

// what happened, for the summary
var shots = 0, hits = 0, wins = 0, losses = 0, pointsSum = 0;
var maxCombo = 0, maxBalls = 0, slows = 0, backs = 0, bombs = 0;
var violations = 0, warnings = 0, shown = 0;
var lastStreak = 0, lastMsg = 0;

var tally = new Int32Array(8);
var vis = new Uint8Array(chain.MAXB);
var bx = new FixArray(chain.MAXB), by = new FixArray(chain.MAXB);

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
        checkChain();
        notice();
        shoot();
    } else {
        between();
    }
    if (ticks % REPORT == 0 || ticks == last)
        report();
    prof();
}

// The settings the tool passed
function setup() {
    var v = sys.setting("stress_level");
    if (v != null)
        goal = mid(0, flr(v) - 1, levels.COUNT - 1);
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

// Off the level: start it, or start it again once the end panel has shown
function between() {
    if (scene == TITLE) {
        startOver();
        return;
    }
    if (waitEnd == 0) {
        if (scene == WON)
            wins++;
        else
            losses++;
        pointsSum += points;
    }
    waitEnd++;
    if (waitEnd >= RESTART)
        startOver();
}

function startOver() {
    waitEnd = 0;
    lastStreak = 0;
    lastMsg = 0;
    untilShot = every;
    startLevel(goal);
}

// What the last tick did, read from main.js's own state
function notice() {
    // streak counts shots whose own landing popped, and drops to 0 on a miss
    if (streak > lastStreak)
        hits += streak - lastStreak;
    else if (streak < lastStreak)
        hits += streak;
    lastStreak = streak;
    if (chain.combo > maxCombo)
        maxCombo = chain.combo;
    if (chain.n > maxBalls)
        maxBalls = chain.n;
    // gotPower() sets these after play() has counted them down, so a power
    // that went off last tick shows as the full count
    if (slow == SLOW_TICKS)
        slows++;
    if (back == BACK_TICKS)
        backs++;
    // a bomb only shows in its message, which a chain or streak message
    // in the same tick hides: this count is a floor
    if (msgUntil != lastMsg) {
        lastMsg = msgUntil;
        if (msg == "BOMB!")
            bombs++;
    }
}

function report() {
    printh("STRESS ticks " + ticks + " shots " + shots + " hits " + hits +
           " wins " + wins + " losses " + losses + " points " + pointsSum +
           " combo " + maxCombo + " balls " + maxBalls + " slow " + slows +
           " back " + backs + " bomb " + bombs +
           " violations " + violations + " warnings " + warnings);
}

// ---- the invariants ------------------------------------------------------------

// Every rule chain.js keeps between ticks; see CLAUDE.md
function checkChain() {
    var n = chain.n;
    if (n < 0 || n > chain.MAXB || chain.left < 0)
        fail("count", -1);
    fill(tally, 0);
    for (var i = 0; i < n; i++) {
        var c = chain.col[i];
        if (c < 1 || c > chain.colours)
            fail("colour", i);
        else
            tally[c]++;
        var q = chain.st[i];
        if (q == chain.ARRIVING) {
            if (chain.tm[i] < 1 || chain.tm[i] > chain.ARRIVE || chain.busy < chain.tm[i])
                fail("arriving", i);
        } else if (q == chain.POPPING) {
            if (chain.tm[i] < 1 || chain.tm[i] > chain.POP || chain.busy < chain.tm[i])
                fail("popping", i);
            if (chain.pw[i] != 0)
                fail("power", i);
        } else if (q != chain.ROLL) {
            fail("state", i);
        }
        if (chain.s[i] < 0.0 - chain.D)
            fail("behind", i);
        if (i > 0) {
            var g = chain.s[i] - chain.s[i - 1];
            if (g < 0.0)
                fail("order", i);
            if (g > chain.TOUCH && chain.gap[i] == 0)
                fail("gap", i);
        }
    }
    for (var c = 1; c < 8; c++)
        if (tally[c] != chain.counts[c])
            fail("counts", -1);
    if (chain.front() >= chain.L - 1)
        fail("front", -1);

    // rewind() runs first in the next play(); a ball it pushes behind -D
    // goes back to the tunnel, which only a rolling ball should
    if (back > 0) {
        var v = BACK_SPEED * (33.0 / rate());
        for (var i = 0; i < n; i++)
            if (chain.st[i] != chain.ROLL && chain.s[i] - v < 0.0 - chain.D)
                warn("recycle", i);
    }
}

function fail(code, i) {
    violations++;
    problem("VIOLATION", code, i);
}

function warn(code, i) {
    warnings++;
    problem("WARNING", code, i);
}

// One problem, in full while there have been few
function problem(kind, code, i) {
    if (shown >= SHOW)
        return;
    shown++;
    var line = kind + " " + code + " tick " + frame() + " level " + (lvl + 1) +
               " n " + chain.n + " left " + chain.left + " busy " + chain.busy;
    if (i >= 0)
        line = line + " i " + i + " s " + chain.s[i] + " col " + chain.col[i] +
               " st " + chain.st[i] + " tm " + chain.tm[i] + " gap " + chain.gap[i] +
               " pw " + chain.pw[i];
    printh(line);
}

// ---- the shooter ---------------------------------------------------------------

// Fires every few ticks, when the gun has a ball ready
function shoot() {
    if (mode == STILL)
        return;
    if (untilShot > 0) {
        untilShot--;
        return;
    }
    if (gun.cool > 0)
        return;
    if (mode == SMART) {
        if (!aimSmart()) {
            untilShot = 3;
            return;
        }
    } else {
        gun.aim = rng.rnd(gen, 1.0);
    }
    var before = flying();
    gun.fire();
    if (flying() > before) {
        shots++;
        untilShot = every - 1;
    }
}

// Balls in flight
function flying() {
    var m = 0;
    for (var i = 0; i < gun.MAXS; i++)
        m += gun.on[i];
    return m;
}

// Aims where the loaded ball, or the next one after a swap, does most:
// a pop first, nearest the hole; then a pair, nearest the hole; then
// anywhere, furthest from it. False when no ball of either colour is in
// clear view.
function aimSmart() {
    var n = chain.n;
    for (var i = 0; i < n; i++) {
        vis[i] = 0;
        var k = flr(chain.s[i]);
        if (chain.s[i] < chain.MOUTH || k >= chain.L || chain.st[i] == chain.POPPING)
            continue;
        var x = chain.PX[k], y = chain.PY[k];
        if (x < 0 || x > 159 || y < 0 || y > 119)
            continue;
        vis[i] = 1;
        bx[i] = x - gun.CX;
        by[i] = y - gun.CY;
    }
    var best = 0, bestAim = 0.0, bestSwap = false;
    for (var pass = 0; pass < 2; pass++) {
        var c = pass == 0 ? gun.cur : gun.nxt;
        if (pass == 1 && c == gun.cur)
            break;
        for (var i = 0; i < n; i++) {
            if (vis[i] == 0 || chain.col[i] != c)
                continue;
            var a = atan2(bx[i], by[i]);
            var j = firstHit(cos(a), sin(a), n);
            if (j < 0)
                continue;
            var run = runIfShot(j, c);
            var sc;
            if (run >= 3)
                sc = 3000000 + j * 1000 + run;
            else if (run == 2)
                sc = 2000000 + j * 1000;
            else
                sc = 1000000 + (chain.MAXB - j) * 1000;
            sc -= pass;
            if (sc > best) {
                best = sc;
                bestAim = a;
                bestSwap = pass == 1;
            }
        }
    }
    if (best == 0)
        return false;
    if (bestSwap)
        gun.swap();
    gun.aim = bestAim;
    return true;
}

// The first ball in view along the line from the gun, or -1
function firstHit(ux, uy, n) {
    var hit = -1, near = 999.0;
    for (var j = 0; j < n; j++) {
        if (vis[j] == 0)
            continue;
        var along = bx[j] * ux + by[j] * uy;
        if (along < gun.MUZZLE || along >= near)
            continue;
        var off = bx[j] * uy - by[j] * ux;
        if (off < REACH && off > 0.0 - REACH) {
            near = along;
            hit = j;
        }
    }
    return hit;
}

// The run of colour c a ball shot into ball j would end up in
function runIfShot(j, c) {
    if (chain.col[j] == c)
        return 1 + runLen(j, c);
    var r = 1;
    if (j + 1 < chain.n && chain.col[j + 1] == c && chain.s[j + 1] - chain.s[j] <= chain.TOUCH)
        r = max(r, 1 + runLen(j + 1, c));
    if (j > 0 && chain.col[j - 1] == c && chain.s[j] - chain.s[j - 1] <= chain.TOUCH)
        r = max(r, 1 + runLen(j - 1, c));
    return r;
}

// The balls in the run of colour c through ball i, as match() counts them
function runLen(i, c) {
    var a = i, b = i, n = chain.n;
    while (a > 0 && chain.col[a - 1] == c && chain.st[a - 1] != chain.POPPING &&
           chain.s[a] - chain.s[a - 1] <= chain.TOUCH)
        a--;
    while (b < n - 1 && chain.col[b + 1] == c && chain.st[b + 1] != chain.POPPING &&
           chain.s[b + 1] - chain.s[b] <= chain.TOUCH)
        b++;
    return b - a + 1;
}
