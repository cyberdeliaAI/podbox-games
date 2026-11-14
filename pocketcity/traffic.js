// traffic: every car in the city but the one the player drives.
//
// One set of slots holds them all, by kind: ordinary traffic (DRIVE),
// parked cars (PARKED), the police (POLICE) and a job's getaway car
// (RUNNER). Traffic is kept round the player: a car comes into being on a
// street out of sight, 110 to 200 pixels off, and goes when it is further
// than 250 and out of sight, so about nine are ever about, most of them
// heading the player's way when they appear. Out of sight, a car moves
// every other tick, twice as far.
//
// A moving car drives on the street network of roads.js, on the right. On
// a street it is a distance s from the junction behind it, along its way.
// A little before the junction ahead it chooses where to go next: straight
// on, or a turn, which is a quarter circle across the junction, 8 pixels
// round for a right turn and 24 for a left. It slows for the turns, stops
// at a red light (police and getaway cars don't) and keeps its distance
// from whatever is ahead in its lane: a car, the player, the player on
// foot. Stuck behind a car for three seconds, it squeezes past.
//
// A knock from the player shoves a car: an offset from its lane that eases
// back to nothing while it stands still, so it never has to find its lane
// again. A parked car shoved stays where it was pushed. The police can
// leave the lanes to chase the player (police.js moves them then, free);
// snap() puts one back on the nearest lane, its offset easing it there.
//
// Places are world pixels, headings turns, speeds pixels a tick at 33 a
// second.

const MAX = 16;                    // cars at once, of every kind
const FREE = 0, DRIVE = 1, PARKED = 2, POLICE = 3, RUNNER = 4;   // kinds
const STRAIGHT = 0, RIGHT = 1, LEFT = 2;
const SEDAN = 0, VAN = 1, SPORTS = 2, COP = 3;                   // shapes: rows of images/cars.png
const CRUISE = 1.5;                // pixels a tick: ordinary traffic
const COP_CRUISE = 2.5;            // ...the police on their way
const RUN_CRUISE = 2.3;            // ...a getaway car
const ACC = 0.04;                  // pixels a tick a tick
const DEC = 0.16;
const GAP = 18.0;                  // pixels kept behind what is ahead
const LOOK = 32.0;                 // pixels ahead a driver looks
const BOX = 16.0;                  // pixels from a junction's middle to its edge
const STOP = 27.0;                 // pixels before a junction's middle where a car stops at red
const KNOCK = 10.0;                // pixels between two cars' middles when they touch
const NEAR_MIN = 110, NEAR_MAX = 200, GONE = 250;   // pixels from the player: where traffic comes and goes
const OWN_GONE = 700;              // ...the player's own parked car is kept this near
const WANT = 9;                    // ordinary cars kept round the player
const PARK_WANT = 4;               // parked cars in the car parks round the player
const WAITED = 90;                 // ticks stuck behind a car before squeezing past
const SHOCK = 30;                  // ticks a knocked car stands
const BODY = 42;                   // palette: the cars' body, light, middle and dark
const PAINT = 112;                 // ...the paints, three entries each
const SIREN_A = 68, SIREN_B = 69;
const PAINTS = 6;                  // paints ordinary cars come in: red, blue, green, yellow, white, black
const COP_PAINT = 6, GOLD = 7;

var DX = [0, 1, 0, -1];
var DY = [-1, 0, 1, 0];

