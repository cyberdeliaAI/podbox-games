// tube: the tunnel. Its colours, the projection everything is drawn
// through, and the rings and spokes.
//
// A place in the tunnel is an angle round its wall, in turns (0 right,
// 0.25 up), and a depth, in beats: 0 is the near rim where the ship
// flies, 1 is the ring that passes it on the next beat. A depth d is drawn
// at scale s = 1 / (1 + d * K), round a centre that leans toward offX,
// offY as s falls. The lean is linear in s, so every point at one angle
// lies on one straight line: a spoke is a single line.

const CX = 80, CY = 60;            // the near rim's centre
const RX = 74.0, RY = 57.0;        // the near rim's radii
const K = 0.55;                    // how fast the tunnel narrows, a beat
const VIEW = 7;                    // beats seen ahead
const STEPS = 48;                  // the circle table
const SPOKES = 6;

// Palette entries, made from the playing album's colours
const BG = 16, RING0 = 17, ACCENT = 23, CORE = 24, FOE = 25, FOE_DIM = 26;
const SPOKE = 27, LANE = 28;

const DEFAULT_HUE = 0x2f9cf0;      // blue, with no music to take a colour from

var COS = new FixArray(STEPS), SIN = new FixArray(STEPS);
var TONES = [15, 22, 30, 40, 52, 66];

var offX = 0.0, offY = 0.0;        // the lean at the far end
var px = 0.0, py = 0.0, ps = 0.0;  // project()'s answer
var hue = DEFAULT_HUE;
var foeHue = 0;
var bgBase = 0;
var bgFlash = 0;                   // ticks of a bright background left
var pulse = 0;                     // ticks of a beat's flash left
var strongPulse = false;
var cols = new Int32Array(3);
var job = 99;                      // the next palette entry to work out

function setup() {
    for (var i = 0; i < STEPS; i++) {
        COS[i] = cos(i / 48.0);
        SIN[i] = sin(i / 48.0);
    }
    colours(DEFAULT_HUE);
    while (job < 99)
        colourStep();
}

// ---- colours -----------------------------------------------------------------

// The tunnel's shades from one vivid colour; the enemies take the
// opposite hue, so they stand out from the tunnel whatever the album.
// Each shade costs about a thousand units to work out, so they are worked
// out one a tick: the tunnel takes on a new album's colour over half a
// second.
function colours(v) {
    hue = v;
    job = 0;
}

function colourStep() {
    if (job >= 99)
        return;
    var v = hue;
    if (job == 0) {
        bgBase = color.toned(v, 5);
        setpal(BG, bgBase);
    } else if (job <= 6) {
        setpal(RING0 + job - 1, color.toned(v, TONES[job - 1]));
    } else if (job == 7) {
        setpal(ACCENT, color.toned(v, 90));
    } else if (job == 8) {
        setpal(CORE, color.toned(v, 78));
    } else if (job == 9) {
        setpal(SPOKE, color.toned(v, 18));
    } else if (job == 10) {
        setpal(LANE, color.toned(v, 34));
    } else if (job == 11) {
        foeHue = color.turn(v, 0.5);
    } else if (job == 12) {
        setpal(FOE, color.toned(foeHue, 72));
    } else {
        setpal(FOE_DIM, color.toned(foeHue, 42));
        job = 99;
        return;
    }
    job++;
}

// The playing album's most vivid colour, or the default where it is grey
// or there is no music
function fromMusic() {
    var v = DEFAULT_HUE;
    if (playback.playing()) {
        playback.colors(cols);
        var c = cols[2];
        var r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
        var hi = max(r, max(g, b)), lo = min(r, min(g, b));
        if (hi - lo >= 70)
            v = c;
    }
    if (v != hue)
        colours(v);
}

function flash(ticks) {
    bgFlash = ticks;
}

function beatPulse(strong) {
    pulse = 4;
    strongPulse = strong;
}

// A colour f twelfths of the way to white
function whiter(c, f) {
    var r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    r += (255 - r) * f / 12;
    g += (255 - g) * f / 12;
    b += (255 - b) * f / 12;
    return (r << 16) | (g << 8) | b;
}

// Once a tick: the flashes fade, and the palette moves on
function step() {
    if (pulse > 0)
        pulse--;
    if (bgFlash > 0) {
        bgFlash--;
        setpal(BG, whiter(bgBase, min(12, bgFlash)));
    }
    colourStep();
}

// Where the far end leans: away from the ship, and wandering slowly
function lean(shipA, gt) {
    var w1 = (gt % 9000) / 9000.0, w2 = (gt % 6700) / 6700.0;
    offX = -cos(shipA) * 9.0 + sin(w1) * 10.0;
    offY = -sin(shipA) * 6.0 + cos(w2) * 6.0;
}

// ---- the projection ----------------------------------------------------------

function scaleAt(d) {
    return 1.0 / (1.0 + d * K);
}

// The screen point of angle a at depth d, rr of the way out to the wall:
// into px, py, with the scale in ps
function project(a, d, rr) {
    var s = 1.0 / (1.0 + d * K);
    var k = 1.0 - s;
    ps = s;
    px = CX + offX * k + cos(a) * RX * s * rr;
    py = CY + offY * k + sin(a) * RY * s * rr;
}

// ---- drawing -----------------------------------------------------------------

// The rings, one a beat, from the one just passed to the far end; a bar's
// first beat in the accent colour
function draw(gt, anchor, beatMs, curBeat, barRes) {
    var bm = beatMs * 1.0;
    var far = 1.0 / (1.0 + (VIEW + 0.6) * K);
    var fk = 1.0 - far;
    var fx = CX + offX * fk, fy = CY + offY * fk;
    var frx = RX * far, fry = RY * far;

    // spokes, from the rim to the far end
    for (var j = 3; j < STEPS; j += STEPS / SPOKES)
        line(CX + COS[j] * RX, CY + SIN[j] * RY, fx + COS[j] * frx, fy + SIN[j] * fry, SPOKE);

    // the next ring's depth; each after it is one deeper
    var d0 = (anchor + (curBeat + 1) * beatMs - gt) / bm;
    var bar0 = (curBeat + 1 - barRes) & 3;
    for (var j = VIEW - 1; j >= 0; j--) {
        var d = d0 + j;
        if (d < 0.08)
            continue;
        var s = 1.0 / (1.0 + d * K), k = 1.0 - s;
        var cx = CX + offX * k, cy = CY + offY * k;
        var rx = RX * s, ry = RY * s;
        var c = ((bar0 + j) & 3) == 0 && j < VIEW - 1 ? ACCENT : RING0 + 5 - min(5, flr(d * 0.86));
        oval(cx - rx, cy - ry, cx + rx, cy + ry, c);
    }

    // the rim the ship flies on, lit as each beat passes it
    oval(CX - RX, CY - RY, CX + RX, CY + RY, pulse > 0 ? (strongPulse ? ACCENT : RING0 + 5) : RING0 + 2);

    // the far end: a core that swells on the beat
    var r = 2 + (pulse > 0 ? (strongPulse ? 3 : 2) : 0);
    circfill(fx, fy, r + 2, RING0 + 1);
    circfill(fx, fy, r, CORE);
}
