// Bubble Beat: a bubble shooter that plays to your music.
//
// Bubbles hang from a ceiling in a hex grid. Aim the launcher with the
// wheel and shoot: three or more of a colour together pop, and whatever
// they held up falls for more. The ceiling comes down a row every few bars
// of the music that is playing, or every few shots without it. A level is
// won when the field is clear and lost when a bubble hangs below the line.
// A shot fired on the beat scores double, on a bar's first beat triple.
//
// This file is the game around the board: the scenes, the ceiling,
// scoring, the effects and the screen. The grid is board.js, the launcher
// launcher.js, the beat rhythm.js, the layouts levels.js and the start
// screen title.js.
//
// The field is drawn into a picture only when it changes (a bubble lands,
// pops or falls, the ceiling drops, the score moves) and copied to the
// screen each tick; what moves is drawn on top of it. A bubble that lands
// without popping anything is drawn into the picture on its own. Anything
// more (a pop, a fall, the ceiling) has the whole picture drawn again on
// the tick after, and the guide made again on the tick after that, so the
// work of a big pop is spread over three ticks.

const TITLE = 0, PLAY = 1, CLEAR = 2, OVER = 3;
const INTRO = 60;                  // ticks the level's banner shows
const END_WAIT = 40;               // ticks before an end panel takes Select
const WARN = 0.75;                 // the ceiling's meter shakes it from here
const LINE_Y = 103;                // where the line is drawn
const FALL_MAX = 64, POP_MAX = 48;

var scene = TITLE;
var level = 1, reached = 1;        // the level played, and the furthest opened
var points = 0, levelPoints = 0, best = 0;
var press = 0.0;                   // the ceiling's meter: it comes down at 1
var intro = 0, endTicks = 0, endSel = 0, rank = 0, bonus = 0;
var spin = true, marks = false;    // the options
var beatRun = 0;                   // popping shots in a row on the beat
var cache;                         // the field as last drawn
var dirty = true;
var dirtyAt = -1;                  // the tick it changed on; drawn from the tick after
var sparks = 2;                    // sparks each popping bubble throws
var shake = 0, flash = 0, ring = 0;
var lights = new Int32Array(9);    // the bubbles' light shades, to flash and put back
var fxp;                           // sparks
var late = 0, settle = 0;
var msg = "", msgUntil = 0;
var fl = "", flX = 0, flY = 0, flFrom = -99;

// bubbles falling off the board
var fN = 0;
var fx = new FixArray(FALL_MAX), fy = new FixArray(FALL_MAX);
var fvx = new FixArray(FALL_MAX), fvy = new FixArray(FALL_MAX);
var fc = new Uint8Array(FALL_MAX);
// pops
var pN = 0;
var popX = new Int32Array(POP_MAX), popY = new Int32Array(POP_MAX), popT = new Uint8Array(POP_MAX);
var popSp = new Uint8Array(POP_MAX);
// for drawing the falling bubbles
var dxs = new Int32Array(FALL_MAX), dys = new Int32Array(FALL_MAX), dsp = new Uint8Array(FALL_MAX);

function init() {
    cache = img(160, 120);
    fxp = particles.pool(160);
    fxp.gravity = 0.06;
    fxp.drag = 0.04;
    fxp.cull = true;
    for (var h = 1; h <= 8; h++)
        lights[h] = getpal(18 + (h - 1) * 3);
    reached = max(1, flr(dget(0)));
    best = score.best(BOARD.points) || 0;
    menuitem(1, "Restart level", restart);
    menuitem(2, "Main menu", toTitle);
    toTitle();
}

function readOptions() {
    spin = opt.get(OPT.aiming) == 0;
    marks = opt.get(OPT.marks) == 1;
    rhythm.on = opt.get(OPT.beat) == 1;
    dirty = true;
}

function toTitle() {
    settle = 4;
    scene = TITLE;
    unflash();
    title.enter();
}

function restart() {
    if (scene == TITLE)
        return;
    points = levelPoints;
    startLevel(level);
}

function startLevel(n) {
    settle = 4;
    level = n;
    levelPoints = points;
    levels.build(n);
    launcher.reset();
    press = 0.0;
    fN = 0;
    pN = 0;
    beatRun = 0;
    intro = INTRO;
    endTicks = 0;
    msgUntil = 0;
    scene = PLAY;
    dirty = true;
    unflash();
    if (n > reached) {
        reached = n;
        dset(0, reached);
    }
    sfx(SFX.start);
}

// ---- a tick --------------------------------------------------------------------

