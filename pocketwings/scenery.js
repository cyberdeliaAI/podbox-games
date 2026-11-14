// scenery: trees, palms, houses, rocks and the landmarks standing on the
// landscape. Finding the ones that matter, telling which a hill hides, and
// drawing them.
//
// They come from the landscape's data file (made by
// tools/pocketwings_assets.py). Billboards cost the iPod about five units a
// pixel, so these are drawn by the game instead, as in Powder Run:
// projected with plane.project and copied out of images/scenery.png, which
// holds each kind at a run of sizes on the screen, the smaller ones already
// part way into the haze. Far ones first, near ones last, the aircraft over
// them all.
//
// Looking at every one every tick would cost thousands of units, so they
// are gathered a slice at a time: each tick looks at a twelfth of them,
// keeping those in a wedge ahead of the camera with how much each matters
// (how far ahead plus how far aside; a landmark always first, and seen
// from further off). Every twelfth tick the most important become the list
// drawn, as many as the picture's level allows.
//
// land.draw would hide a billboard behind a hill; these it can't. So each
// tick two of the list are looked at along the line from the camera: if the
// ground rises above that line on the way, the hill hides it until the next
// look.
//
// Each is kept at the copy of itself nearest the camera when gathered, as
// world pixels that may run past the picture's edge, and the view draws
// from the camera's copy nearest the same place (land.draw wraps, so the
// landscape is the same).

const MAXN = 140;                  // scenery and landmarks a landscape may have
const NEAR = 48;                   // gathered at most
const DRAW = 24;                   // drawn at most
const SLICES = 12;                 // ticks to look through them all
const KINDS = 12;
const FIRST_MARK = 6;              // kinds from here on are landmarks
const LUT = 128;                   // heights on the screen the size table covers
const CLOSE = 6.0;                 // nearer the camera than this, not drawn
const MARK_FAR = 1.8;              // landmarks are looked for this much further

var TALL = [4.0, 5.0, 5.0, 3.0, 3.0, 3.0, 12.0, 10.0, 12.0, 8.0, 8.0, 11.0];   // world pixels tall as drawn

// images/scenery.png: where each size is, and for each kind and height the size to draw
var ax = new Int32Array(120), ay = new Int32Array(120), aw = new Int32Array(120), ah = new Int32Array(120);
var lut = new Uint8Array(KINDS * LUT);

var n = 0;
var ox = new Int32Array(MAXN), oy = new Int32Array(MAXN), ok = new Uint8Array(MAXN);
var oz = new Int32Array(MAXN);     // the ground's height at each

// the gathering
var gi = new Int32Array(NEAR), gx = new Int32Array(NEAR), gy = new Int32Array(NEAR);
var gw = new Int32Array(NEAR);
var gN = 0, scanAt = 0;
var sx = 0, sy = 0, sc = 1.0, ss = 0.0;
var hist = new Int32Array(16);

// the list drawn
var refX = 0.0, refY = 0.0;
var di = new Int32Array(DRAW), dN = 0, used = 0;
var bx = new Int32Array(DRAW), by = new Int32Array(DRAW);
var dep = new FixArray(DRAW);
var order = new Int32Array(DRAW);
var vis = new Uint8Array(DRAW);    // not behind a hill, at the last look
var shown = new Uint8Array(DRAW);  // drawn this frame
var lookAt = 0;
var at = [0.0, 0.0, 0.0, 0.0];

// Where images/scenery.png holds what, from data/scenery.json, and for
// each kind and height on the screen the size to draw: the nearest by
// ratio, so a height past the halfway between two sizes (their geometric
// mean) takes the bigger; 255 for too small to draw
function setup(d) {
    for (var i = 0; i < d.x.length; i++) {
        ax[i] = d.x[i];
        ay[i] = d.y[i];
        aw[i] = d.w[i];
        ah[i] = d.h[i];
    }
    var first = 0;
    for (var k = 0; k < KINDS; k++) {
        var sz = k < FIRST_MARK ? d.sizes : d.marks;
        var j = 0;
        for (var h = 0; h < LUT; h++) {
            if (h < sz[0] - 1) {
                lut[k * LUT + h] = 255;
                continue;
            }
            while (j + 1 < sz.length && h * h >= sz[j] * sz[j + 1])
                j++;
            lut[k * LUT + h] = first + j;
        }
        first += sz.length;
    }
}

// The scenery and landmarks of the landscape just loaded, from its data
function load(d) {
    n = 0;
    var m = min(d.x.length, MAXN - world.MARKS_EACH);
    for (var i = 0; i < m; i++) {
        ox[n] = d.x[i];
        oy[n] = d.y[i];
        ok[n] = d.k[i];
        n++;
    }
    for (var i = 0; i < world.MARKS_EACH; i++) {
        ox[n] = d.mx[i];
        oy[n] = d.my[i];
        ok[n] = d.mk[i];
        n++;
    }
    for (var i = 0; i < n; i++)
        oz[i] = world.ground(ox[i], oy[i]);
    reframe(view.cx, view.cy);
}

