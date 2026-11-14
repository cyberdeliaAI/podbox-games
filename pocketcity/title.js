// title: the start screen, over the district gliding past below, and how
// to drive. update() returns true to start a drive.

const MENU = 0, HELP = 1;

var page = MENU;
var sel = 0;
var ITEMS = ["DRIVE", "HOW TO DRIVE"];
var tx = 0, ty = 0;                // the camera's top left over the district

// The menu, the view where it was
function enter() {
    page = MENU;
    sel = 0;
    city.whole = true;
}

// The glide and the menu, once a tick: true to start
function update(k) {
    // a slow circle over the middle of the district
    var a = frame() / 3000.0;
    tx = flr(432.0 + cos(a) * 300.0);
    ty = flr(452.0 + sin(a) * 300.0);
    city.follow(tx >> 3, ty >> 3);
    if (page == HELP) {
        if (btnp(4) || btnp(3)) {
            page = MENU;
            sfx(SFX.tick);
        }
        return false;
    }
    var steps = wheelsteps();
    if (btnp(0))
        steps--;
    if (btnp(1))
        steps++;
    if (steps != 0) {
        sel = ((sel + steps) % 2 + 2) % 2;
        click();
    }
    if (btnp(4)) {
        sfx(SFX.tick);
        if (sel == 0)
            return true;
        page = HELP;
    }
    return false;
}

// The title over the district, or how to drive
function draw() {
    if (page == HELP) {
        drawHelp();
        return;
    }
    city.draw(tx, ty);
    fillp(0xa5a5);
    rectfill(0, 0, 159, 36, 1);
    rectfill(30, 80, 129, 106, 1);
    fillp();
    font(FONT.CAPS, 2);
    hud.shadow("POCKET CITY", 80 - textw("POCKET CITY") / 2, 6, 10);
    font(FONT.CAPS);
    hud.shadow("3D", 80 - textw("3D") / 2, 22, 7);
    for (var i = 0; i < 2; i++) {
        var y = 84 + i * 11;
        var s = ITEMS[i];
        if (i == sel) {
            rectfill(34, y - 2, 125, y + 6, 1);
            hud.shadow(s, 80 - textw(s) / 2, y, 10);
            print(">", 38, y, 10);
            print("<", 118, y, 10);
        } else {
            hud.shadow(s, 80 - textw(s) / 2, y, 7);
        }
    }
    hud.shadow("V0.1", 3, 112, 6);
}

// How to drive
function drawHelp() {
    rectfill(0, 0, 159, 119, 1);
    var t = "HOW TO DRIVE";
    print(t, 80 - textw(t) / 2, 4, 10);
    var lines = ["SELECT, HELD: THROTTLE.",
                 "PREV: BRAKE, THEN REVERSE.",
                 "WHEEL: STEER. LET GO AND THE",
                 "WHEELS COME BACK STRAIGHT.",
                 "PLAY: HANDBRAKE, FOR A SLIDE.",
                 "NEXT: THE HORN.",
                 "",
                 "GRASS AND SIDEWALKS SLOW YOU.",
                 "THE CAMERA LOOKS AHEAD AS YOU",
                 "GO. MENU: PAUSE."];
    for (var i = 0; i < 10; i++)
        print(lines[i], 80 - textw(lines[i]) / 2, 16 + i * 9, 7);
    t = "SELECT: BACK";
    print(t, 80 - textw(t) / 2, 110, 13);
}
