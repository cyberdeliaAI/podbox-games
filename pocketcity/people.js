// people: the people on the sidewalks.
//
// Like the traffic, they are kept round the player: one comes into being
// on a sidewalk out of sight and goes when far off, about nine at a time.
// Each walks straight along the sidewalk, east, north, west or south, and
// turns where it ends or now and then on a whim. They keep off the roads,
// and out of the buildings, the water and the trees.
//
// A car coming at one fast makes them jump aside (a dash across the car's
// way, roads allowed). One the player's car hits anyway is knocked down,
// gets up a couple of seconds later and runs off; main.js hears of it
// through knocked(), for the police. A driver whose car the player takes
// runs off too. A taxi fare waits where jobs.js puts them, standing.
//
// Each wears one of eight looks, shirt and trousers, swapped in with pal()
// when drawn.

const MAX = 12;                    // people at once
const WANT = 9;                    // ...kept round the player
const WALKING = 1, DODGING = 2, DOWN = 3, FLEEING = 4, WAITING = 5;
const PACE = 0.45;                 // pixels a tick, walking
const DASH = 1.7;                  // ...jumping aside
const RUN = 1.2;                   // ...running off
const DODGE_TICKS = 16;
const DOWN_TICKS = 60;
const FLEE_TICKS = 70;
const DANGER = 34.0;               // pixels: a car this near and coming makes them jump
const HIT_AT = 6.0;                   // pixels: a car this near and fast knocks them down
const HIT_SPEED = 1.0;
const NEAR_MIN = 110, NEAR_MAX = 200, GONE = 240;   // pixels from the player
const SHIRT = 65, SHIRT_DARK = 66, TROUSERS = 67;   // palette entries in the picture
const LOOK = 136;                  // the looks: shirt, shade, trousers, three entries each
const LOOKS = 8;
const STRIDE = 5.0;                // pixels a step

var DX = [1, 0, -1, 0];            // east, north, west, south: the order of the picture's rows
var DY = [0, -1, 0, 1];

var on = new Uint8Array(MAX);      // what each is doing, 0 for an empty slot
var x = new FixArray(MAX), y = new FixArray(MAX);   // feet, world pixels
var d = new Uint8Array(MAX);       // the way they face
var look = new Uint8Array(MAX);
var timer = new Int32Array(MAX);       // ticks left of a dash, a fall or a run
var walked = new FixArray(MAX);    // pixels walked, for the steps
var road = new Uint8Array(MAX);    // 1 while standing on a road, kept as they move
var count = 0;

// Every slot empty, for a new game
function reset() {
    fill(on, 0);
}

// A tick: people come and go round the player, walk, jump aside, fall
function update(k, px, py, cx, cy) {
    count = 0;
    for (var i = 0; i < MAX; i++) {
        var st = on[i];
        if (st == 0)
            continue;
        if (st != WAITING && (frame() + i) % 4 == 0) {
            var dx = flr(x[i]) - flr(px), dy = flr(y[i]) - flr(py);
            if (dx * dx + dy * dy > GONE * GONE && (abs(flr(x[i]) - cx) > 90 || abs(flr(y[i]) - cy) > 70)) {
                on[i] = 0;
                continue;
            }
        }
        count++;
        if (st == WAITING)
            continue;
        // out of sight, a person moves every third tick, three times as far
        var kk = k, ticks = 1;
        if (abs(flr(x[i]) - cx) > 100 || abs(flr(y[i]) - cy) > 80) {
            if ((frame() + i) % 3 != 0)
                continue;
            kk = k * 3.0;
            ticks = 3;
        }
        if (st == DOWN) {
            timer[i] -= ticks;
            if (timer[i] <= 0) {
                on[i] = FLEEING;
                timer[i] = FLEE_TICKS;
                away(i, px, py);
            }
            continue;
        }
        if (player.inCar)
            danger(i, kk);
        st = on[i];
        if (st == DOWN)
            continue;
        if (st == WALKING) {
            if (rnd(100) < 1.5 * kk)
                turnAside(i);
            if (!step(i, PACE * kk, road[i] == 1))
                turnAside(i);
        } else {
            var sp = st == DODGING ? DASH : RUN;
            if (!step(i, sp * kk, true) && st == FLEEING)
                turnAside(i);
            timer[i] -= ticks;
            if (timer[i] <= 0)
                on[i] = WALKING;
        }
    }
    if (count < WANT && frame() % 4 == 0)
        spawn(px, py, cx, cy);
}

