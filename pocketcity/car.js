// car: the player's car, how it drives and what it runs into.
//
// An arcade model that drifts. The car has a heading and a velocity, and
// the velocity is split each tick into the part along the heading and the
// part sideways. Select holds the throttle, Prev brakes and then reverses;
// drag and rolling hold the speed back, harder on grass. The tyres' grip
// takes most of the sideways part away each tick, so the car goes where it
// points; Play is the handbrake, which lets go of the grip and slows the
// wheels, and the back steps out. The wheel steers (Spin: turning it turns
// the front wheels, and they come back straight when it stops; Thumb: the
// thumb's place right or left of the top), and steering turns the car more
// the faster it goes, up to TURN_AT.
//
// Walls are the map's solid cells: water, buildings, trees. The car is a
// circle of RADIUS for them, tried at eight points round it, across and
// down separately so it slides along a wall. A wall it meets bounces it
// back a little and costs speed; a hard knock is a crash.
//
// The player drives whatever they got into: a sedan, a van (slower to get
// going and to the top), a sports car (quicker on both) or a gold car, a
// sedan for finding all the tapes. Each has its paint, which the picture
// takes through pal() (traffic.sprite()).
//
// Places are world pixels, the heading turns (0 east, 0.25 north), speeds
// pixels a tick at 33 a second, scaled by k.

const ACC = 0.055;                 // throttle, pixels a tick a tick, at a standstill
const BRAKE = 0.11;
const REV = 0.035, VREV = 0.9;     // reversing: how fast it gets going, and how fast it goes
const ROLL = 0.003;                // speed lost a tick, rolling
const DRAG = 0.0003;               // ...and times the speed squared, to the air
const ENGINE_BRAKE = 0.018;        // ...and off the throttle, so it doesn't coast for ever
const GRASS_DRAG = 0.05;           // a share of the speed lost a tick on grass
const KERB_DRAG = 0.012;           // ...on the sidewalk
const GRIP = 0.32;                 // the share of the sideways speed the tyres take a tick
const SLIDE_GRIP = 0.045;          // ...with the handbrake on
const HANDBRAKE = 0.025;           // a share of the speed it takes a tick
const TURN = 0.0115;               // turns a tick at full lock
const TURN_AT = 1.2;               // pixels a tick from which steering turns it fully
const STEER_CLICK = 0.11;          // lock a wheel click (Spin)
const RETURN_AFTER = 3;            // ticks without the wheel before the wheels come back
const RADIUS = 4.5;                // pixels, for walls
const BOUNCE = 0.3;                // the share of the speed into a wall that comes back
const CRASH = 1.0;                 // speed into a wall that counts as a crash

var GO = [1.0, 0.75, 1.3, 1.1];    // each shape's throttle, times ACC: sedan, van, sports, police
var TOP = [3.0, 2.6, 3.5, 3.2];    // ...and top speed, pixels a tick

var x = 0.0, y = 0.0, h = 0.25;
var vx = 0.0, vy = 0.0;
var shape = 0, paint = 0;
var steer = 0.0;                   // -1 full left to 1 full right
var idle = 0;
var fwd = 0.0, side = 0.0;         // the velocity along the heading and across it, last tick
var sliding = false;               // the back is out
var crashed = 0.0;                 // how hard the last crash was, this tick; 0 for none
var surface = 0;                   // the flags under the car
var probe = new FixArray(16);      // the eight points round the car, as offsets

// A new drive from x0, y0, heading h0, standing
function reset(x0, y0, h0) {
    x = x0;
    y = y0;
    h = h0;
    vx = 0.0;
    vy = 0.0;
    steer = 0.0;
    idle = 0;
    fwd = 0.0;
    side = 0.0;
    for (var i = 0; i < 8; i++) {
        probe[i * 2] = cos(i / 8.0) * RADIUS;
        probe[i * 2 + 1] = sin(i / 8.0) * RADIUS;
    }
}

