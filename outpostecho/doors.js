// doors: one panel per corridor cell. Render and collision are separate
// sprite flags, so the engine can draw a fully open panel in an empty cell.
// Closing waits until neither the player nor a robot occupies the doorway.
const MAX = 8;
var n = 0;
var source;
var render = new FixArray(MAX * 3);
var opening = new FixArray(MAX);
var want = new Uint8Array(MAX), revealed = new Uint8Array(MAX);
var closedTile = new Uint8Array(MAX);

// Reset the fixed door pool from the sector data.
function load(list) {
    source = list;
    n = list.length;
    fill(render, -1.0);
    fill(opening, 0.0);
    fill(want, 0);
    fill(revealed, 0);
    for (var i = 0; i < n; i++) {
        var d = list[i];
        render[i * 3] = d.x;
        render[i * 3 + 1] = d.y;
        render[i * 3 + 2] = 0.0;
        closedTile[i] = mget(d.x, d.y);
    }
}

// Open ordinary, powered, security or discovered secret panels.
function interact() {
    for (var i = 0; i < n; i++) {
        var d = source[i];
        if (d.secret != 0 && revealed[i] == 0)
            continue;
        if (!station.aimed(d.x * 8 + 4, d.y * 8 + 4))
            continue;
        if (d.lock == 1 && !station.card) {
            announce("SECURITY PANEL: PASS REQUIRED");
        } else if (d.lock == 2 && !station.power) {
            announce("POWERED DOOR: BUS OFFLINE");
        } else {
            want[i] = want[i] == 0 ? 1 : 0;
            sound(180, 4);
        }
        return true;
    }
    return false;
}

// Test occupancy conservatively before restoring a solid map cell.
function occupied(i) {
    var x = source[i].x * 8 + 4, y = source[i].y * 8 + 4;
    return (abs(player.cx() - x) < 5.5 && abs(player.cy() - y) < 5.5) || robots.blocks(x, y);
}

// Animate by real time and keep collision synchronized with the panel.
function update(k) {
    for (var i = 0; i < n; i++) {
        if (want[i] == 0 && opening[i] > 0.0 && occupied(i))
            want[i] = 1;
        if (want[i] != 0)
            opening[i] = min(1.0, opening[i] + 0.12 * k);
        else
            opening[i] = max(0.0, opening[i] - 0.12 * k);
        render[i * 3 + 2] = opening[i];
        var d = source[i];
        mset(d.x, d.y, opening[i] >= 0.98 ? 10 : closedTile[i]);
    }
}
