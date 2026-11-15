// title: the start screen over the first hole, seen from high behind the
// tee, and the page on how to play.
//
// The wheel moves between the rows, Select picks one. On the practice row
// Prev and Next choose the hole.

const ROWS = 3;
const ROW_Y = 64;                  // the first row's place

var row = 0;
var page = 0;                      // 0 the menu, 1 how to play
var pick = 0;                      // the hole to practise
var chosen = 0;                    // 0 a round, 1 practice

var HELP = [
    "WHEEL: AIM; THE VIEW FOLLOWS",
    "PREV, NEXT: CHOOSE THE CLUB",
    "PLAY: THE HOLE FROM ABOVE",
    "",
    "SELECT STARTS THE SWING. PRESS AGAIN",
    "FOR THE POWER, AND ONCE MORE AS THE",
    "MARKER COMES BACK OVER THE LINE:",
    "EARLY HOOKS LEFT, LATE SLICES RIGHT",
    "",
    "PUTTS TAKE TWO PRESSES. THE RED MARK",
    "IS THE PIN ON A FLAT GREEN; THE ARROW",
    "BY GREEN SHOWS WHICH WAY IT FALLS",
    "WATER AND OUT OF BOUNDS: ONE STROKE"
];

// Back to the menu
function enter() {
    page = 0;
}

// One tick of the menu. Returns true when a game was chosen
function update() {
    if (page == 1) {
        if (btnp(4) || btnp(3) || btnp(0) || btnp(1)) {
            page = 0;
            sfx(SFX.select);
        }
        return false;
    }
    var s = wheelsteps();
    if (s != 0) {
        var r = mid(0, row + s, ROWS - 1);
        if (r != row)
            sfx(SFX.select);
        row = r;
    }
    if (row == 1) {
        if (btnp(0)) {
            pick = (pick + course.HOLES - 1) % course.HOLES;
            sfx(SFX.select);
        }
        if (btnp(1)) {
            pick = (pick + 1) % course.HOLES;
            sfx(SFX.select);
        }
    }
    if (!btnp(4))
        return false;
    sfx(SFX.select);
    if (row == 2) {
        page = 1;
        return false;
    }
    chosen = row;
    return true;
}

// The title, the rows and the best round; or the page on how to play
function draw() {
    if (page == 1) {
        help();
        return;
    }
    font(FONT.CAPS, 2);
    var t = "POCKET GOLF";
    var w = textw(t) + textw(" 3D");
    hud.shadow(t, 80 - w / 2, 14, 7);
    hud.shadow("3D", 80 - w / 2 + textw("POCKET GOLF "), 14, 10);
    font(FONT.CAPS);
    t = course.names[0];
    hud.shadow(t, 80 - textw(t) / 2, 30, 11);
    for (var i = 0; i < ROWS; i++) {
        var y = ROW_Y + i * 11;
        if (i == row)
            rectfill(28, y - 3, 131, y + 7, 1);
        var c = i == row ? 10 : 7;
        if (i == 0) {
            t = "PLAY 9 HOLES";
        } else if (i == 1) {
            t = "PRACTICE HOLE " + (pick + 1);
            if (i == row) {
                hud.shadow("<", 32, y, 6);
                hud.shadow(">", 124, y, 6);
            }
        } else {
            t = "HOW TO PLAY";
        }
        hud.shadow(t, 80 - textw(t) / 2, y, c);
    }
    var b = flr(dget(R_BEST));
    if (b > 0) {
        var d = b - course.parSum;
        t = "BEST ROUND " + b + (d < 0 ? " (" + d + ")" : d == 0 ? " (E)" : " (+" + d + ")");
        hud.shadow(t, 80 - textw(t) / 2, 100, 13);
    }
    hud.shadow("V1.0", 3, 112, 13);
}

// How to play, over a dark panel
function help() {
    rectfill(0, 0, 159, 119, 1);
    var t = "HOW TO PLAY";
    print(t, 80 - textw(t) / 2, 4, 10);
    for (var i = 0; i < HELP.length; i++)
        print(HELP[i], 4, 14 + i * 7, 7);
    t = "SELECT: BACK";
    print(t, 80 - textw(t) / 2, 112, 13);
}
