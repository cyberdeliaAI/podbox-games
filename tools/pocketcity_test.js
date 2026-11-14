// stress: plays Pocket City 3D and checks it, for tools/pocketcity_test.py.
// It isn't part of the game: the tool copies it into a scratch copy of the
// cart as stress.js and makes main.js's update() call tick() first.
//
// The driving and walking come from the tool, as wheel turns and held
// buttons through pbgvm. This side starts the game and checks the city
// every tick. Its own work runs inside prof() sections named stress, so
// the tool can take it out of the units it reports.
//
// Settings:
//   stress_ticks   the run's length
//   stress_heat    every this many ticks, three stars of heat if there is
//                  less than one, so the police come (0: never)
//   stress_jobs    1: the jobs are played by putting the car where each
//                  wants it (and, for a chase, driving it at the getaway
//                  car); some taxi fares are left to run out of time. Then
//                  the tapes are picked up, one by one
//
// With stress_heat the player has $1,000 to start with, and now and then,
// wanted, drives into the district's paint shop.
//
// Besides the player, the traffic, the people, the police and the jobs, it
// checks the picture: a few pixels of the last frame, away from anything
// drawn over the city, must be the map's tile pixels there. A slip in the
// ring of city.js shows up at once.

const REPORT = 100;
const SHOW = 30;
var SX = [6, 153, 6, 153, 80, 40, 120];
var SY = [30, 30, 100, 100, 40, 70, 70];

var last = 0, heatEvery = 0, playJobs = 0;
var ticks = 0, violations = 0, shown = 0;
var distance = 0.0, metres = 0, top = 0, crashes = 0, pixels = 0, foot = 0, busts = 0, overlaps = 0;
var lastX = 0.0, lastY = 0.0;
var most = 0, policeMost = 0, peopleMost = 0, starsMost = 0, passed = 0, failed = 0;
var lastDone = 0, lastActive = -1, jobTicks = 0, stageWas = -1, lastCash = 0;
var timedOut = 0;                  // jobs already left to run out of time once, a bit each
var walking = 0;                   // ticks on foot
var sprays = 0, tapeAt = 0;
var whyOut = 0, whyFare = 0, whyAway = 0, whyBust = 0, whyOther = 0;

// Called first thing in update()
function tick() {
    prof("stress");
    ticks++;
    if (ticks == 1) {
        var v = sys.setting("stress_ticks");
        if (v != null)
            last = flr(v);
        v = sys.setting("stress_heat");
        if (v != null)
            heatEvery = flr(v);
        v = sys.setting("stress_jobs");
        if (v != null)
            playJobs = flr(v);
    }
    if (scene == TITLE) {
        startGame();
        if (heatEvery > 0)
            cash = 1000;
        lastX = player.px();
        lastY = player.py();
        lastDone = jobs.done;
        lastCash = cash;
    } else if (scene == PLAY) {
        check();
        if (heatEvery > 0 && ticks % heatEvery == 0 && police.stars == 0) {
            police.heat = police.STAR3 + 5;
            police.rank();
        }
        // wanted, now and then into the paint shop
        if (heatEvery > 0 && police.stars > 0 && player.inCar && ticks % 1000 == 500 && jobs.here >= 0) {
            place(jobs.spx[jobs.here], jobs.spy[jobs.here]);
            sprays++;
        }
        if (!player.inCar && ++walking > 240)
            assist();
        if (player.inCar)
            walking = 0;
        if (playJobs == 1)
            pilot();
    }
    if (ticks % REPORT == 0 || ticks == last)
        report();
    prof();
}

// ---- the checks ----------------------------------------------------------------