var on = new Uint8Array(MAX);      // the kind, FREE when the slot is empty
var shape = new Uint8Array(MAX), paint = new Uint8Array(MAX);
var own = new Uint8Array(MAX);     // the player's own car, parked
var siren = new Uint8Array(MAX);
var free = new Uint8Array(MAX);    // moved by police.js, off the lanes
var na = new Int32Array(MAX), nb = new Int32Array(MAX);   // the junctions behind and ahead
var dir = new Uint8Array(MAX), nd = new Int32Array(MAX);  // the way it goes, and the way it will go on (-1 not chosen)
var len = new Int32Array(MAX);     // the street's length, middle to middle
var s = new FixArray(MAX);         // pixels from the junction behind
var turn = new Uint8Array(MAX);
var arc = new FixArray(MAX);       // turns gone round a turn, 0 to 0.25
var a0 = new FixArray(MAX), tx = new FixArray(MAX), ty = new FixArray(MAX);   // a turn's start angle and middle
var v = new FixArray(MAX), want = new FixArray(MAX);
var x = new FixArray(MAX), y = new FixArray(MAX), h = new FixArray(MAX);
var ox = new FixArray(MAX), oy = new FixArray(MAX);       // a knock's offset from the lane
var lx = new FixArray(MAX), ly = new FixArray(MAX);       // the lane's start and way, kept when it changes
var ux = new FixArray(MAX), uy = new FixArray(MAX);
var shock = new Int32Array(MAX), wait = new Int32Array(MAX);
var blocker = new Int32Array(MAX);  // the car holding this one up, -1 none, -2 the player
var bays = 0;
var bx = new Int32Array(160), by = new Int32Array(160);   // the car parks' bays
var bh = new FixArray(160);
var count = 0, parkedN = 0;        // ordinary cars and parked ones about, last tick

// Once: the car parks' bays from data/city.json
function setup(d) {
    bays = min(d.px.length, 160);
    for (var i = 0; i < bays; i++) {
        bx[i] = d.px[i];
        by[i] = d.py[i];
        bh[i] = d.ph[i];
    }
}

// Every slot empty, for a new game
function reset() {
    fill(on, FREE);
}

// A tick: cars come and go round the player, and drive
function update(k, px, py, cx, cy) {
    count = 0;
    parkedN = 0;
    var f = frame();
    for (var i = 0; i < MAX; i++) {
        var kd = on[i];
        if (kd == FREE)
            continue;
        // gone when far off and out of sight, looked at every eighth tick
        if ((f + i) % 8 == 0) {
            if (kd == DRIVE || (kd == PARKED && own[i] == 0)) {
                if (far(i, px, py, GONE) && !seen(i, cx, cy)) {
                    on[i] = FREE;
                    continue;
                }
            } else if (kd == PARKED && far(i, px, py, OWN_GONE)) {
                on[i] = FREE;
                continue;
            }
        }
        if (kd == DRIVE)
            count++;
        else if (kd == PARKED && own[i] == 0)
            parkedN++;
        if (shock[i] > 0)
            shock[i]--;
        if (kd == PARKED || free[i] == 1)
            continue;
        // out of sight, a car moves every other tick, twice as far, and
        // looks ahead half as often
        var kk = k, often = 5;
        if (abs(flr(x[i]) - cx) > 110 || abs(flr(y[i]) - cy) > 90) {
            if ((f + i) % 2 == 1)
                continue;
            kk = k * 2.0;
            often = 10;
        }
        // a knocked car stands, its offset easing back to the lane
        if (shock[i] > 0) {
            v[i] = 0.0;
        } else {
            if (ox[i] != 0.0 || oy[i] != 0.0) {
                ox[i] -= ox[i] * 0.08 * kk;
                oy[i] -= oy[i] * 0.08 * kk;
                if (abs(ox[i]) < 0.1 && abs(oy[i]) < 0.1) {
                    ox[i] = 0.0;
                    oy[i] = 0.0;
                }
            }
            if ((f + i) % often == 0)
                decide(i, px, py);
            if (v[i] < want[i])
                v[i] = min(want[i], v[i] + ACC * kk);
            else
                v[i] = max(want[i], v[i] - DEC * kk);
            drive(i, v[i] * kk);
        }
        place(i);
    }
    if (count < WANT && f % 2 == 0)
        spawn(px, py, cx, cy);
    if (parkedN < PARK_WANT && f % 8 == 0)
        spawnParked(px, py, cx, cy);
}

