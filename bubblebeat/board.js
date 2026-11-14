// board: the bubbles on their hex grid.
//
// The grid is kept doubled: each bubble takes two cells side by side of a
// board BW cells wide, and odd rows sit one cell to the right. Joined
// across and down, the way grid.region and grid.fill join cells, a bubble
// then touches exactly its six neighbours on the hex grid. So the engine
// finds a colour's group and what still hangs from the ceiling, rather
// than loops in script. Board row 0 is the ceiling, solid all the way
// across; bubble row r is board row r + 1, and the last board row stays
// empty so a look below the bottom row finds nothing.
//
// col holds each cell's colour (1 to 8, CEIL for the ceiling) and occ a 1
// for anything there. They only change together, in put() and take().
// The ceiling comes down a row at a time (drop); the bubbles hang from it,
// so their rows keep their numbers and only their place on the screen moves.

const COLS = 12;                   // bubbles in an even row; odd rows hold 11
const ROWS = 14;                   // rows the grid has room for
const BW = 24, BH = 16;            // the doubled board
const CEIL = 15;                   // the ceiling's value in col
const FX = 32;                     // the field's left edge, pixels
const TOP = 6;                     // y of the ceiling's lower edge before it drops
const PX = 8, PY = 7;              // pixels between bubbles across and down
const LINE = 98;                   // a bubble whose centre is lower than this is over the line
const REACH2 = 44.0;               // a shot this close to a bubble's centre, squared, touches it

var col = new Uint8Array(BW * BH);
var occ = new Uint8Array(BW * BH);
var tmp = new Uint8Array(BW * BH);
var found = new Int32Array(BW * BH);
var foundN = 0;                    // cells group() put in found
var counts = new Int32Array(9);    // bubbles of each colour
var rowN = new Int32Array(ROWS);   // bubbles in each row
var low = -1;                      // the lowest row with a bubble in it, -1 for none
var total = 0;
var drop = 0;                      // rows the ceiling has come down

// for drawing
var xs = new Int32Array(COLS * ROWS), ys = new Int32Array(COLS * ROWS);
var sp = new Uint8Array(COLS * ROWS);

// ---- the grid ------------------------------------------------------------------

// No bubbles, under a raised ceiling
function clear() {
    fill(col, 0);
    fill(occ, 0);
    fill(col, CEIL, 0, BW);
    fill(occ, 1, 0, BW);
    fill(counts, 0);
    fill(rowN, 0);
    low = -1;
    total = 0;
    drop = 0;
}

// Bubbles in row r
function width(r) {
    return COLS - (r & 1);
}

// The board index of the first of bubble r, c's two cells
function cell(r, c) {
    return (r + 1) * BW + c * 2 + (r & 1);
}

// The colour at r, c, 0 for none
function at(r, c) {
    return col[(r + 1) * BW + c * 2 + (r & 1)];
}

// The centre of r, c on the screen
function cx(r, c) {
    return FX + 4 + c * PX + (r & 1) * 4;
}

function cy(r) {
    return TOP + 4 + (drop + r) * PY;
}

// The y of the ceiling's lower edge
function top() {
    return TOP + drop * PY;
}

function put(r, c, v) {
    var i = cell(r, c);
    col[i] = v;
    col[i + 1] = v;
    occ[i] = 1;
    occ[i + 1] = 1;
    counts[v]++;
    rowN[r]++;
    total++;
    if (r > low)
        low = r;
}

// Takes the bubble at r, c out; its colour, 0 when there was none
function take(r, c) {
    var i = cell(r, c);
    var v = col[i];
    if (v == 0)
        return 0;
    col[i] = 0;
    col[i + 1] = 0;
    occ[i] = 0;
    occ[i + 1] = 0;
    counts[v]--;
    rowN[r]--;
    total--;
    while (low >= 0 && rowN[low] == 0)
        low--;
    return v;
}

// Whether a bubble at r, c would hang on to something: the ceiling, or a
// neighbour. The empty last board row and the empty cells at the ends of
// odd rows keep these looks from reaching anything they shouldn't.
function held(r, c) {
    if (r == 0)
        return true;
    var i = cell(r, c);
    return occ[i - 1] + occ[i + 2] + occ[i - BW] + occ[i - BW + 1] +
           occ[i + BW] + occ[i + BW + 1] > 0;
}

// The y of the lowest bubble's centre, 0 with none
function lowest() {
    return low < 0 ? 0 : cy(low);
}

// Whether colour v is still on the board
function has(v) {
    return counts[v] > 0;
}

// ---- shots ---------------------------------------------------------------------

