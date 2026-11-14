// ball: the wrecking ball on its chain round the crane in the middle.
//
// A pendulum the player keeps swinging: the wheel pushes it round (with the
// clock, it swings with the clock), and it keeps going after the wheel
// stops, slowing as the damping takes its speed. Prev and Next nudge it
// against or with the clock, for aiming; Play stamps, one hard shove the
// way it's going, then a moment to recover. With Thumb steering the ball is
// pulled toward where the thumb rests on the wheel instead, still on its
// chain, still with momentum.
//
// Angles are turns, as sin and cos take them: 0 to the right, 0.25 up, so
// with the clock is a falling angle. Speeds are a tick's at 33 a second,
// scaled by k.

const CX = 80, CY = 60;            // the crane's hub on the screen
const L = 40.0;                    // the chain's length, pixels: the ball's ring
const R = 4;                       // the ball's radius
const PUSH = 0.0011;               // turns a tick for a wheel click
const NUDGE = 0.0012;              // ...a tick for Prev or Next held
const DAMP = 0.015;                // the share of its speed lost a tick
const VMAX = 0.056;                // turns a tick at most: a full turn in 18 ticks
const STAMP = 1.6;                 // Play: the speed times this, at least STAMP_MIN
const STAMP_MIN = 0.03;
const STAMP_WAIT = 33;             // ticks before Play stamps again
const PULL = 0.02;                 // Thumb: how hard the thumb's place pulls
const BALL = 8;                    // its sprite

var ang = 0.25;                    // the ball's angle, turns: starts above the hub
var vel = 0.0;                     // turns a tick
var wait = 0;                      // ticks until Play stamps again
var x = 80.0, y = 20.0;            // the ball's place on the screen

// A new game: the ball hanging still above the hub
function reset() {
    ang = 0.25;
    vel = 0.0;
    wait = 0;
    place();
}

// A tick of swinging. spin: Spin steering, else Thumb
function update(spin, k) {
    if (spin) {
        vel -= wheel() * PUSH;
    } else {
        var p = wheelpos();
        if (p >= 0) {
            var want = 0.25 - p / 96.0;
            var d = want - ang;
            d -= flr(d + 0.5);
            vel += d * PULL * k;
        }
    }
    if (btn(0))
        vel += NUDGE * k;          // Prev: against the clock
    if (btn(1))
        vel -= NUDGE * k;          // Next: with it
    if (wait > 0)
        wait--;
    if (btnp(3) && wait == 0) {
        var s = abs(vel) * STAMP;
        if (s < STAMP_MIN)
            s = STAMP_MIN;
        vel = vel < 0.0 ? 0.0 - s : s;
        wait = STAMP_WAIT;
        sfx(SFX.stamp, 2);
    }
    vel -= vel * DAMP * k;
    vel = mid(0.0 - VMAX, vel, VMAX);
    ang += vel * k;
    ang -= flr(ang);
    place();
}

// The ball's place on the screen from its angle
function place() {
    x = CX + cos(ang) * L;
    y = CY + sin(ang) * L;
}

// How hard it would hit something now, 1 slow to 3 at full speed
function force() {
    return 1 + flr(abs(vel) * 40.0);
}

// The chain, bending back as the ball swings fast, then the ball
function draw() {
    // the links lag behind the ball by more toward the hub
    var lag = mid(-0.08, vel * 2.5, 0.08);
    var px = CX, py = CY;
    for (var i = 1; i <= 5; i++) {
        var f = i / 5.0;
        var a = ang - lag * (1.0 - f);
        var lx = CX + cos(a) * L * f, ly = CY + sin(a) * L * f;
        line(px, py, lx, ly, 5);
        pset(lx, ly, 6);
        px = lx;
        py = ly;
    }
    spr(BALL, flr(x) - 4, flr(y) - 4);
}
