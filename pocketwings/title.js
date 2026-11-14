// title: the start screen, over the landscape flying itself round in a
// slow circle, and how to fly. update() returns true to take off.

const MENU = 0, HELP = 1;

var page = MENU;
var sel = 0;
var ITEMS = ["FREE FLIGHT", "HOW TO FLY"];

function enter() {
    page = MENU;
    sel = 0;
    flight.reset(world.startX, world.startY, world.startZ + 20.0, world.startHdg);
    view.chase = true;
}

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
    hud.shadow("POCKET WINGS", 80 - textw("POCKET WINGS") / 2, 10, 7);
    font(FONT.CAPS);
    hud.shadow("3D", 80 - textw("3D") / 2, 25, 10);
    hud.shadow(world.NAMES[0], 80 - textw(world.NAMES[0]) / 2, 36, 7);
    for (var i = 0; i < 2; i++) {
        var y = 84 + i * 10;
        var s = ITEMS[i];
        if (i == sel) {
            rectfill(40, y - 2, 119, y + 6, 1);
            hud.shadow(s, 80 - textw(s) / 2, y, 10);
            print(">", 44, y, 10);
            print("<", 112, y, 10);
        } else {
            hud.shadow(s, 80 - textw(s) / 2, y, 7);
        }
    }
    hud.shadow("V0.1", 3, 112, 6);
}

function drawHelp() {
    rectfill(0, 0, 159, 119, 1);
    var t = "HOW TO FLY";
    print(t, 80 - textw(t) / 2, 4, 10);
    var lines = ["TURN THE WHEEL TO BANK AND TURN.",
                 "LEAVE IT, AND THE WINGS LEVEL.",
                 "",
                 "HOLD PREV TO CLIMB, NEXT TO DIVE.",
                 "PLAY: SLOW, CRUISE OR FAST.",
                 "SELECT: BEHIND OR IN THE COCKPIT.",
                 "MENU: PAUSE.",
                 "",
                 "THE GROUND CAN'T HURT YOU: FLY",
                 "LOW AND THE AIRCRAFT LIFTS ITSELF.",
                 "NO SCORE, NO HURRY. JUST FLY."];
    for (var i = 0; i < 11; i++)
        print(lines[i], 80 - textw(lines[i]) / 2, 16 + i * 8, i == 10 ? 10 : 7);
    t = "SELECT: BACK";
    print(t, 80 - textw(t) / 2, 110, 13);
}
