// foes: everything that comes down the tunnel at the ship -- enemies,
// gates, pickups and the sparks the heavies fire. Each has the time it
// arrives at the rim, in game time, and the angle it arrives at, so it
// lands on the beat it was planned for.

const MAX = 40;

// kinds
const DRONE = 1, SPIRAL = 2, HEAVY = 3, SPARK = 4, GATE = 5, POWER = 6, BOMB = 7;

const HIT_SHIP = 0.045;            // how near in angle a foe must be to hit the ship
const GATE_DEPTH = 0.84;           // a gate's inner edge, of the wall's radius
const VIEW_FAR = 9.0;              // a new foe's depth until its first tick
const VIEW_SEEN = 7.3;             // deeper than this is not drawn, nor bombed

var kind = new Int32Array(MAX);    // 0 free
var arr = new Int32Array(MAX);     // arrival, game ms
var born = new Int32Array(MAX);    // a spark's firing time
var ang = new FixArray(MAX);       // angle at arrival; a gate's gap centre
var arg = new FixArray(MAX);       // a spiral's turn a beat; a gate's half gap; a spark's starting depth
var hp = new Int32Array(MAX);
var hit = new Int32Array(MAX);     // ticks of a white flash
var done = new Uint8Array(MAX);    // reached the rim already
var fired = new Uint8Array(MAX);   // a heavy has fired its spark
var dep = new FixArray(MAX);       // depth this tick
var cur = new FixArray(MAX);       // angle this tick
var top = 0;                       // one past the highest slot in use
var count = 0;                     // how many are in the tunnel

var dx = new Int32Array(4), dy = new Int32Array(4);
var gx = new Int32Array(64), gy = new Int32Array(64);

function clear() {
    fill(kind, 0);
    top = 0;
}

function slot() {
    for (var i = 0; i < MAX; i++) {
        if (kind[i] == 0) {
            if (i >= top)
                top = i + 1;
            hp[i] = 1;
            hit[i] = 0;
            done[i] = 0;
            fired[i] = 0;
            arg[i] = 0.0;
            dep[i] = VIEW_FAR;
            return i;
        }
    }
    return -1;
}

function spawn(k, at, a) {
    var i = slot();
    if (i < 0)
        return -1;
    kind[i] = k;
    arr[i] = at;
    ang[i] = a - flr(a);
    cur[i] = ang[i];
    if (k == HEAVY)
        hp[i] = 3;
    return i;
}

function spiral(at, a, turn) {
    var i = spawn(SPIRAL, at, a);
    if (i >= 0)
        arg[i] = turn;
}

function gate(at, centre, half) {
    var i = spawn(GATE, at, centre);
    if (i >= 0)
        arg[i] = half;
}

// The shortest way from angle b to angle a, -0.5 to 0.5
function adiff(a, b) {
    var d = a - b;
    return d - flr(d + 0.5);
}

// ---- a tick ------------------------------------------------------------------

function step(gt, bm, shipA, alive) {
    var newTop = 0;
    count = 0;
    for (var i = 0; i < top; i++) {
        var k = kind[i];
        if (k == 0)
            continue;
        newTop = i + 1;
        count++;
        if (hit[i] > 0)
            hit[i]--;
        var d;
        if (k == SPARK) {
            var span = arr[i] - born[i];
            d = span > 0 ? arg[i] * ((arr[i] - gt) * 1.0 / span) : 0.0;
        } else {
            d = (arr[i] - gt) / bm;
        }
        dep[i] = d;
        cur[i] = k == SPIRAL ? ang[i] + arg[i] * max(d, 0.0) : ang[i];

        if (d < -0.9) {
            kind[i] = 0;
            continue;
        }

        // a heavy fires a spark once, on its way in
        if (k == HEAVY && fired[i] == 0 && d < 4.2 && d > 2.0 && alive) {
            fired[i] = 1;
            fireSpark(i, gt, d);
        }

        if (d > 0.0 || done[i] != 0)
            continue;
        done[i] = 1;
        arrive(i, shipA, alive);
    }
    top = newTop;
}

// A heavy's spark: it flies at twice the tunnel's speed and lands on the
// next half beat after that
function fireSpark(i, gt, d) {
    var travel = flr(d * bmF * 0.5);
    var half = beatMs / 2;
    var at = gt + travel;
    at = anchor + ((at - anchor + half - 1) / half) * half;
    var j = spawn(SPARK, at, cur[i]);
    if (j < 0)
        return;
    born[j] = gt;
    arg[j] = d;
    sfx(SFX.zap);
}

// Something reached the rim
function arrive(i, shipA, alive) {
    var k = kind[i];
    var off = abs(adiff(cur[i], shipA));
    if (k == GATE) {
        if (!alive)
            return;
        if (off < arg[i] - 0.02) {
            gatePassed(i);
        } else {
            shatter(i);
            kind[i] = 0;
            hurt();
        }
        return;
    }
    if (k == POWER || k == BOMB) {
        if (alive && off < 0.07) {
            collect(k);
            tube.project(cur[i], 0.0, 0.92);
            burst(tube.px, tube.py, 10, k == POWER ? 11 : 9);
            kind[i] = 0;
        }
        return;
    }
    if (alive && off < (k == SPARK ? 0.035 : HIT_SHIP)) {
        tube.project(cur[i], 0.0, 0.92);
        burst(tube.px, tube.py, 14, tube.FOE);
        kind[i] = 0;
        hurt();
    }
}

