// chain: the line of balls rolling along the track.
//
// The track is a list of points, one a pixel of its length, so a ball is
// just a colour and a distance s along it. The balls are kept in order,
// from the back of the chain (index 0, nearest the tunnel) to the front
// (n - 1, nearest the hole). Everything about how the chain moves follows
// from four rules, applied every tick in this order:
//
//   1. Push: the tunnel pushes the rearmost ball forward at the chain's
//      speed, and lets out a new ball behind it whenever there is room.
//   2. Make room: a ball closer than a ball's width to the one behind it
//      is pushed forward -- at most OPEN a tick, so a ball shot into the
//      chain opens a space for itself smoothly rather than in one jump.
//      A push carries on through every ball it touches, so the whole run
//      in front of the pusher moves as one; a ball with a gap behind it
//      is not pushed, so a run cut off from the back stands still.
//   3. Pull back: where the two balls either side of a gap are the same
//      colour, the run in front of the gap rolls back toward the other,
//      PULL a tick, until they touch.
//   4. Join: a gap that closes is a join. Where the colours meet, the run
//      of that colour is counted and three or more pop: a chain reaction,
//      worth more each time it happens again from the same shot.
//
// A ball shot into the chain is inserted at once, in order, so the chain
// is always one sorted list; it rolls from where it hit into its place
// over ARRIVE ticks, and only then is its colour matched. A matched run
// pops over POP ticks, still holding its place, and is then taken out,
// leaving a gap for rule 3 to close. Every ball's state travels with it
// when the arrays are shifted, so nothing refers to a ball by index for
// longer than a tick.
//
// Some balls carry a power-up (pw): when a run with one in it pops, the
// power goes off. SLOW and BACK are the game's to carry out (gotPower);
// BOMB pops the balls around it too, which is done here (blast).

const MAXB = 140;
const MAXL = 800;                  // the longest track
const D = 7.0;                     // a ball's width: the spacing of touching balls
const TOUCH = 7.6;                 // closer than this, two balls touch
const OPEN = 1.6;                  // pixels a tick a gap opens for a new ball
const PULL = 2.6;                  // pixels a tick a run rolls back to its match
const ARRIVE = 5;                  // ticks a shot ball takes to roll into place
const POP = 8;                     // ticks a matched run takes to pop
const MOUTH = 5.0;                 // balls further back are still in the tunnel
const BLAST = 17.0;                // how far a bomb reaches along the chain

// power-ups
const SLOW = 1, BACK = 2, BOMB = 3;

// a ball's state; SETTLED only between the timers and the matching, in step()
const ROLL = 0, ARRIVING = 1, POPPING = 2, SETTLED = 3;

var n = 0;
var col = new Uint8Array(MAXB);    // colour, 1 to 6
var s = new FixArray(MAXB);        // distance along the track
var st = new Uint8Array(MAXB);     // ROLL, ARRIVING or POPPING
var tm = new Uint8Array(MAXB);     // ticks left in that state
var gap = new Uint8Array(MAXB);    // 1 while there is a gap behind this ball
var pw = new Uint8Array(MAXB);     // the power-up it carries, 0 for none
var ax = new FixArray(MAXB), ay = new FixArray(MAXB);   // where an arriving ball hit

var counts = new Int32Array(8);    // balls of each colour in the chain
var left = 0;                      // balls still in the tunnel
var colours = 4;                   // how many colours this level uses
var lastColour = 1;
var combo = 0;                     // chain reactions from the last shot so far
var powerEvery = 0;                // about how many balls between power-ups, 0 for none
var sincePower = 0;
var busy = 0;                      // ticks left in which some ball may be arriving or popping

// the track
var PX = new Int32Array(MAXL), PY = new Int32Array(MAXL);   // a point a pixel
var L = 0;                         // its length
var near = new Uint8Array(300);    // which 8 pixel squares of the screen are within reach of the track

// for drawing
var xs = new Int32Array(MAXB), ys = new Int32Array(MAXB), sp = new Uint8Array(MAXB);
var gx = new Int32Array(MAXB), gy = new Int32Array(MAXB), gs = new Uint8Array(MAXB);

