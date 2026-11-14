// view: an opaque cached course image and a handful of moving primitives.
// Camera and overview have no access to velocity or simulation timing.
var cx = 0.0, cy = 0.0, px = 0, py = 0;
var scale = 1.0, ox = 0.0, oy = 12.0;
var over = false, spent = 0;

// Start with a sensible framing for both small and scrolling holes.
function reset() {
    cx = mid(0.0, ball.x - 80.0, max(0, course.plan.w - 160));
    cy = mid(0.0, ball.y - 44.0, max(0, course.plan.h - 88));
    over = false;
}

// Smooth following is visual only and never changes the ball.
function update() {
    cx += (mid(0.0, ball.x - 80.0, max(0, course.plan.w - 160)) - cx) * 0.18;
    cy += (mid(0.0, ball.y - 44.0, max(0, course.plan.h - 88)) - cy) * 0.18;
}

// One projection for the ball, obstacles and the aiming guide.
function sx(x) { return x * scale + ox; }
function sy(y) { return y * scale + oy; }

// Draw only what can move over the cached picture.
function draw() {
    px = flr(cx); py = flr(cy);
    scale = over && (course.plan.w > 160 || course.plan.h > 88) ? 0.5 : 1.0;
    palt(0, false);
    if (scale == 0.5) {
        rectfill(0,12,159,99,1);
        ox = (160 - imgw(course.overview)) / 2;
        oy = 12 + (88 - imgh(course.overview)) / 2;
        blit(course.overview, ox, oy);
    } else {
        ox = 0.0 - px; oy = 12.0 - py;
        blitpart(course.picture, px, py, 160, 88, 0, 12);
    }
    palt(0, true);
    clip(0,12,159,99);
    for (var i = geometry.staticN; i < geometry.n; i++) {
        line(sx(geometry.ax[i])+1,sy(geometry.ay[i])+2,sx(geometry.bx[i])+1,sy(geometry.by[i])+2,40);
        line(sx(geometry.ax[i]),sy(geometry.ay[i]),sx(geometry.bx[i]),sy(geometry.by[i]),9);
        line(sx(geometry.ax[i]),sy(geometry.ay[i])-1,sx(geometry.bx[i]),sy(geometry.by[i])-1,15);
    }
    if (geometry.gateOpen) {
        for (var i = 0; i < course.plan.specials.length; i++) {
            var o = course.plan.specials[i];
            if (o.kind == 4) circfill(sx(o.x),sy(o.y),2,11);
        }
    }
    if (scene == PLAY && !ball.moving && !ball.cup) {
        var ca = cos(putter.aim), sa = sin(putter.aim);
        line(sx(ball.x+ca*4.0),sy(ball.y+sa*4.0),sx(ball.x+ca*10.0),sy(ball.y+sa*10.0),7);
        if (putter.guide)
            for (var d=15;d<=39;d+=6) pset(sx(ball.x+ca*d),sy(ball.y+sa*d),7);
    }
    var radius = scene == HOLED ? max(0.0, 1.8 - endWait * 0.1) : ball.R;
    if (radius > 0.0) {
        circfill(sx(ball.x)+1,sy(ball.y)+1,max(1.0,radius*scale),40);
        circfill(sx(ball.x),sy(ball.y)-ball.z*2.0,max(1.0,radius*scale),7);
        pset(sx(ball.x)-1,sy(ball.y)-ball.z*2.0,6);
    }
    clip();
}