// Everything, once a tick
function check() {
    var px = player.px(), py = player.py();
    if (px < 0.0 || py < 0.0 || px >= city.mw * 8 || py >= city.mh * 8)
        fail("place");
    if (player.inCar) {
        // never in a wall: eight points a little inside the car's own circle,
        // looked at here rather than through car.blocked(), which a fault could share
        for (var i = 0; i < 8; i++)
            if ((city.at(px + cos(i / 8.0) * 4.0, py + sin(i / 8.0) * 4.0) & city.SOLID) != 0)
                fail("wall");
        if (sqrt(car.vx * car.vx + car.vy * car.vy) > car.vmax() + 1.5)
            fail("speed");
        if (car.h < 0.0 || car.h >= 1.0 || car.steer < -1.0 || car.steer > 1.0)
            fail("heading");
        if (car.shape > 3 || car.paint > 7)
            fail("car");
    } else {
        foot++;
        for (var i = 0; i < 4; i++)
            if ((city.at(px + cos(i / 4.0) * 2.0, py + sin(i / 4.0) * 2.0) & city.SOLID) != 0)
                fail("foot");
    }
    if (view.cx < 0 || view.cy < 0 || view.cx > city.mw * 8 - 160 || view.cy > city.mh * 8 - 120)
        fail("camera");
    if (city.bx != view.cx >> 3 || city.by != view.cy >> 3)
        fail("ring");
    cars();
    crowd();
    if (police.heat < 0 || police.heat > police.HOT)
        fail("heat");
    var st = police.heat >= police.STAR3 ? 3 : police.heat >= police.STAR2 ? 2 : police.heat >= police.STAR1 ? 1 : 0;
    if (st != police.stars && police.heat > 0 && frame() > 2)
        fail("stars");
    if (police.stars > starsMost)
        starsMost = police.stars;
    work();
    if (cash < 0 || cash > CASH_MAX)
        fail("cash");
    picture();
    // busted: back at the start in one jump
    if (abs(px - startX) < 1.0 && abs(py - startY) < 1.0 && (abs(lastX - startX) > 40.0 || abs(lastY - startY) > 40.0))
        busts++;
    var d = sqrt((px - lastX) * (px - lastX) + (py - lastY) * (py - lastY));
    if (d < 40.0) {
        distance += d;
        if (distance >= 100.0) {
            metres += flr(distance);
            distance -= flr(distance);
        }
    }
    lastX = px;
    lastY = py;
    if (player.inCar) {
        var kh = car.kmh();
        if (kh > top)
            top = kh;
        if (car.crashed >= car.CRASH)
            crashes++;
    }
}

// The cars: each on its lane with a road under it, its numbers in range
function cars() {
    var n = 0, cops = 0;
    for (var i = 0; i < traffic.MAX; i++) {
        var kd = traffic.on[i];
        if (kd == traffic.FREE)
            continue;
        n++;
        if (kd == traffic.POLICE)
            cops++;
        if (kd > traffic.RUNNER)
            fail("kind");
        var x = traffic.x[i], y = traffic.y[i];
        if (kd == traffic.PARKED || traffic.free[i] == 1) {
            if ((city.at(x, y) & city.SOLID) != 0)
                fail("parked");
            continue;
        }
        var a = traffic.na[i], d = traffic.dir[i];
        if (a < 0 || a >= roads.n || d > 3 || traffic.nb[i] != roads.link[a * 4 + d] || traffic.nb[i] < 0)
            fail("lane");
        if (traffic.v[i] < 0.0 || traffic.v[i] > 3.0)
            fail("pace");
        if (abs(traffic.ox[i]) > 30.0 || abs(traffic.oy[i]) > 30.0)
            fail("offset");
        var lx = x - traffic.ox[i], ly = y - traffic.oy[i];
        if ((city.at(lx, ly) & city.ROAD) == 0)
            fail("offroad");
        if (traffic.turn[i] == traffic.STRAIGHT) {
            if (traffic.s[i] < -1.0 || traffic.s[i] > traffic.len[i] + 1.0)
                fail("along");
            if (abs(lx - (traffic.lx[i] + traffic.ux[i] * traffic.s[i])) > 0.5 ||
                abs(ly - (traffic.ly[i] + traffic.uy[i] * traffic.s[i])) > 0.5)
                fail("geometry");
            // another car on the same stretch, the same way, right on top of it
            for (var j = i + 1; j < traffic.MAX; j++) {
                if (traffic.on[j] != traffic.FREE && traffic.on[j] != traffic.PARKED && traffic.free[j] == 0 &&
                    traffic.turn[j] == traffic.STRAIGHT && traffic.na[j] == a && traffic.dir[j] == d &&
                    abs(traffic.s[j] - traffic.s[i]) < 6.0 && traffic.shock[i] == 0 && traffic.shock[j] == 0)
                    overlaps++;
            }
        } else if (traffic.arc[i] < 0.0 || traffic.arc[i] > 0.26 || traffic.nd[i] < 0) {
            fail("turn");
        }
    }
    if (n > most)
        most = n;
    if (cops > policeMost)
        policeMost = cops;
    if (cops > 3 && police.stars > 0)
        fail("police");
}

