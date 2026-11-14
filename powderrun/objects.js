// objects: the pines and boulders on the slope. Finding the ones that
// matter, drawing them with the skier, and telling what the skier runs
// into.
//
// They come from the slope's data file (data/<slope>_objects.json, made by
// tools/powderrun_assets.py), placed on the wrapping picture with room
// between every two.
//
// Looking through all of them every tick would cost thousands of units, so
// they are gathered a slice at a time: each tick looks at an eighth of them,
// keeping those in a wedge ahead of the skier, with how much each matters:
// how far ahead it is, plus how far off the skier's line, doubled. Every
// eighth tick the gathering is done and the most important ones, as many as
// the picture's level allows, become the list that is drawn and that the
// skier can run into. Nothing is ever hit that isn't drawn, and what stands
// in the skier's way always comes first.
//
// Each is kept at the copy of itself nearest the skier when gathered, as
// world pixels that may run past the picture's edge. The view draws from
// the camera's copy nearest the same place (land.draw wraps, so the snow
// is the same), which keeps everything in one frame across the wrap.
//
// Billboards cost the iPod about five units a pixel, so these are drawn by
// the game instead: projected with plane.project and copied out of
// images/objects.png, which holds each kind at a run of sizes on the screen, the
// smaller ones already in the haze. Far ones first, the skier among them by
// distance, near ones last. They don't hide behind the snow's rises as
// billboards would; on a slope seen from above that hardly shows.

const MAXN = 200;                  // objects a slope may have
const NEAR = 64;                   // gathered at most
const DRAW = 24;                   // drawn at most
const SLICES = 8;                  // ticks to look through them all
const SMALL = 0, LARGE = 1, STONE = 2;
const CLOSE = 10.0;                // nearer the camera than this, not drawn: it would fill the screen
const LUT = 128;                   // heights on the screen the size table covers
const BESIDE = 5.0;                // nearer the camera than the skier by this, an object is past
                                   // them: in the way, it is left out. Nearer still is beside them

var TALL = [8.0, 12.0, 4.0];       // world pixels tall as drawn (the skier is 4.3)
var HALFW = [1.6, 3.0, 4.0];       // half as wide
var REACH = [2.2, 3.2, 4.2];       // how near the skier's middle can come
var HIGH = [7.0, 11.0, 3.0];       // how high above the snow they still stop a skier

// images/objects.png: where each size is, and for each kind and height the size to draw
var ax = new Int32Array(40), ay = new Int32Array(40), aw = new Int32Array(40), ah = new Int32Array(40);
var lut = new Uint8Array(3 * LUT);

var n = 0;
var ox = new Int32Array(MAXN), oy = new Int32Array(MAXN), ok = new Uint8Array(MAXN);
var oz = new FixArray(MAXN);       // the snow's height at each
var rank = new Int32Array(MAXN);   // 0 to 999, from the run's seed: in play while under keep
var on = new Uint8Array(MAXN);
var keep = 1000;

// the gathering: object, place in the frame of refX, refY, how much it
// matters in sixteens (hist counts them) and how far from the camera
var gi = new Int32Array(NEAR), gx = new Int32Array(NEAR), gy = new Int32Array(NEAR);
var gw = new Int32Array(NEAR);
var gN = 0, scanAt = 0;
var sx = 0, sy = 0, sc = 1.0, ss = 0.0;   // the skier's place, whole, and heading this gathering
var hist = new Int32Array(16);

// the list drawn and run into
var refX = 0.0, refY = 0.0;        // the frame of the list
var di = new Int32Array(DRAW), dN = 0, used = 0;
var bx = new FixArray(DRAW), by = new FixArray(DRAW), bz = new FixArray(DRAW);
var dep = new FixArray(DRAW);      // each one's depth this frame
var order = new Int32Array(DRAW);  // far to near, kept from frame to frame
var shown = new Uint8Array(DRAW);  // drawn this frame
var split = 0;                     // order[split] on are nearer than the skier
var pd = 0.0, pl = 0.0;            // the skier's depth and side from the camera
var camX = 0.0, camY = 0.0;
var at = [0.0, 0.0, 0.0, 0.0];

// Where images/objects.png holds what, from data/objects.json
function setup(d) {
    for (var i = 0; i < d.x.length; i++) {
        ax[i] = d.x[i];
        ay[i] = d.y[i];
        aw[i] = d.w[i];
        ah[i] = d.h[i];
    }
    for (var i = 0; i < 3 * LUT; i++)
        lut[i] = d.lut[i];
}

// The objects of the slope just loaded, all in play
function load(d) {
    n = min(d.x.length, MAXN);
    for (var i = 0; i < n; i++) {
        ox[i] = d.x[i];
        oy[i] = d.y[i];
        ok[i] = d.k[i];
        oz[i] = slope.ground(ox[i], oy[i]);
        rank[i] = 0;
        on[i] = 1;
    }
    keep = 1000;
    clear();
}

// Forgets the lists, for a new run or a jump to another place
function clear() {
    gN = 0;
    dN = 0;
    scanAt = 0;
}

// A run's layout: each object's rank from the seed, and keep in 1,000 of
// them in play to start with
function seed(sd, k) {
    var g = new Int32Array(2);
    rng.seed(g, sd);
    for (var i = 0; i < n; i++)
        rank[i] = rng.rnd(g, 1000);
    keep = k;
    for (var i = 0; i < n; i++)
        on[i] = rank[i] < keep ? 1 : 0;
    clear();
}

