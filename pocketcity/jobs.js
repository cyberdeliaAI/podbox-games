// jobs: the work the city offers, its lost tapes, its paint shops and
// which district the player is in.
//
// Twenty jobs, four a district, done in turn: Old Town's first, then
// Downtown's, Greenside's, the Harbour's and Sunset Beach's. The next job
// waits at its district's phone box: get there, with no police after you,
// and it starts. Each has a time limit, from the distance, and pays on
// time.
//
//   Delivery    pick the parcel up, take it to an address in another district
//   Taxi        stop by the fare, they get in; stop at their address
//   Time trial  drive through seven junctions in turn
//   Chase       a getaway car flees; ram it four times before it's lost
//
// Thirty tapes are lost about the city, six a district, out of the way:
// alleys, parks, yards, gardens, the beach. All thirty and the next car at
// the start is gold. A paint shop in every district makes a wanted car new
// for $100, and the police forget it.
//
// Everything comes from data/city.json, made by tools/pocketcity_assets.py.

const DELIVER = 0, TAXI = 1, TRIAL = 2, CHASE = 3;
const JOBS = 20, PER = 4;          // jobs, and jobs a district
const DISTRICTS = 5;
const TAPES = 30;
const REACH = 12;                  // pixels: this near a marker counts as there
const STOP_REACH = 24;             // pixels: a taxi stopping this near its fare or address
const STOPPED = 0.5;               // pixels a tick: slow enough for a fare
const HITS = 4;                    // knocks that stop a getaway car
const HIT_FORCE = 0.8;             // pixels a tick closing, to count as one
const LOST = 480;                  // pixels: a getaway car this far off is gone
const RESPRAY = 100;               // dollars

var TITLES = ["DELIVERY", "TAXI", "TIME TRIAL", "CHASE"];

var names;                         // the districts' names, from the data
var zones = new Int32Array(DISTRICTS * 4);
var gx = new Int32Array(DISTRICTS), gy = new Int32Array(DISTRICTS);     // the phone boxes
var jd = new Int32Array(JOBS), jt = new Int32Array(JOBS);               // district, kind
var jtime = new Int32Array(JOBS), jpay = new Int32Array(JOBS);          // seconds, dollars
var j0 = new Int32Array(JOBS), jn = new Int32Array(JOBS);               // first point, points
var qx = new Int32Array(JOBS * 8), qy = new Int32Array(JOBS * 8);       // the points
var tpx = new Int32Array(TAPES), tpy = new Int32Array(TAPES);
var spx = new Int32Array(DISTRICTS), spy = new Int32Array(DISTRICTS);   // paint shops

var done = 0;                      // jobs done
var found = 0;                     // tapes found, a bit each
var visited = 0;                   // districts seen, a bit each
var active = -1;                   // the job going on, or -1
var stage = 0;                     // its point now
var left = 0;                      // ms left
var fare = -1, runner = -1;        // the taxi's fare (a person), the getaway car
var hits = 0, hitWait = 0;
var aim = false, ax = 0, ay = 0;   // where the arrow points, when it does
var here = -1;                     // the district the player is in, -1 on the water
var warned = false;                // told to lose the police before a job

// Once: everything from data/city.json
function setup(d) {
    names = d.names;
    for (var i = 0; i < DISTRICTS * 4; i++)
        zones[i] = d.zones[i];
    for (var i = 0; i < DISTRICTS; i++) {
        gx[i] = d.gx[i];
        gy[i] = d.gy[i];
        spx[i] = d.sx[i];
        spy[i] = d.sy[i];
    }
    var n = 0;
    for (var j = 0; j < JOBS; j++) {
        var r = d.jobs[j];
        jd[j] = r.d;
        jt[j] = r.type;
        jtime[j] = r.time;
        jpay[j] = r.pay;
        j0[j] = n;
        jn[j] = min(r.x.length, 8);
        for (var p = 0; p < jn[j]; p++) {
            qx[n] = r.x[p];
            qy[n] = r.y[p];
            n++;
        }
    }
    for (var i = 0; i < TAPES; i++) {
        tpx[i] = d.tx[i];
        tpy[i] = d.ty[i];
    }
}

// A game from saved progress
function begin(d, f, v) {
    done = d;
    found = f;
    visited = v;
    active = -1;
    fare = -1;
    runner = -1;
    here = -1;
    aim = false;
    warned = false;
}

// How many tapes are found
function tapes() {
    var n = 0;
    for (var i = 0; i < TAPES; i++)
        if ((found >> i) & 1)
            n++;
    return n;
}

// The district at px, py, or -1 on the water
function districtAt(px, py) {
    for (var i = 0; i < DISTRICTS; i++)
        if (px >= zones[i * 4] * 8 && py >= zones[i * 4 + 1] * 8 && px < zones[i * 4 + 2] * 8 && py < zones[i * 4 + 3] * 8)
            return i;
    return -1;
}

