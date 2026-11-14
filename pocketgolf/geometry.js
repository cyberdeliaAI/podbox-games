// geometry: circle-versus-segment contact with endpoint normals. The ball
// advances at most 0.65 pixels a substep, so even thin angled walls can't
// be crossed by the maximum shot. Moving segments advance once per tick.
const MAX = 40, MAX_CIRCLES = 8;
var n = 0, circles = 0;
var ax = new FixArray(MAX), ay = new FixArray(MAX), bx = new FixArray(MAX), by = new FixArray(MAX);
var tx = new FixArray(MAX), ty = new FixArray(MAX), length = new FixArray(MAX);
var loX = new FixArray(MAX), loY = new FixArray(MAX), hiX = new FixArray(MAX), hiY = new FixArray(MAX);
var height = new FixArray(MAX), restitution = new FixArray(MAX);
var cx = new FixArray(MAX_CIRCLES), cy = new FixArray(MAX_CIRCLES), radius = new FixArray(MAX_CIRCLES);
var staticN = 0, clock = 0, gateOpen = false;
var movers;
var mx = new FixArray(MAX), my = new FixArray(MAX);

// Set an already-normalized segment and its expanded broad-phase box.
function segment(i, x0, y0, x1, y1, ux, uy, len, h, bounce) {
    ax[i] = x0; ay[i] = y0; bx[i] = x1; by[i] = y1;
    tx[i] = ux; ty[i] = uy; length[i] = len;
    loX[i] = min(x0, x1) - ball.R;
    hiX[i] = max(x0, x1) + ball.R;
    loY[i] = min(y0, y1) - ball.R;
    hiY[i] = max(y0, y1) + ball.R;
    height[i] = h;
    restitution[i] = bounce;
    mx[i] = 0.0; my[i] = 0.0;
}

// Fill reusable arrays only when changing holes.
function load(plan) {
    n = plan.lines.length;
    staticN = n;
    for (var i = 0; i < n; i++) {
        var l = plan.lines[i];
        segment(i, l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], l[8]);
    }
    movers = plan.movers;
    circles = plan.circles.length;
    for (var i = 0; i < circles; i++) {
        cx[i] = plan.circles[i][0]; cy[i] = plan.circles[i][1]; radius[i] = plan.circles[i][2];
    }
    gateOpen = false;
    clock = 0;
    update();
}

// Recreate moving geometry from an integer clock, including after a restore.
function update() {
    n = staticN;
    for (var j = 0; j < movers.length; j++) {
        var o = movers[j];
        if (o.kind == 3 && gateOpen)
            continue;
        var phase = (clock % o.period) / (o.period * 1.0);
        var x = o.x, y = o.y, ux = 1.0, uy = 0.0;
        var vx = 0.0, vy = 0.0;
        if (o.kind == 1 || o.kind == 4) {
            ux = cos(phase + o.angle);
            uy = sin(phase + o.angle);
        } else {
            x += o.dx * sin(phase);
            y += o.dy * sin(phase);
            vx = o.dx * (sin(phase + 1.0 / o.period) - sin(phase));
            vy = o.dy * (sin(phase + 1.0 / o.period) - sin(phase));
            ux = cos(o.angle); uy = sin(o.angle);
        }
        segment(n, x - ux * o.r, y - uy * o.r, x + ux * o.r, y + uy * o.r, ux, uy, o.r * 2.0, 4.0, 0.86);
        mx[n] = vx; my[n] = vy;
        n++;
        if (o.kind == 1) {
            segment(n, x + uy * o.r, y - ux * o.r, x - uy * o.r, y + ux * o.r, -uy, ux, o.r * 2.0, 4.0, 0.86);
            n++;
        }
    }
}

// Reflect only incoming relative velocity, then separate the ball slightly.
function reflect(nx, ny, push, bounce, wx, wy) {
    ball.x += nx * (push + 0.008);
    ball.y += ny * (push + 0.008);
    var dot = (ball.vx - wx) * nx + (ball.vy - wy) * ny;
    if (dot < 0.0) {
        ball.vx -= (1.0 + bounce) * dot * nx;
        ball.vy -= (1.0 + bounce) * dot * ny;
        ball.bump = 1;
    }
}

// Resolve the closest point, using a radial normal at a segment's ends.
function collide() {
    for (var i = 0; i < n; i++) {
        if (ball.z > height[i] || ball.x < loX[i] || ball.x > hiX[i] || ball.y < loY[i] || ball.y > hiY[i])
            continue;
        var along = mid(0.0, (ball.x - ax[i]) * tx[i] + (ball.y - ay[i]) * ty[i], length[i]);
        var dx = ball.x - ax[i] - tx[i] * along;
        var dy = ball.y - ay[i] - ty[i] * along;
        var d2 = dx * dx + dy * dy;
        if (d2 >= ball.R * ball.R)
            continue;
        if (d2 < 0.0001) {
            var nx = -ty[i], ny = tx[i];
            if (ball.vx * nx + ball.vy * ny > 0.0) { nx = -nx; ny = -ny; }
            reflect(nx, ny, ball.R, restitution[i], mx[i], my[i]);
        } else {
            var d = sqrt(d2);
            reflect(dx / d, dy / d, ball.R - d, restitution[i], mx[i], my[i]);
        }
    }
    for (var i = 0; i < circles; i++) {
        var reach = radius[i] + ball.R;
        var dx = ball.x - cx[i], dy = ball.y - cy[i];
        if (abs(dx) > reach || abs(dy) > reach || ball.z > 4.0)
            continue;
        var d2 = dx * dx + dy * dy;
        if (d2 < reach * reach && d2 > 0.0001) {
            var d = sqrt(d2);
            reflect(dx / d, dy / d, reach - d, 0.94, 0.0, 0.0);
        }
    }
}
