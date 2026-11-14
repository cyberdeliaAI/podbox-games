// skier: the skier, the wheel and how they go downhill.
//
// An arcade model, not a simulation. Gravity pulls along the way the skier
// faces: the mountain's slope times how much they face down the fall line,
// less the snow's own rise ahead. Snow friction and air drag hold the speed
// back, and turning sharply bleeds it. The wheel carves: turning it leans
// the skier into a turn, and left alone the skis straighten and the slope
// slowly turns them back toward the fall line. The skier never turns more
// than 75 degrees off the fall line, so they always go on downhill.
//
// Up and down: on the snow the skier follows it. The ground's height is the
// relief under the skier less the mountain's slope over the ground covered,
// and where it falls away faster than gravity can follow (over a roller, or
// a steep drop) the skier leaves it and flies until they meet it again.
//
// Places are world pixels on the wrapping picture, headings turns. Speeds
// are a tick's at 33 a second, scaled by k.

const LIMIT = 0.21;                // the most the skier turns off the fall line, turns
const SENS = 0.04;                 // carve a wheel click
const STRAIGHTEN_AFTER = 12;       // ticks without the wheel before the skis straighten
const TURN = 0.0075;               // turns a tick at a full carve
const GRAVITY = 0.09;              // pull down the slope, world pixels a tick a tick
const FRICTION = 0.003;            // speed lost to the snow a tick
const DRAG = 0.008;                // ...and to the air, times the speed squared
const TURN_DRAG = 1.0;             // ...and to turning, times the turn and the speed
const FALL_G = 0.14;               // gravity in the air, world pixels a tick a tick
const LIFT_OFF = 0.3;              // how much faster than gravity the snow must fall away to fly:
                                   // the legs soak up anything less, as a skier's do
const AIR_STEER = 0.4;             // how much of a carve still turns the skier in the air
const FALL_PULL = 0.02;            // with the skis running straight, the slope turns them toward
                                   // the fall line by this share of the way a tick
const VMIN = 0.15, VMAX = 2.2;     // world pixels a tick

var x = 0.0, y = 0.0;
var h = 0.0;                       // heading, turns
var carve = 0.0;                   // -1 hard left to 1 hard right
var v = 0.6;                       // speed
var s = 0;                         // world pixels down the fall line, whole
var sFrac = 0.0;                   // ...and the part of one
var g = 0;                         // the snow's height under the skier
var air = false;
var hrel = 0.0;                    // height above the snow, in the air
var vz = 0.0;                      // rising, world pixels a tick
var airTicks = 0, jumps = 0;       // for the record: ticks in the air, and flights of JUMP ticks or more
var flown = 0;                     // ticks of the flight under way
const JUMP = 6;                    // a flight this long counts as a jump, not a hop
var idle = 0;
var turnRate = 0.0;

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
    airTicks = 0;
    jumps = 0;
    idle = 0;
}

// The skier's heading off the fall line, -0.5 to 0.5 turns
function off() {
    var d = h - slope.FALL;
    return d - flr(d + 0.5);
}

// A tick. spin: Spin steering, else Thumb; auto, 0 for the player, or a
// carve for the title's demo to hold
function update(spin, k, auto) {
    // carving: the wheel leans the skier in; left alone the skis straighten
    if (auto != 0.0) {
        carve += mid(-0.05, auto - carve, 0.05) * k;
    } else if (spin) {
        var w = wheel();
        if (w != 0) {
            carve = mid(-1.0, carve + w * SENS, 1.0);
            idle = 0;
        } else if (++idle > STRAIGHTEN_AFTER) {
            carve -= carve * 0.12 * k;
        }
    } else {
        var p = wheelpos(), want = 0.0;
        if (p >= 0)
            want = mid(-1.0, -sin(p / 96.0) * 1.4, 1.0);
        carve += mid(-0.08, want - carve, 0.08) * k;
    }
    // in the air the skis can't bite, but a twist of the body still turns a little
    turnRate = carve * TURN * k * (air ? AIR_STEER : 1.0);
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
    o = off();

    // speed: gravity down the slope as faced, against friction, air and turning
    var steep = slope.steep(s);
    var ca = cos(o);
    var dx = cos(h), dy = sin(h);
    var grade = (slope.ground(x + dx * 4.0, y + dy * 4.0) - slope.ground(x, y)) / 4.0;
    if (!air)
        v += GRAVITY * (steep * ca - grade) * k;
    v -= (FRICTION + DRAG * v * v + TURN_DRAG * abs(turnRate) * v) * k;
    v = mid(VMIN, v, VMAX);

    // moving on the wrapping picture
    x = wrap(x + dx * v * k);
    y = wrap(y + dy * v * k);
    var down = v * ca * k;         // world pixels down the fall line this tick
    sFrac += down;
    var whole = flr(sFrac);
    s += whole;
    sFrac -= whole;

    // up and down: the ground falls by the relief's change less the
    // mountain's drop over the ground covered
    var g0 = g;
    g = slope.ground(x, y);
    var rate = (g - g0) - down * steep;
    if (air) {
        vz -= FALL_G * k;
        hrel += vz - rate;
        airTicks++;
        flown++;
        if (hrel <= 0.0) {
            hrel = 0.0;
            air = false;
            vz = rate;
            if (flown >= JUMP) {
                jumps++;
                sfx(SFX.land);
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

function kmh() {
    return flr(v * 59.4);
}
