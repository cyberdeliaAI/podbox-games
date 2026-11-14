// robots: two readable patrols per sector, staggered sight checks and a
// small swept actor pool. A pulse stuns instead of killing. No path search
// or allocations occur per tick. Contact damage has a one-second cooldown.
const MAX = 3;
var body;
var n = 0;
var homesX = new FixArray(MAX), homesY = new FixArray(MAX);
var goalsX = new FixArray(MAX), goalsY = new FixArray(MAX);
var alarm = new Uint8Array(MAX), returning = new Uint8Array(MAX);
var stun = new FixArray(MAX), seen = new Uint8Array(MAX);
var contacts = new Int32Array(32);
var disabled = 0, damage = 0;
var counted = new Uint8Array(MAX), hitPlayer = new Uint8Array(MAX);

// Load straight patrol segments that the map validator checks.
function load(list) {
    if (body == null)
        body = actors.pool(MAX);
    fill(body.on, 0);
    n = list.length;
    fill(alarm, 0);
    fill(returning, 0);
    fill(stun, 0.0);
    fill(seen, 0);
    fill(counted, 0);
    fill(hitPlayer, 0);
    disabled = 0;
    damage = 0;
    for (var i = 0; i < n; i++) {
        actors.spawn(body);
        body.w[i] = 2.4;
        body.h[i] = 2.4;
        homesX[i] = list[i].x;
        homesY[i] = list[i].y;
        goalsX[i] = list[i].tx;
        goalsY[i] = list[i].ty;
        body.x[i] = homesX[i] - 1.2;
        body.y[i] = homesY[i] - 1.2;
    }
}

// Doors don't close onto any robot, even one that is stunned.
function blocks(x, y) {
    for (var i = 0; i < n; i++)
        if (abs(body.x[i] + 1.2 - x) < 5.5 && abs(body.y[i] + 1.2 - y) < 5.5)
            return true;
    return false;
}

// Follow a patrol, investigate a visible player or return home after loss.
function update(k) {
    if (player.invulnerable > 0.0)
        player.invulnerable = max(0.0, player.invulnerable - k);
    for (var i = 0; i < n; i++) {
        body.dx[i] = 0.0;
        body.dy[i] = 0.0;
        if (stun[i] > 0.0) {
            stun[i] = max(0.0, stun[i] - k);
            continue;
        }
        var x = body.x[i] + 1.2, y = body.y[i] + 1.2;
        var dx = player.cx() - x, dy = player.cy() - y;
        if ((frame() + i * 3) % 8 == 0) {
            var range = difficulty == 0 ? 27.0 : difficulty == 2 ? 52.0 : 40.0;
            var visible = abs(dx) < range && abs(dy) < range && station.clearLine(x, y, player.cx(), player.cy(), false);
            if (alarm[i] != 0 && !visible)
                returning[i] = 1;
            alarm[i] = visible ? 1 : 0;
            if (visible)
                seen[i] = 1;
        }
        var tx = returning[i] != 0 ? homesX[i] : goalsX[i];
        var ty = returning[i] != 0 ? homesY[i] : goalsY[i];
        if (alarm[i] != 0) {
            tx = player.cx();
            ty = player.cy();
            returning[i] = 0;
        }
        var vx = tx - x, vy = ty - y;
        var distance = max(abs(vx), abs(vy));
        if (distance < 1.0 && alarm[i] == 0) {
            if (returning[i] != 0) {
                returning[i] = 0;
            } else {
                var swap = homesX[i]; homesX[i] = goalsX[i]; goalsX[i] = swap;
                swap = homesY[i]; homesY[i] = goalsY[i]; goalsY[i] = swap;
            }
        } else if (distance > 0.0) {
            var speed = (alarm[i] != 0 ? 0.3 : 0.16) * k;
            body.dx[i] = vx / distance * speed;
            body.dy[i] = vy / distance * speed;
        }
        if (abs(dx) < 3.5 && abs(dy) < 3.5 && player.invulnerable == 0.0) {
            var hit = difficulty == 0 ? 6 : difficulty == 2 ? 18 : 10;
            player.energy = max(0, player.energy - hit);
            player.invulnerable = 25.0;
            damage += hit;
            hitPlayer[i] = 1;
            sound(110, 3);
            announce("SECURITY CONTACT / USE PULSE");
        }
    }
    actors.move(body, FLAG.solid, 0, contacts);
    if (player.energy == 0)
        failRun();
}

// Aimed pulse with a clear line of sight, limited to nearby robots.
function pulse() {
    if (player.charge <= 0) {
        announce("PULSE EMPTY / FIND ENERGY");
        return;
    }
    player.charge--;
    var hit = 0;
    for (var i = 0; i < n; i++) {
        var x = body.x[i] + 1.2, y = body.y[i] + 1.2;
        var dx = x - player.cx(), dy = y - player.cy();
        var d = max(abs(dx), abs(dy));
        if (d > 42.0 || dx * cos(player.heading) + dy * sin(player.heading) < d * 0.5)
            continue;
        if (!station.clearLine(player.cx(), player.cy(), x, y, false))
            continue;
        if (counted[i] == 0) {
            disabled++;
            counted[i] = 1;
        }
        stun[i] = 200.0;
        alarm[i] = 0;
        hit++;
    }
    player.flash = 4;
    sound(990, 3);
    announce(hit > 0 ? "SECURITY ROBOT DISABLED" : "PULSE DISCHARGED");
}

// Mutually exclusive end statistics: no contact and never disabled.
function avoided() {
    var result = 0;
    for (var i = 0; i < n; i++)
        if (counted[i] == 0 && hitPlayer[i] == 0)
            result++;
    return result;
}
