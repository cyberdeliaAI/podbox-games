// view: a 112-column visor leaves time for doors and security patrols.
// The SDK raycaster handles textured walls and billboard occlusion.
// Floors stay flat. Scanner maps and all shading are generated offline.
const EYE = 8.0, WALL = 16, HORIZON = 54, FAR = 88;
var dark = new Uint8Array(256);
var spent = 0;
var mapImages = [IMG.arrival_map, IMG.research_map, IMG.reactor_map, IMG.botanical_map, IMG.communications_map];
var xs = new FixArray(20), ys = new FixArray(20), sizes = new FixArray(20), zs = new FixArray(20);
var sp = new Int32Array(20);

// Side-face shading never changes the colour of the material itself.
function init() {
    for (var i = 0; i < 256; i++)
        dark[i] = i;
    for (var group = 0; group < 4; group++)
        for (var j = 1; j < 4; j++)
            dark[16 + group * 4 + j] = 16 + group * 4 + j - 1;
    dark[7] = 6;
    dark[12] = 13;
}

// Filter the small prop pool before the engine sorts it by depth.
function billboards() {
    var n = 0, px = player.cx(), py = player.cy();
    var ca = cos(player.heading), sa = sin(player.heading);
    for (var i = 0; i < station.itemN; i++) {
        var o = station.plan.items[i];
        if (station.taken[i] != 0 && o.kind != 8)
            continue;
        var dx = o.x - px, dy = o.y - py;
        if (abs(dx) > 72 || abs(dy) > 72 || dx * ca + dy * sa < 2.0)
            continue;
        xs[n] = o.x;
        ys[n] = o.y;
        var tall = o.kind == 5 ? 11.0 : o.kind == 9 ? 8.0 : 5.0;
        // Cap close sprites at 40 screen pixels, keeping their centre.
        sizes[n] = min(tall, (dx * ca + dy * sa) * 0.5);
        zs[n] = (tall - sizes[n]) * 0.5;
        sp[n] = o.kind == 9 && sector == 3 ? 98 : 64 + ((o.kind - 1) / 8) * 32 + ((o.kind - 1) % 8) * 2;
        n++;
    }
    for (var i = 0; i < robots.n; i++) {
        var x = robots.body.x[i] + 1.2, y = robots.body.y[i] + 1.2;
        var dx = x - px, dy = y - py;
        if (abs(dx) > 72 || abs(dy) > 72 || dx * ca + dy * sa < 2.0)
            continue;
        xs[n] = x;
        ys[n] = y;
        sizes[n] = min(12.0, (dx * ca + dy * sa) * 0.6);
        zs[n] = (12.0 - sizes[n]) * 0.5;
        sp[n] = robots.stun[i] > 0.0 ? 132 : 128 + ((frame() / 8) & 1) * 2;
        n++;
    }
    plane.billboards(xs, ys, zs, sp, sizes, 0, n, 2, 2);
}

// The frame covers rows outside the visor so rendering can skip them.
function draw() {
    cls(32);
    clip(24, 12, 135, 99);
    rectfill(16, 12, 143, 26, 32);
    rectfill(16, 27, 143, HORIZON - 1, 33);
    rectfill(16, HORIZON, 143, 75, 34);
    rectfill(16, 76, 143, 99, 35);
    plane.view(player.cx(), player.cy(), EYE, player.heading, HORIZON, 0.25);
    plane.fog(36, FAR, 34, false);
    walls.draw(FLAG.wall, WALL, FAR, dark, doors.render);
    billboards();
    clip();
    rect(23, 11, 136, 100, player.flash > 0 ? 12 : player.invulnerable > 0.0 ? 8 : 17);
}