function update() {
    pace();
    if (opt.changed())
        readOptions();
    rhythm.update();
    news();
    if (rhythm.hit) {
        ring = 3;
        if (rhythm.down && scene == PLAY)
            flashOn();
    }
    if (ring > 0)
        ring--;
    if (flash > 0 && --flash == 0)
        unflash();
    if (shake > 0)
        shake--;

    if (scene == TITLE) {
        var go = title.update();
        if (go > 0) {
            points = 0;
            startLevel(go);
        }
        return;
    }
    var k = 33.0 / rate();
    if (scene == PLAY)
        play(k);
    else
        finish();
    stepFx(k);
}

function play(k) {
    if (intro > 0)
        intro--;
    launcher.update(spin, k);
    if (btnp(3))
        launcher.swap();
    if (btnp(4) && intro < INTRO - 15)
        launcher.fire(beat.press(4));
    launcher.fly(k);
    if (scene != PLAY)
        return;                    // the shot ended the level

    // with a beat, the ceiling comes down with the bars, sooner when the
    // music is loud and later when it is quiet
    if (rhythm.locked && rhythm.hit) {
        var e = rhythm.energy;
        push((e > 70 ? 3.0 : e < 30 ? 1.0 : 2.0) / (levels.bars(level) * 8));
    }
}

// The ceiling's meter rises by p; at 1 it comes down a row
function push(p) {
    press += p;
    if (press >= WARN && press < 1.0) {
        shake = 4;
        sfx(SFX.warn);
    }
    if (press >= 1.0)
        lower();
}

// The field changed during play: drawn again from the next tick
function changed() {
    dirty = true;
    dirtyAt = frame();
}

function lower() {
    press = 0.0;
    board.drop = board.drop + 1;
    shake = 8;
    changed();
    sfx(SFX.drop);
    if (board.lowest() > board.LINE)
        lost();
}

// The bubble in flight came to rest at x, y; mult is its beat multiplier
function landed(x, y, c, mult) {
    var at = board.snap(x, y, 1);
    if (at < 0)
        at = board.snap(x, y, 2);
    if (at < 0)
        return;                    // nowhere for it to go: it is lost
    var r = at >> 4, cc = at & 15;
    board.put(r, cc, c);
    var n = board.group(r, cc);
    if (n >= 3) {
        changed();
        sparks = n > 12 ? 1 : 2;
        var popped = board.popGroup();
        var fell = board.loose(false);
        var gain = (popped * 10 + fell * (fell >= 6 ? 40 : 20)) * mult;
        points += gain;
        floatText("+" + gain, board.cx(r, cc), board.cy(r));
        sfx(SFX.pop);
        if (fell > 0)
            sfx(SFX.fall);
        if (mult > 1) {
            beatRun++;
            announce(mult == 3 ? "DOWNBEAT x3" : "ON THE BEAT x2");
            sfx(SFX.beat);
            if (mult == 3)
                ach.earn(ACH.downbeat);
            if (beatRun >= 5)
                ach.earn(ACH.groove);
        } else {
            beatRun = 0;
        }
        if (fell >= 12)
            ach.earn(ACH.avalanche);
        if (board.total == 0) {
            cleared();
            return;
        }
    } else {
        // nothing popped: the one new bubble goes into the picture as it is
        beatRun = 0;
        sfx(SFX.stick);
        target(cache);
        spr((marks ? 9 : 1) + c - 1, board.cx(r, cc) - 4, board.cy(r) - 4);
        target(SCREEN);
        launcher.guideAim = -2.0;
    }
    // without a beat, the ceiling counts shots
    if (!rhythm.locked) {
        push(1.0 / levels.shots(level));
        if (scene != PLAY)
            return;
    }
    launcher.refresh();
    if (board.lowest() > board.LINE)
        lost();
}

function cleared() {
    scene = CLEAR;
    endTicks = 0;
    bonus = 1000 + 250 * max(0, 6 - board.drop);
    points += bonus;
    dirty = true;
    unflash();
    sfx(SFX.clear);
    if (level == 1)
        ach.earn(ACH.first);
    if (level + 1 >= 10)
        ach.earn(ACH.ten);
    if (level + 1 > reached) {
        reached = level + 1;
        dset(0, reached);
    }
}

function lost() {
    scene = OVER;
    endTicks = 0;
    endSel = 0;
    launcher.flying = false;
    dirty = true;
    unflash();
    sfx(SFX.lose);
    rank = points > 0 ? score.submit(BOARD.points, points) : 0;
    best = score.best(BOARD.points) || 0;
}