// Whether car i is further than d from px, py: whole pixels, so the
// squares don't wrap
function far(i, px, py, d) {
    var dx = flr(x[i]) - flr(px), dy = flr(y[i]) - flr(py);
    return dx * dx + dy * dy > d * d;
}

// Whether car i is on the screen whose middle is cx, cy, or nearly
function seen(i, cx, cy) {
    return abs(flr(x[i]) - cx) < 100 && abs(flr(y[i]) - cy) < 80;
}

// ---- driving ----------------------------------------------------------------

// The speed car i wants: its cruise, less for a turn or a red light, and
// less again for whatever is ahead
function decide(i, px, py) {
    var kd = on[i];
    var w = kd == DRIVE ? CRUISE : kd == POLICE ? COP_CRUISE : RUN_CRUISE;
    if (turn[i] != STRAIGHT) {
        w = min(w, turn[i] == RIGHT ? 1.0 : 1.4);
    } else {
        var togo = len[i] - STOP - s[i];
        if (kd == DRIVE && togo > -1.0 && togo < 48.0) {
            var l = roads.signal(nb[i], dir[i]);
            if (l == 2 || (l == 1 && togo > 10.0))
                w = min(w, max(0.0, togo) * 0.06);
        }
        if (nd[i] >= 0 && nd[i] != dir[i] && len[i] - BOX - s[i] < 30.0)
            w = min(w, kd == DRIVE ? 1.2 : 1.6);
    }
    // what's ahead in the lane: the nearest holds it up
    var fx = cos(h[i]), fy = sin(h[i]);
    var by = -1, nearest = LOOK;
    for (var j = 0; j < MAX; j++) {
        if (j == i || on[j] == FREE)
            continue;
        var dx = x[j] - x[i], dy = y[j] - y[i];
        if (abs(dx) > LOOK || abs(dy) > LOOK)
            continue;
        var a = dx * fx + dy * fy;
        if (a > 0.0 && a < nearest && abs(dx * fy - dy * fx) < 7.0) {
            nearest = a;
            by = j;
        }
    }
    var dx = px - x[i], dy = py - y[i];
    if (abs(dx) < LOOK && abs(dy) < LOOK) {
        var a = dx * fx + dy * fy;
        if (a > 0.0 && a < nearest && abs(dx * fy - dy * fx) < 8.0) {
            nearest = a;
            by = -2;
        }
    }
    if (by != -1)
        w = min(w, max(0.0, (nearest - GAP) * 0.08));
    blocker[i] = by;
    // held up a long while by something that will never move on its own (a
    // parked car), or in a knot (two cars each holding the other up, across
    // a junction): squeeze past. A queue just waits
    if (by >= 0 && w < 0.1) {
        wait[i] += 5;
        if (wait[i] > WAITED && (on[by] == PARKED || blocker[by] == i))
            w = 0.6;
    } else {
        wait[i] = 0;
    }
    want[i] = w;
}

// Car i on by step pixels: along its street, or round its turn
function drive(i, step) {
    if (turn[i] != STRAIGHT) {
        round(i, step);
        return;
    }
    s[i] += step;
    var l = len[i] * 1.0;
    if (nd[i] < 0 && s[i] >= l - BOX - 34.0)
        choose(i);
    if (nd[i] >= 0 && nd[i] != dir[i] && s[i] >= l - BOX) {
        var over = s[i] - (l - BOX);
        enter(i);
        round(i, over);
    } else if (s[i] >= l) {
        // straight on, onto the next street
        na[i] = nb[i];
        s[i] -= l;
        nb[i] = roads.link[na[i] * 4 + dir[i]];
        len[i] = roads.span(na[i], dir[i]);
        nd[i] = -1;
        lane(i);
    }
}

