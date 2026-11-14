// skier: the skier, the controls and how they go downhill.
//
// An arcade model, not a simulation. Gravity pulls along the way the skier
// faces: the mountain's slope times how much they face down the fall line,
// less the snow's own rise ahead. Snow friction and air drag hold the speed
// back, turning sharply bleeds it, tucking (Next) halves the drag and
// ploughing (Prev) brakes. The wheel carves: turning it leans the skier
// into a turn, and left alone the skis straighten and the slope slowly
// turns them back toward the fall line. The skier never turns more than 75
// degrees off the fall line, so they always go on downhill.
//
// Up and down: on the snow the skier follows it. The ground's height is the
// relief under the skier less the mountain's slope over the ground covered,
// and where it falls away faster than gravity can follow (over a roller, or
// a steep drop) the skier leaves it and flies until they meet it again.
// Select jumps from the snow.
//
// Running into a pine or a boulder (unless high enough in the air to clear
// it) puts the skier down: they slide to a stop, lie a moment and get up
// facing down the fall line. main.js decides what a fall means for the
// run.
//
// Places are world pixels on the wrapping picture, headings turns. Speeds
// are a tick's at 33 a second, scaled by k.

const LIMIT = 0.21;                // the most the skier turns off the fall line, turns
const SENS = 0.04;                 // carve a wheel click, at sensitivity 3
const STRAIGHTEN_AFTER = 12;       // ticks without the wheel before the skis straighten
const TURN = 0.0075;               // turns a tick at a full carve
const GRAVITY = 0.09;              // pull down the slope, world pixels a tick a tick
const FRICTION = 0.003;            // speed lost to the snow a tick (times the slope's slip)
const DRAG = 0.008;                // ...and to the air, times the speed squared
const TUCK_DRAG = 0.45;            // ...a share of that when tucked
const TURN_DRAG = 1.0;             // ...and to turning, times the turn and the speed
const BRAKE = 0.03;                // ploughing: speed lost a tick, plus BRAKE_V of the speed
const BRAKE_V = 0.04;
const FALL_G = 0.14;               // gravity in the air, world pixels a tick a tick
const LIFT_OFF = 0.3;              // how much faster than gravity the snow must fall away to fly:
                                   // the legs soak up anything less, as a skier's do
const AIR_STEER = 0.4;             // how much of a carve still turns the skier in the air
const FALL_PULL = 0.02;            // with the skis straight, the slope turns them toward the
                                   // fall line by this share of the way a tick
const JUMP_V = 0.95;               // a jump's push up, world pixels a tick
const VMIN = 0.15, VMAX = 2.2;     // world pixels a tick
const DOWN_TICKS = 34;             // ticks lying in the snow after a fall
const RISE_TICKS = 14;             // ...and getting up
const LAND_TICKS = 5;              // ticks the knees take a landing
const GRACE = 40;                  // ticks after getting up when nothing is run into
const JUMP = 6;                    // a flight this long counts as a jump, not a hop

var x = 0.0, y = 0.0;
var h = 0.0;                       // heading, turns
var carve = 0.0;                   // -1 hard left to 1 hard right
var sens = 1.0;                    // the Sensitivity option, as a factor
var v = 0.6;                       // speed
var s = 0;                         // world pixels down the fall line, whole
var sFrac = 0.0;                   // ...and the part of one
var g = 0.0;                       // the snow's height under the skier
var air = false;
var hrel = 0.0;                    // height above the snow, in the air
var vz = 0.0;                      // rising, world pixels a tick
var braking = false, tucking = false;
var down = 0, rising = 0, landing = 0;   // ticks left lying, getting up, taking a landing
var grace = 0;
var lastHit = -1;                  // the object last run into
var slx = 0.0, sly = 0.0;          // the way a fall slides the skier: aside, off what they hit
var idle = 0, flown = 0;
var turnRate = 0.0;

// the run's record
var airTicks = 0, jumps = 0, longest = 0, falls = 0, top = 0;
var jumpsBanked = 0;               // jumps main.js has counted into the records
var runFrom = 0;                   // s where the run without a fall began

