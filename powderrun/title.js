// title: the start screen, over the skier carving down by themselves, and
// how to ski. update() returns true to start a run.

const MENU = 0, HELP = 1;

var page = MENU;
var sel = 0;
var ITEMS = ["FREE RIDE", "HOW TO SKI"];

function enter() {
    page = MENU;
    sel = 0;
    skier.reset(40.0, 40.0);
    view.reset();
}

function update(k) {
    // the demo: slow S-turns down the fall line
    var c = sin(frame() / 150.0) * 0.7;
    skier.update(true, k, c == 0.0 ? 0.01 : c);
    view.update(k);

    var steps = wheelsteps();
    if (btnp(0))
        steps--;
    if (btnp(1))
        steps++;
    if (page == HELP) {
        if (btnp(4) || btnp(3)) {
            page = MENU;
            sfx(SFX.tick);
        }
        return false;
    }
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

function draw() {
    if (page == HELP) {
        drawHelp();
        return;
    }
    font(FONT.CAPS, 2);
    hud.shadow("POWDER RUN", 80 - textw("POWDER RUN") / 2, 8, 7);
    font(FONT.CAPS);
    hud.shadow("3D", 80 - textw("3D") / 2, 23, 10);
    for (var i = 0; i < 2; i++) {
        var y = 92 + i * 10;
        var s = ITEMS[i];
        if (i == sel) {
            rectfill(40, y - 2, 119, y + 6, 1);
            hud.shadow(s, 80 - textw(s) / 2, y, 10);
            print(">", 44, y, 10);
            print("<", 112, y, 10);
        } else {
            hud.shadow(s, 80 - textw(s) / 2, y, 1);
        }
    }
    hud.shadow(slope.NAMES[0], 80 - textw(slope.NAMES[0]) / 2, 33, 7);
    print("V0.1", 3, 112, 13);
}

function drawHelp() {
    rectfill(0, 0, 159, 119, 1);
    var t = "HOW TO SKI";
    print(t, 80 - textw(t) / 2, 4, 10);
    var lines = ["THE MOUNTAIN TAKES YOU DOWN:",
                 "STEEP SNOW IS FAST, FLAT IS SLOW.",
                 "",
                 "TURN THE WHEEL TO CARVE LEFT OR",
                 "RIGHT. LET GO AND THE SKIS RUN",
                 "STRAIGHT. SHARP TURNS COST SPEED.",
                 "",
                 "ROLLERS AND BUMPS THROW YOU IN",
                 "THE AIR. ENJOY THE RIDE.",
                 "",
                 "MENU: PAUSE."];
    for (var i = 0; i < 11; i++)
        print(lines[i], 80 - textw(lines[i]) / 2, 16 + i * 8, 7);
    t = "SELECT: BACK";
    print(t, 80 - textw(t) / 2, 110, 13);
}
