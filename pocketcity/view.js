// view: the camera and the picture. The camera looks a little ahead of the
// player, the way they're going, so there is more of the road in front at
// speed; it eases there rather than jumping, and stops at the map's edge.
//
// The picture, bottom to top: the city from the ring (city.js), the
// markers on the ground (jobs.js), the traffic lights, the people, the
// cars, and the player, at the wheel or on foot.

const LOOK = 16.0;                 // ticks of the player's speed the camera looks ahead
const LOOK_MAX = 44.0;             // ...at most, pixels
const EASE = 0.12;                 // the share of the way the camera goes a tick
const MIDX = 80, MIDY = 66;        // where the player sits on the screen, standing
const LIGHT = 18;                  // pixels from a junction's middle to its lights

var LIT = [11, 9, 8];              // green, amber, red; each way's light stands on the corner to a
                                   // driver's right before the junction, 18 pixels each way from its middle

var lx = 0.0, ly = 0.0;            // the look ahead now, pixels
var cx = 0, cy = 0;                // the camera's top left, whole world pixels

// The camera straight onto the player, for a new start
function reset() {
    lx = 0.0;
    ly = 0.0;
    place();
    city.whole = true;
    city.follow(cx >> 3, cy >> 3);
}

// A tick: the camera after the player, and the ring after the camera
function update(k) {
    var vx = 0.0, vy = 0.0;
    if (player.inCar) {
        vx = car.vx;
        vy = car.vy;
    } else if (player.moving) {
        var sp = player.running ? player.RUN : player.WALK;
        vx = cos(player.h) * sp;
        vy = sin(player.h) * sp;
    }
    var wx = mid(0.0 - LOOK_MAX, vx * LOOK, LOOK_MAX), wy = mid(0.0 - LOOK_MAX, vy * LOOK, LOOK_MAX);
    lx += (wx - lx) * EASE * k;
    ly += (wy - ly) * EASE * k;
    place();
    city.follow(cx >> 3, cy >> 3);
}

// The camera's top left from the player and the look ahead, inside the map
function place() {
    cx = mid(0, flr(player.px() + lx) - MIDX, city.mw * 8 - 160);
    cy = mid(0, flr(player.py() + ly) - MIDY, city.mh * 8 - 120);
}

// The whole picture
function draw() {
    city.draw(cx, cy);
    jobs.draw(cx, cy);
    lights();
    people.draw(cx, cy);
    traffic.draw(cx, cy);
    if (player.inCar) {
        sheet(IMG.cars);
        traffic.sprite(car.shape, car.paint, car.h, flr(car.x) - cx, flr(car.y) - cy, false);
        sheet();
    } else {
        player.draw(cx, cy);
    }
}

// The traffic lights of the junctions on the screen: one on each corner,
// facing the cars that come to it
function lights() {
    var sx0 = max(0, (cx - 24) >> 8), sx1 = min(roads.SQUARES - 1, (cx + 184) >> 8);
    var sy0 = max(0, (cy - 24) >> 8), sy1 = min(roads.SQUARES - 1, (cy + 144) >> 8);
    for (var sy = sy0; sy <= sy1; sy++) {
        for (var sx = sx0; sx <= sx1; sx++) {
            var sq = sy * roads.SQUARES + sx;
            for (var r = roads.rstart[sq]; r < roads.rstart[sq + 1]; r++) {
                var a = roads.rlist[r];
                if (roads.sig[a] == 0)
                    continue;
                var jx = roads.nx[a] - cx, jy = roads.ny[a] - cy;
                if (jx < -24 || jx > 184 || jy < -24 || jy > 144)
                    continue;
                roads.both(a);
                var cn = LIT[roads.ns], ce = LIT[roads.ew];
                rectfill(jx + 17, jy + 16, jx + 19, jy + 18, cn);
                rectfill(jx - 19, jy + 16, jx - 17, jy + 18, ce);
                rectfill(jx - 19, jy - 20, jx - 17, jy - 18, cn);
                rectfill(jx + 17, jy - 20, jx + 19, jy - 18, ce);
            }
        }
    }
}
