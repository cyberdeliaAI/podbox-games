// hud: the instruments over the view. In the chase view a compass strip
// along the top and the height and speed in its corners; in the cockpit a
// panel along the bottom with the same and a bank indicator. Messages in
// the middle, and the frame rate when the option asks for it.

var CARDS = ["E", "N", "W", "S"];  // at headings 0, 0.25, 0.5, 0.75

// The compass strip: ticks every 30 degrees, letters at the four points
function compass(y) {
    var h = flight.hdg;
    for (var i = 0; i < 12; i++) {
        var a = i / 12.0;
        var d = a - h;
        d -= flr(d + 0.5);                     // -0.5 to 0.5
        if (d < -0.15 || d > 0.15)
            continue;
        var sx = 80 - flr(d * 160.0 / view.FOV);
        if (i % 3 == 0)
            print(CARDS[i / 3], sx - 1, y, 7);
        else
            pset(sx, y + 2, 6);
    }
    pset(80, y + 7, 10);
}

function draw() {
    if (view.chase) {
        compass(2);
        shadow("ALT " + metres(), 3, 3, 7);
        var s = "" + knots() + " KT";
        shadow(s, 156 - textw(s), 3, 7);
    } else {
        cockpit();
    }
    if (flight.low && (frame() & 8) != 0)
        shadow("LOW", 74, view.chase ? 100 : 82, 10);
    if (frame() < msgUntil)
        shadow(msg, 80 - textw(msg) / 2, 40, 7);
    if (stats) {
        var t = "Q" + quality.level + " " + rate() + "/S";
        shadow(t, 156 - textw(t), 12, 13);
    }
}

// The panel along the bottom, in the cockpit view
function cockpit() {
    rectfill(0, 96, 159, 119, 5);
    line(0, 96, 159, 96, 13);
    // the bank: a line through a round dial that tips with the wings
    circfill(80, 108, 10, 1);
    var b = flight.bank * 0.09;
    var dx = cos(b) * 8.0, dy = sin(b) * 8.0;
    line(80 - dx, 108 + dy, 80 + dx, 108 - dy, 10);
    pset(80, 108, 7);
    print("ALT", 8, 101, 13);
    print("" + metres(), 8, 109, 7);
    print("KT", 132, 101, 13);
    print("" + knots(), 132, 109, 7);
    var c = "" + flight.compass();
    print("HDG", 104, 101, 13);
    print(c, 104, 109, 7);
    compass(2);
}

// Height above the water, as metres: a world pixel is ten
function metres() {
    return max(0, flr((flight.z - world.water) * 10.0));
}

function knots() {
    return flr(flight.spd * 200.0);
}

function shadow(s, x, y, c) {
    print(s, x + 1, y + 1, 1);
    print(s, x, y, c);
}