// More of them in play, keep in 1,000: each comes in only once it is out
// of sight, so nothing appears in front of the skier
function thicken(k) {
    keep = max(keep, k);
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

// A slice of the gathering, once a tick: those in a wedge ahead of the
// skier out to range. cap is how many the list may draw. Whole pixels are
// near enough to gather by, and cheaper.
function scan(range, cap) {
    if (scanAt == 0) {
        sx = flr(skier.x);
        sy = flr(skier.y);
        sc = cos(skier.h);
        ss = sin(skier.h);
    }
    var end = min(n, scanAt + (n + SLICES - 1) / SLICES);
    for (var i = scanAt; i < end; i++) {
        var dx = ((ox[i] - sx + 384) & 255) - 128, dy = ((oy[i] - sy + 384) & 255) - 128;
        var f = dx * sc + dy * ss;
        if (on[i] == 0) {
            if (rank[i] < keep && (f < -40.0 || f > 150.0))
                on[i] = 1;
            continue;
        }
        if (f < -30.0 || f > range)
            continue;
        var l = dy * sc - dx * ss;
        if (l < 0.0)
            l = 0.0 - l;
        if (l > f * 0.9 + 30.0 || gN >= NEAR)
            continue;
        var w = flr((max(f, 0.0) + l * 2.0) / 16.0);
        if (w > 15)
            w = 15;
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

// The gathering done: the cap most important become the list, by how many
// fell in each sixteen pixels of importance
function choose(cap) {
    cap = min(cap, DRAW);
    used = cap;
    var cut = 0, c = 0;
    while (cut < 16 && c + hist[cut] <= cap) {
        c += hist[cut];
        cut++;
    }
    var room = cap - c;            // from the bucket at the cut, the first that come
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
        var i = gi[j];
        di[m] = i;
        bx[m] = gx[j];
        by[m] = gy[j];
        bz[m] = oz[i];
        order[m] = m;
        m++;
    }
    dN = m;
    refX = sx;
    refY = sy;
    fill(hist, 0);
}

// After the skier moves to a new place (a new run): the list's frame there
function reframe() {
    refX = flr(skier.x);
    refY = flr(skier.y);
    dN = 0;
}

// The skier's place in the list's frame
function frameX(x) {
    return refX + wrapd(x - refX);
}

// ...and down
function frameY(y) {
    return refY + wrapd(y - refY);
}

var hitX = 0.0, hitY = 0.0;        // the push out of what hit() found

// The object the skier is running into, or -1, with the push out in hitX, hitY
function hit() {
    var px = frameX(skier.x), py = frameY(skier.y), up = skier.hrel;
    for (var j = 0; j < dN; j++) {
        var i = di[j], k = ok[i];
        var dx = px - bx[j], dy = py - by[j];
        var r = REACH[k];
        if (dx > r || dx < 0.0 - r || dy > r || dy < 0.0 - r)
            continue;
        if (dx * dx + dy * dy >= r * r || up >= HIGH[k])
            continue;
        hitX = dx;
        hitY = dy;
        return i;
    }
    return -1;
}

// For the title's demo: a carve away from the nearest thing in the
// skier's way, or 0
function dodge() {
    var px = frameX(skier.x), py = frameY(skier.y);
    var c = cos(skier.h), s = sin(skier.h);
    var best = 40.0, side = 0.0;
    for (var j = 0; j < dN; j++) {
        var dx = bx[j] - px, dy = by[j] - py;
        var f = dx * c + dy * s;
        if (f < 2.0 || f > best)
            continue;
        var l = dy * c - dx * s;
        if (l > 9.0 || l < -9.0)
            continue;
        best = f;
        side = l < 0.0 ? 1.0 : -1.0;
    }
    return side;
}

// Each frame before drawing: the depths from the camera (at cx, cy in the
// list's frame, facing ch), far to near, and where the skier comes among
// them. An insertion sort, as the order hardly changes from one frame to
// the next.
function sort(cx, cy, ch) {
    var m = dN, c = cos(ch), s = sin(ch);
    camX = cx;
    camY = cy;
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
    var px = frameX(skier.x) - cx, py = frameY(skier.y) - cy;
    pd = px * c + py * s;
    pl = py * c - px * s;
    split = 0;
    while (split < m && dep[order[split]] >= pd)
        split++;
}

// Draws order[from] up to order[to]; sc is the world's scale as the view
// draws it. Between the camera and the skier and in the way, an object is
// left out: it would hide them, and they are past it.
function draw(from, to, ch, sc) {
    var c = cos(ch), s = sin(ch);
    for (var a = from; a < to; a++) {
        var j = order[a], d = dep[j], i = di[j], k = ok[i];
        shown[j] = 0;
        if (d < CLOSE)
            continue;
        if (d < pd - BESIDE) {
            var l = (by[j] - camY) * c - (bx[j] - camX) * s - pl * d / pd;
            var r = HALFW[k] + 1.6;
            if (l < r && l > 0.0 - r)
                continue;
        }
        if (plane.project(bx[j] * sc, by[j] * sc, bz[j] * sc, at) == 0)
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
        blitpart(IMG.objects, ax[z], ay[z], w, ah[z], x, flr(at[1]) - ah[z] + 1, i & 1);
        shown[j] = 1;
    }
}
