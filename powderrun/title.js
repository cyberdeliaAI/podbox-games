// title: the start screen, over the skier carving down the slope by
// themselves; the slope and seed to ski, the records and how to ski.
// update() returns true to start a run of the kind in chosen.
//
// The wheel moves between the rows. Prev and Next change the slope and the
// seed on their rows, and Select starts, opens or steps on.

const MENU = 0, HELP = 1, RECORDS = 2;
const ROWS = 6;
const ROW_FREE = 0, ROW_ENDLESS = 1, ROW_SLOPE = 2, ROW_SEED = 3, ROW_RECORDS = 4, ROW_HELP = 5;
const TOP = 50;                    // the first row's y

var page = MENU;
var sel = 0;
var chosen = 0;                    // FREE or ENDLESS, for main.js

// Back to the menu, the demo skier at the start
function enter() {
    page = MENU;
    skier.reset(40.0, 40.0);
    view.reset();
}

// The demo and the menu, once a tick: true to start a run of the kind in chosen
function update(k) {
    // the demo: slow S-turns down the fall line, round what's in the way
    var c = sin(frame() / 150.0) * 0.7;
    var d = objects.dodge();
    if (d != 0.0)
        c = d;
    skier.update(true, k, c == 0.0 ? 0.01 : c);
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
    if (change != 0 && sel != ROW_SLOPE && sel != ROW_SEED) {
        steps += change;
        change = 0;
    }
    if (steps != 0) {
        sel = ((sel + steps) % ROWS + ROWS) % ROWS;
        click();
    }
    if (btnp(4)) {
        sfx(SFX.tick);
        if (sel == ROW_FREE || sel == ROW_ENDLESS) {
            chosen = sel == ROW_FREE ? FREE : ENDLESS;
            return true;
        }
        if (sel == ROW_RECORDS)
            page = RECORDS;
        else if (sel == ROW_HELP)
            page = HELP;
        else
            change = 1;
    }
    if (change != 0) {
        click();
        if (sel == ROW_SLOPE)
            pickSlope(((slopeN + change) % slope.COUNT + slope.COUNT) % slope.COUNT);
        else
            pickSeed(((seedPick + change) % 100 + 100) % 100);
    }
    return false;
}

// The title and the rows, or a page
function draw() {
    if (page == HELP) {
        drawHelp();
        return;
    }
    if (page == RECORDS) {
        drawRecords();
        return;
    }
    font(FONT.CAPS, 2);
    hud.shadow("POWDER RUN", 80 - textw("POWDER RUN") / 2, 6, 7);
    font(FONT.CAPS);
    hud.shadow("3D", 80 - textw("3D") / 2, 21, 10);
    fillp(0xa5a5);
    rectfill(18, TOP - 4, 141, TOP + ROWS * 10 - 2, 1);
    fillp();
    for (var i = 0; i < ROWS; i++) {
        var y = TOP + i * 10;
        var s = row(i);
        if (i == sel) {
            rectfill(18, y - 2, 141, y + 6, 1);
            hud.shadow(s, 80 - textw(s) / 2, y, 10);
            if (i == ROW_SLOPE || i == ROW_SEED) {
                print("<", 22, y, 10);
                print(">", 134, y, 10);
            }
        } else {
            hud.shadow(s, 80 - textw(s) / 2, y, 7);
        }
    }
    print("V1.0", 3, 112, 13);
}

// Row i's words
function row(i) {
    if (i == ROW_FREE)
        return "FREE RIDE";
    if (i == ROW_ENDLESS)
        return "ENDLESS RUN";
    if (i == ROW_SLOPE)
        return slope.NAMES[slopeN];
    if (i == ROW_SEED)
        return seedPick == 0 ? "SEED: NEW EACH RUN" : "SEED: " + seedPick;
    if (i == ROW_RECORDS)
        return "RECORDS";
    return "HOW TO SKI";
}

// How to ski
function drawHelp() {
    rectfill(0, 0, 159, 119, 1);
    var t = "HOW TO SKI";
    print(t, 80 - textw(t) / 2, 4, 10);
    var lines = ["WHEEL: CARVE LEFT OR RIGHT.",
                 "LET GO AND THE SKIS RUN STRAIGHT.",
                 "NEXT: TUCK, FOR SPEED.",
                 "PREV: PLOUGH, TO SLOW DOWN.",
                 "SELECT: JUMP.  PLAY: CAMERA.",
                 "",
                 "MISS THE PINES AND BOULDERS, OR",
                 "JUMP THE SMALL ONES. FREE RIDE",
                 "GOES ON FOR EVER. ENDLESS RUN",
                 "GETS STEEPER AND ENDS AT THE",
                 "THIRD FALL. MENU: PAUSE."];
    for (var i = 0; i < 11; i++)
        print(lines[i], 80 - textw(lines[i]) / 2, 15 + i * 8, 7);
    t = "SELECT: BACK";
    print(t, 80 - textw(t) / 2, 110, 13);
}

// The records kept in the saved numbers
function drawRecords() {
    rectfill(0, 0, 159, 119, 1);
    var t = "RECORDS";
    print(t, 80 - textw(t) / 2, 4, 10);
    var total = flr(dget(R_TOTAL)), air = flr(dget(R_AIR)), have = flr(dget(R_SLOPES));
    var n = 0;
    for (var i = 0; i < slope.COUNT; i++)
        n += (have >> i) & 1;
    record(0, "SKIED IN ALL", total / 1000 + "." + (total % 1000) / 100 + " KM");
    record(1, "TOP SPEED", flr(dget(R_TOP)) + " KM/H");
    record(2, "LONGEST JUMP", air / 1000 + "." + (air % 1000) / 100 + " S");
    record(3, "LONGEST RUN, NO FALL", flr(dget(R_CLEAN)) + " M");
    record(4, "BEST ENDLESS RUN", flr(dget(R_BEST)) + " M");
    record(5, "JUMPS", "" + flr(dget(R_JUMPS)));
    record(6, "SLOPES, 500 M OR MORE", n + " OF 5");
    t = "HIGH SCORES: IN THE PAUSE MENU";
    print(t, 80 - textw(t) / 2, 96, 13);
    t = "SELECT: BACK";
    print(t, 80 - textw(t) / 2, 110, 13);
}

// One record's row: its label left, its value right
function record(i, label, value) {
    var y = 18 + i * 10;
    print(label, 8, y, 7);
    print(value, 152 - textw(value), y, 10);
}