// The people: on ground they may stand on, doing something they can do
function crowd() {
    var n = 0;
    for (var i = 0; i < people.MAX; i++) {
        var st = people.on[i];
        if (st == 0)
            continue;
        n++;
        if (st > people.WAITING || people.d[i] > 3)
            fail("person");
        if ((city.at(people.x[i], people.y[i]) & city.SOLID) != 0)
            fail("inwall");
    }
    if (n > peopleMost)
        peopleMost = n;
}

// The jobs: their state in range, and the money only ever paid as earned
function work() {
    if (jobs.done < 0 || jobs.done > jobs.JOBS || jobs.active < -1 || jobs.active >= jobs.JOBS)
        fail("jobs");
    if (jobs.active >= 0) {
        if (jobs.stage < 0 || jobs.stage >= jobs.jn[jobs.active])
            fail("stage");
        if (jobs.left < -100)
            fail("clock");
        if (jobs.jt[jobs.active] == jobs.CHASE && (jobs.runner < 0 || traffic.on[jobs.runner] != traffic.RUNNER))
            fail("runner");
    }
    if (jobs.done > lastDone) {
        passed += jobs.done - lastDone;
        if (cash <= lastCash && cash < CASH_MAX)
            fail("unpaid");
    }
    if (jobs.active < 0 && lastActive >= 0 && jobs.done == lastDone) {
        failed++;
        timedOut |= 1 << lastActive;
        if (hud.saying == "OUT OF TIME")
            whyOut++;
        else if (hud.saying == "YOUR FARE WALKED OFF")
            whyFare++;
        else if (hud.saying == "IT GOT AWAY")
            whyAway++;
        else if (hud.saying == "BUSTED")
            whyBust++;
        else
            whyOther++;
    }

    if (jobs.done < lastDone)
        fail("undone");
    lastDone = jobs.done;
    lastActive = jobs.active;
    lastCash = cash;
}

// The picture against the map, away from everything drawn over it
function picture() {
    for (var i = 0; i < 7; i++) {
        var sx = SX[i], sy = SY[i];
        var wx = view.cx + sx, wy = view.cy + sy;
        if (covered(wx, wy))
            continue;
        var t = mget(wx >> 3, wy >> 3);
        var want = sget((t % 16) * 8 + (wx & 7), (t / 16) * 8 + (wy & 7));
        if (pget(sx, sy) != want)
            fail("picture sample " + i + " at " + wx + "," + wy + " drawn " + pget(sx, sy) + " tile " + want);
        pixels++;
    }
}

// Whether something is drawn over the city near world pixel wx, wy
function covered(wx, wy) {
    if (near(player.px(), player.py(), wx, wy, 14))
        return true;
    for (var i = 0; i < traffic.MAX; i++)
        if (traffic.on[i] != traffic.FREE && near(traffic.x[i], traffic.y[i], wx, wy, 13))
            return true;
    for (var i = 0; i < people.MAX; i++)
        if (people.on[i] != 0 && near(people.x[i], people.y[i] - 3.0, wx, wy, 10))
            return true;
    for (var i = 0; i < jobs.TAPES; i++)
        if (near(jobs.tpx[i], jobs.tpy[i], wx, wy, 8))
            return true;
    for (var i = 0; i < jobs.DISTRICTS; i++)
        if (near(jobs.spx[i], jobs.spy[i], wx, wy, 13) || near(jobs.gx[i], jobs.gy[i], wx, wy, 16))
            return true;
    if (jobs.aim && near(jobs.ax, jobs.ay, wx, wy, 16))
        return true;
    if (jobs.active >= 0 && jobs.jt[jobs.active] == jobs.TRIAL && jobs.stage + 1 < jobs.jn[jobs.active]) {
        var p = jobs.j0[jobs.active] + jobs.stage + 1;
        if (near(jobs.qx[p], jobs.qy[p], wx, wy, 10))
            return true;
    }
    for (var oy = -24; oy <= 24; oy += 48) {
        for (var ox = -24; ox <= 24; ox += 48) {
            var sq = roads.square(wx + ox, wy + oy);
            for (var r = roads.rstart[sq]; r < roads.rstart[sq + 1]; r++) {
                var a = roads.rlist[r];
                if (roads.sig[a] == 1 && near(roads.nx[a], roads.ny[a], wx, wy, 24))
                    return true;
            }
        }
    }
    return false;
}

