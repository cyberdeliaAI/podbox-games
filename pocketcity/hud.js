// hud: the numbers over the city, the messages, the arrow to where the
// player should go, and the city map.
//
// Messages wait in a queue of two: a job done and the news of the next
// district's work, say. A message is a fixed text (a literal, or a name
// read from the data once) and a number with a form: money, a district's
// name, a count. They are put together only as they are printed, so
// nothing made in play is kept.
//
// The arrow points from the edge of the screen to the next phone box, or
// to a job's next place, while it is out of sight.

const PLAIN = 0, BIG = 1, MONEY = 2, PLACE = 3, COUNT = 4;   // message forms
const SAY_TICKS = 75;

var saying = "", sayN = 0, sayForm = 0, sayOf = 0, sayFor = 0;
var next = "", nextN = 0, nextForm = 0, nextOf = 0, queued = false;

// A message: text s with number n in form f (of: the count's whole)
function say(s, n, f, of) {
    if (sayFor > SAY_TICKS - 30 && !queued) {
        next = s;
        nextN = n;
        nextForm = f;
        nextOf = of;
        queued = true;
        return;
    }
    saying = s;
    sayN = n;
    sayForm = f;
    sayOf = of;
    sayFor = SAY_TICKS;
}

// Nothing to say: for a new game
function quiet() {
    sayFor = 0;
    queued = false;
}

// Once a tick
function update() {
    if (sayFor > 0)
        sayFor--;
    if (sayFor == 0 && queued) {
        queued = false;
        saying = next;
        sayN = nextN;
        sayForm = nextForm;
        sayOf = nextOf;
        sayFor = SAY_TICKS;
    }
}

// The numbers over the drive
function draw() {
    shadow("$" + cash, 3, 3, 10);
    // the stars, while there is heat, the lit ones flashing while the
    // police can see you
    if (police.heat > 0) {
        sheet(IMG.people);
        for (var i = 0; i < 3; i++) {
            var lit = 2 - i < police.stars;
            if (lit && police.seen && (frame() >> 2) % 2 == 0)
                lit = false;
            spr(lit ? 16 : 17, 148 - i * 9, 2);
        }
        sheet();
    }
    if (player.inCar) {
        var s = car.kmh() + " KM/H";
        shadow(s, 157 - textw(s), 112, 7);
    }
    if (jobs.active >= 0)
        job();
    if (jobs.aim)
        arrow(jobs.ax - view.cx, jobs.ay - view.cy, jobs.active >= 0 ? 8 : 10);
    if (sayFor > 0)
        message();
    if (stats) {
        var t = rate() + "/S";
        shadow(t, 3, 112, 13);
    }
}

// The job's clock and what to do now
function job() {
    var j = jobs.active;
    var secs = flr((jobs.left + 999) / 1000);
    var m = flr(secs / 60), s = secs % 60;
    var c = secs <= 10 && (frame() >> 3) % 2 == 0 ? 8 : 7;
    var t = m + (s < 10 ? ":0" : ":") + s;
    shadow(t, 80 - textw(t) / 2, 3, c);
    var kind = jobs.jt[j], st = jobs.stage;
    var p = jobs.j0[j] + st;
    var y = 104;
    if (kind == jobs.DELIVER) {
        if (st == 0)
            centre("PICK UP THE PARCEL", y, 9);
        else
            place("DELIVER IT TO ", jobs.qx[p], jobs.qy[p], y);
    } else if (kind == jobs.TAXI) {
        if (st == 0)
            centre("STOP BY THE FARE", y, 9);
        else
            place("DRIVE THEM TO ", jobs.qx[p], jobs.qy[p], y);
    } else if (kind == jobs.TRIAL) {
        centre("CHECKPOINT " + (st + 1) + " OF " + jobs.jn[j], y, 9);
    } else {
        centre("RAM THE GETAWAY CAR " + jobs.hits + "/" + jobs.HITS, y, 9);
    }
}

