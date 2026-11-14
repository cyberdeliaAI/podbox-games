// title: the start screen with its menu, the level picker and the
// instructions. update() returns the level to start, or -1.

const MENU = 0, PICK = 1, HELP = 2;
const ROWS = 4;
const DEMO = 80;                   // balls in the chain that rolls behind the menu

var ITEMS = ["PLAY", "LEVELS", "HOW TO PLAY", "TOP SCORES"];

var page = MENU;
var sel = 0;                       // the menu's row
var pick = 0;                      // the level picked
var roll = 0.0;                    // how far the demo chain has rolled

// a small picture of each track, for the level picker
var thumbs = [0, 0, 0];
var GROUND = [1, 4, 3];
var LIP = [13, 15, 6];

var dx = new Int32Array(DEMO), dy = new Int32Array(DEMO), ds = new Uint8Array(DEMO);
var shown = 0;                     // balls of the demo chain in view
var ticks = 0;

// the menu's page and the instructions are drawn once into pictures
var picMenu = 0, picHelp = 0;

function init() {
    for (var t = 0; t < 3; t++) {
        var tx = levels.TX[t], ty = levels.TY[t];
        var len = tx.length;
        thumbs[t] = img(36, 27);
        target(thumbs[t]);
        cls(GROUND[t]);
        for (var k = 0; k < len; k += 2)
            circfill(tx[k] * 0.225, ty[k] * 0.225, 1, LIP[t]);
        for (var k = 0; k < len; k += 2)
            pset(tx[k] * 0.225, ty[k] * 0.225, 0);
        circfill(tx[len - 1] * 0.225, ty[len - 1] * 0.225, 2, 8);
        target(SCREEN);
    }
    picHelp = img(160, 120);
    target(picHelp);
    drawHelp();
    target(SCREEN);
    picMenu = img(160, 120);
}

// Back to the first page of the menu; the demo chain rolls on the spiral
function enter() {
    page = MENU;
    sel = 0;
    chain.setup(levels.TX[0], levels.TY[0], levels.NEAR[0]);
    target(picMenu);
    drawMenu();
    target(SCREEN);
}

function wrap(v, n) {
    while (v < 0)
        v += n;
    while (v >= n)
        v -= n;
    return v;
}

function update() {
    // the demo chain moves every other tick
    if ((++ticks & 1) == 0 && page == MENU)
        demo();

    var st = wheelsteps();
    if (btnp(0))
        st--;
    if (btnp(1))
        st++;
    var ok = btnp(4);
    var back = btnp(3);

    if (page == MENU) {
        if (st != 0) {
            sel = wrap(sel + st, ROWS);
            click();
        }
        if (ok || back) {
            sfx(SFX.tick);
            if (sel == 0)
                return levels.next();
            if (sel == 1) {
                page = PICK;
                pick = levels.next();
            } else if (sel == 2) {
                page = HELP;
            } else {
                score.show(BOARD.points);
            }
        }
    } else if (page == PICK) {
        if (st != 0) {
            pick = wrap(pick + st, levels.COUNT);
            click();
        }
        if (ok) {
            if (pick < levels.unlocked)
                return pick;
            sfx(SFX.warn);
        }
        if (back) {
            sfx(SFX.tick);
            page = MENU;
        }
    } else {
        if (ok || back) {
            sfx(SFX.tick);
            page = MENU;
        }
    }
    return -1;
}

// ---- drawing -------------------------------------------------------------------

function draw() {
    palt(0, false);
    if (page == MENU) {
        blit(picMenu, 0, 0);
        palt(0, true);
        sprites.draw(ds, dx, dy, shown);
        row(sel, true);
    } else if (page == PICK) {
        drawPick();
        palt(0, true);
    } else {
        blit(picHelp, 0, 0);
        palt(0, true);
    }
}

// The chain rolls round the spiral behind the menu. Balls the menu would
// cover are left out.
function demo() {
    roll += 1.4;
    if (roll >= chain.L)
        roll -= chain.L;
    var px = chain.PX, py = chain.PY;
    var m = 0, len = chain.L;
    for (var i = 0; i < DEMO; i++) {
        var sv = roll + i * 7.0;
        if (sv >= len)
            sv -= len;
        var k = flr(sv);
        var x = px[k], y = py[k];
        if (k < 8 || y > 101 || (x > 29 && x < 131))
            continue;
        dx[m] = x - 3;
        dy[m] = y - 3;
        ds[m] = 1 + (i / 3 + i / 10) % 5;
        m++;
    }
    shown = m;
}