// Where car i goes on from the junction ahead: ordinary traffic at random,
// mostly straight on; the police toward the player, a getaway car away
function choose(i) {
    var b = nb[i], d = dir[i];
    var best = -1, score = 0;
    var kd = on[i];
    for (var t = 0; t < 3; t++) {
        var d2 = t == 0 ? d : t == 1 ? (d + 1) & 3 : (d + 3) & 3;
        var c = roads.link[b * 4 + d2];
        if (c < 0)
            continue;
        var sc = 0;
        if (kd == DRIVE) {
            sc = flr(rnd(t == 0 ? 200 : 100));
        } else {
            var gx = kd == POLICE ? police.gx : player.px(), gy = kd == POLICE ? police.gy : player.py();
            var dd = abs(roads.nx[c] - gx) + abs(roads.ny[c] - gy) + flr(rnd(60));
            sc = kd == POLICE ? 4000 - dd : dd;
        }
        if (best < 0 || sc > score) {
            best = d2;
            score = sc;
        }
    }
    if (best < 0)
        best = (d + 2) & 3;            // a dead end: there are none, but turn back if there were
    nd[i] = best;
}

// Into the turn across the junction ahead: its middle and where it starts
function enter(i) {
    var b = nb[i], d = dir[i];
    var jx = roads.nx[b], jy = roads.ny[b];
    if (nd[i] == ((d + 1) & 3)) {
        turn[i] = RIGHT;
        tx[i] = jx - DX[d] * 16 - DY[d] * 16;
        ty[i] = jy - DY[d] * 16 + DX[d] * 16;
        a0[i] = roads.HEAD[(d + 3) & 3];
    } else {
        turn[i] = LEFT;
        tx[i] = jx - DX[d] * 16 + DY[d] * 16;
        ty[i] = jy - DY[d] * 16 - DX[d] * 16;
        a0[i] = roads.HEAD[(d + 1) & 3];
    }
    arc[i] = 0.0;
}

// Car i round its turn by step pixels; out of it onto the new street
function round(i, step) {
    var r = turn[i] == RIGHT ? 8.0 : 24.0;
    arc[i] += step / (r * 6.2832);
    if (arc[i] < 0.25)
        return;
    var over = (arc[i] - 0.25) * r * 6.2832;
    var b = nb[i];
    dir[i] = nd[i];
    na[i] = b;
    nb[i] = roads.link[b * 4 + dir[i]];
    len[i] = roads.span(b, dir[i]);
    s[i] = BOX + over;
    turn[i] = STRAIGHT;
    nd[i] = -1;
    lane(i);
}

// Car i's lane kept: where it starts and which way it runs
function lane(i) {
    var a = na[i], d = dir[i];
    ux[i] = DX[d];
    uy[i] = DY[d];
    lx[i] = roads.nx[a] - DY[d] * 8;
    ly[i] = roads.ny[a] + DX[d] * 8;
    h[i] = roads.HEAD[d];
}

// Car i's place and heading from its lane, plus a knock's offset
function place(i) {
    if (turn[i] == STRAIGHT) {
        x[i] = lx[i] + ux[i] * s[i] + ox[i];
        y[i] = ly[i] + uy[i] * s[i] + oy[i];
        return;
    }
    var r = turn[i] == RIGHT ? 8.0 : 24.0;
    var a = turn[i] == RIGHT ? a0[i] - arc[i] : a0[i] + arc[i];
    x[i] = tx[i] + cos(a) * r + ox[i];
    y[i] = ty[i] + sin(a) * r + oy[i];
    var hh = turn[i] == RIGHT ? a - 0.25 : a + 0.25;
    h[i] = hh - flr(hh);
}

// ---- coming and going ---------------------------------------------------------

// A free slot, or -1
function slot() {
    for (var i = 0; i < MAX; i++)
        if (on[i] == FREE)
            return i;
    return -1;
}

