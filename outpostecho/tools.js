// tools: a pulse, a local scanner and an acquired access decoder. Tool
// changes use a held Play press; release uses only a short press.
var equipped = 0;
var labels = ["PULSE", "SCAN", "DECODE"];
var scan = 0.0;
var marks = 0;
var mx = new Uint8Array(24), my = new Uint8Array(24), ink = new Uint8Array(24);

// Cycle only through installed equipment.
function cycle() {
    equipped = (equipped + 1) % (decoder ? 3 : 2);
    opt.set(OPT.tool, equipped);
    announce("TOOL: " + labels[equipped]);
}

// Use the selected tool once, outside the frame's movement loop.
function use() {
    if (equipped == 0) {
        robots.pulse();
    } else if (equipped == 1) {
        scan = 150.0;
        marks = 0;
        for (var i = 0; i < station.itemN; i++) {
            var o = station.plan.items[i];
            if (station.taken[i] != 0 || o.kind == 9 || abs(o.x - player.cx()) > 44.0 || abs(o.y - player.cy()) > 44.0)
                continue;
            mx[marks] = o.x / 8;
            my[marks] = o.y / 8;
            ink[marks] = o.kind == 6 ? 9 : 12;
            marks++;
        }
        var found = false;
        for (var i = 0; i < doors.n; i++) {
            var d = doors.source[i];
            if (d.secret == 0 && doors.opening[i] < 0.98 && abs(d.x * 8 + 4 - player.cx()) < 44.0 && abs(d.y * 8 + 4 - player.cy()) < 44.0) {
                mx[marks] = d.x;
                my[marks] = d.y;
                ink[marks] = d.lock != 0 ? 10 : 6;
                marks++;
            }
            if (d.secret != 0 && abs(d.x * 8 + 4 - player.cx()) < 44.0 && abs(d.y * 8 + 4 - player.cy()) < 44.0) {
                doors.revealed[i] = 1;
                found = true;
            }
        }
        announce(found ? "HIDDEN SERVICE PANEL DETECTED" : station.objective());
        sound(440, 2);
    } else if (!decoder) {
        announce("DECODER NOT INSTALLED");
    } else {
        for (var i = 0; i < station.itemN; i++) {
            var o = station.plan.items[i];
            if (o.kind == 4 && station.aimed(o.x, o.y)) {
                station.activate(i, true);
                return;
            }
        }
        announce("NO RELAY IN DECODER RANGE");
    }
}
