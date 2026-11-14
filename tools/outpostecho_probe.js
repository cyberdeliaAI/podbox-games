// Scratch-only after-update checks, including the final tick and overlays.
var violations = 0;

// Rendering, mission and collision state must describe the same world.
function check() {
    prof("probe");
    if (scene != TITLE && scene != HELP) {
        if (!player.clear()) fail("player in wall");
        if (player.cx() < 8.0 || player.cx() >= 376.0 || player.cy() < 8.0 || player.cy() >= 296.0) fail("bounds");
        if (player.heading < 0.0 || player.heading >= 1.0) fail("heading");
        if (player.energy < 0 || player.energy > 100 || player.charge < 0 || player.charge > 4) fail("energy");
        if (station.relay && (!station.power || !station.card || (sector > 0 && !decoder))) fail("relay dependency");
        if (station.visited < 1 || station.visited > 6 || station.secrets > 1) fail("discovery");
        if (station.itemN > 16 || doors.n > 8 || robots.n > 3) fail("capacity");
        if (rate() != 25 && rate() != 20) fail("rate");
        for (var i = 0; i < doors.n; i++) {
            var d = doors.source[i];
            var solid = (fget(mget(d.x, d.y)) & FLAG.solid) != 0;
            if (solid != (doors.opening[i] < 0.98)) fail("door collision");
            if (doors.opening[i] < 0.0 || doors.opening[i] > 1.0) fail("door openness");
        }
        for (var i = 0; i < robots.n; i++) {
            if (robots.body.x[i] < 8.0 || robots.body.y[i] < 8.0 || robots.stun[i] < 0.0) fail("robot");
        }
    }
    if (frame() % 100 == 0)
        printh("STATE " + frame() + " " + scene + " " + sector + " " + player.cx() + " " + player.cy() + " " + player.walking + " " + rate() + " " + station.power + " " + station.card + " " + station.relay + " " + player.energy + " " + player.charge + " " + tools.equipped + " " + tools.scan);
    if (frame() == 100)
        printh("META " + saves.unlocked + " " + score.best(BOARD.expedition) + " " + score.count(BOARD.expedition));
    prof();
}

// Stop at the first reproducible invalid state.
function fail(code) {
    violations++;
    printh("VIOLATION " + code + " frame " + frame() + " sector " + sector);
    quit();
}
