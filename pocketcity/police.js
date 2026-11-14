// police: the wanted level, and the police cars that come with it.
//
// Offences add heat: running a red light, ramming a car, knocking someone
// down, taking a car with its driver in it, ramming the police. Seen by a
// police car, the whole of it counts; unseen (someone called it in), half,
// and never past one star. Heat makes stars: 20 one, 50 two, 80 three.
// Out of any police car's sight for five seconds, the heat starts to fall,
// a point every quarter second.
//
// Each star puts a police car on the streets, come from out of sight like
// the traffic. They drive the lanes toward where they last saw the player,
// sirens going, through red lights. Near and with a clear view (no
// building in the way), one leaves the lanes and heads straight for the
// player; losing them, it goes back to the lanes (traffic.snap()). A
// police car next to the player standing (or on foot) for a second and a
// half: busted. At no stars the police give up and drive on as traffic.

const STAR1 = 20, STAR2 = 50, STAR3 = 80, HOT = 100;   // heat for one, two, three stars, and the most
const UNSEEN_CAP = 30;             // the heat an offence nobody official saw can reach
const SEE = 128;                   // pixels: a police car this near, with a clear view, sees the player
const COOL = 150;                  // ticks out of sight before the heat falls
const COOL_STEP = 8;               // ticks a point of heat, then
const CHASE = 72;                  // pixels: nearer, with a clear view, a police car leaves the lanes
const GIVE_UP = 130;               // pixels: further, or out of sight a while, it goes back to them
const BLIND = 45;                  // ticks out of sight, chasing off the lanes, before going back
const CATCH = 18;                  // pixels: a police car this near the player standing...
const BUST_TICKS = 50;             // ...for this many ticks: busted
const PURSUE = 2.6;                // pixels a tick, off the lanes
const STEER = 0.03;                // turns a tick, off the lanes
const FAR_OFF = 420;               // pixels: a police car further off than this, out of sight, goes
const SPAWN_MIN = 170, SPAWN_MAX = 260;
const RED_BOX = 15.0;              // pixels from a junction's middle that count as in it

var heat = 0, stars = 0, worst = 0;   // worst: the most stars since the last time at none
var seen = false;                  // a police car sees the player this tick
var calm = 0;                      // ticks unseen
var gx = 0, gy = 0;                // where the police last saw the player
var near = 0;                      // ticks a police car has been next to the player standing
var busted = false;
var getaway = false;               // three stars lost, this tick: for the achievement
var siren = 9999;                  // pixels to the nearest police car with its siren on
var blind = new Int32Array(16);    // per car: ticks without a view, off the lanes
var inBox = -1;                    // the junction the player's car is in, for red lights

// A clean slate
function reset() {
    heat = 0;
    stars = 0;
    worst = 0;
    calm = 0;
    near = 0;
    busted = false;
    inBox = -1;
}

// Every police car gone and no heat: after a bust or fresh paint
function standDown() {
    for (var i = 0; i < traffic.MAX; i++)
        if (traffic.on[i] == traffic.POLICE)
            traffic.on[i] = traffic.FREE;
    heat = 0;
    stars = 0;
    worst = 0;
    near = 0;
}

// An offence worth n heat
function offence(n) {
    if (witness())
        heat = min(HOT, heat + n);
    else if (heat < UNSEEN_CAP)
        heat = min(UNSEEN_CAP, heat + flr(n / 2));
    calm = 0;
    rank();
}

// The stars from the heat, whenever it changes
function rank() {
    stars = heat >= STAR3 ? 3 : heat >= STAR2 ? 2 : heat >= STAR1 ? 1 : 0;
    if (stars > worst)
        worst = stars;
}

// Whether a police car is near enough to see the player
function witness() {
    var px = flr(player.px()), py = flr(player.py());
    for (var i = 0; i < traffic.MAX; i++) {
        if (traffic.on[i] == traffic.POLICE && abs(flr(traffic.x[i]) - px) < SEE && abs(flr(traffic.y[i]) - py) < SEE)
            return true;
    }
    return false;
}

