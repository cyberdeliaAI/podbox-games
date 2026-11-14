// hud: the numbers and words over the field. The points and the combo, the
// hearts, the tempo and the round; a word in the middle when something
// happens; the points a smash scored, rising from where it was; and the
// panels for a round cleared and the game over.
//
// What is said is kept as a fixed text and numbers, never as text put
// together: nothing made in play is kept.

const PLAIN = 0, TRIPLE = 1, GOLD = 2, ROUND = 3, TEMPO = 4, FREE = 5, LISTEN = 6;
var WORDS = ["", "TRIPLE!", "GOLD!", "ROUND ", "", "NO BEAT: FREE TEMPO", "LISTENING..."];
const HEART = 6;                   // the heart's sprite, the empty one after it
const HALF_HEART = 11;             // ...and half of one

var saying = PLAIN, sayN = 0, sayFor = 0;
var popN = 0, popX = 0, popY = 0, popFor = 0;
var clearRound = 0, clearBonus = 0;

// Once
function setup() {
    saying = PLAIN;
}

// A word in the middle for a moment
function say(w) {
    saying = w;
    sayFor = 40;
}

// A round's start
function sayRound(n) {
    saying = ROUND;
    sayN = n;
    sayFor = 50;
}

// The tempo found, or none
function sayTempo() {
    saying = rhythm.locked ? TEMPO : FREE;
    sayN = rhythm.bpm;
    sayFor = 60;
}

// The points a smash scored, where it was
function popup(p, x, y) {
    popN = p;
    popX = flr(x);
    popY = flr(y);
    popFor = 24;
}

// A round cleared, for its panel
function cleared(n, bonus) {
    clearRound = n;
    clearBonus = bonus;
}

// Once a tick
function update() {
    if (sayFor > 0)
        sayFor--;
    if (popFor > 0)
        popFor--;
}

// Everything over the field
function draw() {
    shadow("" + points, 3, 3, 7);
    if (combo > 1)
        shadow("X" + combo, 3, 11, combo == COMBO_MAX ? 10 : 9);
    for (var i = 0; i < HEARTS / 2; i++) {
        var h = hearts - i * 2;
        spr(h >= 2 ? HEART : h == 1 ? HALF_HEART : HEART + 1, 135 + i * 8, 3);
    }
    var b = rhythm.locked ? rhythm.bpm + " BPM" : "FREE " + rhythm.bpm;
    if (rhythm.listening)
        b = "LISTENING";
    print(b, 3, 113, 13);
    var r = "ROUND " + round;
    print(r, 157 - textw(r), 113, 13);
    if (popFor > 0) {
        var t = "" + popN;
        print(t, popX - textw(t) / 2, popY - 10 - (24 - popFor) / 3, 7);
    }
    if (scene == PLAY && waiting) {
        shadow(WORDS[LISTEN], 80 - textw(WORDS[LISTEN]) / 2, 86, 7);
    } else if (sayFor > 0) {
        var w = WORDS[saying];
        if (saying == ROUND)
            w = WORDS[ROUND] + sayN;
        else if (saying == TEMPO)
            w = sayN + " BPM";
        shadow(w, 80 - textw(w) / 2, 86, saying == TRIPLE ? 14 : saying == GOLD ? 10 : 7);
    }
    if (scene == CLEAR)
        panelClear();
    else if (scene == OVER)
        panelOver();
}

// A round cleared: the bonus, and a heart back
function panelClear() {
    rectfill(24, 30, 135, 74, 1);
    rect(24, 30, 135, 74, 13);
    var t = "ROUND " + clearRound + " CLEAR";
    shadow(t, 80 - textw(t) / 2, 36, 11);
    t = "HEARTS BONUS " + clearBonus;
    shadow(t, 80 - textw(t) / 2, 48, 7);
    t = rhythm.listening ? "LISTENING TO THE NEXT TRACK" : "THE NEXT ROUND IS FASTER";
    shadow(t, 80 - textw(t) / 2, 62, 13);
}

// The game over: the points, where they stand, and what was done
function panelOver() {
    rectfill(16, 22, 143, 96, 1);
    rect(16, 22, 143, 96, 13);
    var t = "GAME OVER";
    shadow(t, 80 - textw(t) / 2, 28, 8);
    font(FONT.CAPS, 2);
    t = "" + points;
    shadow(t, 80 - textw(t) / 2, 40, 7);
    font(FONT.CAPS);
    t = rank == 1 ? "THE BEST SCORE YET!" : rank > 0 ? "NUMBER " + rank + " ON THE BOARD" : "ROUND " + round;
    shadow(t, 80 - textw(t) / 2, 58, rank == 1 ? 10 : 7);
    t = smashedN + " SMASHED  " + triples + " TRIPLE  X" + bestCombo + " BEST";
    shadow(t, 80 - textw(t) / 2, 70, 13);
    t = "SELECT: MAIN MENU";
    shadow(t, 80 - textw(t) / 2, 86, 6);
}

// Text with a dark shadow down and right
function shadow(s, x, y, c) {
    print(s, x + 1, y + 1, 1);
    print(s, x, y, c);
}