// Whether ax, ay is within r of bx, by, square
function near(ax, ay, bx, by, r) {
    return abs(flr(ax) - bx) < r && abs(flr(ay) - by) < r;
}

// ---- playing the jobs ----------------------------------------------------------

// Puts the car where the job wants it, a little at a time, so each check
// and stage is seen; a chase drives at the getaway car
function pilot() {
    if (!player.inCar)
        return;
    jobTicks++;
    if (jobs.active < 0) {
        if (jobs.done >= jobs.JOBS) {
            // then the tapes, one every 20 ticks
            if (jobTicks > 20 && tapeAt < jobs.TAPES) {
                place(jobs.tpx[tapeAt], jobs.tpy[tapeAt]);
                tapeAt++;
                jobTicks = 0;
            }
            return;
        }
        if (jobTicks > 40) {
            var g = flr(jobs.done / jobs.PER);
            place(jobs.gx[g], jobs.gy[g]);
            jobTicks = 0;
        }
        return;
    }
    // the taxi jobs of every other district run out of time the first time
    var j = jobs.active;
    if (j % 8 == 1 && ((timedOut >> j) & 1) == 0)
        return;
    if (jobs.stage != stageWas) {
        stageWas = jobs.stage;
        jobTicks = 0;
    }
    var t = jobs.jt[jobs.active];
    if (t == jobs.CHASE) {
        var r = jobs.runner;
        if (r < 0 || jobs.hitWait > 0)
            return;
        if (jobTicks % 30 == 10) {
            // just behind it, coming in fast
            var hh = traffic.h[r];
            place(traffic.x[r] - cos(hh) * 12.0, traffic.y[r] - sin(hh) * 12.0);
            car.h = hh;
            car.vx = cos(hh) * (traffic.v[r] + 1.6);
            car.vy = sin(hh) * (traffic.v[r] + 1.6);
        }
        return;
    }
    if (jobTicks == 20) {
        var p = jobs.j0[jobs.active] + jobs.stage;
        place(jobs.qx[p], jobs.qy[p]);
    }
}

// On foot a long while: a parked car beside the player, and in they get
function assist() {
    walking = 0;
    for (var j = 0; j < traffic.MAX; j++) {
        if (traffic.on[j] == traffic.DRIVE) {
            traffic.on[j] = traffic.FREE;
            break;
        }
    }
    for (var a = 0; a < 8; a++) {
        var x = player.x + cos(a / 8.0) * 10.0, y = player.y + sin(a / 8.0) * 10.0;
        if (!car.blocked(x, y) && traffic.park(x, y, a / 8.0, traffic.SEDAN, 1, false) >= 0) {
            player.into();
            return;
        }
    }
}

// The car moved to px, py (onto the nearest street cell if that is
// solid), standing, the camera after it
function place(px, py) {
    var x = px, y = py;
    for (var r = 0; r < 40 && car.blocked(x, y); r += 4) {
        for (var a = 0; a < 8; a++) {
            x = px + cos(a / 8.0) * r;
            y = py + sin(a / 8.0) * r;
            if (!car.blocked(x, y))
                break;
        }
    }
    if (car.blocked(x, y))
        return;
    car.x = x;
    car.y = y;
    car.stop();
    view.reset();
}

// A check that didn't hold: counted, and the first few printed
function fail(code) {
    violations++;
    if (shown >= SHOW)
        return;
    shown++;
    printh("VIOLATION " + code + " tick " + frame() + " at " + flr(player.px()) + "," + flr(player.py()) +
           " car " + (player.inCar ? 1 : 0) + " cam " + view.cx + "," + view.cy + " jobs " + jobs.done + "/" + jobs.active);
}

// A STRESS line for the tool
function report() {
    printh("STRESS ticks " + ticks + " metres " + (metres + flr(distance)) + " top " + top + " crashes " + crashes +
           " foot " + foot + " cars " + most + " police " + policeMost + " people " + peopleMost + " stars " + starsMost +
           " busts " + busts + " passed " + passed + " failed " + failed + " overlaps " + overlaps +
           " sprays " + sprays + " tapes " + jobs.tapes() + " cash " + cash + " gold " + (car.paint == traffic.GOLD ? 1 : 0) +
           " out " + whyOut + " fare " + whyFare + " away " + whyAway + " bust " + whyBust + " other " + whyOther +
           " checked " + pixels + " violations " + violations);
}
