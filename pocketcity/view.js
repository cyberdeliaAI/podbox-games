// view: the camera and the picture. The camera looks a little ahead of the
// car, the way it's going, so there is more of the road in front of it at
// speed; it eases there rather than jumping, and stops at the map's edge.
// Then the city from the ring (city.js), and the car over it from its own
// picture of 32 headings.

const LOOK = 16.0;                 // ticks of the car's speed the camera looks ahead
const LOOK_MAX = 44.0;             // ...at most, pixels
const EASE = 0.12;                 // the share of the way the camera goes a tick
const MIDX = 80, MIDY = 66;        // where the car sits on the screen, standing

var lx = 0.0, ly = 0.0;            // the look ahead now, pixels
var cx = 0, cy = 0;                // the camera's top left, whole world pixels

// The camera straight onto the car, for a new drive
function reset() {
    lx = 0.0;
    ly = 0.0;
    place();
    city.whole = true;
    city.follow(cx >> 3, cy >> 3);
}

// A tick: the camera after the car, and the ring after the camera
function update(k) {
    var wx = mid(0.0 - LOOK_MAX, car.vx * LOOK, LOOK_MAX), wy = mid(0.0 - LOOK_MAX, car.vy * LOOK, LOOK_MAX);
    lx += (wx - lx) * EASE * k;
    ly += (wy - ly) * EASE * k;
    place();
    city.follow(cx >> 3, cy >> 3);
}

// The camera's top left from the car and the look ahead, inside the map
function place() {
    cx = mid(0, flr(car.x + lx) - MIDX, city.mw * 8 - 160);
    cy = mid(0, flr(car.y + ly) - MIDY, city.mh * 8 - 120);
}

// The city, then the car
function draw() {
    city.draw(cx, cy);
    var f = car.frame32();
    sheet(IMG.cars);
    spr((f / 8) * 32 + (f % 8) * 2, flr(car.x) - cx - 8, flr(car.y) - cy - 8, 2, 2);
    sheet();
}
