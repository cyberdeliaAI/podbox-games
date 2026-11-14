// Marble Chain: a chain of coloured balls rolls along a track toward the
// hole. Shoot balls into it from the gun in the middle; three or more of a
// colour together pop, and the gap they leave pulls shut where its two
// sides match -- which can pop again, a chain reaction.
//
// This file is the game around the chain: the start screen, six levels,
// scoring, power-ups and the end screens. The chain itself is chain.js, the
// gun gun.js, the menus title.js and what is saved levels.js.

const TITLE = 0, PLAY = 1, WON = 2, LOST = 3;

const RUSH = 3.0;                  // the chain's speed as it rolls in
const RUSH_UNTIL = 0.3;            // ...while its front is short of this much of the track
const RELIEF_TICKS = 45;           // after a pop the chain eases for this long
const RELIEF_DRIVE = 0.6;          // ...to this much of its speed
const SLOW_TICKS = 230;            // a slow power-up lasts about seven seconds
const SLOW_DRIVE = 0.3;
const BACK_TICKS = 40;             // a back power-up rolls the chain back this long
const BACK_SPEED = 2.4;            // ...at this many pixels a tick
const CLEAR_BONUS = 500;
const INTRO_TICKS = 75;
const MAXPOINTS = 30000;           // the most a level's score can hold

// the end screens' choices
const NEXT = 0, RETRY = 1, BACK = 2;
var LABELS = ["NEXT LEVEL", "TRY AGAIN", "MAIN MENU"];

var scene = TITLE;
var lvl = 0;                       // the level being played
var points = 0;
var streak = 0;                    // shots in a row that popped something
var drive = 1.0;                   // the chain's speed now, as a share of the level's
var slow = 0, back = 0, relief = 0;
var intro = 0;
var endTicks = 0;
var endSel = 0;
var newBest = false;
var ends = new Int32Array(3);
var endN = 0;
var fxp;
var late = 0;                      // frames that ran late this second
var settle = 0;                    // ticks left after a screen change, whose late frames do not count

var msg = "", msgUntil = 0;
var fl = "", flX = 0, flY = 0, flFrom = 0;     // the score that floats up from a pop

function init() {
    levels.load();
    title.init();
    fxp = particles.pool(160);
    fxp.drag = 0.08;
    fxp.cull = true;
    menuitem(1, "Restart level", restart);
    menuitem(2, "Main menu", toTitle);
    toTitle();
}

function toTitle() {
    settle = 4;
    scene = TITLE;
    title.enter();
}

function restart() {
    if (scene != TITLE)
        startLevel(lvl);
}

function startLevel(i) {
    settle = 4;
    lvl = i;
    var t = levels.ROUTE[i];
    chain.setup(levels.TX[t], levels.TY[t], levels.NEAR[t]);
    chain.start(levels.BALLS[i], levels.COLOURS[i], levels.POWER[i]);
    gun.reset();
    points = 0;
    streak = 0;
    drive = 1.0;
    slow = 0;
    back = 0;
    relief = 0;
    endTicks = 0;
    msgUntil = 0;
    fl = "";
    intro = INTRO_TICKS;
    scene = PLAY;
    sfx(SFX.start);
}

// ---- a tick --------------------------------------------------------------------

function update() {
    pace();
    if (scene == TITLE) {
        var go = title.update();
        if (go >= 0)
            startLevel(go);
        return;
    }
    var k = 33.0 / rate();
    if (intro > 0)
        intro--;
    if (scene == PLAY)
        play(k);
    else
        finish();
    particles.step(fxp);
}

