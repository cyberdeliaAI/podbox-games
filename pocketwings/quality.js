// quality: how much the picture draws, stepped to what the iPod can do.
//
// The ground is by far the dearest thing drawn: land.draw of the full-size
// landscape costs about 29,000 units at its finest, more than a tick has on
// an iPod Video playing music (12,500 at 33 ticks a second, 17,500 at 25,
// 22,800 at 20). So the picture comes in five levels: the full-size
// landscape, fine and then coarse, with the far hills, at 33; then the
// half-size one, coarse, seeing as far and then less far, at 25; and last
// the same at 20. Distances here are in full-size world pixels. Auto
// watches the frames that run
// late: more than three in a second and it steps down a level. After a
// quiet spell it tries a level up, on trial for three seconds: the trial is
// watched every tick, and two late frames end it at once, so a failed try
// costs a few frames, not seconds. Each failed try puts the next further
// off, from half a minute up to four. A level that has held for twenty seconds is kept
// (saved number 1), and the next flight starts there. The game runs on the
// same speeds at any rate.
//
// For tests, sim makes it judge by the units each tick costs against a
// chosen iPod's budget instead of by the frames the player skips; the
// game itself leaves it at 0.

const LEVELS = 5;
var COARSE = [1, 2, 2, 2, 2];      // land.draw's coarse: 2 samples every other column
var HALF = [0, 0, 1, 1, 1];        // the half-size landscape
var FAR = [300, 300, 300, 200, 200];   // how far the ground is drawn, world pixels
var PANO = [1, 1, 0, 0, 0];        // the hills on the horizon
var RATES = [33, 33, 25, 25, 20];

const AUTO = 0, FAST = 1, DETAILED = 2;
var mode = AUTO;
var level = 3;                     // without a kept level, start low; Auto climbs if it can
var late = 0;
var calm = 0;                      // quiet seconds in a row
var wait = 3;                      // quiet seconds before trying a level up
var probe = 0;                     // seconds left in which a step up is on trial
var settle = 2;                    // seconds left to let a change settle
var changes = 0;

// testing only: 0 off, 1 iPod Video playing FLAC, 2 iPod Video, 3 iPod Classic
var sim = 0;
var simOff = 0;                    // units this tick that aren't the game's (the harness's)
var simLate = 0;
var BUDGETS = [12500, 17500, 22800, 46000, 61000, 76000, 175000, 232000, 290000];

// The level kept from the last flight, if any
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
    // a level up on trial ends the moment frames run late
    if (probe > 0 && late > 1) {
        probe = 0;
        calm = 0;
        wait = mid(30, wait * 2, 240);
        setLevel(level + 1);
        settle = 1;
        return;
    }
    if (frame() % rate() != 0)
        return;                    // judged once a second
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
                probe = 3;         // on trial, watched every tick
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
