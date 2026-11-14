// blocks: what flies in at the crane, landing on the beat.
//
// Each block is planned for one beat: it comes in from off the screen
// along its angle and crosses the ball's ring exactly on that beat, then
// keeps coming, to the hub AFTER ms later. The ball can only meet it near
// the ring, so the player has to be there on the beat. Its place on its
// path is worked out from the clock every tick, never stepped, so it lands
// on the beat at any rate.
//
// A bar's first beat brings a heavy block, the others small pieces; how
// many of the four come depends on the round and on the music's energy.
// The first four bars of a game bring only the heavy ones.
// Now and then a gold block. Each block lands an eighth of a turn round
// from the last for every beat between them, the same way round, and the
// way turns back every two bars: a sweep the ball can follow, swinging.
// Busy music (high flux) makes the steps half again as long.
//
// Hit, a block takes the ball's force (1 to 3) as damage, three times that
// on a heavy block hit on its downbeat (within WINDOW ms). What survives is
// knocked back out and the ball bounces off it. Slots are fixed arrays;
// nothing is made in play.

const MAX = 12;
const PIECE = 0, HEAVY = 1, GOLDEN = 2;
const R_OUT = 110.0;               // where a block starts: off the screen
const TRAVEL = 2000;               // ms from there to the ring
const AFTER = 700;                 // ms from the ring to the hub
const HUB = 6.0;                   // reaching this radius, a block costs a heart
const PASSED = 9.0;                // this far inside the ring, a block is missed
const KNOCK = 260;                 // ms a surviving block is knocked back
const GLOW = 120;                  // ms before landing a block lights up
const GOLD_EVERY = 8;              // bars between gold blocks
var HALF = [2.5, 4.0, 3.0];        // half a block's size, pixels
var SPRITE = [1, 2, 5];            // its sprite on the sheet (heavy: +1, +2 cracked)
var GLOWS = [9, 10, 5];            // ...lit up before it lands
var COLOURS = [12, 8, 10];         // ...its splinters

var WINDOWS = [80, 120, 180];      // the Downbeat window option, ms either side
var win = 120;

var on = new Uint8Array(MAX);
var bt = new Int32Array(MAX);      // when it crosses the ring, on the game's clock
var ba = new FixArray(MAX);        // its angle, turns
var bk = new Uint8Array(MAX);      // its kind
var bh = new Uint8Array(MAX);      // its strength left
var bd = new Uint8Array(MAX);      // on a bar's first beat
var bc = new Uint8Array(MAX);      // cracks: hits taken
var bp = new Uint8Array(MAX);      // missed already
var br = new FixArray(MAX);        // its radius now
var bx = new FixArray(MAX), by = new FixArray(MAX);
var count = 0;

var plannedTo = 0;                 // the last beat planned for, on the game's clock
var bars = 0;                      // bars planned this round
var lastAngle = 0.25;              // where the last block landed, turns
var lastAt = 0;                    // ...and when
var dir = 1.0;                     // which way round they go
var perBar = 2;                    // blocks this bar
var spark;                         // the splinters' pool

// Once, from main.js
function setup() {
    spark = particles.pool(64);
    spark.gravity = 0.06;
    spark.drag = 0.04;
}

// Nothing in the air, the next block planned a full flight from now
function clear(now) {
    fill(on, 0);
    count = 0;
    plannedTo = now + TRAVEL - 200;
}

// A new round: the pattern from the top, where the ball hangs
function newRound(now) {
    clear(now);
    bars = 0;
    lastAngle = ball.ang;
    lastAt = -1;
    dir = 1.0;
}

// The clock jumped by d ms (the music's clock taking over from the game's
// or back): everything in the air keeps its place
function shift(d) {
    for (var i = 0; i < MAX; i++)
        if (on[i] != 0)
            bt[i] += d;
    plannedTo += d;
}

// The coming beats a full flight ahead get their blocks, if any
function plan(now, round) {
    for (var n = 0; n < 6; n++) {
        var tb = rhythm.next(now, n);
        if (tb < 0 || tb - now > TRAVEL)
            return;
        if (tb <= plannedTo + rhythm.period / 2)
            continue;
        plannedTo = tb;
        beatCame(tb, rhythm.place, round, now);
    }
}