// Whether a person can stand at px, py: a sidewalk, a plaza, grass or sand,
// or a road when road is true; never a wall
function walkable(px, py, road) {
    var f = city.at(px, py);
    if ((f & city.SOLID) != 0)
        return false;
    if ((f & city.ROAD) != 0)
        return road;
    return (f & (city.WALK | city.GRASS)) != 0;
}

// Whether person i is standing on a road
function onRoad(i) {
    return road[i] == 1;
}

// Person i on by sp pixels the way they face, looking 3 pixels further;
// false when the way is blocked. onroad: roads allowed
function step(i, sp, onroad) {
    var nx = x[i] + DX[d[i]] * sp, ny = y[i] + DY[d[i]] * sp;
    if (!walkable(nx + DX[d[i]] * 3.0, ny + DY[d[i]] * 3.0, onroad))
        return false;
    if ((flr(nx) >> 3) != (flr(x[i]) >> 3) || (flr(ny) >> 3) != (flr(y[i]) >> 3))
        road[i] = (city.at(nx, ny) & city.ROAD) != 0 ? 1 : 0;
    x[i] = nx;
    y[i] = ny;
    walked[i] += sp;
    if (walked[i] >= STRIDE * 4.0)
        walked[i] -= STRIDE * 4.0;
    return true;
}

// Person i turns: left or right if they can go on that way, else back
function turnAside(i) {
    var a = (d[i] + (rnd(2) < 1 ? 1 : 3)) & 3, b = (a + 2) & 3;
    var road = onRoad(i);
    if (walkable(x[i] + DX[a] * 5.0, y[i] + DY[a] * 5.0, road))
        d[i] = a;
    else if (walkable(x[i] + DX[b] * 5.0, y[i] + DY[b] * 5.0, road))
        d[i] = b;
    else
        d[i] = (d[i] + 2) & 3;
}

// Person i facing away from px, py, the nearest of the four ways
function away(i, px, py) {
    var dx = x[i] - px, dy = y[i] - py;
    if (abs(dx) > abs(dy))
        d[i] = dx > 0.0 ? 0 : 2;
    else
        d[i] = dy > 0.0 ? 3 : 1;
}

// The player's car coming at person i: they jump aside, or are knocked down
function danger(i, k) {
    var dx = x[i] - car.x, dy = y[i] - (car.y + 2.0);
    if (abs(dx) > DANGER || abs(dy) > DANGER)
        return;
    var sp = sqrt(car.vx * car.vx + car.vy * car.vy);
    if (abs(dx) < HIT_AT && abs(dy) < HIT_AT && sp > HIT_SPEED) {
        on[i] = DOWN;
        timer[i] = DOWN_TICKS;
        knocked(x[i], y[i]);
        return;
    }
    if (sp < 1.0 || on[i] == DODGING)
        return;
    // coming at them: ahead of the car and near its way
    var fx = car.vx / sp, fy = car.vy / sp;
    var ahead = dx * fx + dy * fy, across = dx * fy - dy * fx;
    if (ahead < 0.0 || abs(across) > 12.0)
        return;
    // jump to the side they are already on, across the car's way
    var jx = across > 0.0 ? fy : 0.0 - fy, jy = across > 0.0 ? 0.0 - fx : fx;
    if (abs(jx) > abs(jy))
        d[i] = jx > 0.0 ? 0 : 2;
    else
        d[i] = jy > 0.0 ? 3 : 1;
    on[i] = DODGING;
    timer[i] = DODGE_TICKS;
}

