// view: the 3D picture of the hole, the ball and the aim over it.
//
// land.draw on a hole costs about a tick on its own, but golf stands still
// between shots: the picture is drawn into cache, an image of the whole
// screen, only when the camera moves, and copied to the screen every tick
// after for about a thousand units. The camera moves only on a cut: behind
// the ball for a shot, at the landing for a long one, round to the aim
// when it nears the edge of the picture.
//
// A new picture takes a few ticks, and the screen keeps the last one
// meanwhile (main.js draws nothing while render() is busy), which the cut
// hides. The first tick draws the sky and finds the trees and the flag in
// view, sorted far to near by a count into depth bins; the second draws the
// land, coarse, which looks the same here at two thirds the cost; then the
// trees go in with sspr from images/trees.png, as many a tick as the units
// allow. A tree costs about 170 units to draw whatever its size, so the
// tiny ones far off are left out (the sky's own tree line stands in for
// them), and those in view are found by hand before anything is
// projected. A tree right by the camera is left out too, as a TV camera
// would step round it. The ball, its shadow and the aim are drawn live
// over the copy.
//
// The world wraps for land.draw, so a camera near the edge of the map
// would see the other end of the hole past it: the picture is drawn only
// as far as the map goes that way, plus a little of the woods.

const FOV = 0.22;                  // turns
const FOCAL = 96.7;                // 80 / tan(FOV / 2)
const FAR = 230;                   // world pixels drawn at most
const BINS = 128;                  // depth bins for sorting the trees, two world pixels each
const SKY0 = 46, SKY1 = 47, SKY2 = 48, HAZE = 49;   // palette entries (tools/pocketgolf3d_assets.py)
const SHADOW = 61, PENNANT = 62, POLE = 63, BALL = 64, BALL_SHADE = 65;
const BACK = 16.0, EYE = 7.0, HZ = 38;   // the camera for a shot: behind, above, the horizon row
const PUTT_HZ = 30;                // ...and for a putt, nearer and lower
const NEAR = 12.0;                 // trees nearer the camera than this, world pixels, are left out
const SMALL = 3;                   // ...and trees shorter than this on the screen, pixels
const SPREAD = 0.83;               // the view's half width over its depth: tan(FOV / 2)
const BUSY = 15500;                // units a tick may reach drawing trees before the rest wait
const BACK_STEP = 1, LAND_STEP = 2, TREE_STEP = 3;   // render()'s steps

var cache;
var camX = 64.0, camY = 240.0, camZ = 50.0, camH = 0.25;   // the camera
var hz = HZ;
var shown = -1;                    // the horizon the picture was drawn with
var far = FAR;
var dirty = true;                  // the picture needs drawing again
var stage = 0;                     // the step of the drawing under way, 0 none
var bn = 0, bj = -1;               // the trees still to draw: the bin, and the next in it
var count = 0;                     // trees and flag in the picture
var drawn = 0;                     // frame() of the last drawing, for the tests

var at = [0.0, 0.0, 0.0, 0.0];     // plane.project's answer
var px = new Int32Array(160), py = new Int32Array(160), ph = new Int32Array(160);
var pk = new Uint8Array(160);
var next = new Int32Array(160), head = new Int32Array(BINS);

// Once: the picture's image
function setup() {
    cache = img(160, 120);
}

// The camera for a shot from bx, by along heading a: behind the ball, or
// close and low on the green, the further back the longer the putt
function shot(bx, by, a, putt, d) {
    var back = BACK, eye = EYE;
    hz = HZ;
    if (putt) {
        back = 5.0 + min(d, 24.0) * 0.3;
        eye = 2.0 + min(d, 24.0) * 0.12;
        hz = PUTT_HZ;
    }
    place(bx - cos(a) * back, by - sin(a) * back, a, eye, bx, by);
}

// The camera at the landing of a long shot: back along its way, higher
function landing(lx, ly, a) {
    hz = HZ;
    place(lx - cos(a) * 30.0, ly - sin(a) * 30.0, a, 9.0, lx, ly);
}

// The camera for the title: high behind the tee
function opening(bx, by, a) {
    hz = 38;
    place(bx - cos(a) * 16.0, by - sin(a) * 16.0, a, 14.0, bx, by);
}

