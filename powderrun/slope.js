// slope: the mountainside being skied.
//
// Its pictures, made by tools/powderrun_assets.py, hold only the relief of
// the snow (bumps, rollers, moguls, hollows) on a 256 pixel square that
// wraps, because land.draw wraps the world. The mountain's own slope can't
// be in a picture that wraps, so it is added here instead: it runs down the
// fall line, three across for every eight down the picture, so a straight
// run crosses the picture at a slant and comes back over the same snow only
// after some 2,000 pixels. How steep it is changes slowly with the distance
// skied, between about 8 and 21 degrees, from smooth noise.
//
// The pictures are lazy, and each slope also comes at half size (128
// square, heights halved) for the quicker levels of the picture, as in
// Pocket Wings.

const SIZE = 256;

var NAMES = ["ALPINE VALLEY"];
var FALL = 0.0;                    // the fall line's heading, turns; set in load()
var heights, colours, heights2, colours2, sky;
var current = -1;
// palette entries the view uses
const HAZE = 29;                   // the sky's lowest band, and the fog
const SHADOW = 17;                 // a shadow on the snow

function load(n) {
    if (current == n)
        return;
    loadpal(PAL.alpine);
    heights = img.load(IMG.alpine_h);
    colours = img.load(IMG.alpine_c);
    heights2 = img.load(IMG.alpine_h2);
    colours2 = img.load(IMG.alpine_c2);
    sky = img.load(IMG.alpine_sky);
    FALL = atan2(3.0, 8.0);
    current = n;
}

// The snow's height at a point, wrapping. land.height gives each pixel's
// height whole, so the snow would be a staircase under the skis and every
// step would throw the skier in the air: the four pixels round the point
// are blended instead.
function ground(x, y) {
    var x0 = flr(x), y0 = flr(y);
    var fx = x - x0, fy = y - y0;
    var a = land.height(heights, x0, y0), b = land.height(heights, x0 + 1, y0);
    var c = land.height(heights, x0, y0 + 1), d = land.height(heights, x0 + 1, y0 + 1);
    return (a + (b - a) * fx) * (1.0 - fy) + (c + (d - c) * fx) * fy;
}

// How steep the mountain is, as a rise over a run, s world pixels down it.
// s is a whole number that passes 32767 after ten minutes or so, and a
// whole number that big mixed with a fraction wraps: so it is divided as a
// whole number first and only the rest made a fraction.
function steep(s) {
    var u = s / 400 + (s % 400) / 400.0;
    return 0.14 + 0.24 * noise.at(u, 0.5, 11, 2);
}
