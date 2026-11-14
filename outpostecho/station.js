// station: authored maps, room discovery, pickups and the mission graph.
// Hot state lives in typed arrays. Sector data is read once at startup.
const ROOMS = 6, MAX_ITEMS = 16;
var maps = [MAP.arrival, MAP.research, MAP.reactor, MAP.botanical, MAP.communications];
var plans;
var plan;
var names;
var rooms = new Int32Array(ROOMS * 4);
var objects = new Int32Array(5 * 8);
var seen = new Uint8Array(ROOMS);
var taken = new Uint8Array(MAX_ITEMS);
var visited = 0, current = -1, secrets = 0, collected = 0;
var spawnX = 44.0, spawnY = 68.0;
var power = false, card = false, relay = false;
var itemN = 0, hint = -1;

// Load one sector's map and reset its mission state.
function load(n) {
    if (plans == null)
        plans = data.read(DATA.sectors);
    plan = plans[n];
    names = plan.rooms;
    loadmap(maps[n]);
    var count = mapobj(objects, 8), r = 0;
    for (var i = 0; i < count; i++) {
        var at = i * 5;
        if (objects[at] == OBJ.start) {
            spawnX = objects[at + 1] + objects[at + 3] * 0.5;
            spawnY = objects[at + 2] + objects[at + 4] * 0.5;
        } else if (objects[at] == OBJ.room && r < ROOMS) {
            copy(rooms, r * 4, objects, at + 1, 4);
            r++;
        }
    }
    itemN = plan.items.length;
    reset();
    doors.load(plan.doors);
}

// Forget only this sector's progress.
function reset() {
    fill(seen, 0);
    fill(taken, 0);
    visited = 0;
    current = -1;
    secrets = 0;
    collected = 0;
    power = false;
    card = false;
    relay = false;
    hint = -1;
}

// Find the current room without confusing corridors with rooms.
function visit(x, y) {
    current = -1;
    for (var i = 0; i < ROOMS; i++) {
        var j = i * 4;
        if (x >= rooms[j] && x < rooms[j] + rooms[j + 2] && y >= rooms[j + 1] && y < rooms[j + 1] + rooms[j + 3]) {
            current = i;
            if (seen[i] == 0) {
                seen[i] = 1;
                visited++;
            }
            return;
        }
    }
}

// The target is close, in front and not behind another wall.
function aimed(x, y) {
    var dx = x - player.cx(), dy = y - player.cy();
    if (abs(dx) > 12.0 || abs(dy) > 12.0 || dx * dx + dy * dy > 144.0)
        return false;
    if (dx * cos(player.heading) + dy * sin(player.heading) < max(abs(dx), abs(dy)) * 0.2)
        return false;
    return clearLine(player.cx(), player.cy(), x, y, true);
}

// Short grid ray for robot sight and interactions. End walls may be doors.
function clearLine(x, y, tx, ty, endWall) {
    var dx = tx - x, dy = ty - y;
    var steps = max(1, ceil(max(abs(dx), abs(dy)) / 4.0));
    for (var i = 1; i <= steps; i++) {
        var cx = flr((x + dx * i / steps) / 8.0), cy = flr((y + dy * i / steps) / 8.0);
        if (endWall && cx == flr(tx / 8.0) && cy == flr(ty / 8.0))
            break;
        if ((fget(mget(cx, cy)) & FLAG.solid) != 0)
            return false;
    }
    return true;
}

// Pick up physical supplies. Relays and logs require Next instead.
function update() {
    var x = player.cx(), y = player.cy();
    visit(x, y);
    for (var i = 0; i < itemN; i++) {
        if (taken[i] != 0)
            continue;
        var o = plan.items[i], k = o.kind;
        if (k != 2 && k != 3 && k != 6 && k != 7)
            continue;
        if (abs(o.x - x) > 3.6 || abs(o.y - y) > 3.6)
            continue;
        taken[i] = 1;
        collected++;
        if (k == 2) {
            card = true;
            announce("ACCESS PASS ACQUIRED");
        } else if (k == 3) {
            decoder = true;
            announce("DECODER: HOLD PLAY TO EQUIP");
        } else if (k == 6) {
            secrets++;
            player.energy = min(100, player.energy + 25);
            ach.earn(ACH.secret);
            announce("SECRET CACHE +500");
        } else {
            player.energy = min(100, player.energy + 30);
            player.charge = min(4, player.charge + 2);
            announce("ENERGY +30 / PULSE +2");
        }
        sound(880, 3);
        saves.checkpoint();
    }
}

// Next operates nearby terminals, doors and the sector's exit.
function interact() {
    var best = -1, distance = 999.0;
    for (var i = 0; i < itemN; i++) {
        var o = plan.items[i];
        if (o.kind != 1 && o.kind != 4 && o.kind != 5 && o.kind != 8)
            continue;
        var d = abs(o.x - player.cx()) + abs(o.y - player.cy());
        if (d < distance && aimed(o.x, o.y)) {
            best = i;
            distance = d;
        }
    }
    if (best < 0) {
        if (!doors.interact())
            announce("NO PANEL IN REACH");
        return;
    }
    activate(best, false);
}

// Decoder activation uses the same puzzle requirements as interaction.
function activate(i, decoded) {
    var o = plan.items[i];
    if (o.kind == 1) {
        power = true;
        sound(550, 5);
        saves.checkpoint();
        openLog(o.text);
    } else if (o.kind == 4) {
        if (!power) {
            announce("RESTORE THE POWER BUS FIRST");
        } else if (!card) {
            announce("ACCESS PASS REQUIRED");
        } else if (o.need != 0 && (!decoder || !decoded)) {
            announce(decoder ? "EQUIP DECODER / TAP PLAY" : "FIND THE ACCESS DECODER");
        } else {
            relay = true;
            sound(770, 5);
            saves.checkpoint();
            openLog(o.text);
        }
    } else if (o.kind == 5) {
        if (relay)
            finishLevel();
        else
            announce("RESTORE THIS SECTOR'S RELAY");
    } else if (o.kind == 8) {
        taken[i] = 1;
        saves.checkpoint();
        openLog(o.text);
    }
}

// Short objective text, with no string allocation in the drawing loop.
function objective() {
    if (!power)
        return "RESTORE POWER";
    if (!card)
        return "FIND ACCESS PASS";
    if (sector > 0 && !decoder)
        return "FIND DECODER";
    if (!relay)
        return "ACTIVATE RELAY";
    return sector == 4 ? "RESTORE THE SIGNAL" : "REACH TRANSIT HATCH";
}
