// world: the six landscapes, and the one being flown over.
//
// A landscape is five pictures, a palette and a data file, made by
// tools/pocketwings_assets.py: its heights (each pixel the ground's height
// in world pixels, one pixel a world pixel), its colours (with the sun's
// shading in them already), the same two at half size (128 square, heights
// halved), the hills on its horizon, and where a flight starts, the water's
// height, the scenery and the five landmarks. Every landscape is 256
// pixels square, and land.draw wraps it, so flying off one side comes back
// in on the other. The quicker levels of the picture draw the half-size
// one, with the camera's place halved to match, for some 8,000 units less;
// the flying always goes by the full-size heights.
//
// The pictures are lazy: only the landscape being flown is in memory.
// Changing landscapes has to be done with care (as in Powder Run). The
// engine reads a lazy picture through working memory taken from the free
// space at the top of memory, after the picture has its place. If the old
// landscape's pictures are let go but not yet cleared up, a new 64 KB
// picture can land at the top and leave too little room above it, and the
// game stops "out of memory". So setup() keeps RESERVE bytes for good, low
// in memory: with them taken, the free space at the top stays under 64 KB,
// the first picture of a new landscape never fits there, and the engine
// clears up first. And nothing the game keeps is put together at run time:
// a kept string high in memory would leave too little room above it.

const SIZE = 256;                  // world pixels across a landscape
const COUNT = 6;
const RESERVE = 40000;             // bytes kept low in memory for good: see above

var NAMES = ["GREEN VALLEY", "CORAL ISLANDS", "HIGH ALPS", "RED CANYON", "FROZEN LAKES", "FIRE MOUNTAINS"];
// each landscape's landmarks, in the order of its data file
var MARKS = ["THE OLD MILL", "CHURCH TOWER", "LAKESIDE CHAPEL", "HILLTOP NEEDLE", "FOREST GATE",
             "CAPE LIGHTHOUSE", "PEAK STONE", "OBSERVATORY", "SEA ARCH", "OLD FORT",
             "SUMMIT DOME", "LAKE CHAPEL", "ROCK GATE", "GLACIER SPIRE", "MEADOW MILL",
             "GREAT ARCH", "NEEDLE ROCK", "OLD MISSION", "WIND PUMP", "SUN TEMPLE",
             "WATCHTOWER", "LAKE LIGHT", "ICE CHAPEL", "STONE PILLAR", "SNOW MILL",
             "CRATER DOME", "OLD LIGHTHOUSE", "LAVA ARCH", "FIRE WATCH", "BLACK NEEDLE"];
const MARKS_EACH = 5;

var HEIGHTS = [IMG.valley_h, IMG.islands_h, IMG.alps_h, IMG.canyon_h, IMG.frozen_h, IMG.volcano_h];
var COLOURS = [IMG.valley_c, IMG.islands_c, IMG.alps_c, IMG.canyon_c, IMG.frozen_c, IMG.volcano_c];
var HEIGHTS2 = [IMG.valley_h2, IMG.islands_h2, IMG.alps_h2, IMG.canyon_h2, IMG.frozen_h2, IMG.volcano_h2];
var COLOURS2 = [IMG.valley_c2, IMG.islands_c2, IMG.alps_c2, IMG.canyon_c2, IMG.frozen_c2, IMG.volcano_c2];
var SKIES = [IMG.valley_sky, IMG.islands_sky, IMG.alps_sky, IMG.canyon_sky, IMG.frozen_sky, IMG.volcano_sky];
var PALS = [PAL.valley, PAL.islands, PAL.alps, PAL.canyon, PAL.frozen, PAL.volcano];
var DATAS = [DATA.valley, DATA.islands, DATA.alps, DATA.canyon, DATA.frozen, DATA.volcano];

var current = -1;
var heights, colours, sky;
var heights2, colours2;            // the same at half size
var water = 14;                    // the water's surface, world pixels
var reserve;
const LAND = 40.0;                 // the land's height in general, for placing the far hills
// the palette entries of the sky, the same in every landscape's palette
const SKY_TOP = 42, SKY = 43, SKY_LOW = 44, HAZE = 45;
// where a flight starts
var startX = 0.0, startY = 140.0, startZ = 62.0, startHdg = 0.0;
// the landmarks' places
var markX = new Int32Array(MARKS_EACH), markY = new Int32Array(MARKS_EACH);

// First thing in init(), before anything else takes memory
function setup() {
    reserve = new Uint8Array(RESERVE);
}

// Makes landscape n the one flown over, the last one's pictures let go.
// Slow on an iPod whose disk is resting: only from the start screen.
function load(n) {
    if (current == n)
        return;
    if (current >= 0) {
        // nothing may hold the last landscape's pictures, or they stay
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
    current = n;
    var d = data.read(DATAS[n]);
    startX = d.start[0] * 1.0;
    startY = d.start[1] * 1.0;
    startZ = d.start[2] * 1.0;
    startHdg = d.start[3] * 1.0;
    water = d.water;
    for (var i = 0; i < MARKS_EACH; i++) {
        markX[i] = d.mx[i];
        markY[i] = d.my[i];
    }
    scenery.load(d);
}

// The ground's height at a world point, wrapping
function ground(x, y) {
    return land.height(heights, x, y);
}