// The menu's page, without the chain and the highlighted row
function drawMenu() {
    palt(0, false);
    blit(IMG.bg1, 0, 0);
    palt(0, true);

    // the name
    rectfill(34, 4, 125, 40, 0);
    rect(34, 4, 125, 40, 13);
    font(FONT.CAPS, 2);
    var w = textw("MARBLE");
    print("MARBLE", 81 - w / 2, 8, 0);
    print("MARBLE", 80 - w / 2, 7, 10);
    w = textw("CHAIN");
    print("CHAIN", 81 - w / 2, 24, 0);
    print("CHAIN", 80 - w / 2, 23, 14);
    font(FONT.CAPS);

    // the menu
    rectfill(32, 46, 127, 99, 0);
    rect(32, 46, 127, 99, 13);
    for (var i = 0; i < ROWS; i++)
        row(i, false);

    rectfill(0, 104, 159, 119, 0);
    centre("WHEEL: MOVE  SELECT: OK", 106, 13);
    print("V0.2", 2, 112, 5);
    print("CYBERDELIA", 158 - textw("CYBERDELIA"), 112, 5);
}

// One row of the menu
function row(i, on) {
    var label = ITEMS[i];
    if (i == 0 && levels.unlocked > 1)
        label = "CONTINUE LEVEL " + (levels.next() + 1);
    var y = 52 + i * 11;
    if (on) {
        rectfill(35, y - 2, 124, y + 7, 1);
        centre(label, y, 10);
        print(">", 38, y, 10);
        print("<", 119, y, 10);
    } else {
        centre(label, y, 6);
    }
}

function drawPick() {
    rectfill(0, 0, 159, 119, 1);
    centre("SELECT LEVEL", 3, 10);
    for (var i = 0; i < levels.COUNT; i++) {
        var x = 7 + (i % 3) * 50, y = 13 + (i / 3) * 44;
        var open = i < levels.unlocked;
        blit(thumbs[levels.ROUTE[i]], x + 5, y + 3);
        if (!open) {
            rectfill(x + 5, y + 3, x + 40, y + 29, 0);
            centreAt("LOCKED", x + 23, y + 13, 5);
        }
        rect(x, y, x + 45, y + 39, i == pick ? 10 : 5);
        print("" + (i + 1), x + 3, y + 31, open ? 7 : 5);
        if (levels.best[i] > 0) {
            var b = "" + levels.best[i];
            print(b, x + 43 - textw(b), y + 31, 11);
        }
    }
    var l = "LEVEL " + (pick + 1) + "  " + levels.LABEL[pick];
    centre(l, 103, 7);
    centre("SELECT: START  PLAY: BACK", 112, 13);
}

function drawHelp() {
    rectfill(0, 0, 159, 119, 1);
    centre("HOW TO PLAY", 3, 10);
    var lines = ["REST YOUR THUMB ON THE WHEEL:",
                 "THE GUN AIMS WHERE IT IS.",
                 "SELECT SHOOTS. HOLD IT, OR PRESS",
                 "PLAY, TO SWAP THE TWO BALLS.",
                 "THREE OR MORE OF A COLOUR POP.",
                 "MATCHING GAPS CLOSE: CHAINS!",
                 "KEEP THE CHAIN OUT OF THE HOLE."];
    for (var i = 0; i < 7; i++)
        print(lines[i], 8, 14 + i * 8, i < 2 ? 7 : 6);
    // the power-ups
    print("POWER-UP BALLS:", 8, 74, 10);
    var names = ["SLOW: THE CHAIN CRAWLS", "BACK: THE CHAIN ROLLS BACK", "BOMB: POPS THE BALLS AROUND"];
    for (var i = 0; i < 3; i++) {
        spr(2, 10, 84 + i * 9);
        spr(25 + i, 10, 84 + i * 9);
        print(names[i], 22, 84 + i * 9, 6);
    }
    centre("SELECT: BACK", 112, 13);
}