// A tick of driving. spin: Spin steering, else Thumb
function update(spin, k) {
    crashed = 0.0;
    // the wheel: the front wheels' lock
    if (spin) {
        var w = wheel();
        if (w != 0) {
            steer = mid(-1.0, steer + w * STEER_CLICK, 1.0);
            idle = 0;
        } else if (++idle > RETURN_AFTER) {
            steer -= steer * 0.3 * k;
        }
    } else {
        var p = wheelpos(), want = 0.0;
        if (p >= 0)
            want = mid(-1.0, -sin(p / 96.0) * 1.6, 1.0);
        steer += mid(-0.12, want - steer, 0.12) * k;
    }

    // the velocity along the heading and across it
    var c = cos(h), s = sin(h);
    var f = vx * c + vy * s;
    var l = vy * c - vx * s;
    surface = city.at(x, y);
    var handbrake = btn(3);
    var r = f / TOP[shape];
    if (btn(4))
        f += ACC * GO[shape] * (1.0 - r * r) * k;
    if (btn(0)) {
        if (f > 0.05)
            f -= BRAKE * k;
        else
            f = max(0.0 - VREV, f - REV * k);
    }
    if (handbrake)
        f -= f * HANDBRAKE * k;
    // rolling and the air, never past a standstill
    var loss = (ROLL + DRAG * f * f + (btn(4) ? 0.0 : ENGINE_BRAKE)) * k;
    if ((surface & city.GRASS) != 0)
        loss += abs(f) * GRASS_DRAG * k;
    else if ((surface & city.WALK) != 0)
        loss += abs(f) * KERB_DRAG * k;
    if (f > loss)
        f -= loss;
    else if (f < 0.0 - loss)
        f += loss;
    else if (!btn(4) && !btn(0))
        f = 0.0;
    // the tyres take the sideways speed, all but a little with the handbrake
    l -= l * (handbrake ? SLIDE_GRIP : GRIP) * k;
    sliding = abs(l) > 0.5;
    // steering turns it by how fast it goes, backwards the other way
    var turn = steer * TURN * min(1.0, abs(f) / TURN_AT) * k;
    if (handbrake)
        turn *= 1.5;
    h -= f < 0.0 ? 0.0 - turn : turn;
    h -= flr(h);
    c = cos(h);
    s = sin(h);
    vx = f * c - l * s;
    vy = f * s + l * c;
    fwd = f;
    side = l;

    // moving, across then down, stopping at walls
    var nx = x + vx * k;
    if (blocked(nx, y)) {
        hit(abs(vx));
        vx = 0.0 - vx * BOUNCE;
    } else {
        x = nx;
    }
    var ny = y + vy * k;
    if (blocked(x, ny)) {
        hit(abs(vy));
        vy = 0.0 - vy * BOUNCE;
    } else {
        y = ny;
    }
}

// Whether the car would touch a wall at px, py: first the cells under the
// corners of its square, which are all it can touch, then, if one of
// them is solid, the eight points round it
function blocked(px, py) {
    if (((city.at(px - RADIUS, py - RADIUS) | city.at(px + RADIUS, py - RADIUS) |
          city.at(px - RADIUS, py + RADIUS) | city.at(px + RADIUS, py + RADIUS)) & city.SOLID) == 0)
        return false;
    for (var i = 0; i < 8; i++)
        if ((city.at(px + probe[i * 2], py + probe[i * 2 + 1]) & city.SOLID) != 0)
            return true;
    return false;
}

// Into a wall at speed v
function hit(v) {
    if (v > crashed)
        crashed = v;
}

// The speed, km/h by the game's scale: the car is about 4.5 m long
function kmh() {
    return flr(sqrt(vx * vx + vy * vy) * 44.0);
}

// The top speed of the car being driven, pixels a tick
function vmax() {
    return TOP[shape];
}

// The car standing still: nothing to drive, once the player is out
function stop() {
    vx = 0.0;
    vy = 0.0;
    fwd = 0.0;
    side = 0.0;
    sliding = false;
    crashed = 0.0;
}