// The camera at cx, cy along a, eye above the higher of the ground there
// and at x, y; the picture to be drawn again
function place(cx, cy, a, eye, x, y) {
    a = a - flr(a);
    if (!dirty && abs(cx - camX) < 0.01 && abs(cy - camY) < 0.01 && abs(a - camH) < 0.0005 && hz == shown)
        return;                    // the picture there is drawn already
    camX = cx;
    camY = cy;
    camH = a;
    camZ = max(course.ground(cx, cy), course.ground(x, y)) + eye;
    far = reach();
    dirty = true;
}

// How far the map goes from the camera along its heading, and a little
// more for the woods, within FAR
function reach() {
    var c = cos(camH), s = sin(camH);
    var d = FAR * 1.0;
    if (c > 0.01)
        d = min(d, (128.0 - camX) / c);
    else if (c < -0.01)
        d = min(d, (0.0 - camX) / c);
    if (s > 0.01)
        d = min(d, (256.0 - camY) / s);
    else if (s < -0.01)
        d = min(d, (0.0 - camY) / s);
    return flr(mid(60.0, d + 24.0, FAR * 1.0));
}

// How far heading a is from the camera's, -0.5 to 0.5 turns
function off(a) {
    var d = a - camH;
    return d - flr(d + 0.5);
}

// A step of drawing the picture again, if the camera moved. Returns
// true while it isn't finished, and the screen should be left as it is
function render() {
    if (dirty) {
        dirty = false;
        stage = BACK_STEP;
    }
    if (stage == 0)
        return false;
    if (stage == BACK_STEP && unitsnow() > 3000)
        return true;               // each step takes most of a tick of its own
    target(cache);
    if (stage == BACK_STEP) {
        backdrop();
        find();
        stage = LAND_STEP;
    } else if (stage == LAND_STEP) {
        plane.view(camX, camY, camZ, camH, hz, FOV);
        plane.fog(far * 0.55, far, HAZE, false);
        land.draw(course.heights, course.colours, far, course.HSCALE, 2);
        stage = TREE_STEP;
    } else {
        trees();
    }
    target(SCREEN);
    if (stage == 0) {
        drawn = frame();
        shown = hz;
    }
    return stage != 0;
}

// The sky in bands and the far hills round it, a whole turn the picture's
// width: turning left moves them right
function backdrop() {
    rectfill(0, 0, 159, hz - 22, SKY0);
    rectfill(0, hz - 21, 159, hz - 8, SKY1);
    rectfill(0, hz - 7, 159, hz, SKY2);
    rectfill(0, hz + 1, 159, 119, HAZE);
    var o = (256 - flr(camH * 256.0)) & 255;
    blitpart(IMG.sky1, o, 0, min(160, 256 - o), 32, 0, hz - 31);
    if (256 - o < 160)
        blitpart(IMG.sky1, 0, 0, 160 - (256 - o), 32, 256 - o, hz - 31);
}

// The trees in view, out of the haze, big enough to see and not on top of
// the camera, and the flag, put in depth bins with their places on the
// screen. Worked out here rather than with plane.project: most are
// behind the camera or off to the side, and a few sums show it
function find() {
    var c = cos(camH), s = sin(camH);
    var cx = camX, cy = camY;
    var limit = far * 0.85;
    var n = 0;
    fill(head, -1);
    for (var i = 0; i < course.tn; i++) {
        var dx = course.tx[i] - cx, dy = course.ty[i] - cy;
        var d = dx * c + dy * s;   // its depth along the camera's heading
        if (d < NEAR || d > limit)
            continue;
        var l = dy * c - dx * s;   // and across, right positive
        var w = d * SPREAD + 4.0;
        if (l > w || l < 0.0 - w)
            continue;
        var k = FOCAL / d;         // screen pixels a world pixel there
        var sh = flr(course.th[i] * k + 0.5);
        if (sh < SMALL)
            continue;
        n = put(n, 80.0 + l * k, camZ - course.tz[i], k, sh, course.tk[i], d);
    }
    // the flag, as big as it must be to show from the tee
    var x = course.pinX[course.cur], y = course.pinY[course.cur];
    var dx = x - cx, dy = y - cy;
    var d = dx * c + dy * s;
    if (d > 2.0 && d < far) {
        var k = FOCAL / d;
        n = put(n, 80.0 + (dy * c - dx * s) * k, camZ - course.ground(x, y), k, flr(mid(9.0, 3.2 * k, 40.0)), 2, d);
    }
    count = n;
    bn = BINS - 1;
    bj = head[bn];
}

