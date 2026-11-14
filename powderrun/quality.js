// quality: how much the picture draws, stepped to what the iPod can do.
//
// As in Pocket Wings: land.draw of the full-size slope costs 20,000 to
// 30,000 units, more than a tick has on an iPod Video playing music (12,500
// at 33 ticks a second, 17,500 at 25, 22,800 at 20). So the picture comes
// in five levels: the full-size slope, fine and then coarse, at 33; then
// the half-size one, coarse, seeing as far and then less far, at 25; and
// last the same at 20. Distances here are in full-size world pixels. The
// sky and its mountains are a single copy of a picture and cost little, so
// every level has them.
//
// Auto watches the frames that run late: more than three in a second and
// it steps down a level. After a quiet spell it tries a level up on trial
// for three seconds, watched every tick and ended at two late frames; each
// failed try puts the next further off, from half a minute up to four. A
// level that holds for twenty seconds is kept (saved number 1) for the next
// run. The game runs on the same speeds at any rate.
//
// For tests, sim judges by the units each tick costs against a chosen
// iPod's budget instead of by skipped frames; the game leaves it at 0.

const LEVELS = 5;
var COARSE = [1, 2, 2, 2, 2];
var HALF = [0, 0, 1, 1, 1];
var FAR = [200, 200, 200, 150, 150];
var RATES = [33, 33, 25, 25, 20];

const AUTO = 0, FAST = 1, DETAILED = 2;
var mode = AUTO;
var level = 3;
var late = 0, calm = 0, wait = 3, probe = 0, settle = 2;
var changes = 0;

var sim = 0, simOff = 0, simLate = 0;
var BUDGETS = [12500, 17500, 22800, 46000, 61000, 76000, 175000, 232000, 290000];

// The level kept from the last run, if any
function start() {
    var kept = flr(dget(1));
    if (kept > 0 && sim == 0)
        level = min(kept - 1, LEVELS - 1);
    setLevel(level);
    changes = 0;
}

function setMode(m) {
    mode = m;
    if (m == FAST)
        setLevel(3);
    else if (m == DETAILED)
        setLevel(0);
}

function setLevel(q) {
    level = q;
    if (rate() != RATES[q])
        setrate(RATES[q]);
    settle = 2;
    late = 0;
    changes++;
}

// Once a tick
function tick() {
    if (sim > 0) {
        late += simLate;
        simLate = 0;
    } else {
        late += skipped();
    }
    if (probe > 0 && late > 1) {
        probe = 0;
        calm = 0;
        wait = mid(30, wait * 2, 240);
        setLevel(level + 1);
        settle = 1;
        return;
    }
    if (frame() % rate() != 0)
        return;
    if (settle > 0 && probe == 0) {
        settle--;
        late = 0;
        return;
    }
    if (mode == AUTO) {
        if (late > 3 && level < LEVELS - 1) {
            calm = 0;
            setLevel(level + 1);
        } else if (late == 0) {
            if (probe > 0)
                probe--;
            calm++;
            if (calm == 20 && sim == 0)
                dset(1, level + 1);
            if (calm >= wait && level > 0 && probe == 0) {
                calm = 0;
                setLevel(level - 1);
                probe = 3;
                late = 0;
            }
        } else {
            calm = 0;
        }
    }
    late = 0;
}

// At the end of draw(), for sim: did this tick cost more than it had?
function after() {
    if (sim == 0)
        return;
    var r = rate(), i = (sim - 1) * 3 + (r >= 33 ? 0 : r >= 25 ? 1 : 2);
    if (unitsnow() - simOff > BUDGETS[i])
        simLate++;
}
