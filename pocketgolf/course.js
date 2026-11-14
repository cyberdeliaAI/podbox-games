// course: one lazy background and one overview, with independent collision
// geometry and surface data. Only the current hole's plan is read.
var plan;
var current = -1;
var picture, overview;
var files = [DATA.h01, DATA.h02, DATA.h03, DATA.h04, DATA.h05, DATA.h06, DATA.h07, DATA.h08, DATA.h09, DATA.h10, DATA.h11, DATA.h12, DATA.h13, DATA.h14, DATA.h15, DATA.h16, DATA.h17, DATA.h18, DATA.h19, DATA.h20, DATA.h21, DATA.h22, DATA.h23, DATA.h24, DATA.h25, DATA.h26, DATA.h27, DATA.h28, DATA.h29, DATA.h30, DATA.h31, DATA.h32, DATA.h33, DATA.h34, DATA.h35, DATA.h36];
var pictures = [IMG.h01, IMG.h02, IMG.h03, IMG.h04, IMG.h05, IMG.h06, IMG.h07, IMG.h08, IMG.h09, IMG.h10, IMG.h11, IMG.h12, IMG.h13, IMG.h14, IMG.h15, IMG.h16, IMG.h17, IMG.h18, IMG.h19, IMG.h20, IMG.h21, IMG.h22, IMG.h23, IMG.h24, IMG.h25, IMG.h26, IMG.h27, IMG.h28, IMG.h29, IMG.h30, IMG.h31, IMG.h32, IMG.h33, IMG.h34, IMG.h35, IMG.h36];
var overviews = [IMG.h01, IMG.h02, IMG.h03, IMG.h04, IMG.h05, IMG.h06, IMG.h07, IMG.h08, IMG.o09, IMG.h10, IMG.o11, IMG.h12, IMG.h13, IMG.h14, IMG.h15, IMG.h16, IMG.h17, IMG.o18, IMG.h19, IMG.h20, IMG.o21, IMG.h22, IMG.h23, IMG.h24, IMG.h25, IMG.h26, IMG.o27, IMG.h28, IMG.h29, IMG.h30, IMG.o31, IMG.h32, IMG.h33, IMG.h34, IMG.h35, IMG.o36];
var maps = [MAP.h01, MAP.h02, MAP.h03, MAP.h04, MAP.h05, MAP.h06, MAP.h07, MAP.h08, MAP.h09, MAP.h10, MAP.h11, MAP.h12, MAP.h13, MAP.h14, MAP.h15, MAP.h16, MAP.h17, MAP.h18, MAP.h19, MAP.h20, MAP.h21, MAP.h22, MAP.h23, MAP.h24, MAP.h25, MAP.h26, MAP.h27, MAP.h28, MAP.h29, MAP.h30, MAP.h31, MAP.h32, MAP.h33, MAP.h34, MAP.h35, MAP.h36];
var catalog;
var hasWater = false;
var names = ["SUNNY GARDENS", "PIRATE COVE", "DESERT ADVENTURE", "WINTER WONDERLAND"];

// Drop the old pictures before loading a new authored hole.
function load(i) {
    prepare(i);
    loadPicture();
    loadOverview();
    ball.reset();
}

// Production spreads decompression across loading ticks at 25 Hz.
function prepare(i) {
    if (catalog == null) catalog = data.read(DATA.catalog);
    if (current >= 0) {
        img.drop(pictures[current]);
        if (pictures[current] != overviews[current]) img.drop(overviews[current]);
    }
    picture = null;
    overview = null;
    plan = null;
    plan = data.read(files[i]);
    hasWater = plan.base == 5;
    for (var j = 0; j < plan.regions.length; j++) if (plan.regions[j][4] == 5) hasWater = true;
    loadmap(maps[i]);
    current = i;
    geometry.load(plan);
}

function loadPicture() { picture = img.load(pictures[current]); }
function loadOverview() {
    overview = pictures[current] == overviews[current] ? picture : img.load(overviews[current]);
}

// Later regions override earlier ones, so a bridge can cross water.
function surface(x, y) {
    var result = plan.base;
    for (var i = 0; i < plan.regions.length; i++) {
        var r = plan.regions[i];
        if (x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3])
            result = r[4];
    }
    return result;
}

// Special fields have explicit directions and a shared re-entry cooldown.
function specials() {
    if (ball.cooldown > 0) return;
    for (var i = 0; i < plan.specials.length; i++) {
        var o = plan.specials[i];
        if (abs(ball.x - o.x) > o.r || abs(ball.y - o.y) > o.r) continue;
        if (o.kind == 1 || o.kind == 2) {
            ball.x = o.tx; ball.y = o.ty;
            ball.vx *= 0.65; ball.vy *= 0.65;
            ball.safeX = ball.x; ball.safeY = ball.y;
            ball.cooldown = 30;
            if (o.kind == 2) ball.delay = 10;
        } else if (o.kind == 3) {
            ball.vx = cos(o.angle) * 2.6; ball.vy = sin(o.angle) * 2.6;
            ball.cooldown = 18;
        } else if (o.kind == 4) {
            geometry.gateOpen = true;
            ball.cooldown = 10;
        } else if (o.kind == 5 && ball.z == 0.0) {
            ball.vz = 0.8; ball.z = 0.01;
            ball.cooldown = 24;
        } else if (o.kind == 6) {
            var dx = ball.x - o.x, dy = ball.y - o.y;
            ball.vx += dy * 0.018; ball.vy -= dx * 0.018;
        }
        return;
    }
}