// A car of kind kd on the street from junction a going way d, s0 along it.
// Returns its slot, or -1 when they are all taken
function add(kd, a, d, s0, sh, pt) {
    var i = slot();
    if (i < 0)
        return -1;
    on[i] = kd;
    shape[i] = sh;
    paint[i] = pt;
    own[i] = 0;
    siren[i] = kd == POLICE ? 1 : 0;
    free[i] = 0;
    na[i] = a;
    dir[i] = d;
    nb[i] = roads.link[a * 4 + d];
    len[i] = roads.span(a, d);
    s[i] = s0;
    nd[i] = -1;
    turn[i] = STRAIGHT;
    v[i] = kd == DRIVE ? CRUISE : 1.0;
    want[i] = v[i];
    ox[i] = 0.0;
    oy[i] = 0.0;
    shock[i] = 0;
    wait[i] = 0;
    lane(i);
    place(i);
    return i;
}

// A parked car at px, py heading ph; mine: the player's own, the only one
// (the one before is just parked now). Returns its slot or -1
function park(px, py, ph, sh, pt, mine) {
    if (mine)
        fill(own, 0);
    var i = slot();
    if (i < 0)
        return -1;
    on[i] = PARKED;
    shape[i] = sh;
    paint[i] = pt;
    own[i] = mine ? 1 : 0;
    siren[i] = 0;
    free[i] = 0;
    x[i] = px;
    y[i] = py;
    h[i] = ph;
    v[i] = 0.0;
    shock[i] = 0;
    return i;
}

// A place on a street near the player and out of sight, for a car to come
// into being: the junction behind, the way and the distance along, in
// pick, pd, ps. False when the try found nothing
var pick = 0, pd = 0, ps = 0.0;
function findLane(px, py, cx, cy, lo, hi) {
    var sq = roads.square(px + rnd(hi * 2) - hi, py + rnd(hi * 2) - hi);
    var c = roads.rstart[sq + 1] - roads.rstart[sq];
    if (c == 0)
        return false;
    var a = roads.rlist[roads.rstart[sq] + flr(rnd(c))];
    var d = flr(rnd(4));
    if (roads.link[a * 4 + d] < 0)
        return false;
    var l = roads.span(a, d);
    var at = BOX + 6.0 + rnd(l - BOX * 2 - 12);
    var qx = flr(roads.nx[a] + DX[d] * at - DY[d] * 8.0), qy = flr(roads.ny[a] + DY[d] * at + DX[d] * 8.0);
    var dx = qx - flr(px), dy = qy - flr(py);
    var dd = dx * dx + dy * dy;
    if (dd < lo * lo || dd > hi * hi)
        return false;
    if (abs(qx - cx) < 100 && abs(qy - cy) < 80)
        return false;
    if (crowded(qx, qy, 36))
        return false;
    // mostly heading toward the player, so they come by
    if (DX[d] * (flr(px) - qx) + DY[d] * (flr(py) - qy) < 0 && rnd(100) < 70)
        return false;
    pick = a;
    pd = d;
    ps = at;
    return true;
}

// Whether any car is within r of qx, qy
function crowded(qx, qy, r) {
    for (var i = 0; i < MAX; i++) {
        if (on[i] != FREE && abs(flr(x[i]) - qx) < r && abs(flr(y[i]) - qy) < r)
            return true;
    }
    return false;
}

// One try at a new ordinary car near the player
function spawn(px, py, cx, cy) {
    if (!findLane(px, py, cx, cy, NEAR_MIN, NEAR_MAX))
        return;
    var r = rnd(100);
    var sh = r < 62 ? SEDAN : r < 84 ? VAN : SPORTS;
    add(DRIVE, pick, pd, ps, sh, flr(rnd(PAINTS)));
}

// One try at a parked car in a car park bay near the player
function spawnParked(px, py, cx, cy) {
    if (bays == 0)
        return;
    var b = flr(rnd(bays));
    var dx = bx[b] - flr(px), dy = by[b] - flr(py);
    if (abs(dx) > NEAR_MAX || abs(dy) > NEAR_MAX || (abs(bx[b] - cx) < 100 && abs(by[b] - cy) < 80))
        return;
    if (crowded(bx[b], by[b], 12))
        return;
    var r = rnd(100);
    park(bx[b], by[b], bh[b], r < 55 ? SEDAN : r < 80 ? VAN : SPORTS, flr(rnd(PAINTS)), false);
}