// ---- coming and going ---------------------------------------------------------

// A free slot, or -1
function slot() {
    for (var i = 0; i < MAX; i++)
        if (on[i] == 0)
            return i;
    return -1;
}

// Someone new at px, py doing st, facing way dd. Returns the slot or -1
function add(px, py, st, dd) {
    var i = slot();
    if (i < 0)
        return -1;
    on[i] = st;
    x[i] = px;
    y[i] = py;
    d[i] = dd;
    look[i] = flr(rnd(LOOKS));
    road[i] = (city.at(px, py) & city.ROAD) != 0 ? 1 : 0;
    timer[i] = 0;
    walked[i] = rnd(STRIDE * 4.0);
    return i;
}

// One try at someone new on a sidewalk near the player, out of sight
function spawn(px, py, cx, cy) {
    var qx = flr(px + rnd(NEAR_MAX * 2) - NEAR_MAX), qy = flr(py + rnd(NEAR_MAX * 2) - NEAR_MAX);
    var dx = qx - flr(px), dy = qy - flr(py);
    var dd = dx * dx + dy * dy;
    if (dd < NEAR_MIN * NEAR_MIN || dd > NEAR_MAX * NEAR_MAX)
        return;
    if (abs(qx - cx) < 90 && abs(qy - cy) < 70)
        return;
    qx = (qx >> 3) * 8 + 4;
    qy = (qy >> 3) * 8 + 4;
    if ((city.at(qx, qy) & city.WALK) == 0 || !walkable(qx, qy, false))
        return;
    var i = add(qx, qy, WALKING, flr(rnd(4)));
    if (i >= 0 && !walkable(x[i] + DX[d[i]] * 5.0, y[i] + DY[d[i]] * 5.0, false))
        turnAside(i);
}

// A driver thrown out of their car at px, py runs off from the player
function eject(px, py) {
    var i = add(px, py, FLEEING, 0);
    if (i < 0)
        return;
    timer[i] = FLEE_TICKS;
    away(i, player.x, player.y);
}

// A taxi fare standing at px, py; returns the slot, -1 when none is free
function fare(px, py) {
    var i = slot();
    if (i < 0) {
        // make room: the furthest walker goes
        var far = -1, fd = 0;
        for (var j = 0; j < MAX; j++) {
            var dd = abs(flr(x[j]) - flr(px)) + abs(flr(y[j]) - flr(py));
            if (on[j] != WAITING && dd > fd) {
                fd = dd;
                far = j;
            }
        }
        if (far < 0)
            return -1;
        on[far] = 0;
    }
    return add(px, py, WAITING, 3);
}

// ---- drawing -------------------------------------------------------------------------

// The people on the screen whose top left is cx, cy
function draw(cx, cy) {
    sheet(IMG.people);
    for (var i = 0; i < MAX; i++) {
        var st = on[i];
        if (st == 0)
            continue;
        var sx = flr(x[i]) - cx, sy = flr(y[i]) - cy;
        if (sx < -6 || sx > 166 || sy < -2 || sy > 128)
            continue;
        var n = 12 + (d[i] & 1);
        if (st != DOWN)
            n = d[i] * 3 + (st == WAITING ? 0 : 1 + flr(walked[i] / STRIDE) % 2);
        dress(look[i]);
        spr(n, sx - 4, sy - 7);
    }
    dress(-1);
    sheet();
}

// The colours of look l swapped in; -1 puts the picture's own back
function dress(l) {
    if (l < 0) {
        pal(SHIRT, SHIRT);
        pal(SHIRT_DARK, SHIRT_DARK);
        pal(TROUSERS, TROUSERS);
        return;
    }
    pal(SHIRT, LOOK + l * 3);
    pal(SHIRT_DARK, LOOK + l * 3 + 1);
    pal(TROUSERS, LOOK + l * 3 + 2);
}
