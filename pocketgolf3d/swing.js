// swing: the clubs and the three-press swing meter.
//
// Select starts the marker running up the meter from the line; pressing
// again sets the power, where it is. It then runs back down past the line,
// and the third press sets the accuracy: on the line is straight, early
// (still above it) hooks to the left, late slices to the right. Missed
// altogether, it is the worst slice. A putt takes two presses, the power
// alone, and is always struck straight.
//
// Power is a share of the club's full carry, so half power is half the
// distance. A putt's full power is half again the distance to the pin on
// a flat green, so the pin's mark on the meter is two thirds of the way
// up, and the meter is as fine for a short putt as for a long one.
//
// Each club has a carry in yards for a full shot from the fairway, an
// effective launch angle (low: there is no drag in ball.js) and how much
// run its backspin leaves after the first bounce.

const IDLE = 0, UP = 1, DOWN = 2, DONE = 3;   // the meter's phases
const PUTTER = 8;
const LOW = -0.15;                 // the bottom of the meter, under the line
const WINDOW = 0.13;               // a press this far from the line is a full hook or slice
const SWEET = 0.025;               // ...and this near it dead straight
const GREEN_DRAG = 0.0016;         // ball.js's drag on a green, for the putt's speed

var NAMES = ["DRIVER", "3 WOOD", "3 IRON", "5 IRON", "7 IRON", "9 IRON", "P WEDGE", "S WEDGE", "PUTTER"];
var CARRY = [240, 215, 190, 170, 150, 125, 100, 70, 0];       // yards, full, from the fairway
var LOFT = [20, 24, 26, 30, 36, 42, 48, 54, 0];                // launch angle, degrees
var KEEP = [0.75, 0.7, 0.65, 0.6, 0.55, 0.45, 0.4, 0.35, 1.0]; // run kept at the first bounce
var TICKS = [28, 40, 20];          // ticks the marker takes up the meter, by the option
// by surface: none, fairway, rough, woods, green, fringe, tee, sand, water
var LIE = [1.0, 1.0, 0.85, 0.6, 1.0, 0.95, 1.0, 0.7, 1.0];   // share of the carry from there
var WILD = [0.0, 0.0, 0.15, 0.35, 0.0, 0.0, 0.0, 0.2, 0.0];   // a random hook or slice from there

var K = new FixArray(9);           // G over the sine of twice the loft, for the launch speed
var phase = IDLE;
var club = 0;
var pos = 0.0;                     // the marker: LOW to 1.0, 0 on the line
var power = 0.0;
var err = 0.0;                     // -1 a full hook to 1 a full slice
var speed = 1.0 / 28;              // the marker's run a tick
var full = 1.0;                    // a putt's full power, world pixels on a flat green
var mark = 0.0;                    // the pin's mark on the meter, for a putt

// Once: each club's launch constant
function setup() {
    for (var c = 0; c < PUTTER; c++) {
        var a = LOFT[c] / 360.0;
        K[c] = ball.G / (0.0 - sin(a * 2.0));   // sin is upside down
    }
}

// The meter's speed, from the option
function setSpeed(o) {
    speed = 1.0 / TICKS[mid(0, o, 2)];
}

// Back to rest before a shot
function reset() {
    phase = IDLE;
    pos = 0.0;
    power = 0.0;
    err = 0.0;
}

// The club for a shot of yards from surface s: the putter on the green,
// else the shortest that reaches, else the longest allowed (the driver
// only from the tee)
function pick(yards, s) {
    if (s == course.GREEN || (s == course.FRINGE && yards < 25))
        return PUTTER;
    var top = s == course.TEE ? 0 : 1;
    for (var c = PUTTER - 1; c > top; c--)
        if (reach(c, s) >= yards)
            return c;
    return top;
}

// A full shot's carry with club c from surface s, in yards
function reach(c, s) {
    if (c == PUTTER)
        return 0;
    var f = LIE[s];
    if (c == PUTTER - 1 && s == course.SAND)
        f = 0.95;                  // the sand wedge is made for it
    if (c == 0 && s != course.TEE)
        f = f * 0.85;              // a driver off the ground
    return flr(CARRY[c] * f);
}

// A putt's scale: the pin two thirds up the meter, within bounds
function putting(px) {
    full = mid(2.0, px * 1.5, 24.0);
    mark = px / full;
}

// One tick of the meter. Returns true the tick the swing is done
function update() {
    if (phase == IDLE) {
        if (btnp(4)) {
            phase = UP;
            pos = 0.0;
            sfx(SFX.tick);
        }
        return false;
    }
    if (phase == UP) {
        pos += speed;
        if (btnp(4) || pos >= 1.0) {
            power = min(pos, 1.0);
            pos = power;
            sfx(SFX.tick);
            if (club == PUTTER) {
                err = 0.0;
                phase = DONE;
                return true;
            }
            phase = DOWN;
        }
        return false;
    }
    if (phase == DOWN) {
        pos -= speed * 1.2;
        if (btnp(4) || pos <= LOW) {
            pos = max(pos, LOW);
            err = abs(pos) < SWEET ? 0.0 : mid(-1.0, (0.0 - pos) / WINDOW, 1.0);
            phase = DONE;
            return true;
        }
    }
    return false;
}

// The shot set going from surface s along heading a: power, accuracy, the
// lie's own randomness
function strike(a, s) {
    if (club == PUTTER) {
        var d = power * full;
        ball.putt(a, sqrt(2.0 * GREEN_DRAG * d));
        sfx(SFX.putt);
        return;
    }
    var e = err;
    if (WILD[s] > 0.0)
        e = mid(-1.0, e + (rnd(2.0) - 1.0) * WILD[s], 1.0);
    var px = reach(club, s) * power / course.YARDS;
    var v = sqrt(px * K[club]);
    ball.strike(a + e * 0.008, LOFT[club] / 360.0, v, e, KEEP[club]);
    sfx(SFX.hit);
}
