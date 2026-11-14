// ball: deterministic 33 Hz physics, independent of camera and rendering.
// All distances are small fixed-point values. Broad-phase checks precede
// squared distances, keeping them within the fixed-point number range.
const R = 1.8, MAX_SPEED = 3.2, STOP = 0.045;
var x = 0.0, y = 0.0, vx = 0.0, vy = 0.0;
var z = 0.0, vz = 0.0;
var safeX = 0.0, safeY = 0.0;
var cup = false, moving = false, bump = 0, event = 0;
var cooldown = 0, delay = 0, ticks = 0;
var friction = [0.030, 0.018, 0.075, 0.12, 0.006, 0.030, 0.030, 0.030, 0.030, 0.030, 0.030, 0.022];

// Start a hole at its authored tee.
function reset() {
    x = course.plan.tee[0]; y = course.plan.tee[1];
    vx = 0.0; vy = 0.0; z = 0.0; vz = 0.0;
    safeX = x; safeY = y;
    cup = false; moving = false; event = 0; bump = 0;
    cooldown = 0; delay = 0; ticks = 0;
}

// Calibrated impulse: the meter's maximum is stable while held.
function fire(aim, power) {
    if (moving || cup || delay > 0)
        return false;
    var speed = 0.22 + mid(0.0, power, 1.0) * 2.98;
    vx = cos(aim) * speed;
    vy = sin(aim) * speed;
    moving = true;
    return true;
}

// Return to the last dry point once, with a penalty event for main.js.
function water() {
    x = safeX; y = safeY;
    vx = 0.0; vy = 0.0; z = 0.0; vz = 0.0;
    moving = false;
    event = 1;
    delay = 18;
}

// One fixed physics tick, also used by the scratch trajectory search.
function step() {
    ticks++;
    bump = 0;
    if (cooldown > 0) cooldown--;
    if (delay > 0) { delay--; return; }
    if (cup) return;
    var surface = course.surface(x, y);
    if (surface == 5 && z < 0.7) { water(); return; }
    if (z == 0.0) {
        if (surface == 6) vy -= 0.045;
        if (surface == 7) vx += 0.045;
        if (surface == 8) vy += 0.045;
        if (surface == 9) vx -= 0.045;
    }
    var speed = sqrt(vx * vx + vy * vy);
    var drag = z > 0.0 ? 0.006 : friction[surface];
    if (speed <= drag + (surface >= 6 && surface <= 9 ? 0.0 : STOP)) {
        vx = 0.0; vy = 0.0;
    } else {
        var ratio = max(0.0, speed - drag) / speed;
        vx *= ratio; vy *= ratio;
    }
    moving = vx != 0.0 || vy != 0.0 || z > 0.0;
    if (!moving) {
        geometry.collide();
        moving = vx != 0.0 || vy != 0.0;
        if (!moving) return;
    }
    if (z > 0.0 || vz > 0.0) {
        vz -= 0.10;
        z += vz;
        if (z < 0.0) { z = 0.0; vz = 0.0; }
    }
    var steps = max(1, ceil(max(abs(vx), abs(vy)) / 0.65));
    for (var s = 0; s < steps; s++) {
        x += vx / steps;
        y += vy / steps;
        geometry.collide();
        if (course.hasWater && z < 0.7 && course.surface(x, y) == 5) { water(); return; }
        var dx = x - course.plan.cup[0], dy = y - course.plan.cup[1];
        if (abs(dx) < 3.0 && abs(dy) < 3.0 && z < 0.5 && dx * dx + dy * dy < 8.0 && vx * vx + vy * vy < 1.0) {
            cup = true; moving = false;
            x = course.plan.cup[0]; y = course.plan.cup[1];
            vx = 0.0; vy = 0.0;
            event = 2;
            return;
        }
    }
    if (x < 0.0 || y < 0.0 || x >= course.plan.w || y >= course.plan.h) { water(); return; }
    course.specials();
    speed = sqrt(vx * vx + vy * vy);
    if (speed > MAX_SPEED) { vx *= MAX_SPEED / speed; vy *= MAX_SPEED / speed; }
    if (z == 0.0 && (!course.hasWater || course.surface(x, y) != 5)) { safeX = x; safeY = y; }
}