// Text s and the name of the district at px, py, centred on row y
function place(s, px, py, y) {
    var d = jobs.districtAt(px, py);
    if (d < 0)
        d = 0;
    var w = textw(s) + textw(jobs.names[d]);
    var x = 80 - w / 2;
    shadow(s, x, y, 9);
    shadow(jobs.names[d], x + textw(s), y, 10);
}

// The message, in the middle
function message() {
    var y = 26;
    if (sayForm == BIG) {
        font(FONT.CAPS, 2);
        shadow(saying, 80 - textw(saying) / 2, 20, 10);
        font(FONT.CAPS);
        return;
    }
    if (sayForm == PLAIN) {
        centre(saying, y, 10);
    } else if (sayForm == MONEY) {
        var w = textw(saying) + 4 + textw("+$" + sayN);
        shadow(saying, 80 - w / 2, y, 10);
        shadow("+$" + sayN, 80 - w / 2 + textw(saying) + 4, y, 11);
    } else if (sayForm == PLACE) {
        var w = textw(saying) + 4 + textw(jobs.names[sayN]);
        shadow(saying, 80 - w / 2, y, 10);
        shadow(jobs.names[sayN], 80 - w / 2 + textw(saying) + 4, y, 9);
    } else {
        centre(saying + " " + sayN + " OF " + sayOf, y, 10);
    }
}

// An arrow at the screen's edge toward sx, sy (screen pixels), when that
// is off the screen
function arrow(sx, sy, c) {
    if (sx > 4 && sx < 156 && sy > 4 && sy < 116)
        return;
    var a = atan2(sx - 80, sy - 60);
    var ca = cos(a), sa = sin(a);
    var ex = 80 + ca * 66, ey = 58 + sa * 46;
    trifill(ex + ca * 6, ey + sa * 6,
            ex + cos(a + 0.35) * 5, ey + sin(a + 0.35) * 5,
            ex + cos(a - 0.35) * 5, ey + sin(a - 0.35) * 5, c);
    pset(flr(ex + ca * 6), flr(ey + sa * 6), 7);
}

// Text centred on row y
function centre(s, y, c) {
    shadow(s, 80 - textw(s) / 2, y, c);
}

// Text with a dark shadow down and right
function shadow(s, x, y, c) {
    print(s, x + 1, y + 1, 1);
    print(s, x, y, c);
}

// ---- the city map ----------------------------------------------------------------

// The whole city at a pixel for two cells: the player, the next phone box
// or the job's place, and the paint shops
function drawMap() {
    cls(1);
    palt(0, false);
    blit(IMG.citymap, 16, -4);
    palt(0, true);
    for (var i = 0; i < jobs.DISTRICTS; i++)
        rectfill(16 + jobs.spx[i] / 16 - 1, jobs.spy[i] / 16 - 5, 16 + jobs.spx[i] / 16 + 1, jobs.spy[i] / 16 - 3, 11);
    if (jobs.aim) {
        var r = 2 + (frame() >> 3) % 2;
        circfill(16 + jobs.ax / 16, jobs.ay / 16 - 4, r, jobs.active >= 0 ? 8 : 10);
    }
    if ((frame() >> 3) % 2 == 0) {
        var px = 16 + flr(player.px()) / 16, py = flr(player.py()) / 16 - 4;
        rectfill(px - 1, py - 1, px + 1, py + 1, 7);
    }
    print("YOU", 3, 3, 7);
    print("JOB", 3, 11, 10);
    print("PAINT", 3, 19, 11);
    var s = "JOBS " + jobs.done + "/" + jobs.JOBS;
    print(s, 157 - textw(s), 3, 7);
    s = "TAPES " + jobs.tapes() + "/" + jobs.TAPES;
    print(s, 157 - textw(s), 11, 7);
    print("SELECT: BACK", 3, 112, 13);
}
