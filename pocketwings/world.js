// world: the landscapes, and the one being flown over.
//
// A landscape is three pictures and a palette, made by
// tools/pocketwings_assets.py: its heights (each pixel the ground's height
// in world pixels, one pixel a world pixel), its colours (with the sun's
// shading in them already), the hills on its horizon and the palette they
// are drawn in. The pictures are lazy: only the landscape being flown is
// read from the cart, so more landscapes cost no memory until chosen.
// Every landscape is 256 pixels square, and land.draw wraps it, so flying
// off one side comes back in on the other. Each also comes at half size,
// 128 square with its heights halved, which land.draw draws for some 8,000
// units less: the quicker levels of the picture draw that one, with the
// camera's place halved to match, and see the same landscape more coarsely.
// The flying always goes by the full-size heights.

const SIZE = 256;                  // world pixels across a landscape

var NAMES = ["GREEN VALLEY"];
var COUNT = 1;

var current = -1;
var heights, colours, sky;
var heights2, colours2;            // the same at half size
var water = 14;                    // the water's surface, world pixels
const LAND = 40.0;                 // the land's height in general, for placing the far hills
// the palette entries of the sky, the same in every landscape's palette
const SKY_TOP = 42, SKY = 43, SKY_LOW = 44, HAZE = 45;
// where a flight starts: over the river, heading east along it
var startX = 0.0, startY = 140.0, startZ = 62.0, startHdg = 0.0;

// Makes landscape n the one flown over
function load(n) {
    if (current == n)
        return;
    if (current >= 0) {
        img.drop(IMG.valley_h);
        img.drop(IMG.valley_c);
        img.drop(IMG.valley_h2);
        img.drop(IMG.valley_c2);
        img.drop(IMG.valley_sky);
    }
    loadpal(PAL.valley);
    heights = img.load(IMG.valley_h);
    colours = img.load(IMG.valley_c);
    heights2 = img.load(IMG.valley_h2);
    colours2 = img.load(IMG.valley_c2);
    sky = img.load(IMG.valley_sky);
    water = 14;
    current = n;
}

// The ground's height at a world point, wrapping
function ground(x, y) {
    return land.height(heights, x, y);
}