// ---- knocks ------------------------------------------------------------------------

// Car i pushed by dx, dy: a parked car moves for good, unless into a wall;
// a moving one is knocked off its lane for a moment
function shove(i, dx, dy) {
    if (on[i] == PARKED || free[i] == 1) {
        if (!car.blocked(x[i] + dx, y[i] + dy)) {
            x[i] += dx;
            y[i] += dy;
        }
        return;
    }
    var nx = mid(-14.0, ox[i] + dx, 14.0), ny = mid(-14.0, oy[i] + dy, 14.0);
    x[i] += nx - ox[i];
    y[i] += ny - oy[i];
    ox[i] = nx;
    oy[i] = ny;
    shock[i] = SHOCK;
    v[i] = 0.0;
}

// The player's car against the others: pushed apart, the speed toward each
// other taken away and a little given back, the other car shoved. main.js
// hears of each knock with how hard it was, through rammed()
function knocks() {
    var px = car.x, py = car.y;
    for (var i = 0; i < MAX; i++) {
        if (on[i] == FREE)
            continue;
        var dx = px - x[i], dy = py - y[i];
        if (abs(dx) >= KNOCK || abs(dy) >= KNOCK)
            continue;
        var d2 = dx * dx + dy * dy;
        if (d2 >= KNOCK * KNOCK)
            continue;
        var d = sqrt(d2);
        if (d < 0.5) {
            dx = 1.0;
            dy = 0.0;
            d = 1.0;
        }
        var ux = dx / d, uy = dy / d;
        var vx = 0.0, vy = 0.0;
        if (on[i] != PARKED) {
            vx = cos(h[i]) * v[i];
            vy = sin(h[i]) * v[i];
        }
        var rel = (car.vx - vx) * ux + (car.vy - vy) * uy;
        var push = KNOCK - d;
        if (!car.blocked(px + ux * push, py + uy * push)) {
            car.x += ux * push;
            car.y += uy * push;
            px = car.x;
            py = car.y;
        } else {
            shove(i, 0.0 - ux * push, 0.0 - uy * push);
        }
        if (rel < 0.0) {
            car.vx -= ux * rel * 1.2;
            car.vy -= uy * rel * 1.2;
            shove(i, ux * rel * 3.0, uy * rel * 3.0);
            rammed(i, 0.0 - rel);
        }
    }
}

// The player on foot against the cars: walked into, pushed back; hit by a
// moving one, knocked down
function bumps() {
    for (var i = 0; i < MAX; i++) {
        if (on[i] == FREE)
            continue;
        var dx = player.x - x[i], dy = player.y - y[i];
        if (abs(dx) >= 7.0 || abs(dy) >= 7.0)
            continue;
        var d = sqrt(dx * dx + dy * dy);
        if (d >= 7.0)
            continue;
        if (d < 0.5) {
            dx = 1.0;
            dy = 0.0;
            d = 1.0;
        }
        var moving = on[i] != PARKED && (v[i] > 0.7 || free[i] == 1);
        player.push(dx / d * (7.0 - d), dy / d * (7.0 - d), moving);
    }
}

// The nearest car the player can get into within reach of px, py: parked,
// or traffic standing or crawling; -1 for none
function nearest(px, py, reach) {
    var best = -1, bd = flr(reach * reach);
    for (var i = 0; i < MAX; i++) {
        var kd = on[i];
        if (kd != PARKED && !(kd == DRIVE && v[i] < 0.8))
            continue;
        var dx = flr(x[i] - px), dy = flr(y[i] - py);
        var dd = dx * dx + dy * dy;
        if (dd < bd) {
            bd = dd;
            best = i;
        }
    }
    return best;
}

