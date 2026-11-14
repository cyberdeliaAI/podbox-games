// Scratch-only autonomous player. It reads mission state and drives the
// same button and wheel functions as a human. The resulting input stream
// is replayed against the plain cart for performance measurements.
var mask = 0, clicks = 0, previous = 0, oldClicks = 0;
var board = new Uint8Array(48 * 38), way = new Int32Array(48 * 38);
var length = 0, at = 0, lastSector = -1, goal = -1;
var goalX = 0.0, goalY = 0.0;
var steps = 0, victories = 0;
var wantsTool = -1;

// Input shims are only substituted in a scratch copy of the cart.
function button(i) { return (mask & (1 << i)) != 0; }
function wheelInput() { return clicks; }

// A single press always has a release frame before another one.
function tap(bit) {
    if ((previous & bit) == 0)
        mask |= bit;
}

// Build a path through currently usable doors, never through locked walls.
function route() {
    for (var y = 0; y < 38; y++)
        for (var x = 0; x < 48; x++)
            board[y * 48 + x] = (fget(mget(x, y)) & FLAG.solid) != 0 ? 1 : 0;
    for (var i = 0; i < doors.n; i++) {
        var d = doors.source[i];
        if ((d.secret == 0 || doors.revealed[i] != 0) && (d.lock != 1 || station.card) && (d.lock != 2 || station.power))
            board[d.y * 48 + d.x] = 0;
    }
    length = path.find(board, 48, 0, flr(player.cx() / 8.0), flr(player.cy() / 8.0), flr(goalX / 8.0), flr(goalY / 8.0), way);
    at = 0;
    if (length < 0) {
        printh("PILOT NO PATH " + sector + " goal " + goal);
        quit();
    }
}

// Pick an unmet objective, then visit the optional cache before leaving.
function choose() {
    var kind = !station.power ? 1 : !decoder && sector == 1 ? 3 : !station.card ? 2 : !station.relay ? 4 : station.secrets == 0 ? 6 : 5;
    for (var i = 0; i < station.itemN; i++) {
        if (station.plan.items[i].kind == kind && station.taken[i] == 0) {
            goal = i;
            goalX = station.plan.items[i].x;
            goalY = station.plan.items[i].y;
            if (kind == 6 && doors.revealed[5] == 0) {
                goalX = 24 * 8 + 4;
                goalY = 18 * 8 + 4;
            }
            route();
            return;
        }
    }
}

// Hold Play to cycle equipment, then release without firing it.
function equip(tool) {
    if (tools.equipped != tool) {
        mask |= 8;
        if (player.heldPlay >= 10.0)
            mask &= ~8;
        return false;
    }
    return previous != 8;
}

// Turn while stopped to avoid cutting a corner of a one-cell corridor.
function aim(x, y) {
    var angle = atan2(x - player.cx(), y - player.cy());
    var d = angle - player.heading;
    d -= flr(d + 0.5);
    clicks = mid(-24, flr(0.5 - d * 192.0), 24);
    return abs(d) < 0.008;
}

// Run before update. All steering and path work is inside a prof section.
function before() {
    prof("pilot");
    mask = 0;
    clicks = 0;
    steps++;
    if (scene == TITLE) {
        tap(16);
    } else if (scene == LOG) {
        tap(16);
    } else if (scene == CLEAR) {
        if (endWait > 13)
            tap(16);
        goal = -1;
    } else if (scene == VICTORY) {
        victories++;
        printh("PILOT VICTORY " + runPoints + " ticks " + steps);
        quit();
    } else if (scene == DOWN) {
        printh("PILOT DIED " + sector + " ticks " + steps);
        quit();
    } else if (scene == EXPLORE) {
        if (lastSector != sector) {
            lastSector = sector;
            goal = -1;
        }
        var desiredKind = !station.power ? 1 : !decoder && sector == 1 ? 3 : !station.card ? 2 : !station.relay ? 4 : station.secrets == 0 ? 6 : 5;
        if (goal < 0 || station.plan.items[goal].kind != desiredKind || station.taken[goal] != 0)
            choose();
        if (goal >= 0) {
            var o = station.plan.items[goal];
            // Once a scanner reveals the panel, rebuild the route to its cache.
            if (o.kind == 6 && doors.revealed[5] != 0 && goalX != o.x) {
                goalX = o.x;
                goalY = o.y;
                route();
            }
            var tx = goalX, ty = goalY;
            while (at < length) {
                tx = (way[at] % 48) * 8 + 4;
                ty = (way[at] / 48) * 8 + 4;
                if (abs(tx - player.cx()) > 0.7 || abs(ty - player.cy()) > 0.7)
                    break;
                at++;
            }
            if (at >= length) { tx = goalX; ty = goalY; }
            var close = abs(goalX - player.cx()) < 1.0 && abs(goalY - player.cy()) < 1.0;
            var aligned = aim(tx, ty);
            var moving = aligned && !close;
            var door = -1;
            for (var i = 0; i < doors.n; i++) {
                var d = doors.source[i];
                if (d.x == flr(tx / 8.0) && d.y == flr(ty / 8.0) && doors.opening[i] < 0.98) {
                    if (abs(tx - player.cx()) < 11.0 && abs(ty - player.cy()) < 11.0) {
                        door = i;
                        moving = false;
                        if (aligned && doors.want[i] == 0)
                            tap(2);
                    }
                }
            }
            if (close) {
                moving = false;
                aim(o.x, o.y);
                if (o.kind == 6 && doors.revealed[5] == 0) {
                    if (equip(1)) tap(8);
                } else if (o.kind == 4 && o.need != 0) {
                    if (equip(2)) tap(8);
                } else if (o.kind == 1 || o.kind == 4 || o.kind == 5) {
                    tap(2);
                }
            }
            if (player.walking != moving)
                tap(16);
        }
    }
    if (mask != previous || clicks != 0 || oldClicks != 0)
        printh("INPUT " + (frame() - 1) + " " + mask + " " + clicks);
    previous = mask;
    oldClicks = clicks;
    if (steps % 2000 == 0)
        printh("PILOT AT " + sector + " " + goal + " " + player.cx() + " " + player.cy() + " path " + at + "/" + length);
    prof();
}
