// putter: stable hold-and-release power and click-wheel aim. Aim freezes
// during charging. A press held across a menu or pause is consumed safely.
var aim = 0.0, charge = 0.0;
var precision = false, guide = true, armed = false;
var wasPrev = false, wasNext = false, wasPlay = false;

// Aim along the opening route, with a fresh press required after a menu.
function reset() {
    aim = atan2(course.plan.cup[0] - ball.x, course.plan.cup[1] - ball.y);
    cancel();
    wasPrev = btn(0); wasNext = btn(1); wasPlay = btn(3);
}

// A cancelled hold must never become a shot on release.
function cancel() {
    charge = 0.0;
    armed = !btn(4);
}

// Read physical edges instead of the API's repeating menu presses.
function update() {
    var held = btn(4);
    if (!held && !armed) armed = true;
    if (btn(3) && !wasPlay) view.over = !view.over;
    if (!ball.moving && !ball.cup && ball.delay == 0) {
        if (!held) {
            aim -= wheel() / (precision ? 768.0 : 192.0);
            aim -= flr(aim);
            if (btn(0) && !wasPrev) { precision = !precision; opt.set(OPT.precision, precision); }
            if (btn(1) && !wasNext) { guide = !guide; opt.set(OPT.guide, guide); }
        }
        if (held && armed) charge = min(45.0, charge + 33.0 / rate());
        if (!held && charge > 0.0 && armed) {
            takeShot(aim, min(45, flr(charge)) / 45.0);
            charge = 0.0;
        }
    } else {
        charge = 0.0;
        if (held) armed = false;
    }
    wasPrev = btn(0); wasNext = btn(1); wasPlay = btn(3);
}