// Car i back onto the nearest lane, from wherever police.js drove it: the
// lane nearest, from the junctions in the squares round it, and an offset
// that eases it there
function snap(i) {
    var best = -1, bd = 0, bdir = 0, bs = 0.0;
    var sq0 = roads.square(x[i], y[i]);
    var sx0 = sq0 % roads.SQUARES, sy0 = flr(sq0 / roads.SQUARES);
    for (var sy = max(0, sy0 - 1); sy <= min(roads.SQUARES - 1, sy0 + 1); sy++) {
        for (var sx = max(0, sx0 - 1); sx <= min(roads.SQUARES - 1, sx0 + 1); sx++) {
            var sq = sy * roads.SQUARES + sx;
            for (var r = roads.rstart[sq]; r < roads.rstart[sq + 1]; r++) {
                var a = roads.rlist[r];
                for (var d = 0; d < 4; d++) {
                    if (roads.link[a * 4 + d] < 0)
                        continue;
                    var l = roads.span(a, d);
                    var along = mid(BOX, (x[i] - roads.nx[a]) * DX[d] + (y[i] - roads.ny[a]) * DY[d], l - BOX);
                    var qx = flr(roads.nx[a] + DX[d] * along - DY[d] * 8.0), qy = flr(roads.ny[a] + DY[d] * along + DX[d] * 8.0);
                    var dx = qx - flr(x[i]), dy = qy - flr(y[i]);
                    var dd = dx * dx + dy * dy;
                    // the lane going the way the car points counts nearer
                    if (abs(roads.HEAD[d] - h[i]) < 0.13 || abs(roads.HEAD[d] - h[i]) > 0.87)
                        dd = dd / 2;
                    if (best < 0 || dd < bd) {
                        best = a;
                        bd = dd;
                        bdir = d;
                        bs = along;
                    }
                }
            }
        }
    }
    if (best < 0)
        return false;
    var px = x[i], py = y[i];
    na[i] = best;
    dir[i] = bdir;
    nb[i] = roads.link[best * 4 + bdir];
    len[i] = roads.span(best, bdir);
    s[i] = bs;
    nd[i] = -1;
    turn[i] = STRAIGHT;
    ox[i] = 0.0;
    oy[i] = 0.0;
    free[i] = 0;
    lane(i);
    place(i);
    ox[i] = mid(-30.0, px - x[i], 30.0);
    oy[i] = mid(-30.0, py - y[i], 30.0);
    place(i);
    return true;
}

// ---- drawing -------------------------------------------------------------------------

// The cars on the screen whose top left is cx, cy
function draw(cx, cy) {
    sheet(IMG.cars);
    for (var i = 0; i < MAX; i++) {
        if (on[i] == FREE)
            continue;
        var sx = flr(x[i]) - cx, sy = flr(y[i]) - cy;
        if (sx < -8 || sx > 168 || sy < -8 || sy > 128)
            continue;
        sprite(shape[i], paint[i], h[i], sx, sy, siren[i] == 1);
    }
    sheet();
}

// A car of shape sh in paint pt, heading hh, its middle at sx, sy on the
// screen, its lights flashing with lit. The sheet must be IMG.cars
function sprite(sh, pt, hh, sx, sy, lit) {
    var f = flr(hh * 32.0 + 0.5) & 31;
    if (pt != 0) {
        pal(BODY, PAINT + pt * 3);
        pal(BODY + 1, PAINT + pt * 3 + 1);
        pal(BODY + 2, PAINT + pt * 3 + 2);
    }
    if (sh == COP) {
        var flash = (frame() >> 2) & 1;
        pal(SIREN_A, !lit ? 5 : flash == 1 ? SIREN_B : SIREN_A);
        pal(SIREN_B, !lit ? 5 : flash == 1 ? SIREN_A : SIREN_B);
    }
    spr(sh * 128 + (f >> 3) * 32 + (f & 7) * 2, sx - 8, sy - 8, 2, 2);
    if (pt != 0) {
        pal(BODY, BODY);
        pal(BODY + 1, BODY + 1);
        pal(BODY + 2, BODY + 2);
    }
    if (sh == COP) {
        pal(SIREN_A, SIREN_A);
        pal(SIREN_B, SIREN_B);
    }
}
