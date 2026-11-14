// slope: the mountainside being skied, one of five.
//
// Its pictures, made by tools/powderrun_assets.py, hold only the relief of
// the snow (bumps, rollers, moguls, hollows) on a 256 pixel square that
// wraps, because land.draw wraps the world. The mountain's own slope can't
// be in a picture that wraps, so it is added here instead: it runs down the
// fall line, three across for every eight down the picture (or eight up,
// by the seed), so a straight run crosses the picture at a slant and comes
// back over the same snow only after some 2,000 pixels. How steep it is
// changes slowly with the distance skied, from smooth noise, between each
// slope's own bounds.
//
// Each slope also comes at half size (128 square, heights halved) for the
// quicker levels of the picture, as in Pocket Wings. Its pictures are lazy:
// only one slope's are in memory.
//
// Changing slopes has to be done with care. The engine reads a lazy picture
// through working memory taken from the free space at the top of memory,
// after the picture itself has its place. If the old slope's pictures are
// let go but not yet cleared up, the new 64 KB picture can land at the top,
// leave too little room above it for that working memory, and stop the game
// "out of memory". So setup() keeps RESERVE bytes for good, low in memory:
// with them taken, the free space at the top is always under 64 KB, the
// first picture of a new slope never fits there, and the engine clears up
// first. The old slope's pictures are then free and the new ones go in
// where they were. tools/powderrun_test.py --sessions tours every slope to
// check it.
//
// A seed makes a run repeatable and different from the next: which way
// the fall line runs, where the mountain steepens and which of the pines
// and boulders are there.

const SIZE = 256;
const COUNT = 5;

var NAMES = ["ALPINE VALLEY", "WINTER FOREST", "HIGH MOUNTAINS", "SUNSET RIDGE", "FROZEN WILDERNESS"];
var STEEP_LO = [0.14, 0.10, 0.18, 0.14, 0.12];     // the least steepness, rise over run
var STEEP_SPAN = [0.24, 0.18, 0.30, 0.24, 0.22];   // ...and how much more it gets
var SLIPS = [1.0, 1.25, 0.95, 1.0, 0.55];          // the snow's hold: powder more, ice less
var THICK = [700, 550, 800, 700, 800];             // how many in 1,000 pines and boulders a Free Ride has

var HEIGHTS = [IMG.alpine_h, IMG.forest_h, IMG.high_h, IMG.sunset_h, IMG.frozen_h];
var COLOURS = [IMG.alpine_c, IMG.forest_c, IMG.high_c, IMG.sunset_c, IMG.frozen_c];
var HEIGHTS2 = [IMG.alpine_h2, IMG.forest_h2, IMG.high_h2, IMG.sunset_h2, IMG.frozen_h2];
var COLOURS2 = [IMG.alpine_c2, IMG.forest_c2, IMG.high_c2, IMG.sunset_c2, IMG.frozen_c2];
var SKIES = [IMG.alpine_sky, IMG.forest_sky, IMG.high_sky, IMG.sunset_sky, IMG.frozen_sky];
var PALS = [PAL.alpine, PAL.forest, PAL.high, PAL.sunset, PAL.frozen];
var OBJECTS = [DATA.alpine_objects, DATA.forest_objects, DATA.high_objects, DATA.sunset_objects,
               DATA.frozen_objects];

var FALL = 0.0;                    // the fall line's heading, turns; set by setSeed()
var heights, colours, heights2, colours2, sky;
var current = -1;
var slip = 1.0;
var lo = 0.14, span = 0.24;
var seed = 1;
var extra = 0.0;                   // steeper by this, as an Endless Run goes on

// palette entries the view uses, the same on every slope
const HAZE = 29;                   // the sky's lowest band, and the fog
const SHADOW = 17;                 // a shadow on the snow

const RESERVE = 28000;              // bytes kept low in memory for good: see above
var reserve;

// First thing in init(), before anything else takes memory
function setup() {
    reserve = new Uint8Array(RESERVE);
}

// Slope n's pictures, palette and objects, the last slope's let go. Slow
// on an iPod whose disk is resting: only between runs.
function load(n) {
    if (current == n)
        return;
    if (current >= 0) {
        // nothing may hold the last slope's pictures, or they stay
        heights = null;
        colours = null;
        heights2 = null;
        colours2 = null;
        sky = null;
        img.drop(HEIGHTS[current]);
        img.drop(COLOURS[current]);
        img.drop(HEIGHTS2[current]);
        img.drop(COLOURS2[current]);
        img.drop(SKIES[current]);
    }
    loadpal(PALS[n]);
    heights = img.load(HEIGHTS[n]);
    colours = img.load(COLOURS[n]);
    heights2 = img.load(HEIGHTS2[n]);
    colours2 = img.load(COLOURS2[n]);
    sky = img.load(SKIES[n]);
    slip = SLIPS[n];
    lo = STEEP_LO[n];
    span = STEEP_SPAN[n];
    current = n;
    objects.load(data.read(OBJECTS[n]));
    setSeed(seed);
}

// A run's seed, 1 or more: the fall line's way, the steepness and the layout
function setSeed(sd) {
    seed = sd;
    FALL = atan2(3.0, 8.0);
    if ((sd & 1) == 0)
        FALL += 0.5;
    extra = 0.0;
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
    return lo + extra + span * noise.at(u, 0.5, 11 + seed, 2);
}