// A new run at x0, y0, facing down the fall line
function reset(x0, y0) {
    x = x0;
    y = y0;
    h = slope.FALL;
    carve = 0.0;
    v = 0.6;
    s = 0;
    sFrac = 0.0;
    g = slope.ground(x, y);
    air = false;
    hrel = 0.0;
    vz = 0.0;
    braking = false;
    tucking = false;
    down = 0;
    rising = 0;
    landing = 0;
    grace = 0;
    idle = 0;
    flown = 0;
    airTicks = 0;
    jumps = 0;
    longest = 0;
    falls = 0;
    top = 0;
    jumpsBanked = 0;
    runFrom = 0;
}

// The skier's heading off the fall line, -0.5 to 0.5 turns
function off() {
    var d = h - slope.FALL;
    return d - flr(d + 0.5);
}

// Whether the skier is on their skis and theirs to steer
function upright() {
    return down == 0 && rising == 0;
}

// A tick. spin: Spin steering, else Thumb; auto, 0 for the player, or a
// carve for the title's demo to hold
function update(spin, k, auto) {
    if (down > 0) {
        // sliding to a stop in the snow
        v -= v * 0.12 * k;
        if (--down == 0)
            rising = RISE_TICKS;
    } else if (rising > 0) {
        v = 0.0;
        if (--rising == 0) {
            v = 0.3;
            h = slope.FALL;
            carve = 0.0;
            grace = GRACE;
            rose();                // main.js: up again
        }
    } else {
        steer(spin, k, auto);
    }
    if (landing > 0)
        landing--;
    if (grace > 0)
        grace--;

    // speed: gravity down the slope as faced, against friction, air,
    // turning and the brake
    var steep = slope.steep(s);
    var o = off(), ca = cos(o);
    var dx = cos(h), dy = sin(h);
    if (upright()) {
        var grade = (slope.ground(x + dx * 4.0, y + dy * 4.0) - g) / 4.0;
        if (!air)
            v += GRAVITY * (steep * ca - grade) * k;
        var drag = DRAG * (tucking ? TUCK_DRAG : 1.0);
        v -= (FRICTION * slope.slip + drag * v * v + TURN_DRAG * abs(turnRate) * v) * k;
        if (braking && !air)
            v -= (BRAKE + BRAKE_V * v) * k;
        v = mid(VMIN, v, VMAX);
    }

    // moving on the wrapping picture; a fall slides the skier aside
    if (down > 0) {
        dx = slx;
        dy = sly;
        ca = max(0.0, dx * cos(slope.FALL) + dy * sin(slope.FALL));
    }
    x = wrap(x + dx * v * k);
    y = wrap(y + dy * v * k);
    var downhill = v * ca * k;     // world pixels down the fall line this tick
    sFrac += downhill;
    var whole = flr(sFrac);
    s += whole;
    sFrac -= whole;

    // up and down: the ground falls by the relief's change less the
    // mountain's drop over the ground covered
    var g0 = g;
    g = slope.ground(x, y);
    var rate = (g - g0) - downhill * steep;
    if (air) {
        vz -= FALL_G * k;
        hrel += vz - rate;
        airTicks++;
        flown++;
        if (hrel <= 0.0) {
            hrel = 0.0;
            air = false;
            vz = rate;
            landing = LAND_TICKS;
            if (flown >= JUMP) {
                jumps++;
                if (flown > longest)
                    longest = flown;
                sfx(SFX.land, 1);
                landed(flown);     // main.js: how long that was
            }
        }
    } else if (rate < vz - FALL_G * k - LIFT_OFF) {
        // the snow drops away faster than gravity follows: airborne
        air = true;
        vz -= FALL_G * k;
        hrel = vz - rate;
        flown = 0;
    } else {
        vz = rate;
    }

    // into a pine or a boulder: down in the snow
    if (upright() && grace == 0) {
        var t = objects.hit();
        if (t >= 0)
            crash(t);
    }
    var kh = kmh();
    if (kh > top)
        top = kh;
}

