// launcher: the aim, the two bubbles it holds and the one in flight.
//
// Spin aiming turns the arrow with the wheel, finely, and Prev and Next
// nudge it while held. Thumb aiming points it where the thumb rests on the
// ring; it holds still while Select is down, so moving to the button
// doesn't pull it off. Select fires, Play swaps the loaded bubble with the
// next. One bubble flies at a time; it bounces off the walls and comes to
// rest where it first touches a bubble or the ceiling.

const X = 80, Y = 111;             // the launcher's centre
const MUZZLE = 6.0;                // where a bubble leaves it
const SPEED = 4.2;                 // pixels a tick a bubble flies, at 33 a second
const LO = 0.045, HI = 0.455;      // the aim's limits in turns: 0 right, 0.25 straight up
const SPIN = 256.0;                // wheel clicks a whole turn of the aim
const NUDGE = 0.0025;              // turns a tick Prev or Next moves it
const LEFT = 36.0, RIGHT = 124.0;  // a bubble's centre bounces off the walls here
const DOTS = 9;                    // dots on the guide
const GAP = 7.0;                   // pixels between them

var aim = 0.25;
var cur = 1, nxt = 1;              // the loaded bubble and the one after
var flying = false;
var x = 0.0, y = 0.0, dx = 0.0, dy = 0.0, c = 0;
var mult = 1;                      // the shot's beat multiplier: 1, 2 or 3

var gx = new Int32Array(DOTS), gy = new Int32Array(DOTS);
var gn = 0, guideAim = -1.0;       // the guide's dots, and the aim they were made for (-1 none, -2 wait a tick)

function reset() {
    aim = 0.25;
    flying = false;
    cur = pick();
    nxt = pick();
    guideAim = -1.0;
}

// A colour still on the board, to load
function pick() {
    var k = levels.colours(level);
    if (board.total == 0)
        return 1 + rnd(k);
    var v = 1 + rnd(k);
    for (var tries = 0; tries < 12 && !board.has(v); tries++)
        v = 1 + rnd(k);
    if (!board.has(v)) {
        for (v = 1; v < 8; v++)
            if (board.has(v))
                break;
    }
    return v;
}

// A colour shot off the board isn't offered any more
function refresh() {
    if (board.total == 0)
        return;
    if (!board.has(cur))
        cur = pick();
    if (!board.has(nxt))
        nxt = pick();
}

// ---- a tick --------------------------------------------------------------------

function update(spin, k) {
    if (spin) {
        aim -= wheel() / SPIN;
    } else {
        var p = wheelpos();
        if (p >= 0 && !btn(4)) {
            var want = 0.25 - p / 96.0;
            want -= flr(want);
            want = want > 0.75 ? LO : mid(LO, want, HI);
            aim += mid(-0.03, (want - aim) * 0.5, 0.03);
        }
    }
    if (btn(0))
        aim += NUDGE * k;
    if (btn(1))
        aim -= NUDGE * k;
    aim = mid(LO, aim, HI);
}

function swap() {
    var v = cur;
    cur = nxt;
    nxt = v;
    sfx(SFX.swap);
}

// Fires the loaded bubble; p is when Select went down, in the track's ms
function fire(p) {
    if (flying)
        return false;
    flying = true;
    var ca = cos(aim), sa = sin(aim);
    x = X + ca * MUZZLE;
    y = Y + sa * MUZZLE;
    dx = ca * SPEED;
    dy = sa * SPEED;
    c = cur;
    cur = nxt;
    nxt = pick();
    mult = rhythm.judge(p);
    sfx(SFX.shoot);
    return true;
}

// The bubble in flight moves in two half steps, so it can't pass through
// one; it comes to rest through main.js's landed()
function fly(k) {
    if (!flying)
        return;
    for (var i = 0; i < 2; i++) {
        x += dx * 0.5 * k;
        y += dy * 0.5 * k;
        if (x < LEFT) {
            x = LEFT * 2.0 - x;
            dx = -dx;
            sfx(SFX.bounce);
        } else if (x > RIGHT) {
            x = RIGHT * 2.0 - x;
            dx = -dx;
            sfx(SFX.bounce);
        }
        if (board.touches(x, y)) {
            flying = false;
            landed(x, y, c, mult);
            return;
        }
    }
}

// ---- drawing -------------------------------------------------------------------

// The guide: dots along the aim, bouncing off the walls, up to the first
// bubble they meet. Made again only when the aim or the board changes.
function guide() {
    guideAim = aim;
    var ca = cos(aim), sa = sin(aim);
    var px = X + ca * 10.0, py = Y + sa * 10.0;
    gn = 0;
    for (var i = 0; i < DOTS; i++) {
        px += ca * GAP;
        py += sa * GAP;
        if (px < LEFT) {
            px = LEFT * 2.0 - px;
            ca = -ca;
        } else if (px > RIGHT) {
            px = RIGHT * 2.0 - px;
            ca = -ca;
        }
        if (board.touches(px, py))
            break;
        gx[gn] = px;
        gy[gn] = py;
        gn++;
    }
}

function draw(live, ring, base) {
    if (live) {
        // -2: the field was drawn again this tick; the guide waits a tick
        if (guideAim == -2.0)
            guideAim = -1.0;
        else if (aim != guideAim)
            guide();
        for (var i = 0; i < gn; i++)
            pset(gx[i], gy[i], i == 0 || ring ? 7 : 13);
    }
    // the base, its ring lit on the beat
    circfill(X, Y + 4, 9, 44);
    circ(X, Y + 4, 9, ring ? 7 : 43);
    // the arrow
    var ca = cos(aim), sa = sin(aim);
    trifill(X + ca * 15.0, Y + sa * 15.0,
            X + ca * 7.0 - sa * 3.0, Y + sa * 7.0 + ca * 3.0,
            X + ca * 7.0 + sa * 3.0, Y + sa * 7.0 - ca * 3.0, live ? 7 : 6);
    if (live) {
        spr(base + cur - 1, X - 4, Y - 4);
        spr(base + nxt - 1, X + 14, Y + 1);
    }
    if (flying)
        spr(base + c - 1, x - 4, y - 4);
}