function play(k) {
    // how fast the chain rolls: it eases after a pop, crawls under a slow
    // power-up and rushes in whenever its front is short
    var want = 1.0;
    if (slow > 0) {
        want = SLOW_DRIVE;
        slow--;
    } else if (relief > 0) {
        want = RELIEF_DRIVE;
    }
    if (relief > 0)
        relief--;
    drive += (want - drive) * 0.12;

    var sp = levels.SPEED[lvl] * drive;
    if (chain.left > 0 && chain.front() < chain.L * RUSH_UNTIL)
        sp = RUSH;
    if (back > 0) {
        chain.rewind(BACK_SPEED * k);
        back--;
        sp = 0.0;
    }
    chain.step(sp * k);
    gun.update(opt.get(OPT.steering) == 1);

    // the hole is near: beep, faster the closer it gets
    var d = chain.danger();
    if (d > 0.3 && frame() % (26 - flr(d * 14.0)) == 0)
        sfx(SFX.warn);

    if (chain.front() >= chain.L - 1) {
        scene = LOST;
        endTicks = 0;
        chain.left = 0;
        gun.clear();
        sfx(SFX.lose);
        score.submit(BOARD.points, points);
        ends[0] = RETRY;
        ends[1] = BACK;
        endN = 2;
        endSel = 0;
    } else if (chain.empty()) {
        scene = WON;
        endTicks = 0;
        gun.clear();
        points = min(points + CLEAR_BONUS, MAXPOINTS);
        newBest = points > levels.best[lvl];
        levels.cleared(lvl, points);
        score.submit(BOARD.points, points);
        sfx(SFX.win);
        if (lvl == 0)
            ach.earn(ACH.first);
        if (levels.allDone())
            ach.earn(ACH.master);
        endN = 0;
        if (lvl + 1 < levels.COUNT)
            ends[endN++] = NEXT;
        ends[endN++] = RETRY;
        ends[endN++] = BACK;
        endSel = 0;
    }
}

// Won or lost: wait a moment, then take the player's choice
function finish() {
    endTicks++;
    if (scene == LOST)
        chain.slide(4.0);
    if (endTicks <= 40)
        return;
    var st = wheelsteps();
    if (btnp(0))
        st--;
    if (btnp(1))
        st++;
    if (st != 0) {
        endSel = title.wrap(endSel + st, endN);
        click();
    }
    if (btnp(4)) {
        var c = ends[endSel];
        if (c == NEXT)
            startLevel(lvl + 1);
        else if (c == RETRY)
            startLevel(lvl);
        else
            toTitle();
    }
}

// A cart that cannot keep up drops to 25 ticks a second
function pace() {
    if (settle > 0) {
        settle--;
        skipped();
        late = 0;
        return;
    }
    late += skipped();
    if (frame() % 33 == 0) {
        if (late > 4 && rate() > 25)
            setrate(25);
        late = 0;
    }
}

// ---- the chain's news ----------------------------------------------------------

// The chain popped m balls of colour c at x, y; combo is 1 for a shot's
// own match, 2 and up for each chain reaction after it
function popped(m, combo, x, y, c) {
    var pts = m * 10 * combo;
    if (m > 3)
        pts += (m - 3) * 20;
    if (combo == 1) {
        streak++;
        pts += min(streak - 1, 10) * 10;
    }
    points = min(points + pts, MAXPOINTS);
    relief = RELIEF_TICKS;
    particles.emit(fxp, 4 + m * 3, x, y, 0.0, 0.0, 1.4, 14, gun.INK[c]);
    fl = "+" + pts;
    flX = x;
    flY = y;
    flFrom = frame();
    if (combo > 1) {
        announce("CHAIN x" + combo);
        sfxp(SFX.pop, min(12, combo * 2));
        if (combo >= 3)
            ach.earn(ACH.domino);
    } else {
        if (streak >= 3)
            announce("STREAK x" + streak);
        sfx(SFX.pop);
    }
}

// A settled shot popped nothing
function missed() {
    streak = 0;
}