// Won or lost: wait a moment, then take the player's choice
function finish() {
    endTicks++;
    if (endTicks <= END_WAIT)
        return;
    if (scene == CLEAR) {
        if (btnp(4))
            startLevel(level + 1);
        return;
    }
    var steps = wheelsteps();
    if (btnp(0))
        steps--;
    if (btnp(1))
        steps++;
    if (steps != 0) {
        endSel = ((endSel + steps) % 2 + 2) % 2;
        click();
    }
    if (btnp(4)) {
        if (endSel == 0) {
            points = 0;
            startLevel(level);
        } else {
            toTitle();
        }
    }
}

// What the beat has to say
function news() {
    var n = rhythm.news;
    if (n == 0)
        return;
    rhythm.news = 0;
    changed();                     // the panel shows the tempo
    if (scene == TITLE)
        return;
    if (n == 1)
        announce(rhythm.bpm + " BPM");
    else if (n == 2)
        announce("NO BEAT YET");
    else
        announce("NO BEAT FOUND");
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

// ---- effects -------------------------------------------------------------------

// A popped bubble: a ring of sparks where it was
function burst(x, y, v) {
    if (pN < POP_MAX) {
        popX[pN] = x - 4;
        popY[pN] = y - 4;
        popT[pN] = 0;
        pN++;
    }
    particles.emit(fxp, sparks, x, y, 0.0, 0.0, 1.3, 14, 17 + (v - 1) * 3);
}

// A bubble that lost its hold drops off the board
function fallOff(x, y, v) {
    if (fN >= FALL_MAX)
        return;
    fx[fN] = x - 4;
    fy[fN] = y - 4;
    fvx[fN] = rnd(1.4) - 0.7;
    fvy[fN] = -0.6 - rnd(0.8);
    fc[fN] = v;
    fN++;
}

// Pops age and falling bubbles fall; each finished one is replaced by the last
function stepFx(k) {
    particles.step(fxp);
    for (var i = pN - 1; i >= 0; i--) {
        popT[i]++;
        if (popT[i] > 6) {
            pN--;
            popX[i] = popX[pN];
            popY[i] = popY[pN];
            popT[i] = popT[pN];
        }
    }
    for (var i = fN - 1; i >= 0; i--) {
        fvy[i] += 0.22 * k;
        fx[i] += fvx[i] * k;
        fy[i] += fvy[i] * k;
        if (fy[i] > 124.0) {
            fN--;
            fx[i] = fx[fN];
            fy[i] = fy[fN];
            fvx[i] = fvx[fN];
            fvy[i] = fvy[fN];
            fc[i] = fc[fN];
        }
    }
}

// On a bar's first beat the bubbles' highlights flash white
function flashOn() {
    for (var h = 1; h <= 8; h++)
        setpal(18 + (h - 1) * 3, 0xffffff);
    flash = 3;
}

function unflash() {
    if (flash == 0 && getpal(18) == lights[1])
        return;
    for (var h = 1; h <= 8; h++)
        setpal(18 + (h - 1) * 3, lights[h]);
    flash = 0;
}

function announce(s) {
    msg = s;
    msgUntil = frame() + 50;
}

function floatText(s, x, y) {
    fl = s;
    flX = mid(board.FX + 12, x, board.FX + 84);
    flY = y;
    flFrom = frame();
}

// ---- drawing -------------------------------------------------------------------

function draw() {
    if (scene == TITLE) {
        title.draw();
        return;
    }
    if (dirty && (scene != PLAY || frame() > dirtyAt))
        repaint();
    palt(0, false);
    blit(cache, 0, 0);
    palt(0, true);
    var base = marks ? 9 : 1;

    ceiling(shake > 0 ? (frame() & 2) - 1 : 0);
    var c = 2;
    if (board.lowest() > board.LINE - 15)
        c = (frame() & 4) != 0 ? 8 : 2;
    line(board.FX, LINE_Y, board.FX + 95, LINE_Y, c);

    launcher.draw(scene == PLAY, ring > 0, base);
    drawFx(base);
    hud();

    if (frame() < msgUntil)
        shadow(msg, 80, 91, 10);
    var age = frame() - flFrom;
    if (age < 30)
        shadow(fl, flX, flY - age / 3 - 6, 7);

    if (scene == PLAY) {
        if (intro > 0)
            banner();
    } else {
        endPanel();
    }
}

// The field, into the cache: the background, the bubbles and the panels'
// words and numbers. The bubbles turn grey when the game is lost.
function repaint() {
    dirty = false;
    launcher.guideAim = -2.0;      // made again next tick
    target(cache);
    palt(0, false);
    blit(IMG.back, 0, 0);
    palt(0, true);
    if (scene == OVER)
        for (var h = 1; h <= 8; h++) {
            pal(16 + (h - 1) * 3, 5);
            pal(17 + (h - 1) * 3, 13);
            pal(18 + (h - 1) * 3, 6);
        }
    board.draw(marks ? 9 : 1);
    if (scene == OVER)
        for (var e = 16; e < 40; e++)
            pal(e);
    centreAt("SCORE", 15, 5, 13);
    centreAt("" + points, 15, 12, 7);
    centreAt("LEVEL", 15, 27, 13);
    centreAt("" + level, 15, 34, 7);
    centreAt("BEST", 15, 49, 13);
    centreAt("" + max(best, points), 15, 56, 6);
    centreAt("BEAT", 145, 5, 13);
    centreAt(rhythm.locked ? "" + rhythm.bpm : rhythm.listening ? "..." : "-", 145, 21, 6);
    centreAt("DROP", 145, 34, 13);
    target(SCREEN);
}

// The ceiling, drawn live so it can shake: x0 is the shake
function ceiling(x0) {
    var t = board.top();
    rectfill(board.FX, 0, board.FX + 95, t - 1, 44);
    line(board.FX, t - 1, board.FX + 95, t - 1, 45);
    for (var x = board.FX + 6 + x0; x < board.FX + 95; x += 12)
        pset(x, t - 3, 45);
}

// The beat's four dots and the ceiling's meter, on the right
function hud() {
    var last = (rhythm.place + 3) & 3;
    for (var i = 0; i < 4; i++) {
        var c = 5;
        if (rhythm.locked)
            c = i == last && ring > 0 ? 7 : i == 0 ? 13 : 5;
        else if (rhythm.listening && (frame() & 8) != 0)
            c = 13;
        circfill(136 + i * 6, 14, i == 0 ? 2 : 1, c);
    }
    rect(140, 42, 150, 96, 43);
    var h = flr(press * 52.0);
    if (h > 0)
        rectfill(141, 96 - h, 149, 95, press >= WARN ? 8 : 9);
}

function drawFx(base) {
    for (var i = 0; i < fN; i++) {
        dxs[i] = fx[i];
        dys[i] = fy[i];
        dsp[i] = base + fc[i] - 1;
    }
    if (fN > 0)
        sprites.draw(dsp, dxs, dys, fN);
    if (pN > 0) {
        for (var i = 0; i < pN; i++)
            popSp[i] = popT[i] < 3 ? 17 : 18;
        sprites.draw(popSp, popX, popY, pN);
    }
    particles.draw(fxp);
}

function banner() {
    rectfill(board.FX + 4, 44, board.FX + 91, 70, 1);
    rect(board.FX + 4, 44, board.FX + 91, 70, 43);
    font(FONT.CAPS, 2);
    shadow("LEVEL " + level, 80, 48, 10);
    font(FONT.CAPS);
    centre(rhythm.locked ? "SHOOT ON THE BEAT" : "CLEAR THE FIELD", 62, 7);
}

function endPanel() {
    var won = scene == CLEAR;
    rectfill(board.FX + 4, 30, board.FX + 91, 88, 1);
    rect(board.FX + 4, 30, board.FX + 91, 88, 43);
    font(FONT.CAPS, 2);
    if (won)
        shadow("CLEAR!", 80, 34, 11);
    else
        shadow("GAME OVER", 80, 34, 8);
    font(FONT.CAPS);
    if (won) {
        centre("BONUS +" + bonus, 50, 7);
        centre("SCORE " + points, 58, 7);
        if (endTicks > END_WAIT && (frame() & 16) != 0)
            centre("SELECT: LEVEL " + (level + 1), 74, 10);
        return;
    }
    centre("SCORE " + points, 50, 7);
    if (rank == 1)
        centre("NEW BEST!", 58, (frame() & 8) != 0 ? 10 : 7);
    else
        centre("BEST " + best, 58, 13);
    if (endTicks <= END_WAIT)
        return;
    for (var i = 0; i < 2; i++) {
        var y = 68 + i * 9;
        var s = i == 0 ? "TRY AGAIN" : "MAIN MENU";
        if (i == endSel) {
            rectfill(board.FX + 8, y - 2, board.FX + 87, y + 6, 2);
            centre(s, y, 10);
        } else {
            centre(s, y, 6);
        }
    }
}

// ---- text ----------------------------------------------------------------------

// Text centred on the screen
function centre(s, y, c) {
    print(s, 80 - textw(s) / 2, y, c);
}

// Text centred on x
function centreAt(s, x, y, c) {
    print(s, x - textw(s) / 2, y, c);
}

// Text centred on x, with a dark shadow to read over the bubbles
function shadow(s, x, y, c) {
    var w = textw(s);
    print(s, x - w / 2 + 1, y + 1, 0);
    print(s, x - w / 2, y, c);
}
