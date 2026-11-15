// hud: what there is on screen over the picture. The hole, its par and the
// stroke at the top left; the pin's distance and the wind at the top
// right; the club and the lie at the bottom, the swing meter over them;
// the hole from above when Play shows it; a word or two when something
// happens; the panel before a hole and the scorecard after.
//
// What is said is kept as a fixed text and a number, never as text put
// together, which would stay in memory.

const PLAIN = 0, YDS = 1, PENALTY = 2, STROKES = 3;   // how a number is said
const MX = 38, MW = 100;           // the meter: the line's x, and its length to full
const MY = 101;                    // its top row
const MAP_X = 99;                  // where the hole's map goes
const OVS = 0.46875;               // the map's scale: 60 / 128

var said = "", said2 = "";
var sayN = 0, sayForm = PLAIN, sayFor = 0, sayC = 7;
var ov;                            // the hole from above, 60 by 120
var fps = 25, late = 0, counted = 0;

// Once: the map's image
function setup() {
    ov = img(60, 120);
}

// The hole's map, from its colours: once a hole, as it costs thousands
function mapHole() {
    target(ov);
    sheet(course.colours);
    sspr(0, 0, 128, 256, 0, 0, 60, 120);
    sheet();
    target(SCREEN);
}

// Words in the middle of the screen for ticks: a big word, and a line
// under it with a number in a form
function say(big, line, n, form, ticks, c) {
    said = big;
    said2 = line;
    sayN = n;
    sayForm = form;
    sayFor = ticks;
    sayC = c;
}

// Once a tick: the words run their time, the frame rate is counted
function update() {
    if (sayFor > 0)
        sayFor--;
    late += skipped();
    counted++;
    if (counted >= 25) {
        fps = max(0, 25 - late);
        late = 0;
        counted = 0;
    }
}

// Everything over the picture for the scene
function draw() {
    if (scene == INTRO) {
        intro();
        return;
    }
    if (scene == CARD) {
        card();
        return;
    }
    top();
    if (scene == AIM) {
        bottom();
        meter();
    }
    if (showMap && (scene == AIM || scene == FLIGHT))
        overview();
    words();
    if (stats)
        shadow(fps + "/S", 2, 92, 13);
}

// The hole, the stroke, the pin and the wind
function top() {
    shadow("HOLE " + (holeN + 1), 2, 2, 7);
    shadow("PAR " + course.par[course.cur], 34, 2, 6);
    // the stroke being played: the next while aiming
    shadow("STROKE " + (scene == AIM ? strokes + 1 : max(1, strokes)), 2, 9, 7);
    if (showMap && (scene == AIM || scene == FLIGHT))
        return;
    var t = pinYds + " YDS";
    shadow(t, 158 - textw(t), 2, 10);
    if (windMph == 0) {
        shadow("CALM", 142, 9, 6);
        return;
    }
    t = windMph + " MPH";
    var w = textw(t);
    shadow(t, 158 - w, 9, 7);
    arrow(150 - w, 11, windA, 7);
}

// An arrow at x, y showing world heading a as seen from the camera
function arrow(x, y, a, c) {
    var r = a - view.camH;
    var dx = sin(r) * 3.5, dy = (0.0 - cos(r)) * 3.5;
    line(x - dx + 1, y - dy + 1, x + dx + 1, y + dy + 1, 1);
    circfill(x + dx + 1, y + dy + 1, 1, 1);
    line(x - dx, y - dy, x + dx, y + dy, c);
    circfill(x + dx, y + dy, 1, c);
}

// The club and how far it carries, and the lie
function bottom() {
    var c = swing.club;
    if (c == swing.PUTTER) {
        shadow("PUTTER", 2, 112, 7);
    } else {
        shadow(swing.NAMES[c], 2, 112, 7);
        shadow("" + swing.reach(c, lie), 6 + textw(swing.NAMES[c]), 112, 10);
    }
    var t = course.SURF_NAMES[lie];
    var w = textw(t);
    shadow(t, 158 - w, 112, lie == course.SAND || lie == course.DEEP ? 9 : 11);
    if (lie == course.GREEN || lie == course.FRINGE) {
        // which way the green falls
        var sx = course.slopeX[course.cur], sy = course.slopeY[course.cur];
        arrow(150 - w, 114, atan2(0.0 - sx, 0.0 - sy), 6);
    }
}

// The swing meter: the line, the sweet spot, the power and the marker
function meter() {
    rectfill(MX - 17, MY, MX + MW + 2, MY + 7, 1);
    rect(MX - 17, MY, MX + MW + 2, MY + 7, 13);
    rectfill(MX - 2, MY + 1, MX + 2, MY + 6, 3);
    var p = swing.phase;
    if (p == swing.UP)
        rectfill(MX, MY + 2, MX + swing.pos * MW, MY + 5, 66);
    else if (p == swing.DOWN || p == swing.DONE)
        rectfill(MX, MY + 2, MX + swing.power * MW, MY + 5, 67);
    line(MX, MY, MX, MY + 7, 7);
    if (swing.club == swing.PUTTER) {
        var m = MX + flr(swing.mark * MW);
        line(m, MY - 2, m, MY + 9, 62);
    } else {
        for (var i = 1; i < 4; i++)
            pset(MX + i * MW / 4, MY + 6, 13);
    }
    if (p != swing.IDLE) {
        var x = MX + flr(swing.pos * MW);
        line(x, MY - 2, x, MY + 9, 10);
    }
}

