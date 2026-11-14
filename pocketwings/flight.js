// flight: the aircraft, its controls and how it moves.
//
// The model is gentle on purpose: no stalls, no crashes. Turning the wheel
// banks the aircraft and the bank turns it; with the wheel left alone the
// wings level by themselves. Prev climbs and Next dives while held, and
// with neither the aircraft holds its height. Play steps through three
// speeds, eased into. The ground is looked at under the aircraft and a
// little ahead, and when it comes too close the aircraft rises over it.
//
// The speeds change the handling a little, and gently: slow, the aircraft
// turns tighter and climbs less; fast, it turns wider, the wheel banks it
// less a click and it climbs better. With Follow the ground (scenic) the
// aircraft keeps a height above the ground instead of above the water,
// rising and sinking with the hills, and Prev and Next set that height.
//
// Places are world pixels and the heading is in turns, as plane.view takes
// them: 0 east, 0.25 north. Every speed is a tick's at 33 a second, scaled
// by k for the rate the cart runs at.

const GEARS = 3;
const TURN = 0.0045;               // turns a tick at full bank
const CLIMB = 0.55, DIVE = 0.7;    // world pixels a tick up and down, at most
const CLEAR = 9.0;                 // the height kept above the ground
const SKIM = 3.0;                  // the least height above it, however steep the hill
const AHEAD = 20.0;                // how far ahead the ground is looked at...
const AHEAD_SPD = 40.0;            // ...and further, by this much a world pixel a tick of speed
const CEILING = 230.0;             // as high as it goes
const SPIN_BANK = 0.025;           // bank a wheel click, Spin steering
const LEVEL_AFTER = 30;            // ticks without the wheel before the wings level
const AGL_MIN = 10.0, AGL_MAX = 70.0;  // the heights above the ground Follow the ground keeps
const AGL_RATE = 0.4;              // world pixels a tick Prev and Next move it

var SPEEDS = [0.28, 0.5, 0.8];     // world pixels a tick
var GEAR_NAMES = ["SLOW", "CRUISE", "FAST"];

var x = 0.0, y = 0.0, z = 60.0;
var hdg = 0.0;                     // turns
var bank = 0.0;                    // -1 left wing down to 1 right wing down
var vs = 0.0;                      // climbing, world pixels a tick
var spd = 0.5, gear = 1;
var idle = 0;                      // ticks since the wheel last moved
var low = false;                   // the ground is lifting it
var gnd = 0;                       // the ground's height under it
var scenic = false;                // Follow the ground
var agl = 24.0;                    // ...the height it keeps
var climb = 0.0;                   // how fast it really rose this tick, world pixels a tick at 33

// A new flight at x0, y0, z0, heading h0, at cruise
function reset(x0, y0, z0, h0) {
    x = x0;
    y = y0;
    z = z0;
    hdg = h0;
    bank = 0.0;
    vs = 0.0;
    gear = 1;
    spd = SPEEDS[1];
    idle = 0;
    low = false;
    gnd = world.ground(x, y);
    agl = mid(AGL_MIN, z - gnd, AGL_MAX);
    climb = 0.0;
}

// A tick of flying. spin: Spin steering, else Thumb
function update(spin, k) {
    // how fast, from 0 slow to 1 fast, for the handling
    var f = mid(0.0, (spd - SPEEDS[0]) / (SPEEDS[2] - SPEEDS[0]), 1.0);

    // steering: the wheel banks, the bank turns
    if (spin) {
        var w = wheel();
        if (w != 0) {
            bank = mid(-1.0, bank + w * SPIN_BANK * (1.1 - 0.3 * f), 1.0);
            idle = 0;
        } else if (++idle > LEVEL_AFTER) {
            bank -= bank * 0.04 * k;
        }
    } else {
        // the thumb's place round the ring: right of the top banks right
        var p = wheelpos(), want = 0.0;
        if (p >= 0)
            want = mid(-1.0, -sin(p / 96.0) * 1.4, 1.0);
        bank += mid(-0.05, want - bank, 0.05) * (1.1 - 0.3 * f) * k;
    }
    hdg -= bank * TURN * (1.2 - 0.4 * f) * k;
    hdg -= flr(hdg);

    // the speed steps on Play, eased
    if (btnp(3)) {
        gear = (gear + 1) % GEARS;
        sfx(SFX.gear);
        announce(GEAR_NAMES[gear]);
    }
    spd += (SPEEDS[gear] - spd) * 0.03 * k;

    // moving: the world wraps every SIZE pixels
    x = wrap(x + cos(hdg) * spd * k);
    y = wrap(y + sin(hdg) * spd * k);

    // up and down, eased: held buttons, or following the ground
    var up = CLIMB * (0.7 + 0.45 * f), down = DIVE * (0.8 + 0.3 * f);
    gnd = world.ground(x, y);
    var look = AHEAD + spd * AHEAD_SPD;
    var ahead = world.ground(x + cos(hdg) * look, y + sin(hdg) * look);
    var want2 = 0.0;
    if (scenic) {
        if (btn(0))
            agl = min(AGL_MAX, agl + AGL_RATE * k);
        if (btn(1))
            agl = max(AGL_MIN, agl - AGL_RATE * k);
        want2 = mid(0.0 - down, (max(gnd, ahead - 4) + agl - z) * 0.08, up);
    } else {
        want2 = btn(0) ? up : btn(1) ? 0.0 - down : 0.0;
    }
    vs += mid(-0.03, want2 - vs, 0.03) * k;
    var z0 = z;
    z += vs * k;

    // the ground, under and ahead (further ahead the faster): too close,
    // and the aircraft rises smoothly; never closer than SKIM
    var floor = max(gnd, ahead - 4) + CLEAR;
    low = z < floor && !scenic;
    if (z < floor) {
        z += (floor - z) * 0.2 * k;
        if (vs < 0.0)
            vs = 0.0;
    }
    if (z < gnd + SKIM)
        z = gnd + SKIM;
    if (z > CEILING) {
        z = CEILING;
        if (vs > 0.0)
            vs = 0.0;
    }
    climb = (z - z0) / k;
}

// A place brought back into the world, 0 to just under 256. Not by
// dividing: a place a hair below 0, divided by 256, is under a fraction's
// smallest step and comes out 0, leaving the place below 0.
function wrap(v) {
    if (v < 0.0)
        return v + 256.0;
    if (v >= 256.0)
        return v - 256.0;
    return v;
}

// The heading as a compass shows it: degrees clockwise from north
function compass() {
    var d = flr(90.5 - hdg * 360.0);
    return d < 0 ? d + 360 : d;
}