// A run with a power-up in it popped: 1 slow, 2 back, 3 bomb
function gotPower(p, x, y) {
    if (p == 1) {
        slow = SLOW_TICKS;
        announce("SLOW");
        sfx(SFX.slow);
    } else if (p == 2) {
        back = BACK_TICKS;
        announce("ROLL BACK");
        sfx(SFX.power);
    } else {
        announce("BOMB!");
        sfx(SFX.blast);
        particles.emit(fxp, 30, x, y, 0.0, 0.0, 2.8, 18, 9);
        ach.earn(ACH.bomb);
    }
}

function announce(s) {
    msg = s;
    msgUntil = frame() + 45;
}

// ---- drawing -------------------------------------------------------------------

function draw() {
    if (scene == TITLE) {
        title.draw();
        return;
    }
    palt(0, false);
    var t = levels.ROUTE[lvl];
    blit(t == 0 ? IMG.bg1 : (t == 1 ? IMG.bg2 : IMG.bg3), 0, 0);
    palt(0, true);

    // the hole warns when the chain gets near it
    var d = chain.danger();
    if (d > 0.0) {
        circ(chain.PX[chain.L - 1], chain.PY[chain.L - 1], (frame() & 4) != 0 ? 10 : 9, 8);
        if (d > 0.6 && (frame() & 8) != 0)
            rect(0, 0, 159, 119, 8);
    }

    chain.draw();
    gun.draw();
    particles.draw(fxp);
    hud();

    if (scene == PLAY) {
        if (intro > 0)
            introBanner();
    } else {
        endPanel();
    }
}

function hud() {
    print("" + points, 2, 2, 7);
    var b = "" + (chain.n + chain.left);
    print(b, 158 - textw(b), 2, 6);

    // the power-ups at work
    if (slow > 0) {
        spr(25, 1, 9);
        rectfill(10, 11, 10 + slow * 30 / SLOW_TICKS, 12, 10);
    }
    if (back > 0) {
        spr(26, 1, 17);
        rectfill(10, 19, 10 + back * 30 / BACK_TICKS, 20, 12);
    }
    if (streak >= 2)
        print("x" + streak, 2, 111, 10);

    if (frame() < msgUntil)
        centre(msg, 26, 10);
    var age = frame() - flFrom;
    if (age < 28 && fl != "")
        centreAt(fl, flX, flY - age / 3 - 8, 7);
}

function introBanner() {
    rectfill(0, 46, 159, 74, 0);
    font(FONT.CAPS, 2);
    centre("LEVEL " + (lvl + 1), 49, 10);
    font(FONT.CAPS);
    centre(levels.LABEL[lvl], 65, 7);
}

function endPanel() {
    var won = scene == WON;
    var y0 = won ? 66 : 58;
    var bottom = y0 + endN * 10 + 5;
    rectfill(18, 22, 141, bottom, 0);
    rect(18, 22, 141, bottom, 13);
    if (won)
        centre("LEVEL CLEARED", 27, 11);
    else
        centre("THE CHAIN GOT THROUGH", 27, 8);
    centre("SCORE " + points, 38, 7);
    if (won) {
        centre("INCLUDING " + CLEAR_BONUS + " BONUS", 46, 13);
        if (newBest) {
            if ((frame() & 16) != 0)
                centre("NEW BEST!", 54, 10);
        } else {
            centre("BEST " + levels.best[lvl], 54, 13);
        }
    } else if (levels.best[lvl] > 0) {
        centre("BEST " + levels.best[lvl], 46, 13);
    }
    if (endTicks <= 40)
        return;
    for (var i = 0; i < endN; i++) {
        var y = y0 + i * 10;
        if (i == endSel) {
            rectfill(22, y - 2, 137, y + 7, 1);
            centre(LABELS[ends[i]], y, 10);
            print(">", 26, y, 10);
            print("<", 131, y, 10);
        } else {
            centre(LABELS[ends[i]], y, 6);
        }
    }
}

// Text centred on the screen, or on x
function centre(s, y, c) {
    print(s, 80 - textw(s) / 2, y, c);
}

function centreAt(s, x, y, c) {
    print(s, x - textw(s) / 2, y, c);
}