// A tick: the stars, the police cars, the heat cooling and the bust
function update(k) {
    getaway = false;
    var px = flr(player.px()), py = flr(player.py());
    if (player.inCar)
        redLight(px, py);
    rank();
    seen = false;
    siren = 9999;
    var cops = 0, close = false;
    var slow = !player.inCar || abs(car.fwd) < 0.5;
    for (var i = 0; i < traffic.MAX; i++) {
        if (traffic.on[i] != traffic.POLICE)
            continue;
        var dx = flr(traffic.x[i]) - px, dy = flr(traffic.y[i]) - py;
        var d = abs(dx) + abs(dy);
        if (stars == 0) {
            // they give up, and drive on as traffic
            if (traffic.free[i] == 1)
                traffic.snap(i);
            traffic.on[i] = traffic.DRIVE;
            traffic.siren[i] = 0;
            continue;
        }
        if (d > FAR_OFF && (abs(dx) > 100 || abs(dy) > 80)) {
            traffic.on[i] = traffic.FREE;
            continue;
        }
        cops++;
        if (traffic.siren[i] == 1 && d < siren)
            siren = d;
        var sees = d < SEE && inView(traffic.x[i], traffic.y[i], player.px(), player.py());
        if (sees) {
            seen = true;
            gx = px;
            gy = py;
        }
        if (traffic.free[i] == 1) {
            blind[i] = sees ? 0 : blind[i] + 1;
            if (d > GIVE_UP || blind[i] > BLIND)
                traffic.snap(i);
            else
                pursue(i, k);
        } else if (sees && d < CHASE) {
            traffic.free[i] = 1;
            traffic.v[i] = max(traffic.v[i], 1.0);
            blind[i] = 0;
        }
        if (abs(dx) < CATCH && abs(dy) < CATCH && slow)
            close = true;
    }
    near = close ? near + 1 : 0;
    if (near > BUST_TICKS)
        busted = true;
    if (cops < stars && frame() % 20 == 0)
        spawn(px, py);
    // out of sight, the heat falls
    if (seen) {
        calm = 0;
    } else if (heat > 0) {
        calm++;
        if (calm > COOL && calm % COOL_STEP == 0) {
            heat--;
            rank();
            if (heat == 0) {
                if (worst == 3)
                    getaway = true;
                worst = 0;
            }
        }
    }
}

// Whether the view from ax, ay to bx, by is clear: no building or tree at
// three points between. Water doesn't hide anything
function inView(ax, ay, bx, by) {
    for (var t = 1; t < 4; t++) {
        var f = city.at(ax + (bx - ax) * t / 4.0, ay + (by - ay) * t / 4.0);
        if ((f & city.SOLID) != 0 && (f & city.WATER) == 0)
            return false;
    }
    return true;
}

// A police car off the lanes heads straight for the player, slowing as it
// gets there, sliding along walls
function pursue(i, k) {
    var tx = player.px(), ty = player.py();
    var x = traffic.x[i], y = traffic.y[i];
    var a = atan2(tx - x, ty - y);
    var dh = a - traffic.h[i];
    dh -= flr(dh + 0.5);
    var h = traffic.h[i] + mid(0.0 - STEER, dh, STEER) * k;
    h -= flr(h);
    traffic.h[i] = h;
    var d = abs(tx - x) + abs(ty - y);
    var want = d < 24.0 ? 0.8 : PURSUE;
    var v = traffic.v[i];
    v += mid(-0.15, want - v, 0.06) * k;
    traffic.v[i] = v;
    var nx = x + cos(h) * v * k, ny = y + sin(h) * v * k;
    var hit = false;
    if (!wall(nx, y))
        x = nx;
    else
        hit = true;
    if (!wall(x, ny))
        y = ny;
    else
        hit = true;
    if (hit)
        traffic.v[i] = v * 0.6;
    traffic.x[i] = x;
    traffic.y[i] = y;
}

// Whether a car would touch a wall at px, py: four points round it
function wall(px, py) {
    return (city.at(px - 4.0, py) & city.SOLID) != 0 || (city.at(px + 4.0, py) & city.SOLID) != 0 ||
           (city.at(px, py - 4.0) & city.SOLID) != 0 || (city.at(px, py + 4.0) & city.SOLID) != 0;
}

// One try at a police car on a street out of sight, on its way
function spawn(px, py) {
    if (!traffic.findLane(px, py, view.cx + 80, view.cy + 60, SPAWN_MIN, SPAWN_MAX))
        return;
    var i = traffic.add(traffic.POLICE, traffic.pick, traffic.pd, traffic.ps, traffic.COP, traffic.COP_PAINT);
    if (i < 0) {
        // no room: the furthest ordinary car makes way
        var far = -1, fd = 0;
        for (var j = 0; j < traffic.MAX; j++) {
            if (traffic.on[j] != traffic.DRIVE)
                continue;
            var dd = abs(flr(traffic.x[j]) - px) + abs(flr(traffic.y[j]) - py);
            if (dd > fd) {
                fd = dd;
                far = j;
            }
        }
        if (far >= 0) {
            traffic.on[far] = traffic.FREE;
            traffic.add(traffic.POLICE, traffic.pick, traffic.pd, traffic.ps, traffic.COP, traffic.COP_PAINT);
        }
    }
    gx = px;
    gy = py;
}

// Running a red light: the player's car coming into a junction fast while
// its way is red there
function redLight(px, py) {
    var sq = roads.square(px, py);
    var now = -1;
    for (var r = roads.rstart[sq]; r < roads.rstart[sq + 1]; r++) {
        var a = roads.rlist[r];
        if (abs(roads.nx[a] - px) < RED_BOX && abs(roads.ny[a] - py) < RED_BOX) {
            now = a;
            break;
        }
    }
    if (now >= 0 && now != inBox && roads.sig[now] == 1) {
        var vx = car.vx, vy = car.vy;
        if (abs(vx) + abs(vy) > 1.0) {
            var d = abs(vx) > abs(vy) ? (vx > 0.0 ? 1 : 3) : (vy > 0.0 ? 2 : 0);
            if (roads.signal(now, d) == 2)
                ranRed();
        }
    }
    inBox = now;
}