// A track: lists of coordinates, and which squares of the screen are within
// a ball's reach of it
function setup(tx, ty, nr) {
    L = min(tx.length, MAXL);
    for (var i = 0; i < L; i++) {
        PX[i] = tx[i];
        PY[i] = ty[i];
    }
    for (var i = 0; i < 300; i++)
        near[i] = nr[i];
}

function start(balls, ncol, every) {
    n = 0;
    left = balls;
    colours = ncol;
    combo = 0;
    powerEvery = every;
    sincePower = 0;
    busy = 0;
    fill(counts, 0);
    lastColour = 1 + rnd(colours);
}

// ---- the arrays ----------------------------------------------------------------

// Opens slot k, moving every ball from k on up by one
function openSlot(k) {
    var m = n - k;
    if (m > 0) {
        copy(col, k + 1, col, k, m);
        copy(s, k + 1, s, k, m);
        copy(st, k + 1, st, k, m);
        copy(tm, k + 1, tm, k, m);
        copy(gap, k + 1, gap, k, m);
        copy(pw, k + 1, pw, k, m);
        copy(ax, k + 1, ax, k, m);
        copy(ay, k + 1, ay, k, m);
    }
    n++;
}

// Takes balls a to b out
function closeSlots(a, b) {
    var m = n - b - 1;
    for (var i = a; i <= b; i++)
        counts[col[i]]--;
    if (m > 0) {
        copy(col, a, col, b + 1, m);
        copy(s, a, s, b + 1, m);
        copy(st, a, st, b + 1, m);
        copy(tm, a, tm, b + 1, m);
        copy(gap, a, gap, b + 1, m);
        copy(pw, a, pw, b + 1, m);
        copy(ax, a, ax, b + 1, m);
        copy(ay, a, ay, b + 1, m);
    }
    n -= b - a + 1;
    if (a > 0 && a < n)
        gap[a] = 1;
}

// A new ball's colour: often the last one again, so colours come in runs
function nextColour() {
    if (rnd() >= 0.45)
        lastColour = 1 + rnd(colours);
    return lastColour;
}

// The power-up a new ball carries: one in about powerEvery balls
function nextPower() {
    if (powerEvery == 0)
        return 0;
    sincePower++;
    if (sincePower < powerEvery - 3 + rnd(7))
        return 0;
    sincePower = 0;
    return 1 + rnd(3);
}

// ---- a tick --------------------------------------------------------------------

function step(speed) {
    // 1. the tunnel lets a ball out when there is room behind the last one
    if (left > 0 && (n == 0 || s[0] >= D)) {
        var at = n == 0 || s[0] >= 2 * D ? 0.0 : s[0] - D;
        openSlot(0);
        col[0] = nextColour();
        s[0] = at;
        st[0] = ROLL;
        tm[0] = 0;
        gap[0] = 0;
        pw[0] = nextPower();
        if (n > 1)
            gap[1] = s[1] - at > TOUCH ? 1 : 0;
        counts[col[0]]++;
        left--;
    }
    if (n == 0)
        return;

    // 1. ...and pushes the rearmost ball
    s[0] += speed;

    // 2. make room, back to front
    var open = max(OPEN, speed);
    for (var i = 1; i < n; i++) {
        var g = s[i] - s[i - 1];
        if (g < D)
            s[i] += min(D - g, open);
    }

    // 3. pull back across gaps whose two sides match
    for (var i = 1; i < n; i++) {
        if (s[i] - s[i - 1] <= TOUCH)
            continue;
        if (col[i] != col[i - 1] || st[i] == POPPING || st[i - 1] == POPPING)
            continue;
        var e = i;
        while (e + 1 < n && s[e + 1] - s[e] <= TOUCH)
            e++;
        var to = max(s[i] - PULL, s[i - 1] + D);
        var back = s[i] - to;
        for (var j = i; j <= e; j++)
            s[j] -= back;
        i = e;
    }

    // 4. joins
    for (var i = 1; i < n; i++) {
        var touching = s[i] - s[i - 1] <= TOUCH;
        if (!touching) {
            gap[i] = 1;
        } else if (gap[i] != 0) {
            gap[i] = 0;
            if (col[i] == col[i - 1] && st[i] != POPPING && st[i - 1] != POPPING)
                match(i, true);
        }
    }

    // pops finish and are taken out; arrivals settle -- only worth looking
    // while a shot or a pop is under way
    if (busy == 0)
        return;
    busy--;
    for (var i = n - 1; i >= 0; i--) {
        if (st[i] == ARRIVING) {
            if (--tm[i] == 0)
                st[i] = SETTLED;
        } else if (st[i] == POPPING) {
            if (--tm[i] == 0) {
                // the rest of this run is still at 1: it ends now too
                var a = i;
                while (a > 0 && st[a - 1] == POPPING && tm[a - 1] == 1)
                    a--;
                closeSlots(a, i);
                i = a;
            }
        }
    }

    // a settled ball is matched where it now is
    for (var i = 0; i < n; i++) {
        if (st[i] == SETTLED) {
            st[i] = ROLL;
            match(i, false);
        }
    }
}