// Whether a shot at x, y touches a bubble or the ceiling. Most of a shot's
// flight is below the lowest bubble, where there is nothing to look at.
function touches(x, y) {
    var t = top();
    if (y < t + 4.0)
        return true;
    if (low < 0 || y > t + 11.0 + low * PY)
        return false;
    var r0 = flr((y - t - 4) / 7.0 + 0.5);
    for (var r = r0 - 1; r <= r0 + 1; r++) {
        if (r < 0 || r >= ROWS || rowN[r] == 0)
            continue;
        var c0 = flr((x - FX - (r & 1) * 4) / 8.0);
        var w = width(r);
        var yr = cy(r) - y;
        for (var c = c0 - 1; c <= c0 + 1; c++) {
            if (c < 0 || c >= w || at(r, c) == 0)
                continue;
            var dx = cx(r, c) - x;
            if (dx * dx + yr * yr < REACH2)
                return true;
        }
    }
    return false;
}

// Where a shot that touched something at x, y comes to rest: the free cell
// nearest it, within span rows and columns, that would hang on to
// something. As r * 16 + c, or -1 when there is none.
function snap(x, y, span) {
    var t = top();
    var r0 = flr((y - t - 4) / 7.0 + 0.5);
    var best = -1, bd = 999.0;
    for (var r = max(0, r0 - span); r <= min(ROWS - 1, r0 + span); r++) {
        var c0 = flr((x - FX - (r & 1) * 4) / 8.0);
        var dy = cy(r) - y;
        for (var c = max(0, c0 - span); c <= min(width(r) - 1, c0 + span); c++) {
            if (at(r, c) != 0 || !held(r, c))
                continue;
            var dx = cx(r, c) - x;
            var d = dx * dx + dy * dy;
            if (d < bd) {
                bd = d;
                best = r * 16 + c;
            }
        }
    }
    return best;
}

// ---- groups and what falls -----------------------------------------------------

// The bubbles of r, c's colour joined to it; their cells go into found
function group(r, c) {
    var i = cell(r, c);
    foundN = grid.region(col, BW, i % BW, i / BW, found);
    return foundN / 2;
}

// Takes out the group group() found, handing each bubble to main.js's
// burst(); how many. A big pop or fall takes out dozens of bubbles in one
// tick, so these work from board indices directly: a bubble whose first
// cell is x across the board is centred at FX + 4 + x * 4, whatever its row.
function popGroup() {
    var n = 0, t = TOP + 4 + drop * PY;
    for (var k = 0; k < foundN; k++) {
        var j = found[k];
        if (col[j] == 0)
            continue;
        var r = j / BW - 1, x = j % BW;
        if (((x - r) & 1) != 0) {  // the bubble's second cell: go to its first
            j--;
            x--;
        }
        burst(FX + 4 + x * 4, t + r * PY, removeAt(j, r));
        n++;
    }
    lowered();
    return n;
}

// Takes out every bubble no longer hanging from the ceiling, handing each
// to main.js's fallOff() unless quiet; how many. Everything joined to the
// ceiling is filled away on a copy of occ, and whatever is left is loose.
function loose(quiet) {
    copy(tmp, 0, occ, 0, BW * BH);
    grid.fill(tmp, BW, 0, 0, 0);
    var n = 0, t = TOP + 4 + drop * PY;
    var i = tmp.indexOf(1);
    while (i >= 0) {
        var m = grid.region(tmp, BW, i % BW, i / BW, found);
        for (var k = 0; k < m; k++) {
            var j = found[k];
            if (col[j] == 0)
                continue;
            var r = j / BW - 1, x = j % BW;
            if (((x - r) & 1) != 0) {
                j--;
                x--;
            }
            var v = removeAt(j, r);
            if (!quiet)
                fallOff(FX + 4 + x * 4, t + r * PY, v);
            n++;
        }
        grid.fill(tmp, BW, i % BW, i / BW, 0);
        i = tmp.indexOf(1);
    }
    lowered();
    return n;
}

// take() for a bubble in row r whose first cell is j, leaving low to lowered()
function removeAt(j, r) {
    var v = col[j];
    col[j] = 0;
    col[j + 1] = 0;
    occ[j] = 0;
    occ[j + 1] = 0;
    counts[v]--;
    rowN[r]--;
    total--;
    return v;
}

// low again, after bubbles were taken out
function lowered() {
    while (low >= 0 && rowN[low] == 0)
        low--;
}

// ---- drawing -------------------------------------------------------------------

// Every bubble, into whatever is being drawn on; base is the first bubble
// sprite: 1 plain, 9 with the colour marks
function draw(base) {
    var m = 0, t = top();
    for (var r = 0; r < ROWS; r++) {
        if (rowN[r] == 0)
            continue;
        var y = t + r * PY, x0 = FX + (r & 1) * 4;
        var i = (r + 1) * BW + (r & 1), w = width(r);
        for (var c = 0; c < w; c++) {
            var v = col[i + c * 2];
            if (v != 0) {
                xs[m] = x0 + c * PX;
                ys[m] = y;
                sp[m] = base + v - 1;
                m++;
            }
        }
    }
    sprites.draw(sp, xs, ys, m);
}
