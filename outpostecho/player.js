// player: one swept actor on the station map. The camera is its centre.
// Select is edge-triggered rather than btnp's repeating press: holding
// the button must never toggle walking on and off. Backward overrides
// forward while held. Every move uses the engine's wall collisions.

const SIZE = 2.4;                 // hitbox width and height, world pixels
const SPEED = 0.7;                // world pixels a tick at 25 ticks/s
var body;
var contacts = new Int32Array(32);
var heading = 0.0;
var walking = false;
var wasSelect = false, wasNext = false, wasPlay = false;
var moved = false;
var energy = 100, charge = 4, flash = 0;
var invulnerable = 0.0, heldPlay = 0.0;
var playUsed = false;

// Allocate one actor and its fixed hitbox.
function init() {
    body = actors.pool(1);
    actors.spawn(body);
    body.w[0] = SIZE;
    body.h[0] = SIZE;
    reset();
}

// Spawn at the map's start marker, looking east.
function reset() {
    body.x[0] = station.spawnX - SIZE * 0.5;
    body.y[0] = station.spawnY - SIZE * 0.5;
    heading = 0.0;
    energy = 100;
    charge = 4;
    invulnerable = 0.0;
    heldPlay = 0.0;
    stop();
}

// Clear all movement and consume buttons held across a screen or pause.
function stop() {
    walking = false;
    body.dx[0] = 0.0;
    body.dy[0] = 0.0;
    wasSelect = btn(4);
    wasNext = btn(1);
    wasPlay = btn(3);
    playUsed = wasPlay;
    moved = false;
    heldPlay = 0.0;
}

// The camera's world coordinates, from the actor's top left.
function cx() {
    return body.x[0] + SIZE * 0.5;
}
function cy() {
    return body.y[0] + SIZE * 0.5;
}

// Turn, choose movement and sweep the hitbox against the same map as walls.
function update(k) {
    var w = wheel();
    heading -= mid(-0.125, w * sensitivity / 576.0, 0.125);
    heading -= flr(heading);
    var select = btn(4);
    if (holdWalk)
        walking = select;
    else if (select && !wasSelect)
        walking = !walking;
    wasSelect = select;

    var speed = btn(0) ? 0.0 - SPEED * 0.75 : walking ? SPEED : 0.0;
    var x0 = body.x[0], y0 = body.y[0];
    body.dx[0] = cos(heading) * speed * k;
    body.dy[0] = sin(heading) * speed * k;
    actors.move(body, FLAG.solid, 0, contacts);
    moved = abs(body.x[0] - x0) + abs(body.y[0] - y0) > 0.001;

    if (flash > 0)
        flash--;
    var next = btn(1), play = btn(3);
    if (next && !wasNext)
        station.interact();
    if (play && !wasPlay) {
        heldPlay = 0.0;
        playUsed = false;
    }
    if (play) {
        heldPlay += k;
        if (heldPlay >= 10.0 && !playUsed) {
            playUsed = true;
            tools.cycle();
        }
    }
    if (!play && wasPlay) {
        if (!playUsed && heldPlay > 0.0 && heldPlay < 10.0)
            tools.use();
        heldPlay = 0.0;
    }
    wasNext = next;
    wasPlay = play;
}

// Test the full box when restoring a checkpoint.
function clear() {
    for (var i = 0; i < 4; i++) {
        var x = body.x[0] + ((i & 1) != 0 ? SIZE - 0.001 : 0.0);
        var y = body.y[0] + ((i & 2) != 0 ? SIZE - 0.001 : 0.0);
        if ((fget(mget(flr(x / 8.0), flr(y / 8.0))) & FLAG.solid) != 0)
            return false;
    }
    return true;
}
