// view: the picture. The sky in bands, the hills on the horizon when the
// quality allows, the ground through land.draw fading into haze, and in
// the chase view the aircraft with its shadow on the ground.
//
// The chase camera hangs BEHIND world pixels back and ABOVE up from the
// aircraft, kept clear of the ground. The cockpit camera sits in the
// aircraft. plane.view can't roll the picture, so the horizon stays level
// in a turn: the aircraft's banked sprite, and the instrument in the
// cockpit, show the bank. Climbing and diving move the horizon instead.

const FOV = 0.22;                  // the field of view, turns
const FOCAL = 96.7;                // 80 / tan(FOV / 2): screen pixels a world pixel at depth 1
const BEHIND = 26.0, ABOVE = 7.0;  // the chase camera behind and above the aircraft
const HORIZON = 52.0;              // the horizon's row in level flight

var chase = true;
var hz = 52.0;                     // the horizon's row now
var cx = 0.0, cy = 0.0, cz = 0.0;  // the camera
var at = [0.0, 0.0, 0.0, 0.0];     // plane.project's answer

// A tick: the camera follows the aircraft
function update(k) {
    hz += (HORIZON + flight.vs * 20.0 - hz) * 0.15 * k;
    var h = flight.hdg;
    if (chase) {
        cx = flight.x - cos(h) * BEHIND;
        cy = flight.y - sin(h) * BEHIND;
        cz = flight.z + ABOVE;
        var g = world.ground(cx, cy) + 4.0;
        if (cz < g)
            cz = g;
    } else {
        cx = flight.x;
        cy = flight.y;
        cz = flight.z;
    }
}

function draw() {
    var q = quality.level;
    // the half-size landscape is drawn with everything halved: the same
    // view, more coarsely
    var s = quality.HALF[q] != 0 ? 0.5 : 1.0;
    var far = flr(quality.FAR[q] * s);
    var hy = flr(hz);
    var bottom = chase ? 119 : 95;     // the cockpit's panel covers the rest
    // the sky in bands, lighter toward the horizon; haze below it, for
    // where the ground ends
    rectfill(0, 0, 159, hy * 2 / 5, world.SKY_TOP);
    rectfill(0, hy * 2 / 5 + 1, 159, hy * 3 / 4, world.SKY);
    rectfill(0, hy * 3 / 4 + 1, 159, hy - 3, world.SKY_LOW);
    rectfill(0, hy - 2, 159, bottom, world.HAZE);
    plane.view(cx * s, cy * s, cz * s, flight.hdg, hy, FOV);
    // the far hills stand where the drawn ground ends, which is below the
    // true horizon by the camera's height over the land, seen from far away
    if (quality.PANO[q] != 0)
        plane.sky(world.sky, 0 - flr((cz - world.LAND) * FOCAL / quality.FAR[q]));
    plane.fog(far * 0.45, far, world.HAZE);
    clip(0, 0, 159, bottom);
    if (s < 1.0)
        land.draw(world.heights2, world.colours2, far, 1, quality.COARSE[q]);
    else
        land.draw(world.heights, world.colours, far, 1, quality.COARSE[q]);
    clip();
    if (chase)
        aircraft(s);
}

// The aircraft from behind, banked, over its shadow; s is the world's scale
function aircraft(s) {
    if (plane.project(flight.x * s, flight.y * s, flight.gnd * s, at) != 0) {
        var r = mid(2.0, at[2] * 7.0 / s, 14.0);
        fillp(0xa5a5);
        ovalfill(at[0] - r, at[1] - r / 3.0, at[0] + r, at[1] + r / 3.0, 1);
        fillp();
    }
    if (plane.project(flight.x * s, flight.y * s, flight.z * s, at) != 0) {
        var f = mid(0, flr(flight.bank * 2.5 + 2.5), 4);
        spr(64 + f * 3, at[0] - 12, at[1] - 8, 3, 2);
    }
}