// Whether the player is within r of px, py
function at(px, py, r) {
    return abs(flr(player.px()) - px) < r && abs(flr(player.py()) - py) < r;
}

// A tick: districts, tapes, paint shops, the phone box, the job going on
function update(k) {
    var px = flr(player.px()), py = flr(player.py());
    var d = districtAt(px, py);
    if (d >= 0 && d != here) {
        here = d;
        hud.say(names[d], 0, hud.BIG, 0);
        if (((visited >> d) & 1) == 0) {
            visited |= 1 << d;
            save();
            if (visited == 31)
                ach.earn(ACH.tourist);
        }
    }
    // the tapes, six a district in order: only the district's own
    var t0 = here >= 0 ? here * 6 : 0, t1 = here >= 0 ? t0 + 6 : TAPES;
    for (var i = t0; i < t1; i++) {
        if (((found >> i) & 1) == 0 && abs(tpx[i] - px) < 8 && abs(tpy[i] - py) < 8) {
            found |= 1 << i;
            gotTape(tapes());
        }
    }
    // a paint shop, with the police after you
    if (police.stars > 0 && player.inCar) {
        var s = here >= 0 ? here : 0;
        if (at(spx[s], spy[s], REACH))
            respray();
    }
    if (active < 0) {
        aim = false;
        if (done >= JOBS)
            return;
        var g = flr(done / PER);
        aim = true;
        ax = gx[g];
        ay = gy[g];
        if (at(gx[g], gy[g], REACH)) {
            if (police.stars == 0)
                start(done);
            else if (!warned) {
                hud.say("LOSE THE POLICE FIRST", 0, hud.PLAIN, 0);
                warned = true;
            }
        } else {
            warned = false;
        }
        return;
    }
    left -= flr(1000 / rate());
    if (hitWait > 0)
        hitWait--;
    if (left <= 0) {
        fail("OUT OF TIME");
        return;
    }
    var p = j0[active] + stage;
    var t = jt[active];
    if (t == DELIVER) {
        if (at(qx[p], qy[p], REACH)) {
            if (stage == 0) {
                stage = 1;
                checkpoint();
                hud.say("GOT THE PARCEL", 0, hud.PLAIN, 0);
            } else {
                pass();
                return;
            }
        }
    } else if (t == TAXI) {
        var slow = player.inCar && abs(car.fwd) < STOPPED;
        if (stage == 0) {
            if (slow && at(qx[p], qy[p], STOP_REACH)) {
                if (fare >= 0)
                    people.on[fare] = 0;
                fare = -1;
                stage = 1;
                checkpoint();
                hud.say("HOP IN", 0, hud.PLAIN, 0);
            }
        } else {
            if (!player.inCar) {
                fail("YOUR FARE WALKED OFF");
                return;
            }
            if (slow && at(qx[p], qy[p], STOP_REACH)) {
                people.add(qx[p], qy[p], people.WALKING, 3);
                pass();
                return;
            }
        }
    } else if (t == TRIAL) {
        if (at(qx[p], qy[p], 16)) {
            stage++;
            if (stage >= jn[active]) {
                pass();
                return;
            }
            checkpoint();
        }
    } else {
        if (runner < 0 || traffic.on[runner] != traffic.RUNNER) {
            fail("IT GOT AWAY");
            return;
        }
        if (abs(flr(traffic.x[runner]) - px) + abs(flr(traffic.y[runner]) - py) > LOST) {
            traffic.on[runner] = traffic.FREE;
            runner = -1;
            fail("IT GOT AWAY");
            return;
        }
    }
    // where the arrow points
    aim = true;
    if (t == CHASE) {
        ax = flr(traffic.x[runner]);
        ay = flr(traffic.y[runner]);
    } else {
        ax = qx[j0[active] + stage];
        ay = qy[j0[active] + stage];
    }
}

// Job j starts
function start(j) {
    active = j;
    stage = 0;
    left = jtime[j] * 1000;
    hits = 0;
    hitWait = 0;
    var p = j0[j];
    if (jt[j] == TAXI) {
        fare = people.fare(qx[p], qy[p]);
    } else if (jt[j] == CHASE) {
        runner = getaway(qx[p], qy[p]);
        if (runner < 0) {
            active = -1;
            return;
        }
    }
    hud.say(TITLES[jt[j]], 0, hud.PLAIN, 0);
    jobStarted();
}

