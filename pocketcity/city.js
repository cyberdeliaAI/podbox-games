// city: the district on the screen, and what is where in it.
//
// The district is the active map: 128 by 128 cells of 8 pixels, one tile
// each (tools/pocketcity_assets.py). Drawing a screenful of cells with
// map() every tick would cost about 12,500 units, the whole of a tick on
// an iPod Video playing music. So the cells are drawn once into a picture
// a little bigger than the screen, a ring BW by BH cells that keeps cell
// (c, r) at (c mod BW, r mod BH), and only the column or row that comes
// into view is drawn into it as the camera moves. The screen is then
// copied out of the ring opaque, in up to four parts where it wraps: about
// 1,300 units, plus some 550 for each column or row drawn.
//
// No tile uses colour 0, and no cell is empty, so every pixel of the ring
// is drawn over and nothing old shows through.

const BW = 22, BH = 17;            // the ring, cells: one more each way than the screen needs
const SOLID = 1, WATER = 2, GRASS = 4, WALK = 8, ROAD = 16;   // the tiles' flags

var ring;
var bx = 0, by = 0;                // the first column and row the ring holds
var whole = true;                  // the ring must be drawn afresh
var mw = 128, mh = 128;            // the map, cells
var drawn = 0;                     // columns and rows drawn this tick, for the tests

// Once: the ring
function setup() {
    ring = img(BW * 8, BH * 8);
    mw = mapw();
    mh = maph();
    whole = true;
}

// The ring brought up to a camera whose top left cell is cx, cy: afresh
// when it jumped, else the columns and rows that came into view
function follow(cx, cy) {
    drawn = 0;
    if (whole || abs(cx - bx) >= BW || abs(cy - by) >= BH) {
        bx = cx;
        by = cy;
        for (var c = bx; c < bx + BW; c++)
            column(c);
        whole = false;
        return;
    }
    while (bx < cx) {
        column(bx + BW);
        bx++;
    }
    while (bx > cx) {
        bx--;
        column(bx);
    }
    while (by < cy) {
        row(by + BH);
        by++;
    }
    while (by > cy) {
        by--;
        row(by);
    }
}

// Column c of the map, the ring's rows by to by + BH - 1, in its slot
function column(c) {
    var x = (c % BW) * 8;
    var r0 = by, split = BH - by % BH;     // rows before the ring wraps
    target(ring);
    map(c, r0, x, (r0 % BH) * 8, 1, split);
    if (split < BH)
        map(c, r0 + split, x, 0, 1, BH - split);
    target(SCREEN);
    drawn++;
}

// Row r of the map, the ring's columns bx to bx + BW - 1, in its slot
function row(r) {
    var y = (r % BH) * 8;
    var c0 = bx, split = BW - bx % BW;
    target(ring);
    map(c0, r, (c0 % BW) * 8, y, split, 1);
    if (split < BW)
        map(c0 + split, r, 0, y, BW - split, 1);
    target(SCREEN);
    drawn++;
}

// The screen from the ring, its top left at world pixel cx, cy, opaque
function draw(cx, cy) {
    var rw = BW * 8, rh = BH * 8;
    var ox = cx % rw, oy = cy % rh;
    var w1 = min(160, rw - ox), h1 = min(120, rh - oy);
    palt(0, false);
    blitpart(ring, ox, oy, w1, h1, 0, 0);
    if (w1 < 160)
        blitpart(ring, 0, oy, 160 - w1, h1, w1, 0);
    if (h1 < 120) {
        blitpart(ring, ox, 0, w1, 120 - h1, 0, h1);
        if (w1 < 160)
            blitpart(ring, 0, 0, 160 - w1, 120 - h1, w1, h1);
    }
    palt(0, true);
}

// The flags of the cell under a world pixel; off the map, solid water
function at(x, y) {
    var c = flr(x) >> 3, r = flr(y) >> 3;
    if (c < 0 || r < 0 || c >= mw || r >= mh)
        return SOLID | WATER;
    return fget(mget(c, r));
}
