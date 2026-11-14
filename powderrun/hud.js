// hud: what there is on screen over the run. The distance and the speed
// (the option can hide them), an Endless Run's skis left, a word or two
// when something happens, the frame rate when asked for, and the panel
// when an Endless Run is over.

const SAY_Y = 22;                  // where the words go
const PLAIN = 0, SEED = 1, AIR = 2;

// What is said is kept as a fixed text and a number, never as text put
// together: a string kept would sit in memory for good, and one high up
// would leave too little room above it for the next slope's pictures (see
// slope.js).
var said = "";
var saying = PLAIN, sayN = 0;
var sayFor = 0;

// Puts fixed words on screen for ticks, under the numbers
function say(s, ticks) {
    said = s;
    saying = PLAIN;
    sayFor = ticks;
}

// A run's start: the slope's name, and its seed under it
function sayStart(name, seed) {
    said = name;
    saying = SEED;
    sayN = seed;
    sayFor = 70;
}

// A long jump, in ms
function sayAir(ms) {
    said = "";
    saying = AIR;
    sayN = ms;
    sayFor = 40;
}

// Once a tick: the words run their time
function update() {
    if (sayFor > 0)
        sayFor--;
}

// Up in the sky the numbers need no shadow, which saves a few hundred units
function draw() {
    if (scene == OVER) {
        panel();
        return;
    }
    if (showHud) {
        print(skier.metres() + " M", 3, 3, 7);
        var s = skier.kmh() + " KM/H";
        print(s, 156 - textw(s), 3, 7);
        if (runMode == ENDLESS) {
            for (var i = 0; i < lives; i++)
                rectfill(4 + i * 6, 11, 7 + i * 6, 12, 8);
        }
    }
    if (sayFor > 0) {
        var w = said;
        if (saying == AIR)
            w = "AIR " + sayN / 1000 + "." + (sayN % 1000) / 100 + " S";
        shadow(w, 80 - textw(w) / 2, SAY_Y, 10);
        if (saying == SEED) {
            w = "SEED " + sayN;
            shadow(w, 80 - textw(w) / 2, SAY_Y + 9, 7);
        }
    }
    if (stats) {
        var t = "Q" + quality.level + " " + rate() + "/S";
        shadow(t, 156 - textw(t), 112, 13);
    }
}

// The end of an Endless Run: how far, where it stands, and what next
function panel() {
    rectfill(20, 24, 139, 96, 1);
    rect(20, 24, 139, 96, 13);
    var t = "RUN OVER";
    shadow(t, 80 - textw(t) / 2, 30, 10);
    font(FONT.CAPS, 2);
    t = skier.metres() + " M";
    shadow(t, 80 - textw(t) / 2, 42, 7);
    font(FONT.CAPS);
    t = overBest ? "YOUR BEST YET!" : overRank > 0 ? "NUMBER " + overRank + " ON THE BOARD" : "BEST " + flr(dget(R_BEST)) + " M";
    shadow(t, 80 - textw(t) / 2, 60, overBest || overRank == 1 ? 10 : 7);
    t = slope.NAMES[slopeN] + ", SEED " + runSeed;
    shadow(t, 80 - textw(t) / 2, 70, 13);
    t = "SELECT: AGAIN   MENU: MORE";
    shadow(t, 80 - textw(t) / 2, 86, 6);
}

// Text with a dark shadow down and right, to read over snow
function shadow(s, x, y, c) {
    print(s, x + 1, y + 1, 1);
    print(s, x, y, c);
}
