// saves: a versioned checkpoint plus native unlocked-sector and score data.
// Allocate only on explicit progress events or exit, never every tick.
var unlocked = 1;
var last = null;
var failed = false, wrote = false;

// Read this cartridge's own data once.
function init() {
    unlocked = mid(1, flr(dget(0)), 5);
    last = store.read("checkpoint");
}

// Preserve mission state, equipment and the exact player position.
function checkpoint() {
    var opened = [], revealed = [], items = [], rooms = [];
    for (var i = 0; i < doors.n; i++) {
        opened.push(doors.want[i]);
        revealed.push(doors.revealed[i]);
    }
    for (var i = 0; i < station.itemN; i++)
        items.push(station.taken[i]);
    for (var i = 0; i < station.ROOMS; i++)
        rooms.push(station.seen[i]);
    var disabledMask = 0, hitMask = 0;
    for (var i = 0; i < robots.n; i++) {
        if (robots.counted[i] != 0) disabledMask |= 1 << i;
        if (robots.hitPlayer[i] != 0) hitMask |= 1 << i;
    }
    var saved = { version: 1, sector: sector, x: player.cx(), y: player.cy(), heading: player.heading,
        energy: player.energy, charge: player.charge, decoder: decoder, power: station.power,
        card: station.card, relay: station.relay, elapsed: elapsedMs, points: runPoints, before: beforeLevel,
        secrets: station.secrets, collected: station.collected, damage: robots.damage, disabled: robots.disabled, disabledMask: disabledMask, hitMask: hitMask,
        opened: opened, revealed: revealed, items: items, rooms: rooms, cleared: scene == CLEAR || scene == VICTORY };
    wrote = true;
    failed = !store.write("checkpoint", saved);
    if (!failed)
        last = saved;
}

// Check lengths and coordinates before accepting a stored checkpoint.
function valid(s) {
    return s != null && s.version == 1 && s.sector >= 0 && s.sector < 5 &&
        s.opened != null && s.revealed != null && s.items != null && s.rooms != null &&
        s.opened.length == 6 && s.revealed.length == 6 && s.items.length >= 10 && s.items.length <= 16 && s.rooms.length == 6 &&
        s.x >= 8.0 && s.x < 376.0 && s.y >= 8.0 && s.y < 296.0 &&
        s.energy > 0 && s.energy <= 100 && s.charge >= 0 && s.charge <= 4 && s.heading >= 0.0 && s.heading < 1.0;
}

// Restore a checkpoint, or start the next sector after a completed one.
function resume() {
    var s = last;
    if (!valid(s))
        return false;
    runPoints = s.points;
    decoder = s.decoder;
    if (s.cleared && s.sector < 4) {
        startLevel(s.sector + 1);
        return true;
    }
    startLevel(s.sector, true);
    // Keep the old checkpoint intact until restoration is complete.
    if (s.items.length != station.itemN)
        return false;
    beforeLevel = s.before;
    player.energy = s.energy;
    player.charge = s.charge;
    station.power = s.power;
    station.card = s.card;
    station.relay = s.relay;
    station.secrets = s.secrets;
    station.collected = s.collected;
    robots.damage = s.damage;
    robots.disabled = 0;
    for (var i = 0; i < robots.n; i++) {
        robots.counted[i] = (s.disabledMask & (1 << i)) != 0 ? 1 : 0;
        robots.hitPlayer[i] = (s.hitMask & (1 << i)) != 0 ? 1 : 0;
        robots.disabled += robots.counted[i];
    }
    elapsedMs = s.elapsed;
    for (var i = 0; i < doors.n; i++) {
        doors.want[i] = s.opened[i] != 0 ? 1 : 0;
        doors.opening[i] = doors.want[i] * 1.0;
        doors.revealed[i] = s.revealed[i] != 0 ? 1 : 0;
    }
    doors.update(1.0);
    for (var i = 0; i < station.itemN; i++)
        station.taken[i] = s.items[i] != 0 ? 1 : 0;
    station.visited = 0;
    for (var i = 0; i < station.ROOMS; i++) {
        station.seen[i] = s.rooms[i] != 0 ? 1 : 0;
        station.visited += station.seen[i];
    }
    player.body.x[0] = s.x - player.SIZE * 0.5;
    player.body.y[0] = s.y - player.SIZE * 0.5;
    player.heading = s.heading;
    // Damaged or outdated geometry can never resume inside a wall.
    if (!player.clear()) {
        player.body.x[0] = station.spawnX - player.SIZE * 0.5;
        player.body.y[0] = station.spawnY - player.SIZE * 0.5;
    }
    station.visit(player.cx(), player.cy());
    player.stop();
    scene = s.cleared ? VICTORY : EXPLORE;
    endWait = 0;
    saves.checkpoint();
    return true;
}