// The run of ball i's colour around it, popped if it is three or more.
// chained: it came of a join, not of a shot
function match(i, chained) {
    var c = col[i], a = i, b = i;
    while (a > 0 && col[a - 1] == c && st[a - 1] != POPPING && s[a] - s[a - 1] <= TOUCH)
        a--;
    while (b < n - 1 && col[b + 1] == c && st[b + 1] != POPPING && s[b + 1] - s[b] <= TOUCH)
        b++;
    var m = b - a + 1;
    if (m < 3) {
        if (!chained)
            missed();
        return;
    }
    combo = chained ? combo + 1 : 1;
    busy = POP + 3;
    var mid0 = (a + b) / 2;
    var k = mid(0, flr(s[mid0]), L - 1);
    var bomb = false;
    for (var j = a; j <= b; j++) {
        st[j] = POPPING;
        tm[j] = POP;
        if (pw[j] == BOMB)
            bomb = true;
        else if (pw[j] != 0)
            gotPower(pw[j], PX[k], PY[k]);
        pw[j] = 0;
    }
    if (bomb) {
        m += blast(a, b);
        gotPower(BOMB, PX[k], PY[k]);
    }
    popped(m, combo, PX[k], PY[k], c);
}

// A bomb: everything within BLAST of the popped run pops with it. Returns
// how many balls it added.
function blast(a, b) {
    var lo = s[a] - BLAST, hi = s[b] + BLAST, cnt = 0;
    for (var j = 0; j < n; j++) {
        if (s[j] < lo || s[j] > hi || s[j] < MOUTH || st[j] == POPPING)
            continue;
        st[j] = POPPING;
        tm[j] = POP;
        cnt++;
        if (pw[j] != 0) {
            if (pw[j] != BOMB) {
                var k = mid(0, flr(s[j]), L - 1);
                gotPower(pw[j], PX[k], PY[k]);
            }
            pw[j] = 0;
        }
    }
    return cnt;
}

// ---- shots ---------------------------------------------------------------------

// The ball a shot at x, y has hit, or -1
function hitTest(x, y) {
    // most of a shot's flight is far from any ball
    if (x < 0 || x >= 160 || y < 0 || y >= 120 || near[flr(y) / 8 * 20 + flr(x) / 8] == 0)
        return -1;
    var best = -1, bd = 40.0;
    for (var i = n - 1; i >= 0; i--) {
        if (s[i] < MOUTH || st[i] == POPPING)
            continue;
        var k = flr(s[i]);
        if (k >= L)
            continue;
        var dx = PX[k] - x;
        if (dx > 7.0 || dx < -7.0)
            continue;
        var dy = PY[k] - y;
        if (dy > 7.0 || dy < -7.0)
            continue;
        var d2 = dx * dx + dy * dy;
        if (d2 < bd) {
            bd = d2;
            best = i;
        }
    }
    return best;
}

