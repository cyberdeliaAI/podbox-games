// hud: the numbers over the drive. The speed in a corner, the district's
// name for a moment at the start, the frame rate when asked for. Words
// kept are fixed texts, never put together, so nothing made in play is kept.

const DISTRICT = 0;
var WORDS = ["OLD TOWN"];

var saying = 0, sayFor = 0;

// A word in the middle for a moment
function say(w) {
    saying = w;
    sayFor = 60;
}

// Once a tick
function update() {
    if (sayFor > 0)
        sayFor--;
}

// The numbers over the drive
function draw() {
    var s = car.kmh() + " KM/H";
    shadow(s, 157 - textw(s), 112, 7);
    if (sayFor > 0) {
        var w = WORDS[saying];
        font(FONT.CAPS, 2);
        shadow(w, 80 - textw(w) / 2, 20, 10);
        font(FONT.CAPS);
    }
    if (stats) {
        var t = rate() + "/S";
        shadow(t, 3, 112, 13);
    }
}

// Text with a dark shadow down and right
function shadow(s, x, y, c) {
    print(s, x + 1, y + 1, 1);
    print(s, x, y, c);
}
