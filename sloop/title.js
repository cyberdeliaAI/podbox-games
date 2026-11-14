// title: the start screen over the ball swinging by itself, and how to
// play. update() returns true to start a game.

const MENU = 0, HELP = 1;

var page = MENU;
var sel = 0;
var ITEMS = ["PLAY", "HOW TO PLAY"];
var swing = 0.0;                   // the demo's own push, turns a tick

// The menu, the ball still above the hub
function enter() {
    page = MENU;
    sel = 0;
    ball.reset();
}

// The demo and the menu, once a tick: true to start
function update(k) {
    // the ball swings to and fro by itself behind the title
    swing = sin(frame() / 120.0) * 0.0016;
    ball.vel += swing * k;
    ball.vel -= ball.vel * ball.DAMP * k;
    ball.ang += ball.vel * k;
    ball.ang -= flr(ball.ang);
    ball.place();

    if (page == HELP) {
        if (btnp(4) || btnp(3)) {
            page = MENU;
            sfx(SFX.tick);
        }
        return false;
    }
    var steps = wheelsteps();
    if (btnp(0))
        steps--;
    if (btnp(1))
        steps++;
    if (steps != 0) {
        sel = ((sel + steps) % 2 + 2) % 2;
        click();
    }
    if (btnp(4)) {
        sfx(SFX.tick);
        if (sel == 0)
            return true;
        page = HELP;
    }
    return false;
}

// The title, the ball and the menu, or how to play
function draw() {
    if (page == HELP) {
        drawHelp();
        return;
    }
    cls(1);
    circ(ball.CX, ball.CY, flr(ball.L), 5);
    circfill(ball.CX, ball.CY, 6, 13);
    circ(ball.CX, ball.CY, 6, 6);
    circfill(ball.CX, ball.CY, 2, 9);
    ball.draw();
    font(FONT.CAPS, 2);
    hud.shadow("SLOOP", 80 - textw("SLOOP") / 2, 6, 10);
    font(FONT.CAPS);
    var t = "A WRECKING BALL ON THE BEAT";
    hud.shadow(t, 80 - textw(t) / 2, 21, 7);
    for (var i = 0; i < 2; i++) {
        var y = 90 + i * 10;
        var s = ITEMS[i];
        if (i == sel) {
            rectfill(40, y - 2, 119, y + 6, 2);
            hud.shadow(s, 80 - textw(s) / 2, y, 10);
            print(">", 44, y, 10);
            print("<", 112, y, 10);
        } else {
            hud.shadow(s, 80 - textw(s) / 2, y, 7);
        }
    }
    t = !rhythm.on ? "BEAT OFF: FREE TEMPO" : playback.playing() ? "MUSIC ON: PLAYS TO ITS BEAT" : "PLAY SOME MUSIC, OR A FREE TEMPO";
    print(t, 80 - textw(t) / 2, 112, 13);
    var best = score.best(BOARD.points);
    if (best != null && best > 0) {
        t = "BEST " + best;
        print(t, 157 - textw(t), 3, 13);
    }
    print("V1.0", 3, 3, 13);
}

// How to play
function drawHelp() {
    cls(1);
    var t = "HOW TO PLAY";
    print(t, 80 - textw(t) / 2, 4, 10);
    var lines = ["TURN THE WHEEL TO SWING THE BALL:",
                 "IT KEEPS GOING, SLOWING DOWN.",
                 "PLAY: A HARD SHOVE.",
                 "PREV, NEXT: NUDGE IT TO AIM.",
                 "",
                 "BLOCKS CROSS THE RING ON THE BEAT:",
                 "BE THERE. FASTER HITS HARDER.",
                 "A RED BLOCK ON ITS BEAT: TRIPLE!",
                 "ONE AT THE CRANE COSTS A HEART.",
                 "A ROUND IS A TRACK OF YOUR MUSIC."];
    for (var i = 0; i < 10; i++)
        print(lines[i], 80 - textw(lines[i]) / 2, 15 + i * 9, i == 7 ? 14 : 7);
    t = "SELECT: BACK";
    print(t, 80 - textw(t) / 2, 110, 13);
}