// One more thing to draw, at screen x, its foot dz under the camera at
// scale k, sh tall, of kind (0 broadleaf, 1 pine, 2 the flag), at depth d,
// if its foot is on the screen. Returns how many there are now
function put(n, sx, dz, k, sh, kind, d) {
    var sy = hz + dz * k;
    if (n >= 160 || sy < 0.0 || sy > 120.0 + sh || sx < 0.0 - sh || sx > 160.0 + sh)
        return n;
    px[n] = flr(sx);
    py[n] = flr(sy);
    ph[n] = sh;
    pk[n] = kind;
    var b = min(BINS - 1, flr(d) >> 1);
    next[n] = head[b];
    head[b] = n;
    return n + 1;
}

// Trees from the furthest left, while the tick has room; stage 0 when done
function trees() {
    sheet(IMG.trees);
    while (true) {
        while (bj < 0) {
            bn--;
            if (bn < 0) {
                stage = 0;
                sheet();
                return;
            }
            bj = head[bn];
        }
        var j = bj;
        var h = ph[j], k = pk[j], w;
        // a big one waits for a tick of its own: they cost about a unit a pixel
        if (unitsnow() + h * h > BUSY && unitsnow() > 2500)
            break;
        bj = next[j];
        if (k == 0) {
            w = max(1, h * 20 / 24);
            sspr(0, 0, 20, 24, px[j] - w / 2, py[j] - h + 1, w, h);
        } else if (k == 1) {
            w = max(1, h * 16 / 28);
            sspr(24, 0, 16, 28, px[j] - w / 2, py[j] - h + 1, w, h);
        } else {
            w = max(2, h * 8 / 12);
            sspr(44, 0, 8, 12, px[j], py[j] - h + 1, w, h);
        }
    }
    sheet();
}

// The picture copied to the screen: whole and opaque, which is the
// cheapest copy there is
function draw() {
    palt(0, false);
    blit(cache, 0, 0);
    palt(0, true);
    plane.view(camX, camY, camZ, camH, hz, FOV);
}

// The ball and its shadow on the ground under it
function drawBall() {
    var g = course.ground(ball.x, ball.y);
    if (plane.project(ball.x, ball.y, g, at) == 0 || at[3] < 1.0)
        return;
    var s = at[2];
    var rx = mid(1.0, s * 0.25, 4.0);
    var sx = flr(at[0]), sy = flr(at[1]);
    if (ball.state != ball.HOLED)
        ovalfill(sx - rx, sy - rx * 0.4, sx + rx, sy + rx * 0.4, SHADOW);
    if (ball.state == ball.HOLED)
        return;
    plane.project(ball.x, ball.y, ball.z, at);
    var r = s * 0.13;
    var bx = flr(at[0]), by = flr(at[1]);
    if (r < 0.7) {
        pset(bx, by - 1, BALL);
    } else if (r < 1.3) {
        rectfill(bx, by - 2, bx + 1, by - 1, BALL);
    } else {
        r = min(r, 4.0);
        circfill(bx, by - r, r, BALL);
        pset(bx + r * 0.5, by - r * 0.5, BALL_SHADE);
    }
}

// The aim: with the guide a ring where a full shot would land, without the
// wind; else a mark over the horizon the way it points
function drawAim(bx, by, a, carry, ring) {
    var c = cos(a), s = sin(a);
    if (!ring || carry <= 0.0) {
        if (plane.project(camX + c * 300.0, camY + s * 300.0, camZ, at) != 0) {
            var x = flr(at[0]);
            trifill(x - 3, hz - 9, x + 3, hz - 9, x, hz - 4, 10);
        }
        return;
    }
    var lx = bx + c * carry, ly = by + s * carry;
    var lz = course.ground(lx, ly);
    if (plane.project(lx, ly, lz, at) == 0 || at[3] < 2.0)
        return;
    var rx = max(3.0, at[2] * 4.0);
    var ry = max(1.5, rx * (camZ - lz) / at[3]);
    oval(at[0] - rx, at[1] - ry + 1, at[0] + rx, at[1] + ry + 1, 1);
    oval(at[0] - rx, at[1] - ry, at[0] + rx, at[1] + ry, 10);
}

// A putt's line: dots along the aim from the ball, as far as the pin
function drawLine(bx, by, a, d) {
    var c = cos(a), s = sin(a);
    var n = min(10, flr(d * 1.5) + 1);
    for (var i = 1; i <= n; i++) {
        var u = i * 0.6;
        var x = bx + c * u, y = by + s * u;
        if (plane.project(x, y, course.ground(x, y), at) != 0)
            pset(at[0], at[1], 7);
    }
}