// A shot of colour c struck ball h at x, y: it joins the chain beside h,
// on the side of h it hit
function insert(h, x, y, c) {
    var k0 = flr(s[h]);
    var k = mid(0, k0, L - 1);
    var i0 = max(0, k - 3), i1 = min(L - 1, k + 3);
    var tx = PX[i1] - PX[i0], ty = PY[i1] - PY[i0];
    var ahead = (x - PX[k]) * tx + (y - PY[k]) * ty > 0;

    var slot, at;
    if (ahead) {
        slot = h + 1;
        at = s[h] + D;
        // not past a ball still being pushed forward by an earlier shot
        if (slot < n && at > s[slot])
            at = s[slot];
    } else {
        slot = h;
        at = s[h];
        // into the gap behind h, where there is one wide enough
        if (h > 0 && s[h] - s[h - 1] >= 2 * D)
            at = s[h] - D;
    }
    openSlot(slot);
    col[slot] = c;
    s[slot] = at;
    st[slot] = ARRIVING;
    busy = ARRIVE + 3;
    pw[slot] = 0;
    tm[slot] = ARRIVE;
    ax[slot] = x;
    ay[slot] = y;
    gap[slot] = slot > 0 && at - s[slot - 1] > TOUCH ? 1 : 0;
    if (slot + 1 < n)
        gap[slot + 1] = s[slot + 1] - at > TOUCH ? 1 : 0;
    counts[c]++;
}

// The end of a lost game: everything rolls on into the hole
function slide(v) {
    for (var i = 0; i < n; i++)
        s[i] += v;
    while (n > 0 && s[n - 1] >= L - 1)
        closeSlots(n - 1, n - 1);
}

// The chain rolls back v toward the tunnel; balls that go right back in
// are let out again later
function rewind(v) {
    for (var i = 0; i < n; i++)
        s[i] -= v;
    while (n > 0 && s[0] < 0.0 - D) {
        closeSlots(0, 0);
        left++;
    }
}

// ---- the state of play ---------------------------------------------------------

function front() {
    return n > 0 ? s[n - 1] : 0.0;
}

function empty() {
    return n == 0 && left == 0;
}

// How close the chain is to the hole: 0 while it is far, 1 at the hole
function danger() {
    if (n == 0)
        return 0.0;
    return mid(0.0, (s[n - 1] - L * 0.78) / (L * 0.22), 1.0);
}

// Whether colour c is still in play
function has(c) {
    return counts[c] > 0;
}

// A colour still in the chain, for the shooter to load
function liveColour() {
    if (n == 0)
        return 1 + rnd(colours);
    var c = 1 + rnd(colours);
    for (var tries = 0; tries < 12 && counts[c] == 0; tries++)
        c = 1 + rnd(colours);
    if (counts[c] == 0) {
        for (c = 1; c <= colours; c++)
            if (counts[c] > 0)
                break;
    }
    return c;
}

// ---- drawing -------------------------------------------------------------------

function draw() {
    var m = 0, g = 0;
    for (var i = 0; i < n; i++) {
        var k = flr(s[i]);
        if (k < 5)
            continue;
        var x = PX[k], y = PY[k];
        var spr0 = col[i];
        var q = st[i];
        if (q != ROLL) {
            if (q == ARRIVING) {
                var f = (ARRIVE - tm[i]) / (ARRIVE * 1.0);
                x = ax[i] + (x - ax[i]) * f;
                y = ay[i] + (y - ay[i]) * f;
            } else if (q == POPPING) {
                spr0 = tm[i] > POP / 2 ? spr0 : 16 + spr0;
            }
        }
        xs[m] = x - 3;
        ys[m] = y - 3;
        sp[m] = spr0;
        m++;
        if (pw[i] != 0) {
            gx[g] = x - 3;
            gy[g] = y - 3;
            gs[g] = 24 + pw[i];
            g++;
        }
    }
    sprites.draw(sp, xs, ys, m);
    if (g > 0) {
        sprites.draw(gs, gx, gy, g);
        // a power-up ball flashes a ring
        if ((frame() & 8) != 0)
            for (var j = 0; j < g; j++)
                circ(gx[j] + 3, gy[j] + 3, 5, 7);
    }
}
