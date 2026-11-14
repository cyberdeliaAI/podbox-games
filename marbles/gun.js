// gun: the shooter in the middle, its aim, the two balls it holds, and the
// balls in flight.
//
// Thumb steering points the gun at where the thumb rests on the wheel. A
// press of Select fires when it is let go; holding it a moment swaps the
// two balls instead. Select is in the middle of the wheel, so the aim
// holds still while it is down: the thumb leaving the ring for the button
// does not move it.

const CX = 80, CY = 60;            // the gun's centre
const MUZZLE = 9.0;                // where a ball leaves it
const SPEED = 4.5;                 // pixels a tick a shot flies
const MAXS = 3;
const COOL = 7;                    // ticks between shots
const HOLD = 9;                    // ticks Select is held to swap instead

var aim = 0.25;                    // turns: 0 right, 0.25 up
var cur = 1, nxt = 1;              // the loaded ball and the one after
var cool = 0;
var held = 0;
var armed = true;                  // false while the Select that began the level is still down

var on = new Uint8Array(MAXS);
var x = new FixArray(MAXS), y = new FixArray(MAXS);
var dx = new FixArray(MAXS), dy = new FixArray(MAXS);
var c = new Uint8Array(MAXS);

// A ball's colour on the screen, by its sprite number
var INK = [0, 8, 10, 11, 12, 14, 9];

function reset() {
    fill(on, 0);
    cur = chain.liveColour();
    nxt = chain.liveColour();
    cool = 0;
    held = 0;
    armed = !btn(4);
}

function adiff(a, b) {
    var d = a - b;
    return d - flr(d + 0.5);
}

// ---- a tick --------------------------------------------------------------------

function update(spin) {
    if (cool > 0)
        cool--;

    // aim
    if (!spin) {
        var p = wheelpos();
        if (p >= 0 && !btn(4)) {
            var d = adiff(0.25 - p / 96.0, aim);
            aim += mid(-0.06, d * 0.5, 0.06);
        }
    } else {
        aim -= wheel() / 192.0;
        if (btn(0))
            aim += 0.008;
        if (btn(1))
            aim -= 0.008;
    }
    aim -= flr(aim);

    // fire on letting go of Select; swap on holding it, or on Play
    if (btn(4) && armed) {
        held++;
        if (held == HOLD)
            swap();
    }
    if (btnr(4)) {
        if (held < HOLD && armed)
            fire();
        held = 0;
        armed = true;
    }
    if (btnp(3))
        swap();

    // a colour shot out of the chain is not offered any more
    if (chain.n > 0) {
        if (!chain.has(cur))
            cur = chain.liveColour();
        if (!chain.has(nxt))
            nxt = chain.liveColour();
    }

    fly();
}

function swap() {
    var t0 = cur;
    cur = nxt;
    nxt = t0;
    sfx(SFX.swap);
}

function fire() {
    if (cool > 0)
        return;
    for (var i = 0; i < MAXS; i++) {
        if (on[i] == 0) {
            on[i] = 1;
            x[i] = CX + cos(aim) * MUZZLE;
            y[i] = CY + sin(aim) * MUZZLE;
            dx[i] = cos(aim) * SPEED;
            dy[i] = sin(aim) * SPEED;
            c[i] = cur;
            cur = nxt;
            nxt = chain.liveColour();
            cool = COOL;
            sfx(SFX.shoot);
            return;
        }
    }
}

// Each shot moves in two half steps, so it cannot pass through a ball
function fly() {
    for (var i = 0; i < MAXS; i++) {
        if (on[i] == 0)
            continue;
        for (var k = 0; k < 2; k++) {
            x[i] += dx[i] * 0.5;
            y[i] += dy[i] * 0.5;
            var h = chain.hitTest(x[i], y[i]);
            if (h >= 0) {
                chain.insert(h, x[i], y[i], c[i]);
                on[i] = 0;
                sfx(SFX.clack);
                break;
            }
        }
        if (on[i] != 0 && (x[i] < -6 || x[i] > 166 || y[i] < -6 || y[i] > 126))
            on[i] = 0;
    }
}

// ---- drawing -------------------------------------------------------------------

function draw() {
    // a short guide along the aim
    var ca = cos(aim), sa = sin(aim);
    for (var r = 16; r <= 34; r += 6)
        pset(CX + ca * r, CY + sa * r, 6);

    // the gun: a body turned to the aim, the loaded ball at its mouth and
    // the next one in its middle
    var q = flr(aim * 32.0 + 0.5) & 31;
    spr(64 + (q / 8) * 32 + (q % 8) * 2, CX - 8, CY - 8, 2, 2);
    spr(cur, CX + ca * MUZZLE - 3, CY + sa * MUZZLE - 3);
    circfill(CX, CY, 2, INK[nxt]);

    for (var i = 0; i < MAXS; i++)
        if (on[i] != 0)
            spr(c[i], x[i] - 3, y[i] - 3);
}

// Takes every shot in flight out of the game
function clear() {
    fill(on, 0);
}