// The getaway car, at the junction at px, py, setting off away from the
// player. Its slot, or -1
function getaway(px, py) {
    var a = -1;
    for (var i = 0; i < roads.n; i++)
        if (roads.nx[i] == px && roads.ny[i] == py)
            a = i;
    if (a < 0)
        return -1;
    var best = -1, bd = -1;
    for (var d = 0; d < 4; d++) {
        var b = roads.link[a * 4 + d];
        if (b < 0)
            continue;
        var dd = abs(roads.nx[b] - flr(player.px())) + abs(roads.ny[b] - flr(player.py()));
        if (dd > bd) {
            bd = dd;
            best = d;
        }
    }
    var i = traffic.add(traffic.RUNNER, a, best, traffic.BOX + 4.0, traffic.SPORTS, 0);
    if (i < 0) {
        for (var j = 0; j < traffic.MAX && i < 0; j++) {
            if (traffic.on[j] == traffic.DRIVE) {
                traffic.on[j] = traffic.FREE;
                i = traffic.add(traffic.RUNNER, a, best, traffic.BOX + 4.0, traffic.SPORTS, 0);
            }
        }
    }
    return i;
}

// The job is done: paid, counted, saved
function pass() {
    var pay = jpay[active];
    active = -1;
    fare = -1;
    if (runner >= 0 && traffic.on[runner] == traffic.RUNNER)
        traffic.on[runner] = traffic.PARKED;
    runner = -1;
    done++;
    hud.say("JOB DONE", pay, hud.MONEY, 0);
    if (done % PER == 0 && done < JOBS)
        hud.say("NEW WORK IN", flr(done / PER), hud.PLACE, 0);
    else if (done == JOBS)
        hud.say("THE KEY TO THE CITY", 0, hud.PLAIN, 0);
    jobDone(pay);
}

// The job is lost, why says why
function fail(why) {
    active = -1;
    if (fare >= 0 && people.on[fare] == people.WAITING)
        people.on[fare] = people.WALKING;
    fare = -1;
    if (runner >= 0 && traffic.on[runner] == traffic.RUNNER)
        traffic.on[runner] = traffic.DRIVE;
    runner = -1;
    hud.say(why, 0, hud.PLAIN, 0);
    jobFailed();
}

// The player's car knocked car i with force: a hit on the getaway car counts
function rammed(i, force) {
    if (active < 0 || jt[active] != CHASE || i != runner || force < HIT_FORCE || hitWait > 0)
        return false;
    hitWait = 20;
    hits++;
    if (hits >= HITS) {
        pass();
        return true;
    }
    hud.say("HIT", hits, hud.COUNT, HITS);
    return true;
}

// ---- drawing ---------------------------------------------------------------------

// The markers on the ground, on the screen whose top left is cx, cy
function draw(cx, cy) {
    var pulse = (frame() >> 2) % 4;
    sheet(IMG.people);
    var t0 = here >= 0 ? here * 6 : 0, t1 = here >= 0 ? t0 + 6 : TAPES;
    for (var i = t0; i < t1; i++) {
        if (((found >> i) & 1) == 0) {
            var sx = tpx[i] - cx, sy = tpy[i] - cy;
            if (sx > -8 && sx < 168 && sy > -8 && sy < 128)
                spr(18, sx - 4, sy - 4 - ((frame() >> 4) & 1));
        }
    }
    for (var i = 0; i < DISTRICTS; i++) {
        var sx = spx[i] - cx, sy = spy[i] - cy;
        if (sx > -10 && sx < 170 && sy > -10 && sy < 130) {
            if (police.stars > 0)
                circ(sx, sy, 7 + pulse / 2, 11);
            spr(21, sx - 4, sy - 4);
        }
    }
    if (active < 0) {
        if (done < JOBS) {
            var g = flr(done / PER);
            ring(gx[g] - cx, gy[g] - cy, 10, pulse);
            spr(20, gx[g] - cx - 4, gy[g] - cy - 4);
        }
        sheet();
        return;
    }
    var t = jt[active], p = j0[active] + stage;
    if (t == CHASE) {
        var sx = flr(traffic.x[runner]) - cx, sy = flr(traffic.y[runner]) - cy;
        trifill(sx - 3, sy - 14 - pulse / 2, sx + 3, sy - 14 - pulse / 2, sx, sy - 10 - pulse / 2, 8);
    } else {
        var sx = qx[p] - cx, sy = qy[p] - cy;
        ring(sx, sy, t == TAXI ? 8 : 9, pulse);
        if (t == DELIVER && stage == 0)
            spr(19, sx - 4, sy - 4);
        else if (t != TAXI || stage == 1)
            spr(22, sx - 2, sy - 7);
        if (t == TRIAL && stage + 1 < jn[active])
            circ(qx[p + 1] - cx, qy[p + 1] - cy, 6, 5);
    }
    sheet();
}

// A marker's ring at sx, sy, breathing with pulse
function ring(sx, sy, r, pulse) {
    if (sx < -16 || sx > 176 || sy < -16 || sy > 136)
        return;
    circ(sx, sy, r + pulse / 2, 10);
    circ(sx, sy, r + pulse / 2 + 1, 9);
}
