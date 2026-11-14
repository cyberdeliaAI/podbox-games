// Sloop: a wrecking ball on the beat.
//
// A ball swings on its chain round a crane in the middle of the screen,
// and blocks fly in from all sides to cross its ring on the beats of the
// music playing. Swing the ball there on the beat: the faster it goes the
// harder it hits, and a heavy block hit on the bar's first beat takes three
// times the damage. A block that gets through to the crane costs half of
// one of three hearts, a heavy or gold one a whole heart.
//
// A round lasts a track. When the next one starts the round is cleared,
// with a bonus for the hearts kept and one heart back, and the game listens
// for the new track's tempo. Without music, or when no beat is found, the
// game plays to its own metronome and a round is ROUND_BARS bars, each a
// little faster. Three hearts gone and the game is over.
//
// This file is the game around the play: the scenes, scoring, hearts, the
// shake, records and achievements. The ball is ball.js, the blocks
// blocks.js, the music's beat rhythm.js, the numbers and panels hud.js and
// the start screen title.js.

const TITLE = 0, PLAY = 1, CLEAR = 2, OVER = 3;
const HEARTS = 6;                  // in halves: three hearts
const ROUND_BARS = 32;             // bars in a round to the metronome
const SHIELD = 50;                 // ticks the crane is safe after losing a heart
const CLEAR_TICKS = 90;            // ticks the round's panel shows
const COMBO_MAX = 9;
const R_BEST_ROUND = 1, R_SMASHED = 2;   // saved: the furthest round, blocks smashed in all

var scene = TITLE;
var spin = true;                   // Swing steering, else Thumb
var shaking = true;                // the Screen shake option
var points = 0, hearts = HEARTS, combo = 1, round = 1;
var waiting = false;               // listening for the tempo before the blocks come
var shield = 0, shake = 0, flash = 0;
var sceneTicks = 0;
var heartsLost = 0;                // this round
var rank = 0;                      // the game's place on the board
// this game, for the panels and the achievements
var smashedN = 0, triples = 0, golds = 0, bestCombo = 1;

// The blocks' splinters first, then the title
function init() {
    blocks.setup();
    hud.setup();
    menuitem(1, "Restart game", startGame);
    menuitem(2, "Main menu", toTitle);
    toTitle();
}

// The pause menu's options, read when they change
function readOptions() {
    spin = opt.get(OPT.steering) == 0;
    blocks.win = blocks.WINDOWS[mid(0, opt.get(OPT.window), 2)];
    rhythm.on = opt.get(OPT.beat) == 1;
    shaking = opt.get(OPT.shake) == 1;
}

// Back to the start screen, not listening
function toTitle() {
    rhythm.reset();
    scene = TITLE;
    title.enter();
}

// A new game from the first round
function startGame() {
    points = 0;
    hearts = HEARTS;
    combo = 1;
    round = 1;
    smashedN = 0;
    triples = 0;
    golds = 0;
    bestCombo = 1;
    rhythm.reset();
    ball.reset();
    startRound();
    sfx(SFX.start);
}

// A round's start: listening first when music plays, else the metronome at once
function startRound() {
    scene = PLAY;
    sceneTicks = 0;
    heartsLost = 0;
    shield = 0;
    rhythm.update();               // it starts listening if there's music
    waiting = rhythm.listening;
    blocks.newRound(rhythm.now());
    hud.sayRound(round);
}

// The round's end: a bonus for the hearts kept, one back, and the next
function roundCleared() {
    var bonus = hearts * 50 * round;
    points += bonus;
    hud.cleared(round, bonus);
    if (heartsLost == 0)
        ach.earn(ACH.clean);
    hearts = min(HEARTS, hearts + 2);
    round++;
    if (round >= 5)
        ach.earn(ACH.encore);
    if (round > flr(dget(R_BEST_ROUND)))
        dset(R_BEST_ROUND, round);
    rhythm.faster();
    blocks.clear(rhythm.now());
    scene = CLEAR;
    sceneTicks = 0;
    sfx(SFX.clear);
}

// Three hearts gone
function gameOver() {
    scene = OVER;
    sceneTicks = 0;
    rank = score.submit(BOARD.points, points);
    dset(R_SMASHED, flr(dget(R_SMASHED)) + smashedN);
    blocks.clear(rhythm.now());
    sfx(SFX.over);
}

// ---- from blocks.js -----------------------------------------------------------