// A shot struck foe i: true when it is gone
function damage(i) {
    hp[i]--;
    hit[i] = 3;
    if (hp[i] > 0) {
        sfx(SFX.hit);
        return false;
    }
    destroyed(i, true);
    return true;
}

function destroyed(i, scored) {
    var k = kind[i];
    tube.project(cur[i], max(dep[i], -0.5), 0.92);
    var n = k == HEAVY ? 22 : k == SPARK ? 4 : 12;
    burst(tube.px, tube.py, n, k == HEAVY ? 9 : tube.FOE);
    if (scored)
        killed(k);
    kind[i] = 0;
    sfx(k == HEAVY ? SFX.bigboom : SFX.boom);
}

// The bomb: every enemy and spark in sight, gone
function bombAll() {
    var n = 0;
    for (var i = 0; i < top; i++) {
        var k = kind[i];
        if (k == 0 || k > SPARK || done[i] != 0 || dep[i] > VIEW_SEEN)
            continue;
        destroyed(i, true);
        n++;
    }
    return n;
}

// A gate breaking into pieces round its ring
function shatter(i) {
    for (var j = 0; j < 8; j++) {
        var a = ang[i] + arg[i] + (1.0 - 2.0 * arg[i]) * j / 8.0;
        tube.project(a, 0.0, 0.92);
        burst(tube.px, tube.py, 3, tube.FOE_DIM);
    }
}

// ---- drawing -----------------------------------------------------------------

function draw() {
    // gates first, far to near, so the enemies show over them
    for (var i = 0; i < top; i++)
        if (kind[i] == GATE)
            drawGate(i);
    for (var i = 0; i < top; i++) {
        var k = kind[i];
        if (k == 0 || k == GATE)
            continue;
        var d = dep[i];
        if (d > VIEW_SEEN)
            continue;
        drawOne(i, k, d);
    }
}

function drawOne(i, k, d) {
    tube.project(cur[i], d, 0.9);
    var x = tube.px, y = tube.py, s = tube.ps;
    var faint = d > 6.2;
    var c = hit[i] > 0 ? 7 : faint ? tube.FOE_DIM : tube.FOE;
    var r;
    if (k == DRONE) {
        r = 4.5 * s;
        if (r < 1.5) {
            pset(x, y, c);
            return;
        }
        circfill(x, y, r, c);
        if (r > 2.5)
            pset(x, y, hit[i] > 0 ? tube.FOE : tube.BG);
    } else if (k == SPIRAL) {
        r = 6.5 * s;
        if (r < 1.5) {
            pset(x, y, c);
            return;
        }
        var spin = cur[i] * 3.0;
        trifill(x + cos(spin) * r, y + sin(spin) * r,
                x + cos(spin + 0.3333) * r, y + sin(spin + 0.3333) * r,
                x + cos(spin + 0.6667) * r, y + sin(spin + 0.6667) * r,
                hit[i] > 0 ? 7 : faint ? tube.FOE_DIM : 14);
        pset(x, y, c);
    } else if (k == HEAVY) {
        r = 7.5 * s;
        circfill(x, y, r, hit[i] > 0 ? 7 : tube.FOE_DIM);
        circ(x, y, r, c);
        if (r > 3.0)
            circfill(x, y, r * 0.4, hp[i] > 1 ? 9 : 8);
    } else if (k == SPARK) {
        r = max(1.0, 2.5 * s);
        circfill(x, y, r, 8);
        pset(x, y, 7);
    } else if (k == POWER || k == BOMB) {
        r = max(1.5, 5.0 * s);
        var pc = k == POWER ? 11 : 9;
        if (frame() & 4)
            pc = 7;
        rect(x - r, y - r, x + r, y + r, pc);
        if (r > 2.5)
            rectfill(x - 1, y - 1, x + 1, y + 1, k == POWER ? 3 : 4);
    }
}

// A gate: a band round the wall at its depth, drawn as two rings, with
// its gap cut out of them and edged in white
function drawGate(i) {
    var d = dep[i];
    if (d > VIEW_SEEN || d < -0.3)
        return;
    var s = tube.scaleAt(d);
    var k = 1.0 - s;
    var cx = tube.CX + tube.offX * k, cy = tube.CY + tube.offY * k;
    var rx = tube.RX * s, ry = tube.RY * s;
    var faint = d > 6.2;
    var c = faint ? tube.FOE_DIM : tube.FOE;
    oval(cx - rx, cy - ry, cx + rx, cy + ry, c);
    var ix = rx * GATE_DEPTH, iy = ry * GATE_DEPTH;
    oval(cx - ix, cy - iy, cx + ix, cy + iy, c);

    // the gap: an arc of five points out and five back
    var half = arg[i], a0 = ang[i] - half, step = half / 2.0;
    var ox = rx * 1.05, oy = ry * 1.05, nx = ix * 0.95, ny = iy * 0.95;
    var a;
    for (var j = 0; j <= 4; j++) {
        a = a0 + step * j;
        gx[j] = cx + cos(a) * ox;
        gy[j] = cy + sin(a) * oy;
        gx[9 - j] = cx + cos(a) * nx;
        gy[9 - j] = cy + sin(a) * ny;
    }
    polyfill(gx, gy, 10, tube.BG);
    if (!faint) {
        line(gx[0], gy[0], gx[9], gy[9], 7);
        line(gx[4], gy[4], gx[5], gy[5], 7);
    }
}