// The hole from above, the pin, the ball and where the aim points
function overview() {
    palt(0, false);
    blit(ov, MAP_X, 0);
    palt(0, true);
    rect(MAP_X - 1, -1, MAP_X + 60, 120, 1);
    var bx = MAP_X + ball.x * OVS, by = ball.y * OVS;
    if (scene == AIM && swing.club != swing.PUTTER) {
        var d = swing.reach(swing.club, lie) / course.YARDS * OVS;
        line(bx, by, bx + cos(aimA) * d, by + sin(aimA) * d, 10);
    }
    var fx = MAP_X + course.pinX[course.cur] * OVS, fy = course.pinY[course.cur] * OVS;
    line(fx, fy, fx, fy - 4, 7);
    rectfill(fx + 1, fy - 4, fx + 3, fy - 3, 62);
    circfill(bx, by, 1, 7);
}

// The words said, if any: big, and a line under
function words() {
    if (sayFor <= 0)
        return;
    if (said != "") {
        font(FONT.CAPS, 2);
        shadow(said, 80 - textw(said) / 2, 34, sayC);
        font(FONT.CAPS);
    }
    if (said2 == "" && sayForm == PLAIN)
        return;
    if (sayForm == YDS) {
        var w = textw(said2) + textw(" " + sayN + " YDS");
        shadow(said2 + " " + sayN + " YDS", 80 - w / 2, 50, 7);
    } else if (sayForm == PENALTY) {
        shadow(said2, 80 - textw(said2) / 2, 50, 7);
    } else if (sayForm == STROKES) {
        var t = sayN == 1 ? " STROKE" : " STROKES";
        shadow(sayN + t, 80 - textw(sayN + t) / 2, 50, 7);
    } else {
        shadow(said2, 80 - textw(said2) / 2, 50, 7);
    }
}

// Before a hole: its number, par and length, its best, and its map
function intro() {
    rectfill(4, 20, 92, 98, 1);
    rect(4, 20, 92, 98, 13);
    var j = course.cur;
    font(FONT.CAPS, 2);
    shadow("HOLE " + (holeN + 1), 10, 26, 10);
    font(FONT.CAPS);
    shadow("PAR " + course.par[j], 10, 44, 7);
    shadow(course.yards[j] + " YARDS", 10, 53, 7);
    if (windMph == 0)
        shadow("NO WIND", 10, 62, 6);
    else
        shadow("WIND " + windMph + " MPH", 10, 62, 6);
    var b = flr(dget(R_HOLE + holeN));
    if (b > 0)
        shadow("BEST " + b, 10, 71, 13);
    shadow(practice ? "PRACTICE" : course.names[0], 10, 88, 13);
    palt(0, false);
    blit(ov, MAP_X, 0);
    palt(0, true);
    rect(MAP_X - 1, -1, MAP_X + 60, 120, 1);
    var fx = MAP_X + course.pinX[j] * OVS, fy = course.pinY[j] * OVS;
    line(fx, fy, fx, fy - 4, 7);
    rectfill(fx + 1, fy - 4, fx + 3, fy - 3, 62);
    circfill(MAP_X + ball.x * OVS, ball.y * OVS, 1, 7);
}

// The scorecard: the nine holes' par and score, the total against par
function card() {
    rectfill(2, 18, 157, 104, 1);
    rect(2, 18, 157, 104, 13);
    var t = finished ? "ROUND OVER" : "SCORECARD";
    shadow(t, 80 - textw(t) / 2, 23, 10);
    shadow("HOLE", 6, 36, 13);
    shadow("PAR", 6, 46, 13);
    shadow("SCORE", 6, 56, 13);
    var pars = 0, sum = 0, played = 0;
    for (var i = 0; i < course.HOLES; i++) {
        var x = 32 + i * 12;
        shadow("" + (i + 1), x, 36, 13);
        var p = course.par[i];
        shadow("" + p, x, 46, 6);
        var s = scores[i];
        if (s > 0) {
            shadow("" + s, x, 56, s < p ? 10 : s == p ? 7 : 8);
            pars += p;
            sum += s;
            played++;
        }
    }
    shadow("TOT", 140, 36, 13);
    shadow("" + course.parSum, 140, 46, 6);
    if (played > 0)
        shadow("" + sum, 140, 56, 7);
    var d = sum - pars;
    t = d == 0 ? "LEVEL PAR" : d < 0 ? (0 - d) + " UNDER PAR" : d + " OVER PAR";
    if (played > 0)
        shadow(t, 80 - textw(t) / 2, 70, d < 0 ? 10 : d == 0 ? 7 : 8);
    if (finished) {
        t = newBest ? "YOUR BEST ROUND YET!" : boardRank > 0 ? "NUMBER " + boardRank + " ON THE BOARD" : "BEST ROUND " + flr(dget(R_BEST));
        shadow(t, 80 - textw(t) / 2, 80, newBest || boardRank == 1 ? 10 : 7);
    }
    t = "SELECT: GO ON";
    shadow(t, 80 - textw(t) / 2, 94, 6);
}

// Text with a dark shadow down and right, to read over the grass
function shadow(s, x, y, c) {
    print(s, x + 1, y + 1, 1);
    print(s, x, y, c);
}