// After a jump to a new place: the list's frame there, the list empty
function reframe(x, y) {
    refX = flr(x);
    refY = flr(y);
    dN = 0;
    gN = 0;
    scanAt = 0;
    fill(hist, 0);
}

// The shortest way round the wrapping picture, -128 to 128
function wrapd(d) {
    if (d > 128.0)
        d -= 256.0;
    else if (d < -128.0)
        d += 256.0;
    if (d > 128.0)
        d -= 256.0;
    else if (d < -128.0)
        d += 256.0;
    return d;
}

// A slice of the gathering, once a tick, ahead of the camera at cx, cy
// facing h: out to range, and cap of them for the list
function scan(cx, cy, h, range, cap) {
    if (scanAt == 0) {
        sx = flr(cx);
        sy = flr(cy);
        sc = cos(h);
        ss = sin(h);
    }
    var end = min(n, scanAt + (n + SLICES - 1) / SLICES);
    for (var i = scanAt; i < end; i++) {
        var dx = ((ox[i] - sx + 384) & 255) - 128, dy = ((oy[i] - sy + 384) & 255) - 128;
        var f = dx * sc + dy * ss;
        var mark = ok[i] >= FIRST_MARK;
        if (f < -8.0 || f > (mark ? range * MARK_FAR : range))
            continue;
        var l = dy * sc - dx * ss;
        if (l < 0.0)
            l = 0.0 - l;
        if (l > f * 0.9 + 12.0 || gN >= NEAR)
            continue;
        var w = mark ? 0 : min(15, 1 + flr((max(f, 0.0) + l) / 16.0));
        gi[gN] = i;
        gx[gN] = sx + dx;
        gy[gN] = sy + dy;
        gw[gN] = w;
        hist[w]++;
        gN++;
    }
    scanAt = end;
    if (scanAt >= n) {
        choose(cap);
        gN = 0;
        scanAt = 0;
    }
}

// The gathering done: the cap most important become the list
function choose(cap) {
    cap = min(cap, DRAW);
    used = cap;
    var cut = 0, c = 0;
    while (cut < 16 && c + hist[cut] <= cap) {
        c += hist[cut];
        cut++;
    }
    var room = cap - c;
    var m = 0;
    for (var j = 0; j < gN; j++) {
        var w = gw[j];
        if (w > cut)
            continue;
        if (w == cut) {
            if (room <= 0)
                continue;
            room--;
        }
        di[m] = gi[j];
        bx[m] = gx[j];
        by[m] = gy[j];
        order[m] = m;
        vis[m] = 1;
        m++;
    }
    dN = m;
    refX = sx;
    refY = sy;
    fill(hist, 0);
}

// A place in the list's frame
function frameX(x) {
    return refX + wrapd(x - refX);
}

// ...and down
function frameY(y) {
    return refY + wrapd(y - refY);
}

// Two of the list looked at from the camera (in the list's frame): is a
// hill in the way?
function look(cx, cy, cz) {
    for (var t = 0; t < 2 && dN > 0; t++) {
        if (lookAt >= dN)
            lookAt = 0;
        var j = lookAt++;
        var i = di[j];
        var ex = bx[j] - cx, ey = by[j] - cy, ez = oz[i] + TALL[ok[i]] * 0.6 - cz;
        var seen = 1;
        for (var s = 1; s < 4; s++) {
            var u = s * 0.25;
            if (world.ground(cx + ex * u, cy + ey * u) > cz + ez * u) {
                seen = 0;
                break;
            }
        }
        vis[j] = seen;
    }
}

// Each frame before drawing: the depths from the camera, far to near, by an
// insertion sort (the order hardly changes from one frame to the next)
function sort(cx, cy, ch) {
    var m = dN, c = cos(ch), s = sin(ch);
    for (var j = 0; j < m; j++)
        dep[j] = (bx[j] - cx) * c + (by[j] - cy) * s;
    for (var a = 1; a < m; a++) {
        var o = order[a], d = dep[o], b = a - 1;
        while (b >= 0 && dep[order[b]] < d) {
            order[b + 1] = order[b];
            b--;
        }
        order[b + 1] = o;
    }
}

// Draws the list far to near; sc is the world's scale as the view draws it
function draw(sc) {
    for (var a = 0; a < dN; a++) {
        var j = order[a], i = di[j], k = ok[i];
        shown[j] = 0;
        if (dep[j] < CLOSE || vis[j] == 0)
            continue;
        if (plane.project(bx[j] * sc, by[j] * sc, oz[i] * sc, at) == 0)
            continue;
        var h = flr(TALL[k] * sc * at[2]);
        if (h >= LUT)
            h = LUT - 1;
        var z = lut[k * LUT + h];
        if (z == 255)
            continue;
        var w = aw[z];
        var x = flr(at[0]) - w / 2;
        if (x >= 160 || x + w <= 0)
            continue;
        blitpart(IMG.scenery, ax[z], ay[z], w, ah[z], x, flr(at[1]) - ah[z] + 1, i & 1);
        shown[j] = 1;
    }
}
