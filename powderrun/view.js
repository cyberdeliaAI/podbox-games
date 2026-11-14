// view: the picture. The sky and the mountains, the slope through
// land.draw fading into haze, and the skier with a shadow on the snow.
//
// The slope's picture is level; the mountain's slope is shown by where the
// horizon goes. Looking down a slope is the same as looking at level
// ground with the head tipped up by its angle, which lowers that ground's
// horizon on the screen by FOCAL times the slope. So the sky and its
// mountains stay on the level horizon at LEVEL, and the snow's horizon sits
// below it by the slope as the camera faces it: the snow drops away into
// the haze, the mountains stand across the valley. It moves as the
// mountain steepens and as the skier turns across it.
//
// The camera hangs BEHIND world pixels back and EYE up, its heading and
// height eased so moguls don't shake it.

const FOV = 0.22;
const FOCAL = 96.7;                // 80 / tan(FOV / 2)
const LEVEL = 30;                  // the level horizon's row
const FOOT = 46;                   // the row the sky strip's bottom goes on: the mountains' feet, below eye level
const BEHIND = 26.0, EYE = 6.0;    // the camera behind and above the skier
const FEET = 98;                   // the lowest row the skier's feet are let go to

var cx = 0.0, cy = 0.0, cz = 0.0, ch = 0.0;   // the camera: place, height, heading
var hz = 60.0;                     // the snow's horizon row
var at = [0.0, 0.0, 0.0, 0.0];

function reset() {
    ch = skier.h;
    cz = skier.g + EYE;
    update(1.0);
}

function update(k) {
    // the heading follows the skier's, a little behind
    var d = skier.h - ch;
    d -= flr(d + 0.5);
    ch += d * 0.2 * k;
    ch -= flr(ch);
    cx = skier.x - cos(ch) * BEHIND;
    cy = skier.y - sin(ch) * BEHIND;
    var want = max(skier.g + skier.hrel, slope.ground(cx, cy) + 2.0) + EYE;
    cz += (want - cz) * 0.25 * k;
    // the horizon: below the level one by the slope as the camera faces it;
    // but when the skier is well below the camera (down in a dip, the
    // camera up on a bump) the camera tips down to keep them in view
    var o = ch - slope.FALL;
    o -= flr(o + 0.5);
    var tilt = slope.steep(skier.s) * cos(o);
    hz += (LEVEL + FOCAL * tilt - hz) * 0.15 * k;
    var below = (cz - skier.g - skier.hrel) * FOCAL / BEHIND;
    if (hz > FEET - below)
        hz = FEET - below;
}

function draw() {
    var q = quality.level;
    var sc = quality.HALF[q] != 0 ? 0.5 : 1.0;
    var far = flr(quality.FAR[q] * sc);
    // the sky and its mountains: one opaque copy, turned with the camera
    var o = flr((1.0 - ch) * 256.0) & 255;
    palt(0, false);
    blitpart(slope.sky, o, 0, min(160, 256 - o), 64, 0, FOOT - 63);
    if (o > 96)
        blitpart(slope.sky, 0, 0, 160 - (256 - o), 64, 256 - o, FOOT - 63);
    palt(0, true);
    rectfill(0, FOOT + 1, 159, 119, slope.HAZE);
    plane.view(cx * sc, cy * sc, cz * sc, ch, flr(hz), FOV);
    plane.fog(far * 0.55, far, slope.HAZE);
    if (sc < 1.0)
        land.draw(slope.heights2, slope.colours2, far, 1, quality.COARSE[q]);
    else
        land.draw(slope.heights, slope.colours, far, 1, quality.COARSE[q]);
    skierSprite(sc);
}

// The skier from behind in the pose of the moment, over a shadow
function skierSprite(sc) {
    if (plane.project(skier.x * sc, skier.y * sc, skier.g * sc, at) != 0) {
        var r = mid(2.0, at[2] * 4.0 / sc, 8.0);
        fillp(0xa5a5);
        ovalfill(at[0] - r, at[1] - r / 3.0, at[0] + r, at[1] + r / 3.0, slope.SHADOW);
        fillp();
    }
    if (plane.project(skier.x * sc, skier.y * sc, (skier.g + skier.hrel) * sc, at) != 0) {
        var c = skier.carve, f = 0;
        if (skier.air)
            f = 7;
        else if (c < -0.55)
            f = 2;
        else if (c < -0.18)
            f = 1;
        else if (c > 0.55)
            f = 4;
        else if (c > 0.18)
            f = 3;
        spr(64 + f * 2, at[0] - 8, at[1] - 15, 2, 2);
    }
}
