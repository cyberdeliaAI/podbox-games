// title: the start screen, over the landscape flying itself round in a
// slow circle; the way to fly, the landscape, the landmarks found and how
// to fly. update() returns true to take off the way chosen says.
//
// The wheel moves between the rows; Prev and Next change the landscape on
// its row, and Select takes off, opens a page or steps the landscape on.

const MENU = 0, HELP = 1, MARKS = 2;
const ROWS = 5;
const ROW_FREE = 0, ROW_DISCOVERY = 1, ROW_LAND = 2, ROW_MARKS = 3, ROW_HELP = 4;
const TOP = 58;                    // the first row's y

var page = MENU;
var sel = 0;
var chosen = 0;                    // FREE or DISCOVERY, for main.js

// Back to the menu, the aircraft circling over the landscape's start
function enter() {
    page = MENU;
    flight.reset(world.startX, world.startY, world.startZ + 20.0, world.startHdg);
    view.chase = true;
    view.update(1.0);
    scenery.reframe(view.cx, view.cy);
}

// The flyover and the menu, once a tick: true to take off
function update(k) {
    // the aircraft circles by itself behind the menu
    flight.bank = 0.35;
    flight.hdg -= 0.35 * flight.TURN * k;
    flight.hdg -= flr(flight.hdg);
    flight.x = flight.wrap(flight.x + cos(flight.hdg) * 0.4 * k);
    flight.y = flight.wrap(flight.y + sin(flight.hdg) * 0.4 * k);
    flight.gnd = world.ground(flight.x, flight.y);
    var floor = flight.gnd + 30.0;
    if (flight.z < floor)
        flight.z += (floor - flight.z) * 0.05 * k;
    view.update(k);

    if (page != MENU) {
        if (btnp(4) || btnp(3)) {
            page = MENU;
            sfx(SFX.tick);
        }
        return false;
    }
    var steps = wheelsteps();
    var change = 0;
    if (btnp(0))
        change = -1;
    if (btnp(1))
        change = 1;
    if (change != 0 && sel != ROW_LAND) {
        steps += change;
        change = 0;
    }
    if (steps != 0) {
        sel = ((sel + steps) % ROWS + ROWS) % ROWS;
        click();
    }
    if (btnp(4)) {
        sfx(SFX.tick);
        if (sel == ROW_FREE || sel == ROW_DISCOVERY) {
            chosen = sel == ROW_FREE ? FREE : DISCOVERY;
            return true;
        }
        if (sel == ROW_MARKS)
            page = MARKS;
        else if (sel == ROW_HELP)
            page = HELP;
        else
            change = 1;
    }
    if (change != 0) {
        click();
        pickLand(((landN + change) % world.COUNT + world.COUNT) % world.COUNT);
    }
    return false;
}

// The title and the rows, or a page
function draw() {
    if (page == HELP) {
        drawHelp();
        return;
    }
    if (page == MARKS) {
        drawMarks();
        return;
    }
    font(FONT.CAPS, 2);
    hud.shadow("POCKET WINGS", 80 - textw("POCKET WINGS") / 2, 10, 7);
    font(FONT.CAPS);
    hud.shadow("3D", 80 - textw("3D") / 2, 25, 10);
    fillp(0xa5a5);
    rectfill(18, TOP - 4, 141, TOP + ROWS * 10 - 2, 1);
    fillp();
    for (var i = 0; i < ROWS; i++) {
        var y = TOP + i * 10;
        var s = row(i);
        if (i == sel) {
            rectfill(18, y - 2, 141, y + 6, 1);
            hud.shadow(s, 80 - textw(s) / 2, y, 10);
            if (i == ROW_LAND) {
                print("<", 22, y, 10);
                print(">", 134, y, 10);
            }
        } else {
            hud.shadow(s, 80 - textw(s) / 2, y, 7);
        }
    }
    hud.shadow("V1.0", 3, 112, 6);
}

// Row i's words
function row(i) {
    if (i == ROW_FREE)
        return "FREE FLIGHT";
    if (i == ROW_DISCOVERY)
        return "DISCOVERY";
    if (i == ROW_LAND)
        return world.NAMES[landN];
    if (i == ROW_MARKS)
        return "LANDMARKS";
    return "HOW TO FLY";
}

// How to fly
function drawHelp() {
    rectfill(0, 0, 159, 119, 1);
    var t = "HOW TO FLY";
    print(t, 80 - textw(t) / 2, 4, 10);
    var lines = ["TURN THE WHEEL TO BANK AND TURN.",
                 "LEAVE IT, AND THE WINGS LEVEL.",
                 "HOLD PREV TO CLIMB, NEXT TO DIVE.",
                 "PLAY: SLOW, CRUISE OR FAST.",
                 "SELECT: BEHIND OR IN THE COCKPIT.",
                 "",
                 "THE GROUND CAN'T HURT YOU: FLY",
                 "LOW AND THE AIRCRAFT LIFTS ITSELF.",
                 "DISCOVERY SHOWS THE WAY TO EACH",
                 "LANDMARK: FLY LOW OVER IT.",
                 "MENU: PAUSE AND OPTIONS."];
    for (var i = 0; i < 11; i++)
        print(lines[i], 80 - textw(lines[i]) / 2, 15 + i * 8, 7);
    t = "SELECT: BACK";
    print(t, 80 - textw(t) / 2, 110, 13);
}

// The landmarks found: how many in each landscape, and this one's by name
function drawMarks() {
    rectfill(0, 0, 159, 119, 1);
    var t = "LANDMARKS";
    print(t, 80 - textw(t) / 2, 4, 10);
    var all = 0;
    for (var n = 0; n < world.COUNT; n++) {
        var bits = flr(dget(R_FOUND + n)), c = 0;
        for (var i = 0; i < world.MARKS_EACH; i++)
            c += (bits >> i) & 1;
        all += c;
        var y = 14 + n * 8;
        print(world.NAMES[n], 8, y, n == landN ? 10 : 7);
        var v = c + " OF 5";
        print(v, 152 - textw(v), y, c == world.MARKS_EACH ? 11 : 7);
    }
    for (var i = 0; i < world.MARKS_EACH; i++) {
        var got = (flr(dget(R_FOUND + landN)) >> i) & 1;
        var nm = got != 0 ? world.MARKS[landN * world.MARKS_EACH + i] : "?";
        print(nm, 80 - textw(nm) / 2, 66 + i * 8, got != 0 ? 7 : 13);
    }
    t = all + " OF 30 FOUND";
    print(t, 80 - textw(t) / 2, 110, 13);
}
