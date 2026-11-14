// shots: the ship's guns. The ship fires a volley on every eighth note of
// the music, by itself; a volley is up to three shots side by side, flying
// down the tunnel together, so a volley's depth is checked against a foe
// once and its angles after.

const MAX = 8;
const SPEED = 0.012;               // depth a ms: the far end in about 0.6 s
const REACH = 7.4;                 // gone past this depth

var on = new Uint8Array(MAX);
var z = new FixArray(MAX);         // depth
var a = new FixArray(MAX);         // centre angle
var spread = new FixArray(MAX);    // the side shots' angle out
var bits = new Int32Array(MAX);    // which shots live: 1 centre, 2 left, 4 right

function clear() {
    fill(on, 0);
}

function fire(angle, power) {
    for (var i = 0; i < MAX; i++) {
        if (on[i] == 0) {
            on[i] = 1;
            z[i] = 0.0;
            a[i] = angle;
            if (power <= 1) {
                bits[i] = 1;
                spread[i] = 0.0;
            } else if (power == 2) {
                bits[i] = 6;
                spread[i] = 0.022;
            } else {
                bits[i] = 7;
                spread[i] = 0.04;
            }
            return;
        }
    }
}

// The angle of shot b (1, 2 or 4) of volley i
function shotAngle(i, b) {
    return b == 1 ? a[i] : b == 2 ? a[i] + spread[i] : a[i] - spread[i];
}

// A tick: move, and strike what is in the way
function step(dtms) {
    var dz = SPEED * dtms;
    for (var i = 0; i < MAX; i++) {
        if (on[i] == 0)
            continue;
        var z0 = z[i], z1 = z0 + dz;
        z[i] = z1;
        if (z1 > REACH) {
            on[i] = 0;
            continue;
        }
        for (var j = 0; j < foes.top; j++) {
            var k = foes.kind[j];
            if (k == 0 || foes.done[j] != 0)
                continue;
            var d = foes.dep[j];
            if (d > z1 + 0.15 || d < z0 - 0.35)
                continue;
            if (k == foes.POWER || k == foes.BOMB)
                continue;
            for (var b = 1; b <= 4; b *= 2) {
                if ((bits[i] & b) == 0)
                    continue;
                var off = foes.adiff(shotAngle(i, b), foes.cur[j]);
                if (k == foes.GATE) {
                    // a gate stops every shot but those through its gap
                    if (abs(off) >= foes.arg[j])
                        bits[i] &= ~b;
                    continue;
                }
                var w = k == foes.HEAVY ? 0.05 : k == foes.SPARK ? 0.035 : 0.046;
                if (abs(off) < w) {
                    bits[i] &= ~b;
                    if (foes.damage(j))
                        break;
                }
            }
            if (bits[i] == 0) {
                on[i] = 0;
                break;
            }
        }
    }
}

function draw() {
    // a shot's streak points at the far end
    var far = tube.scaleAt(tube.VIEW), fk = 1.0 - far;
    var fx = tube.CX + tube.offX * fk, fy = tube.CY + tube.offY * fk;
    for (var i = 0; i < MAX; i++) {
        if (on[i] == 0)
            continue;
        for (var b = 1; b <= 4; b *= 2) {
            if ((bits[i] & b) == 0)
                continue;
            tube.project(shotAngle(i, b), z[i], 0.9);
            var x = tube.px, y = tube.py;
            if (tube.ps > 0.5) {
                line(x, y, x + (fx - x) * 0.14, y + (fy - y) * 0.14, 10);
                pset(x, y, 7);
            } else {
                pset(x, y, 10);
            }
        }
    }
}
