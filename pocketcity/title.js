// title: the start screen, over the city gliding past below, and how to
// play. update() returns true to start.

const MENU = 0, HELP = 1;
const PAGES = 3;

var page = MENU;
var sel = 0, helpPage = 0;
var ITEMS = ["PLAY", "HOW TO PLAY"];
var tx = 0, ty = 0;                // the camera's top left over the city

var HELP_TITLES = ["DRIVING", "ON FOOT", "JOBS AND THE POLICE"];
var HELP_LINES = [
    ["SELECT, HELD: THROTTLE.",
     "PREV: BRAKE, THEN REVERSE.",
     "WHEEL: STEER. LET GO AND THE",
     "WHEELS COME BACK STRAIGHT.",
     "PLAY: HANDBRAKE, FOR A SLIDE.",
     "NEXT: GET OUT (STANDING),",
     "OR THE HORN.",
     "GRASS, SAND AND SIDEWALKS",
     "SLOW YOU DOWN."],
    ["WHEEL: TURN.",
     "SELECT, HELD: WALK.",
     "WITH PLAY HELD: RUN.",
     "NEXT: INTO THE NEAREST CAR.",
     "TAKE ONE WITH ITS DRIVER IN",
     "AND THE POLICE HEAR OF IT.",
     "",
     "MENU, HELD: PAUSE, THE CITY",
     "MAP AND OPTIONS."],
    ["THE NEXT JOB WAITS AT A PHONE",
     "BOX: THE YELLOW ARROW. FIVE",
     "DISTRICTS, FOUR JOBS EACH.",
     "RED LIGHTS, RAMMING AND",
     "KNOCKING PEOPLE DOWN BRING THE",
     "POLICE. LOSE THEM, OR GET",
     "FRESH PAINT AT A PAINT SHOP.",
     "THIRTY TAPES ARE LOST ABOUT",
     "THE CITY. FIND THEM ALL."],
];

// The menu, the view where it was
function enter() {
    page = MENU;
    sel = 0;
    city.whole = true;
}

// The glide and the menu, once a tick: true to start
function update(k) {
    // a slow circle over the middle of the city, across the river
    var a = frame() / 4000.0;
    tx = flr(944.0 + cos(a) * 620.0);
    ty = flr(964.0 + sin(a) * 620.0);
    city.follow(tx >> 3, ty >> 3);
    if (page == HELP) {
        var steps = wheelsteps();
        if (btnp(1))
            steps++;
        if (btnp(0))
            steps--;
        if (steps != 0) {
            helpPage = mid(0, helpPage + steps, PAGES - 1);
            click();
        }
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
        helpPage = 0;
    }
    return false;
}

// The title over the city, or how to play
function draw() {
    if (page == HELP) {
        drawHelp();
        return;
    }
    city.draw(tx, ty);
    fillp(0xa5a5);
    rectfill(0, 0, 159, 36, 1);
    rectfill(30, 72, 129, 98, 1);
    fillp();
    font(FONT.CAPS, 2);
    hud.shadow("POCKET CITY", 80 - textw("POCKET CITY") / 2, 6, 10);
    font(FONT.CAPS);
    hud.shadow("3D", 80 - textw("3D") / 2, 22, 7);
    for (var i = 0; i < 2; i++) {
        var y = 76 + i * 11;
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
    var p = "JOBS " + jobs.done + "/" + jobs.JOBS + "  TAPES " + jobs.tapes() + "/" + jobs.TAPES + "  $" + cash;
    hud.shadow(p, 80 - textw(p) / 2, 103, 13);
    hud.shadow("V1.0", 3, 112, 6);
}

// How to play, a page at a time
function drawHelp() {
    rectfill(0, 0, 159, 119, 1);
    var t = HELP_TITLES[helpPage];
    print(t, 80 - textw(t) / 2, 4, 10);
    var lines = HELP_LINES[helpPage];
    for (var i = 0; i < lines.length; i++)
        print(lines[i], 80 - textw(lines[i]) / 2, 16 + i * 9, 7);
    t = (helpPage + 1) + "/" + PAGES + "  WHEEL: PAGE  SELECT: BACK";
    print(t, 80 - textw(t) / 2, 110, 13);
}