// A block smashed: points by the damage and the combo
function smashed(kind, dmg, triple, x, y) {
    combo = min(COMBO_MAX, combo + (kind == blocks.GOLDEN ? 3 : 1));
    if (combo > bestCombo)
        bestCombo = combo;
    var p = 10 * dmg * combo;
    if (kind == blocks.GOLDEN) {
        p *= 2;
        golds++;
        if (golds == 5)
            ach.earn(ACH.gold);
        hud.say(hud.GOLD);
        sfx(SFX.gold, 1);
    } else if (triple) {
        triples++;
        ach.earn(ACH.triple);
        hud.say(hud.TRIPLE);
        sfx(SFX.triple, 1);
        shake = max(shake, 8);
        flash = 3;
    } else {
        sfx(kind == blocks.HEAVY ? SFX.heavy : SFX.smash, 1);
        if (kind == blocks.HEAVY)
            shake = max(shake, 4);
    }
    if (combo == COMBO_MAX)
        ach.earn(ACH.combo);
    points += p;
    hud.popup(p, x, y);
    smashedN++;
    if (smashedN == 200)
        ach.earn(ACH.wrecker);
}

// A block hit but still standing
function dented(x, y) {
    sfx(SFX.dent, 1);
    shake = max(shake, 2);
}

// A block got past the ring: the combo goes
function missed() {
    combo = 1;
}

// A block of kind k reached the crane: half a heart for a piece, a whole
// one for the rest, unless the shield is up
function reached(k, x, y) {
    if (shield > 0) {
        particles.emit(blocks.spark, 6, x, y, 0.0, 0.0, 1.0, 14, 11);
        return;
    }
    hearts -= k == blocks.PIECE ? 1 : 2;
    heartsLost++;
    combo = 1;
    shield = SHIELD;
    flash = 4;
    shake = max(shake, 10);
    sfx(SFX.heart, 0);
    if (hearts <= 0) {
        hearts = 0;
        gameOver();
    }
}

// ---- the tick -----------------------------------------------------------------

// A tick: the title, or the play and everything that goes with it
function update() {
    if (opt.changed())
        readOptions();
    var k = 33.0 / rate();
    sceneTicks++;
    if (scene == TITLE) {
        if (title.update(k))
            startGame();
        return;
    }
    if (scene == OVER) {
        if (flash > 0)
            flash--;
        if (shake > 0)
            shake--;
        ball.update(spin, k);
        blocks.update(rhythm.now());
        if (sceneTicks > 30 && btnp(4))
            toTitle();
        return;
    }
    var change = rhythm.update();
    var now = rhythm.now();
    hud.update();
    if (shield > 0)
        shield--;
    if (shake > 0)
        shake--;
    if (flash > 0)
        flash--;
    ball.update(spin, k);
    if (scene == CLEAR) {
        blocks.update(now);
        if (sceneTicks >= CLEAR_TICKS)
            startRound();
        return;
    }
    if (change == rhythm.NEW_TRACK) {
        roundCleared();
        return;
    }
    if (change == rhythm.SEEK) {
        blocks.clear(now);         // the music jumped: the air is cleared
        waiting = true;
    }
    if (waiting) {
        if (!rhythm.listening) {
            waiting = false;
            blocks.newRound(now);
            hud.sayTempo();
        }
        return;
    }
    if (rhythm.news == 2) {
        rhythm.news = 0;
        hud.sayTempo();
    } else if (rhythm.news == 1) {
        rhythm.news = 0;
        hud.sayTempo();
    }
    // to the metronome, a round is ROUND_BARS bars; to music, a track
    var last = rhythm.locked ? 1000000 : ROUND_BARS;
    if (blocks.bars < last)
        blocks.plan(now, round);
    blocks.update(now);
    if (scene == PLAY && blocks.bars >= last && blocks.count == 0)
        roundCleared();
}

// The field, shaken when something big happened, then the numbers over it
function draw() {
    var now = rhythm.now();
    if (scene == TITLE) {
        title.draw();
        return;
    }
    var sx = 0, sy = 0;
    if (shake > 0 && shaking) {
        sx = rnd(5) - 2;
        sy = rnd(5) - 2;
    }
    camera(sx, sy);
    field(now);
    blocks.draw(now);
    ball.draw();
    camera();
    hud.draw();
}

// The background, the ring flashing toward each beat and the crane
function field(now) {
    cls(flash > 0 ? 2 : 1);
    var ph = scene == PLAY && !waiting ? rhythm.phase() : 0.0;
    // a faint ring that swells on the beat
    circ(ball.CX, ball.CY, 56 + flr((1.0 - ph) * 3.0), 2);
    var c = 5;
    if (ph > 0.82) {
        rhythm.next(now, 0);
        c = rhythm.place == 0 ? 14 : 13;
    }
    circ(ball.CX, ball.CY, flr(ball.L), c);
    if (shield > 0 && (shield & 4) != 0)
        circ(ball.CX, ball.CY, 10, 11);
    circfill(ball.CX, ball.CY, 6, 13);
    circ(ball.CX, ball.CY, 6, 6);
    circfill(ball.CX, ball.CY, 2, 9);
}