// A beat to plan for: maybe a block, its kind and its angle
function beatCame(tb, place, round, now) {
    if (place == 0) {
        bars++;
        // how busy this bar is: the round, and the music's energy
        var e = rhythm.energy;
        perBar = e < 30 ? 1 : e < 70 ? 2 : 3;
        if (round >= 3)
            perBar++;
        perBar = mid(1, perBar, min(4, round + 1));
        if (round == 1 && bars <= 4)
            perBar = 1;            // the first bars: one heavy block each, to learn on
        if (bars % 2 == 1 && bars > 1)
            dir = 0.0 - dir;
    }
    var want = place == 0 || (perBar >= 2 && place == 2) || (perBar >= 3 && place == 1) ||
               (perBar >= 4 && place == 3);
    if (!want)
        return;
    var i = 0;
    while (i < MAX && on[i] != 0)
        i++;
    if (i == MAX)
        return;
    var kind = place == 0 ? HEAVY : PIECE;
    if (place == 2 && bars % GOLD_EVERY == 0)
        kind = GOLDEN;
    // an eighth of a turn on for each beat since the last block, at most
    // three eighths; half as much again for busy music
    var beats = lastAt < 0 ? 2 : mid(1, (tb - lastAt + rhythm.period / 2) / rhythm.period, 3);
    var a = lastAngle + beats * (rhythm.flux > 60 ? 0.1875 : 0.125) * dir;
    lastAngle = a - flr(a);
    lastAt = tb;
    on[i] = 1;
    bt[i] = tb;
    ba[i] = a - flr(a);
    bk[i] = kind;
    bh[i] = kind == HEAVY ? (round >= 4 ? 3 : 2) : 1;
    bd[i] = place == 0 ? 1 : 0;
    bc[i] = 0;
    bp[i] = 0;
    count++;
    place1(i, now);
}

// Block i's place at time now
function place1(i, now) {
    var left = bt[i] - now;
    var r = 0.0;
    // ms are whole numbers that would wrap as fractions times pixels: the
    // share of the way first
    if (left >= 0)
        r = ball.L + (min(left, TRAVEL + KNOCK * 2) / (TRAVEL * 1.0)) * (R_OUT - ball.L);
    else
        r = ball.L + (max(left, 0 - AFTER) / (AFTER * 1.0)) * ball.L;
    br[i] = r;
    bx[i] = ball.CX + cos(ba[i]) * r;
    by[i] = ball.CY + sin(ba[i]) * r;
}

// A tick: every block moved, met by the ball, missed or at the hub
function update(now) {
    var px = ball.x, py = ball.y;
    for (var i = 0; i < MAX; i++) {
        if (on[i] == 0)
            continue;
        place1(i, now);
        var r = br[i];
        if (r <= HUB) {
            on[i] = 0;
            count--;
            reached(bk[i], bx[i], by[i]);   // main.js: a heart or half, unless shielded
            continue;
        }
        if (r < ball.L - PASSED) {
            if (bp[i] == 0) {
                bp[i] = 1;
                missed();          // main.js: the combo goes
            }
            continue;
        }
        if (r > ball.L + 12.0)
            continue;
        var h = HALF[bk[i]] + ball.R;
        var dx = bx[i] - px, dy = by[i] - py;
        if (dx > h || dx < 0.0 - h || dy > h || dy < 0.0 - h)
            continue;
        meet(i, now);
    }
    particles.step(spark);
}

// The ball meets block i
function meet(i, now) {
    var dmg = ball.force();
    var triple = bd[i] != 0 && abs(now - bt[i]) <= win;
    if (triple)
        dmg *= 3;
    if (dmg >= bh[i]) {
        on[i] = 0;
        count--;
        var k = bk[i];
        particles.emit(spark, k == HEAVY ? 14 : 8, bx[i], by[i], 0.0, -0.4, 1.4, 22, COLOURS[k]);
        if (k == HEAVY)
            particles.emit(spark, 6, bx[i], by[i], 0.0, -0.4, 1.0, 16, 7);
        ball.vel *= 0.85;
        smashed(k, dmg, triple, bx[i], by[i]);   // main.js: points and the rest
        return;
    }
    // it holds: cracked, knocked back, and the ball bounces off
    bh[i] -= dmg;
    bc[i]++;
    bt[i] += KNOCK;
    ball.vel = 0.0 - ball.vel * 0.5;
    particles.emit(spark, 4, bx[i], by[i], 0.0, -0.3, 0.8, 12, 7);
    dented(bx[i], by[i]);          // main.js: a thud
}

// The blocks, lit up just before they land, then the splinters. Within a
// beat or two of landing, a mark on the ring shows where.
function draw(now) {
    for (var i = 0; i < MAX; i++) {
        if (on[i] == 0)
            continue;
        var k = bk[i];
        var left = bt[i] - now;
        if (left > 0 && left < rhythm.period * 2) {
            var c = cos(ba[i]), s = sin(ba[i]);
            line(ball.CX + c * (ball.L - 3.0), ball.CY + s * (ball.L - 3.0),
                 ball.CX + c * (ball.L + 3.0), ball.CY + s * (ball.L + 3.0), k == HEAVY ? 14 : k == GOLDEN ? 10 : 12);
        }
        var sp = left >= 0 && left <= GLOW ? GLOWS[k] : SPRITE[k] + (k == HEAVY ? min(2, bc[i]) : 0);
        var hs = flr(HALF[k] + 0.5);
        spr(sp, flr(bx[i]) - hs, flr(by[i]) - hs);
    }
    particles.draw(spark);
}