// The wheel and the buttons
function steer(spin, k, auto) {
    if (auto != 0.0) {
        carve += mid(-0.05, auto - carve, 0.05) * k;
        braking = false;
        tucking = false;
    } else {
        if (spin) {
            var w = wheel();
            if (w != 0) {
                carve = mid(-1.0, carve + w * SENS * sens, 1.0);
                idle = 0;
            } else if (++idle > STRAIGHTEN_AFTER) {
                carve -= carve * 0.12 * k;
            }
        } else {
            var p = wheelpos(), want = 0.0;
            if (p >= 0)
                want = mid(-1.0, -sin(p / 96.0) * 1.4 * sens, 1.0);
            carve += mid(-0.08, want - carve, 0.08) * k;
        }
        braking = btn(0);
        tucking = btn(1) && !braking;
        if (btnp(4) && !air) {
            air = true;
            vz += JUMP_V;
            hrel = 0.01;
            flown = 0;
            sfx(SFX.jump, 1);
        }
    }
    // in the air the skis can't bite, but a twist of the body still turns a
    // little; tucked, they turn less, and ploughing turns a little more
    var turn = TURN * (air ? AIR_STEER : 1.0) * (tucking ? 0.6 : braking ? 1.2 : 1.0);
    turnRate = carve * turn * k;
    h -= turnRate;
    var o = off();
    if (!air && abs(carve) < 0.15)
        h -= o * FALL_PULL * k;
    o = off();
    if (o > LIMIT || o < 0.0 - LIMIT) {
        h = slope.FALL + mid(0.0 - LIMIT, o, LIMIT);
        carve *= 0.5;
    }
    h -= flr(h);
}

// Ran into object t: pushed clear of it, and down in the snow sliding
// aside, across the fall line, so that getting up they ski past it
function crash(t) {
    lastHit = t;
    var hx = objects.hitX, hy = objects.hitY;
    var d = sqrt(hx * hx + hy * hy) + 0.01;
    var r = objects.REACH[objects.ok[t]] + 0.8;
    x = wrap(x + hx / d * (r - d));
    y = wrap(y + hy / d * (r - d));
    g = slope.ground(x, y);
    slx = 0.0 - sin(slope.FALL);
    sly = cos(slope.FALL);
    if (hx * slx + hy * sly < 0.0) {
        slx = 0.0 - slx;
        sly = 0.0 - sly;
    }
    var hard = v;
    v = 0.25 + v * 0.3;
    air = false;
    hrel = 0.0;
    vz = 0.0;
    carve = 0.0;
    braking = false;
    tucking = false;
    down = DOWN_TICKS;
    falls++;
    sfx(SFX.crash, 1);
    fell(hard);                    // main.js: what the fall means for the run
}

// A place brought back into the picture, 0 to just under 256, by comparing:
// dividing would leave a hair below 0 at 0
function wrap(p) {
    if (p < 0.0)
        return p + 256.0;
    if (p >= 256.0)
        return p - 256.0;
    return p;
}

// Distance down the mountain, metres: a world pixel is half a metre
function metres() {
    return s / 2;
}

// The run since the last fall, metres
function runMetres() {
    return (s - runFrom) / 2;
}

// Speed, km/h: a world pixel is half a metre, 33 ticks a second
function kmh() {
    return flr(v * 59.4);
}

// The pose to draw: a sprite of the sheet
function pose() {
    if (down > 0)
        return 96;
    if (rising > 0 || landing > 0)
        return 64 + 5 * 2;         // crouched
    if (air)
        return 64 + 7 * 2;
    if (braking)
        return 64 + 6 * 2;
    if (tucking)
        return 64 + 5 * 2;
    var f = 0;
    if (carve < -0.55)
        f = 2;
    else if (carve < -0.18)
        f = 1;
    else if (carve > 0.55)
        f = 4;
    else if (carve > 0.18)
        f = 3;
    return 64 + f * 2;
}
