// player: who the player is and where: at the wheel (car.js drives the
// car) or on foot.
//
// Next gets out when the car is all but standing; the car stays where it
// was, parked, one of traffic.js's cars like any other. On foot the wheel
// turns the player (Spin: a click a little; Thumb: they face where the
// thumb rests), Select walks, with Play held runs, and Next gets into the
// nearest car within reach: a parked one, or traffic standing or crawling,
// whose driver jumps out and runs off. That's theft: main.js hears of it
// through stole(), for the police.
//
// On foot the player is a small circle against the walls, and the cars
// push them aside; a moving car knocks them down for a moment.

const WALK = 0.75;                 // pixels a tick on foot
const RUN = 1.35;                  // ...running
const TURN_CLICK = 0.03125;        // turns a wheel click on foot (Spin)
const RADIUS = 2.5;                // pixels, on foot, for walls
const REACH = 16.0;                // pixels to a car to get in
const DOWN_TICKS = 45;
const OUT_SPEED = 0.6;             // pixels a tick: slower than this, Next gets out
const STRIDE = 5.0;                // pixels a step

var inCar = true;
var x = 0.0, y = 0.0, h = 0.75;   // on foot: the feet and the way they face
var walked = 0.0;
var moving = false, running = false;
var down = 0;                      // ticks still knocked down

// A new start: at the wheel of a car of shape sh in paint pt at px, py
function reset(px, py, ph, sh, pt) {
    inCar = true;
    down = 0;
    car.reset(px, py, ph);
    car.shape = sh;
    car.paint = pt;
}

// Where the player is: the car, or their feet
function px() {
    return inCar ? car.x : x;
}

function py() {
    return inCar ? car.y : y;
}

// A tick: the car, or a tick on foot. Returns true when Next sounded the horn
function update(spin, k) {
    if (inCar) {
        car.update(spin, k);
        if (btnp(1)) {
            if (abs(car.fwd) < OUT_SPEED && abs(car.side) < OUT_SPEED && out())
                return false;
            return true;
        }
        return false;
    }
    foot(spin, k);
    return false;
}

// A tick on foot
function foot(spin, k) {
    moving = false;
    if (down > 0) {
        down--;
        return;
    }
    if (spin) {
        var w = wheel();
        if (w != 0) {
            h -= w * TURN_CLICK;
            h -= flr(h);
        }
    } else {
        var p = wheelpos();
        if (p >= 0) {
            var a = 0.25 - p / 96.0;
            h = a - flr(a);
        }
    }
    if (btn(4)) {
        running = btn(3);
        var sp = (running ? RUN : WALK) * k;
        var nx = x + cos(h) * sp, ny = y + sin(h) * sp;
        if (!blocked(nx, y))
            x = nx;
        if (!blocked(x, ny))
            y = ny;
        walked += sp;
        if (walked >= STRIDE * 4.0)
            walked -= STRIDE * 4.0;
        moving = true;
    }
    if (btnp(1))
        into();
}

// Whether the player on foot would touch a wall at px, py
function blocked(px, py) {
    return (city.at(px - RADIUS, py) & city.SOLID) != 0 || (city.at(px + RADIUS, py) & city.SOLID) != 0 ||
           (city.at(px, py - RADIUS) & city.SOLID) != 0 || (city.at(px, py + RADIUS) & city.SOLID) != 0;
}

// Out of the car, on the left (the driver's side), else the right, else
// not at all. The car stays, parked
function out() {
    var a = car.h + 0.25;
    var lx = car.x + cos(a) * 9.0, ly = car.y + sin(a) * 9.0;
    if (blocked(lx, ly)) {
        lx = car.x - cos(a) * 9.0;
        ly = car.y - sin(a) * 9.0;
        if (blocked(lx, ly))
            return false;
    }
    if (traffic.park(car.x, car.y, car.h, car.shape, car.paint, true) < 0)
        return false;
    x = lx;
    y = ly;
    h = car.h;
    car.stop();
    inCar = false;
    walked = 0.0;
    door();
    return true;
}

// Into the nearest car within reach, if any: its driver, if it has one,
// runs off
function into() {
    var i = traffic.nearest(x, y, REACH);
    if (i < 0)
        return;
    var stolen = traffic.on[i] == traffic.DRIVE;
    var a = traffic.h[i] + 0.25;
    car.reset(traffic.x[i], traffic.y[i], traffic.h[i]);
    car.shape = traffic.shape[i];
    car.paint = traffic.paint[i];
    traffic.on[i] = traffic.FREE;
    if (stolen) {
        people.eject(car.x + cos(a) * 9.0, car.y + sin(a) * 9.0);
        stole();
    }
    inCar = true;
    door();
}

// On foot, touched by a car: moved out of it, unless into a wall; hit by
// a moving one, knocked down and pushed further
function push(dx, dy, hit) {
    if (hit && down == 0) {
        down = DOWN_TICKS;
        dx *= 2.0;
        dy *= 2.0;
        hurt();
    }
    if (!blocked(x + dx, y))
        x += dx;
    if (!blocked(x, y + dy))
        y += dy;
}

// The player on foot, on the screen whose top left is cx, cy
function draw(cx, cy) {
    var sx = flr(x) - cx, sy = flr(y) - cy;
    var n = 12;
    if (down == 0) {
        var q = flr(h * 4.0 + 0.5) & 3;
        n = q * 3 + (moving ? 1 + flr(walked / STRIDE) % 2 : 0);
    }
    sheet(IMG.people);
    spr(n, sx - 4, sy - 7);
    sheet();
    // a small mark over the player, so they stand out in a crowd
    pset(sx, sy - 9, (frame() >> 3) % 2 == 0 ? 10 : 9);
}
